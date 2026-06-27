// app/(voluntario)/feed.tsx
import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, TextInput, Image, RefreshControl
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import BottomNav from '../../components/BottomNav'
import { useSafeTop } from '../../hooks/useSafeTop'
type Post = {
  id: string
  ong_id: string | null
  tipo: string
  titulo: string | null
  conteudo: string
  imagem_url: string | null
  e_global: boolean
  total_reacoes: number
  created_at: string
  ongs?: { nome: string; tipo: string } | null
  minhaReacao: string | null
}

const TIPO_CFG: Record<string, { label: string; cor: string; icon: string; bg: string }> = {
  post:       { label: 'Publicação',  cor: Colors.blue,    icon: '📝', bg: 'rgba(74,158,255,0.1)'   },
  anuncio:    { label: 'Anúncio',     cor: Colors.gold,    icon: '📢', bg: 'rgba(232,180,75,0.1)'   },
  comunicado: { label: 'Comunicado',  cor: Colors.green,   icon: '📋', bg: 'rgba(46,204,113,0.1)'   },
  evento:     { label: 'Evento',      cor: Colors.redSoft, icon: '🗓️', bg: 'rgba(232,23,58,0.1)'    },
}

const REACAO_EMOJIS = [
  { tipo: 'like',    emoji: '👍', label: 'Gosto' },
  { tipo: 'coracao', emoji: '❤️', label: 'Adoro' },
  { tipo: 'apoio',   emoji: '🙌', label: 'Apoio' },
]

export default function Feed() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900
  const safeTop = useSafeTop()
  const [posts, setPosts]         = useState<Post[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId]       = useState<string | null>(null)
  const [voluntarioId, setVoluntarioId] = useState<string | null>(null)
  const [filtro, setFiltro]       = useState<'todos' | 'ongs' | 'anuncios'>('todos')
  const [mostrandoReacoes, setMostrandoReacoes] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }
    setUserId(user.id)
    const { data: vol } = await supabase.from('voluntarios').select('id').eq('profile_id', user.id).single()
    if (vol) setVoluntarioId(vol.id)
    await loadPosts(user.id)

    // Realtime — novos posts aparecem automaticamente
    const canal = supabase
      .channel(`feed-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'publicacoes' }, () => loadPosts(user.id))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'publicacoes' }, () => loadPosts(user.id))
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }

  async function loadPosts(uid?: string) {
    const id = uid || userId
    if (!id) return

    const { data } = await supabase
      .from('publicacoes')
      .select('id, ong_id, tipo, titulo, conteudo, imagem_url, e_global, total_reacoes, created_at, ongs(nome, tipo)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) { setLoading(false); setRefreshing(false); return }

    // Busca as minhas reações
    const { data: minhasReacoes } = await supabase
      .from('reacoes')
      .select('publicacao_id, tipo')
      .eq('usuario_id', id)

    const reacaoMap = new Map((minhasReacoes || []).map((r: any) => [r.publicacao_id, r.tipo]))

    const lista = data.map(p => ({
        ...p,
        ongs: Array.isArray(p.ongs) ? p.ongs : p.ongs ? [p.ongs] : null,
        minhaReacao: reacaoMap.get(p.id) ?? null, 
    })) as Post[]

    setPosts(lista)
    setLoading(false)
    setRefreshing(false)
  }

  async function reagir(postId: string, tipo: string, jaReagiu: string | null) {
    if (!userId) return
    setMostrandoReacoes(null)

    if (jaReagiu === tipo) {
      // Remove reação
      await supabase.from('reacoes').delete().eq('publicacao_id', postId).eq('usuario_id', userId)
    } else if (jaReagiu) {
      // Muda reação
      await supabase.from('reacoes').update({ tipo }).eq('publicacao_id', postId).eq('usuario_id', userId)
    } else {
      // Nova reação
      await supabase.from('reacoes').insert({ publicacao_id: postId, usuario_id: userId, tipo })
    }

    // Actualiza localmente sem recarregar tudo
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const delta = jaReagiu === tipo ? -1 : jaReagiu ? 0 : 1
      return { ...p, minhaReacao: jaReagiu === tipo ? null : tipo, total_reacoes: Math.max(0, p.total_reacoes + delta) }
    }))
  }

  function formatTempo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const horas = Math.floor(mins / 60)
    const dias  = Math.floor(horas / 24)
    if (mins < 1)   return 'agora'
    if (mins < 60)  return `${mins}m`
    if (horas < 24) return `${horas}h`
    if (dias < 7)   return `${dias}d`
    return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
  }

  const tipoEmoji: Record<string, string> = { associacao: '🏢', religiosa: '⛪', juvenil: '🌍', outro: '🤝' }

  const filtrados = posts.filter(p => {
    if (filtro === 'ongs') return !!p.ong_id && !p.e_global
    if (filtro === 'anuncios') return p.tipo === 'anuncio' || p.e_global
    return true
  })

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  return (
    <View style={s.root}>
      {isWeb && <SidebarWeb />}
      <View style={s.main}>

        <View style={[s.topbar, { paddingTop: safeTop + 8 }]}>
          <Text style={s.topbarLogo}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
          <Text style={s.topbarTitle}>Feed</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => router.push('/(voluntario)/ongs' as any)} style={s.topbarBtn}>
            <Feather name="users" size={16} color={Colors.muted} />
            <Text style={s.topbarBtnText}>Seguir ONGs</Text>
          </TouchableOpacity>
        </View>

        {/* Filtros */}
        <View style={s.filtrosRow}>
          {[
            { val: 'todos',    label: '🌍 Tudo' },
            { val: 'ongs',     label: '🤝 ONGs' },
            { val: 'anuncios', label: '📢 Anúncios' },
          ].map(f => (
            <TouchableOpacity
              key={f.val}
              style={[s.filtroBtn, filtro === f.val && s.filtroBtnActive]}
              onPress={() => setFiltro(f.val as any)}
            >
              <Text style={[s.filtroBtnText, filtro === f.val && { color: Colors.white }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadPosts() }}
              tintColor={Colors.red}
            />
          }
        >
          <View style={s.content}>

            {filtrados.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize: 40, marginBottom: 14 }}>📭</Text>
                <Text style={s.emptyTitle}>Sem publicações</Text>
                <Text style={s.emptyText}>
                  Segue algumas ONGs para veres as publicações delas aqui.
                </Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(voluntario)/ongs' as any)}>
                  <Text style={s.emptyBtnText}>Descobrir ONGs</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filtrados.map(post => {
                const cfg = TIPO_CFG[post.tipo] || TIPO_CFG['post']
                const ongNome = (post.ongs as any)?.nome
                const ongTipo = (post.ongs as any)?.tipo
                const reacaoActiva = REACAO_EMOJIS.find(r => r.tipo === post.minhaReacao)

                return (
                  <View key={post.id} style={s.postCard}>

                    {/* Header */}
                    <View style={s.postHeader}>
                      <View style={[s.postAvatar, { backgroundColor: post.e_global ? Colors.redGlow : Colors.dark3 }]}>
                        <Text style={{ fontSize: 18 }}>
                          {post.e_global ? '🩸' : (tipoEmoji[ongTipo] || '🤝')}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.postAutor}>
                          {post.e_global ? 'Moyo — Equipa' : (ongNome || 'ONG')}
                        </Text>
                        <View style={s.postMetaRow}>
                          <View style={[s.postTipoBadge, { backgroundColor: cfg.bg }]}>
                            <Text style={[s.postTipoText, { color: cfg.cor }]}>{cfg.icon} {cfg.label}</Text>
                          </View>
                          <Text style={s.postTempo}>{formatTempo(post.created_at)}</Text>
                        </View>
                      </View>
                      {post.e_global && (
                        <View style={s.globalBadge}>
                          <Feather name="globe" size={10} color={Colors.redSoft} />
                          <Text style={s.globalBadgeText}>Global</Text>
                        </View>
                      )}
                    </View>

                    {/* Conteúdo */}
                    {post.titulo && <Text style={s.postTitulo}>{post.titulo}</Text>}
                    <Text style={s.postConteudo}>{post.conteudo}</Text>

                    {/* Imagem se existir */}
                    {post.imagem_url && (
                      <View style={s.postImagem}>
                        <Image
                          source={{ uri: post.imagem_url }}
                          style={s.postImagemImg}
                          resizeMode="cover"
                        />
                      </View>
                    )}

                    {/* Reações */}
                    <View style={s.postFooter}>
                      {/* Contador de reações */}
                      <Text style={s.postReacoesCount}>
                        {post.total_reacoes > 0 ? `${post.total_reacoes} reacção${post.total_reacoes > 1 ? 'ões' : ''}` : ''}
                      </Text>

                      <View style={s.postAcoes}>
                        {/* Botão de reagir */}
                        <View style={{ position: 'relative' }}>
                          <TouchableOpacity
                            style={[s.btnReagir, reacaoActiva && { backgroundColor: reacaoActiva ? Colors.redGlow : Colors.dark3 }]}
                            
                            onPress={() => {
                              if (post.minhaReacao) {
                                // Remove directamente se já reagiu
                                reagir(post.id, post.minhaReacao, post.minhaReacao)
                              } else {
                                setMostrandoReacoes(mostrandoReacoes === post.id ? null : post.id)
                              }
                            }}

                            onLongPress={() => setMostrandoReacoes(mostrandoReacoes === post.id ? null : post.id)}
                          >
                            <Text style={{ fontSize: 14 }}>
                              {reacaoActiva ? reacaoActiva.emoji : '👍'}
                            </Text>
                            <Text style={[s.btnReagirText, reacaoActiva && { color: Colors.redSoft }]}>
                              {reacaoActiva ? reacaoActiva.label : 'Reagir'}
                            </Text>
                          </TouchableOpacity>

                          {/* Picker de reações */}
                          {mostrandoReacoes === post.id && (
                            <View style={s.reacoesPicker}>
                              {REACAO_EMOJIS.map(r => (
                                <TouchableOpacity
                                  key={r.tipo}
                                  style={[s.reacaoPickerBtn, post.minhaReacao === r.tipo && s.reacaoPickerBtnActive]}

                                  onPress={() => {
                                    if (post.minhaReacao) {
                                        reagir(post.id, post.minhaReacao, post.minhaReacao ?? null)
                                    } else {
                                        setMostrandoReacoes(mostrandoReacoes === post.id ? null : post.id)
                                    }
                                    }}
                                    onLongPress={() => setMostrandoReacoes(mostrandoReacoes === post.id ? null : post.id)}
                                >
                                  <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                                  <Text style={s.reacaoPickerLabel}>{r.label}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>

                        {/* Partilhar */}
                        <TouchableOpacity style={s.btnReagir} onPress={() => mostrarAlerta('Em breve', 'Partilhar em breve.')}>
                          <Feather name="share-2" size={14} color={Colors.muted} />
                          <Text style={s.btnReagirText}>Partilhar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        </ScrollView>

        {!isWeb && (
          <BottomNav items={[
            { icon: 'grid',        label: 'Início',    route: '/(voluntario)'           },
            { icon: 'rss',         label: 'Feed',      route: '/(voluntario)/feed'      },
            { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'   },
            { icon: 'users',       label: 'ONGs',      route: '/(voluntario)/ongs'      },
            { icon: 'user',        label: 'Perfil',    route: '/(voluntario)/perfil'    },
          ]} />
        )}
      </View>
    </View>
  )
}

function SidebarWeb() {
  return (
    <View style={s.sidebar}>
      <View>
        <View style={s.sidebarLogo}>
          <View style={s.sidebarLogoIcon}>
            <Text style={{ color: Colors.white, fontWeight: '800' }}>M</Text>
          </View>
          <Text style={s.sidebarLogoText}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
        </View>
        {([
          { icon: 'grid', label: 'Dashboard', route: '/(voluntario)' },
          { icon: 'rss', label: 'Feed', route: '/(voluntario)/feed', active: true },
          { icon: 'credit-card', label: 'Cartão', route: '/(voluntario)/cartao' },
          { icon: 'calendar', label: 'Agendar', route: '/(voluntario)/agendar' },
          { icon: 'activity', label: 'Campanhas', route: '/(voluntario)/campanhas' },
          { icon: 'users', label: 'ONGs', route: '/(voluntario)/ongs' },
          { icon: 'book-open', label: 'Educação', route: '/(voluntario)/educacao' },
        ] as any[]).map(n => (
          <TouchableOpacity key={n.label} style={[s.sidebarItem, n.active && s.sidebarItemActive]} onPress={() => router.push(n.route)}>
            <Feather name={n.icon} size={15} color={n.active ? Colors.redSoft : Colors.muted} />
            <Text style={[s.sidebarLabel, n.active && { color: Colors.redSoft }]}>{n.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={async () => { await supabase.auth.signOut(); router.replace('/(auth)/landing' as any) }} style={s.sidebarItem}>
        <Feather name="log-out" size={15} color={Colors.muted} />
        <Text style={s.sidebarLabel}>Sair</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  main: { flex: 1 },
  content: { padding: 16, maxWidth: 680, width: '100%', alignSelf: 'center' },

  topbar: { height: 56, backgroundColor: Colors.dark2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  topbarLogo: { fontSize: 18, fontWeight: '800', color: Colors.white },
  topbarTitle: { fontSize: 15, fontWeight: '600', color: Colors.muted },
  topbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.dark3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  topbarBtnText: { fontSize: 12, fontWeight: '600', color: Colors.muted },

  filtrosRow: { flexDirection: 'row', gap: 0, backgroundColor: Colors.dark2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  filtroBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  filtroBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.red },
  filtroBtnText: { fontSize: 13, fontWeight: '600', color: Colors.muted },

  postCard: { backgroundColor: Colors.dark2, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  postHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingBottom: 12 },
  postAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  postAutor: { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postTipoBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  postTipoText: { fontSize: 11, fontWeight: '700' },
  postTempo: { fontSize: 11, color: Colors.muted2 },
  globalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.redGlow, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  globalBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.redSoft },

  postTitulo: { fontSize: 16, fontWeight: '800', color: Colors.white, paddingHorizontal: 16, marginBottom: 6 },
  postConteudo: { fontSize: 14, color: Colors.white, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 12 },
  postImagem: { marginHorizontal: 0, marginBottom: 12 },
  postImagemImg: { width: '100%', height: 220 },

  postFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 10 },
  postReacoesCount: { fontSize: 11, color: Colors.muted, marginBottom: 8 },
  postAcoes: { flexDirection: 'row', gap: 8 },

  btnReagir: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.dark3, borderRadius: 8, padding: 9 },
  btnReagirText: { fontSize: 13, fontWeight: '600', color: Colors.muted },

  reacoesPicker: {
    position: 'absolute', bottom: 44, left: 0,
    flexDirection: 'row', gap: 8,
    backgroundColor: Colors.dark2,
    borderRadius: 16, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10,
    elevation: 10, zIndex: 100,
  },
  reacaoPickerBtn: { alignItems: 'center', padding: 8, borderRadius: 10 },
  reacaoPickerBtnActive: { backgroundColor: Colors.redGlow },
  reacaoPickerLabel: { fontSize: 10, color: Colors.muted, marginTop: 4 },

  emptyBox: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.red, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  sidebar: { width: 220, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 18, justifyContent: 'space-between' },
  sidebarLogo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  sidebarLogoIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText: { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive: { backgroundColor: Colors.redGlow },
  sidebarLabel: { fontSize: 13, fontWeight: '500', color: Colors.muted },
})