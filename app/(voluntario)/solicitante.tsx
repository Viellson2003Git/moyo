
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
import BottomNav from '../../components/BottomNav'
import { useSafeTop } from '../../hooks/useSafeTop'

export default function Solicitante() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [pedidos, setPedidos]     = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<'meus' | 'novo'>('meus')
  const [userId, setUserId]       = useState<string | null>(null)
  const safeTop = useSafeTop()

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)
    }
    init()
  }, [])

  useEffect(() => {
    if (!userId) return

    loadPedidos()

    const canal = supabase
      .channel(`solicitante-${userId}-${Date.now()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'respostas_emergencia',
      }, () => loadPedidos())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pedidos_emergencia',
      }, () => loadPedidos())
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }, [userId])

  async function loadPedidos() {
    if (!userId) return
    setLoading(true)

    const { data } = await supabase
      .from('pedidos_emergencia')
      .select(`
        id, tipo_sanguineo, descricao, morada_aproximada,
        estado, total_aceitaram, max_doadores, created_at,
        respostas_emergencia (
          id, estado,
          voluntarios (
            tipo_sanguineo,
            profiles ( nome, telefone )
          )
        )
      `)
      .eq('solicitante_id', userId)
      .order('created_at', { ascending: false })

    setPedidos(data || [])
    setLoading(false)
  }

  async function mudarEstado(id: string, estado: string) {
    await supabase.from('pedidos_emergencia').update({ estado }).eq('id', id)
    mostrarAlerta(
      estado === 'resolvido' ? '✅ Resolvido!' : 'Pedido cancelado',
      estado === 'resolvido' ? 'Obrigado por actualizar!' : 'O pedido foi cancelado.'
    )
    loadPedidos()
  }

  const estadoCfg: Record<string, { label: string; color: string; bg: string }> = {
    ativo:     { label: 'Activo',    color: Colors.red,   bg: 'rgba(232,23,58,0.12)'  },
    resolvido: { label: 'Resolvido', color: Colors.green, bg: 'rgba(46,204,113,0.12)' },
    cancelado: { label: 'Cancelado', color: Colors.muted, bg: Colors.dark3             },
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  return (
    <View style={s.root}>
      <View style={s.main}>

        <View style={[s.topbar, { paddingTop: safeTop + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>Modo Solicitante</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => router.replace('/(voluntario)' as any)}
          >
            <Feather name="repeat" size={13} color={Colors.white} />
            <Text style={s.switchBtnText}>Modo Doador</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={s.content}>

            <View style={s.tabs}>
              <TouchableOpacity
                style={[s.tab, activeTab === 'meus' && s.tabActive]}
                onPress={() => setActiveTab('meus')}
              >
                <Feather name="list" size={14} color={activeTab === 'meus' ? Colors.white : Colors.muted} />
                <Text style={[s.tabText, activeTab === 'meus' && s.tabTextActive]}>
                  Os meus pedidos ({pedidos.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, activeTab === 'novo' && s.tabActive]}
                onPress={() => router.push('/(auth)/emergencia' as any)}
              >
                <Feather name="plus" size={14} color={Colors.muted} />
                <Text style={s.tabText}>Novo Pedido</Text>
              </TouchableOpacity>
            </View>

            {pedidos.length === 0 ? (
              <View style={s.emptyBox}>
                <Feather name="heart" size={44} color={Colors.muted2} style={{ marginBottom: 14 }} />
                <Text style={s.emptyTitle}>Sem pedidos</Text>
                <Text style={s.emptyText}>
                  Ainda não fizeste nenhum pedido de sangue. Se precisares, cria um novo pedido.
                </Text>
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => router.push('/(auth)/emergencia' as any)}
                >
                  <Text style={s.emptyBtnText}>🩸 Criar Pedido de Emergência</Text>
                </TouchableOpacity>
              </View>
            ) : (
              pedidos.map(p => {
                const cfg = estadoCfg[p.estado] || estadoCfg['ativo']
                const respostas = (p.respostas_emergencia || []) as any[]
                return (
                  <View key={p.id} style={[s.pedidoCard, { borderColor: cfg.color + '30' }]}>

                    <View style={s.pedidoHeader}>
                      <Text style={s.pedidoTipo}>{p.tipo_sanguineo}</Text>
                      <View style={[s.estadoBadge, { backgroundColor: cfg.bg }]}>
                        <View style={[s.estadoDot, { backgroundColor: cfg.color }]} />
                        <Text style={[s.estadoText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>

                    <View style={s.pedidoInfo}>
                      {p.morada_aproximada && (
                        <View style={s.infoRow}>
                          <Feather name="map-pin" size={12} color={Colors.muted} />
                          <Text style={s.infoText}>{p.morada_aproximada}</Text>
                        </View>
                      )}
                      {p.descricao && (
                        <View style={s.infoRow}>
                          <Feather name="file-text" size={12} color={Colors.muted} />
                          <Text style={s.infoText} numberOfLines={2}>{p.descricao}</Text>
                        </View>
                      )}
                      <View style={s.infoRow}>
                        <Feather name="clock" size={12} color={Colors.muted} />
                        <Text style={s.infoText}>
                          {new Date(p.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>

                    <View style={s.respostasSection}>
                      <Text style={s.respostasTitle}>
                        Doadores que responderam ({respostas.length}/3)
                      </Text>
                      {respostas.length === 0 ? (
                        <View style={s.semRespostas}>
                          <ActivityIndicator size="small" color={Colors.muted2} />
                          <Text style={s.semRespostasText}>A aguardar respostas...</Text>
                        </View>
                      ) : (
                        respostas.map((r: any) => (
                          <View key={r.id} style={s.respostaItem}>
                            <View style={s.respostaAvatar}>
                              <Text style={s.respostaAvatarText}>
                                {(r.voluntarios?.profiles?.nome || 'M').slice(0, 1).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.respostaNome}>{r.voluntarios?.profiles?.nome || '—'}</Text>
                              <Text style={{ fontSize: 11, color: Colors.muted }}>
                                Tipo {r.voluntarios?.tipo_sanguineo}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Feather name="phone" size={14} color={Colors.green} />
                              <Text style={s.respostaPhone}>
                                {r.voluntarios?.profiles?.telefone || '—'}
                              </Text>
                            </View>
                          </View>
                        ))
                      )}

                      <View style={s.contador}>
                        {[0, 1, 2].map(i => (
                          <View
                            key={i}
                            style={[s.contadorDot, i < respostas.length && { backgroundColor: Colors.green }]}
                          />
                        ))}
                        <Text style={s.contadorText}>{respostas.length} de 3 doadores</Text>
                      </View>
                    </View>

                    {p.estado === 'ativo' && (
                      <View style={s.pedidoActions}>
                        <TouchableOpacity
                          style={s.btnResolvido}
                          onPress={() => mudarEstado(p.id, 'resolvido')}
                        >
                          <Feather name="check" size={14} color={Colors.dark} />
                          <Text style={s.btnResolvidoText}>Já recebi ajuda!</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.btnCancelar}
                          onPress={() => mudarEstado(p.id, 'cancelado')}
                        >
                          <Text style={s.btnCancelarText}>Cancelar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
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
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.dark },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  main:    { flex: 1 },
  content: { padding: 20, maxWidth: 600, width: '100%', alignSelf: 'center' },

  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  topbarTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
  switchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.dark3, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  switchBtnText: { fontSize: 12, fontWeight: '600', color: Colors.white },

  tabs: {
    flexDirection: 'row', backgroundColor: Colors.dark3,
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 9 },
  tabActive:    { backgroundColor: Colors.red },
  tabText:      { fontSize: 13, fontWeight: '600', color: Colors.muted },
  tabTextActive:{ color: Colors.white },

  pedidoCard: {
    backgroundColor: Colors.dark2, borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1,
  },
  pedidoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pedidoTipo:   { fontSize: 32, fontWeight: '900', color: Colors.redSoft },
  estadoBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoDot:    { width: 6, height: 6, borderRadius: 3 },
  estadoText:   { fontSize: 11, fontWeight: '700' },

  pedidoInfo: { gap: 7, marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  infoRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoText:   { fontSize: 12, color: Colors.muted, flex: 1, lineHeight: 17 },

  respostasSection: { marginBottom: 14 },
  respostasTitle:   { fontSize: 12, fontWeight: '700', color: Colors.muted, marginBottom: 10, letterSpacing: 0.5 },
  semRespostas:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  semRespostasText: { fontSize: 13, color: Colors.muted },

  respostaItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark3, borderRadius: 10, padding: 12, marginBottom: 8 },
  respostaAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  respostaAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  respostaNome:       { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  respostaPhone:      { fontSize: 11, color: Colors.green, fontWeight: '600', marginTop: 2 },

  contador:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  contadorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.dark4 },
  contadorText:{ fontSize: 11, color: Colors.muted, marginLeft: 4 },

  pedidoActions:   { flexDirection: 'row', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  btnResolvido:    { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.green, borderRadius: 10, padding: 11 },
  btnResolvidoText:{ fontSize: 13, fontWeight: '700', color: Colors.dark },
  btnCancelar:     { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnCancelarText: { fontSize: 13, color: Colors.muted },

  emptyBox:    { backgroundColor: Colors.dark2, borderRadius: 16, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptyText:   { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn:    { backgroundColor: Colors.red, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 22 },
  emptyBtnText:{ fontSize: 13, fontWeight: '700', color: Colors.white },
})