// app/(voluntario)/campanhas.tsx
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
import { mostrarAlerta } from '../../utils/alert'
import BottomNavComponent from '../../components/BottomNav'
import { useProvinciaDoUser } from '../../hooks/useProvincia'
import { useAcesso } from '../../hooks/useAcesso'
import { SafeAreaView } from 'react-native-safe-area-context'

type Campanha = {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  data_inicio: string | null
  data_fim: string | null
  meta_doadores: number | null
  total_atingido: number
  tipo_sanguineo: string | null
  publicado: boolean
  bancos_sangue: { nome: string } | null
  ongs: { nome: string } | null
}

export default function Campanhas() {

  const { isApto } = useAcesso()
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900
  const { provinciaId } = useProvinciaDoUser()
  const [campanhas, setCampanhas]       = useState<Campanha[]>([])
  const [pedidosEmerg, setPedidosEmerg] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [filtro, setFiltro]             = useState<'todas' | 'urgente' | 'campanha' | 'noticia'>('todas')
  const [voluntarioId, setVoluntarioId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
  const { data: { session } } = await supabase.auth.getSession()
const user = session?.user
  if (!user) { router.replace('/(auth)/login'); return }

  const { data: vol } = await supabase
    .from('voluntarios').select('id').eq('profile_id', user.id).single()
  if (vol) setVoluntarioId(vol.id)

  const { data: emergData } = await supabase
    .from('pedidos_emergencia')
    .select('id, nome_solicitante, telefone_solicitante, tipo_sanguineo, descricao, morada_aproximada, estado, total_aceitaram, max_doadores, created_at')
    .eq('estado', 'ativo')
    .order('created_at', { ascending: false })
    .limit(5)
  setPedidosEmerg(emergData || [])

  let query = supabase
    .from('campanhas')
    .select('id, titulo, descricao, tipo, data_inicio, data_fim, meta_doadores, total_atingido, tipo_sanguineo, publicado, bancos_sangue(nome), ongs(nome)')
    .eq('publicado', true)

  if (provinciaId) {
    query = query.or(`provincia_id.eq.${provinciaId},e_nacional.eq.true`)
  }

  const { data } = await query.order('created_at', { ascending: false })

  setCampanhas((data as any) || [])
  setLoading(false)
}

  async function aceitarEmergencia(pedidoId: string) {
    if (!voluntarioId) {
      mostrarAlerta('Atenção', 'Precisas de estar ligado para aceitar um pedido.')
      return
    }
    const { error } = await supabase.from('respostas_emergencia').insert({
      pedido_id: pedidoId,
      voluntario_id: voluntarioId,
      estado: 'aceite',
    })
    if (!error) {
      await supabase.rpc('incrementar_aceitaram', { pedido_id: pedidoId })
      mostrarAlerta('✅ Aceite!', 'O teu contacto foi partilhado. Serás contactado em breve.')
      loadData()
    } else if (error.code === '23505') {
      mostrarAlerta('Atenção', 'Já aceitaste este pedido.')
    } else {
      mostrarAlerta('Erro', error.message)
    }
  }

  async function handleParticipar(campanhaId: string) {
    if (!voluntarioId) return
    mostrarAlerta('✅ Inscrito!', 'Foste inscrito nesta campanha. Agenda uma doação para participar.')
  }

  const filtradas = filtro === 'todas' ? campanhas : campanhas.filter(c => c.tipo === filtro)
  const urgentes  = campanhas.filter(c => c.tipo === 'urgente')

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  if (!isApto) return (
  <View style={{ flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
    <Feather name="lock" size={48} color={Colors.muted2} style={{ marginBottom: 16 }} />
    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 10, textAlign: 'center' }}>
      Funcionalidade bloqueada
    </Text>
    <Text style={{ fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: 28 }}>
      Para aceder a campanhas e ONGs, precisas de completar os exames de triagem no hospital.
    </Text>
    <TouchableOpacity
      style={{ backgroundColor: Colors.red, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 }}
      onPress={() => router.push('/(voluntario)/cartao' as any)}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.white }}>Ver o meu QR Code</Text>
    </TouchableOpacity>
    <TouchableOpacity style={{ marginTop: 16 }} onPress={() => router.back()}>
      <Text style={{ fontSize: 13, color: Colors.muted }}>← Voltar</Text>
    </TouchableOpacity>
  </View>
)

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {isWeb && <SidebarWeb />}
      <View style={s.main}>

        <View style={[s.topbar]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>Campanhas & Notícias</Text>
          <View style={{ flex: 1 }} />
          <View style={s.topbarBadge}>
            <Text style={s.topbarBadgeText}>VOLUNTÁRIO</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={s.content}>

            {/* ── PEDIDOS DE EMERGÊNCIA ── */}
            {pedidosEmerg.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 12 }}>
                  🚨 Pedidos de Emergência Activos
                </Text>
                {pedidosEmerg.map(p => (
                  <View key={p.id} style={{
                    backgroundColor: 'rgba(232,23,58,0.08)',
                    borderWidth: 1, borderColor: 'rgba(232,23,58,0.25)',
                    borderRadius: 14, padding: 16, marginBottom: 10,
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ fontSize: 22, fontWeight: '900', color: Colors.redSoft }}>
                        {p.tipo_sanguineo}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.muted }}>
                        {p.total_aceitaram}/{p.max_doadores} doadores
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, color: Colors.white, fontWeight: '600', marginBottom: 4 }}>
                      {p.nome_solicitante}
                    </Text>
                    {p.morada_aproximada && (
                      <Text style={{ fontSize: 12, color: Colors.muted, marginBottom: 4 }}>
                        📍 {p.morada_aproximada}
                      </Text>
                    )}
                    {p.descricao && (
                      <Text style={{ fontSize: 12, color: Colors.muted, marginBottom: 10 }} numberOfLines={2}>
                        {p.descricao}
                      </Text>
                    )}
                    {p.total_aceitaram < p.max_doadores ? (
                      <TouchableOpacity
                        style={{ backgroundColor: Colors.red, borderRadius: 8, padding: 11, alignItems: 'center' }}
                        onPress={() => aceitarEmergencia(p.id)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.white }}>
                          🩸 Quero Ajudar
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ backgroundColor: Colors.dark3, borderRadius: 8, padding: 11, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: Colors.muted }}>✓ Doadores suficientes</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* ── BANNER URGENTE ── */}
            {urgentes.length > 0 && (
              <View style={s.urgentBanner}>
                <View style={s.urgentBannerLeft}>
                  <View style={s.urgentDot} />
                  <View>
                    <Text style={s.urgentBannerTitle}>🚨 Pedido Urgente</Text>
                    <Text style={s.urgentBannerText}>{urgentes[0].titulo}</Text>
                    {urgentes[0].tipo_sanguineo && (
                      <Text style={s.urgentBannerSang}>
                        Tipo sanguíneo: <Text style={{ fontWeight: '800' }}>{urgentes[0].tipo_sanguineo}</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity style={s.urgentBtn} onPress={() => handleParticipar(urgentes[0].id)}>
                  <Text style={s.urgentBtnText}>Ajudar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── FILTROS ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={s.filtrosRow}>
                {([
                  { val: 'todas',    label: 'Todas',     icon: 'grid'         },
                  { val: 'urgente',  label: 'Urgentes',  icon: 'alert-circle' },
                  { val: 'campanha', label: 'Campanhas', icon: 'heart'        },
                  { val: 'noticia',  label: 'Notícias',  icon: 'file-text'    },
                ] as any[]).map(f => (
                  <TouchableOpacity
                    key={f.val}
                    style={[s.filtroBtn, filtro === f.val && s.filtroBtnActive]}
                    onPress={() => setFiltro(f.val)}
                  >
                    <Feather name={f.icon} size={13} color={filtro === f.val ? Colors.white : Colors.muted} />
                    <Text style={[s.filtroBtnText, filtro === f.val && { color: Colors.white }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* ── CARDS ── */}
            {filtradas.length === 0 ? (
              <View style={s.emptyBox}>
                <Feather name="activity" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
                <Text style={s.emptyTitle}>Sem campanhas</Text>
                <Text style={s.emptyText}>Não há campanhas nesta categoria de momento.</Text>
              </View>
            ) : (
              filtradas.map(c => (
                <CampanhaCard key={c.id} campanha={c} onParticipar={() => handleParticipar(c.id)} />
              ))
            )}

          </View>
        </ScrollView>

        {!isWeb && (
          <BottomNavComponent items={[
            { icon: 'grid',        label: 'Início',    route: '/(voluntario)'            },
            { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'     },
            { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'    },
            { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico'  },
            { icon: 'user',        label: 'Perfil',    route: '/(voluntario)/perfil'     },
          ]} />
        )}
      </View>
    </SafeAreaView>
  )
}

function CampanhaCard({ campanha: c, onParticipar }: { campanha: Campanha; onParticipar: () => void }) {
  const isUrgente   = c.tipo === 'urgente'
  const isNoticia   = c.tipo === 'noticia'
  const progresso   = c.meta_doadores ? Math.min((c.total_atingido / c.meta_doadores) * 100, 100) : 0
  const bannerBg    = isUrgente ? '#3d0a10' : isNoticia ? '#0a1a2e' : '#0a2e1a'
  const bannerEmoji = isUrgente ? '🩸' : isNoticia ? '📰' : '❤️'
  const progressCor = isUrgente ? Colors.red : isNoticia ? Colors.blue : Colors.green

  return (
    <View style={s.card}>
      <View style={[s.cardBanner, { backgroundColor: bannerBg }]}>
        <Text style={{ fontSize: 36 }}>{bannerEmoji}</Text>
        {isUrgente && (
          <View style={s.urgentTag}>
            <Text style={s.urgentTagText}>URGENTE</Text>
          </View>
        )}
      </View>
      <View style={s.cardBody}>
        <View style={s.cardTipoRow}>
          <View style={[s.cardTipoBadge, {
            backgroundColor: isUrgente ? Colors.redGlow : isNoticia ? 'rgba(74,158,255,0.1)' : 'rgba(46,204,113,0.1)',
          }]}>
            <Text style={[s.cardTipoText, {
              color: isUrgente ? Colors.redSoft : isNoticia ? Colors.blue : Colors.green
            }]}>
              {isUrgente ? 'Urgente' : isNoticia ? 'Notícia' : 'Campanha'}
            </Text>
          </View>
          {c.tipo_sanguineo && (
            <View style={s.sangBadge}>
              <Text style={s.sangBadgeText}>{c.tipo_sanguineo}</Text>
            </View>
          )}
        </View>
        <Text style={s.cardTitle}>{c.titulo}</Text>
        {c.descricao && <Text style={s.cardDesc}>{c.descricao}</Text>}
        {((c.bancos_sangue as any)?.nome || (c.ongs as any)?.nome) && (
          <View style={s.cardLocal}>
            <Feather name="map-pin" size={11} color={Colors.muted} />
            <Text style={s.cardLocalText}>
              {(c.bancos_sangue as any)?.nome || (c.ongs as any)?.nome}
            </Text>
          </View>
        )}
        {c.meta_doadores && !isNoticia && (
          <View style={{ marginBottom: 12 }}>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${progresso}%` as any, backgroundColor: progressCor }]} />
            </View>
            <View style={s.progressMeta}>
              <Text style={s.progressMetaText}>{c.total_atingido} / {c.meta_doadores} doadores</Text>
              {c.data_fim && (
                <Text style={s.progressMetaText}>
                  até {new Date(c.data_fim).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })}
                </Text>
              )}
            </View>
          </View>
        )}
        {!isNoticia && (
          <TouchableOpacity style={[s.cardBtn, isUrgente && { backgroundColor: Colors.red }]} onPress={onParticipar}>
            <Text style={s.cardBtnText}>
              {isUrgente ? '🩸 Quero Ajudar' : 'Participar na Campanha'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

function SidebarWeb() {
  const items: { icon: keyof typeof Feather.glyphMap; label: string; route: string; active?: boolean }[] = [
    { icon: 'grid',        label: 'Dashboard', route: '/(voluntario)'            },
    { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'     },
    { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'    },
    { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico'  },
    { icon: 'activity',    label: 'Campanhas', route: '/(voluntario)/campanhas', active: true },
    { icon: 'users',       label: 'ONGs',      route: '/(voluntario)/ongs'       },
    { icon: 'book-open',   label: 'Educação',  route: '/(voluntario)/educacao'   },
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
              <Text style={[s.sidebarItemLabel, n.active && { color: Colors.redSoft }]}>{n.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={s.sidebarLogout} onPress={async () => {
        await supabase.auth.signOut()
        router.replace('/(auth)/login')
      }}>
        <Feather name="log-out" size={15} color={Colors.muted} />
        <Text style={s.sidebarLogoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  )
}

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
  topbarBadge:     { backgroundColor: Colors.red, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },

  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(232,23,58,0.1)',
    borderWidth: 1, borderColor: 'rgba(232,23,58,0.3)',
    borderRadius: 14, padding: 16, marginBottom: 16, gap: 12,
  },
  urgentBannerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  urgentDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.red, flexShrink: 0 },
  urgentBannerTitle: { fontSize: 13, fontWeight: '700', color: Colors.redSoft, marginBottom: 2 },
  urgentBannerText:  { fontSize: 12, color: Colors.white, fontWeight: '600' },
  urgentBannerSang:  { fontSize: 11, color: Colors.muted, marginTop: 2 },
  urgentBtn:         { backgroundColor: Colors.red, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  urgentBtnText:     { fontSize: 12, fontWeight: '700', color: Colors.white },

  filtrosRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  filtroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.dark2, borderRadius: 20,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  filtroBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  filtroBtnText:   { fontSize: 13, fontWeight: '600', color: Colors.muted },

  card: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', marginBottom: 14,
  },
  cardBanner:   { height: 100, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  urgentTag:    { position: 'absolute', top: 10, right: 10, backgroundColor: Colors.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  urgentTagText:{ fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
  cardBody:     { padding: 16 },
  cardTipoRow:  { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  cardTipoBadge:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  cardTipoText: { fontSize: 11, fontWeight: '700' },
  sangBadge:    { backgroundColor: Colors.redGlow, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sangBadgeText:{ fontSize: 11, fontWeight: '700', color: Colors.redSoft },
  cardTitle:    { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  cardDesc:     { fontSize: 13, color: Colors.muted, lineHeight: 18, marginBottom: 10 },
  cardLocal:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  cardLocalText:{ fontSize: 12, color: Colors.muted },
  progressBar:  { height: 4, backgroundColor: Colors.dark5, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 4, borderRadius: 4 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  progressMetaText: { fontSize: 11, color: Colors.muted },
  cardBtn: {
    backgroundColor: Colors.dark3, borderRadius: 10, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

  emptyBox: {
    backgroundColor: Colors.dark2, borderRadius: 14, padding: 36, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptyText:  { fontSize: 13, color: Colors.muted, textAlign: 'center' },

  sidebar:              { width: 220, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 18, justifyContent: 'space-between' },
  sidebarLogo:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  sidebarLogoIcon:      { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText:      { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive:    { backgroundColor: Colors.redGlow },
  sidebarItemLabel:     { fontSize: 13, fontWeight: '500', color: Colors.muted },
  sidebarLogout:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  sidebarLogoutText:    { fontSize: 13, color: Colors.muted },
})