// app/(voluntario)/ongs.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, Modal, TextInput
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta, confirmar } from '../../utils/alert'
import BottomNav from '../../components/BottomNav'
import MapaMoyo from '../../components/MapaMoyo'
import { useProvinciaDoUser } from '../../hooks/useProvincia'
import { SafeAreaView } from 'react-native-safe-area-context'

type ONG = {
  id: string; nome: string; tipo: string; provincia: string
  municipio: string; descricao: string | null; telefone: string | null
  email: string | null; estado: string; verificada: boolean
  isMembro?: boolean; estadoAdesao?: string; membroId?: string
  totalMembros?: number; data_verificacao?: string | null
}

export default function ONGs() {
  const [seguindo, setSeguindo] = useState<Set<string>>(new Set())

  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900
  const { provincia } = useProvinciaDoUser()

  const [ongs, setOngs]             = useState<ONG[]>([])
  const [loading, setLoading]       = useState(true)
  const [voluntarioId, setVoluntarioId] = useState<string | null>(null)
  const [aderindo, setAderindo]     = useState<string | null>(null)
  const [filtro, setFiltro]         = useState<'todas' | 'minhas'>('todas')
  const [ongDetalhes, setOngDetalhes] = useState<ONG | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const { data: vol } = await supabase
      .from('voluntarios').select('id').eq('profile_id', user.id).single()
    if (vol) setVoluntarioId(vol.id)

    const { data: ongsData } = await supabase
      .from('ongs')
      .select('id, nome, tipo, provincia, municipio, descricao, telefone, email, estado, verificada, data_verificacao')
      .eq('estado', 'ativa')
      .order('nome')

    const lista = (ongsData || []) as ONG[]

    if (vol?.id) {
      const { data: membros } = await supabase
        .from('membros_ong')
        .select('id, ong_id, estado')
        .eq('voluntario_id', vol.id)

      const myMap = new Map((membros || []).map((m: any) => [m.ong_id, { estado: m.estado, id: m.id }]))
      lista.forEach(o => {
        const info = myMap.get(o.id)
        if (info) {
          o.isMembro = true
          o.estadoAdesao = info.estado
          o.membroId = info.id
        }
      })

      const { data: seguidos } = await supabase
      .from('seguidores_ong')
      .select('ong_id')
      .eq('voluntario_id', vol.id)
    setSeguindo(new Set((seguidos || []).map((s: any) => s.ong_id)))
    }

    // Conta membros de cada ONG
    for (const ong of lista) {
      const { count } = await supabase
        .from('membros_ong').select('id', { count: 'exact', head: true })
        .eq('ong_id', ong.id).eq('estado', 'ativo')
      ong.totalMembros = count || 0
    }

    setOngs(lista)
    setLoading(false)

  
  }


// No loadData, após carregar ongs, busca os que segues:


async function handleSeguir(ongId: string) {
  if (!voluntarioId) return
  const jaSegue = seguindo.has(ongId)
  if (jaSegue) {
    await supabase.from('seguidores_ong').delete().eq('ong_id', ongId).eq('voluntario_id', voluntarioId)
    setSeguindo(prev => { const n = new Set(prev); n.delete(ongId); return n })
    mostrarAlerta('Deixaste de seguir', 'Já não verás publicações desta ONG no feed.')
  } else {
    await supabase.from('seguidores_ong').insert({ ong_id: ongId, voluntario_id: voluntarioId })
    setSeguindo(prev => new Set([...prev, ongId]))
    mostrarAlerta('✅ A seguir!', 'As publicações desta ONG aparecerão no teu feed.')
  }
}

  async function handleAderir(ongId: string) {
    if (!voluntarioId) return
    setAderindo(ongId)
    const { error } = await supabase.from('membros_ong').insert({
      ong_id: ongId, voluntario_id: voluntarioId, estado: 'pendente',
    })
    if (!error) {
      mostrarAlerta('✅ Solicitação enviada!', 'A tua adesão está pendente de aprovação pela ONG.')
      loadData()
    } else if (error.code === '23505') {
      mostrarAlerta('Atenção', 'Já tens um pedido de adesão para esta ONG.')
    } else {
      mostrarAlerta('Erro', error.message)
    }
    setAderindo(null)
  }

  async function handleSair(membroId: string) {
    confirmar('Sair da ONG', 'Tens a certeza que queres sair desta ONG?', async () => {
      await supabase.from('membros_ong').update({ estado: 'saiu' }).eq('id', membroId)
      loadData()
    })
  }

  const tipoLabel: Record<string, string> = { associacao: 'Associação', religiosa: 'Religiosa', juvenil: 'Juvenil', outro: 'Outro' }
  const tipoEmoji: Record<string, string> = { associacao: '🏢', religiosa: '⛪', juvenil: '🌍', outro: '🤝' }

  const estadoAdesaoCfg: Record<string, { label: string; cor: string; bg: string }> = {
    ativo:     { label: '✓ Membro activo',      cor: Colors.green,   bg: 'rgba(46,204,113,0.1)'  },
    pendente:  { label: '⏳ Aguarda aprovação',  cor: Colors.gold,    bg: 'rgba(232,180,75,0.1)'  },
    rejeitado: { label: '✗ Pedido rejeitado',    cor: Colors.redSoft, bg: 'rgba(232,23,58,0.1)'   },
    saiu:      { label: 'Saiu desta ONG',        cor: Colors.muted,   bg: Colors.dark3             },
  }

  const filtradas = filtro === 'minhas' ? ongs.filter(o => o.isMembro && o.estadoAdesao !== 'saiu') : ongs

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {isWeb && <SidebarWeb />}
      <View style={s.main}>

        <View style={[s.topbar]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>ONGs na Região</Text>
          <View style={{ flex: 1 }} />
          <View style={s.topbarBadge}>
            <Text style={s.topbarBadgeText}>VOLUNTÁRIO</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={s.content}>

            <MapaMoyo altura={200} />

            {/* Filtros */}
            <View style={s.filtros}>
              <TouchableOpacity style={[s.filtroBtn, filtro === 'todas' && s.filtroBtnActive]} onPress={() => setFiltro('todas')}>
                <Text style={[s.filtroBtnText, filtro === 'todas' && { color: Colors.white }]}>Todas ({ongs.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.filtroBtn, filtro === 'minhas' && s.filtroBtnActive]} onPress={() => setFiltro('minhas')}>
                <Text style={[s.filtroBtnText, filtro === 'minhas' && { color: Colors.white }]}>
                  As minhas ({ongs.filter(o => o.isMembro && o.estadoAdesao !== 'saiu').length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* As minhas ONGs — status cards */}
            {filtro === 'minhas' && (
              <View style={{ marginBottom: 16 }}>
                {ongs.filter(o => o.isMembro).map(o => {
                  const cfg = estadoAdesaoCfg[o.estadoAdesao || 'pendente']
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[s.minhaOngCard, { borderColor: cfg.cor + '40' }]}
                      onPress={() => setOngDetalhes(o)}
                    >
                      <View style={[s.minhaOngIcone, { backgroundColor: cfg.cor + '18' }]}>
                        <Text style={{ fontSize: 22 }}>{tipoEmoji[o.tipo] || '🤝'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.minhaOngNome}>{o.nome}</Text>
                        <Text style={s.minhaOngLocal}>📍 {o.municipio}, {o.provincia}</Text>
                        <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[s.statusBadgeText, { color: cfg.cor }]}>{cfg.label}</Text>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={16} color={Colors.muted} />
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Link registar ONG */}
            <TouchableOpacity style={s.registarOngBtn} onPress={() => router.push('/(auth)/registar-ong' as any)}>
              <Feather name="plus-circle" size={16} color={Colors.blue} />
              <Text style={s.registarOngBtnText}>Representa uma ONG? Regista-a aqui</Text>
              <Feather name="chevron-right" size={14} color={Colors.muted} />
            </TouchableOpacity>

            {/* Lista principal */}
            {filtradas.length === 0 ? (
              <View style={s.emptyBox}>
                <Feather name="users" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>
                  {filtro === 'minhas' ? 'Ainda não és membro de nenhuma ONG' : 'Sem ONGs disponíveis'}
                </Text>
                <Text style={s.emptyText}>
                  {filtro === 'minhas' ? 'Explora as ONGs e junta-te a uma.' : 'Nenhuma ONG activa na região.'}
                </Text>
                {filtro === 'minhas' && (
                  <TouchableOpacity style={s.emptyBtn} onPress={() => setFiltro('todas')}>
                    <Text style={s.emptyBtnText}>Explorar ONGs</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filtradas.map(ong => {
                const adesaoCfg = ong.estadoAdesao ? estadoAdesaoCfg[ong.estadoAdesao] : null
                return (
                  <TouchableOpacity
                    key={ong.id}
                    style={[s.ongCard, ong.estadoAdesao === 'ativo' && s.ongCardMembro]}
                    onPress={() => setOngDetalhes(ong)}
                    activeOpacity={0.8}
                  >
                    <View style={s.ongHeader}>
                      <View style={s.ongAvatar}>
                        <Text style={{ fontSize: 22 }}>{tipoEmoji[ong.tipo] || '🤝'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.ongNameRow}>
                          <Text style={s.ongNome}>{ong.nome}</Text>
                          {ong.verificada && (
                            <Feather name="check-circle" size={13} color={Colors.blue} />
                          )}
                        </View>
                        <View style={s.ongMeta}>
                          <View style={s.ongTipoBadge}>
                            <Text style={s.ongTipoText}>{tipoLabel[ong.tipo] || ong.tipo}</Text>
                          </View>
                          <View style={s.ongLocalRow}>
                            <Feather name="map-pin" size={10} color={Colors.muted} />
                            <Text style={s.ongLocal}>{ong.municipio}</Text>
                          </View>
                          {(ong.totalMembros || 0) > 0 && (
                            <View style={s.ongLocalRow}>
                              <Feather name="users" size={10} color={Colors.muted} />
                              <Text style={s.ongLocal}>{ong.totalMembros} membros</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    {ong.descricao && (
                      <Text style={s.ongDesc} numberOfLines={2}>{ong.descricao}</Text>
                    )}

                    {/* Status da adesão se membro */}
                    {adesaoCfg && (
                      <View style={[s.adesaoStatus, { backgroundColor: adesaoCfg.bg, borderColor: adesaoCfg.cor + '30' }]}>
                        <Text style={[s.adesaoStatusText, { color: adesaoCfg.cor }]}>{adesaoCfg.label}</Text>
                      </View>
                    )}

                    <View style={s.ongActions}>
                      <TouchableOpacity style={s.btnVerDetalhes} onPress={() => setOngDetalhes(ong)}>
                        <Feather name="info" size={13} color={Colors.muted} />
                        <Text style={s.btnVerDetalhesText}>Ver mais</Text>
                      </TouchableOpacity>

                      {/* Botão Seguir */}
                      <TouchableOpacity
                        style={[s.btnSeguir, seguindo.has(ong.id) && s.btnSeguindo]}
                        onPress={() => handleSeguir(ong.id)}
                      >
                        <Feather name={seguindo.has(ong.id) ? 'bell-off' : 'bell'} size={13} color={seguindo.has(ong.id) ? Colors.muted : Colors.blue} />
                        <Text style={[s.btnSeguirText, seguindo.has(ong.id) && { color: Colors.muted }]}>
                          {seguindo.has(ong.id) ? 'A seguir' : 'Seguir'}
                        </Text>
                      </TouchableOpacity>

                      {/* Botão Aderir */}
                      {!ong.isMembro ? (
                        <TouchableOpacity style={s.btnAderir} onPress={() => handleAderir(ong.id)} disabled={aderindo === ong.id}>
                          {aderindo === ong.id ? <ActivityIndicator size="small" color={Colors.white} /> : (
                            <>
                              <Feather name="user-plus" size={13} color={Colors.white} />
                              <Text style={s.btnAderirText}>Aderir</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : ong.estadoAdesao === 'ativo' ? (
                        <TouchableOpacity style={s.btnSair} onPress={() => handleSair(ong.membroId!)}>
                          <Feather name="log-out" size={13} color={Colors.muted} />
                          <Text style={s.btnSairText}>Sair</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                  </TouchableOpacity>
                )
              })
            )}
          </View>
        </ScrollView>

        {!isWeb && (
          <BottomNav items={[
            { icon: 'grid',        label: 'Início',    route: '/(voluntario)'           },
            { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'    },
            { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'   },
            { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico' },
            { icon: 'user',        label: 'Perfil',    route: '/(voluntario)/perfil'    },
          ]} />
        )}
      </View>

      {/* ══ MODAL DETALHES DA ONG ══ */}
      {ongDetalhes && (
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setOngDetalhes(null)}>
          <ScrollView style={s.modalScroll} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={s.modalCard}>
                <View style={s.modalTopBar}>
                  <Text style={s.modalTitle}>Detalhes da ONG</Text>
                  <TouchableOpacity onPress={() => setOngDetalhes(null)} style={{ padding: 6 }}>
                    <Feather name="x" size={18} color={Colors.muted} />
                  </TouchableOpacity>
                </View>

                {/* Cabeçalho da ONG */}
                <View style={s.modalOngHeader}>
                  <View style={s.modalOngIcone}>
                    <Text style={{ fontSize: 36 }}>{tipoEmoji[ongDetalhes.tipo] || '🤝'}</Text>
                  </View>
                  <Text style={s.modalOngNome}>{ongDetalhes.nome}</Text>
                  {ongDetalhes.verificada && (
                    <View style={s.verificadaBadge}>
                      <Feather name="check-circle" size={13} color={Colors.blue} />
                      <Text style={s.verificadaText}>Verificada pelo Moyo</Text>
                    </View>
                  )}
                  {ongDetalhes.descricao && (
                    <Text style={s.modalOngDesc}>{ongDetalhes.descricao}</Text>
                  )}
                </View>

                {/* Informações */}
                <View style={s.modalInfoBox}>
                  <ModalRow icon="tag" label="Tipo" value={tipoLabel[ongDetalhes.tipo] || ongDetalhes.tipo} />
                  <ModalRow icon="map-pin" label="Localização" value={`${ongDetalhes.municipio}, ${ongDetalhes.provincia}`} />
                  {ongDetalhes.telefone && <ModalRow icon="phone" label="Telefone" value={ongDetalhes.telefone} />}
                  {ongDetalhes.email && <ModalRow icon="mail" label="Email" value={ongDetalhes.email} />}
                  {(ongDetalhes.totalMembros || 0) > 0 && (
                    <ModalRow icon="users" label="Membros activos" value={`${ongDetalhes.totalMembros}`} />
                  )}
                  {ongDetalhes.data_verificacao && (
                    <ModalRow icon="calendar" label="Verificada em" value={new Date(ongDetalhes.data_verificacao).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })} />
                  )}
                </View>

                {/* Status da adesão do utilizador */}
                {ongDetalhes.estadoAdesao && ongDetalhes.estadoAdesao !== 'saiu' && (
                  <View style={[s.adesaoModalBox, {
                    backgroundColor: estadoAdesaoCfg[ongDetalhes.estadoAdesao]?.bg,
                    borderColor: estadoAdesaoCfg[ongDetalhes.estadoAdesao]?.cor + '40',
                  }]}>
                    <Text style={[s.adesaoModalText, { color: estadoAdesaoCfg[ongDetalhes.estadoAdesao]?.cor }]}>
                      {estadoAdesaoCfg[ongDetalhes.estadoAdesao]?.label}
                    </Text>
                    {ongDetalhes.estadoAdesao === 'pendente' && (
                      <Text style={s.adesaoModalSub}>
                        O teu pedido está a ser analisado pela organização. Podes ser contactado em breve.
                      </Text>
                    )}
                    {ongDetalhes.estadoAdesao === 'ativo' && (
                      <Text style={s.adesaoModalSub}>
                        Fazes parte desta organização. Serás notificado sobre campanhas e actividades.
                      </Text>
                    )}
                  </View>
                )}

                {/* Acções */}
                <View style={{ gap: 10, marginTop: 8 }}>
                  {!ongDetalhes.isMembro && (
                    <TouchableOpacity
                      style={s.modalBtnAderir}
                      onPress={() => { setOngDetalhes(null); handleAderir(ongDetalhes.id) }}
                    >
                      <Feather name="user-plus" size={16} color={Colors.white} />
                      <Text style={s.modalBtnAderirText}>Aderir a esta ONG</Text>
                    </TouchableOpacity>
                  )}
                  {ongDetalhes.estadoAdesao === 'ativo' && (
                    <TouchableOpacity
                      style={s.modalBtnSair}
                      onPress={() => { setOngDetalhes(null); handleSair(ongDetalhes.membroId!) }}
                    >
                      <Feather name="log-out" size={14} color={Colors.redSoft} />
                      <Text style={s.modalBtnSairText}>Sair desta ONG</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  )
}

function ModalRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={s.modalRow}>
      <View style={s.modalRowIcon}>
        <Feather name={icon} size={13} color={Colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.modalRowLabel}>{label}</Text>
        <Text style={s.modalRowValue}>{value}</Text>
      </View>
    </View>
  )
}

function SidebarWeb() {
  const items: { icon: keyof typeof Feather.glyphMap; label: string; route: string; active?: boolean }[] = [
    { icon: 'grid',        label: 'Dashboard', route: '/(voluntario)'           },
    { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'    },
    { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'   },
    { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico' },
    { icon: 'activity',    label: 'Campanhas', route: '/(voluntario)/campanhas' },
    { icon: 'users',       label: 'ONGs',      route: '/(voluntario)/ongs', active: true },
    { icon: 'book-open',   label: 'Educação',  route: '/(voluntario)/educacao'  },
  ]
  return (
    <View style={s.sidebar}>
      <View>
        <View style={s.sidebarLogo}>
          <View style={s.sidebarLogoIcon}>
            <Text style={{ color: Colors.white, fontWeight: '800', fontSize: 15 }}>M</Text>
          </View>
          <Text style={s.sidebarLogoText}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
        </View>
        <View style={{ gap: 3 }}>
          {items.map(n => (
            <TouchableOpacity key={n.label} style={[s.sidebarItem, n.active && s.sidebarItemActive]} onPress={() => router.push(n.route as any)}>
              <Feather name={n.icon} size={15} color={n.active ? Colors.redSoft : Colors.muted} />
              <Text style={[s.sidebarItemLabel, n.active && { color: Colors.redSoft }]}>{n.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={s.sidebarLogout} onPress={async () => { await supabase.auth.signOut(); router.replace('/(auth)/login') }}>
        <Feather name="log-out" size={15} color={Colors.muted} />
        <Text style={s.sidebarLogoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  main: { flex: 1 },
  content: { padding: 20 },

  topbar: { height: 60, backgroundColor: Colors.dark2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  topbarTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
  topbarBadge: { backgroundColor: Colors.red, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },

  filtros: { flexDirection: 'row', gap: 8, marginBottom: 16, marginTop: 16 },
  filtroBtn: { flex: 1, backgroundColor: Colors.dark2, borderRadius: 10, padding: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  filtroBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  filtroBtnText: { fontSize: 13, fontWeight: '600', color: Colors.muted },

  // Minhas ONGs
  minhaOngCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark2, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  minhaOngIcone: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  minhaOngNome: { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  minhaOngLocal: { fontSize: 11, color: Colors.muted, marginBottom: 6 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  // ONG card
  ongCard: { backgroundColor: Colors.dark2, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  ongCardMembro: { borderColor: 'rgba(46,204,113,0.25)' },
  ongHeader: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  ongAvatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.dark3, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ongNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  ongNome: { fontSize: 15, fontWeight: '700', color: Colors.white },
  ongMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ongTipoBadge: { backgroundColor: Colors.dark4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  ongTipoText: { fontSize: 10, fontWeight: '600', color: Colors.muted },
  ongLocalRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ongLocal: { fontSize: 11, color: Colors.muted },
  ongDesc: { fontSize: 13, color: Colors.muted, lineHeight: 18, marginBottom: 10 },
  adesaoStatus: { borderRadius: 8, padding: 8, borderWidth: 1, marginBottom: 10 },
  adesaoStatusText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  ongActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12 },
  btnVerDetalhes: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: Colors.dark3, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  btnVerDetalhesText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  btnAderir: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.blue, borderRadius: 10, padding: 10 },
  btnAderirText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  btnSair: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.dark3, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  btnSairText: { fontSize: 12, fontWeight: '600', color: Colors.muted },

  registarOngBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(74,158,255,0.07)', borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)', borderRadius: 12, padding: 14, marginBottom: 16 },
  registarOngBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.white },

  emptyBox: { backgroundColor: Colors.dark2, borderRadius: 14, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptyText: { fontSize: 13, color: Colors.muted, textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: Colors.red, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  emptyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  // Modal
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 999 },
  modalScroll: { flex: 1 },
  modalCard: { backgroundColor: Colors.dark2, borderRadius: 22, padding: 24, width: '100%', maxWidth: 480, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  modalOngHeader: { alignItems: 'center', marginBottom: 20 },
  modalOngIcone: { width: 72, height: 72, borderRadius: 18, backgroundColor: Colors.dark3, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalOngNome: { fontSize: 20, fontWeight: '800', color: Colors.white, textAlign: 'center', marginBottom: 8 },
  verificadaBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(74,158,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  verificadaText: { fontSize: 12, fontWeight: '700', color: Colors.blue },
  modalOngDesc: { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 19 },
  modalInfoBox: { backgroundColor: Colors.dark3, borderRadius: 14, padding: 6, marginBottom: 16 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  modalRowIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.dark4, alignItems: 'center', justifyContent: 'center' },
  modalRowLabel: { fontSize: 10, color: Colors.muted, marginBottom: 1 },
  modalRowValue: { fontSize: 13, fontWeight: '600', color: Colors.white },
  adesaoModalBox: { borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 14 },
  adesaoModalText: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  adesaoModalSub: { fontSize: 12, color: Colors.muted, lineHeight: 17 },
  modalBtnAderir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.blue, borderRadius: 12, padding: 14 },
  modalBtnAderirText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  modalBtnSair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(232,23,58,0.08)', borderWidth: 1, borderColor: 'rgba(232,23,58,0.25)', borderRadius: 12, padding: 13 },
  modalBtnSairText: { fontSize: 13, fontWeight: '700', color: Colors.redSoft },

  sidebar: { width: 220, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 18, justifyContent: 'space-between' },
  sidebarLogo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  sidebarLogoIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText: { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive: { backgroundColor: Colors.redGlow },
  sidebarItemLabel: { fontSize: 13, fontWeight: '500', color: Colors.muted },
  sidebarLogout: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  sidebarLogoutText: { fontSize: 13, color: Colors.muted },
  btnSeguir: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(74,158,255,0.1)', borderRadius: 10, padding: 9, borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)' },
  btnSeguindo: { backgroundColor: Colors.dark3, borderColor: 'rgba(255,255,255,0.07)' },
  btnSeguirText: { fontSize: 12, fontWeight: '700', color: Colors.blue },
})