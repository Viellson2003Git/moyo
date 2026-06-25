// app/(voluntario)/historico.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import BottomNav from '../../components/BottomNav'
type Doacao = {
  id: string
  data_doacao: string
  tipo_doacao: string
  observacoes: string | null
  bancos_sangue: { nome: string } | null
  enfermeiros: { profiles: { nome: string } | null } | null
}

type Agendamento = {
  id: string
  estado: string
  data_agendamento: string
  slots: { data: string; hora: string; tipo_doacao: string } | null
}

export default function Historico() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [doacoes, setDoacoes]         = useState<Doacao[]>([])
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<'doacoes' | 'agendamentos'>('doacoes')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/(auth)/login'); return }

      const { data: vol } = await supabase
        .from('voluntarios')
        .select('id')
        .eq('profile_id', user.id)
        .single()

      if (vol?.id) {
        const [{ data: doc }, { data: ag }] = await Promise.all([
          supabase
            .from('doacoes')
            .select('id, data_doacao, tipo_doacao, observacoes, bancos_sangue(nome), enfermeiros(profiles(nome))')
            .eq('voluntario_id', vol.id)
            .order('data_doacao', { ascending: false }),
          supabase
            .from('agendamentos')
            .select('id, estado, data_agendamento, slots(data, hora, tipo_doacao)')
            .eq('voluntario_id', vol.id)
            .order('data_agendamento', { ascending: false }),
        ])
        setDoacoes((doc as any) || [])
        setAgendamentos((ag as any) || [])
      }
    } catch (e) { console.log(e) }
    setLoading(false)
  }

  async function cancelarAgendamento(id: string) {
    const { error } = await supabase
      .from('agendamentos')
      .update({ estado: 'cancelado' })
      .eq('id', id)

    if (!error) {
      setAgendamentos(prev =>
        prev.map(a => a.id === id ? { ...a, estado: 'cancelado' } : a)
      )
    }
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={Colors.red} />
    </View>
  )

  // ── Badges de estado ──────────────────
  function EstadoBadge({ estado }: { estado: string }) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      realizado:  { label: 'Realizada',  color: Colors.green,  bg: 'rgba(46,204,113,0.15)'  },
      confirmado: { label: 'Confirmado', color: Colors.blue,   bg: 'rgba(74,158,255,0.15)'  },
      pendente:   { label: 'Pendente',   color: Colors.gold,   bg: 'rgba(232,180,75,0.15)'  },
      cancelado:  { label: 'Cancelado',  color: Colors.muted,  bg: 'rgba(136,136,160,0.15)' },
    }
    const cfg = map[estado] || map['pendente']
    return (
      <View style={[s.badge, { backgroundColor: cfg.bg }]}>
        <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    )
  }

  return (
    <View style={s.root}>

      {/* Sidebar web */}
      {isWeb && (
        <SidebarWeb onLogout={async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        }} />
      )}

      <View style={s.main}>

        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>Histórico</Text>
          <View style={{ flex: 1 }} />
          <View style={s.topbarBadge}>
            <Text style={s.topbarBadgeText}>VOLUNTÁRIO</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.content}>

            {/* Resumo */}
            <View style={s.summaryRow}>
              <View style={s.summaryCard}>
                <Text style={[s.summaryVal, { color: Colors.redSoft }]}>
                  {doacoes.length}
                </Text>
                <Text style={s.summaryLabel}>Doações{'\n'}Realizadas</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={[s.summaryVal, { color: Colors.blue }]}>
                  {doacoes.length * 3}
                </Text>
                <Text style={s.summaryLabel}>Vidas{'\n'}Salvas (es.)</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={[s.summaryVal, { color: Colors.green }]}>
                  {agendamentos.filter(a => a.estado === 'confirmado').length}
                </Text>
                <Text style={s.summaryLabel}>Agendamentos{'\n'}Activos</Text>
              </View>
              <View style={s.summaryCard}>
                <Text style={[s.summaryVal, { color: Colors.gold }]}>
                  {agendamentos.filter(a => a.estado === 'cancelado').length}
                </Text>
                <Text style={s.summaryLabel}>Agendamentos{'\n'}Cancelados</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
              <TouchableOpacity
                style={[s.tab, activeTab === 'doacoes' && s.tabActive]}
                onPress={() => setActiveTab('doacoes')}
              >
                <Feather
                  name="droplet"
                  size={14}
                  color={activeTab === 'doacoes' ? Colors.white : Colors.muted}
                />
                <Text style={[s.tabText, activeTab === 'doacoes' && s.tabTextActive]}>
                  Doações ({doacoes.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, activeTab === 'agendamentos' && s.tabActive]}
                onPress={() => setActiveTab('agendamentos')}
              >
                <Feather
                  name="calendar"
                  size={14}
                  color={activeTab === 'agendamentos' ? Colors.white : Colors.muted}
                />
                <Text style={[s.tabText, activeTab === 'agendamentos' && s.tabTextActive]}>
                  Agendamentos ({agendamentos.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── ABA DOAÇÕES ── */}
            {activeTab === 'doacoes' && (
              <>
                {doacoes.length === 0 ? (
                  <EmptyState
                    icon="droplet"
                    title="Ainda sem doações"
                    text="As tuas doações realizadas aparecerão aqui após confirmação pelo enfermeiro."
                  />
                ) : (
                  doacoes.map((d, i) => (
                    <View key={d.id} style={s.item}>
                      {/* Linha de tempo */}
                      <View style={s.timeline}>
                        <View style={s.timelineDot} />
                        {i < doacoes.length - 1 && <View style={s.timelineLine} />}
                      </View>

                      <View style={s.itemCard}>
                        <View style={s.itemHeader}>
                          <View style={s.itemIconWrap}>
                            <Text style={{ fontSize: 18 }}>🩸</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemTitle}>{d.tipo_doacao}</Text>
                            <Text style={s.itemSub}>
                              {(d.bancos_sangue as any)?.nome || 'Hospital Ngola Kimbanda'}
                            </Text>
                          </View>
                          <EstadoBadge estado="realizado" />
                        </View>

                        <View style={s.itemFooter}>
                          <View style={s.itemMeta}>
                            <Feather name="calendar" size={11} color={Colors.muted} />
                            <Text style={s.itemMetaText}>
                              {new Date(d.data_doacao).toLocaleDateString('pt-PT', {
                                day: '2-digit', month: 'long', year: 'numeric'
                              })}
                            </Text>
                          </View>
                          {(d.enfermeiros as any)?.profiles?.nome && (
                            <View style={s.itemMeta}>
                              <Feather name="user" size={11} color={Colors.muted} />
                              <Text style={s.itemMetaText}>
                                {(d.enfermeiros as any).profiles.nome}
                              </Text>
                            </View>
                          )}
                        </View>

                        {d.observacoes && (
                          <Text style={s.itemObs}>{d.observacoes}</Text>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ── ABA AGENDAMENTOS ── */}
            {activeTab === 'agendamentos' && (
              <>
                {agendamentos.length === 0 ? (
                  <EmptyState
                    icon="calendar"
                    title="Sem agendamentos"
                    text="Os teus agendamentos aparecerão aqui. Agenda a tua próxima doação!"
                    action={{ label: '📅 Agendar Doação', onPress: () => router.push('/(voluntario)/agendar' as any) }}
                  />
                ) : (
                  agendamentos.map((a, i) => {
                    const slot = a.slots as any
                    const isCancelado = a.estado === 'cancelado'
                    return (
                      <View key={a.id} style={s.item}>
                        <View style={s.timeline}>
                          <View style={[s.timelineDot, isCancelado && { backgroundColor: Colors.muted2 }]} />
                          {i < agendamentos.length - 1 && <View style={s.timelineLine} />}
                        </View>

                        <View style={[s.itemCard, isCancelado && { opacity: 0.6 }]}>
                          <View style={s.itemHeader}>
                            <View style={[s.itemIconWrap, { backgroundColor: 'rgba(74,158,255,0.1)' }]}>
                              <Feather name="calendar" size={18} color={Colors.blue} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.itemTitle}>
                                {slot?.tipo_doacao || 'Sangue Total'}
                              </Text>
                              <Text style={s.itemSub}>
                                Hospital Ngola Kimbanda
                              </Text>
                            </View>
                            <EstadoBadge estado={a.estado} />
                          </View>

                          <View style={s.itemFooter}>
                            {slot && (
                              <>
                                <View style={s.itemMeta}>
                                  <Feather name="calendar" size={11} color={Colors.muted} />
                                  <Text style={s.itemMetaText}>
                                    {new Date(slot.data).toLocaleDateString('pt-PT', {
                                      day: '2-digit', month: 'long', year: 'numeric'
                                    })}
                                  </Text>
                                </View>
                                <View style={s.itemMeta}>
                                  <Feather name="clock" size={11} color={Colors.muted} />
                                  <Text style={s.itemMetaText}>
                                    {slot.hora?.slice(0,5)}
                                  </Text>
                                </View>
                              </>
                            )}
                          </View>

                          {/* Cancelar agendamento */}
                          {(a.estado === 'pendente' || a.estado === 'confirmado') && (
                            <TouchableOpacity
                              style={s.cancelBtn}
                              onPress={() => cancelarAgendamento(a.id)}
                            >
                              <Feather name="x" size={12} color={Colors.muted} />
                              <Text style={s.cancelBtnText}>Cancelar agendamento</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })
                )}
              </>
            )}

            <View style={{ height: isWeb ? 40 : 100 }} />
          </View>
        </ScrollView>

        {/* Bottom Nav mobile */}
        {!isWeb && (
          <BottomNav items={[
            { icon: 'grid',        label: 'Início',    route: '/(voluntario)'           },
            { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao',    active: true }, // ← muda o active conforme o ecrã
            { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'   },
            { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico' },
            { icon: 'user',        label: 'Perfil',    route: '/(voluntario)/perfil'    },
          ]} />
        )}
      </View>
    </View>
  )
}

// ── Componentes ─────────────────────────
function EmptyState({ icon, title, text, action }: {
  icon: keyof typeof Feather.glyphMap
  title: string; text: string
  action?: { label: string; onPress: () => void }
}) {
  return (
    <View style={s.emptyBox}>
      <View style={s.emptyIconWrap}>
        <Feather name={icon} size={32} color={Colors.muted2} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {action && (
        <TouchableOpacity style={s.emptyBtn} onPress={action.onPress}>
          <Text style={s.emptyBtnText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

function SidebarWeb({ onLogout }: { onLogout: () => void }) {
  const items: { icon: keyof typeof Feather.glyphMap; label: string; route: string; active?: boolean }[] = [
    { icon: 'grid',        label: 'Dashboard', route: '/(voluntario)'           },
    { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'    },
    { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'   },
    { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico', active: true },
    { icon: 'activity',    label: 'Campanhas', route: '/(voluntario)/campanhas' },
    { icon: 'users',       label: 'ONGs',      route: '/(voluntario)/ongs'      },
    { icon: 'book-open',   label: 'Educação',  route: '/(voluntario)/educacao'  },
  ]
  return (
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
          {items.map(n => (
            <TouchableOpacity
              key={n.label}
              style={[s.sidebarItem, n.active && s.sidebarItemActive]}
              onPress={() => router.push(n.route as any)}
            >
              <Feather name={n.icon} size={15} color={n.active ? Colors.redSoft : Colors.muted} />
              <Text style={[s.sidebarItemLabel, n.active && { color: Colors.redSoft }]}>
                {n.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={s.sidebarLogout} onPress={onLogout}>
        <Feather name="log-out" size={15} color={Colors.muted} />
        <Text style={s.sidebarLogoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Estilos ─────────────────────────────
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
  backBtn:       { padding: 8 },
  topbarTitle:   { fontSize: 16, fontWeight: '700', color: Colors.white },
  topbarBadge:   { backgroundColor: Colors.red, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },

  // Resumo
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: {
    flex: 1, backgroundColor: Colors.dark2, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center',
  },
  summaryVal:   { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  summaryLabel: { fontSize: 10, color: Colors.muted, textAlign: 'center', lineHeight: 14 },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: Colors.dark3,
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 9 },
  tabActive:    { backgroundColor: Colors.red },
  tabText:      { fontSize: 13, fontWeight: '600', color: Colors.muted },
  tabTextActive:{ color: Colors.white },

  // Timeline item
  item: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timeline:     { alignItems: 'center', width: 16, paddingTop: 18 },
  timelineDot:  { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.red, zIndex: 1 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.dark4, marginTop: 4 },

  itemCard: {
    flex: 1, backgroundColor: Colors.dark2, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  itemIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(232,23,58,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  itemTitle: { fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  itemSub:   { fontSize: 12, color: Colors.muted },

  itemFooter: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  itemMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemMetaText: { fontSize: 11, color: Colors.muted },

  itemObs: {
    fontSize: 12, color: Colors.muted, fontStyle: 'italic',
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },

  // Badge
  badge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Cancelar
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  cancelBtnText: { fontSize: 12, color: Colors.muted },

  // Empty
  emptyBox: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 36, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyIconWrap: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: Colors.dark3,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptyText:  { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn:   { backgroundColor: Colors.red, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // Sidebar
  sidebar:          { width: 220, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 18, justifyContent: 'space-between' },
  sidebarLogo:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  sidebarLogoIcon:  { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText:  { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive:    { backgroundColor: Colors.redGlow },
  sidebarItemLabel:     { fontSize: 13, fontWeight: '500', color: Colors.muted },
  sidebarLogout:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  sidebarLogoutText:    { fontSize: 13, color: Colors.muted },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row', backgroundColor: Colors.dark2,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10,
  },
  navItem:  { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 10, color: Colors.muted, fontWeight: '500' },
})