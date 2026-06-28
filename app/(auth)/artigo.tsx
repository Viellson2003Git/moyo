// app/(auth)/artigo.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, useWindowDimensions
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { ARTIGOS } from '../../data/artigos'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Artigo() {
  const params = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 768

  const artigo = ARTIGOS.find(a => a.id === params.id)
  const [showVideo, setShowVideo] = useState(false)

  if (!artigo) return (
    <View style={s.center}>
      <Text style={{ color: Colors.muted }}>Artigo não encontrado</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: Colors.redSoft }}>← Voltar</Text>
      </TouchableOpacity>
    </View>
  )

  return (
     <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: artigo.cor + '30' }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <View style={[s.tagBadge, { backgroundColor: artigo.bg }]}>
          <Text style={[s.tagText, { color: artigo.cor }]}>{artigo.tag}</Text>
        </View>
        <Text style={s.tempo}>⏱ {artigo.tempo}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, isWeb && s.scrollWeb]}
      >
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: artigo.bg }]}>
          <Text style={s.heroEmoji}>{artigo.emoji}</Text>
          <Text style={s.heroTitulo}>{artigo.titulo}</Text>
          <Text style={s.heroResumo}>{artigo.resumo}</Text>
        </View>

        <View style={[s.content, isWeb && s.contentWeb]}>

          {/* Secções do artigo */}
          {artigo.seccoes.map((sec, i) => {
            if (sec.tipo === 'intro') return (
              <Text key={i} style={s.intro}>{sec.conteudo}</Text>
            )

            if (sec.tipo === 'topicos') return (
              <View key={i} style={s.seccao}>
                {sec.titulo && <Text style={s.seccaoTitulo}>{sec.titulo}</Text>}
                {(sec.items || []).map((item, j) => (
                  <View key={j} style={s.topicoItem}>
                    <View style={[s.topicoDot, { backgroundColor: artigo.cor }]} />
                    <Text style={s.topicoText}>{item}</Text>
                  </View>
                ))}
              </View>
            )

            if (sec.tipo === 'lista') return (
              <View key={i} style={s.seccao}>
                {sec.titulo && <Text style={s.seccaoTitulo}>{sec.titulo}</Text>}
                {(sec.items || []).map((item, j) => (
                  <View key={j} style={[s.listaItem, { borderLeftColor: artigo.cor }]}>
                    <Text style={s.listaItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )

            if (sec.tipo === 'aviso') return (
              <View key={i} style={[s.avisoBox, { borderColor: 'rgba(232,180,75,0.3)', backgroundColor: 'rgba(232,180,75,0.07)' }]}>
                <Text style={{ fontSize: 20 }}>⚠️</Text>
                <Text style={s.avisoText}>{sec.conteudo}</Text>
              </View>
            )

            if (sec.tipo === 'dica') return (
              <View key={i} style={[s.dicaBox, { borderColor: artigo.cor + '40', backgroundColor: artigo.bg }]}>
                {sec.titulo && <Text style={[s.dicaTitulo, { color: artigo.cor }]}>{sec.titulo}</Text>}
                <Text style={s.dicaConteudo}>{sec.conteudo}</Text>
              </View>
            )

            return null
          })}

          {/* Vídeo — mostra se tiver URL, senão mostra placeholder */}
          <View style={s.videoSeccao}>
            <Text style={s.videoSeccaoTitulo}>🎬 Vídeo explicativo</Text>
            {artigo.videoUrl ? (
              Platform.OS === 'web' ? (
                // @ts-ignore
                <video
                  controls
                  style={{ width: '100%', borderRadius: 12, backgroundColor: '#000', marginTop: 8 } as any}
                  src={artigo.videoUrl}
                />
              ) : (
                (() => {
                  try {
                    const { WebView } = require('react-native-webview')
                    const embedUrl = artigo.videoUrl!.includes('youtube')
                      ? artigo.videoUrl!.replace('watch?v=', 'embed/')
                      : artigo.videoUrl
                    return (
                      <View style={s.videoPlayer}>
                        <WebView
                          source={{ uri: embedUrl! }}
                          style={{ flex: 1 }}
                          javaScriptEnabled
                          allowsFullscreenVideo
                        />
                      </View>
                    )
                  } catch {
                    return null
                  }
                })()
              )
            ) : (
              <View style={s.videoPlaceholder}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🎬</Text>
                <Text style={s.videoPlaceholderTitulo}>Vídeo em breve</Text>
                <Text style={s.videoPlaceholderSub}>
                  Estamos a preparar um vídeo ilustrativo sobre este tema.
                </Text>
              </View>
            )}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.cta, { backgroundColor: artigo.cor }]}
            onPress={() => router.push('/(auth)/cadastro' as any)}
          >
            <Text style={s.ctaText}>🩸 Quero ser doador</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: Colors.dark2,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  tagBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagText:  { fontSize: 12, fontWeight: '700' },
  tempo:    { fontSize: 12, color: Colors.muted, marginLeft: 'auto' as any },

  scroll:    { flexGrow: 1 },
  scrollWeb: { maxWidth: 720, alignSelf: 'center' as any, width: '100%' },

  hero: { padding: 28, alignItems: 'center' },
  heroEmoji:  { fontSize: 52, marginBottom: 14 },
  heroTitulo: { fontSize: 24, fontWeight: '800', color: Colors.white, textAlign: 'center', marginBottom: 10, lineHeight: 32 },
  heroResumo: { fontSize: 15, color: Colors.muted, textAlign: 'center', lineHeight: 22 },

  content:    { padding: 20 },
  contentWeb: { padding: 32 },

  intro: { fontSize: 16, color: Colors.white, lineHeight: 26, marginBottom: 24, opacity: 0.9 },

  seccao: { marginBottom: 24 },
  seccaoTitulo: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 14 },

  topicoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  topicoDot:  { width: 7, height: 7, borderRadius: 4, marginTop: 7, flexShrink: 0 },
  topicoText: { flex: 1, fontSize: 14, color: Colors.muted, lineHeight: 21 },

  listaItem: {
    borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 10,
    marginBottom: 10, backgroundColor: Colors.dark2, borderRadius: 8,
  },
  listaItemText: { fontSize: 14, color: Colors.muted, lineHeight: 20 },

  avisoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 20,
  },
  avisoText: { flex: 1, fontSize: 13, color: Colors.muted, lineHeight: 19 },

  dicaBox: {
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 20,
  },
  dicaTitulo:   { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  dicaConteudo: { fontSize: 13, color: Colors.muted, lineHeight: 19 },

  videoSeccao: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  videoSeccaoTitulo: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 14 },
  videoPlayer:       { height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  videoPlaceholder: {
    height: 180, backgroundColor: Colors.dark3, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
  },
  videoPlaceholderTitulo: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  videoPlaceholderSub:    { fontSize: 12, color: Colors.muted, textAlign: 'center', paddingHorizontal: 20 },

  cta: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  ctaText: { fontSize: 16, fontWeight: '800', color: Colors.white },
})