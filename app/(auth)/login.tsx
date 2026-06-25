// app/(auth)/login.tsx
import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, useWindowDimensions,
  TextInput, KeyboardAvoidingView, ScrollView
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import { obterTelefoneLembrado, guardarTelefoneLembrado, limparTelefoneLembrado } from '../../utils/session'


export default function Login() {

const [verificandoSessao, setVerificandoSessao] = useState(true)
const [modoRapido, setModoRapido]               = useState(false)
const [telefoneLembrado, setTelefoneLembrado]   = useState('')

  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900
  const params = useLocalSearchParams<{ email?: string }>()

  const [modoAuth, setModoAuth] = useState<'email' | 'telefone'>('telefone')
  const [loading, setLoading]   = useState(false)

  // Modo Email
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [focusEmail, setFocusEmail] = useState(false)
  const [focusPass, setFocusPass]   = useState(false)

  // Modo Telefone
  const [telefone, setTelefone]   = useState('')
  const [focusTel, setFocusTel]   = useState(false)
  const [showPin, setShowPin]     = useState(false)
  const [pin, setPin]             = useState('')
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', ''])
  const pinRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)]

  const [nomeEncontrado, setNomeEncontrado] = useState<string | null>(null)
  const [verificandoTel, setVerificandoTel] = useState(false)

  // Pré-preenche email vindo do cadastro
  useEffect(() => {
    if (params.email) { setEmail(params.email); setModoAuth('email') }
  }, [params.email])

  // Verifica o telefone assim que tiver dígitos suficientes
  useEffect(() => {
    const numeros = telefone.replace(/\D/g, '')
    if (numeros.length >= 9) {
      verificarTelefone()
    } else {
      setNomeEncontrado(null)
    }
  }, [telefone])

  useEffect(() => {
  checarTelefoneLembrado()
}, [])

async function checarTelefoneLembrado() {
  const lembrado = await obterTelefoneLembrado()
  if (lembrado?.valido) {
    setTelefoneLembrado(lembrado.telefone)
    setTelefone(lembrado.telefone)
    setModoRapido(true)
    setModoAuth('telefone')
  } else if (lembrado && !lembrado.valido) {
    await limparTelefoneLembrado()
  }
  setVerificandoSessao(false)
}

function usarOutroNumero() {
  limparTelefoneLembrado()
  setModoRapido(false)
  setTelefone('')
  setPin('')
  setPinDigits(['', '', '', '', '', ''])
}

function mascararTelefone(tel: string) {
  if (tel.length < 7) return tel
  return tel.slice(0, 5) + ' ••• ' + tel.slice(-2)
}

  async function verificarTelefone() {
    setVerificandoTel(true)
    const tel = telefone.startsWith('+') ? telefone : `+244${telefone.replace(/\D/g, '')}`
    const { data } = await supabase.from('profiles').select('nome').eq('telefone', tel).maybeSingle()
    setNomeEncontrado(data?.nome?.split(' ')[0] || null)
    setVerificandoTel(false)
  }

  function handlePinChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const novos = [...pinDigits]
    novos[index] = digit
    setPinDigits(novos)
    setPin(novos.join(''))

    if (digit && index < 5) {
      pinRefs[index + 1].current?.focus()
    }
  }

  function handlePinKeyPress(index: number, e: any) {
    if (e.nativeEvent.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs[index - 1].current?.focus()
    }
  }

  // ── Login unificado — trata os dois modos ──
  async function handleLogin() {
    setLoading(true)

    if (modoAuth === 'email') {
      if (!email || !password) {
        mostrarAlerta('Atenção', 'Preenche o email e a palavra-passe.')
        setLoading(false)
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        mostrarAlerta('Erro ao entrar', error.message)
        setLoading(false)
        return
      }
      await redirecionarConformeTipo(data.user.id)
      return
    }

    // Modo telefone
    if (!telefone || pin.length !== 6) {
      mostrarAlerta('Atenção', 'Insere o telefone e o PIN completo.')
      setLoading(false)
      return
    }
    const tel = telefone.startsWith('+') ? telefone : `+244${telefone.replace(/\D/g, '')}`
    const { data, error } = await supabase.auth.signInWithPassword({ phone: tel, password: pin })
    if (error) {
      mostrarAlerta('Erro ao entrar', 'Telefone ou PIN incorrectos.')
      setLoading(false)
      return
    }
    await guardarTelefoneLembrado(tel)
    await redirecionarConformeTipo(data.user.id)
    
  }

  async function redirecionarConformeTipo(userId: string) {
    const { data: prof } = await supabase
      .from('profiles').select('tipo, bloqueado, motivo_bloqueio').eq('id', userId).single()

    if (prof?.bloqueado) {
      await supabase.auth.signOut()
      mostrarAlerta('🔒 Conta bloqueada', prof.motivo_bloqueio || 'Contacta o Hospital Ngola Kimbanda.')
      setLoading(false)
      return
    }

    if (prof?.tipo === 'admin')           router.replace('/(admin)')
    else if (prof?.tipo === 'enfermeiro') router.replace('/(enfermeiro)')
    else if (prof?.tipo === 'ong')        router.replace('/(ong)')
    else                                   router.replace('/(voluntario)')
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
                Doe sangue.{'\n'}
                <Text style={{ color: Colors.redSoft, fontStyle: 'italic' }}>Salve vidas.</Text>
              </Text>
              <Text style={s.YOSub}>
                O sistema de gestão de doação de sangue do Hospital Ngola Kimbanda, Namibe.
              </Text>
              <View style={s.YOStats}>
                <YOStat value="MY-2026" label="Seriais activos" />
                <YOStat value="3" label="Vidas por doação" />
                <YOStat value="100%" label="Gratuito" />
              </View>
              <View style={s.statusRow}>
                <View style={s.statusDot} />
                <Text style={s.statusText}>Sistema activo · Namibe, Angola</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── LADO DIREITO — formulário ── */}
        <ScrollView
          style={s.formSide}
          contentContainerStyle={s.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!isWeb && (
            <View style={s.mobileHeader}>
              <Text style={s.logoMobile}>
                MO<Text style={{ color: Colors.redSoft }}>YO</Text>
              </Text>
              <Text style={s.mobileSubtitle}>Doe sangue. Salve vidas.</Text>
            </View>
          )}

          <View style={[s.formCard, isWeb && s.formCardWeb]}>

          
          {verificandoSessao ? (
  <View style={{ alignItems: 'center', padding: 60 }}>
    <ActivityIndicator size="large" color={Colors.red} />
  </View>
) : (
  <View style={[s.formCard, isWeb && s.formCardWeb]}>

    {modoRapido ? (
      /* ── MODO RÁPIDO — só PIN ── */
      <>
        <Text style={s.formTitle}>Bem-vindo de volta</Text>
        <Text style={s.formSub}>Introduz o teu PIN para continuar</Text>

        <View style={s.telRapidoBox}>
          <Feather name="phone" size={14} color={Colors.muted} />
          <Text style={s.telRapidoText}>{mascararTelefone(telefoneLembrado)}</Text>
          <TouchableOpacity onPress={usarOutroNumero}>
            <Text style={s.trocarNumeroText}>Trocar</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>PIN (6 dígitos)</Text>
        <View style={s.pinBoxRow}>
          {pinDigits.map((digit, i) => (
            <TextInput
              key={i}
              ref={pinRefs[i]}
              style={[
                s.pinBox,
                digit ? s.pinBoxFilled : null,
                Platform.OS === 'web' ? { outline: 'none' } as any : {},
              ]}
              value={digit}
              onChangeText={v => handlePinChange(i, v)}
              onKeyPress={e => handlePinKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              secureTextEntry={!showPin}
              textAlign="center"
              autoFocus={i === 0}
            />
          ))}
          <TouchableOpacity onPress={() => setShowPin(!showPin)} style={{ marginLeft: 8, justifyContent: 'center' }}>
            <Feather name={showPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted2} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={{ alignSelf: 'flex-end', marginVertical: 12 }} onPress={() => router.push('/(auth)/recuperar-pin' as any)}>
          <Text style={s.forgotText}>Esqueceste o PIN?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.btnPrimary, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.btnPrimaryText}>Entrar</Text>}
        </TouchableOpacity>
      </>
    ) : (
      <>
        

            {/* Toggle Email / Telefone */}
            <View style={s.modoAuthTabs}>
              <TouchableOpacity
                style={[s.modoAuthTab, modoAuth === 'email' && s.modoAuthTabActive]}
                onPress={() => setModoAuth('email')}
              >
                <Feather name="mail" size={13} color={modoAuth === 'email' ? Colors.white : Colors.muted} />
                <Text style={[s.modoAuthTabText, modoAuth === 'email' && { color: Colors.white }]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modoAuthTab, modoAuth === 'telefone' && s.modoAuthTabActive]}
                onPress={() => setModoAuth('telefone')}
              >
                <Feather name="phone" size={13} color={modoAuth === 'telefone' ? Colors.white : Colors.muted} />
                <Text style={[s.modoAuthTabText, modoAuth === 'telefone' && { color: Colors.white }]}>Telefone + PIN</Text>
              </TouchableOpacity>
            </View>

            {/* ── MODO EMAIL ── */}
            {modoAuth === 'email' && (
              <>
                <Text style={s.label}>EMAIL</Text>
                <View style={[s.inputWrap, focusEmail && s.inputWrapFocus]}>
                  <Feather name="mail" size={16} color={focusEmail ? Colors.redSoft : Colors.muted2} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[s.input, Platform.OS === 'web' ? { outline: 'none' } as any : {}]}
                    value={email} onChangeText={setEmail}
                    placeholder="o.teu@email.com"
                    placeholderTextColor={Colors.muted}
                    keyboardType="email-address" autoCapitalize="none"
                    onFocus={() => setFocusEmail(true)} onBlur={() => setFocusEmail(false)}
                  />
                  {email.length > 3 && <Feather name="check-circle" size={15} color={Colors.green} />}
                </View>

                <Text style={s.label}>PALAVRA-PASSE</Text>
                <View style={[s.inputWrap, focusPass && s.inputWrapFocus]}>
                  <Feather name="lock" size={16} color={focusPass ? Colors.redSoft : Colors.muted2} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[s.input, Platform.OS === 'web' ? { outline: 'none' } as any : {}]}
                    value={password} onChangeText={setPassword}
                    placeholder="••••••••" placeholderTextColor={Colors.muted}
                    secureTextEntry={!showPass}
                    onFocus={() => setFocusPass(true)} onBlur={() => setFocusPass(false)}
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 4 }}>
                    <Feather name={showPass ? 'eye-off' : 'eye'} size={16} color={Colors.muted2} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 20 }} onPress={() => router.push('/(auth)/recuperar' as any)}>
                  <Text style={s.forgotText}>Esqueceu a palavra-passe?</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btnPrimary, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.btnPrimaryText}>Entrar</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* ── MODO TELEFONE ── */}
            {modoAuth === 'telefone' && (
              <>
                <Text style={s.label}>NÚMERO DE TELEFONE</Text>
                <View style={[s.inputWrap, focusTel && s.inputWrapFocus]}>
                  <Feather name="phone" size={16} color={focusTel ? Colors.redSoft : Colors.muted2} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[s.input, Platform.OS === 'web' ? { outline: 'none' } as any : {}]}
                    value={telefone} onChangeText={setTelefone}
                    placeholder="9XX XXX XXX"
                    placeholderTextColor={Colors.muted}
                    keyboardType="phone-pad"
                    onFocus={() => setFocusTel(true)} onBlur={() => setFocusTel(false)}
                  />
                  {verificandoTel && <ActivityIndicator size="small" color={Colors.muted2} />}
                  {nomeEncontrado && !verificandoTel && <Feather name="check-circle" size={15} color={Colors.green} />}
                </View>

                {nomeEncontrado && (
                  <View style={s.boasVindas}>
                    <Text style={s.boasVindasText}>
                      👋 Bem-vindo de volta, <Text style={{ fontWeight: '800', color: Colors.white }}>{nomeEncontrado}</Text>!
                    </Text>
                  </View>
                )}

                <Text style={s.label}>PIN (6 dígitos)</Text>
                <View style={s.pinBoxRow}>
                  {pinDigits.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={pinRefs[i]}
                      style={[
                        s.pinBox,
                        digit ? s.pinBoxFilled : null,
                        Platform.OS === 'web' ? { outline: 'none' } as any : {},
                      ]}
                      value={digit}
                      onChangeText={v => handlePinChange(i, v)}
                      onKeyPress={e => handlePinKeyPress(i, e)}
                      keyboardType="number-pad"
                      maxLength={1}
                      secureTextEntry={!showPin}
                      textAlign="center"
                    />
                  ))}
                  <TouchableOpacity onPress={() => setShowPin(!showPin)} style={{ marginLeft: 8, justifyContent: 'center' }}>
                    <Feather name={showPin ? 'eye-off' : 'eye'} size={18} color={Colors.muted2} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={{ alignSelf: 'flex-end', marginVertical: 12 }} onPress={() => router.push('/(auth)/recuperar-pin' as any)}>
                  <Text style={s.forgotText}>Esqueceste o PIN?</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[s.btnPrimary, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={s.btnPrimaryText}>Entrar</Text>}
                </TouchableOpacity>
              </>
            )}

            {/* Google */}
            <TouchableOpacity
              style={s.btnGoogle}
              onPress={() => mostrarAlerta('Em breve', 'Login com Google em breve.')}
            >
              <View style={s.googleIconWrap}>
                <Text>
                  <Text style={{ color: '#4285F4', fontSize: 14, fontWeight: '800' }}>G</Text>
                  <Text style={{ color: '#EA4335', fontSize: 5 }}>•</Text>
                  <Text style={{ color: '#FBBC05', fontSize: 5 }}>•</Text>
                  <Text style={{ color: '#34A853', fontSize: 5 }}>•</Text>
                </Text>
              </View>
              <Text style={s.btnGoogleText}>Continuar com Google</Text>
            </TouchableOpacity>

            {/* Divisor */}
            <View style={s.divisor}>
              <View style={s.divisorLine} />
              <Text style={s.divisorText}>ou</Text>
              <View style={s.divisorLine} />
            </View>

            {/* Opções de registo */}
            <Text style={s.formTitle}>Criar nova conta</Text>
            <Text style={s.formSub}>Escolhe o tipo de conta</Text>

            <View style={[s.registoRow, !isWeb && s.registoRowMobile]}>

              <TouchableOpacity
                style={[s.registoBtn, !isWeb && s.registoBtnMobile]}
                onPress={() => router.push('/(auth)/cadastro' as any)}
              >
                <View style={[s.registoBtnIcon, { backgroundColor: 'rgba(232,23,58,0.12)' }]}>
                  <Text style={{ fontSize: !isWeb ? 22 : 18 }}>🩸</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.registoBtnTitle}>Doador Voluntário</Text>
                  <Text style={s.registoBtnSub}>Regista-te para doar sangue</Text>
                </View>
                <Feather name="chevron-right" size={16} color={Colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.registoBtn, !isWeb && s.registoBtnMobile, { borderColor: 'rgba(232,180,75,0.2)' }]}
                onPress={() => router.push('/(auth)/emergencia' as any)}
              >
                <View style={[s.registoBtnIcon, { backgroundColor: 'rgba(232,180,75,0.12)' }]}>
                  <Text style={{ fontSize: !isWeb ? 22 : 18 }}>🆘</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.registoBtnTitle}>Preciso de Sangue</Text>
                  <Text style={s.registoBtnSub}>Pedido de emergência sem conta</Text>
                </View>
                <Feather name="chevron-right" size={16} color={Colors.muted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.registoBtn, !isWeb && s.registoBtnMobile]}
                onPress={() => router.push('/(auth)/registar-ong' as any)}
              >
                <View style={[s.registoBtnIcon, { backgroundColor: 'rgba(74,158,255,0.12)' }]}>
                  <Text style={{ fontSize: !isWeb ? 22 : 18 }}>🤝</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.registoBtnTitle}>ONG Parceira</Text>
                  <Text style={s.registoBtnSub}>Regista a tua organização</Text>
                </View>
                <Feather name="chevron-right" size={16} color={Colors.muted} />
              </TouchableOpacity>

            </View>

              </>
          )}

        </View>
      )}

          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

function YOStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.YOStat}>
      <Text style={s.YOStatValue}>{value}</Text>
      <Text style={s.YOStatLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: Colors.dark },

  YOSide: {
    flex: 1, backgroundColor: Colors.dark2, padding: 48,
    justifyContent: 'center', position: 'relative', overflow: 'hidden',
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)',
  },
  YOGlow: {
    position: 'absolute', top: -100, right: -100,
    width: 350, height: 350, borderRadius: 175,
    backgroundColor: Colors.redGlow,
  },
  YOContent: { maxWidth: 440 },
  logo:        { fontSize: 26, fontWeight: '800', color: Colors.white, marginBottom: 48 },
  YOTitle:   { fontSize: 44, fontWeight: '800', color: Colors.white, lineHeight: 52, marginBottom: 16 },
  YOSub:     { fontSize: 14, color: Colors.muted, lineHeight: 22, marginBottom: 36 },
  YOStats:   { flexDirection: 'row', gap: 24, marginBottom: 40 },
  YOStat:    { alignItems: 'center' },
  YOStatValue:{ fontSize: 18, fontWeight: '800', color: Colors.white, marginBottom: 3 },
  YOStatLabel:{ fontSize: 11, color: Colors.muted },
  statusRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  statusText:  { fontSize: 12, color: Colors.muted },

  formSide:   { flex: 1 },
  formScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  mobileHeader: { alignItems: 'center', marginBottom: 32, marginTop: 16 },
  logoMobile:   { fontSize: 28, fontWeight: '800', color: Colors.white },
  mobileSubtitle: { fontSize: 13, color: Colors.muted, marginTop: 6 },

  formCard: { width: '100%' },
  formCardWeb: { maxWidth: 420, alignSelf: 'center' },

  formTitle: { fontSize: 26, fontWeight: '800', color: Colors.white, marginBottom: 6 },
  formSub:   { fontSize: 13, color: Colors.muted, marginBottom: 28, lineHeight: 18 },

  label: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1, marginBottom: 8,
    textTransform: 'uppercase',
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputWrapFocus: {
    borderColor: Colors.red,
    backgroundColor: 'rgba(232,23,58,0.04)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.white,
    height: '100%' as any,
    letterSpacing: 0.3,
  },

  btnPrimary: {
    backgroundColor: Colors.red,
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 24,
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },

  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  divisorLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  divisorText: { fontSize: 12, color: Colors.muted },

  registoRow: { gap: 10 },
  registoRowMobile: { gap: 10 },

  registoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.dark2, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  registoBtnMobile: {
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 2,
  },
  registoBtnIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  registoBtnTitle:{ fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  registoBtnSub:  { fontSize: 11, color: Colors.muted },

  forgotText: {
    fontSize: 12,
    color: Colors.muted,
    textDecorationLine: 'underline',
  },

  modoAuthTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.dark3,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modoAuthTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 9,
  },
  modoAuthTabActive: {
    backgroundColor: Colors.red,
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  modoAuthTabText: { fontSize: 13, fontWeight: '700', color: Colors.muted },

  boasVindas: {
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
    borderRadius: 10, padding: 12, marginBottom: 16,
  },
  boasVindasText: { fontSize: 13, color: Colors.muted },

  pinBoxRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pinBox: {
    width: 44, height: 52,
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    fontSize: 20, fontWeight: '700', color: Colors.white,
    textAlign: 'center',
  },
  pinBoxFilled: { borderColor: Colors.red, backgroundColor: 'rgba(232,23,58,0.06)' },

  btnGoogle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: Colors.dark2, borderRadius: 10, height: 50,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  btnGoogleText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  googleIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  telRapidoBox: {
  flexDirection: 'row', alignItems: 'center', gap: 8,
  backgroundColor: Colors.dark3, borderRadius: 10,
  padding: 12, marginBottom: 24,
},
telRapidoText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.white },
trocarNumeroText: { fontSize: 12, color: Colors.redSoft, fontWeight: '700' },
})