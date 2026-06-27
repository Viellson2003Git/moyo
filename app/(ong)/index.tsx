// app/(ong)/index.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  TextInput, useWindowDimensions, Modal
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta, confirmar } from '../../utils/alert'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSafeTop } from '../../hooks/useSafeTop'
import { obterLocalizacao } from '../../utils/location'

type Aba = 'dashboard' | 'membros' | 'campanhas' | 'documentos' | 'perfil' | 'publicacoes' | 'adicionar'

export default function OngDashboard() {

  const [showAddMembro, setShowAddMembro] = useState(false)
  const [searchSerial, setSearchSerial]   = useState('')
  const [searchResult, setSearchResult]   = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [adicionando, setAdicionando]     = useState(false)
  const safeTop = useSafeTop()
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [ong, setOng]             = useState<any>(null)
  const [membros, setMembros]     = useState<any[]>([])
  const [campanhas, setCampanhas] = useState<any[]>([])
  const [notifs, setNotifs]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [aba, setAba]             = useState<Aba>('dashboard')
  const [membroSel, setMembroSel] = useState<any>(null)
  const [showNovaCampanha, setShowNovaCampanha] = useState(false)

  // Perfil — estados editáveis
  const [nome, setNome]                     = useState('')
  const [descricao, setDescricao]           = useState('')
  const [telefone, setTelefone]             = useState('')
  const [email, setEmail]                   = useState('')
  const [municipio, setMunicipio]           = useState('')
  const [responsavelNome, setResponsavelNome] = useState('')
  const [latitude, setLatitude]             = useState('')
  const [longitude, setLongitude]           = useState('')
  const [salvando, setSalvando]             = useState(false)
  const [locLoading, setLocLoading]         = useState(false)

  // Nova campanha
  const [campTitulo, setCampTitulo]         = useState('')
  const [campDescricao, setCampDescricao]   = useState('')
  const [campTipo, setCampTipo]             = useState('campanha')
  const [campTipoSang, setCampTipoSang]     = useState('')
  const [campMeta, setCampMeta]             = useState('')
  const [campDataFim, setCampDataFim]       = useState('')
  const [criandoCamp, setCriandoCamp]       = useState(false)

  const [videoUri, setVideoUri]     = useState<string | null>(null)
  const [videoNome, setVideoNome]   = useState<string | null>(null)
  const [uploadando, setUploadando] = useState(false)

  const [publicacoes, setPublicacoes]       = useState<any[]>([])
  const [showNovaPublicacao, setShowNovaPublicacao] = useState(false)
  const [pubTitulo, setPubTitulo]           = useState('')
  const [pubConteudo, setPubConteudo]       = useState('')
  const [pubTipo, setPubTipo]               = useState('post')
  const [criandoPub, setCriandoPub]         = useState(false)

const [searchErro, setSearchErro]       = useState('')

  

  const TIPO_PUB_CFG: Record<string, any> = {
  post:       { label: 'Publicação',  cor: Colors.blue,    icon: '📝', bg: 'rgba(74,158,255,0.1)' },
  anuncio:    { label: 'Anúncio',     cor: Colors.gold,    icon: '📢', bg: 'rgba(232,180,75,0.1)' },
  comunicado: { label: 'Comunicado',  cor: Colors.green,   icon: '📋', bg: 'rgba(46,204,113,0.1)' },
  evento:     { label: 'Evento',      cor: Colors.redSoft, icon: '🗓️', bg: 'rgba(232,23,58,0.1)'  },
}

// No loadData, adiciona:


async function pesquisarVoluntario() {
  if (!searchSerial.trim()) return
  setSearchLoading(true)
  setSearchResult(null)
  setSearchErro('')

  const termo = searchSerial.trim().toUpperCase()

  const { data, error } = await supabase
    .from('voluntarios')
    .select(`
      id, numero_serial, tipo_sanguineo, estado, data_nascimento, sexo, morada,
      profiles ( id, nome, telefone, email )
    `)
    .ilike('numero_serial', `%${termo}%`)
    .limit(5)

  if (error || !data || data.length === 0) {
    setSearchErro('Nenhum voluntário encontrado com esse número de série.')
  } else {
    setSearchResult(data)
  }
  setSearchLoading(false)
}

async function adicionarMembro(voluntario: any) {
  if (!ong) return
  setAdicionando(true)

  // Verifica se já é membro
  const { data: jaExiste } = await supabase
    .from('membros_ong')
    .select('id, estado')
    .eq('ong_id', ong.id)
    .eq('voluntario_id', voluntario.id)
    .maybeSingle()

  if (jaExiste) {
    if (jaExiste.estado === 'ativo') {
      mostrarAlerta('Atenção', `${voluntario.profiles?.nome} já é membro activo.`)
      setAdicionando(false)
      return
    }
    // Reactiva membro que saiu ou foi rejeitado
    await supabase.from('membros_ong')
      .update({ estado: 'ativo', adicionado_por_ong: true })
      .eq('id', jaExiste.id)
  } else {
    const { error } = await supabase.from('membros_ong').insert({
      ong_id: ong.id,
      voluntario_id: voluntario.id,
      estado: 'ativo',
      adicionado_por_ong: true,
    })
    if (error) {
      mostrarAlerta('Erro', error.message)
      setAdicionando(false)
      return
    }
  }

  mostrarAlerta('✅ Adicionado!', `${voluntario.profiles?.nome} foi adicionado como membro.`)

  // Remove da lista de resultados
  setSearchResult((prev: any[]) => prev.filter((v: any) => v.id !== voluntario.id))
  loadData()
  setAdicionando(false)
}

  async function escolherVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
      videoMaxDuration: 120, // máx 2 minutos
    })
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri)
      setVideoNome(result.assets[0].fileName || `video_${Date.now()}.mp4`)
    }
  }

  async function uploadVideo(): Promise<string | null> {
    if (!videoUri || !videoNome) return null
    setUploadando(true)

    try {
      // Converte para blob
      const response = await fetch(videoUri)
      const blob = await response.blob()

      const caminho = `ongs/${ong.id}/${Date.now()}_${videoNome}`
      const { error } = await supabase.storage
        .from('publicacoes')
        .upload(caminho, blob, { contentType: 'video/mp4', upsert: false })

      if (error) { mostrarAlerta('Erro', 'Falha no upload do vídeo.'); setUploadando(false); return null }

      const { data } = supabase.storage.from('publicacoes').getPublicUrl(caminho)
      setUploadando(false)
      return data.publicUrl
    } catch {
      setUploadando(false)
      return null
    }
  }


  async function criarPublicacao() {
    if (!pubConteudo.trim()) { mostrarAlerta('Atenção', 'O conteúdo é obrigatório.'); return }
    setCriandoPub(true)

    let videoUrl = null
    if (videoUri) {
      videoUrl = await uploadVideo()
      if (!videoUrl) { setCriandoPub(false); return }
    }

    const { error } = await supabase.from('publicacoes').insert({
      ong_id: ong.id,
      autor_id: (await supabase.auth.getUser()).data.user?.id,
      tipo: pubTipo,
      titulo: pubTitulo.trim() || null,
      conteudo: pubConteudo.trim(),
      video_url: videoUrl,
      e_global: false,
      total_reacoes: 0,
    })
    if (error) mostrarAlerta('Erro', error.message)
    else {
      mostrarAlerta('✅ Publicado!', 'Os teus seguidores já podem ver.')
      setShowNovaPublicacao(false)
      setPubTitulo(''); setPubConteudo(''); setPubTipo('post')
      setVideoUri(null); setVideoNome(null)
      loadData()
    }
    setCriandoPub(false)
  }

  useEffect(() => { loadData() }, [])

  



async function adicionarMembroDirecto() {
  const vol = searchResult?.[0]
  if (!vol || !ong) return
  setAdicionando(true)

  // Verifica se já é membro
  const { data: jaExiste } = await supabase
    .from('membros_ong')
    .select('id, estado')
    .eq('ong_id', ong.id)
    .eq('voluntario_id', vol.id)
    .maybeSingle()

  if (jaExiste) {
    if (jaExiste.estado === 'ativo') {
      mostrarAlerta('Atenção', 'Este voluntário já é membro activo da vossa ONG.')
    } else {
      // Reactiva se tinha saído ou sido rejeitado
      await supabase.from('membros_ong')
        .update({ estado: 'ativo', adicionado_por_ong: true })
        .eq('id', jaExiste.id)
      mostrarAlerta('✅ Membro adicionado!', `${vol.profiles?.nome} foi adicionado com sucesso.`)
      setShowAddMembro(false)
      setSearchSerial('')
      setSearchResult(null)
      loadData()
    }
    setAdicionando(false)
    return
  }

  const { error } = await supabase.from('membros_ong').insert({
    ong_id: ong.id,
    voluntario_id: vol.id,
    estado: 'ativo',
    adicionado_por_ong: true,
  })

  if (error) {
    mostrarAlerta('Erro', error.message)
  } else {
    mostrarAlerta('✅ Membro adicionado!', `${(searchResult.profiles as any)?.nome} foi adicionado com sucesso.`)
    setShowAddMembro(false)
    setSearchSerial('')
    setSearchResult(null)
    loadData()
  }
  setAdicionando(false)
}


async function loadData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { router.replace('/(auth)/login'); return }

  const { data: ongData } = await supabase
    .from('ongs').select('*').eq('profile_id', user.id).single()

  if (!ongData) { router.replace('/(auth)/login'); return }

  setOng(ongData)
  setNome(ongData.nome || '')
  setDescricao(ongData.descricao || '')
  setTelefone(ongData.telefone || '')
  setEmail(ongData.email || '')
  setMunicipio(ongData.municipio || '')
  setResponsavelNome(ongData.responsavel_nome || '')
  setLatitude(ongData.latitude?.toString() || '')
  setLongitude(ongData.longitude?.toString() || '')

  // ── MEMBROS via RPC (bypassa RLS nos joins) ──
  const { data: membrosData, error: membrosError } = await supabase
    .rpc('get_membros_ong', { p_ong_id: ongData.id })

  if (membrosError) {
    console.error('Erro membros RPC:', membrosError)
  }

  const membrosFormatados = (membrosData || []).map((m: any) => ({
    id: m.id,
    estado: m.estado,
    adicionado_por_ong: m.adicionado_por_ong,
    created_at: m.criado_em,
    voluntarios: {
      id: m.voluntario_id,
      numero_serial: m.numero_serial,
      tipo_sanguineo: m.tipo_sanguineo,
      estado: m.voluntario_estado,
      data_nascimento: m.data_nascimento,
      sexo: m.sexo,
      morada: m.morada,
      profiles: {
        id: m.profile_id,
        nome: m.nome,
        telefone: m.telefone,
        email: m.email,
      }
    }
  }))

  setMembros(membrosFormatados)

  // Campanhas
  const { data: campsData } = await supabase
    .from('campanhas').select('*')
    .eq('ong_id', ongData.id)
    .order('created_at', { ascending: false })
  setCampanhas(campsData || [])

  // Notificações
  const { data: notifsData } = await supabase
    .from('notificacoes').select('*')
    .eq('usuario_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  setNotifs(notifsData || [])

  setLoading(false)
}

  async function aprovarMembro(id: string, aprovar: boolean) {
    await supabase.from('membros_ong')
      .update({ estado: aprovar ? 'ativo' : 'rejeitado' })
      .eq('id', id)
    loadData()
    mostrarAlerta(aprovar ? '✅ Membro aprovado' : 'Membro rejeitado', '')
  }

  async function removerMembro(id: string) {
    confirmar('Remover membro', 'Tens a certeza?', async () => {
      await supabase.from('membros_ong').update({ estado: 'saiu' }).eq('id', id)
      setMembroSel(null)
      loadData()
    })
  }

  async function salvarPerfil() {
    if (!nome.trim()) { mostrarAlerta('Atenção', 'O nome é obrigatório.'); return }
    setSalvando(true)
    const { error } = await supabase.from('ongs').update({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      telefone: telefone.trim() || null,
      email: email.trim() || null,
      municipio: municipio.trim() || null,
      responsavel_nome: responsavelNome.trim() || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    }).eq('id', ong.id)
    if (error) mostrarAlerta('Erro', error.message)
    else { mostrarAlerta('✅ Guardado!', 'Perfil actualizado.'); loadData() }
    setSalvando(false)
  }

  async function capturarLocalizacao() {
  setLocLoading(true)
  try {
    const coords = await obterLocalizacao()
    if (!coords) {
      mostrarAlerta('Permissão negada', 'Não foi possível obter a localização.')
      return
    }
    setLatitude(coords.latitude.toFixed(6))
    setLongitude(coords.longitude.toFixed(6))
  } catch (e: any) {
    mostrarAlerta('Erro', e.message)
  } finally {
    setLocLoading(false)
  }
}

  async function criarCampanha() {
    if (!campTitulo.trim()) { mostrarAlerta('Atenção', 'O título é obrigatório.'); return }
    setCriandoCamp(true)
    const { error } = await supabase.from('campanhas').insert({
      titulo: campTitulo.trim(),
      descricao: campDescricao.trim() || null,
      tipo: campTipo,
      tipo_sanguineo: campTipoSang || null,
      meta_doadores: campMeta ? parseInt(campMeta) : null,
      data_fim: campDataFim || null,
      ong_id: ong.id,
      publicado: false,
      total_atingido: 0,
    })
    if (error) mostrarAlerta('Erro', error.message)
    else {
      mostrarAlerta('✅ Campanha criada!', 'Será publicada após revisão do admin.')
      setShowNovaCampanha(false)
      setCampTitulo(''); setCampDescricao(''); setCampTipo('campanha')
      setCampTipoSang(''); setCampMeta(''); setCampDataFim('')
      loadData()
    }
    setCriandoCamp(false)
  }

  async function marcarNotifLida(id: string) {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
  }

  function handleLogout() {
    confirmar('Sair', 'Tens a certeza que queres sair?', async () => {
      await supabase.auth.signOut()
      router.replace('/(auth)/landing' as any)
    })
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  const membrosAtivos    = membros.filter(m => m.estado === 'ativo')
  const membrosPendentes = membros.filter(m => m.estado === 'pendente')
  const naoLidas         = notifs.filter(n => !n.lida).length

  const estadoOng = ong.estado || 'pendente'
  const estadoCfg: Record<string, { label: string; cor: string; bg: string }> = {
    ativa:     { label: 'Verificada e Activa', cor: Colors.green,   bg: 'rgba(46,204,113,0.1)'  },
    pendente:  { label: 'Pendente de verificação', cor: Colors.gold, bg: 'rgba(232,180,75,0.1)' },
    suspensa:  { label: 'Suspensa',            cor: Colors.redSoft, bg: 'rgba(232,23,58,0.1)'   },
  }
  const estCfg = estadoCfg[estadoOng] || estadoCfg['pendente']

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── SIDEBAR WEB ── */}
      {isWeb && (
        <View style={s.sidebar}>
          <View>
            <View style={s.sidebarLogo}>
              <View style={s.sidebarLogoIcon}>
                <Text style={{ color: Colors.white, fontWeight: '800', fontSize: 15 }}>M</Text>
              </View>
              <Text style={s.sidebarLogoText}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
            </View>

            <Text style={s.sidebarOngNome} numberOfLines={1}>{ong.nome}</Text>

            <View style={[s.sidebarEstado, { backgroundColor: estCfg.bg }]}>
              <View style={[s.sidebarEstadoDot, { backgroundColor: estCfg.cor }]} />
              <Text style={[s.sidebarEstadoText, { color: estCfg.cor }]}>{estCfg.label}</Text>
            </View>

            <View style={{ gap: 3, marginTop: 20 }}>
              {ABAS.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[s.sidebarItem, aba === a.id && s.sidebarItemActive]}
                  onPress={() => setAba(a.id as Aba)}
                >
                  <Feather name={a.icon} size={15} color={aba === a.id ? Colors.redSoft : Colors.muted} />
                  <Text style={[s.sidebarItemLabel, aba === a.id && { color: Colors.redSoft }]}>
                    {a.label}
                  </Text>
                  {a.id === 'membros' && membrosPendentes.length > 0 && (
                    <View style={s.sidebarBadge}>
                      <Text style={s.sidebarBadgeText}>{membrosPendentes.length}</Text>
                    </View>
                  )}
                  {a.id === 'dashboard' && naoLidas > 0 && (
                    <View style={s.sidebarBadge}>
                      <Text style={s.sidebarBadgeText}>{naoLidas}</Text>
                    </View>
                  )}

                  
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

        {/* ── TOPBAR ── */}
        <View style={[s.topbar, { paddingTop: safeTop + 8 }]}>
          {!isWeb && (
            <View style={{ flex: 1 }}>
              <Text style={s.topbarTitle} numberOfLines={1}>{ong.nome}</Text>
            </View>
          )}
          {isWeb && <Text style={s.topbarTitle}>{ABAS.find(a => a.id === aba)?.label}</Text>}
          <View style={{ flex: isWeb ? 1 : 0 }} />

          {/* Notificações */}
          <TouchableOpacity style={s.notifBtn} onPress={() => setAba('dashboard')}>
            <Feather name="bell" size={18} color={Colors.muted} />
            {naoLidas > 0 && (
              <View style={s.notifDot}>
                <Text style={s.notifDotText}>{naoLidas > 9 ? '9+' : naoLidas}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[s.estadoBadgeTopbar, { backgroundColor: estCfg.bg }]}>
            <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: estCfg.cor }]} />
            <Text style={[s.estadoBadgeTopbarText, { color: estCfg.cor }]}>
              {estadoOng === 'ativa' ? 'Verificada' : estadoOng === 'pendente' ? 'Pendente' : 'Suspensa'}
            </Text>
          </View>

          {!isWeb && (
            <TouchableOpacity onPress={handleLogout} style={{ padding: 6, marginLeft: 4 }}>
              <Feather name="log-out" size={18} color={Colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <View style={s.content}>

            {/* ══════════════ DASHBOARD ══════════════ */}
            {aba === 'dashboard' && (
              <>
                {/* Hero */}
                <View style={s.heroCard}>
                  <View style={s.heroGlow} />
                  <Text style={s.heroEyebrow}>Painel da Organização</Text>
                  <Text style={s.heroTitle}>{ong.nome}</Text>
                  <Text style={s.heroSub}>{ong.municipio}{ong.provincia ? `, ${ong.provincia}` : ''}</Text>

                  {/* Estado com motivo se suspensa */}
                  <View style={[s.heroEstado, { backgroundColor: estCfg.bg, borderColor: estCfg.cor + '40' }]}>
                    <View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: estCfg.cor, marginRight: 8 }]} />
                    <Text style={[s.heroEstadoText, { color: estCfg.cor }]}>{estCfg.label}</Text>
                  </View>
                  {estadoOng === 'suspensa' && ong.motivo_rejeicao && (
                    <View style={s.motivoBox}>
                      <Feather name="alert-triangle" size={14} color={Colors.redSoft} />
                      <Text style={s.motivoText}>Motivo: {ong.motivo_rejeicao}</Text>
                    </View>
                  )}
                  {estadoOng === 'pendente' && (
                    <View style={s.dicaBox}>
                      <Feather name="info" size={13} color={Colors.gold} />
                      <Text style={s.dicaText}>
                        A tua organização está a ser verificada pela equipa Moyo. Este processo pode demorar até 48h.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Stats */}
                <View style={s.statsRow}>
                  <StatCard value={membrosAtivos.length} label="Membros Activos" color={Colors.green} icon="users" />
                  <StatCard value={membrosPendentes.length} label="Pedidos Pendentes" color={Colors.gold} icon="clock" />
                  <StatCard value={campanhas.filter(c => c.publicado).length} label="Campanhas Activas" color={Colors.blue} icon="activity" />
                </View>

                {/* Pedidos pendentes em destaque */}
                {membrosPendentes.length > 0 && (
                  <View style={s.alertBox}>
                    <View style={s.alertBoxHeader}>
                      <Feather name="bell" size={16} color={Colors.gold} />
                      <Text style={s.alertBoxTitle}>
                        {membrosPendentes.length} pedido{membrosPendentes.length > 1 ? 's' : ''} de adesão pendente{membrosPendentes.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    {membrosPendentes.slice(0, 2).map(m => (
                      <View key={m.id} style={s.alertMembroRow}>
                        <View style={s.miniAvatar}>
                          <Text style={s.miniAvatarText}>
                            {(m.voluntarios as any)?.profiles?.nome?.slice(0,2).toUpperCase() || 'MO'}
                          </Text>
                        </View>
                        <Text style={s.alertMembroNome}>{(m.voluntarios as any)?.profiles?.nome}</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity style={s.miniAprovar} onPress={() => aprovarMembro(m.id, true)}>
                            <Feather name="check" size={13} color={Colors.dark} />
                          </TouchableOpacity>
                          <TouchableOpacity style={s.miniRejeitar} onPress={() => aprovarMembro(m.id, false)}>
                            <Feather name="x" size={13} color={Colors.redSoft} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {membrosPendentes.length > 2 && (
                      <TouchableOpacity onPress={() => setAba('membros')} style={{ marginTop: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: Colors.gold }}>
                          Ver todos ({membrosPendentes.length}) →
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Notificações recentes */}
                <View style={s.sectionCard}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>🔔 Notificações Recentes</Text>
                    {naoLidas > 0 && (
                      <TouchableOpacity onPress={async () => {
                        await supabase.from('notificacoes').update({ lida: true }).eq('usuario_id', ong.profile_id).eq('lida', false)
                        setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
                      }}>
                        <Text style={{ fontSize: 11, color: Colors.redSoft }}>Marcar todas</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {notifs.length === 0 ? (
                    <Text style={s.emptyText}>Sem notificações</Text>
                  ) : (
                    notifs.slice(0, 5).map(n => (
                      <TouchableOpacity
                        key={n.id}
                        style={[s.notifItem, !n.lida && s.notifItemNaoLida]}
                        onPress={() => marcarNotifLida(n.id)}
                      >
                        <View style={[s.notifIcon, { backgroundColor: tipoCor(n.tipo) + '20' }]}>
                          <Feather name={tipoIcon(n.tipo)} size={14} color={tipoCor(n.tipo)} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.notifTitulo}>{n.titulo}</Text>
                          {n.mensagem && <Text style={s.notifMensagem} numberOfLines={1}>{n.mensagem}</Text>}
                        </View>
                        {!n.lida && <View style={s.notifDotSmall} />}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </>
            )}

            {/* ══════════════ MEMBROS ══════════════ */}
            {aba === 'membros' && (
              <>
               {/* Botão de adicionar */}
              <TouchableOpacity
                style={s.btnNovaCampanha}
                onPress={() => setShowAddMembro(true)}
              >
                <Feather name="user-plus" size={16} color={Colors.white} />
                <Text style={s.btnNovaCampanhaText}>Adicionar Membro Directamente</Text>
              </TouchableOpacity>
                {membrosPendentes.length > 0 && (
                  <View style={s.sectionCard}>
                    <Text style={s.sectionTitle}>🔔 Pedidos de Adesão ({membrosPendentes.length})</Text>
                    {membrosPendentes.map(m => (
                      <View key={m.id} style={s.membroCard}>
                        <TouchableOpacity style={s.membroAvatarWrap} onPress={() => setMembroSel(m)}>
                          <View style={[s.membroAvatar, { backgroundColor: Colors.gold }]}>
                            <Text style={s.membroAvatarText}>
                              {(m.voluntarios as any)?.profiles?.nome?.slice(0,2).toUpperCase() || 'MO'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => setMembroSel(m)}>
                          <Text style={s.membroNome}>{(m.voluntarios as any)?.profiles?.nome}</Text>
                          <Text style={s.membroSub}>{(m.voluntarios as any)?.numero_serial}</Text>
                          <Text style={s.membroSub}>{(m.voluntarios as any)?.profiles?.telefone || '—'}</Text>
                        </TouchableOpacity>
                        {(m.voluntarios as any)?.tipo_sanguineo && (
                          <View style={s.membroTipoBadge}>
                            <Text style={s.membroTipoText}>{(m.voluntarios as any).tipo_sanguineo}</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity style={s.btnAprovar} onPress={() => aprovarMembro(m.id, true)}>
                            <Feather name="check" size={14} color={Colors.dark} />
                          </TouchableOpacity>
                          <TouchableOpacity style={s.btnRejeitar} onPress={() => aprovarMembro(m.id, false)}>
                            <Feather name="x" size={14} color={Colors.redSoft} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={s.sectionCard}>
                  <Text style={s.sectionTitle}>👥 Membros Activos ({membrosAtivos.length})</Text>
                  {membrosAtivos.length === 0 ? (
                    <View style={s.emptyBox}>
                      <Feather name="users" size={32} color={Colors.muted2} style={{ marginBottom: 10 }} />
                      <Text style={s.emptyText}>Ainda sem membros activos.</Text>
                    </View>
                  ) : (
                    membrosAtivos.map(m => {
                      const v = m.voluntarios as any
                      const estadoV = v?.estado || 'pendente'
                      const estadoVCor = estadoV === 'apto' ? Colors.green : estadoV === 'inapto_temp' || estadoV === 'inapto_perm' ? Colors.redSoft : Colors.gold
                      return (
                        <TouchableOpacity key={m.id} style={s.membroCard} onPress={() => setMembroSel(m)}>
                          <View style={s.membroAvatar}>
                            <Text style={s.membroAvatarText}>
                              {v?.profiles?.nome?.slice(0,2).toUpperCase() || 'MO'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.membroNome}>{v?.profiles?.nome}</Text>
                            <Text style={s.membroSub}>{v?.profiles?.telefone || '—'}</Text>
                            <Text style={s.membroSub}>{v?.numero_serial}</Text>
                          </View>
                          {v?.tipo_sanguineo && (
                            <View style={s.membroTipoBadge}>
                              <Text style={s.membroTipoText}>{v.tipo_sanguineo}</Text>
                            </View>
                          )}
                          <View style={[s.membroEstadoBadge, { backgroundColor: estadoVCor + '18' }]}>
                            <Text style={[s.membroEstadoText, { color: estadoVCor }]}>
                              {estadoV === 'apto' ? 'Apto' : estadoV === 'pendente' ? 'Pendente' : estadoV === 'em_exame' ? 'Em exame' : 'Inapto'}
                            </Text>
                          </View>
                          <Feather name="chevron-right" size={14} color={Colors.muted} />
                        </TouchableOpacity>
                      )
                    })
                  )}
                </View>
              </>
            )}

            {aba === 'publicacoes' && (
              <>
                <TouchableOpacity style={s.btnNovaCampanha} onPress={() => setShowNovaPublicacao(true)}>
                  <Feather name="edit-3" size={16} color={Colors.white} />
                  <Text style={s.btnNovaCampanhaText}>Nova Publicação</Text>
                </TouchableOpacity>

                {publicacoes.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Feather name="rss" size={36} color={Colors.muted2} style={{ marginBottom: 12 }} />
                    <Text style={s.emptyTitle}>Sem publicações</Text>
                    <Text style={s.emptyText}>Cria a primeira publicação para os teus seguidores e membros.</Text>
                  </View>
                ) : (
                  publicacoes.map(p => (
                    <View key={p.id} style={s.campanhaCard}>
                      <View style={s.campanhaHeader}>
                        <View style={[s.campanhaTipoBadge, { backgroundColor: TIPO_PUB_CFG[p.tipo]?.bg || Colors.dark3 }]}>
                          <Text style={[s.campanhaTipoText, { color: TIPO_PUB_CFG[p.tipo]?.cor || Colors.muted }]}>
                            {TIPO_PUB_CFG[p.tipo]?.icon} {TIPO_PUB_CFG[p.tipo]?.label}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: Colors.muted }}>
                          {new Date(p.created_at).toLocaleDateString('pt-PT')}
                        </Text>
                      </View>
                      {p.titulo && <Text style={s.campanhaTitulo}>{p.titulo}</Text>}
                      <Text style={s.campanhaDesc} numberOfLines={3}>{p.conteudo}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <Feather name="heart" size={13} color={Colors.muted} />
                        <Text style={{ fontSize: 12, color: Colors.muted }}>{p.total_reacoes} reacções</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {/* ══════════════ CAMPANHAS ══════════════ */}
            {aba === 'campanhas' && (
              <>
                <TouchableOpacity
                  style={s.btnNovaCampanha}
                  onPress={() => setShowNovaCampanha(true)}
                >
                  <Feather name="plus" size={16} color={Colors.white} />
                  <Text style={s.btnNovaCampanhaText}>Nova Campanha</Text>
                </TouchableOpacity>

                {campanhas.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Feather name="activity" size={36} color={Colors.muted2} style={{ marginBottom: 12 }} />
                    <Text style={s.emptyTitle}>Sem campanhas</Text>
                    <Text style={s.emptyText}>Cria a primeira campanha da tua organização.</Text>
                  </View>
                ) : (
                  campanhas.map(c => (
                    <View key={c.id} style={s.campanhaCard}>
                      <View style={s.campanhaHeader}>
                        <View style={[s.campanhaTipoBadge, {
                          backgroundColor: c.tipo === 'urgente' ? Colors.redGlow : c.tipo === 'noticia' ? 'rgba(74,158,255,0.1)' : 'rgba(46,204,113,0.1)'
                        }]}>
                          <Text style={[s.campanhaTipoText, {
                            color: c.tipo === 'urgente' ? Colors.redSoft : c.tipo === 'noticia' ? Colors.blue : Colors.green
                          }]}>
                            {c.tipo === 'urgente' ? 'Urgente' : c.tipo === 'noticia' ? 'Notícia' : 'Campanha'}
                          </Text>
                        </View>
                        <View style={[s.campanhaPublicadoBadge, { backgroundColor: c.publicado ? 'rgba(46,204,113,0.1)' : Colors.dark3 }]}>
                          <Feather name={c.publicado ? 'eye' : 'eye-off'} size={11} color={c.publicado ? Colors.green : Colors.muted} />
                          <Text style={[s.campanhaPublicadoText, { color: c.publicado ? Colors.green : Colors.muted }]}>
                            {c.publicado ? 'Publicada' : 'Rascunho'}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.campanhaTitulo}>{c.titulo}</Text>
                      {c.descricao && <Text style={s.campanhaDesc} numberOfLines={2}>{c.descricao}</Text>}
                      {c.meta_doadores && (
                        <View style={{ marginTop: 8 }}>
                          <View style={s.progressBar}>
                            <View style={[s.progressFill, {
                              width: `${Math.min((c.total_atingido / c.meta_doadores) * 100, 100)}%` as any
                            }]} />
                          </View>
                          <Text style={s.progressText}>{c.total_atingido}/{c.meta_doadores} doadores</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </>
            )}

            {/* ══════════════ DOCUMENTOS ══════════════ */}
            {aba === 'documentos' && (
              <View style={s.sectionCard}>
                <Text style={s.sectionTitle}>📄 Documentos de Verificação</Text>

                <View style={s.docInfoBox}>
                  <Feather name="shield" size={18} color={estCfg.cor} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.docEstadoLabel, { color: estCfg.cor }]}>{estCfg.label}</Text>
                    {ong.data_verificacao && (
                      <Text style={s.docData}>
                        Verificado em {new Date(ong.data_verificacao).toLocaleDateString('pt-PT')}
                      </Text>
                    )}
                  </View>
                </View>

                {estadoOng === 'suspensa' && ong.motivo_rejeicao && (
                  <View style={s.motivoBoxDoc}>
                    <Feather name="alert-triangle" size={16} color={Colors.redSoft} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.motivoTitulo}>Motivo da suspensão</Text>
                      <Text style={s.motivoTextoDoc}>{ong.motivo_rejeicao}</Text>
                    </View>
                  </View>
                )}

                {ong.documento_url ? (
                  <TouchableOpacity
                    style={s.docBtn}
                    onPress={async () => {
                      if (Platform.OS === 'web') {
                        const { data } = await supabase.storage
                          .from('documentos-ongs')
                          .createSignedUrl(ong.documento_url, 300)
                        if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                      } else {
                        mostrarAlerta('Documento', 'Disponível no browser web.')
                      }
                    }}
                  >
                    <Feather name="file-text" size={18} color={Colors.white} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.docBtnTitle}>Documento de Registo Legal</Text>
                      <Text style={s.docBtnSub}>Toca para visualizar</Text>
                    </View>
                    <Feather name="external-link" size={16} color={Colors.muted} />
                  </TouchableOpacity>
                ) : (
                  <View style={s.emptyBox}>
                    <Feather name="file-minus" size={32} color={Colors.muted2} style={{ marginBottom: 10 }} />
                    <Text style={s.emptyText}>Nenhum documento carregado.</Text>
                  </View>
                )}

                <View style={s.docInfoFields}>
                  <DocRow label="NIF" value={ong.nif || '—'} />
                  <DocRow label="Nº de Registo" value={ong.numero_registo || '—'} />
                  <DocRow label="Responsável Legal" value={ong.responsavel_nome || '—'} />
                  <DocRow label="Contacto do Responsável" value={ong.responsavel_contacto || '—'} />
                </View>
              </View>
            )}

            {/* ══════════════ PERFIL ══════════════ */}
            {aba === 'perfil' && (
              <>
                <View style={s.sectionCard}>
                  <Text style={s.sectionTitle}>✏️ Informações da Organização</Text>

                  <FormLabel text="NOME DA ORGANIZAÇÃO *" />
                  <TextInput style={s.formInput} value={nome} onChangeText={setNome} placeholder="Nome da ONG" placeholderTextColor={Colors.muted2} />

                  <FormLabel text="DESCRIÇÃO" />
                  <TextInput style={[s.formInput, { height: 90, textAlignVertical: 'top' }]} value={descricao} onChangeText={setDescricao} placeholder="Missão da organização..." placeholderTextColor={Colors.muted2} multiline />

                  <FormLabel text="RESPONSÁVEL" />
                  <TextInput style={s.formInput} value={responsavelNome} onChangeText={setResponsavelNome} placeholder="Nome do responsável" placeholderTextColor={Colors.muted2} />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <FormLabel text="TELEFONE" />
                      <TextInput style={s.formInput} value={telefone} onChangeText={setTelefone} placeholder="+244 9XX..." placeholderTextColor={Colors.muted2} keyboardType="phone-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormLabel text="EMAIL" />
                      <TextInput style={s.formInput} value={email} onChangeText={setEmail} placeholder="ong@email.com" placeholderTextColor={Colors.muted2} keyboardType="email-address" autoCapitalize="none" />
                    </View>
                  </View>

                  <FormLabel text="MUNICÍPIO" />
                  <TextInput style={s.formInput} value={municipio} onChangeText={setMunicipio} placeholder="Município" placeholderTextColor={Colors.muted2} />
                </View>

                <View style={s.sectionCard}>
                  <Text style={s.sectionTitle}>📍 Localização no Mapa</Text>
                  <Text style={s.locDesc}>Define a localização para aparecer no mapa de doadores.</Text>

                  <TouchableOpacity style={s.locBtn} onPress={capturarLocalizacao} disabled={locLoading}>
                    {locLoading ? <ActivityIndicator size="small" color={Colors.white} /> : <Feather name="crosshair" size={15} color={Colors.white} />}
                    <Text style={s.locBtnText}>{locLoading ? 'A capturar...' : 'Usar localização actual'}</Text>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FormLabel text="LATITUDE" />
                      <TextInput style={s.formInput} value={latitude} onChangeText={setLatitude} placeholder="-15.1961" placeholderTextColor={Colors.muted2} keyboardType="numeric" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FormLabel text="LONGITUDE" />
                      <TextInput style={s.formInput} value={longitude} onChangeText={setLongitude} placeholder="12.1522" placeholderTextColor={Colors.muted2} keyboardType="numeric" />
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={[s.btnSalvar, salvando && { opacity: 0.7 }]} onPress={salvarPerfil} disabled={salvando}>
                  {salvando ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.btnSalvarText}>Guardar Alterações</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* ══════════════ ADICIONAR MEMBROS ══════════════ */}
            {aba === 'adicionar' && (
              <>
                {/* Pesquisa por número de série */}
                <View style={s.sectionCard}>
                  <Text style={s.sectionTitle}>🔍 Pesquisar Voluntário</Text>
                  <Text style={{ fontSize: 13, color: Colors.muted, marginBottom: 16, lineHeight: 18 }}>
                    Pesquisa pelo número de série do cartão Moyo (ex: MO-2026-XXXXXX) para adicionares directamente um voluntário à organização.
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
                    <TextInput
                      style={[s.formInput, { flex: 1, marginBottom: 0 }]}
                      value={searchSerial}
                      onChangeText={v => { setSearchSerial(v.toUpperCase()); setSearchErro('') }}
                      placeholder="MO-2026-XXXXXX"
                      placeholderTextColor={Colors.muted2}
                      autoCapitalize="characters"
                      onSubmitEditing={pesquisarVoluntario}
                      returnKeyType="search"
                    />
                    <TouchableOpacity
                      style={[s.btnBuscar, searchLoading && { opacity: 0.7 }]}
                      onPress={pesquisarVoluntario}
                      disabled={searchLoading || !searchSerial.trim()}
                    >
                      {searchLoading
                        ? <ActivityIndicator size="small" color={Colors.white} />
                        : <Feather name="search" size={18} color={Colors.white} />
                      }
                    </TouchableOpacity>
                  </View>

                  {searchErro !== '' && (
                    <View style={s.searchErroBox}>
                      <Feather name="alert-circle" size={14} color={Colors.redSoft} />
                      <Text style={s.searchErroText}>{searchErro}</Text>
                    </View>
                  )}
                </View>

                {/* Resultados */}
                {searchResult && searchResult.length > 0 && (() => {
                  const vol = searchResult[0]
                  return (
                    <View style={s.searchResultCard}>
                      <View style={s.modalAvatar}>
                        <Text style={s.modalAvatarText}>
                          {vol.profiles?.nome?.slice(0,2).toUpperCase() || 'MO'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.modalNome}>{vol.profiles?.nome}</Text>
                        <Text style={{ fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace' }}>
                          {vol.numero_serial}
                        </Text>
                        <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                          {vol.profiles?.telefone || '—'}
                          {vol.tipo_sanguineo ? ` · Tipo ${vol.tipo_sanguineo}` : ''}
                        </Text>
                      </View>
                      {vol.tipo_sanguineo && (
                        <View style={s.membroTipoBadge}>
                          <Text style={s.membroTipoText}>{vol.tipo_sanguineo}</Text>
                        </View>
                      )}
                    </View>
                  )
                })()}

                {/* Dica */}
                <View style={s.sectionCard}>
                  <Text style={s.sectionTitle}>💡 Como funciona</Text>
                  <View style={{ gap: 12 }}>
                    <DicaRow numero="1" texto="O voluntário precisa de ter uma conta Moyo com o número de série no cartão digital." />
                    <DicaRow numero="2" texto="Pesquisa pelo número de série (MO-XXXX-XXXXXX) visível no cartão do voluntário." />
                    <DicaRow numero="3" texto="O voluntário é adicionado imediatamente como membro activo, sem precisar de aprovação." />
                    <DicaRow numero="4" texto="Também podes aguardar que o voluntário envie um pedido de adesão pela app." />
                  </View>
                </View>
              </>
            )}


          </View>
        </ScrollView>

        {/* ── BOTTOM NAV MOBILE ── */}
        {!isWeb && (
          <View style={s.bottomNav}>
            {ABAS.map(a => (
              <TouchableOpacity key={a.id} style={s.navItem} onPress={() => setAba(a.id as Aba)}>
                <View style={{ position: 'relative' }}>
                  <Feather name={a.icon} size={20} color={aba === a.id ? Colors.red : Colors.muted} />
                  {a.id === 'membros' && membrosPendentes.length > 0 && (
                    <View style={s.navBadge}><Text style={s.navBadgeText}>{membrosPendentes.length}</Text></View>
                  )}
                  {a.id === 'dashboard' && naoLidas > 0 && (
                    <View style={s.navBadge}><Text style={s.navBadgeText}>{naoLidas}</Text></View>
                  )}
                </View>
                <Text style={[s.navLabel, aba === a.id && { color: Colors.red }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ══════════════ MODAL — PERFIL DO MEMBRO ══════════════ */}
      {membroSel && (
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setMembroSel(null)}>
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            <View style={s.modalTopBar}>
              <Text style={s.modalCardTitle}>Perfil do Membro</Text>
              <TouchableOpacity onPress={() => setMembroSel(null)} style={{ padding: 6 }}>
                <Feather name="x" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            {(() => {
              const v = membroSel.voluntarios as any
              const prof = v?.profiles
              const estadoV = v?.estado || 'pendente'
              const estadoVCor = estadoV === 'apto' ? Colors.green : estadoV.startsWith('inapto') ? Colors.redSoft : Colors.gold
              const idade = v?.data_nascimento
                ? Math.floor((Date.now() - new Date(v.data_nascimento).getTime()) / (365.25*24*60*60*1000))
                : null
              return (
                <>
                  <View style={{ alignItems: 'center', marginBottom: 20 }}>
                    <View style={s.modalAvatar}>
                      <Text style={s.modalAvatarText}>
                        {prof?.nome?.slice(0,2).toUpperCase() || 'MO'}
                      </Text>
                    </View>
                    <Text style={s.modalNome}>{prof?.nome || '—'}</Text>
                    <View style={[s.modalEstadoBadge, { backgroundColor: estadoVCor + '18' }]}>
                      <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: estadoVCor, marginRight: 5 }]} />
                      <Text style={[s.modalEstadoText, { color: estadoVCor }]}>
                        {estadoV === 'apto' ? 'Apto para doar' : estadoV === 'pendente' ? 'Pendente de exames' : estadoV === 'em_exame' ? 'Em exame' : 'Inapto'}
                      </Text>
                    </View>
                  </View>

                  <View style={s.modalInfoBox}>
                    <ModalInfoRow icon="hash" label="Número de série" value={v?.numero_serial || '—'} />
                    <ModalInfoRow icon="droplet" label="Tipo sanguíneo" value={v?.tipo_sanguineo || 'A confirmar'} />
                    <ModalInfoRow icon="phone" label="Telefone" value={prof?.telefone || '—'} />
                    {prof?.email && <ModalInfoRow icon="mail" label="Email" value={prof.email} />}
                    {idade && <ModalInfoRow icon="calendar" label="Idade" value={`${idade} anos`} />}
                    {v?.sexo && <ModalInfoRow icon="user" label="Sexo" value={v.sexo === 'M' ? 'Masculino' : 'Feminino'} />}
                    {v?.morada && <ModalInfoRow icon="map-pin" label="Morada" value={v.morada} />}
                    <ModalInfoRow icon="clock" label="Membro desde" value={new Date(membroSel.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })} />
                  </View>

                  {membroSel.estado === 'ativo' && (
                    <TouchableOpacity style={s.modalBtnRemover} onPress={() => removerMembro(membroSel.id)}>
                      <Feather name="user-x" size={14} color={Colors.redSoft} />
                      <Text style={s.modalBtnRemoverText}>Remover da organização</Text>
                    </TouchableOpacity>
                  )}
                  {membroSel.estado === 'pendente' && (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[s.modalBtnAction, { flex: 1, backgroundColor: Colors.green }]} onPress={() => { setMembroSel(null); aprovarMembro(membroSel.id, true) }}>
                        <Feather name="check" size={14} color={Colors.dark} />
                        <Text style={[s.modalBtnActionText, { color: Colors.dark }]}>Aprovar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.modalBtnAction, { flex: 1, backgroundColor: Colors.dark3 }]} onPress={() => { setMembroSel(null); aprovarMembro(membroSel.id, false) }}>
                        <Feather name="x" size={14} color={Colors.redSoft} />
                        <Text style={[s.modalBtnActionText, { color: Colors.redSoft }]}>Rejeitar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )
            })()}
          </View>
        </TouchableOpacity>
      )}

      {/* ══════════════ MODAL — NOVA CAMPANHA ══════════════ */}
      <Modal visible={showNovaCampanha} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.modalTopBar}>
                <Text style={s.modalCardTitle}>Nova Campanha</Text>
                <TouchableOpacity onPress={() => setShowNovaCampanha(false)} style={{ padding: 6 }}>
                  <Feather name="x" size={18} color={Colors.muted} />
                </TouchableOpacity>
              </View>

              <FormLabel text="TIPO" />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['campanha', 'urgente', 'noticia'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.tipoBtn, campTipo === t && s.tipoBtnActive]}
                    onPress={() => setCampTipo(t)}
                  >
                    <Text style={[s.tipoBtnText, campTipo === t && { color: Colors.white }]}>
                      {t === 'campanha' ? '❤️ Campanha' : t === 'urgente' ? '🚨 Urgente' : '📰 Notícia'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FormLabel text="TÍTULO *" />
              <TextInput style={s.formInput} value={campTitulo} onChangeText={setCampTitulo} placeholder="Título da campanha" placeholderTextColor={Colors.muted2} />

              <FormLabel text="DESCRIÇÃO" />
              <TextInput style={[s.formInput, { height: 80, textAlignVertical: 'top' }]} value={campDescricao} onChangeText={setCampDescricao} placeholder="Descreve a campanha..." placeholderTextColor={Colors.muted2} multiline />

              <FormLabel text="TIPO SANGUÍNEO (opcional)" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.sangBtn, campTipoSang === t && s.sangBtnActive]}
                    onPress={() => setCampTipoSang(campTipoSang === t ? '' : t)}
                  >
                    <Text style={[s.sangBtnText, campTipoSang === t && { color: Colors.redSoft }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

               <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <FormLabel text="META DE DOADORES" />
                  <TextInput style={s.formInput} value={campMeta} onChangeText={setCampMeta} placeholder="Ex: 50" placeholderTextColor={Colors.muted2} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <FormLabel text="DATA FIM" />
                  <TextInput style={s.formInput} value={campDataFim} onChangeText={setCampDataFim} placeholder="AAAA-MM-DD" placeholderTextColor={Colors.muted2} />
                </View>
              </View>


              <View style={s.dicaBox}>
                <Feather name="info" size={13} color={Colors.gold} />
                <Text style={s.dicaText}>A campanha ficará em rascunho até ser aprovada e publicada pelo admin do Moyo.</Text>
              </View>

              <TouchableOpacity
                style={[s.btnSalvar, criandoCamp && { opacity: 0.7 }]}
                onPress={criarCampanha}
                disabled={criandoCamp}
              >
                {criandoCamp ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.btnSalvarText}>Criar Campanha</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showNovaPublicacao} transparent animationType="slide">
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <View style={s.modalTopBar}>
            <Text style={s.modalCardTitle}>Nova Publicação</Text>
            <TouchableOpacity onPress={() => setShowNovaPublicacao(false)} style={{ padding: 6 }}>
              <Feather name="x" size={18} color={Colors.muted} />
            </TouchableOpacity>
          </View>

          <FormLabel text="TIPO" />
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {Object.entries(TIPO_PUB_CFG).map(([k, v]) => (
              <TouchableOpacity
                key={k}
                style={[s.tipoBtn, pubTipo === k && s.tipoBtnActive, { minWidth: '22%' }]}
                onPress={() => setPubTipo(k)}
              >
                <Text style={[s.tipoBtnText, pubTipo === k && { color: Colors.white }]}>
                  {v.icon} {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FormLabel text="TÍTULO (opcional)" />
          <TextInput style={s.formInput} value={pubTitulo} onChangeText={setPubTitulo} placeholder="Título..." placeholderTextColor={Colors.muted2} />

          <FormLabel text="CONTEÚDO *" />
          <TextInput
            style={[s.formInput, { height: 120, textAlignVertical: 'top' }]}
            value={pubConteudo} onChangeText={setPubConteudo}
            placeholder="Escreve a tua mensagem para membros e seguidores..."
            placeholderTextColor={Colors.muted2}
            multiline
          />

          {/* Após o campo de conteúdo */}
          <FormLabel text="VÍDEO (opcional, máx. 2 min)" />
          {!videoUri ? (
            <TouchableOpacity style={s.videoPickerBtn} onPress={escolherVideo}>
              <Feather name="video" size={20} color={Colors.muted} />
              <Text style={s.videoPickerText}>Seleccionar vídeo da galeria</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.videoPreview}>
              <Feather name="check-circle" size={16} color={Colors.green} />
              <Text style={s.videoPreviewText} numberOfLines={1}>{videoNome}</Text>
              <TouchableOpacity onPress={() => { setVideoUri(null); setVideoNome(null) }}>
                <Feather name="x" size={16} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          )}

          {uploadando && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 }}>
              <ActivityIndicator size="small" color={Colors.blue} />
              <Text style={{ fontSize: 12, color: Colors.muted }}>A carregar vídeo...</Text>
            </View>
          )}

          <View style={s.dicaBox}>
            <Feather name="users" size={13} color={Colors.blue} />
            <Text style={s.dicaText}>Esta publicação aparecerá no feed de todos os membros e seguidores da vossa ONG.</Text>
          </View>

          <TouchableOpacity style={[s.btnSalvar, criandoPub && { opacity: 0.7 }]} onPress={criarPublicacao} disabled={criandoPub}>
            {criandoPub ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.btnSalvarText}>Publicar</Text>}
          </TouchableOpacity>
        </View>
      </View>
      </Modal>

       {/* Modal — Adicionar Membro */}
      <Modal visible={showAddMembro} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalTopBar}>
              <Text style={s.modalCardTitle}>Adicionar Membro</Text>
              <TouchableOpacity onPress={() => { setShowAddMembro(false); setSearchSerial(''); setSearchResult(null) }} style={{ padding: 6 }}>
                <Feather name="x" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={s.locDesc}>
              Pesquisa um voluntário pelo número de série (ex: MO-2026-XXXXXX) para o adicionar directamente à organização.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TextInput
                style={[s.formInput, { flex: 1 }]}
                value={searchSerial}
                onChangeText={setSearchSerial}
                placeholder="MO-2026-..."
                placeholderTextColor={Colors.muted2}
                autoCapitalize="characters"
                onSubmitEditing={pesquisarVoluntario}
              />
              <TouchableOpacity
                style={{ backgroundColor: Colors.blue, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center' }}
                onPress={pesquisarVoluntario}
                disabled={searchLoading}
              >
                {searchLoading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Feather name="search" size={18} color={Colors.white} />
                }
              </TouchableOpacity>
            </View>

            {searchResult && searchResult.length > 0 && (
              <View style={s.searchResultCard}>
                <View style={s.modalAvatar}>
                  <Text style={s.modalAvatarText}>
                    {searchResult[0].profiles?.nome?.slice(0,2).toUpperCase() || 'MY'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalNome}>{(searchResult.profiles as any)?.nome}</Text>
                  <Text style={{ fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace' }}>
                    {searchResult.numero_serial}
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 2 }}>
                    {(searchResult.profiles as any)?.telefone || '—'}
                    {searchResult.tipo_sanguineo ? ` · Tipo ${searchResult.tipo_sanguineo}` : ''}
                  </Text>
                </View>
                {searchResult.tipo_sanguineo && (
                  <View style={s.membroTipoBadge}>
                    <Text style={s.membroTipoText}>{searchResult.tipo_sanguineo}</Text>
                  </View>
                )}
              </View>
            )}

            {searchResult && (
              <TouchableOpacity
                style={[s.btnSalvar, adicionando && { opacity: 0.7 }]}
                onPress={adicionarMembroDirecto}
                disabled={adicionando}
              >
                {adicionando
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={s.btnSalvarText}>Confirmar e Adicionar</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  )

 

}

// ── Componentes auxiliares ──
const ABAS: { id: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'dashboard',  label: 'Dashboard',  icon: 'grid'      },
  { id: 'membros',    label: 'Membros',    icon: 'users'     },
  { id: 'adicionar',  label: 'Adicionar',  icon: 'user-plus' }, // ← NOVO
  { id: 'campanhas',  label: 'Campanhas',  icon: 'activity'  },
  { id: 'publicacoes',label: 'Feed',       icon: 'rss'       },
  { id: 'documentos', label: 'Documentos', icon: 'file-text' },
  { id: 'perfil',     label: 'Perfil',     icon: 'settings'  },
]

function StatCard({ value, label, color, icon }: { value: number; label: string; color: string; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={[s.statCard, { borderColor: color + '30' }]}>
      <Feather name={icon} size={18} color={color} style={{ marginBottom: 8 }} />
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function FormLabel({ text }: { text: string }) {
  return <Text style={s.formLabel}>{text}</Text>
}

function DocRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.docRow}>
      <Text style={s.docRowLabel}>{label}</Text>
      <Text style={s.docRowValue}>{value}</Text>
    </View>
  )
}

function ModalInfoRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={s.modalInfoRow}>
      <View style={s.modalInfoIcon}>
        <Feather name={icon} size={13} color={Colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.modalInfoLabel}>{label}</Text>
        <Text style={s.modalInfoValue}>{value}</Text>
      </View>
    </View>
  )
}

function tipoCor(tipo: string) {
  return { urgente: Colors.redSoft, sucesso: Colors.green, aviso: Colors.gold, info: Colors.blue }[tipo] || Colors.muted
}
function tipoIcon(tipo: string): keyof typeof Feather.glyphMap {
  return ({ urgente: 'alert-circle', sucesso: 'check-circle', aviso: 'alert-triangle', info: 'info' } as any)[tipo] || 'bell'
}

function DetalheItem({ icon, value }: { icon: keyof typeof Feather.glyphMap; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Feather name={icon} size={11} color={Colors.muted} />
      <Text style={{ fontSize: 11, color: Colors.muted }}>{value}</Text>
    </View>
  )
}

function DicaRow({ numero, texto }: { numero: string; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: Colors.redGlow, borderWidth: 1,
        borderColor: Colors.red, alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.redSoft }}>{numero}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: Colors.muted, lineHeight: 18 }}>{texto}</Text>
    </View>
  )
}


const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  main: { flex: 1, flexDirection: 'column' },
  content: { padding: 20, maxWidth: 700, width: '100%', alignSelf: 'center' },

  sidebar: { width: 230, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 20, justifyContent: 'space-between' },
  sidebarLogo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  sidebarLogoIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText: { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarOngNome: { fontSize: 13, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  sidebarEstado: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 16 },
  sidebarEstadoDot: { width: 6, height: 6, borderRadius: 3 },
  sidebarEstadoText: { fontSize: 11, fontWeight: '700' },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive: { backgroundColor: Colors.redGlow },
  sidebarItemLabel: { fontSize: 13, fontWeight: '500', color: Colors.muted, flex: 1 },
  sidebarBadge: { backgroundColor: Colors.red, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  sidebarBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.white },
  sidebarLogout: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  sidebarLogoutText: { fontSize: 13, color: Colors.muted },

  topbar: { height: 60, backgroundColor: Colors.dark2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  topbarTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
  notifBtn: { position: 'relative', padding: 8 },
  notifDot: { position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  notifDotText: { fontSize: 9, fontWeight: '800', color: Colors.white },
  estadoBadgeTopbar: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  estadoBadgeTopbarText: { fontSize: 11, fontWeight: '700' },

  heroCard: { backgroundColor: Colors.dark2, borderRadius: 18, padding: 22, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', position: 'relative' },
  heroGlow: { position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(74,158,255,0.08)' },
  heroEyebrow: { fontSize: 11, color: Colors.muted, letterSpacing: 0.5, marginBottom: 6 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  heroSub: { fontSize: 13, color: Colors.muted, marginBottom: 14 },
  heroEstado: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 10 },
  heroEstadoText: { fontSize: 12, fontWeight: '700' },
  motivoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(232,23,58,0.08)', borderWidth: 1, borderColor: 'rgba(232,23,58,0.2)', borderRadius: 10, padding: 12, marginTop: 8 },
  motivoText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },
  dicaBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(232,180,75,0.07)', borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)', borderRadius: 10, padding: 12, marginTop: 8 },
  dicaText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: Colors.dark2, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1 },
  statVal: { fontSize: 24, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 10, color: Colors.muted, textAlign: 'center' },

  alertBox: { backgroundColor: 'rgba(232,180,75,0.07)', borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)', borderRadius: 14, padding: 16, marginBottom: 16 },
  alertBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  alertBoxTitle: { fontSize: 13, fontWeight: '700', color: Colors.gold },
  alertMembroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.dark3, borderRadius: 10, padding: 10, marginBottom: 8 },
  miniAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 11, fontWeight: '800', color: Colors.dark },
  alertMembroNome: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.white },
  miniAprovar: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  miniRejeitar: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(232,23,58,0.1)', borderWidth: 1, borderColor: Colors.redSoft, alignItems: 'center', justifyContent: 'center' },

  sectionCard: { backgroundColor: Colors.dark2, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 14 },

  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 10, marginBottom: 6 },
  notifItemNaoLida: { backgroundColor: 'rgba(255,255,255,0.03)' },
  notifIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitulo: { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  notifMensagem: { fontSize: 11, color: Colors.muted },
  notifDotSmall: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.red, marginTop: 4 },

  membroCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark3, borderRadius: 12, padding: 12, marginBottom: 8 },
  membroAvatarWrap: {},
  membroAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center' },
  membroAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.white },
  membroNome: { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  membroSub: { fontSize: 11, color: Colors.muted },
  membroTipoBadge: { backgroundColor: Colors.redGlow, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  membroTipoText: { fontSize: 11, fontWeight: '700', color: Colors.redSoft },
  membroEstadoBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  membroEstadoText: { fontSize: 10, fontWeight: '700' },
  btnAprovar: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  btnRejeitar: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(232,23,58,0.1)', borderWidth: 1, borderColor: Colors.redSoft, alignItems: 'center', justifyContent: 'center' },

  emptyBox: { backgroundColor: Colors.dark3, borderRadius: 12, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  emptyText: { fontSize: 13, color: Colors.muted, textAlign: 'center' },

  campanhaCard: { backgroundColor: Colors.dark3, borderRadius: 14, padding: 16, marginBottom: 12 },
  campanhaHeader: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  campanhaTipoBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  campanhaTipoText: { fontSize: 11, fontWeight: '700' },
  campanhaPublicadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  campanhaPublicadoText: { fontSize: 11, fontWeight: '700' },
  campanhaTitulo: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  campanhaDesc: { fontSize: 12, color: Colors.muted, lineHeight: 17 },
  progressBar: { height: 4, backgroundColor: Colors.dark4, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: 4, borderRadius: 4, backgroundColor: Colors.red },
  progressText: { fontSize: 11, color: Colors.muted },
  btnNovaCampanha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.red, borderRadius: 12, padding: 14, marginBottom: 16 },
  btnNovaCampanhaText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  docInfoBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark3, borderRadius: 12, padding: 14, marginBottom: 14 },
  docEstadoLabel: { fontSize: 14, fontWeight: '700' },
  docData: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  motivoBoxDoc: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(232,23,58,0.08)', borderWidth: 1, borderColor: 'rgba(232,23,58,0.2)', borderRadius: 12, padding: 14, marginBottom: 14 },
  motivoTitulo: { fontSize: 12, fontWeight: '700', color: Colors.redSoft, marginBottom: 4 },
  motivoTextoDoc: { fontSize: 12, color: Colors.muted, lineHeight: 17 },
  docBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark3, borderRadius: 12, padding: 16, marginBottom: 14 },
  docBtnTitle: { fontSize: 14, fontWeight: '600', color: Colors.white },
  docBtnSub: { fontSize: 11, color: Colors.muted, marginTop: 2 },
  docInfoFields: { backgroundColor: Colors.dark3, borderRadius: 12, overflow: 'hidden' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  docRowLabel: { fontSize: 12, color: Colors.muted },
  docRowValue: { fontSize: 12, fontWeight: '600', color: Colors.white },

  formLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 7, marginTop: 12 },
  formInput: { backgroundColor: Colors.dark3, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', padding: 12, fontSize: 14, color: Colors.white },
  locDesc: { fontSize: 12, color: Colors.muted, lineHeight: 17, marginBottom: 14 },
  locBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.blue, borderRadius: 10, padding: 13 },
  locBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },
  btnSalvar: { backgroundColor: Colors.red, borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 20 },
  btnSalvarText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  tipoBtn: { flex: 1, backgroundColor: Colors.dark3, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  tipoBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  tipoBtnText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  sangBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.dark3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  sangBtnActive: { backgroundColor: Colors.redGlow, borderColor: Colors.red },
  sangBtnText: { fontSize: 13, fontWeight: '600', color: Colors.muted },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 999 },
  modalCard: { backgroundColor: Colors.dark2, borderRadius: 22, padding: 24, width: '100%', maxWidth: 440, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalCardTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  modalAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalAvatarText: { fontSize: 24, fontWeight: '800', color: Colors.white },
  modalNome: { fontSize: 18, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  modalEstadoBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 4 },
  modalEstadoText: { fontSize: 11, fontWeight: '700' },
  modalInfoBox: { backgroundColor: Colors.dark3, borderRadius: 14, padding: 6, marginBottom: 18 },
  modalInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  modalInfoIcon: { width: 28, height: 28, borderRadius: 7, backgroundColor: Colors.dark4, alignItems: 'center', justifyContent: 'center' },
  modalInfoLabel: { fontSize: 10, color: Colors.muted, marginBottom: 1 },
  modalInfoValue: { fontSize: 13, fontWeight: '600', color: Colors.white },
  modalBtnRemover: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(232,23,58,0.08)', borderWidth: 1, borderColor: 'rgba(232,23,58,0.25)', borderRadius: 12, padding: 13 },
  modalBtnRemoverText: { fontSize: 13, fontWeight: '700', color: Colors.redSoft },
  modalBtnAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, padding: 12 },
  modalBtnActionText: { fontSize: 13, fontWeight: '700' },

  bottomNav: { flexDirection: 'row', backgroundColor: Colors.dark2, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 9, color: Colors.muted, fontWeight: '500' },
  navBadge: { position: 'absolute', top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  navBadgeText: { fontSize: 8, fontWeight: '800', color: Colors.white },

  searchResultCard: {
  flexDirection: 'row', alignItems: 'center', gap: 12,
  backgroundColor: Colors.dark3, borderRadius: 14, padding: 14,
  marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  
},

videoPickerBtn: {
  flexDirection: 'row', alignItems: 'center', gap: 10,
  backgroundColor: Colors.dark3, borderRadius: 10,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  borderStyle: 'dashed', padding: 16, marginBottom: 14,
  justifyContent: 'center',
},
videoPickerText: { fontSize: 13, color: Colors.muted, fontWeight: '600' },
videoPreview: {
  flexDirection: 'row', alignItems: 'center', gap: 10,
  backgroundColor: 'rgba(46,204,113,0.08)',
  borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
  borderRadius: 10, padding: 12, marginBottom: 14,
},
videoPreviewText: { flex: 1, fontSize: 13, color: Colors.white },
// Pesquisa / Adicionar membros
btnBuscar: {
  width: 50, height: 50,
  backgroundColor: Colors.blue,
  borderRadius: 10,
  alignItems: 'center', justifyContent: 'center',
},
searchErroBox: {
  flexDirection: 'row', alignItems: 'center', gap: 8,
  backgroundColor: 'rgba(232,23,58,0.08)',
  borderWidth: 1, borderColor: 'rgba(232,23,58,0.2)',
  borderRadius: 10, padding: 12, marginTop: 8,
},
searchErroText: { flex: 1, fontSize: 13, color: Colors.redSoft },

resultadoCard: {
  backgroundColor: Colors.dark3, borderRadius: 14,
  padding: 16, marginBottom: 12,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
},
resultadoHeader: {
  flexDirection: 'row', alignItems: 'center',
  gap: 12, marginBottom: 12,
},
resultadoAvatar: {
  width: 48, height: 48, borderRadius: 24,
  backgroundColor: Colors.blue,
  alignItems: 'center', justifyContent: 'center',
},
resultadoAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
resultadoNome:   { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 3 },
resultadoSerial: { fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace' },

resultadoDetalhes: {
  flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  marginBottom: 14, paddingBottom: 14,
  borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
},
estadoVolBadge: {
  flexDirection: 'row', alignItems: 'center', gap: 5,
  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
},
estadoVolText: { fontSize: 11, fontWeight: '700' },

btnAdicionarMembro: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  backgroundColor: Colors.blue, borderRadius: 10, padding: 12,
},
btnAdicionarMembroText: { fontSize: 14, fontWeight: '700', color: Colors.white },
})