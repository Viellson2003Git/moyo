// app/(auth)/emergencia.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Platform
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import { enviarPushUrgente } from '../../utils/sendPush'
import { SafeAreaView } from 'react-native-safe-area-context'
import { obterLocalizacao, obterMorada } from '../../utils/location'

const TIPOS_SANG = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']

const COMPATIBILIDADE: Record<string, string[]> = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
}

type Modo = 'form' | 'sucesso' | 'portal'

export default function Emergencia() {
  const [modo, setModo] = useState<Modo>('form')

  // Form
  const [nome, setNome]           = useState('')
  const [telefone, setTelefone]   = useState('')
  const [tipoSang, setTipoSang]   = useState('')
  const [descricao, setDescricao] = useState('')
  const [morada, setMorada]       = useState('')
  const [latitude, setLatitude]   = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [enviando, setEnviando]   = useState(false)

  // Portal
  const [pedidoId, setPedidoId]       = useState('')
  const [respostas, setRespostas]     = useState<any[]>([])
  const [pedidoInfo, setPedidoInfo]   = useState<any>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  async function capturarLocalizacao() {
  setLocLoading(true)
  try {
    const coords = await obterLocalizacao()
    if (!coords) {
      mostrarAlerta('Permissão negada', 'Não foi possível obter a localização. Escreve a morada manualmente.')
      return
    }
    setLatitude(coords.latitude)
    setLongitude(coords.longitude)
    const m = await obterMorada(coords.latitude, coords.longitude)
    setMorada(m)
  } catch (e: any) {
    mostrarAlerta('Erro', e.message || 'Falha ao obter localização.')
  } finally {
    setLocLoading(false)
  }
}

  async function loadPortal(id: string) {
    setPortalLoading(true)
    const { data: pedido } = await supabase
      .from('pedidos_emergencia')
      .select('*')
      .eq('id', id)
      .single()

    const { data: resp } = await supabase
      .from('respostas_emergencia')
      .select('id, estado, created_at, voluntarios(tipo_sanguineo, profiles(nome, telefone))')
      .eq('pedido_id', id)

    setPedidoInfo(pedido)
    setRespostas((resp as any) || [])
    setPortalLoading(false)
  }

  async function handleEnviar() {
    if (!nome || !telefone || !tipoSang) {
      mostrarAlerta('Atenção', 'Preenche nome, telefone e tipo sanguíneo.')
      return
    }
    setEnviando(true)
    try {
      const { data: pedido, error } = await supabase
        .from('pedidos_emergencia')
        .insert({
          nome_solicitante: nome.trim(),
          telefone_solicitante: telefone.trim(),
          tipo_sanguineo: tipoSang,
          descricao: descricao || null,
          latitude, longitude,
          morada_aproximada: morada || null,
          estado: 'ativo', max_doadores: 3,
        })
        .select().single()

      if (error) throw error
      setPedidoId(pedido.id)

      const tiposCompativeis = COMPATIBILIDADE[tipoSang] || [tipoSang]
      const { data: doadores } = await supabase
        .from('voluntarios')
        .select('id, profile_id')
        .in('tipo_sanguineo', tiposCompativeis)
        .eq('estado', 'apto')

      await enviarPushUrgente(tipoSang, nome, morada)

      const { data: admins } = await supabase.from('profiles').select('id').eq('tipo', 'admin')
      if (admins && admins.length > 0) {
        await supabase.from('notificacoes').insert(
          admins.map((a: any) => ({
            usuario_id: a.id,
            titulo: `🩸 Emergência — ${tipoSang}`,
            mensagem: `${nome} (${telefone}) precisa de ${tipoSang} em ${morada || 'Namibe'}.`,
            tipo: 'urgente', lida: false,
          }))
        )
      }

      await loadPortal(pedido.id)
      setModo('sucesso')
      // Adiciona na secção do portal (modo 'sucesso'):
useEffect(() => {
  if (modo !== 'sucesso' || !pedidoId) return

  // Carrega imediatamente
  loadPortal(pedidoId)

  // Subscreve actualizações
  const canal = supabase
    .channel(`emergencia-${pedidoId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'respostas_emergencia',
      filter: `pedido_id=eq.${pedidoId}`,
    }, () => loadPortal(pedidoId))
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'pedidos_emergencia',
      filter: `id=eq.${pedidoId}`,
    }, () => loadPortal(pedidoId))
    .subscribe()

  // Auto-refresh a cada 30 segundos
  const timer = setInterval(() => loadPortal(pedidoId), 30000)

  return () => {
    supabase.removeChannel(canal)
    clearInterval(timer)
  }
}, [modo, pedidoId])
    } catch (e: any) {
      mostrarAlerta('Erro', e.message)
    }
    setEnviando(false)
  }

  async function cancelarPedido() {
    await supabase.from('pedidos_emergencia').update({ estado: 'cancelado' }).eq('id', pedidoId)
    mostrarAlerta('Pedido cancelado', 'O pedido foi cancelado com sucesso.')
    router.replace('/(auth)/landing' as any)
  }

  async function marcarResolvido() {
    await supabase.from('pedidos_emergencia').update({ estado: 'resolvido' }).eq('id', pedidoId)
    mostrarAlerta('✅ Resolvido!', 'Obrigado por actualizar. Fico feliz que tenhas recebido ajuda!')
    router.replace('/(auth)/landing' as any)
  }

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.bgGlow} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.headerLogo}>
          {'MO'}
          <Text style={{ color: Colors.redSoft }}>{'YO'}</Text>
        </Text>
        <View style={s.urgentBadge}>
          <View style={s.urgentDot} />
          <Text style={s.urgentBadgeText}>{'URGENTE'}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.content}>

          {/* ── FORMULÁRIO ── */}
          {modo === 'form' && (
            <View>
              <View style={s.YOSection}>
                <Text style={s.YOEmoji}>{'🩸'}</Text>
                <Text style={s.YOTitle}>{'Precisa de sangue?'}</Text>
                <Text style={s.YOSub}>
                  {'Preenche o formulário. Notificamos imediatamente os doadores compatíveis.'}
                </Text>
              </View>

              {/* Como funciona */}
              <View style={s.howBox}>
                <HowStep num="1" text="Preenches o tipo sanguíneo necessário" />
                <HowStep num="2" text="Captamos a tua localização automaticamente" />
                <HowStep num="3" text="Notificamos até 3 doadores compatíveis" />
                <HowStep num="4" text="Acompanhas as respostas no teu portal" />
              </View>

              <View style={s.formCard}>
                <Text style={s.formTitle}>{'Dados do Pedido'}</Text>

                <Text style={s.label}>{'O TEU NOME *'}</Text>
                <InputField value={nome} onChangeText={setNome} placeholder="Nome completo" icon="user" />

                <Text style={s.label}>{'TELEFONE *'}</Text>
                <InputField value={telefone} onChangeText={setTelefone} placeholder="+244 9XX XXX XXX" icon="phone" keyboardType="phone-pad" />

                <Text style={s.label}>{'TIPO SANGUÍNEO NECESSÁRIO *'}</Text>
                <View style={s.tiposGrid}>
                  {TIPOS_SANG.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[s.tipoBtn, tipoSang === t && s.tipoBtnActive]}
                      onPress={() => setTipoSang(t)}
                    >
                      <Text style={[s.tipoBtnText, tipoSang === t && s.tipoBtnTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {tipoSang.length > 0 && (
                  <View style={s.compatBox}>
                    <Feather name="info" size={13} color={Colors.blue} />
                    <Text style={s.compatText}>
                      {'Doadores notificados: '}
                      <Text style={{ color: Colors.white, fontWeight: '700' }}>
                        {(COMPATIBILIDADE[tipoSang] || [tipoSang]).join(', ')}
                      </Text>
                    </Text>
                  </View>
                )}

                <Text style={s.label}>{'DESCRIÇÃO (opcional)'}</Text>
                <InputField value={descricao} onChangeText={setDescricao} placeholder="Ex: Cirurgia urgente no Hospital..." icon="file-text" multiline />
              </View>

              {/* Localização */}
              <View style={s.formCard}>
                <Text style={s.formTitle}>{'📍 Localização'}</Text>
                <Text style={s.locDesc}>
                  {'Ajuda os doadores a saber onde te encontrar.'}
                </Text>

                {latitude !== null ? (
                  <View style={s.locSuccess}>
                    <Feather name="check-circle" size={16} color={Colors.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.locSuccessTitle}>{'Localização capturada'}</Text>
                      <Text style={s.locSuccessText}>{morada}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setLatitude(null); setMorada('') }}>
                      <Feather name="x" size={16} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.locBtn} onPress={capturarLocalizacao} disabled={locLoading}>
                    {locLoading
                      ? <ActivityIndicator size="small" color={Colors.white} />
                      : <Feather name="map-pin" size={16} color={Colors.white} />
                    }
                    <Text style={s.locBtnText}>
                      {locLoading ? 'A capturar...' : 'Capturar localização'}
                    </Text>
                  </TouchableOpacity>
                )}

                {latitude === null && (
                  <View>
                    <Text style={[s.locDesc, { marginTop: 10, marginBottom: 6 }]}>
                      {'Ou escreve manualmente:'}
                    </Text>
                    <InputField value={morada} onChangeText={setMorada} placeholder="Ex: Rua X, Namibe" icon="map-pin" />
                  </View>
                )}
              </View>

              <View style={s.avisoBox}>
                <Feather name="shield" size={14} color={Colors.gold} />
                <Text style={s.avisoText}>
                  {'Os teus dados de contacto serão partilhados com os doadores que aceitarem ajudar.'}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.btnEnviar, enviando && { opacity: 0.7 }]}
                onPress={handleEnviar}
                disabled={enviando}
              >
                {enviando
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name="send" size={16} color={Colors.white} />
                      <Text style={s.btnEnviarText}>{'Enviar Pedido de Emergência'}</Text>
                    </View>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── SUCESSO + PORTAL ── */}
          {(modo === 'sucesso' || modo === 'portal') && (
            <View>
              {/* Confirmação */}
              <View style={s.sucessoCard}>
                <View style={s.sucessoCircle}>
                  <Feather name="check" size={32} color={Colors.white} />
                </View>
                <Text style={s.sucessoTitle}>{'Pedido Enviado!'}</Text>
                <Text style={s.sucessoSub}>
                  {'Notificámos os doadores compatíveis. Acompanha as respostas abaixo.'}
                </Text>
              </View>

              {/* Info do pedido */}
              <View style={s.portalCard}>
                <View style={s.portalHeader}>
                  <Text style={s.portalTitle}>{'Detalhes do Pedido'}</Text>
                  <View style={[
                    s.estadoBadge,
                    { backgroundColor: pedidoInfo?.estado === 'ativo' ? 'rgba(232,23,58,0.15)' : 'rgba(46,204,113,0.15)' }
                  ]}>
                    <View style={[
                      s.estadoDot,
                      { backgroundColor: pedidoInfo?.estado === 'ativo' ? Colors.red : Colors.green }
                    ]} />
                    <Text style={[
                      s.estadoText,
                      { color: pedidoInfo?.estado === 'ativo' ? Colors.redSoft : Colors.green }
                    ]}>
                      {pedidoInfo?.estado === 'ativo' ? 'ACTIVO' : 'RESOLVIDO'}
                    </Text>
                  </View>
                </View>

                <View style={s.portalInfoRow}>
                  <PedidoInfo label="Tipo" value={tipoSang} color={Colors.redSoft} />
                  <PedidoInfo label="Nome" value={nome} />
                  <PedidoInfo label="Telefone" value={telefone} />
                  <PedidoInfo label="Localização" value={morada || 'Namibe'} />
                </View>
              </View>

              {/* Doadores que responderam */}
              <View style={s.portalCard}>
                <View style={s.portalHeader}>
                  <Text style={s.portalTitle}>{'Respostas dos Doadores'}</Text>
                  <TouchableOpacity onPress={() => loadPortal(pedidoId)} style={s.refreshBtn}>
                    <Feather name="refresh-cw" size={14} color={Colors.muted} />
                    <Text style={s.refreshBtnText}>{'Actualizar'}</Text>
                  </TouchableOpacity>
                </View>

                {portalLoading ? (
                  <ActivityIndicator color={Colors.red} style={{ padding: 20 }} />
                ) : respostas.length === 0 ? (
                  <View style={s.semRespostas}>
                    <Feather name="clock" size={28} color={Colors.muted2} />
                    <Text style={s.semRespostasTitle}>{'A aguardar respostas...'}</Text>
                    <Text style={s.semRespostasText}>
                      {'Os doadores receberam a notificação. Aguarda que aceitem.'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {respostas.map((r: any) => (
                      <View key={r.id} style={s.respostaCard}>
                        <View style={s.respostaAvatar}>
                          <Text style={s.respostaAvatarText}>
                            {(r.voluntarios?.profiles?.nome || 'BH').slice(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.respostaNome}>{r.voluntarios?.profiles?.nome || '—'}</Text>
                          <Text style={s.respostaTipo}>
                            {'Tipo '}
                            {r.voluntarios?.tipo_sanguineo}
                          </Text>
                        </View>
                        <View style={s.respostaContacto}>
                          <Feather name="phone" size={13} color={Colors.green} />
                          <Text style={s.respostaPhone}>{r.voluntarios?.profiles?.telefone || '—'}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Contador */}
                <View style={s.contadorBar}>
                  <Text style={s.contadorText}>
                    {respostas.length}
                    {' de 3 doadores aceitaram'}
                  </Text>
                  <View style={s.contadorDots}>
                    {[0, 1, 2].map(i => (
                      <View
                        key={i}
                        style={[
                          s.contadorDot,
                          i < respostas.length && { backgroundColor: Colors.green }
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </View>

              {/* Acções */}
              <View style={s.portalActions}>
                <TouchableOpacity style={s.btnResolvido} onPress={marcarResolvido}>
                  <Feather name="check-circle" size={16} color={Colors.dark} />
                  <Text style={s.btnResolvidoText}>{'Já recebi ajuda!'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnCancelar} onPress={cancelarPedido}>
                  <Text style={s.btnCancelarText}>{'Cancelar pedido'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function HowStep({ num, text }: { num: string; text: string }) {
  return (
    <View style={s.howStep}>
      <View style={s.howStepNum}>
        <Text style={s.howStepNumText}>{num}</Text>
      </View>
      <Text style={s.howStepText}>{text}</Text>
    </View>
  )
}

function PedidoInfo({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.pedidoInfoItem}>
      <Text style={s.pedidoInfoLabel}>{label}</Text>
      <Text style={[s.pedidoInfoValue, color ? { color } : {}]}>{value}</Text>
    </View>
  )
}

function InputField({ value, onChangeText, placeholder, icon, keyboardType, multiline }: any) {
  const [focus, setFocus] = useState(false)
  return (
    <View style={[
      s.inputWrap,
      focus && s.inputWrapFocus,
      multiline && { height: 80 }
    ]}>
      <Feather
        name={icon}
        size={15}
        color={focus ? Colors.redSoft : Colors.muted2}
        style={{ marginRight: 10 }}
      />
      <TextInput
        style={[
          s.input,
          multiline && { textAlignVertical: 'top', paddingTop: 4 },
          Platform.OS === 'web' ? { outline: 'none' } as any : {}
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.muted2}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.dark },
  bgGlow:  { position: 'absolute', top: -100, left: -80, width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(232,23,58,0.08)' },
  content: { padding: 20, maxWidth: 560, width: '100%', alignSelf: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16,
  },
  backBtn:         { padding: 6 },
  headerLogo:      { fontSize: 18, fontWeight: '800', color: Colors.white, flex: 1 },
  urgentBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(232,23,58,0.15)', borderWidth: 1, borderColor: 'rgba(232,23,58,0.3)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  urgentDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
  urgentBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.redSoft, letterSpacing: 0.5 },

  YOSection: { alignItems: 'center', marginBottom: 24, paddingVertical: 16 },
  YOEmoji:   { fontSize: 52, marginBottom: 12 },
  YOTitle:   { fontSize: 28, fontWeight: '800', color: Colors.white, marginBottom: 8, textAlign: 'center' },
  YOSub:     { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 340 },

  howBox:        { backgroundColor: Colors.dark2, borderRadius: 14, padding: 16, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  howStep:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howStepNum:    { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  howStepNumText:{ fontSize: 11, fontWeight: '800', color: Colors.white },
  howStepText:   { fontSize: 13, color: Colors.muted, flex: 1 },

  formCard:  { backgroundColor: Colors.dark2, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 14 },
  label:     { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },

  inputWrap:      { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark3, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)', paddingHorizontal: 13, marginBottom: 4, height: 48 },
  inputWrapFocus: { borderColor: Colors.red, backgroundColor: 'rgba(232,23,58,0.04)' },
  input:          { flex: 1, fontSize: 14, color: Colors.white, height: '100%' as any },

  tiposGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  tipoBtn:           { width: 60, height: 44, borderRadius: 10, backgroundColor: Colors.dark3, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)' },
  tipoBtnActive:     { backgroundColor: 'rgba(232,23,58,0.15)', borderColor: Colors.red },
  tipoBtnText:       { fontSize: 14, fontWeight: '700', color: Colors.muted },
  tipoBtnTextActive: { color: Colors.redSoft },

  compatBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: 'rgba(74,158,255,0.07)', borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)', borderRadius: 8, padding: 10, marginBottom: 4 },
  compatText:{ fontSize: 12, color: Colors.muted, flex: 1, lineHeight: 17 },

  locDesc:          { fontSize: 12, color: Colors.muted, lineHeight: 17, marginBottom: 12 },
  locBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.blue, borderRadius: 10, padding: 13 },
  locBtnText:       { fontSize: 13, fontWeight: '700', color: Colors.white },
  locSuccess:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(46,204,113,0.08)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.25)', borderRadius: 10, padding: 13 },
  locSuccessTitle:  { fontSize: 13, fontWeight: '700', color: Colors.green, marginBottom: 2 },
  locSuccessText:   { fontSize: 12, color: Colors.muted },

  avisoBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(232,180,75,0.07)', borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)', borderRadius: 12, padding: 14, marginBottom: 20 },
  avisoText:{ flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },

  btnEnviar:     { backgroundColor: Colors.red, borderRadius: 14, padding: 16, alignItems: 'center', shadowColor: Colors.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6, marginBottom: 8 },
  btnEnviarText: { fontSize: 15, fontWeight: '800', color: Colors.white },

  // Sucesso
  sucessoCard:   { alignItems: 'center', backgroundColor: Colors.dark2, borderRadius: 18, padding: 28, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  sucessoCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: Colors.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  sucessoTitle:  { fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  sucessoSub:    { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 19 },

  // Portal
  portalCard:    { backgroundColor: Colors.dark2, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  portalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  portalTitle:   { fontSize: 14, fontWeight: '700', color: Colors.white },
  portalInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  estadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  estadoDot:   { width: 6, height: 6, borderRadius: 3 },
  estadoText:  { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  pedidoInfoItem:  { minWidth: '45%', flex: 1 },
  pedidoInfoLabel: { fontSize: 9, color: Colors.muted2, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  pedidoInfoValue: { fontSize: 13, fontWeight: '600', color: Colors.white },

  refreshBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 },
  refreshBtnText: { fontSize: 11, color: Colors.muted },

  semRespostas:      { alignItems: 'center', padding: 24, gap: 8 },
  semRespostasTitle: { fontSize: 14, fontWeight: '600', color: Colors.white },
  semRespostasText:  { fontSize: 12, color: Colors.muted, textAlign: 'center', lineHeight: 17 },

  respostaCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark3, borderRadius: 12, padding: 12 },
  respostaAvatar:  { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  respostaAvatarText: { fontSize: 13, fontWeight: '800', color: Colors.white },
  respostaNome:    { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  respostaTipo:    { fontSize: 11, color: Colors.muted },
  respostaContacto:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  respostaPhone:   { fontSize: 12, fontWeight: '600', color: Colors.green },

  contadorBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  contadorText: { fontSize: 12, color: Colors.muted },
  contadorDots: { flexDirection: 'row', gap: 6 },
  contadorDot:  { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.dark4 },

  portalActions: { gap: 10, marginBottom: 20 },
  btnResolvido:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.green, borderRadius: 12, padding: 14 },
  btnResolvidoText: { fontSize: 14, fontWeight: '700', color: Colors.dark },
  btnCancelar:      { borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  btnCancelarText:  { fontSize: 14, color: Colors.muted },
})