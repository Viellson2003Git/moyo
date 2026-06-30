// app/(voluntario)/cartao.tsx
import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, useWindowDimensions,
  ScrollView
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'

import { Image } from 'react-native'

import { SafeAreaView } from 'react-native-safe-area-context'

import * as MediaLibrary from 'expo-media-library'
import { captureRef } from 'react-native-view-shot'

// QRCode — importação segura
let QRCode: any = null
try { QRCode = require('react-native-qrcode-svg').default } catch {}

type Voluntario = {
  id: string
  numero_serial: string
  tipo_sanguineo: string | null
  estado: string
  data_nascimento: string | null
  sexo: string | null
  profiles: { nome: string; telefone: string | null }
  bancos_sangue:  { nome: string}
}

const ESTADO_CFG: Record<string, { label: string; cor: string; bg: string }> = {
  apto:         { label: 'Apto para Doar',       cor: Colors.green,   bg: 'rgba(46,204,113,0.12)'  },
  pendente:     { label: 'Pendente de Exames',    cor: Colors.gold,    bg: 'rgba(232,180,75,0.12)'  },
  em_exame:     { label: 'Em Exame',              cor: Colors.blue,    bg: 'rgba(74,158,255,0.12)'  },
  inapto_temp:  { label: 'Inapto Temporário',     cor: Colors.redSoft, bg: 'rgba(232,23,58,0.12)'   },
  inapto_perm:  { label: 'Inapto Permanente',     cor: Colors.redSoft, bg: 'rgba(232,23,58,0.12)'   },
}

export default function Cartao() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 768

  const [vol, setVol]         = useState<Voluntario | null>(null)
  const [loading, setLoading] = useState(true)
  const [baixando, setBaixando] = useState(false)
  const cartaoRef = useRef<any>(null)

  const [exames, setExames] = useState<any[]>([])

// No loadVoluntario, após buscar o voluntário:


  useEffect(() => { loadVoluntario() }, [])

  async function loadVoluntario() {
  const { data: { session } } = await supabase.auth.getSession()
const user = session?.user
  if (!user) { router.replace('/(auth)/login'); return }

  const { data } = await supabase
    .from('voluntarios')
    .select('id, numero_serial, tipo_sanguineo, estado, data_nascimento, sexo, profiles(nome, telefone), bancos_sangue(nome)')
    .eq('profile_id', user.id)
    .single()

  if (!data) { setLoading(false); return }

  setVol(data as any)

  // ✅ Query dos exames AQUI, dentro da função, antes do setLoading
  const { data: examesData, error } = await supabase
  .from('exames')
  .select('id, tipo_sanguineo, fator_rh, hemoglobina, pressao_arterial, peso, resultado, data_exame, observacoes')
  .eq('voluntario_id', data.id)
  .order('data_exame', { ascending: false })
  .limit(5)

  console.log('EXAMES:', examesData)
  console.log('ERRO:', error)
  setExames(examesData || [])
  setLoading(false)  // ← só aqui, depois de tudo
}

  async function handleBaixarCartao() {
  setBaixando(true)
  try {
    if (Platform.OS === 'web') {
      const html2canvas = (await import('html2canvas' as any)).default
      const elemento = document.getElementById('cartao-digital')
      if (!elemento) { setBaixando(false); return }
      const canvas = await html2canvas(elemento, {
        backgroundColor: '#13131A', scale: 2, useCORS: true, logging: false,
      })
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
      link.download = `moyo-cartao-${vol?.numero_serial || 'doador'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      mostrarAlerta('✅ Descarregado!', 'O teu cartão foi guardado.')
   } else {
  const { shareAsync } = await import('expo-sharing')
  
  const uri = await captureRef(cartaoRef, { format: 'png', quality: 1 })
  
  await shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Guardar ou partilhar cartão Moyo',
  })
}
  } catch (err) {
    mostrarAlerta('Erro', 'Não foi possível guardar o cartão.')
  }
  setBaixando(false)
}

  async function handlePartilhar() {
    if (Platform.OS === 'web') {
      if (navigator.share) {
        await navigator.share({
          title: 'Cartão Moyo',
          text: `Cartão de doador Moyo — ${vol?.numero_serial}`,
        })
      } else {
        // Copia o serial para a área de transferência
        navigator.clipboard.writeText(vol?.numero_serial || '')
        mostrarAlerta('✅ Copiado!', 'Número de série copiado para a área de transferência.')
      }
    }
  }

  function PassoItem({ numero, texto }: { numero: string; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <View style={{
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: Colors.redGlow, borderWidth: 1, borderColor: Colors.red,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.redSoft }}>{numero}</Text>
      </View>
      <Text style={{ fontSize: 13, color: Colors.muted, flex: 1 }}>{texto}</Text>
    </View>
  )
}

  {/* Resultados Médicos */}
  {exames.length > 0 && (
    <View style={s.examesSection}>
      <Text style={s.examesTitle}>🔬 Resultados Médicos</Text>
      {exames.map(e => {
        const aprovado = e.resultado === 'aprovado' || e.resultado === 'apto'
        const reprovado = e.resultado === 'reprovado' || e.resultado === 'inapto'
        return (
          <View key={e.id} style={s.exameCard}>
            <View style={s.exameIcone}>
              <Feather
                name={aprovado ? 'check-circle' : reprovado ? 'x-circle' : 'clock'}
                size={18}
                color={aprovado ? Colors.green : reprovado ? Colors.redSoft : Colors.gold}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.exameTipo}>{e.tipo_sanguineo}</Text>
              <Text style={s.exameData}>
                {new Date(e.data_exame).toLocaleDateString('pt-PT', {
                  day: '2-digit', month: 'long', year: 'numeric'
                })}
              </Text>
              {e.observacoes && (
                <Text style={s.exameObs}>{e.observacoes}</Text>
              )}
            </View>
            <View style={[s.exameResultado, {
              backgroundColor: aprovado ? 'rgba(46,204,113,0.1)' : reprovado ? 'rgba(232,23,58,0.1)' : 'rgba(232,180,75,0.1)'
            }]}>
              <Text style={[s.exameResultadoText, {
                color: aprovado ? Colors.green : reprovado ? Colors.redSoft : Colors.gold
              }]}>
                {aprovado ? 'Aprovado' : reprovado ? 'Reprovado' : 'Pendente'}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )}

  {exames.length === 0 && vol?.estado === 'pendente' && (
    <View style={s.examesPendenteBox}>
      <Feather name="clock" size={16} color={Colors.gold} />
      <Text style={s.examesPendenteText}>
        Ainda sem resultados médicos. Dirige-te ao <Text style={{ fontWeight: '700', color: Colors.white }}> {(vol.bancos_sangue as any)?.nome || 'hospital mais próximo'}</Text>para realizar os exames de triagem.
      </Text>
    </View>
  )}

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  if (!vol) return (
    <View style={s.center}>
      <Feather name="alert-circle" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
      <Text style={s.semDadosText}>Perfil de voluntário não encontrado</Text>
      <TouchableOpacity style={s.voltarBtn} onPress={() => router.back()}>
        <Text style={s.voltarBtnText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  )

  const estCfg = ESTADO_CFG[vol.estado] || ESTADO_CFG['pendente']

  // Valor do QR — SEMPRE só o serial, nunca depende do tipo sanguíneo
  const qrValue = vol.numero_serial

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={[s.topbar]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Feather name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.topbarTitle}>Meu Cartão Digital</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={s.topbarShareBtn} onPress={handlePartilhar}>
          <Feather name="share-2" size={18} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120, alignItems: 'center', paddingTop: 24 }}
      >
        {/* ══ CARTÃO DIGITAL ══ */}
        <View
          id="cartao-digital"
          ref={cartaoRef}
          style={[s.cartao, isWeb && s.cartaoWeb]}
        >
          {/* Glow decorativo */}
          <View style={s.cartaoGlow1} />
          <View style={s.cartaoGlow2} />

          {/* Header do cartão */}
         
          <View style={s.cartaoHeader}>
            <View style={s.cartaoLogoWrap}>
              {/* Logo criado pelo utilizador */}
              <Image
                source={require('../../assets/icon.png')}
                style={s.cartaoLogoImg}
                resizeMode="contain"
              />
              <Text style={s.cartaoLogoText}>
                MO<Text style={{ color: Colors.redSoft }}>YO</Text>
              </Text>
            </View>
            <View style={s.cartaoHospital}>
              <Text style={s.cartaoHospitalText}>Hospital Ngola Kimbanda</Text>
              <Text style={s.cartaoHospitalSub}>Namibe · Angola</Text>
          </View>
          <View style={s.cartaoAno}>
            <Text style={s.cartaoAnoText}>{new Date().getFullYear()}</Text>
          </View>
        </View>

          {/* Divider */}
          <View style={s.cartaoDivider} />

          {/* Conteúdo principal */}
          <View style={s.cartaoBody}>
            {/* Lado esquerdo — info */}
            <View style={s.cartaoInfo}>
              <Text style={s.cartaoLabel}>NOME</Text>
              <Text style={s.cartaoNome} numberOfLines={1}>
                {(vol.profiles as any)?.nome || '—'}
              </Text>

              <View style={s.cartaoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cartaoLabel}>Nº SÉRIE</Text>
                  <Text style={s.cartaoSerial}>{vol.numero_serial}</Text>
                </View>
                <View>
                  <Text style={s.cartaoLabel}>TIPO SANG.</Text>
                  <Text style={[s.cartaoTipoSang, { color: Colors.redSoft }]}>
                    {vol.tipo_sanguineo || '—'}
                  </Text>
                </View>
              </View>

              {/* Estado */}
              <View style={[s.cartaoEstado, { backgroundColor: estCfg.bg, borderColor: estCfg.cor + '40' }]}>
                <View style={[s.cartaoEstadoDot, { backgroundColor: estCfg.cor }]} />
                <Text style={[s.cartaoEstadoText, { color: estCfg.cor }]}>{estCfg.label}</Text>
              </View>
            </View>

            {/* QR Code — sempre visível, valor = numero_serial */}
            <View style={s.cartaoQRWrap}>
              {QRCode ? (
                <View style={s.cartaoQRBox}>
                  <QRCode
                    value={qrValue}
                    size={78}
                    backgroundColor="white"
                    color="#13131A"
                    quietZone={6}
                  />
                </View>
              ) : (
               
                Platform.OS === 'web' ? (
                  <View style={s.cartaoQRBox}>
                    {/* @ts-ignore */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrValue)}&bgcolor=FFFFFF&color=13131A&margin=4`}
                      width={78}
                      height={78}
                      alt="QR Code"
                      style={{ borderRadius: 4 } as any}
                    />
                  </View>
                ) : (
                  <View style={[s.cartaoQRBox, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 10, color: Colors.muted, textAlign: 'center' }}>
                      Instala{'\n'}react-native-qrcode-svg
                    </Text>
                  </View>
                )
              )}
              <Text style={s.cartaoQRLabel}>Scan para verificar</Text>
            </View>
          </View>

          {/* Rodapé */}
          <View style={s.cartaoFooter}>
            <Text style={s.cartaoFooterText}>
              🩸 Sistema de Gestão de Doação de Sangue · moyo.ao
            </Text>
          </View>
        </View>

        {/* Info extra abaixo do cartão */}
        <View style={s.infoSection}>
          <View style={s.infoCard}>
            <Feather name="info" size={14} color={Colors.blue} />
            <Text style={s.infoCardText}>
              Apresenta este QR Code ao enfermeiro na recepção para fazer check-in.
            </Text>
          </View>

          {vol.estado === 'pendente' && (
            <View style={[s.infoCard, { borderColor: 'rgba(232,180,75,0.3)', backgroundColor: 'rgba(232,180,75,0.07)' }]}>
              <Feather name="clock" size={14} color={Colors.gold} />
              <Text style={[s.infoCardText, { color: Colors.gold }]}>
                Dirige-te ao Hospital Ngola Kimbanda com este QR para realizar os exames de triagem gratuitos.
              </Text>
            </View>
          )}
        </View>

        {/* Botões */}
        <View style={s.botoesWrap}>
          <TouchableOpacity
            style={[s.btnDownload, baixando && { opacity: 0.7 }]}
            onPress={handleBaixarCartao}
            disabled={baixando}
          >
            {baixando
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <>
                  <Feather name="download" size={16} color={Colors.white} />
                  <Text style={s.btnDownloadText}>Descarregar Cartão</Text>
                </>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.btnPartilhar} onPress={handlePartilhar}>
            <Feather name="share-2" size={16} color={Colors.white} />
            <Text style={s.btnPartilharText}>Partilhar</Text>
          </TouchableOpacity>
        </View>


        {/* ══ RESULTADOS MÉDICOS — secção separada ══ */}
        <View style={s.examesSecaoSep}>
          <View style={s.examesSecaoHeader}>
            <Text style={s.examesSecaoTitulo}>🔬 Resultados Médicos</Text>
            <Text style={s.examesSecaoSub}>
              Exames realizados no Hospital Ngola Kimbanda
            </Text>
          </View>

          {exames.length === 0 ? (
            <View style={s.examesPendente}>
              <View style={s.examesPendenteIcone}>
                <Text style={{ fontSize: 32 }}>🧪</Text>
              </View>
              <Text style={s.examesPendenteTitulo}>Sem resultados ainda</Text>
              <Text style={s.examesPendenteDesc}>
                Após realizares os exames de triagem no hospital, os resultados aparecerão aqui automaticamente.
              </Text>
              {vol.estado === 'pendente' && (
                <View style={s.examesPendentePassos}>
                  <PassoItem numero="1" texto="Vai ao Hospital Ngola Kimbanda" />
                  <PassoItem numero="2" texto="Mostra o teu QR Code na recepção" />
                  <PassoItem numero="3" texto="Realiza os exames de triagem gratuitos" />
                  <PassoItem numero="4" texto="Os resultados aparecem aqui" />
                </View>
              )}
            </View>
          ) : (
           <View style={s.examesList}>
            {exames.map(e => {
              const aprovado  = ['aprovado','apto','normal'].includes(e.resultado?.toLowerCase() || '')
              const reprovado = ['reprovado','inapto','alterado'].includes(e.resultado?.toLowerCase() || '')
              const cor = aprovado ? Colors.green : reprovado ? Colors.redSoft : Colors.gold

              return (
                <View key={e.id} style={[s.exameItem, { borderLeftColor: cor }]}>
                  <View style={{ flex: 1, gap: 6 }}>

                    {/* Badge resultado */}
                    <View style={[s.exameResultBadge, { backgroundColor: cor + '18', borderColor: cor + '40', alignSelf: 'flex-start' }]}>
                      <Feather name={aprovado ? 'check-circle' : reprovado ? 'x-circle' : 'clock'} size={13} color={cor} />
                      <Text style={[s.exameResultText, { color: cor }]}>
                        {aprovado ? 'Aprovado' : reprovado ? 'Reprovado' : 'Pendente'}
                      </Text>
                    </View>

                    {/* Data */}
                    <Text style={s.exameData}>
                      {new Date(e.data_exame).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </Text>

                    {/* Métricas */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      {e.tipo_sanguineo && (
                        <View style={s.metricaBadge}>
                          <Text style={s.metricaLabel}>Tipo Sang.</Text>
                         
                        <Text style={s.metricaValor}>{e.tipo_sanguineo} {e.fator_rh || ''}</Text>
                        </View>
                      )}
                      {e.hemoglobina && (
                        <View style={s.metricaBadge}>
                          <Text style={s.metricaLabel}>Hemoglobina</Text>
                          <Text style={s.metricaValor}>{e.hemoglobina} g/dL</Text>
                        </View>
                      )}
                      {e.pressao_arterial && (
                        <View style={s.metricaBadge}>
                          <Text style={s.metricaLabel}>Pressão Art.</Text>
                          <Text style={s.metricaValor}>{e.pressao_arterial} mmHg</Text>
                        </View>
                      )}
                      {e.peso && (
                        <View style={s.metricaBadge}>
                          <Text style={s.metricaLabel}>Peso</Text>
                          <Text style={s.metricaValor}>{e.peso} kg</Text>
                        </View>
                      )}
                    </View>

                    {e.observacoes && (
                      <Text style={s.exameObs}>📝 {e.observacoes}</Text>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
          )}
        </View>

    </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark, padding: 24 },
  semDadosText: { fontSize: 15, color: Colors.muted, textAlign: 'center', marginBottom: 16 },
  voltarBtn: { backgroundColor: Colors.red, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  voltarBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  topbarTitle:    { fontSize: 16, fontWeight: '700', color: Colors.white },
  topbarShareBtn: { padding: 8 },

  // Cartão
  cartao: {
    width: '92%', backgroundColor: '#13131A',
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 12,
    position: 'relative',
  },
  cartaoWeb: { width: 340 },

  cartaoLogoWrap: {
  flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  cartaoLogoImg: {
    width: 28, height: 28,
  },
cartaoLogoText: {
  fontSize: 15, fontWeight: '800', color: Colors.white,
},
  cartaoGlow1: {
    position: 'absolute', top: -60, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(232,23,58,0.15)',
  },
  cartaoGlow2: {
    position: 'absolute', bottom: -40, left: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(74,158,255,0.08)',
  },

  cartaoHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    gap: 10,
  },
  cartaoLogo:      { backgroundColor: Colors.red, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  
  cartaoHospital:  { flex: 1 },
  cartaoHospitalText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  cartaoHospitalSub:  { fontSize: 9, color: Colors.muted2, marginTop: 1 },
  cartaoAno:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  cartaoAnoText:   { fontSize: 11, fontWeight: '700', color: Colors.muted },

  cartaoDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 20 },

  cartaoBody: { flexDirection: 'row', padding: 20, gap: 16, alignItems: 'center' },

  cartaoInfo:  { flex: 1 },
  cartaoLabel: { fontSize: 9, fontWeight: '700', color: Colors.muted2, letterSpacing: 0.8, marginBottom: 3, marginTop: 10 },
  cartaoNome:  { fontSize: 14, fontWeight: '800', color: Colors.white },
  cartaoRow:   { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  cartaoSerial:  { 
    fontSize: 10, 
    fontWeight: '700', 
    color: Colors.redSoft, 
    fontFamily: 'monospace', 
  flexShrink: 1},

  cartaoTipoSang:{ fontSize: 20, fontWeight: '900' },

  cartaoEstado: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 5,
    alignSelf: 'flex-start', marginTop: 10,
  },
  cartaoEstadoDot:  { width: 6, height: 6, borderRadius: 3 },
  cartaoEstadoText: { fontSize: 10, fontWeight: '700' },

  cartaoQRWrap: { alignItems: 'center', gap: 6 },
  cartaoQRBox: {
    backgroundColor: '#fff', borderRadius: 10,
    padding: 6, alignItems: 'center', justifyContent: 'center',
    width: 90, height: 90,
  },
  cartaoQRLabel: { fontSize: 9, color: Colors.muted2, fontWeight: '500' },

  cartaoFooter: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    padding: 12, alignItems: 'center',
  },
  cartaoFooterText: { fontSize: 9, color: Colors.muted2, textAlign: 'center' },

  // Info
  infoSection: { width: 340, gap: 10, marginTop: 16 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(74,158,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: 12, padding: 12,
  },
  infoCardText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },

  // Botões
  botoesWrap: { flexDirection: 'row', gap: 10, marginTop: 16, width: 340 },
  btnDownload: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.red, borderRadius: 12, padding: 14,
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDownloadText: { fontSize: 14, fontWeight: '700', color: Colors.white },
  btnPartilhar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.dark2, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnPartilharText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  examesSection: {
  width: 340, marginTop: 16,
  backgroundColor: Colors.dark2,
  borderRadius: 16, padding: 18,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
},
examesTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 14 },
exameCard: {
  flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  backgroundColor: Colors.dark3, borderRadius: 12,
  padding: 12, marginBottom: 8,
},
exameIcone: {
  width: 34, height: 34, borderRadius: 10,
  backgroundColor: Colors.dark4,
  alignItems: 'center', justifyContent: 'center',
},

exameResultado: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
exameResultadoText: { fontSize: 11, fontWeight: '700' },

examesPendenteBox: {
  width: 340, flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  backgroundColor: 'rgba(232,180,75,0.07)',
  borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)',
  borderRadius: 12, padding: 14, marginTop: 16,
},
examesPendenteText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },

// Secção de resultados médicos — separada do cartão
examesSecaoSep: {
  width: '92%', maxWidth: 400, marginTop: 24,
  backgroundColor: Colors.dark2, borderRadius: 20,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  overflow: 'hidden',
},
examesSecaoHeader: {
  padding: 20, borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.06)',
},
examesSecaoTitulo: { fontSize: 16, fontWeight: '800', color: Colors.white, marginBottom: 4 },
examesSecaoSub:    { fontSize: 12, color: Colors.muted },

examesPendente:      { padding: 28, alignItems: 'center' },
examesPendenteIcone: { marginBottom: 14 },
examesPendenteTitulo:{ fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 8 },
examesPendenteDesc:  { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
examesPendentePassos:{ width: '100%' },

examesList: { padding: 16, gap: 10 },
exameItem: {
  flexDirection: 'row', alignItems: 'center', gap: 14,
  backgroundColor: Colors.dark3, borderRadius: 12,
  padding: 14, borderLeftWidth: 3,
},
exameTipo:  { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 3 },
exameData:  { fontSize: 11, color: Colors.muted },
exameObs:   { fontSize: 11, color: Colors.muted, marginTop: 4, fontStyle: 'italic' },
exameResultBadge: {
  flexDirection: 'row', alignItems: 'center', gap: 5,
  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  borderWidth: 1,
},
exameResultText: { fontSize: 11, fontWeight: '700' },

metricaBadge: {
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
},
metricaLabel: { fontSize: 9, color: Colors.muted2, fontWeight: '700', marginBottom: 2 },
metricaValor: { fontSize: 13, color: Colors.white, fontWeight: '700' },

})