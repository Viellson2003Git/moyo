// app/(admin)/index.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, Alert, Linking 
} from 'react-native'

import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import BottomNav from '../../components/BottomNav'
import { mostrarAlerta } from '../../utils/alert'
import { limparTelefoneLembrado } from '../../utils/session'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSafeTop } from '../../hooks/useSafeTop'


type Stats = {
  totalDoadores: number
  totalDoacoes: number
  agendamentosMes: number
  candidatosPendentes: number
  ongsAtivas: number
  campanhasAtivas: number
}

type Candidato = {
  id: string
  numero_serial: string
  estado: string
  created_at: string
  bi_numero: string | null
  tipo_sanguineo: string | null
  profiles: { nome: string; email: string } | null
}

export default function AdminDashboard() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [stats, setStats]           = useState<Stats | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<'dashboard' | 'candidatos' | 'slots'| 'utilizadores' | 'ongs' | 'campanhas' | 'emergencias' | 'relatorios'>('dashboard')
  const safeTop = useSafeTop()
  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [
        { count: totalDoadores },
        { count: totalDoacoes },
        { count: agendamentosMes },
        { count: candidatosPendentes },
        { count: ongsAtivas },
        { count: campanhasAtivas },
        { data: cands },
      ] = await Promise.all([
        supabase.from('voluntarios').select('*', { count: 'exact', head: true }).eq('estado', 'apto'),
        supabase.from('doacoes').select('*', { count: 'exact', head: true }),
        supabase.from('agendamentos').select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('voluntarios').select('*', { count: 'exact', head: true }).eq('estado', 'pendente'),
        supabase.from('ongs').select('*', { count: 'exact', head: true }).eq('estado', 'ativa'),
        supabase.from('campanhas').select('*', { count: 'exact', head: true }).eq('publicado', true),
        supabase.from('voluntarios')
          .select('id, numero_serial, estado, created_at, bi_numero, tipo_sanguineo, profiles(nome, email)')
          .in('estado', ['pendente', 'em_exame'])
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setStats({
        totalDoadores:       totalDoadores || 0,
        totalDoacoes:        totalDoacoes || 0,
        agendamentosMes:     agendamentosMes || 0,
        candidatosPendentes: candidatosPendentes || 0,
        ongsAtivas:          ongsAtivas || 0,
        campanhasAtivas:     campanhasAtivas || 0,
      })
      setCandidatos((cands as any) || [])
    } catch (e) { console.log(e) }
    setLoading(false)
  }

  async function handleLogout() {
  await supabase.auth.signOut()
  await limparTelefoneLembrado()
  router.replace('/(auth)/landing' as any)
}

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={Colors.red} />
    </View>
  )

const navItems = [
  { icon: 'grid',     label: 'Dashboard',    tab: 'dashboard'    },
  { icon: 'users',    label: 'Candidatos',   tab: 'candidatos'   },
  { icon: 'calendar', label: 'Slots',        tab: 'slots'        },
  { icon: 'activity', label: 'Campanhas',    tab: 'campanhas'    },
  { icon: 'heart',    label: 'ONGs',         tab: 'ongs'         },
  { icon: 'settings', label: 'Utilizadores', tab: 'utilizadores' },
  { icon: 'alert-circle', label: 'Urgências', tab: 'emergencias' },
  { icon: 'bar-chart-2', label: 'Relatórios', tab: 'relatorios' }
] as { icon: keyof typeof Feather.glyphMap; label: string; tab: typeof activeTab }[]

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── SIDEBAR WEB ── */}
      {isWeb && (
        <View style={s.sidebar}>
          <View>
            <View style={s.sidebarLogo}>
              <View style={s.sidebarLogoIcon}>
                <Text style={{ color: Colors.white, fontWeight: '800', fontSize: 15 }}>B</Text>
              </View>
              <Text style={s.sidebarLogoText}>
                MO<Text style={{ color: Colors.redSoft }}>YO</Text>
              </Text>
            </View>
            <View style={{ gap: 3 }}>
              {navItems.map(n => (
                <TouchableOpacity
                  key={n.label}
                  style={[s.sidebarItem, activeTab === n.tab && s.sidebarItemActive]}
                  onPress={() => setActiveTab(n.tab)}
                >
                  <Feather name={n.icon} size={15} color={activeTab === n.tab ? Colors.redSoft : Colors.muted} />
                  <Text style={[s.sidebarItemLabel, activeTab === n.tab && { color: Colors.redSoft }]}>
                    {n.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={s.sidebarLogout} onPress={handleLogout}>
            <Feather name="log-out" size={15} color={Colors.muted} />
            <Text style={s.sidebarLogoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.main}>

        {/* Topbar */}
        <View style={[s.topbar, { paddingTop: safeTop + 8 }]}>
          <Text style={s.topbarTitle}>
            {activeTab === 'dashboard'    ? 'Painel Admin'    :
            activeTab === 'candidatos'   ? 'Candidatos'      :
            activeTab === 'utilizadores' ? 'Utilizadores'    :
            activeTab === 'ongs'         ? 'Gestão de ONGs'  :
            activeTab === 'campanhas'    ? 'Campanhas'       :
            'Gestão de Slots'}
            
          </Text>
          <View style={{ flex: 1 }} />
          <View style={[s.topbarBadge, { backgroundColor: Colors.gold }]}>
            <Text style={[s.topbarBadgeText, { color: Colors.dark }]}>ADMIN</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={{ marginLeft: 10 }}>
            <Feather name="log-out" size={18} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
      
          <ScrollView
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          ></ScrollView>
          <View style={s.content}>

            {/* ══ DASHBOARD ══ */}
            {activeTab === 'dashboard' && (
              <>
                {/* YO */}
                <View style={s.YOCard}>
                  <View style={s.YOGlow} />
                  <Text style={s.YOEyebrow}>Hospital Ngola Kimbanda · Namibe</Text>
                  <Text style={s.YOTitle}>Painel de{'\n'}
                    <Text style={s.YOTitleRed}>Administração</Text>
                  </Text>
                  <Text style={s.YOSub}>
                    Gestão completa do sistema Moyo.
                  </Text>
                  <View style={s.YOActions}>
                    <TouchableOpacity style={s.btnPrimary} onPress={() => setActiveTab('slots')}>
                      <Feather name="plus" size={14} color={Colors.white} />
                      <Text style={s.btnPrimaryText}>Criar Slot</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnGhost} onPress={() => setActiveTab('candidatos')}>
                      <Text style={s.btnGhostText}>Ver Candidatos</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Stats 3x2 */}
                <View style={s.statsGrid}>
                  <StatCard icon="users"    val={stats?.totalDoadores.toString()!}       label="Doadores Aptos"         color={Colors.green}   />
                  <StatCard icon="droplet"  val={stats?.totalDoacoes.toString()!}        label="Doações Realizadas"     color={Colors.redSoft} />
                  <StatCard icon="calendar" val={stats?.agendamentosMes.toString()!}     label="Agendamentos este mês"  color={Colors.blue}    />
                  <StatCard icon="clock"    val={stats?.candidatosPendentes.toString()!} label="Candidatos Pendentes"   color={Colors.gold}    />
                  <StatCard icon="heart"    val={stats?.ongsAtivas.toString()!}          label="ONGs Activas"           color={Colors.blue}    />
                  <StatCard icon="activity" val={stats?.campanhasAtivas.toString()!}     label="Campanhas Activas"      color={Colors.green}   />
                </View>

                {/* Acções rápidas */}
                <Text style={s.sectionTitle}>⚡ Acções Rápidas</Text>
                <View style={s.accoesGrid}>
                  <AccaoCard icon="calendar" label="Criar Slots"      color={Colors.blue}    onPress={() => setActiveTab('slots')}      />
                  <AccaoCard icon="users"    label="Candidatos"       color={Colors.gold}    onPress={() => setActiveTab('candidatos')} />
                  <AccaoCard icon="activity" label="Campanhas" color={Colors.green} onPress={() => setActiveTab('campanhas')} />                  
                  <AccaoCard icon="heart"    label="ONGs"             color={Colors.blue}    onPress={() => {}} />
                  <AccaoCard icon="bar-chart-2" label="Relatórios"   color={Colors.muted}   onPress={() => {}} />
                  <AccaoCard icon="settings" label="Configurações"    color={Colors.muted}   onPress={() => {}} />
                </View>
              </>
            )}

            {/* ══ CANDIDATOS ══ */}
            {activeTab === 'candidatos' && (
              <>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>Candidatos Pendentes</Text>
                  <TouchableOpacity onPress={loadData}>
                    <Feather name="refresh-cw" size={16} color={Colors.muted} />
                  </TouchableOpacity>
                </View>

                {candidatos.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Feather name="check-circle" size={40} color={Colors.green} style={{ marginBottom: 12 }} />
                    <Text style={s.emptyTitle}>Sem candidatos pendentes</Text>
                    <Text style={s.emptyText}>Todos os candidatos foram processados.</Text>
                  </View>
                ) : (
                  <View style={s.tableWrap}>
                    {/* Header da tabela */}
                    <View style={s.tableHeader}>
                      <Text style={[s.tableHeaderText, { flex: 2 }]}>NOME</Text>
                      <Text style={[s.tableHeaderText, { flex: 1 }]}>SERIAL</Text>
                      <Text style={[s.tableHeaderText, { flex: 1 }]}>TIPO SANG.</Text>
                      <Text style={[s.tableHeaderText, { flex: 1 }]}>ESTADO</Text>
                      <Text style={[s.tableHeaderText, { flex: 1 }]}>ACÇÃO</Text>
                    </View>

                    {candidatos.map(c => (
                      <View key={c.id} style={s.tableRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={s.tableRowName}>
                            {(c.profiles as any)?.nome || '—'}
                          </Text>
                          <Text style={s.tableRowEmail}>
                            {(c.profiles as any)?.email || '—'}
                          </Text>
                        </View>
                        <Text style={[s.tableRowText, { flex: 1, color: Colors.redSoft, fontFamily: 'monospace', fontSize: 11 }]}>
                          {c.numero_serial || '—'}
                        </Text>
                        <Text style={[s.tableRowText, { flex: 1 }]}>
                          {c.tipo_sanguineo || 'A confirmar'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <EstadoBadge estado={c.estado} />
                        </View>
                        <View style={[{ flex: 1 }, s.tableActions]}>
                          <TouchableOpacity
                            style={s.actionBtn}
                            onPress={() => router.push(`/(admin)/candidato/${c.id}` as any)}
                          >
                            <Text style={s.actionBtnText}>Ver</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* ══ SLOTS ══ */}
            {activeTab === 'slots' && (
              <SlotManager />
            )}

            {/* ══ UTILIZADORES ══ */}
            {activeTab === 'utilizadores' && (
              <UtilizadoresManager />
            )}

            {/* ══ ONGs ══ */}
            {activeTab === 'ongs' && <OngsManager />}

            {/* ══ CAMPANHAS ══ */}
            {activeTab === 'campanhas' && <CampanhasManager />}

            {/* ══ EMERGENCIAS ══ */}
            {activeTab === 'emergencias' && <EmergenciasManager />}

            {/* ══ RELATÓRIOS ══ */}
            {activeTab === 'relatorios' && <RelatoriosManager />}

            <View style={{ height: isWeb ? 40 : 100 }} />
          </View>
        </ScrollView>

        {/* Bottom nav mobile */}
        {!isWeb && (
        <BottomNav items={[
          { icon: 'grid',     label: 'Dashboard',    onPress: () => setActiveTab('dashboard'),    active: activeTab === 'dashboard'    },
          { icon: 'users',    label: 'Candidatos',   onPress: () => setActiveTab('candidatos'),   active: activeTab === 'candidatos',  badge: stats?.candidatosPendentes },
          { icon: 'calendar', label: 'Slots',        onPress: () => setActiveTab('slots'),        active: activeTab === 'slots'        },
          { icon: 'settings', label: 'Utilizadores', onPress: () => setActiveTab('utilizadores'), active: activeTab === 'utilizadores' },
          { icon: 'heart',    label: 'ONGs',         onPress: () => setActiveTab('ongs'),         active: activeTab === 'ongs'         },
          
        ]} />
      )}
      </View>
    </SafeAreaView>
  )
}

function EmergenciasManager() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPedidos() }, [])

  async function loadPedidos() {
    const { data } = await supabase
      .from('pedidos_emergencia')
      .select('*, respostas_emergencia(id, estado, voluntarios(profiles(nome, telefone)))')
      .order('created_at', { ascending: false })
    setPedidos(data || [])
    setLoading(false)
  }

  async function mudarEstado(id: string, estado: string) {
    await supabase.from('pedidos_emergencia').update({ estado }).eq('id', id)
    loadPedidos()
  }

  const estadoCfg: Record<string, { label: string; color: string }> = {
    ativo:     { label: 'Activo',    color: Colors.red   },
    resolvido: { label: 'Resolvido', color: Colors.green },
    cancelado: { label: 'Cancelado', color: Colors.muted },
  }

  if (loading) return <ActivityIndicator color={Colors.red} style={{ marginTop: 40 }} />

  return (
    <View style={{ gap: 12 }}>
      {pedidos.length === 0 ? (
        <View style={s.emptyBox}>
          <Feather name="heart" size={36} color={Colors.muted2} style={{ marginBottom: 12 }} />
          <Text style={s.emptyTitle}>Sem pedidos de emergência</Text>
        </View>
      ) : (
        pedidos.map(p => {
          const cfg = estadoCfg[p.estado] || estadoCfg['ativo']
          const respostas = (p.respostas_emergencia || []) as any[]
          return (
            <View key={p.id} style={[s.tableWrap, { padding: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: Colors.redSoft }}>{p.tipo_sanguineo}</Text>
                    <View style={[s.badge, { backgroundColor: cfg.color + '20' }]}>
                      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={s.tableRowName}>{p.nome_solicitante}</Text>
                  <Text style={s.tableRowEmail}>{p.telefone_solicitante}</Text>
                  {p.morada_aproximada && (
                    <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 3 }}>
                      📍 {p.morada_aproximada}
                    </Text>
                  )}
                  {p.descricao && (
                    <Text style={{ fontSize: 12, color: Colors.muted, marginTop: 3 }} numberOfLines={2}>
                      {p.descricao}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: Colors.muted }}>
                  {new Date(p.created_at).toLocaleDateString('pt-PT')}
                </Text>
              </View>

              {/* Doadores que aceitaram */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 11, color: Colors.muted, marginBottom: 6 }}>
                  DOADORES ({p.total_aceitaram}/{p.max_doadores})
                </Text>
                {respostas.length === 0 ? (
                  <Text style={{ fontSize: 12, color: Colors.muted2 }}>Nenhum doador aceitou ainda</Text>
                ) : (
                  respostas.map((r: any) => (
                    <Text key={r.id} style={{ fontSize: 12, color: Colors.white }}>
                      • {r.voluntarios?.profiles?.nome} — {r.voluntarios?.profiles?.telefone}
                    </Text>
                  ))
                )}
              </View>

              {/* Acções */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {p.estado !== 'resolvido' && (
                  <TouchableOpacity
                    style={[uStyles.tipoBtn, { borderColor: Colors.green + '60' }]}
                    onPress={() => mudarEstado(p.id, 'resolvido')}
                  >
                    <Text style={[uStyles.tipoBtnText, { color: Colors.green }]}>✓ Resolvido</Text>
                  </TouchableOpacity>
                )}
                {p.estado !== 'cancelado' && (
                  <TouchableOpacity
                    style={[uStyles.tipoBtn, { borderColor: Colors.muted + '40' }]}
                    onPress={() => mudarEstado(p.id, 'cancelado')}
                  >
                    <Text style={[uStyles.tipoBtnText, { color: Colors.muted }]}>Cancelar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

// ══ SLOT MANAGER ══════════════════════
function SlotManager() {
  const [bancos, setBancos]       = useState<any[]>([])
  const [slots, setSlots]         = useState<any[]>([])
  const [bancoSel, setBancoSel]   = useState<string>('')
  const [loading, setLoading]     = useState(true)
  const [criando, setCriando]     = useState(false)

  // Form
  const [data, setData]           = useState('')
  const [hora, setHora]           = useState('')
  const [vagas, setVagas]         = useState('10')
  const [tipoDoacao, setTipoDoacao] = useState('Sangue Total')

  const tipos = ['Sangue Total', 'Plaquetas', 'Plasma', 'Glóbulos Vermelhos']

  useEffect(() => { loadBancos() }, [])
  useEffect(() => { if (bancoSel) loadSlots() }, [bancoSel])

  async function loadBancos() {
    const { data: b } = await supabase
      .from('bancos_sangue').select('id, nome').eq('ativo', true)
    const lista = b || []
    setBancos(lista)
    if (lista.length > 0) setBancoSel(lista[0].id)
    setLoading(false)
  }

  async function loadSlots() {
    const { data: sl } = await supabase
      .from('slots')
      .select('id, data, hora, vagas_totais, vagas_ocupadas, tipo_doacao, ativo')
      .eq('banco_id', bancoSel)
      .gte('data', new Date().toISOString().split('T')[0])
      .order('data').order('hora')
    setSlots(sl || [])
  }

  async function handleCriarSlot() {
    if (!data || !hora || !vagas || !bancoSel) {
      alert('Preenche todos os campos.')
      return
    }
    setCriando(true)
    const { error } = await supabase.from('slots').insert({
      banco_id:     bancoSel,
      data,
      hora:         hora + ':00',
      vagas_totais: parseInt(vagas),
      vagas_ocupadas: 0,
      tipo_doacao:  tipoDoacao,
      ativo:        true,
    })

    if (!error) {
      setData(''); setHora(''); setVagas('10')
      loadSlots()
      alert('✅ Slot criado com sucesso!')
    } else {
      alert('Erro: ' + error.message)
    }
    setCriando(false)
  }

  async function toggleSlot(id: string, ativo: boolean) {
    await supabase.from('slots').update({ ativo: !ativo }).eq('id', id)
    loadSlots()
  }

  async function deletarSlot(id: string) {
    await supabase.from('slots').delete().eq('id', id)
    loadSlots()
  }

  if (loading) return <ActivityIndicator color={Colors.red} style={{ marginTop: 40 }} />

  return (
    <View style={{ gap: 16 }}>

      {/* Selector de hospital */}
      <View style={s2.section}>
        <Text style={s2.sectionTitle}>🏥 Hospital</Text>
        <View style={s2.bancosRow}>
          {bancos.map(b => (
            <TouchableOpacity
              key={b.id}
              style={[s2.bancoBtn, bancoSel === b.id && s2.bancoBtnActive]}
              onPress={() => setBancoSel(b.id)}
            >
              <Text style={[s2.bancoBtnText, bancoSel === b.id && { color: Colors.white }]}>
                {b.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Formulário criar slot */}
      <View style={s2.section}>
        <Text style={s2.sectionTitle}>➕ Criar Novo Slot</Text>
        <View style={s2.formGrid}>
          <View style={s2.formField}>
            <Text style={s2.formLabel}>DATA</Text>
            <TextInputSimple
              value={data}
              onChangeText={setData}
              placeholder="AAAA-MM-DD"
            />
          </View>
          <View style={s2.formField}>
            <Text style={s2.formLabel}>HORA</Text>
            <TextInputSimple
              value={hora}
              onChangeText={setHora}
              placeholder="HH:MM"
            />
          </View>
          <View style={s2.formField}>
            <Text style={s2.formLabel}>VAGAS</Text>
            <TextInputSimple
              value={vagas}
              onChangeText={setVagas}
              placeholder="10"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Tipo de doação */}
        <Text style={[s2.formLabel, { marginBottom: 8 }]}>TIPO DE DOAÇÃO</Text>
        <View style={s2.tiposRow}>
          {tipos.map(t => (
            <TouchableOpacity
              key={t}
              style={[s2.tipoBtn, tipoDoacao === t && s2.tipoBtnActive]}
              onPress={() => setTipoDoacao(t)}
            >
              <Text style={[s2.tipoBtnText, tipoDoacao === t && { color: Colors.white }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={s2.criarBtn}
          onPress={handleCriarSlot}
          disabled={criando}
        >
          {criando
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <>
                <Feather name="plus" size={16} color={Colors.white} />
                <Text style={s2.criarBtnText}>Criar Slot</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Lista de slots */}
      <View style={s2.section}>
        <Text style={s2.sectionTitle}>📋 Slots Criados</Text>
        {slots.length === 0 ? (
          <Text style={{ color: Colors.muted, fontSize: 13, textAlign: 'center', padding: 20 }}>
            Nenhum slot criado ainda.
          </Text>
        ) : (
          slots.map(slot => {
            const disp = slot.vagas_totais - slot.vagas_ocupadas
            return (
              <View key={slot.id} style={s2.slotRow}>
                <View style={s2.slotInfo}>
                  <Text style={s2.slotData}>
                    {new Date(slot.data + 'T00:00:00').toLocaleDateString('pt-PT', { day:'2-digit', month:'short', year:'numeric' })}
                  </Text>
                  <Text style={s2.slotHora}>{slot.hora?.slice(0,5)}</Text>
                  <Text style={s2.slotTipo}>{slot.tipo_doacao}</Text>
                </View>
                <View style={s2.slotVagas}>
                  <Text style={[s2.slotVagasNum, { color: disp > 0 ? Colors.green : Colors.redSoft }]}>
                    {disp}/{slot.vagas_totais}
                  </Text>
                  <Text style={s2.slotVagasLabel}>vagas livres</Text>
                </View>
                <View style={s2.slotBtns}>
                  <TouchableOpacity
                    style={[s2.slotToggle, { backgroundColor: slot.ativo ? 'rgba(46,204,113,0.15)' : 'rgba(136,136,160,0.15)' }]}
                    onPress={() => toggleSlot(slot.id, slot.ativo)}
                  >
                    <Text style={[s2.slotToggleText, { color: slot.ativo ? Colors.green : Colors.muted }]}>
                      {slot.ativo ? '✓ Activo' : '✗ Inactivo'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s2.slotDelete}
                    onPress={() => deletarSlot(slot.id)}
                  >
                    <Feather name="trash-2" size={14} color={Colors.redSoft} />
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}
      </View>
    </View>
  )
}

function CampanhasManager() {
  const [campanhas, setCampanhas] = useState<any[]>([])
  const [bancos, setBancos]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [salvando, setSalvando]   = useState(false)

  const [titulo, setTitulo]       = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo]           = useState<'urgente' | 'campanha' | 'noticia'>('campanha')
  const [tipoSang, setTipoSang]   = useState('')
  const [meta, setMeta]           = useState('')
  const [dataFim, setDataFim]     = useState('')
  const [bancoId, setBancoId]     = useState('')

  const tiposSang = ['', 'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: camps }, { data: bancosData }] = await Promise.all([
      supabase.from('campanhas')
        .select('id, titulo, descricao, tipo, data_fim, meta_doadores, total_atingido, tipo_sanguineo, publicado, bancos_sangue(nome)')
        .order('created_at', { ascending: false }),
      supabase.from('bancos_sangue').select('id, nome').eq('ativo', true),
    ])
    setCampanhas(camps || [])
    setBancos(bancosData || [])
    if (bancosData && bancosData.length > 0) setBancoId(bancosData[0].id)
    setLoading(false)
  }

  async function criarCampanha() {
    if (!titulo) { Alert.alert('Atenção', 'O título é obrigatório.'); return }
    setSalvando(true)
    const { error } = await supabase.from('campanhas').insert({
      titulo,
      descricao: descricao || null,
      tipo,
      tipo_sanguineo: tipoSang || null,
      meta_doadores: meta ? parseInt(meta) : null,
      total_atingido: 0,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: dataFim || null,
      banco_id: bancoId || null,
      publicado: true,
    })
    if (!error) {
      Alert.alert('✅ Campanha criada!')
      setTitulo(''); setDescricao(''); setTipoSang(''); setMeta(''); setDataFim('')
      setShowForm(false)
      loadData()
    } else {
      Alert.alert('Erro', error.message)
    }
    setSalvando(false)
  }

  async function togglePublicado(id: string, publicado: boolean) {
    await supabase.from('campanhas').update({ publicado: !publicado }).eq('id', id)
    loadData()
  }

  async function apagarCampanha(id: string) {
    Alert.alert('Apagar campanha', 'Tens a certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => {
        await supabase.from('campanhas').delete().eq('id', id)
        loadData()
      }}
    ])
  }

  const tiposConfig = {
    urgente:  { label: 'Urgente',  emoji: '🩸', cor: Colors.redSoft },
    campanha: { label: 'Campanha', emoji: '❤️', cor: Colors.green   },
    noticia:  { label: 'Notícia',  emoji: '📰', cor: Colors.blue    },
  }

  if (loading) return <ActivityIndicator color={Colors.red} style={{ marginTop: 40 }} />

  return (
    <View style={{ gap: 14 }}>

      <TouchableOpacity style={uStyles.addBtn} onPress={() => setShowForm(!showForm)}>
        <Feather name={showForm ? 'x' : 'plus'} size={16} color={Colors.white} />
        <Text style={uStyles.addBtnText}>{showForm ? 'Cancelar' : 'Criar Campanha'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={uStyles.formCard}>
          <Text style={uStyles.formTitle}>📢 Nova Campanha / Notícia</Text>

          {/* Tipo */}
          <Text style={uStyles.formLabel}>TIPO</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
            {(['urgente','campanha','noticia'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[uStyles.tipoSel, tipo === t && { backgroundColor: tiposConfig[t].cor + '20', borderColor: tiposConfig[t].cor }]}
                onPress={() => setTipo(t)}
              >
                <Text style={{ fontSize: 16 }}>{tiposConfig[t].emoji}</Text>
                <Text style={[uStyles.tipoSelText, tipo === t && { color: tiposConfig[t].cor }]}>{tiposConfig[t].label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={uStyles.formLabel}>TÍTULO *</Text>
          <TextInput style={uStyles.input} value={titulo} onChangeText={setTitulo}
            placeholder="Ex: Necessidade urgente de O-" placeholderTextColor={Colors.muted2} />

          <Text style={uStyles.formLabel}>DESCRIÇÃO</Text>
          <TextInput style={[uStyles.input, { height: 80, textAlignVertical: 'top' }]}
            value={descricao} onChangeText={setDescricao}
            placeholder="Detalhes da campanha..." placeholderTextColor={Colors.muted2} multiline />

          {/* Tipo sanguíneo (só para urgente) */}
          {tipo === 'urgente' && (
            <>
              <Text style={uStyles.formLabel}>TIPO SANGUÍNEO NECESSÁRIO</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {tiposSang.filter(t => t).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[uStyles.tipoBtn, tipoSang === t && { backgroundColor: Colors.redGlow, borderColor: Colors.red }]}
                    onPress={() => setTipoSang(tipoSang === t ? '' : t)}
                  >
                    <Text style={[uStyles.tipoBtnText, { color: tipoSang === t ? Colors.redSoft : Colors.muted }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Meta e data fim (não para notícia) */}
          {tipo !== 'noticia' && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={uStyles.formLabel}>META DE DOADORES</Text>
                <TextInput style={uStyles.input} value={meta} onChangeText={setMeta}
                  placeholder="Ex: 50" placeholderTextColor={Colors.muted2} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={uStyles.formLabel}>DATA FIM</Text>
                <TextInput style={uStyles.input} value={dataFim} onChangeText={setDataFim}
                  placeholder="AAAA-MM-DD" placeholderTextColor={Colors.muted2} />
              </View>
            </View>
          )}

          {/* Hospital */}
          {bancos.length > 0 && (
            <>
              <Text style={uStyles.formLabel}>HOSPITAL</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                {bancos.map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[uStyles.tipoBtn, bancoId === b.id && { backgroundColor: Colors.redGlow, borderColor: Colors.red }]}
                    onPress={() => setBancoId(b.id)}
                  >
                    <Text style={[uStyles.tipoBtnText, { color: bancoId === b.id ? Colors.redSoft : Colors.muted }]}>{b.nome}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[uStyles.criarBtn, salvando && { opacity: 0.7 }]}
            onPress={criarCampanha} disabled={salvando}
          >
            {salvando
              ? <ActivityIndicator size="small" color={Colors.dark} />
              : <Text style={uStyles.criarBtnText}>Publicar Campanha</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de campanhas */}
      {campanhas.length === 0 ? (
        <View style={s.emptyBox}>
          <Feather name="activity" size={36} color={Colors.muted2} style={{ marginBottom: 12 }} />
          <Text style={s.emptyTitle}>Sem campanhas</Text>
          <Text style={s.emptyText}>Cria a primeira campanha ou aviso urgente.</Text>
        </View>
      ) : (
        campanhas.map(c => {
          const cfg = tiposConfig[c.tipo as keyof typeof tiposConfig] || tiposConfig.campanha
          const progresso = c.meta_doadores ? Math.round((c.total_atingido / c.meta_doadores) * 100) : 0
          return (
            <View key={c.id} style={[s.tableWrap, { padding: 14, marginBottom: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <Text style={s.tableRowName}>{c.titulo}</Text>
                    {!c.publicado && (
                      <View style={{ backgroundColor: Colors.dark4, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 9, color: Colors.muted, fontWeight: '700' }}>RASCUNHO</Text>
                      </View>
                    )}
                  </View>
                  {c.descricao && (
                    <Text style={{ fontSize: 12, color: Colors.muted, lineHeight: 17 }} numberOfLines={2}>{c.descricao}</Text>
                  )}
                  {c.meta_doadores && (
                    <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 4 }}>
                      {c.total_atingido}/{c.meta_doadores} doadores ({progresso}%)
                    </Text>
                  )}
                </View>
                <View style={[s.badge, { backgroundColor: cfg.cor + '20' }]}>
                  <Text style={[s.badgeText, { color: cfg.cor }]}>{cfg.label}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[uStyles.tipoBtn, { borderColor: c.publicado ? Colors.gold + '60' : Colors.green + '60' }]}
                  onPress={() => togglePublicado(c.id, c.publicado)}
                >
                  <Text style={[uStyles.tipoBtnText, { color: c.publicado ? Colors.gold : Colors.green }]}>
                    {c.publicado ? 'Ocultar' : 'Publicar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[uStyles.tipoBtn, { borderColor: Colors.redSoft + '60' }]}
                  onPress={() => apagarCampanha(c.id)}
                >
                  <Feather name="trash-2" size={12} color={Colors.redSoft} />
                </TouchableOpacity>
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

function RelatoriosManager() {
  const [stats, setStats]         = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [provincia, setProvincia] = useState<string>('todas')
  const [provincias, setProvincias] = useState<any[]>([])

  useEffect(() => {
    loadProvincias()
    loadStats()
  }, [])

  useEffect(() => { loadStats() }, [provincia])

  async function loadProvincias() {
    const { data } = await supabase.from('provincias').select('id, nome').eq('ativo', true).order('nome')
    setProvincias(data || [])
  }

  async function loadStats() {
    setLoading(true)
    const provFilter = provincia !== 'todas' ? provincia : null

    const [
      { count: totalVoluntarios },
      { count: totalAptos },
      { count: totalDoacoes },
      { count: totalAgendamentos },
      { count: totalEmergencias },
      { count: totalResolvidasEmerg },
      { count: totalOngs },
      { data: doacoesPorMes },
    ] = await Promise.all([
      supabase.from('voluntarios').select('*', { count: 'exact', head: true }),
      supabase.from('voluntarios').select('*', { count: 'exact', head: true }).eq('estado', 'apto'),
      supabase.from('doacoes').select('*', { count: 'exact', head: true }),
      supabase.from('agendamentos').select('*', { count: 'exact', head: true }),
      supabase.from('pedidos_emergencia').select('*', { count: 'exact', head: true }),
      supabase.from('pedidos_emergencia').select('*', { count: 'exact', head: true }).eq('estado', 'resolvido'),
      supabase.from('ongs').select('*', { count: 'exact', head: true }).eq('estado', 'ativa'),
      supabase.from('doacoes').select('data_doacao').order('data_doacao', { ascending: false }).limit(100),
    ])

    // Agrupa doações por mês
    const porMes: Record<string, number> = {}
    ;(doacoesPorMes || []).forEach((d: any) => {
      const mes = d.data_doacao?.slice(0, 7)
      if (mes) porMes[mes] = (porMes[mes] || 0) + 1
    })

    setStats({
      totalVoluntarios: totalVoluntarios || 0,
      totalAptos:       totalAptos || 0,
      totalDoacoes:     totalDoacoes || 0,
      totalAgendamentos:totalAgendamentos || 0,
      totalEmergencias: totalEmergencias || 0,
      totalResolvidasEmerg: totalResolvidasEmerg || 0,
      totalOngs:        totalOngs || 0,
      taxaResolucao:    totalEmergencias ? Math.round(((totalResolvidasEmerg || 0) / totalEmergencias) * 100) : 0,
      doacoesPorMes:    Object.entries(porMes).slice(-6).reverse(),
    })
    setLoading(false)
  }

  async function exportarCSV() {
    const { data: voluntarios } = await supabase
      .from('voluntarios')
      .select('numero_serial, tipo_sanguineo, estado, created_at, profiles(nome, email)')
      .order('created_at', { ascending: false })

    if (!voluntarios) return

    const header = 'Serial,Nome,Email,Tipo Sanguíneo,Estado,Data Registo\n'
    const rows = voluntarios.map((v: any) =>
      `${v.numero_serial},${v.profiles?.nome || ''},${v.profiles?.email || ''},${v.tipo_sanguineo || ''},${v.estado},${v.created_at?.slice(0, 10)}`
    ).join('\n')

    if (Platform.OS === 'web') {
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `moyo-doadores-${new Date().toISOString().slice(0,10)}.csv`
      a.click()
    } else {
      mostrarAlerta('CSV gerado', 'A exportação para ficheiro está disponível apenas no web.')
    }
  }

  if (loading) return <ActivityIndicator color={Colors.red} style={{ marginTop: 40 }} />

  return (
    <View style={{ gap: 14 }}>

      {/* Filtro de província */}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <TouchableOpacity
          style={[rStyles.provBtn, provincia === 'todas' && rStyles.provBtnActive]}
          onPress={() => setProvincia('todas')}
        >
          <Text style={[rStyles.provBtnText, provincia === 'todas' && { color: Colors.white }]}>
            Todas as províncias
          </Text>
        </TouchableOpacity>
        {provincias.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[rStyles.provBtn, provincia === p.id && rStyles.provBtnActive]}
            onPress={() => setProvincia(p.id)}
          >
            <Text style={[rStyles.provBtnText, provincia === p.id && { color: Colors.white }]}>
              {p.nome}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats principais */}
      <View style={s.statsGrid}>
        <StatCard icon="users"       val={stats.totalVoluntarios.toString()} label="Total Registados"   color={Colors.blue}    />
        <StatCard icon="check-circle" val={stats.totalAptos.toString()}      label="Doadores Aptos"     color={Colors.green}   />
        <StatCard icon="droplet"     val={stats.totalDoacoes.toString()}     label="Doações Realizadas" color={Colors.redSoft} />
        <StatCard icon="calendar"    val={stats.totalAgendamentos.toString()} label="Agendamentos"      color={Colors.gold}    />
        <StatCard icon="alert-circle" val={stats.totalEmergencias.toString()} label="Emergências"       color={Colors.redSoft} />
        <StatCard icon="heart"       val={`${stats.taxaResolucao}%`}         label="Taxa de Resolução"  color={Colors.green}   />
      </View>

      {/* Doações por mês */}
      <View style={{ backgroundColor: Colors.dark2, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 16 }}>
          📈 Doações por Mês
        </Text>
        {stats.doacoesPorMes.length === 0 ? (
          <Text style={{ color: Colors.muted, fontSize: 13 }}>Sem dados suficientes</Text>
        ) : (
          stats.doacoesPorMes.map(([mes, total]: [string, number]) => {
            const maxVal = Math.max(...stats.doacoesPorMes.map(([,v]: any) => v), 1)
            const pct = (total / maxVal) * 100
            return (
              <View key={mes} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Text style={{ fontSize: 12, color: Colors.muted, width: 60 }}>{mes}</Text>
                <View style={{ flex: 1, height: 8, backgroundColor: Colors.dark3, borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%` as any, height: 8, backgroundColor: Colors.red, borderRadius: 4 }} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.white, width: 24, textAlign: 'right' }}>
                  {total}
                </Text>
              </View>
            )
          })
        )}
      </View>

      {/* Resumo ONGs */}
      <View style={{ backgroundColor: Colors.dark2, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 12 }}>
          🤝 ONGs Activas
        </Text>
        <Text style={{ fontSize: 32, fontWeight: '800', color: Colors.blue }}>{stats.totalOngs}</Text>
        <Text style={{ fontSize: 12, color: Colors.muted, marginTop: 4 }}>organizações parceiras verificadas</Text>
      </View>

      {/* Exportar */}
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.dark2, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
        onPress={exportarCSV}
      >
        <Feather name="download" size={16} color={Colors.white} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.white }}>Exportar Lista de Doadores (.CSV)</Text>
      </TouchableOpacity>

    </View>
  )
}

const rStyles = StyleSheet.create({
  provBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: Colors.dark2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  provBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  provBtnText:   { fontSize: 12, fontWeight: '600', color: Colors.muted },
})

// ── Componentes auxiliares ───────────────
import { TextInput } from 'react-native'

function TextInputSimple({ value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <TextInput
      style={[s2.input, { color: Colors.white }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.muted2}
      keyboardType={keyboardType || 'default'}
    />
  )
}
function StatCard({ icon, val, label, color }: { icon: keyof typeof Feather.glyphMap; val: string; label: string; color: string }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statTopBar, { backgroundColor: color }]} />
      <View style={s.statIcon}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[s.statVal, { color }]}>{val}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function AccaoCard({ icon, label, color, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.accaoCard} onPress={onPress}>
      <View style={[s.accaoIcon, { backgroundColor: color + '20' }]}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <Text style={s.accaoLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pendente:  { label: 'Pendente',  color: Colors.gold,   bg: 'rgba(232,180,75,0.15)'  },
    em_exame:  { label: 'Em Exame', color: Colors.blue,   bg: 'rgba(74,158,255,0.15)'  },
    apto:      { label: 'Apto',     color: Colors.green,  bg: 'rgba(46,204,113,0.15)'  },
  }
  const cfg = map[estado] || map['pendente']
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}

function UtilizadoresManager() {
  const [utilizadores, setUtilizadores] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [alterando, setAlterando]       = useState<string | null>(null)
  const [criando, setCriando]           = useState(false)

  // Form novo utilizador
  const [novoNome, setNovoNome]         = useState('')
  const [novoEmail, setNovoEmail]       = useState('')
  const [novoPassword, setNovoPassword] = useState('')
  const [novoTipo, setNovoTipo]         = useState<'voluntario' | 'enfermeiro' | 'admin'>('enfermeiro')
  const [showForm, setShowForm]         = useState(false)

  useEffect(() => { loadUtilizadores() }, [])

  async function loadUtilizadores() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, email, tipo, created_at')
      .order('created_at', { ascending: false })
    setUtilizadores(data || [])
    setLoading(false)
  }

  async function criarUtilizador() {
    if (!novoNome || !novoEmail || !novoPassword) {
      Alert.alert('Atenção', 'Preenche todos os campos.')
      return
    }
    setCriando(true)
    try {
      // 1. Cria no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: novoEmail.trim(),
        password: novoPassword,
      })
      if (authError) throw authError

      const userId = authData.user?.id
      if (!userId) throw new Error('Erro ao criar utilizador')

      // 2. Cria perfil
      const { error: profError } = await supabase.from('profiles').insert({
        id:    userId,
        nome:  novoNome.trim(),
        email: novoEmail.trim(),
        tipo:  novoTipo,
      })
      if (profError) throw profError

      // 3. Se enfermeiro, cria registo
      if (novoTipo === 'enfermeiro') {
        await supabase.from('enfermeiros').insert({ profile_id: userId })
      }

      // 4. Se voluntário, cria registo
      if (novoTipo === 'voluntario') {
        await supabase.from('voluntarios').insert({
          profile_id: userId,
          estado: 'pendente',
        })
      }

      Alert.alert('✅ Utilizador criado!', `${novoNome} foi adicionado como ${novoTipo}.`)
      setNovoNome(''); setNovoEmail(''); setNovoPassword('')
      setShowForm(false)
      loadUtilizadores()
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
    setCriando(false)
  }

  async function mudarTipo(id: string, novoTipoVal: string) {
    setAlterando(id)
    const { error } = await supabase
      .from('profiles').update({ tipo: novoTipoVal }).eq('id', id)

    if (!error) {
      if (novoTipoVal === 'enfermeiro') {
        const { data: existeEnf } = await supabase
          .from('enfermeiros').select('id').eq('profile_id', id).maybeSingle()
        if (!existeEnf) {
          await supabase.from('enfermeiros').insert({ profile_id: id })
        }
      }
      setUtilizadores(prev =>
        prev.map(u => u.id === id ? { ...u, tipo: novoTipoVal } : u)
      )
      Alert.alert('✅ Tipo actualizado!', `Utilizador definido como ${novoTipoVal}.`)
    } else {
      Alert.alert('Erro', error.message)
    }
    setAlterando(null)
  }

  const tipoConfig: Record<string, { label: string; cor: string; bg: string; emoji: string }> = {
    voluntario: { label: 'Voluntário', cor: Colors.muted,  bg: Colors.dark4,               emoji: '🩸' },
    enfermeiro: { label: 'Enfermeiro', cor: Colors.blue,   bg: 'rgba(74,158,255,0.15)',     emoji: '👨‍⚕️' },
    admin:      { label: 'Admin',      cor: Colors.gold,   bg: 'rgba(232,180,75,0.15)',     emoji: '⚙️' },
  }

  if (loading) return <ActivityIndicator color={Colors.red} style={{ marginTop: 40 }} />

  return (
    <View style={{ gap: 14 }}>

      {/* Botão adicionar */}
      <TouchableOpacity
        style={uStyles.addBtn}
        onPress={() => setShowForm(!showForm)}
      >
        <Feather name={showForm ? 'x' : 'user-plus'} size={16} color={Colors.white} />
        <Text style={uStyles.addBtnText}>
          {showForm ? 'Cancelar' : 'Adicionar Utilizador'}
        </Text>
      </TouchableOpacity>

      {/* Formulário criar */}
      {showForm && (
        <View style={uStyles.formCard}>
          <Text style={uStyles.formTitle}>➕ Novo Utilizador</Text>

          <Text style={uStyles.formLabel}>NOME COMPLETO</Text>
          <TextInput
            style={uStyles.input}
            value={novoNome}
            onChangeText={setNovoNome}
            placeholder="Nome do utilizador"
            placeholderTextColor={Colors.muted2}
          />

          <Text style={uStyles.formLabel}>EMAIL</Text>
          <TextInput
            style={uStyles.input}
            value={novoEmail}
            onChangeText={setNovoEmail}
            placeholder="email@exemplo.com"
            placeholderTextColor={Colors.muted2}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={uStyles.formLabel}>PALAVRA-PASSE</Text>
          <TextInput
            style={uStyles.input}
            value={novoPassword}
            onChangeText={setNovoPassword}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={Colors.muted2}
            secureTextEntry
          />

          <Text style={uStyles.formLabel}>TIPO</Text>
          <View style={uStyles.tiposRow}>
            {(['voluntario','enfermeiro','admin'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[
                  uStyles.tipoSel,
                  novoTipo === t && { backgroundColor: tipoConfig[t].bg, borderColor: tipoConfig[t].cor }
                ]}
                onPress={() => setNovoTipo(t)}
              >
                <Text style={{ fontSize: 16 }}>{tipoConfig[t].emoji}</Text>
                <Text style={[uStyles.tipoSelText, novoTipo === t && { color: tipoConfig[t].cor }]}>
                  {tipoConfig[t].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[uStyles.criarBtn, criando && { opacity: 0.7 }]}
            onPress={criarUtilizador}
            disabled={criando}
          >
            {criando
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={uStyles.criarBtnText}>Criar Utilizador</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Aviso */}
      <View style={{ backgroundColor: Colors.dark3, borderRadius: 12, padding: 12 }}>
        <Text style={{ fontSize: 12, color: Colors.muted, lineHeight: 18 }}>
          ⚠️ Após alterar o tipo, o utilizador precisa de fazer logout e login novamente.
        </Text>
      </View>

      {/* Tabela */}
      <View style={s.tableWrap}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderText, { flex: 2 }]}>UTILIZADOR</Text>
          <Text style={[s.tableHeaderText, { flex: 1 }]}>TIPO</Text>
          <Text style={[s.tableHeaderText, { flex: 2 }]}>ALTERAR</Text>
        </View>

        {utilizadores.length === 0 && (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: Colors.muted, fontSize: 13 }}>
              Nenhum utilizador encontrado. Verifica as políticas RLS no Supabase.
            </Text>
          </View>
        )}

        {utilizadores.map(u => {
          const cfg = tipoConfig[u.tipo] || tipoConfig['voluntario']
          return (
            <View key={u.id} style={s.tableRow}>
              <View style={{ flex: 2 }}>
                <Text style={s.tableRowName}>{u.nome}</Text>
                <Text style={s.tableRowEmail}>{u.email}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.badgeText, { color: cfg.cor }]}>{cfg.emoji} {cfg.label}</Text>
                </View>
              </View>
              <View style={{ flex: 2, flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
                {(['voluntario','enfermeiro','admin'] as const).filter(t => t !== u.tipo).map(tipo => (
                  <TouchableOpacity
                    key={tipo}
                    style={[uStyles.tipoBtn, { borderColor: tipoConfig[tipo].cor + '60' }]}
                    onPress={() => mudarTipo(u.id, tipo)}
                    disabled={alterando === u.id}
                  >
                    {alterando === u.id
                      ? <ActivityIndicator size="small" color={tipoConfig[tipo].cor} />
                      : <Text style={[uStyles.tipoBtnText, { color: tipoConfig[tipo].cor }]}>
                          {tipoConfig[tipo].emoji} {tipoConfig[tipo].label}
                        </Text>
                    }
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

const uStyles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.red, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 18,
    alignSelf: 'flex-start',
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  formCard: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 16 },
  formLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.muted,
    letterSpacing: 0.8, marginBottom: 7, marginTop: 12,
  },
  input: {
    backgroundColor: Colors.dark3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 12, fontSize: 13, color: Colors.white,
  },
  tiposRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tipoSel: {
    flex: 1, alignItems: 'center', gap: 5, padding: 12,
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tipoSelText: { fontSize: 11, fontWeight: '700', color: Colors.muted },

  criarBtn: {
    backgroundColor: Colors.green, borderRadius: 10,
    padding: 13, alignItems: 'center', marginTop: 4,
  },
  criarBtnText: { fontSize: 14, fontWeight: '700', color: Colors.dark },

  tipoBtn: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1,
    backgroundColor: Colors.dark3,
  },
  tipoBtnText: { fontSize: 10, fontWeight: '700' },
})

function OngsManager() {
  const [ongs, setOngs]         = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [membrosPendentes, setMembrosPendentes] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [rejeitando, setRejeitando] = useState<string | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')

  // Form (criação manual pelo admin)
  const [nome, setNome]         = useState('')
  const [tipo, setTipo]         = useState('associacao')
  const [provincia, setProvincia] = useState('Namibe')
  const [municipio, setMunicipio] = useState('Namibe')
  const [descricao, setDescricao] = useState('')
  const [telefone, setTelefone]   = useState('')
  const [email, setEmail]         = useState('')

  const tipos = [
    { val: 'associacao', label: 'Associação', emoji: '🏢' },
    { val: 'religiosa',  label: 'Religiosa',  emoji: '⛪' },
    { val: 'juvenil',    label: 'Juvenil',    emoji: '🌍' },
    { val: 'outro',      label: 'Outro',      emoji: '🤝' },
  ]

  useEffect(() => { loadOngs(); loadMembros() }, [])

  async function loadOngs() {
    const { data } = await supabase
      .from('ongs')
      .select('id, nome, tipo, provincia, municipio, estado, telefone, email, descricao, nif, numero_registo, documento_url, responsavel_nome, responsavel_contacto, verificada, motivo_rejeicao, created_at')
      .order('created_at', { ascending: false })
    setOngs(data || [])
    setLoading(false)
  }

  async function loadMembros() {
    const { data } = await supabase
      .from('membros_ong')
      .select('id, estado, created_at, ongs(nome), voluntarios(numero_serial, profiles(nome))')
      .eq('estado', 'pendente')
      .order('created_at', { ascending: false })
    setMembrosPendentes(data || [])
  }

  async function aprovarMembro(id: string, aprovar: boolean) {
    await supabase.from('membros_ong')
      .update({ estado: aprovar ? 'ativo' : 'rejeitado' })
      .eq('id', id)
    loadMembros()
  }

  // ── Documentos ──
  async function verDocumento(path: string) {
    const { data, error } = await supabase.storage
      .from('documentos-ongs')
      .createSignedUrl(path, 300) // 5 minutos
    if (error) {
      Alert.alert('Erro', 'Não foi possível abrir o documento.')
      return
    }
    if (Platform.OS === 'web') {
      window.open(data.signedUrl, '_blank')
    } else {
      Linking.openURL(data.signedUrl)
    }
  }

  // ── Verificação ──
async function verificarEAprovar(id: string) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('ongs')
    .update({
      estado: 'ativa',
      verificada: true,
      data_verificacao: new Date().toISOString(),
      verificado_por: user?.id,
      motivo_rejeicao: null,
    })
    .eq('id', id)
    .select()

  if (error) {
    mostrarAlerta('Erro', error.message)
  } else if (!data || data.length === 0) {
    mostrarAlerta('Atenção', 'Nenhuma linha foi actualizada. Verifica as políticas RLS.')
  } else {
    mostrarAlerta('✅ ONG Aprovada!', 'A organização foi verificada com sucesso.')
    loadOngs()
  }
}

  async function rejeitarOng(id: string) {
    if (!motivoRejeicao.trim()) {
      Alert.alert('Atenção', 'Indica o motivo da rejeição.')
      return
    }
    await supabase.from('ongs').update({
      estado: 'suspensa',
      verificada: false,
      motivo_rejeicao: motivoRejeicao.trim(),
    }).eq('id', id)
    setRejeitando(null)
    setMotivoRejeicao('')
    loadOngs()
  }

  async function mudarEstado(id: string, estado: string) {
    await supabase.from('ongs').update({ estado }).eq('id', id)
    loadOngs()
  }

  async function criarOng() {
    if (!nome) { Alert.alert('Atenção', 'O nome é obrigatório.'); return }
    setSalvando(true)
    const { error } = await supabase.from('ongs').insert({
      nome, tipo, provincia, municipio,
      descricao: descricao || null,
      telefone: telefone || null,
      email: email || null,
      estado: 'ativa',
      verificada: true, // criada directamente pelo admin = já verificada
      data_verificacao: new Date().toISOString(),
    })
    if (!error) {
      Alert.alert('✅ ONG criada!')
      setNome(''); setDescricao(''); setTelefone(''); setEmail('')
      setShowForm(false)
      loadOngs()
    } else {
      Alert.alert('Erro', error.message)
    }
    setSalvando(false)
  }

  const estadoCfg: Record<string, { label: string; cor: string; bg: string }> = {
    ativa:    { label: 'Activa',          cor: Colors.green,   bg: 'rgba(46,204,113,0.15)'  },
    pendente: { label: 'A Verificar',     cor: Colors.gold,    bg: 'rgba(232,180,75,0.15)'  },
    suspensa: { label: 'Suspensa/Rejeitada', cor: Colors.redSoft, bg: 'rgba(232,23,58,0.15)'},
  }

  if (loading) return <ActivityIndicator color={Colors.red} style={{ marginTop: 40 }} />

  const pendentesVerificacao = ongs.filter(o => o.estado === 'pendente')
  const outrasOngs = ongs.filter(o => o.estado !== 'pendente')

  return (
    <View style={{ gap: 14 }}>

      {/* ══ FILA DE VERIFICAÇÃO LEGAL ══ */}
      {pendentesVerificacao.length > 0 && (
        <View style={uStyles.formCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Feather name="shield" size={16} color={Colors.gold} />
            <Text style={[uStyles.formTitle, { marginBottom: 0 }]}>
              Verificação Legal Pendente ({pendentesVerificacao.length})
            </Text>
          </View>

          {pendentesVerificacao.map(ong => (
            <View key={ong.id} style={ongStyles.verifCard}>
              <View style={ongStyles.verifHeader}>
                <Text style={ongStyles.verifNome}>{ong.nome}</Text>
                <View style={[s.badge, { backgroundColor: estadoCfg.pendente.bg }]}>
                  <Text style={[s.badgeText, { color: estadoCfg.pendente.cor }]}>A Verificar</Text>
                </View>
              </View>

              <View style={ongStyles.verifGrid}>
                <VerifItem label="NIF" value={ong.nif || '—'} mono />
                <VerifItem label="Nº Registo" value={ong.numero_registo || '—'} mono />
                <VerifItem label="Responsável" value={ong.responsavel_nome || '—'} />
                <VerifItem label="BI Responsável" value={ong.responsavel_contacto || '—'} mono />
                <VerifItem label="Telefone" value={ong.telefone || '—'} />
                <VerifItem label="Localização" value={`${ong.municipio}, ${ong.provincia}`} />
              </View>

              {ong.descricao && (
                <Text style={ongStyles.verifDesc}>{ong.descricao}</Text>
              )}

              {/* Documento */}
              {ong.documento_url ? (
                <TouchableOpacity style={ongStyles.docBtn} onPress={() => verDocumento(ong.documento_url)}>
                  <Feather name="file-text" size={16} color={Colors.blue} />
                  <Text style={ongStyles.docBtnText}>Ver Documento Legal</Text>
                  <Feather name="external-link" size={13} color={Colors.blue} />
                </TouchableOpacity>
              ) : (
                <View style={[ongStyles.docBtn, { borderColor: Colors.redSoft + '40' }]}>
                  <Feather name="alert-triangle" size={16} color={Colors.redSoft} />
                  <Text style={[ongStyles.docBtnText, { color: Colors.redSoft }]}>Sem documento anexado</Text>
                </View>
              )}


              {/* Acções */}
              {rejeitando === ong.id ?  (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <TextInput
                    style={uStyles.input}
                    value={motivoRejeicao}
                    onChangeText={setMotivoRejeicao}
                    placeholder="Motivo da rejeição (será visível à ONG)"
                    placeholderTextColor={Colors.muted2}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={ongStyles.confirmRejBtn} onPress={() => rejeitarOng(ong.id)}>
                      <Text style={ongStyles.confirmRejBtnText}>Confirmar Rejeição</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ongStyles.cancelBtn} onPress={() => { setRejeitando(null); setMotivoRejeicao('') }}>
                      <Text style={ongStyles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity style={ongStyles.aprovarBtn} onPress={() => verificarEAprovar(ong.id)}>
                    <Feather name="check" size={15} color={Colors.dark} />
                    <Text style={ongStyles.aprovarBtnText}>Aprovar e Verificar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={ongStyles.rejeitarBtn} onPress={() => setRejeitando(ong.id)}>
                    <Feather name="x" size={15} color={Colors.redSoft} />
                    <Text style={ongStyles.rejeitarBtnText}>Rejeitar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Adesões de membros pendentes */}
      {membrosPendentes.length > 0 && (
        <View style={uStyles.formCard}>
          <Text style={uStyles.formTitle}>🔔 Adesões Pendentes ({membrosPendentes.length})</Text>
          {membrosPendentes.map(m => (
            <View key={m.id} style={s.tableRow}>
              <View style={{ flex: 2 }}>
                <Text style={s.tableRowName}>{(m.voluntarios as any)?.profiles?.nome || '—'}</Text>
                <Text style={s.tableRowEmail}>quer juntar-se a "{(m.ongs as any)?.nome}"</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={[uStyles.tipoBtn, { borderColor: Colors.green + '60' }]} onPress={() => aprovarMembro(m.id, true)}>
                  <Text style={[uStyles.tipoBtnText, { color: Colors.green }]}>Aprovar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[uStyles.tipoBtn, { borderColor: Colors.redSoft + '60' }]} onPress={() => aprovarMembro(m.id, false)}>
                  <Text style={[uStyles.tipoBtnText, { color: Colors.redSoft }]}>Rejeitar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Adicionar ONG manualmente (já verificada) */}
      <TouchableOpacity style={uStyles.addBtn} onPress={() => setShowForm(!showForm)}>
        <Feather name={showForm ? 'x' : 'plus'} size={16} color={Colors.white} />
        <Text style={uStyles.addBtnText}>{showForm ? 'Cancelar' : 'Adicionar ONG Manualmente'}</Text>
      </TouchableOpacity>

      {showForm && (
        <View style={uStyles.formCard}>
          <Text style={uStyles.formTitle}>➕ Nova ONG (pré-verificada)</Text>

          <Text style={uStyles.formLabel}>NOME DA ONG *</Text>
          <TextInput style={uStyles.input} value={nome} onChangeText={setNome}
            placeholder="Nome da organização" placeholderTextColor={Colors.muted2} />

          <Text style={uStyles.formLabel}>TIPO</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            {tipos.map(t => (
              <TouchableOpacity
                key={t.val}
                style={[uStyles.tipoSel, tipo === t.val && { backgroundColor: Colors.redGlow, borderColor: Colors.red }]}
                onPress={() => setTipo(t.val)}
              >
                <Text style={{ fontSize: 16 }}>{t.emoji}</Text>
                <Text style={[uStyles.tipoSelText, tipo === t.val && { color: Colors.redSoft }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={uStyles.formLabel}>PROVÍNCIA</Text>
              <TextInput style={uStyles.input} value={provincia} onChangeText={setProvincia}
                placeholder="Namibe" placeholderTextColor={Colors.muted2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={uStyles.formLabel}>MUNICÍPIO</Text>
              <TextInput style={uStyles.input} value={municipio} onChangeText={setMunicipio}
                placeholder="Namibe" placeholderTextColor={Colors.muted2} />
            </View>
          </View>

          <Text style={uStyles.formLabel}>DESCRIÇÃO</Text>
          <TextInput style={[uStyles.input, { height: 80, textAlignVertical: 'top' }]}
            value={descricao} onChangeText={setDescricao}
            placeholder="Descreve a missão da ONG..."
            placeholderTextColor={Colors.muted2} multiline />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={uStyles.formLabel}>TELEFONE</Text>
              <TextInput style={uStyles.input} value={telefone} onChangeText={setTelefone}
                placeholder="+244 9XX..." placeholderTextColor={Colors.muted2} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={uStyles.formLabel}>EMAIL</Text>
              <TextInput style={uStyles.input} value={email} onChangeText={setEmail}
                placeholder="ong@email.com" placeholderTextColor={Colors.muted2}
                keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>

          <TouchableOpacity
            style={[uStyles.criarBtn, salvando && { opacity: 0.7 }]}
            onPress={criarOng} disabled={salvando}
          >
            {salvando
              ? <ActivityIndicator size="small" color={Colors.dark} />
              : <Text style={uStyles.criarBtnText}>Criar ONG (Verificada)</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Lista das outras ONGs (activas/suspensas) */}
      <Text style={[uStyles.formTitle, { marginTop: 6 }]}>Todas as ONGs</Text>
      {outrasOngs.length === 0 ? (
        <View style={s.emptyBox}>
          <Feather name="heart" size={36} color={Colors.muted2} style={{ marginBottom: 12 }} />
          <Text style={s.emptyTitle}>Sem ONGs registadas</Text>
        </View>
      ) : (
        outrasOngs.map(ong => {
          const cfg = estadoCfg[ong.estado] || estadoCfg['pendente']
          const tipoInfo = tipos.find(t => t.val === ong.tipo) || tipos[3]
          return (
            <View key={ong.id} style={[s.tableWrap, { padding: 14, marginBottom: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <Text style={{ fontSize: 24 }}>{tipoInfo.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.tableRowName}>{ong.nome}</Text>
                    {ong.verificada && <Feather name="check-circle" size={13} color={Colors.green} />}
                  </View>
                  <Text style={s.tableRowEmail}>{ong.municipio}, {ong.provincia}</Text>
                  {ong.motivo_rejeicao && (
                    <Text style={{ fontSize: 11, color: Colors.redSoft, marginTop: 4 }}>
                      Motivo: {ong.motivo_rejeicao}
                    </Text>
                  )}
                </View>
                <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.badgeText, { color: cfg.cor }]}>{cfg.label}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {ong.documento_url && (
                  <TouchableOpacity style={[uStyles.tipoBtn, { borderColor: Colors.blue + '60' }]} onPress={() => verDocumento(ong.documento_url)}>
                    <Text style={[uStyles.tipoBtnText, { color: Colors.blue }]}>📄 Documento</Text>
                  </TouchableOpacity>
                )}
                {['ativa','pendente','suspensa'].filter(e => e !== ong.estado).map(estado => (
                  <TouchableOpacity
                    key={estado}
                    style={[uStyles.tipoBtn, { borderColor: estadoCfg[estado].cor + '60' }]}
                    onPress={() => mudarEstado(ong.id, estado)}
                  >
                    <Text style={[uStyles.tipoBtnText, { color: estadoCfg[estado].cor }]}>
                      {estadoCfg[estado].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}

function VerifItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ minWidth: '45%', flex: 1 }}>
      <Text style={{ fontSize: 9, fontWeight: '700', color: Colors.muted2, letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.white, fontFamily: mono ? 'monospace' : undefined }}>{value}</Text>
    </View>
  )
}

const ongStyles = StyleSheet.create({
  criarAcessoTitle: { fontSize: 12, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  verifCard: {
    backgroundColor: Colors.dark3, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)',
  },
  verifHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  verifNome: { fontSize: 14, fontWeight: '700', color: Colors.white },
  verifGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  verifDesc: { fontSize: 12, color: Colors.muted, lineHeight: 17, marginBottom: 10 },

  docBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(74,158,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.3)',
    borderRadius: 8, padding: 12,
  },
  docBtnText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.blue },

  aprovarBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.green, borderRadius: 8, padding: 11,
  },
  aprovarBtnText: { fontSize: 13, fontWeight: '700', color: Colors.dark },
  rejeitarBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(232,23,58,0.1)', borderWidth: 1, borderColor: Colors.redSoft,
    borderRadius: 8, padding: 11,
  },
  rejeitarBtnText: { fontSize: 13, fontWeight: '700', color: Colors.redSoft },

  confirmRejBtn: { flex: 1, backgroundColor: Colors.redSoft, borderRadius: 8, padding: 11, alignItems: 'center' },
  confirmRejBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  cancelBtn: { flex: 1, backgroundColor: Colors.dark4, borderRadius: 8, padding: 11, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
})

// ── Estilos principais ───────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  main:    { flex: 1, flexDirection: 'column' },
  content: { padding: 20 },

  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  topbarTitle:     { fontSize: 16, fontWeight: '700', color: Colors.white },
  topbarBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  // YO
  YOCard: {
    backgroundColor: Colors.dark2, borderRadius: 20,
    padding: 24, marginBottom: 16, overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  YOGlow: {
    position: 'absolute', top: -60, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.redGlow,
  },
  YOEyebrow: { fontSize: 11, color: Colors.muted, letterSpacing: 0.5, marginBottom: 8 },
  YOTitle:   { fontSize: 28, fontWeight: '800', color: Colors.white, marginBottom: 8, lineHeight: 34 },
  YOTitleRed:{ color: Colors.redSoft },
  YOSub:     { fontSize: 13, color: Colors.muted, marginBottom: 20 },
  YOActions: { flexDirection: 'row', gap: 10 },

  btnPrimary: {
    backgroundColor: Colors.red, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 18,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  btnPrimaryText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  btnGhost: {
    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  btnGhostText: { color: Colors.white, fontSize: 13, fontWeight: '600' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: '30%',
    backgroundColor: Colors.dark2, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  statTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  statIcon:   { marginTop: 8, marginBottom: 10 },
  statVal:    { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel:  { fontSize: 11, color: Colors.muted },

  // Acções
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 14 },
  accoesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  accaoCard: {
    flex: 1, minWidth: '28%',
    backgroundColor: Colors.dark2, borderRadius: 14, padding: 16,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  accaoIcon:  { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accaoLabel: { fontSize: 12, fontWeight: '600', color: Colors.white, textAlign: 'center' },

  // Tabela candidatos
  tableWrap: {
    backgroundColor: Colors.dark2, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row', padding: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: Colors.dark3,
  },
  tableHeaderText: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8 },
  tableRow: {
    flexDirection: 'row', padding: 14, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  tableRowName:  { fontSize: 13, fontWeight: '600', color: Colors.white },
  tableRowEmail: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  tableRowText:  { fontSize: 13, color: Colors.white },
  tableActions:  { flexDirection: 'row', gap: 6 },
  actionBtn: {
    backgroundColor: Colors.dark3, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Colors.white },

  // Badge
  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Empty
  emptyBox: {
    backgroundColor: Colors.dark2, borderRadius: 14,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptyText:  { fontSize: 13, color: Colors.muted, textAlign: 'center' },

  // Sidebar
  sidebar:              { width: 220, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 18, justifyContent: 'space-between' },
  sidebarLogo:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  sidebarLogoIcon:      { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText:      { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive:    { backgroundColor: Colors.redGlow },
  sidebarItemLabel:     { fontSize: 13, fontWeight: '500', color: Colors.muted },
  sidebarLogout:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  sidebarLogoutText:    { fontSize: 13, color: Colors.muted },

  bottomNav: {
    flexDirection: 'row', backgroundColor: Colors.dark2,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10,
  },
  navItem:  { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 10, color: Colors.muted, fontWeight: '500' },
})

// ── Estilos do SlotManager ───────────────
const s2 = StyleSheet.create({
  section: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 18, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 14 },

  bancosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bancoBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: Colors.dark3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  bancoBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  bancoBtnText:   { fontSize: 13, fontWeight: '600', color: Colors.muted },

  formGrid:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  formField: { flex: 1 },
  formLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: Colors.dark3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 11, fontSize: 13,
  },

  tiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tipoBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.dark3, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tipoBtnActive: { backgroundColor: Colors.redGlow, borderColor: Colors.red },
  tipoBtnText:   { fontSize: 12, fontWeight: '600', color: Colors.muted },

  criarBtn: {
    backgroundColor: Colors.red, borderRadius: 10,
    padding: 13, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  criarBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  slotRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, backgroundColor: Colors.dark3,
    borderRadius: 10, marginBottom: 8, gap: 12,
  },
  slotInfo:      { flex: 2 },
  slotData:      { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  slotHora:      { fontSize: 18, fontWeight: '800', color: Colors.redSoft },
  slotTipo:      { fontSize: 11, color: Colors.muted, marginTop: 2 },
  slotVagas:     { flex: 1, alignItems: 'center' },
  slotVagasNum:  { fontSize: 18, fontWeight: '800' },
  slotVagasLabel:{ fontSize: 10, color: Colors.muted },
  slotBtns:      { flexDirection: 'row', gap: 6, alignItems: 'center' },
  slotToggle:    { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  slotToggleText:{ fontSize: 11, fontWeight: '700' },
  slotDelete:    { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(232,23,58,0.1)', alignItems: 'center', justifyContent: 'center' },
  })