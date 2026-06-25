// app/(auth)/registar-ong.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator,
  Alert, Platform, useWindowDimensions
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'

const STEPS = ['Organização', 'Responsável', 'Documentos']

export default function RegistarOng() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [step, setStep] = useState(0)

  // Step 1
  const [nome, setNome]               = useState('')
  const [tipo, setTipo]               = useState('associacao')
  const [nif, setNif]                 = useState('')
  const [numeroRegisto, setNumeroRegisto] = useState('')
  const [provincia, setProvincia]     = useState('Namibe')
  const [municipio, setMunicipio]     = useState('Namibe')
  const [descricao, setDescricao]     = useState('')

  // Step 2
  const [responsavelNome, setResponsavelNome] = useState('')
  const [responsavelContacto, setResponsavelContacto] = useState('')
  const [telefone, setTelefone]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')

  // Step 3
  const [documento, setDocumento]     = useState<{ uri: string; name: string; mimeType?: string } | null>(null)
  const [enviando, setEnviando]       = useState(false)

  const tipos = [
    { val: 'associacao', label: 'Associação', emoji: '🏢' },
    { val: 'religiosa',  label: 'Religiosa',  emoji: '⛪' },
    { val: 'juvenil',    label: 'Juvenil',    emoji: '🌍' },
    { val: 'outro',      label: 'Outro',      emoji: '🤝' },
  ]

  function validarStep(): boolean {
    if (step === 0) {
      if (!nome || !nif || !numeroRegisto) {
        mostrarAlerta('Campos obrigatórios', 'Preenche nome, NIF e número de registo.')
        return false
      }
    }
    if (step === 1) {
      if (!responsavelNome || !responsavelContacto || !telefone || !email || !password) {
        mostrarAlerta('Campos obrigatórios', 'Preenche todos os dados do responsável e acesso.')
        return false
      }
      if (password.length < 6) {
        mostrarAlerta('Palavra-passe fraca', 'Mínimo 6 caracteres.')
        return false
      }
    }
    return true
  }

  function handleNext() {
    if (!validarStep()) return
    if (step < STEPS.length - 1) setStep(step + 1)
  }

  async function escolherDocumento() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (!result.canceled && result.assets[0]) {
      const file = result.assets[0]
      setDocumento({ uri: file.uri, name: file.name, mimeType: file.mimeType })
    }
  }

  async function handleSubmeter() {
  if (!documento) {
    mostrarAlerta('Documento obrigatório', 'Anexa o certificado de registo legal.')
    return
  }
  setEnviando(true)
  try {
    // 1. Criar conta Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(), password,
    })
    if (authError) throw authError
    const userId = authData.user?.id
    if (!userId) throw new Error('Erro ao criar conta.')

    // 2. Criar perfil — aguarda um pouco para o Auth propagar
    await new Promise(r => setTimeout(r, 1000))
    const { error: profError } = await supabase.from('profiles').upsert({
      id: userId, nome: nome.trim(),
      email: email.trim(), telefone: telefone.trim(), tipo: 'ong',
    })
    if (profError) throw profError

    // 3. Upload documento
    const ext = documento.name.split('.').pop()
    const fileName = `${Date.now()}_${nif.replace(/\D/g,'')}.${ext}`
    const response = await fetch(documento.uri)
    let uploadResult
    if (Platform.OS === 'web') {
      const blob = await response.blob()
      uploadResult = await supabase.storage.from('documentos-ongs')
        .upload(fileName, blob, { contentType: documento.mimeType || 'application/octet-stream' })
    } else {
      const arrayBuffer = await response.arrayBuffer()
      uploadResult = await supabase.storage.from('documentos-ongs')
        .upload(fileName, arrayBuffer, { contentType: documento.mimeType || 'application/octet-stream' })
    }
    if (uploadResult.error) throw uploadResult.error

    // 4. Criar ONG
    const { error: ongError } = await supabase.from('ongs').insert({
      profile_id: userId, nome: nome.trim(), tipo, nif: nif.trim(),
      numero_registo: numeroRegisto.trim(), provincia, municipio,
      descricao: descricao || null, responsavel_nome: responsavelNome.trim(),
      responsavel_contacto: responsavelContacto.trim(), telefone: telefone.trim(),
      email: email.trim(), documento_url: fileName,
      estado: 'pendente', verificada: false,
    })
    if (ongError) throw ongError

    mostrarAlerta('✅ Registo submetido!', 'Já podes entrar com o teu email e palavra-passe.')
    router.replace({ pathname: '/(auth)/login', params: { email: email.trim() } } as any)
  } catch (e: any) {
    mostrarAlerta('Erro', e.message)
  }
  setEnviando(false)
}

  return (
    <View style={s.root}>

      {/* ── LADO ESQUERDO (web) ── */}
      {isWeb && (
        <View style={s.YOSide}>
          <View style={s.YOGlow} />
          <View style={s.YOContent}>
            <Text style={s.logo}>
              MO<Text style={{ color: Colors.redSoft }}>YO</Text>
            </Text>
            <Text style={s.YOTitle}>
              Parceiros que{'\n'}
              <Text style={{ color: Colors.redSoft, fontStyle: 'italic' }}>multiplicam</Text>{'\n'}
              impacto.
            </Text>
            <Text style={s.YOSub}>
              Junta a tua organização à rede Moyo e ajuda a mobilizar mais doadores no Namibe.
            </Text>

            <View style={s.YOFeatures}>
              <FeatureItem icon="shield" text="Verificação legal transparente" />
              <FeatureItem icon="users" text="Gere os membros da tua ONG" />
              <FeatureItem icon="activity" text="Acompanha o impacto em tempo real" />
            </View>

            <View style={s.statusRow}>
              <View style={s.statusDot} />
              <Text style={s.statusText}>Sistema activo · Namibe</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── LADO DIREITO — FORMULÁRIO ── */}
      <View style={s.formSide}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.formContent}>

            {/* Header mobile */}
            {!isWeb && (
              <Text style={s.logoMobile}>
                MO<Text style={{ color: Colors.redSoft }}>YO</Text>
              </Text>
            )}

            {/* Voltar */}
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Feather name="arrow-left" size={16} color={Colors.muted} />
              <Text style={s.backBtnText}>Voltar ao registo</Text>
            </TouchableOpacity>

            {/* Steps indicator */}
            <View style={s.stepsRow}>
              {STEPS.map((label, i) => (
                <View key={label} style={s.stepItem}>
                  <View style={[s.stepDot, i <= step && s.stepDotActive]}>
                    {i < step
                      ? <Feather name="check" size={12} color={Colors.white} />
                      : <Text style={[s.stepDotText, i <= step && { color: Colors.white }]}>{i + 1}</Text>
                    }
                  </View>
                  {i < STEPS.length - 1 && <View style={[s.stepLine, i < step && s.stepLineActive]} />}
                </View>
              ))}
            </View>

            <Text style={s.formTitle}>Registar ONG Parceira</Text>
            <Text style={s.formSub}>Passo {step + 1} de {STEPS.length} · {STEPS[step]}</Text>

            {/* ── STEP 0: ORGANIZAÇÃO ── */}
            {step === 0 && (
              <>
                <View style={s.avisoBox}>
                  <Feather name="shield" size={16} color={Colors.blue} />
                  <Text style={s.avisoText}>
                    Todas as ONGs passam por verificação legal dos documentos antes de serem activadas.
                  </Text>
                </View>

                <Label>NOME DA ORGANIZAÇÃO *</Label>
                <Input value={nome} onChangeText={setNome} placeholder="Ex: Associação Mãos Unidas" />

                <Label>TIPO DE ORGANIZAÇÃO</Label>
                <View style={s.tiposRow}>
                  {tipos.map(t => (
                    <TouchableOpacity
                      key={t.val}
                      style={[s.tipoSel, tipo === t.val && s.tipoSelActive]}
                      onPress={() => setTipo(t.val)}
                    >
                      <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                      <Text style={[s.tipoSelText, tipo === t.val && { color: Colors.redSoft }]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Label>NIF (Identificação Fiscal) *</Label>
                <Input value={nif} onChangeText={setNif} placeholder="Ex: 5417123456" keyboardType="numeric" />

                <Label>NÚMERO DE REGISTO / ALVARÁ *</Label>
                <Input value={numeroRegisto} onChangeText={setNumeroRegisto} placeholder="Nº do certificado de constituição" />

                <View style={s.row2}>
                  <View style={{ flex: 1 }}>
                    <Label>PROVÍNCIA</Label>
                    <Input value={provincia} onChangeText={setProvincia} placeholder="Namibe" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Label>MUNICÍPIO</Label>
                    <Input value={municipio} onChangeText={setMunicipio} placeholder="Namibe" />
                  </View>
                </View>

                <Label>DESCRIÇÃO DA MISSÃO</Label>
                <Input value={descricao} onChangeText={setDescricao} placeholder="Descreve a actividade da organização..." multiline />
              </>
            )}

            {/* ── STEP 1: RESPONSÁVEL + ACESSO ── */}
            {step === 1 && (
              <>
                <Text style={s.sectionLabel}>RESPONSÁVEL LEGAL</Text>

                <Label>NOME COMPLETO *</Label>
                <Input value={responsavelNome} onChangeText={setResponsavelNome} placeholder="Nome do representante legal" />

                <Label>Nº DO BI DO RESPONSÁVEL *</Label>
                <Input value={responsavelContacto} onChangeText={setResponsavelContacto} placeholder="Número do bilhete de identidade" />

                <Label>TELEFONE DA ORGANIZAÇÃO *</Label>
                <Input value={telefone} onChangeText={setTelefone} placeholder="+244 9XX XXX XXX" keyboardType="phone-pad" />

                <Text style={[s.sectionLabel, { marginTop: 24 }]}>ACESSO À PLATAFORMA</Text>
                <Text style={s.sectionHint}>
                  Estas credenciais serão usadas para acederes ao painel da tua ONG.
                </Text>

                <Label>EMAIL *</Label>
                <Input value={email} onChangeText={setEmail} placeholder="contacto@ong.ao" keyboardType="email-address" autoCapitalize="none" />

                <Label>PALAVRA-PASSE *</Label>
                <Input value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry />
              </>
            )}

            {/* ── STEP 2: DOCUMENTOS ── */}
            {step === 2 && (
              <>
                <View style={s.resumoBox}>
                  <Text style={s.resumoTitle}>RESUMO DO REGISTO</Text>
                  <ResumoRow label="Organização" value={nome} />
                  <ResumoRow label="NIF" value={nif} mono />
                  <ResumoRow label="Nº Registo" value={numeroRegisto} mono />
                  <ResumoRow label="Responsável" value={responsavelNome} />
                  <ResumoRow label="Email de acesso" value={email} />
                  <ResumoRow label="Localização" value={`${municipio}, ${provincia}`} />
                </View>

                <Label>DOCUMENTO LEGAL *</Label>
                <Text style={s.docDesc}>
                  Anexa o certificado de registo / estatutos / alvará (PDF ou foto legível).
                </Text>
                <TouchableOpacity style={s.docBtn} onPress={escolherDocumento}>
                  <Feather name={documento ? 'check-circle' : 'upload'} size={18} color={documento ? Colors.green : Colors.white} />
                  <Text style={[s.docBtnText, documento && { color: Colors.green }]}>
                    {documento ? documento.name : 'Anexar Documento'}
                  </Text>
                </TouchableOpacity>

                <View style={s.infoBox}>
                  <Feather name="clock" size={14} color={Colors.gold} />
                  <Text style={s.infoBoxText}>
                    A verificação leva geralmente 2-5 dias úteis. Receberás uma notificação quando a tua ONG for aprovada.
                  </Text>
                </View>
              </>
            )}

            {/* Navegação */}
            <View style={s.navRow}>
              {step > 0 && (
                <TouchableOpacity style={s.btnVoltar} onPress={() => setStep(step - 1)}>
                  <Text style={s.btnVoltarText}>← Voltar</Text>
                </TouchableOpacity>
              )}
              {step < STEPS.length - 1 ? (
                <TouchableOpacity style={s.btnSeguinte} onPress={handleNext}>
                  <Text style={s.btnSeguinteText}>Seguinte →</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.btnSeguinte, enviando && { opacity: 0.7 }]}
                  onPress={handleSubmeter}
                  disabled={enviando}
                >
                  {enviando
                    ? <ActivityIndicator size="small" color={Colors.white} />
                    : <Text style={s.btnSeguinteText}>Submeter Registo</Text>
                  }
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={s.loginLink}>
                Já tens conta? <Text style={{ color: Colors.redSoft, fontWeight: '700' }}>Entrar</Text>
              </Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

// ── Componentes auxiliares ──────────────
function FeatureItem({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  return (
    <View style={s.featureItem}>
      <View style={s.featureIcon}>
        <Feather name={icon} size={14} color={Colors.redSoft} />
      </View>
      <Text style={s.featureText}>{text}</Text>
    </View>
  )
}

function ResumoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.resumoRow}>
      <Text style={s.resumoLabel}>{label}</Text>
      <Text style={[s.resumoValue, mono && { fontFamily: 'monospace', fontSize: 12 }]}>{value || '—'}</Text>
    </View>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={s.label}>{children}</Text>
}
function Input(props: any) {
  return (
    <TextInput
      style={[s.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
      placeholderTextColor={Colors.muted2}
      {...props}
    />
  )
}

// ── Estilos ─────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: Colors.dark },

  // Lado esquerdo
  YOSide: {
    flex: 1, backgroundColor: Colors.dark2,
    padding: 48, justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)',
  },
  YOGlow: {
    position: 'absolute', top: -100, right: -100,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(74,158,255,0.12)',
  },
  YOContent: { maxWidth: 440 },
  logo: { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 40 },
  logoMobile: { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 20, textAlign: 'center' },
  YOTitle: { fontSize: 40, fontWeight: '800', color: Colors.white, lineHeight: 48, marginBottom: 16 },
  YOSub: { fontSize: 14, color: Colors.muted, lineHeight: 22, marginBottom: 32 },

  YOFeatures: { gap: 14, marginBottom: 40 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.redGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { fontSize: 13, color: Colors.offWhite, fontWeight: '500' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  statusText: { fontSize: 12, color: Colors.muted },

  // Lado direito — form
  formSide: { flex: 1, backgroundColor: Colors.dark },
  formContent: { padding: 32, maxWidth: 480, width: '100%', alignSelf: 'center' },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 },
  backBtnText: { fontSize: 13, color: Colors.muted },

  // Steps
  stepsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.dark3,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  stepDotActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  stepDotText: { fontSize: 12, fontWeight: '700', color: Colors.muted },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.dark3, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: Colors.red },

  formTitle: { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  formSub: { fontSize: 13, color: Colors.muted, marginBottom: 24 },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: Colors.redSoft, letterSpacing: 1, marginBottom: 4 },
  sectionHint: { fontSize: 12, color: Colors.muted, marginBottom: 16, lineHeight: 17 },

  avisoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(74,158,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)',
    borderRadius: 12, padding: 13, marginBottom: 20,
  },
  avisoText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },

  label: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 13, fontSize: 14, color: Colors.white,
  },
  row2: { flexDirection: 'row', gap: 12 },

  tiposRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  tipoSel: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tipoSelActive: { backgroundColor: Colors.redGlow, borderColor: Colors.red },
  tipoSelText: { fontSize: 12, fontWeight: '600', color: Colors.muted },

  // Resumo
  resumoBox: {
    backgroundColor: Colors.dark2, borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  resumoTitle: { fontSize: 10, fontWeight: '800', color: Colors.muted, letterSpacing: 1, marginBottom: 12 },
  resumoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resumoLabel: { fontSize: 12, color: Colors.muted },
  resumoValue: { fontSize: 12, fontWeight: '600', color: Colors.white, maxWidth: '60%', textAlign: 'right' },

  // Documento
  docDesc: { fontSize: 12, color: Colors.muted, lineHeight: 17, marginBottom: 6 },
  docBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.15)',
    padding: 16, marginBottom: 16,
  },
  docBtnText: { fontSize: 13, fontWeight: '600', color: Colors.white },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(232,180,75,0.07)',
    borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)',
    borderRadius: 10, padding: 12,
  },
  infoBoxText: { flex: 1, fontSize: 11, color: Colors.muted, lineHeight: 16 },

  // Navegação
  navRow: { flexDirection: 'row', gap: 10, marginTop: 28 },
  btnVoltar: {
    flex: 1, borderRadius: 10, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnVoltarText: { fontSize: 14, fontWeight: '700', color: Colors.muted },
  btnSeguinte: {
    flex: 2, backgroundColor: Colors.red, borderRadius: 10,
    padding: 14, alignItems: 'center',
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnSeguinteText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  loginLink: { fontSize: 13, color: Colors.muted },
})