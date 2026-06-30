// app/(voluntario)/index.tsx
import { useEffect, useState } from 'react'
import NotificacoesBell from '../../components/NotificacoesBell'
import { Feather } from '@expo/vector-icons'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import BottomNav from '../../components/BottomNav'
import { useProvinciaDoUser } from '../../hooks/useProvincia'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { useAcesso } from '../../hooks/useAcesso'
import { limparTelefoneLembrado } from '../../utils/session'
import { mostrarAlerta, confirmar } from '../../utils/alert'
import { SafeAreaView } from 'react-native-safe-area-context'


type Profile     = { nome: string; email: string }
type Voluntario  = { id: string; 
  numero_serial: string | null; 
  tipo_sanguineo: string | null; 
  estado: string;  banco_id: string | null; }
type Doacao      = { data_doacao: string; tipo_doacao: string }
type Agendamento = { estado: string; slots: { data: string; hora: string } | null } | null

export default function VoluntarioDashboard() {
  
  const { isApto, isPendente } = useAcesso()
  const { provincia }          = useProvinciaDoUser()
  const { width }              = useWindowDimensions()
  const isWeb                  = Platform.OS === 'web' && width > 900


  const [userId,     setUserId]     = useState<string>('')
  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [voluntario, setVoluntario] = useState<Voluntario | null>(null)
  const [doacoes,    setDoacoes]    = useState<Doacao[]>([])
  const [proximo,    setProximo]    = useState<Agendamento>(null)
  const [loading,    setLoading]    = useState(true)

const [campanhas, setCampanhas] = useState<any[]>([])
const [emergencias, setEmergencias] = useState<any[]>([])


// Estados para fila de exames
const [filaExame, setFilaExame]       = useState<any>(null)
const [loadingFila, setLoadingFila]   = useState(false)
const [tirandoSenha, setTirandoSenha] = useState(false)
const [posicaoActual, setPosicaoActual] = useState<number>(0)


const [bancoId, setBancoId]     = useState<string | null>(null)
const [bancoNome, setBancoNome] = useState<string>('')

// No loadData, adiciona:
usePushNotifications(userId)

  useEffect(() => { loadData() }, [])

  async function loadFilaExame(volId: string, bancoId: string) {
            const hoje = new Date().toISOString().split('T')[0]
            const { data } = await supabase
              .from('fila_exames')
              .select('*')
              .eq('voluntario_id', volId)
              .eq('data', hoje)
              .not('estado', 'in', '("cancelado","concluido")')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            setFilaExame(data)

        if (data) {
          // Conta quantas pessoas estão à frente
          const { count } = await supabase
            .from('fila_exames')
            .select('*', { count: 'exact', head: true })
            .eq('banco_id', bancoId)
            .eq('tipo', data.tipo)
            .eq('data', hoje)
            .eq('estado', 'aguardando')
            .lt('posicao', data.posicao)
          setPosicaoActual(count || 0)
        }
  }

  async function tirarSenha(tipo: 'rastreio' | 'doacao') {
        if (!voluntario || !bancoId) {
          mostrarAlerta('Atenção', 'Não foi possível determinar o teu hospital. Actualiza o perfil.')
          return
        }
        setTirandoSenha(true)

        // Gera a senha via RPC
        const { data: senhaData, error: senhaErr } = await supabase
          .rpc('gerar_senha_fila', {
            p_banco_id: bancoId!,   // ← aqui
            p_tipo: tipo,
          })

        if (senhaErr || !senhaData || senhaData.length === 0) {
          mostrarAlerta('Erro', 'Não foi possível gerar a senha. Tenta novamente.')
          setTirandoSenha(false)
          return
        }

        const { senha, posicao } = senhaData[0]

        const { error } = await supabase.from('fila_exames').insert({
          voluntario_id: voluntario.id,
          banco_id: bancoId!,
          tipo,
          senha,
          posicao,
          estado: 'aguardando',
        })

        if (error) {
          mostrarAlerta('Erro', error.message)
        } else {
          mostrarAlerta(
            `🎫 Senha ${senha}`,
            tipo === 'rastreio'
              ? 'Senha de rastreio gerada! Dirije-te ao hospital. Podes acompanhar a fila aqui.'
              : 'Senha de doação gerada! Aguarda ser chamado.'
          )
          await loadData()
        }
        setTirandoSenha(false)
  }
  async function cancelarSenha() {
        if (!filaExame) return
        confirmar('Cancelar senha', 'Tens a certeza que queres cancelar a tua senha?', async () => {
          await supabase.from('fila_exames')
            .update({ estado: 'cancelado' })
            .eq('id', filaExame.id)
          setFilaExame(null)
          loadData()
        })
  }
  async function loadData() {
    try {
      const { data: campsData } = await supabase
        .from('campanhas')
        .select('id, titulo, descricao, tipo, tipo_sanguineo, meta_doadores, total_atingido, data_fim')
        .eq('publicado', true)
        .order('created_at', { ascending: false })
        .limit(3)
      setCampanhas(campsData || [])

      const { data: emergData } = await supabase
        .from('pedidos_emergencia')
        .select('id, tipo_sanguineo, descricao, total_aceitaram, max_doadores, estado')
        .eq('estado', 'ativo')
        .order('created_at', { ascending: false })
        .limit(2)
      setEmergencias(emergData || [])

      const { data: { session } } = await supabase.auth.getSession()
const user = session?.user
      if (!user) { router.replace('/(auth)/login'); return }

      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles').select('nome, email')
        .eq('id', user.id).single()

      const { data: vol } = await supabase
        .from('voluntarios')
        .select('id, numero_serial, tipo_sanguineo, estado, banco_id')
        .eq('profile_id', user.id).single()

      setProfile(prof)
      setVoluntario(vol)
      if (vol?.banco_id) setBancoId(vol.banco_id) 
      

      if (vol?.id) {
        const { data: doc } = await supabase
          .from('doacoes')
          .select('data_doacao, tipo_doacao')
          .eq('voluntario_id', vol.id)
          .order('data_doacao', { ascending: false })
          .limit(3)

        const { data: ag } = await supabase
          .from('agendamentos')
          .select('estado, slots(data, hora)')
          .eq('voluntario_id', vol.id)
          .eq('estado', 'confirmado')
          .order('data_agendamento', { ascending: false })
          .limit(1)
          .maybeSingle()

        setDoacoes(doc || [])
        setProximo((ag as Agendamento) || null)
      }
    } catch (e) { console.log(e) }
    setLoading(false)
  }

useEffect(() => {
  if (!voluntario?.id || !bancoId) return
  

  const canal = supabase
    .channel(`fila-vol-${voluntario.id}-${Date.now()}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'fila_exames',
    }, () => loadFilaExame(voluntario.id, bancoId))
    .subscribe()

  return () => { supabase.removeChannel(canal) }  
}, [voluntario?.id, bancoId]) 

 async function handleLogout() {
  await supabase.auth.signOut()
  await limparTelefoneLembrado()
  router.replace('/(auth)/landing' as any)
  }

  // ── loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={Colors.red} />
    </View>
  )

  
  const nome    = profile?.nome?.split(' ')[0] || 'Doador'
  const isExame = voluntario?.estado === 'em_exame'

  // ── nav items ──────────────────────────────────────────────────────────────
  const navItems: {
    icon: keyof typeof Feather.glyphMap
    label: string
    route: string
    active: boolean
  }[] = [
    { icon: 'grid',       label: 'Dashboard', route: '/(voluntario)',           active: true  },
    { icon: 'credit-card',label: 'Cartão',    route: '/(voluntario)/cartao',    active: false },
    { icon: 'calendar',   label: 'Agendar',   route: '/(voluntario)/agendar',   active: false },
    { icon: 'clock',      label: 'Histórico', route: '/(voluntario)/historico', active: false },
    { icon: 'activity',   label: 'Campanhas', route: '/(voluntario)/campanhas', active: false },
    { icon: 'users',      label: 'ONGs',      route: '/(voluntario)/ongs',      active: false },
    { icon: 'book-open',  label: 'Educação',  route: '/(voluntario)/educacao',  active: false },
  ]

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ════════ SIDEBAR WEB ════════ */}
      {isWeb && (
        <View style={s.sidebar}>
          <View>
            {/* Logo */}
            <View style={s.sidebarLogoWrap}>
              <View style={s.sidebarLogoIcon}>
                <Text style={{ color: Colors.white, fontWeight: '800', fontSize: 16 }}>B</Text>
              </View>
              <Text style={s.sidebarLogoText}>
                MO<Text style={{ color: Colors.redSoft }}>YO</Text>
              </Text>
            </View>

            {/* Nav */}
            <View style={s.sidebarNav}>
              {navItems.map(n => (
                <TouchableOpacity
                  key={n.label}
                  style={[s.sidebarItem, n.active && s.sidebarItemActive]}
                  onPress={() => router.push(n.route as any)}
                >
                  <Feather
                    name={n.icon}
                    size={16}
                    color={n.active ? Colors.redSoft : Colors.muted}
                  />
                  <Text style={[s.sidebarItemLabel, n.active && s.sidebarItemLabelActive]}>
                    {n.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Footer */}
          <View style={s.sidebarFooter}>
            <View style={s.sidebarAvatar}>
              <Text style={s.sidebarAvatarText}>
                {profile?.nome?.slice(0, 2).toUpperCase() || 'BH'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sidebarUserName} numberOfLines={1}>{profile?.nome}</Text>
              <Text style={s.sidebarUserRole}>Voluntário</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 12 }}>
              <Feather name="log-out" size={18} color={Colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ════════ MAIN ════════ */}
      <View style={s.main}>

        {/* Topbar */}
        <View style={[s.topbar]}>
          {!isWeb && (
            <Text style={s.topbarLogo}>
              MO<Text style={{ color: Colors.redSoft }}>YO</Text>
            </Text>
          )}
          {isWeb && (
            <Text style={s.topbarTitle}>Dashboard</Text>
          )}
          <View style={{ flex: 1 }} />
          <View style={s.topbarBadge}>
            <Text style={s.topbarBadgeText}>VOLUNTÁRIO</Text>
          </View>
          {userId ? <NotificacoesBell userId={userId} /> : null}
          {!isWeb && (
            <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 4 }}>
              <Text style={{ color: Colors.muted, fontSize: 13 }}>Sair</Text>
            </TouchableOpacity>
          )}
          <View style={s.topbarAvatar}>
            <Text style={s.topbarAvatarText}>
              {profile?.nome?.slice(0, 2).toUpperCase() || 'BH'}
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={s.content}>

            {/* ── YO CARD ──────────────────────────────────────────────── */}
            <View style={s.YOCard}>
              <View style={s.YOGlow} />
              <View style={s.YOBgDrop}>
                <Text style={{ fontSize: 80, opacity: 0.08 }}>🩸</Text>
              </View>

              <Text style={s.YOEyebrow}>
                {provincia ? `${provincia.nome} · Angola` : 'Hospital Ngola Kimbanda · Namibe'}
              </Text>
              <Text style={s.YOTitle}>
                Bem-vindo,{'\n'}
                <Text style={s.YOName}>{nome}</Text>
              </Text>

              {/* Alertas de estado */}
              {isPendente && (
                <View style={s.alertPending}>
                  <Text style={s.alertIcon}>⏳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: Colors.gold }]}>Conta Pendente</Text>
                    <Text style={s.alertText}>
                      Dirije-te ao hospital com o teu QR Code para realizar os exames de triagem gratuitos.
                    </Text>
                  </View>
                </View>
              )}
              {isExame && (
                <View style={[s.alertPending, { borderColor: 'rgba(74,158,255,0.3)', backgroundColor: 'rgba(74,158,255,0.06)' }]}>
                  <Text style={s.alertIcon}>🔬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: Colors.blue }]}>Exames em Curso</Text>
                    <Text style={s.alertText}>
                      Receberás uma notificação com os resultados em breve.
                    </Text>
                  </View>
                </View>
              )}
              {isApto && proximo && (
                <View style={[s.alertPending, { borderColor: 'rgba(46,204,113,0.3)', backgroundColor: 'rgba(46,204,113,0.06)' }]}>
                  <Text style={s.alertIcon}>📅</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.alertTitle, { color: Colors.green }]}>Próxima Doação</Text>
                    <Text style={s.alertText}>
                      {proximo?.slots?.data} às {proximo?.slots?.hora?.slice(0, 5)}
                    </Text>
                  </View>
                </View>
              )}

              {/* Botões principais */}
              <View style={s.YOActions}>
                <TouchableOpacity
                  style={s.btnPrimary}
                  onPress={() => router.push('/(voluntario)/cartao' as any)}
                >
                  <Text style={s.btnPrimaryText}>💳 Ver Cartão</Text>
                </TouchableOpacity>
                {isApto && (
                  <TouchableOpacity
                    style={s.btnGhost}
                    onPress={() => router.push('/(voluntario)/agendar' as any)}
                  >
                    <Text style={s.btnGhostText}>📅 Agendar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {/* ── fim YO CARD ─────────────────────────────────────────── */}

            {/* ── ACÇÕES RÁPIDAS ──────────────────────────────────────── */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>⚡ Acções Rápidas</Text>
              <View style={s.accoesGrid}>
                <AccaoCard
                  icon="💳"
                  label="Meu Cartão"
                  onPress={() => router.push('/(voluntario)/cartao' as any)}
                />
                <AccaoCard
                  icon="📅"
                  label="Agendar"
                  onPress={() => router.push('/(voluntario)/agendar' as any)}
                  disabled={!isApto}
                />
                <AccaoCard
                  icon="📢"
                  label="Campanhas"
                  onPress={() => router.push('/(voluntario)/campanhas' as any)}
                  disabled={!isApto}
                />
                <AccaoCard
                  icon="🤝"
                  label="ONGs"
                  onPress={() => router.push('/(voluntario)/ongs' as any)}
                  disabled={!isApto}
                />
                <AccaoCard
                  icon="📚"
                  label="Educação"
                  onPress={() => router.push('/(voluntario)/educacao' as any)}
                />
                <AccaoCard
                  icon="👤"
                  label="Perfil"
                  onPress={() => router.push('/(voluntario)/perfil' as any)}
                />
              </View>

              {/* Aviso para pendentes */}
              {isPendente && (
                <View style={s.avisoLimitado}>
                  <Feather name="lock" size={14} color={Colors.gold} />
                  <Text style={s.avisoLimitadoText}>
                    Completa os exames no hospital para desbloquear todas as funcionalidades.
                  </Text>
                </View>
              )}
            </View>

            {/* ── STATS ────────────────────────────────────────────────── */}
            <View style={s.statsRow}>
              <StatCard value={doacoes.length.toString()} label="Doações"  sub="realizadas"    color={Colors.redSoft} />
              <StatCard value={(doacoes.length * 3).toString()} label="Vidas" sub="salvas (es.)" color={Colors.blue}    />
              <StatCard value={voluntario?.tipo_sanguineo || '—'} label="Tipo" sub="sanguíneo"   color={Colors.green}   />
              <StatCard
                value={estadoVal(voluntario?.estado)}
                label={estadoLabel(voluntario?.estado)}
                sub="da conta"
                color={estadoCor(voluntario?.estado)}
              />
            </View>

            {/* ── URGÊNCIAS & CAMPANHAS ── */}
            {(emergencias.length > 0 || campanhas.length > 0) && (
              <View style={s.section}>
                <View style={s.sectionHeaderRow}>
                  <Text style={s.sectionTitle}>🚨 Urgências & Campanhas</Text>
                  <TouchableOpacity onPress={() => router.push('/(voluntario)/campanhas' as any)}>
                    <Text style={s.sectionLink}>Ver todas →</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingRight: 4 }}
                >
                  {/* Cards de emergência */}
                  {emergencias.map(e => (
                    <TouchableOpacity
                      key={e.id}
                      style={s.campCard}
                      onPress={() => router.push('/(voluntario)/campanhas' as any)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.campCardBanner, { backgroundColor: '#3d0a10' }]}>
                        <Text style={{ fontSize: 36 }}>🩸</Text>
                        <View style={s.urgentTag}>
                          <Text style={s.urgentTagText}>URGENTE</Text>
                        </View>
                      </View>
                      <View style={s.campCardBody}>
                        <Text style={s.campCardTitulo} numberOfLines={1}>
                          Necessidade de {e.tipo_sanguineo}
                        </Text>
                        {e.descricao && (
                          <Text style={s.campCardDesc} numberOfLines={2}>{e.descricao}</Text>
                        )}
                        <View style={s.campCardFooter}>
                          <View style={s.campProgressBar}>
                            <View style={[s.campProgressFill, {
                              width: `${Math.min((e.total_aceitaram / e.max_doadores) * 100, 100)}%` as any,
                              backgroundColor: Colors.red,
                            }]} />
                          </View>
                          <View style={s.campProgressMeta}>
                            <Text style={s.campProgressText}>
                              {e.total_aceitaram}/{e.max_doadores} doadores
                            </Text>
                            <Text style={[s.campProgressText, { color: Colors.redSoft, fontWeight: '700' }]}>
                              CRÍTICO
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Cards de campanha */}
                  {campanhas.map(c => {
                    const isUrgente  = c.tipo === 'urgente'
                    const isNoticia  = c.tipo === 'noticia'
                    const bannerBg   = isUrgente ? '#3d0a10' : isNoticia ? '#0a1a2e' : '#0a2e1a'
                    const emoji      = isUrgente ? '🩸' : isNoticia ? '📰' : '❤️'
                    const progressCor = isUrgente ? Colors.red : isNoticia ? Colors.blue : Colors.green
                    const progresso  = c.meta_doadores
                      ? Math.min((c.total_atingido / c.meta_doadores) * 100, 100)
                      : 0

                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={s.campCard}
                        onPress={() => router.push('/(voluntario)/campanhas' as any)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.campCardBanner, { backgroundColor: bannerBg }]}>
                          <Text style={{ fontSize: 36 }}>{emoji}</Text>
                          {isUrgente && (
                            <View style={s.urgentTag}>
                              <Text style={s.urgentTagText}>URGENTE</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.campCardBody}>
                          <Text style={s.campCardTitulo} numberOfLines={1}>{c.titulo}</Text>
                          {c.descricao && (
                            <Text style={s.campCardDesc} numberOfLines={2}>{c.descricao}</Text>
                          )}
                          {c.meta_doadores && !isNoticia && (
                            <View style={s.campCardFooter}>
                              <View style={s.campProgressBar}>
                                <View style={[s.campProgressFill, {
                                  width: `${progresso}%` as any,
                                  backgroundColor: progressCor,
                                }]} />
                              </View>
                              <View style={s.campProgressMeta}>
                                <Text style={s.campProgressText}>
                                  {c.total_atingido}/{c.meta_doadores} doadores
                                </Text>
                                {c.data_fim && (
                                  <Text style={s.campProgressText}>
                                    até {new Date(c.data_fim).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                                  </Text>
                                )}
                              </View>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── ÚLTIMAS DOAÇÕES ──────────────────────────────────────── */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>📋 Últimas Doações</Text>
              <TouchableOpacity onPress={() => router.push('/(voluntario)/historico' as any)}>
                <Text style={s.sectionLink}>Ver histórico →</Text>
              </TouchableOpacity>
            </View>

            {/* ══ FILA DE EXAMES / RASTREIO ══ */}
            {(voluntario?.estado === 'pendente' || voluntario?.estado === 'em_exame') && (
              <View style={s.section}>
                {!filaExame ? (
                  /* Widget para tirar senha */
                  <View style={s.filaWidget}>
                    <View style={s.filaWidgetGlow} />
                    <View style={s.filaWidgetHeader}>
                      <Text style={{ fontSize: 32 }}>🏥</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.filaWidgetTitulo}>Precisas de fazer os exames</Text>
                        <Text style={s.filaWidgetSub}>
                          Tira a tua senha agora e vai ao hospital quando quiseres — a fila guarda o teu lugar.
                        </Text>
                      </View>
                    </View>

                    <View style={s.filaOpcoes}>
                      <TouchableOpacity
                        style={[s.filaOpcaoBtn, { borderColor: Colors.blue + '60' }]}
                        onPress={() => tirarSenha('rastreio')}
                        disabled={tirandoSenha}
                      >
                        {tirandoSenha ? (
                          <ActivityIndicator size="small" color={Colors.blue} />
                        ) : (
                          <>
                            <Text style={{ fontSize: 28, marginBottom: 8 }}>🧪</Text>
                            <Text style={s.filaOpcaoTitulo}>Exames de Rastreio</Text>
                            <Text style={s.filaOpcaoDesc}>
                              Hemoglobina, pressão, tipo sanguíneo e triagem completa
                            </Text>
                            <View style={s.filaOpcaoBadge}>
                              <Text style={s.filaOpcaoBadgeText}>Tirar Senha R</Text>
                            </View>
                          </>
                        )}
                      </TouchableOpacity>

                      
                    </View>
                  </View>
                ) : (
                  /* Widget de rastreio em tempo real */
                  <View style={s.rastreioCard}>
                    <View style={s.rastreioHeader}>
                      <View style={s.rastreioSenhaBox}>
                        <Text style={s.rastreioSenhaLabel}>A TUA SENHA</Text>
                        <Text style={s.rastreioSenha}>{filaExame.senha}</Text>
                        <Text style={s.rastreioTipo}>
                          {filaExame.tipo === 'rastreio' ? '🧪 Rastreio' : '🩸 Doação'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, paddingLeft: 16 }}>
                        <Text style={s.rastreioEstadoLabel}>ESTADO</Text>
                        <View style={s.rastreioEstadoBadge}>
                          <View style={[s.rastreioEstadoDot, {
                            backgroundColor:
                              filaExame.estado === 'chamado'         ? Colors.gold :
                              filaExame.estado === 'em_atendimento'  ? Colors.blue :
                              filaExame.estado === 'concluido'       ? Colors.green : Colors.muted
                          }]} />
                          <Text style={[s.rastreioEstadoText, {
                            color:
                              filaExame.estado === 'chamado'         ? Colors.gold :
                              filaExame.estado === 'em_atendimento'  ? Colors.blue :
                              filaExame.estado === 'concluido'       ? Colors.green : Colors.white
                          }]}>
                            {filaExame.estado === 'aguardando'      ? 'A aguardar' :
                            filaExame.estado === 'chamado'         ? '📣 CHAMADO!' :
                            filaExame.estado === 'em_atendimento'  ? 'Em atendimento' :
                            filaExame.estado === 'concluido'       ? 'Concluído' : filaExame.estado}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Posição na fila */}
                    {filaExame.estado === 'aguardando' && (
                      <View style={s.rastreioPosicao}>
                        <View style={s.rastreioPosicaoItem}>
                          <Text style={s.rastreioPosicaoNum}>{posicaoActual}</Text>
                          <Text style={s.rastreioPosicaoLabel}>à tua frente</Text>
                        </View>
                        <View style={s.rastreioDivider} />
                        <View style={s.rastreioPosicaoItem}>
                          <Text style={s.rastreioPosicaoNum}>#{filaExame.posicao}</Text>
                          <Text style={s.rastreioPosicaoLabel}>a tua posição</Text>
                        </View>
                        <View style={s.rastreioDivider} />
                        <View style={s.rastreioPosicaoItem}>
                          <Text style={s.rastreioPosicaoNum}>
                            {posicaoActual === 0 ? 'Próx.' : `~${posicaoActual * 8}min`}
                          </Text>
                          <Text style={s.rastreioPosicaoLabel}>espera est.</Text>
                        </View>
                      </View>
                    )}

                    {/* Alerta quando chamado */}
                    {filaExame.estado === 'chamado' && (
                      <View style={s.chamadoAlerta}>
                        <Text style={{ fontSize: 32 }}>📣</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.chamadoAlertaTitulo}>A tua vez chegou!</Text>
                          <Text style={s.chamadoAlertaSub}>
                            Dirige-te ao balcão de atendimento agora.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Timeline de passos */}
                    <View style={s.rastreioTimeline}>
                      <TimelineStep
                        done={true}
                        active={false}
                        label="Senha tirada"
                        hora={new Date(filaExame.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      />
                      <TimelineStep
                        done={['chamado','em_atendimento','concluido'].includes(filaExame.estado)}
                        active={filaExame.estado === 'chamado'}
                        label="Chamado ao balcão"
                        hora={filaExame.hora_chamada
                          ? new Date(filaExame.hora_chamada).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                          : undefined
                        }
                      />
                      <TimelineStep
                        done={['em_atendimento','concluido'].includes(filaExame.estado)}
                        active={filaExame.estado === 'em_atendimento'}
                        label="Em atendimento"
                        hora={undefined}
                      />
                      <TimelineStep
                        done={filaExame.estado === 'concluido'}
                        active={false}
                        label="Exames concluídos"
                        hora={filaExame.hora_conclusao
                          ? new Date(filaExame.hora_conclusao).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                          : undefined
                        }
                        isLast
                      />
                    </View>

                    {filaExame.estado === 'aguardando' && (
                      <TouchableOpacity style={s.cancelarSenhaBtn} onPress={cancelarSenha}>
                        <Text style={s.cancelarSenhaBtnText}>Cancelar senha</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ══ FILA DE DOAÇÃO — para aptos ══ */}
{voluntario?.estado === 'apto' && (
  <View style={s.section}>
    {!filaExame ? (
      // Sem senha activa — mostra botão para tirar
      <TouchableOpacity
        style={[s.filaOpcaoBtn, { borderColor: Colors.red + '60' }]}
        onPress={() => tirarSenha('doacao')}
        disabled={tirandoSenha}
      >
        {tirandoSenha ? (
          <ActivityIndicator size="small" color={Colors.red} />
        ) : (
          <>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>🩸</Text>
            <Text style={s.filaOpcaoTitulo}>Doação de Sangue</Text>
            <Text style={s.filaOpcaoDesc}>Faz a tua doação de sangue hoje</Text>
            <View style={[s.filaOpcaoBadge, { backgroundColor: Colors.red + '20' }]}>
              <Text style={[s.filaOpcaoBadgeText, { color: Colors.red }]}>
                Tirar Senha D
              </Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    ) : (
      // Senha activa — mostra rastreio em tempo real (igual ao rastreio)
      <View style={s.rastreioCard}>
        <View style={s.rastreioHeader}>
          <View style={s.rastreioSenhaBox}>
            <Text style={s.rastreioSenhaLabel}>A TUA SENHA</Text>
            <Text style={s.rastreioSenha}>{filaExame.senha}</Text>
            <Text style={s.rastreioTipo}>🩸 Doação</Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 16 }}>
            <Text style={s.rastreioEstadoLabel}>ESTADO</Text>
            <View style={s.rastreioEstadoBadge}>
              <View style={[s.rastreioEstadoDot, {
                backgroundColor:
                  filaExame.estado === 'chamado'        ? Colors.gold :
                  filaExame.estado === 'em_atendimento' ? Colors.blue :
                  filaExame.estado === 'concluido'      ? Colors.green : Colors.muted
              }]} />
              <Text style={[s.rastreioEstadoText, {
                color:
                  filaExame.estado === 'chamado'        ? Colors.gold :
                  filaExame.estado === 'em_atendimento' ? Colors.blue :
                  filaExame.estado === 'concluido'      ? Colors.green : Colors.white
              }]}>
                {filaExame.estado === 'aguardando'     ? 'A aguardar' :
                 filaExame.estado === 'chamado'        ? '📣 CHAMADO!' :
                 filaExame.estado === 'em_atendimento' ? 'Em atendimento' :
                 filaExame.estado === 'concluido'      ? 'Concluído' : filaExame.estado}
              </Text>
            </View>
          </View>
        </View>

        {filaExame.estado === 'aguardando' && (
          <View style={s.rastreioPosicao}>
            <View style={s.rastreioPosicaoItem}>
              <Text style={s.rastreioPosicaoNum}>{posicaoActual}</Text>
              <Text style={s.rastreioPosicaoLabel}>à tua frente</Text>
            </View>
            <View style={s.rastreioDivider} />
            <View style={s.rastreioPosicaoItem}>
              <Text style={s.rastreioPosicaoNum}>#{filaExame.posicao}</Text>
              <Text style={s.rastreioPosicaoLabel}>a tua posição</Text>
            </View>
            <View style={s.rastreioDivider} />
            <View style={s.rastreioPosicaoItem}>
              <Text style={s.rastreioPosicaoNum}>
                {posicaoActual === 0 ? 'Próx.' : `~${posicaoActual * 8}min`}
              </Text>
              <Text style={s.rastreioPosicaoLabel}>espera est.</Text>
            </View>
          </View>
        )}

        {filaExame.estado === 'chamado' && (
          <View style={s.chamadoAlerta}>
            <Text style={{ fontSize: 32 }}>📣</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.chamadoAlertaTitulo}>A tua vez chegou!</Text>
              <Text style={s.chamadoAlertaSub}>
                Dirige-te ao balcão de doação agora.
              </Text>
            </View>
          </View>
        )}

        <View style={s.rastreioTimeline}>
          <TimelineStep
            done={true} active={false} label="Senha tirada"
            hora={new Date(filaExame.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          />
          <TimelineStep
            done={['chamado','em_atendimento','concluido'].includes(filaExame.estado)}
            active={filaExame.estado === 'chamado'}
            label="Chamado ao balcão"
            hora={filaExame.hora_chamada
              ? new Date(filaExame.hora_chamada).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              : undefined}
          />
          <TimelineStep
            done={['em_atendimento','concluido'].includes(filaExame.estado)}
            active={filaExame.estado === 'em_atendimento'}
            label="A realizar doação"
            hora={undefined}
          />
          <TimelineStep
            done={filaExame.estado === 'concluido'}
            active={false}
            label="Doação concluída 🩸"
            hora={filaExame.hora_conclusao
              ? new Date(filaExame.hora_conclusao).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
              : undefined}
            isLast
          />
        </View>

        {filaExame.estado === 'aguardando' && (
          <TouchableOpacity style={s.cancelarSenhaBtn} onPress={cancelarSenha}>
            <Text style={s.cancelarSenhaBtnText}>Cancelar senha</Text>
          </TouchableOpacity>
        )}
      </View>
    )}
  </View>
)}

            {doacoes.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🩸</Text>
                <Text style={s.emptyTitle}>Ainda sem doações</Text>
                <Text style={s.emptyText}>
                  {isApto ? 'Agenda a tua primeira doação!' : 'Completa os exames para começares.'}
                </Text>
              </View>
            ) : (
              doacoes.map((d, i) => (
                <View key={i} style={s.historyItem}>
                  <View style={s.historyIcon}>
                    <Text style={{ fontSize: 20 }}>🩸</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyTitle}>{d.tipo_doacao}</Text>
                    <Text style={s.historySub}>Hospital Ngola Kimbanda</Text>
                  </View>
                  <View>
                    <Text style={s.historyDate}>{formatDate(d.data_doacao)}</Text>
                    <View style={s.badgeDone}>
                      <Text style={s.badgeDoneText}>Realizada</Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            <View style={{ height: isWeb ? 40 : 90 }} />
          </View>
        </ScrollView>

        {/* Botão SOS — flutuante mobile */}
        {!isWeb && (
          <TouchableOpacity
            style={sos.sosBtn}
            onPress={() => router.push('/(voluntario)/solicitante' as any)}
          >
            <Text style={sos.sosBtnText}>🆘</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Nav mobile */}
        {!isWeb && (
          <BottomNav items={[
            { icon: 'grid',        label: 'Início',    route: '/(voluntario)',          active: true  },
            { icon: 'rss',         label: 'Feed',      route: '/(voluntario)/feed'      },
            { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'                  },
            { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'                 },
            { icon: 'user',        label: 'Perfil',    route: '/(voluntario)/perfil'    },
          ]} />
        )}
      </View>
    </SafeAreaView>
  )
}

function AccaoCard({
  icon, label, onPress, disabled = false,
}: {
  icon: string
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <TouchableOpacity
      style={[s.accaoCard, disabled && s.accaoCardDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: 26 }}>{icon}</Text>
      <Text style={[s.accaoLabel, disabled && { color: Colors.muted }]}>{label}</Text>
    </TouchableOpacity>
  )
}

function StatCard({
  value, label, sub, color,
}: {
  value: string; label: string; sub: string; color: string
}) {
  return (
    <View style={s.statCard}>
      <View style={[s.statTopBar, { backgroundColor: color }]} />
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statSub}>{sub}</Text>
    </View>
  )
}

function CampaignCard({
  tipo, titulo, desc, progress, meta, tag, tagColor,
}: {
  tipo: 'urgente' | 'regular' | 'ong'
  titulo: string; desc: string
  progress: number; meta: string
  tag: string; tagColor: string
}) {
  const bannerBg = {
    urgente: '#3d0a10',
    regular: '#0a1a2e',
    ong:     '#0a2e1a',
  }[tipo]
  const bannerEmoji   = { urgente: '🩸', regular: '❤️', ong: '🤝' }[tipo]
  const progressColor = tipo === 'ong' ? Colors.blue : tipo === 'regular' ? Colors.green : Colors.red

  return (
    <View style={s.campaignCard}>
      {tipo === 'urgente' && (
        <View style={s.urgentTag}>
          <Text style={s.urgentTagText}>URGENTE</Text>
        </View>
      )}
      <View style={[s.campaignBanner, { backgroundColor: bannerBg }]}>
        <Text style={{ fontSize: 32 }}>{bannerEmoji}</Text>
      </View>
      <View style={s.campaignBody}>
        <Text style={s.campaignTitle}>{titulo}</Text>
        <Text style={s.campaignDesc}>{desc}</Text>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${progress}%` as any, backgroundColor: progressColor }]} />
        </View>
        <View style={s.campaignMeta}>
          <Text style={s.campaignMetaText}>{meta}</Text>
          <Text style={[s.campaignMetaText, { color: tagColor }]}>{tag}</Text>
        </View>
      </View>
    </View>
  )
}

function TimelineStep({ done, active, label, hora, isLast }: {
  done: boolean; active: boolean; label: string
  hora?: string; isLast?: boolean
}) {
  const cor = done ? Colors.green : active ? Colors.gold : Colors.muted2
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={[ts.dot, { backgroundColor: cor, borderColor: cor }]}>
          {done && <Feather name="check" size={10} color={Colors.dark} />}
          {active && !done && <View style={[ts.dotPulse, { backgroundColor: Colors.gold }]} />}
        </View>
        {!isLast && <View style={[ts.line, { backgroundColor: done ? Colors.green : Colors.dark4 }]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
        <Text style={[ts.label, { color: done || active ? Colors.white : Colors.muted }]}>{label}</Text>
        {hora && <Text style={ts.hora}>{hora}</Text>}
        {active && <Text style={[ts.hora, { color: Colors.gold }]}>Agora</Text>}
      </View>
    </View>
  )
}

const ts = StyleSheet.create({
  dot:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotPulse: { width: 8, height: 8, borderRadius: 4 },
  line:     { width: 2, flex: 1, marginVertical: 2 },
  label:    { fontSize: 13, fontWeight: '600' },
  hora:     { fontSize: 11, color: Colors.muted, marginTop: 2 },
})



function estadoVal(e?: string | null) {
  return ({ pendente: '⏳', em_exame: '🔬', apto: '✓', inapto_temp: '✗', inapto_perm: '✗' } as Record<string, string>)[e || ''] || '—'
}
function estadoLabel(e?: string | null) {
  return ({ pendente: 'Pendente', em_exame: 'Em Exame', apto: 'Apto', inapto_temp: 'Inapto', inapto_perm: 'Inapto' } as Record<string, string>)[e || ''] || '—'
}
function estadoCor(e?: string | null) {
  return ({ pendente: Colors.gold, em_exame: Colors.blue, apto: Colors.green, inapto_temp: Colors.redSoft, inapto_perm: Colors.redSoft } as Record<string, string>)[e || ''] || Colors.muted
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const sos = StyleSheet.create({
  sosBtn: {
    position: 'absolute',
    bottom: 90, right: 20,
    width: 52, height: 52,
    borderRadius: 26,
    backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
    zIndex: 100,
  },
  sosBtnText: { fontSize: 22 },
})

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  main:   { flex: 1, flexDirection: 'column' },

  // ── SIDEBAR ──────────────────────────────────────────────────────────────
  sidebar: {
    width: 230, backgroundColor: Colors.dark2,
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)',
    padding: 20, justifyContent: 'space-between',
  },
  sidebarLogoWrap:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  sidebarLogoIcon:        { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText:        { fontSize: 18, fontWeight: '800', color: Colors.white },
  sidebarNav:             { gap: 4 },
  sidebarItem:            { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10 },
  sidebarItemActive:      { backgroundColor: Colors.redGlow },
  sidebarItemLabel:       { fontSize: 13, fontWeight: '500', color: Colors.muted },
  sidebarItemLabelActive: { color: Colors.redSoft },
  sidebarFooter:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: Colors.dark3, borderRadius: 12 },
  sidebarAvatar:          { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarAvatarText:      { color: Colors.white, fontWeight: '700', fontSize: 12 },
  sidebarUserName:        { fontSize: 13, fontWeight: '600', color: Colors.white },
  sidebarUserRole:        { fontSize: 11, color: Colors.muted },

  // ── TOPBAR ────────────────────────────────────────────────────────────────
  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10,
  },
  topbarLogo:       { fontSize: 20, fontWeight: '800', color: Colors.white },
  topbarTitle:      { fontSize: 17, fontWeight: '700', color: Colors.white },
  topbarBadge:      { backgroundColor: Colors.red, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText:  { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },
  topbarAvatar:     { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  topbarAvatarText: { color: Colors.white, fontWeight: '700', fontSize: 12 },

  content: { padding: 20 },

  // ── YO CARD ───────────────────────────────────────────────────────────────
  YOCard: {
    backgroundColor: Colors.dark2, borderRadius: 20,
    padding: 24, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', position: 'relative',
  },
  YOGlow: {
    position: 'absolute', top: -80, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: Colors.redGlow,
  },
  YOBgDrop: { position: 'absolute', right: 20, bottom: -10, opacity: 1 },
  YOEyebrow: { fontSize: 11, color: Colors.muted, letterSpacing: 0.5, marginBottom: 8 },
  YOTitle:   { fontSize: 28, fontWeight: '800', color: Colors.white, marginBottom: 16, lineHeight: 34 },
  YOName:    { color: Colors.redSoft },
  YOActions: { flexDirection: 'row', gap: 10, marginTop: 8 },

  alertPending: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: 'rgba(232,180,75,0.07)',
    borderWidth: 1, borderColor: 'rgba(232,180,75,0.3)',
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  alertIcon:  { fontSize: 20 },
  alertTitle: { fontSize: 13, fontWeight: '700', color: Colors.gold, marginBottom: 3 },
  alertText:  { fontSize: 12, color: Colors.muted, lineHeight: 18 },

  btnPrimary: {
    backgroundColor: Colors.red, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 20,
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  btnPrimaryText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  btnGhost: {
    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  btnGhostText: { color: Colors.white, fontSize: 13, fontWeight: '600' },

  // ── ACÇÕES RÁPIDAS ────────────────────────────────────────────────────────
  section:          { marginBottom: 24 },
  accoesGrid:       {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12,
  },
  accaoCard: {
    // ~3 por linha em mobile; usa flex basis
    flexBasis: '30%', flexGrow: 1,
    backgroundColor: Colors.dark2,
    borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  accaoCardDisabled: { opacity: 0.4 },
  accaoLabel: {
    fontSize: 11, fontWeight: '600',
    color: Colors.white, textAlign: 'center',
  },

  // ── STATS ─────────────────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 70,
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  statTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  statValue:  { fontSize: 26, fontWeight: '800', marginTop: 10, marginBottom: 2, lineHeight: 30 },
  statLabel:  { fontSize: 12, fontWeight: '600', color: Colors.white },
  statSub:    { fontSize: 10, color: Colors.muted, marginTop: 2 },

  // ── SECTION HEADER ────────────────────────────────────────────────────────
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: Colors.white },


  // ── CAMPAIGN CARDS ────────────────────────────────────────────────────────
  campaignCard: {
    width: 260, backgroundColor: Colors.dark2,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    marginRight: 12, position: 'relative',
  },
  campaignBanner:   { height: 90, alignItems: 'center', justifyContent: 'center' },
  campaignBody:     { padding: 14 },
  campaignTitle:    { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 5 },
  campaignDesc:     { fontSize: 12, color: Colors.muted, lineHeight: 17, marginBottom: 10 },
  progressBg:       { height: 4, backgroundColor: Colors.dark5, borderRadius: 4, overflow: 'hidden', marginBottom: 7 },
  progressFill:     { height: 4, borderRadius: 4 },
  campaignMeta:     { flexDirection: 'row', justifyContent: 'space-between' },
  campaignMetaText: { fontSize: 11, color: Colors.muted },


  // ── HISTORY ───────────────────────────────────────────────────────────────
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.dark2, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  historyIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(232,23,58,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  historyTitle: { fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  historySub:   { fontSize: 12, color: Colors.muted },
  historyDate:  { fontSize: 11, color: Colors.muted, textAlign: 'right', marginBottom: 4 },
  badgeDone:    { backgroundColor: 'rgba(46,204,113,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-end' },
  badgeDoneText:{ fontSize: 10, fontWeight: '700', color: Colors.green },

  // ── EMPTY ─────────────────────────────────────────────────────────────────
  emptyBox: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 36, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.white, marginBottom: 6 },
  emptyText:  { fontSize: 13, color: Colors.muted, textAlign: 'center' },

  // ── AVISO LIMITADO ────────────────────────────────────────────────────────
  avisoLimitado: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(232,180,75,0.07)',
    borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)',
    borderRadius: 10, padding: 12, marginTop: 12,
  },
  avisoLimitadoText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },

  // ── BOTTOM NAV (legado — usa componente BottomNav) ────────────────────────
  bottomNav: {
    flexDirection: 'row', backgroundColor: Colors.dark2,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10,
  },
  navItem:  { flex: 1, alignItems: 'center', gap: 3 },
  navIcon:  { fontSize: 20 },
  navLabel: { fontSize: 10, color: Colors.muted, fontWeight: '500' },

  sectionHeaderRow: {
  flexDirection: 'row', justifyContent: 'space-between',
  alignItems: 'center', marginBottom: 14,
},
sectionLink: { fontSize: 13, fontWeight: '600', color: Colors.redSoft },

campCard: {
  width: 200,
  backgroundColor: Colors.dark2,
  borderRadius: 16,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  overflow: 'hidden',
},
campCardBanner: {
  height: 90, alignItems: 'center', justifyContent: 'center',
  position: 'relative',
},
campCardBody: { padding: 12 },
campCardTitulo: { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 4 },
campCardDesc:   { fontSize: 11, color: Colors.muted, lineHeight: 15, marginBottom: 8 },
campCardFooter: {},
campProgressBar: {
  height: 4, backgroundColor: Colors.dark4,
  borderRadius: 4, overflow: 'hidden', marginBottom: 5,
},
campProgressFill: { height: 4, borderRadius: 4 },
campProgressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
campProgressText: { fontSize: 10, color: Colors.muted },

urgentTag: {
  position: 'absolute', top: 8, right: 8,
  backgroundColor: Colors.red, borderRadius: 5,
  paddingHorizontal: 7, paddingVertical: 2,
},
urgentTagText: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },

// Adiciona ao StyleSheet do dashboard do voluntário
filaWidget: {
  backgroundColor: Colors.dark2, borderRadius: 18, padding: 18,
  borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)',
  overflow: 'hidden', position: 'relative',
},
filaWidgetGlow: {
  position: 'absolute', top: -40, right: -40,
  width: 140, height: 140, borderRadius: 70,
  backgroundColor: 'rgba(74,158,255,0.08)',
},
filaWidgetHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 16 },
filaWidgetTitulo: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 4 },
filaWidgetSub:    { fontSize: 12, color: Colors.muted, lineHeight: 17 },

filaOpcoes: { flexDirection: 'row', gap: 10 },
filaOpcaoBtn: {
  flex: 1, backgroundColor: Colors.dark3, borderRadius: 14,
  padding: 14, borderWidth: 1.5, alignItems: 'center',
},
filaOpcaoTitulo: { fontSize: 13, fontWeight: '700', color: Colors.white, textAlign: 'center', marginBottom: 6 },
filaOpcaoDesc:   { fontSize: 11, color: Colors.muted, textAlign: 'center', lineHeight: 15, marginBottom: 10 },
filaOpcaoBadge:  { backgroundColor: 'rgba(74,158,255,0.15)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
filaOpcaoBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.blue },

rastreioCard: {
  backgroundColor: Colors.dark2, borderRadius: 18, padding: 18,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
},
rastreioHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
rastreioSenhaBox: { alignItems: 'center', backgroundColor: Colors.dark3, borderRadius: 14, padding: 14, minWidth: 90 },
rastreioSenhaLabel: { fontSize: 9, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 4 },
rastreioSenha: { fontSize: 28, fontWeight: '900', color: Colors.white, fontFamily: 'monospace' },
rastreioTipo:  { fontSize: 10, color: Colors.muted, marginTop: 4 },

rastreioEstadoLabel: { fontSize: 9, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 6 },
rastreioEstadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
rastreioEstadoDot:   { width: 8, height: 8, borderRadius: 4 },
rastreioEstadoText:  { fontSize: 15, fontWeight: '700' },

rastreioPosicao: {
  flexDirection: 'row', backgroundColor: Colors.dark3,
  borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center',
},
rastreioPosicaoItem: { flex: 1, alignItems: 'center' },
rastreioPosicaoNum:  { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 3 },
rastreioPosicaoLabel:{ fontSize: 10, color: Colors.muted },
rastreioDivider:     { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.07)' },

chamadoAlerta: {
  flexDirection: 'row', alignItems: 'center', gap: 12,
  backgroundColor: 'rgba(232,180,75,0.1)', borderWidth: 1,
  borderColor: 'rgba(232,180,75,0.3)', borderRadius: 12,
  padding: 14, marginBottom: 16,
},
chamadoAlertaTitulo: { fontSize: 15, fontWeight: '800', color: Colors.gold, marginBottom: 3 },
chamadoAlertaSub:    { fontSize: 12, color: Colors.muted },

rastreioTimeline: { marginVertical: 8 },

cancelarSenhaBtn: { marginTop: 12, alignItems: 'center', padding: 10 },
cancelarSenhaBtnText: { fontSize: 12, color: Colors.muted, textDecorationLine: 'underline' },
})
