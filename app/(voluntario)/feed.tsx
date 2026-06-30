// app/(voluntario)/feed.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, RefreshControl,
  Image, Dimensions, Animated
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import { SafeAreaView } from 'react-native-safe-area-context'

const SCREEN_W = Dimensions.get('window').width

type Post = {
  id: string
  ong_id: string | null
  tipo: string
  titulo: string | null
  conteudo: string
  imagem_url: string | null
  video_url: string | null
  video_thumb: string | null
  e_global: boolean
  total_reacoes: number
  total_views: number
  created_at: string
  ongs?: { nome: string; tipo: string }[] | null
  minhaReacao?: string | null
  jaViu?: boolean
}

const TIPO_CFG: Record<string, { label: string; cor: string; bg: string }> = {
  post:       { label: 'Publicação',  cor: Colors.blue,    bg: 'rgba(74,158,255,0.12)'  },
  anuncio:    { label: 'Anúncio',     cor: Colors.gold,    bg: 'rgba(232,180,75,0.12)'  },
  comunicado: { label: 'Comunicado',  cor: Colors.green,   bg: 'rgba(46,204,113,0.12)'  },
  evento:     { label: 'Evento',      cor: Colors.redSoft, bg: 'rgba(232,23,58,0.12)'   },
  reel:       { label: 'Vídeo',       cor: '#A855F7',      bg: 'rgba(168,85,247,0.12)'  },
}

const REACOES = [
  { tipo: 'like',     emoji: '👍', label: 'Gosto'  },
  { tipo: 'coracao',  emoji: '❤️', label: 'Adoro'  },
  { tipo: 'apoio',    emoji: '🙌', label: 'Apoio'  },
  { tipo: 'surpresa', emoji: '😮', label: 'Uau'    },
]

const ongEmoji: Record<string, string> = {
  associacao: '🏢', religiosa: '⛪', juvenil: '🌍', outro: '🤝',
}

// ── Animated card wrapper ─────────────────────────────────────────
function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity   = useState(new Animated.Value(0))[0]
  const translateY = useState(new Animated.Value(24))[0]
  const scale     = useState(new Animated.Value(0.97))[0]

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, delay: index * 70, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: index * 70, useNativeDriver: true, damping: 14, stiffness: 120 }),
      Animated.spring(scale,      { toValue: 1, delay: index * 70, useNativeDriver: true, damping: 14, stiffness: 120 }),
    ]).start()
  }, [])

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      {children}
    </Animated.View>
  )
}

// ── Componente principal ──────────────────────────────────────────
export default function Feed() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [posts, setPosts]           = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId]         = useState<string | null>(null)
  const [filtro, setFiltro]         = useState<'todos' | 'ongs' | 'anuncios' | 'reels'>('todos')
  const [reacoesPicker, setReacoesPicker] = useState<string | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
const user = session?.user
    if (!user) { router.replace('/(auth)/login'); return }
    setUserId(user.id)
    await loadPosts(user.id)

    const canal = supabase
      .channel(`feed-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publicacoes' },
        () => loadPosts(user.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reacoes' },
        () => loadPosts(user.id))
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }

  async function loadPosts(uid: string) {
    const { data } = await supabase
      .from('publicacoes')
      .select('id, ong_id, tipo, titulo, conteudo, imagem_url, video_url, video_thumb, e_global, total_reacoes, total_views, created_at, ongs(nome, tipo)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!data) { setLoading(false); setRefreshing(false); return }

    const { data: minhasReacoes } = await supabase
      .from('reacoes').select('publicacao_id, tipo').eq('usuario_id', uid)

    const { data: minhasViews } = await supabase
      .from('publicacao_views').select('publicacao_id').eq('usuario_id', uid)

    const reacaoMap = new Map((minhasReacoes || []).map((r: any) => [r.publicacao_id, r.tipo]))
    const viewSet   = new Set((minhasViews || []).map((v: any) => v.publicacao_id))

    setPosts(data.map(p => ({
      ...p,
      ongs: Array.isArray(p.ongs) ? p.ongs : p.ongs ? [p.ongs] : null,
      minhaReacao: reacaoMap.get(p.id) ?? null,
      jaViu: viewSet.has(p.id),
    })) as Post[])

    setLoading(false)
    setRefreshing(false)
  }

  async function registarView(postId: string, jaViu: boolean) {
    if (!userId || jaViu) return
    await supabase.from('publicacao_views')
      .insert({ publicacao_id: postId, usuario_id: userId })
      .then(() => {})
  }

  async function reagir(postId: string, tipo: string, jaReagiu: string | null) {
    if (!userId) return
    setReacoesPicker(null)

    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const delta = jaReagiu === tipo ? -1 : jaReagiu ? 0 : 1
      return {
        ...p,
        minhaReacao: jaReagiu === tipo ? null : tipo,
        total_reacoes: Math.max(0, p.total_reacoes + delta),
      }
    }))

    if (jaReagiu === tipo) {
      await supabase.from('reacoes').delete()
        .eq('publicacao_id', postId).eq('usuario_id', userId)
    } else if (jaReagiu) {
      await supabase.from('reacoes').update({ tipo })
        .eq('publicacao_id', postId).eq('usuario_id', userId)
    } else {
      await supabase.from('reacoes').insert({ publicacao_id: postId, usuario_id: userId, tipo })
    }
  }

  function formatTempo(dateStr: string) {
    const diff  = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const horas = Math.floor(mins / 60)
    const dias  = Math.floor(horas / 24)
    if (mins < 1)   return 'agora'
    if (mins < 60)  return `${mins}m`
    if (horas < 24) return `${horas}h`
    if (dias < 7)   return `${dias}d`
    return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
  }

  function formatViews(n: number) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return `${n}`
  }

  const filtrados = posts.filter(p => {
    if (filtro === 'ongs')     return !!p.ong_id && !p.e_global
    if (filtro === 'anuncios') return p.tipo === 'anuncio' || p.e_global
    if (filtro === 'reels')    return p.tipo === 'reel' || !!p.video_url
    return true
  })

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLogo}>
          <Image
            source={require('../../assets/icon.png')}
            style={s.cartaoLogoImg}
            resizeMode="contain"
          />
          <View>
            <Text style={s.headerTitulo}>
              MO<Text style={{ color: Colors.redSoft }}>YO</Text>
            </Text>
          </View>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/(voluntario)/ongs' as any)}>
            <Feather name="users" size={16} color={Colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => mostrarAlerta('Em breve', 'Pesquisa em breve.')}>
            <Feather name="search" size={16} color={Colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Stories ── */}
      <StoriesRow posts={posts} />

      {/* ── Filtros ── */}
      <View style={s.filtrosWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosScroll}>
          {([
            { val: 'todos',    label: '🌍 Todos'   },
            { val: 'ongs',     label: '🤝 ONGs'    },
            { val: 'anuncios', label: '📢 Anúncios' },
            { val: 'reels',    label: '🎬 Vídeos'  },
          ] as any[]).map(f => (
            <TouchableOpacity
              key={f.val}
              style={[s.chip, filtro === f.val && s.chipActive]}
              onPress={() => setFiltro(f.val)}
            >
              <Text
                numberOfLines={1}
                style={[s.chipText, filtro === f.val && { color: Colors.white }]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Feed ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); if (userId) loadPosts(userId) }}
            tintColor={Colors.red}
          />
        }
        onStartShouldSetResponder={() => {
          if (reacoesPicker) { setReacoesPicker(null); return true }
          return false
        }}
      >
        {filtrados.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📭</Text>
            <Text style={s.emptyTitulo}>Sem publicações</Text>
            <Text style={s.emptySub}>Segue algumas ONGs para veres as publicações aqui.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(voluntario)/ongs' as any)}>
              <Text style={s.emptyBtnText}>Descobrir ONGs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filtrados.map((post, index) => (
            <AnimatedCard key={post.id} index={index}>
              <PostCard
                post={post}
                isWeb={isWeb}
                reacoesPicker={reacoesPicker}
                onVerPost={() => registarView(post.id, post.jaViu ?? false)}
                onReagir={reagir}
                onTogglePicker={(id) => setReacoesPicker(reacoesPicker === id ? null : id)}
                formatTempo={formatTempo}
                formatViews={formatViews}
              />
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      
    </SafeAreaView>
  )
}

// ── Stories row ──────────────────────────────────────────────────
function StoriesRow({ posts }: { posts: Post[] }) {
  const ongs = Array.from(
    new Map(
      posts
        .filter(p => p.ong_id && p.ongs)
        .map(p => [p.ong_id, p.ongs])
    ).entries()
  ).slice(0, 8)

  if (ongs.length === 0) return null

  return (
    <View style={sr.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={sr.item}>
          <View style={[sr.ring, { padding: 2 }]}>
            <View style={[sr.inner, { backgroundColor: Colors.red }]}>
              <Text style={{ fontSize: 18 }}>🩸</Text>
            </View>
          </View>
          <Text style={sr.nome}>Moyo</Text>
        </View>

        {ongs.map(([ongId, ongArr]) => {
          const ong = Array.isArray(ongArr) ? ongArr[0] : ongArr as any
          return (
            <View key={ongId as string} style={sr.item}>
              <View style={sr.ring}>
                <View style={sr.inner}>
                  <Text style={{ fontSize: 18 }}>{ongEmoji[ong?.tipo] || '🤝'}</Text>
                </View>
              </View>
              <Text style={sr.nome} numberOfLines={1}>{ong?.nome?.split(' ')[0] || 'ONG'}</Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const sr = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  item: { alignItems: 'center', marginRight: 14, gap: 5 },
  ring: {
    width: 54, height: 54, borderRadius: 27,
    padding: 2,
    backgroundColor: Colors.red,
  },
  inner: {
    flex: 1, borderRadius: 25,
    backgroundColor: Colors.dark3,
    borderWidth: 2, borderColor: Colors.dark2,
    alignItems: 'center', justifyContent: 'center',
  },
  nome: { fontSize: 10, color: Colors.muted, maxWidth: 56, textAlign: 'center' },
})

// ── Botão de reacção com pulse ────────────────────────────────────
function ReactionButton({
  post, onReagir, onTogglePicker,
}: {
  post: Post
  onReagir: (id: string, tipo: string, jaReagiu: string | null) => void
  onTogglePicker: (id: string) => void
}) {
  const scale = useState(new Animated.Value(1))[0]
  const reacaoActiva = REACOES.find(r => r.tipo === post.minhaReacao)

  function handlePress() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, damping: 6, stiffness: 200 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start()

    if (post.minhaReacao) {
      onReagir(post.id, post.minhaReacao, post.minhaReacao)
    } else {
      onReagir(post.id, 'like', null)
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[pc.reacaoPill, !!reacaoActiva && pc.reacaoPillActiva]}
        onPress={handlePress}
        onLongPress={() => onTogglePicker(post.id)}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14 }}>{reacaoActiva ? reacaoActiva.emoji : '👍'}</Text>
        {post.total_reacoes > 0 && (
          <Text style={[pc.reacaoPillNum, !!reacaoActiva && { color: Colors.redSoft }]}>
            {post.total_reacoes}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Post Card ────────────────────────────────────────────────────
function PostCard({
  post, isWeb, reacoesPicker,
  onVerPost, onReagir, onTogglePicker,
  formatTempo, formatViews,
}: {
  post: Post
  isWeb: boolean
  reacoesPicker: string | null
  onVerPost: () => void
  onReagir: (id: string, tipo: string, jaReagiu: string | null) => void
  onTogglePicker: (id: string) => void
  formatTempo: (d: string) => string
  formatViews: (n: number) => string
}) {
  const cfg     = TIPO_CFG[post.tipo] || TIPO_CFG['post']
  const ongArr  = Array.isArray(post.ongs) ? post.ongs : post.ongs ? [post.ongs] : []
  const ong     = ongArr[0] as any
  const ongNome = ong?.nome
  const ongTipo = ong?.tipo

  return (
    <View style={[pc.card, isWeb && pc.cardWeb]}>

      {/* ── Cabeçalho ── */}
      <View style={pc.headerRow}>
        <View style={[pc.avatarMini, post.e_global && { backgroundColor: Colors.red }]}>
          <Text style={{ fontSize: 15 }}>
            {post.e_global ? '🩸' : (ongEmoji[ongTipo] || '🤝')}
          </Text>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={pc.autorNome} numberOfLines={1}>
              {post.e_global ? 'Moyo' : (ongNome || 'ONG')}
            </Text>
            {post.e_global && (
              <View style={pc.verifiedBadge}>
                <Feather name="check" size={8} color="#fff" />
              </View>
            )}
          </View>
          <Text style={pc.tempo}>{formatTempo(post.created_at)} atrás</Text>
        </View>

        <View style={[pc.tipoBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[pc.tipoText, { color: cfg.cor }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* ── Conteúdo ── */}
      {post.titulo && <Text style={pc.titulo}>{post.titulo}</Text>}
      <Text style={pc.conteudo}>{post.conteudo}</Text>

      {/* ── Imagem full-bleed ── */}
      {post.imagem_url && !post.video_url && (
        <View style={pc.mediaWrap}>
          <Image
            source={{ uri: post.imagem_url }}
            style={pc.midia}
            resizeMode="cover"
            onLoadStart={onVerPost}
          />
        </View>
      )}

      {/* ── Vídeo ── */}
      {post.video_url && (
        <View style={pc.videoWrap}>
          {Platform.OS === 'web' ? (
            // @ts-ignore
            <video
              controls
              style={{ width: '100%', maxHeight: 340, backgroundColor: '#000', display: 'block', borderRadius: 0 } as any}
              src={post.video_url}
              poster={post.video_thumb ?? undefined}
            />
          ) : (
            <VideoThumb url={post.video_url} thumb={post.video_thumb} />
          )}
        </View>
      )}

      {/* ── Evento ── */}
      {post.tipo === 'evento' && (
        <View style={pc.eventoCard}>
          <Text style={{ fontSize: 26 }}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={pc.eventoData}>Sábado, 14 Jun · 09:00</Text>
            <Text style={pc.eventoLocal}>📍 Hospital Geral de Luanda</Text>
          </View>
          <View style={pc.eventoGratis}>
            <Text style={pc.eventoGratisText}>Gratuito</Text>
          </View>
        </View>
      )}

      {/* ── Meta row ── */}
      <View style={pc.metaRow}>
        <ReactionButton
          post={post}
          onReagir={onReagir}
          onTogglePicker={onTogglePicker}
        />

        {post.e_global && (
          <View style={pc.globalBadge}>
            <Feather name="globe" size={9} color={Colors.redSoft} />
            <Text style={pc.globalBadgeText}>Global</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        <View style={pc.viewsRow}>
          <Feather name="eye" size={11} color={Colors.muted2} />
          <Text style={pc.viewsText}>{formatViews(post.total_views)}</Text>
        </View>

        <TouchableOpacity
          style={pc.shareBtn}
          onPress={() => {
            if (Platform.OS === 'web' && (navigator as any).share) {
              ;(navigator as any).share({ title: post.titulo || 'Moyo', text: post.conteudo })
            } else {
              mostrarAlerta('Em breve', 'Partilha em breve.')
            }
          }}
        >
          <Feather name="corner-up-right" size={14} color={Colors.muted} />
        </TouchableOpacity>

        {/* Picker de reacções (long press) */}
        {reacoesPicker === post.id && (
          <View style={pc.picker}>
            {REACOES.map(r => (
              <TouchableOpacity
                key={r.tipo}
                style={[pc.pickerBtn, post.minhaReacao === r.tipo && pc.pickerBtnActivo]}
                onPress={() => onReagir(post.id, r.tipo, post.minhaReacao ?? null)}
              >
                <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                <Text style={pc.pickerLabel}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Bottom actions ── */}
      <View style={pc.actionsRow}>
        <TouchableOpacity
          style={pc.actionBtn}
          onPress={() => {
            if (post.minhaReacao) {
              onReagir(post.id, post.minhaReacao, post.minhaReacao)
            } else {
              onReagir(post.id, 'like', null)
            }
          }}
        >
          <Text style={{ fontSize: 13 }}>
            {REACOES.find(r => r.tipo === post.minhaReacao)?.emoji || '🤍'}
          </Text>
          <Text style={pc.actionText}>
            {REACOES.find(r => r.tipo === post.minhaReacao)?.label || 'Reagir'}
          </Text>
        </TouchableOpacity>

        <View style={pc.actionDivider} />

        <TouchableOpacity
          style={pc.actionBtn}
          onPress={() => {
            if (Platform.OS === 'web' && (navigator as any).share) {
              ;(navigator as any).share({ title: post.titulo || 'Moyo', text: post.conteudo })
            } else {
              mostrarAlerta('Em breve', 'Partilha em breve.')
            }
          }}
        >
          <Feather name="corner-up-right" size={14} color={Colors.muted} />
          <Text style={pc.actionText}>Partilhar</Text>
        </TouchableOpacity>
      </View>

    </View>
  )
}

// ── Video thumbnail ───────────────────────────────────────────────
function VideoThumb({ url, thumb }: { url: string; thumb?: string | null }) {
  const scale = useState(new Animated.Value(1))[0]

  function handlePress() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, damping: 6 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, damping: 10 }),
    ]).start(() => mostrarAlerta('Em breve', 'Player de vídeo em breve.'))
  }

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress} style={{ position: 'relative' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={{ width: '100%', height: 240 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: '100%', height: 200, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="video" size={36} color={Colors.muted2} />
          </View>
        )}
        <View style={vt.playBtn}>
          <Feather name="play" size={22} color={Colors.white} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

const vt = StyleSheet.create({
  playBtn: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginTop: -28, marginLeft: -28,
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
})

// ── Estilos ────────────────────────────────────────────────────────
const s = StyleSheet.create({

  root:   { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },

  header: {
    backgroundColor: Colors.dark,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },

  cartaoLogoImg: {
    width: 28, height: 28,
  },
  headerLogo:     { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerLogoIcon: {
    width: 36, height: 36, backgroundColor: Colors.red,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  headerTitulo:   { fontSize: 18, fontWeight: '800', color: Colors.white, letterSpacing: -0.5 },
  headerActions:  { flexDirection: 'row', gap: 8 },
  headerBtn: {
    width: 34, height: 34, backgroundColor: Colors.dark3,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  filtrosWrap:   { backgroundColor: Colors.dark, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  filtrosScroll: { paddingHorizontal: 12, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 50,
    backgroundColor: Colors.dark3, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', marginRight: 8,
  },
  chipActive:  { backgroundColor: Colors.red, borderColor: Colors.red },
  chipText:    { fontSize: 12, fontWeight: '600', color: Colors.muted },

  emptyBox:     { alignItems: 'center', padding: 60 },
  emptyTitulo:  { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptySub:     { fontSize: 14, color: Colors.muted, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emptyBtn:     { backgroundColor: Colors.red, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
})

const pc = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: Colors.dark2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  cardWeb: { maxWidth: 500, alignSelf: 'center', width: '100%' },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, paddingBottom: 10,
  },
  avatarMini: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: Colors.dark3,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  autorNome:     { fontSize: 14, fontWeight: '700', color: Colors.white },
  verifiedBadge: {
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: Colors.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  tempo:         { fontSize: 11, color: Colors.muted2, marginTop: 1 },
  tipoBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  tipoText:      { fontSize: 10, fontWeight: '700' },

  titulo: {
    fontSize: 16, fontWeight: '800', color: Colors.white,
    paddingHorizontal: 14, marginBottom: 5, lineHeight: 22,
  },
  conteudo: {
    fontSize: 14, color: 'rgba(255,255,255,0.82)',
    lineHeight: 22, paddingHorizontal: 14, paddingBottom: 12,
  },

  

  mediaWrap: { overflow: 'hidden' },
  midia:     { width: '100%', height: 220 },
  videoWrap: { backgroundColor: '#000', overflow: 'hidden' },

  eventoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 14, marginBottom: 12,
    backgroundColor: Colors.dark3, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  eventoData:      { fontSize: 14, fontWeight: '700', color: Colors.white },
  eventoLocal:     { fontSize: 12, color: Colors.muted, marginTop: 3 },
  eventoGratis:    { backgroundColor: 'rgba(46,204,113,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  eventoGratisText:{ fontSize: 11, fontWeight: '700', color: Colors.green },

  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8, gap: 8,
    position: 'relative',
  },

  reacaoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50,
    backgroundColor: Colors.dark3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  reacaoPillActiva: {
    backgroundColor: 'rgba(232,23,58,0.12)',
    borderColor: 'rgba(232,23,58,0.3)',
  },
  reacaoPillNum: { fontSize: 13, fontWeight: '700', color: Colors.muted },

  globalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.redGlow,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
  },
  globalBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.redSoft },

  viewsRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText: { fontSize: 12, color: Colors.muted2 },

  shareBtn: {
    width: 34, height: 34, borderRadius: 50,
    backgroundColor: Colors.dark3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },

  picker: {
    position: 'absolute', bottom: 46, left: 0,
    flexDirection: 'row', gap: 4,
    backgroundColor: Colors.dark2,
    borderRadius: 50, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6, shadowRadius: 20,
    elevation: 20, zIndex: 999,
  },
  pickerBtn:      { alignItems: 'center', padding: 8, borderRadius: 12, minWidth: 50 },
  pickerBtnActivo:{ backgroundColor: Colors.redGlow },
  pickerLabel:    { fontSize: 9, color: Colors.muted, marginTop: 4 },

  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: 4,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 11,
  },
  actionDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 8 },
  actionText:    { fontSize: 13, fontWeight: '600', color: Colors.muted },
})