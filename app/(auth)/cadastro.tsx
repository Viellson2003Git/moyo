// app/(auth)/cadastro.tsx
import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
  useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import { guardarTelefoneLembrado } from '../../utils/session'

// ── Indicador de passos ──────────────
function StepIndicator({ step }: { step: number }) {
  return (
    <View style={styles.stepRow}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.stepWrap}>
          <View style={[
            styles.stepDot,
            step === i && styles.stepDotActive,
            step > i  && styles.stepDotDone,
          ]}>
            <Text style={[
              styles.stepNum,
              (step === i || step > i) && styles.stepNumActive,
            ]}>
              {step > i ? '✓' : i}
            </Text>
          </View>
          {i < 3 && (
            <View style={[
              styles.stepLine,
              step > i && styles.stepLineDone,
            ]} />
          )}
        </View>
      ))}
    </View>
  )
}

// ── Passo 1 — Dados pessoais + Província + Hospital ──────────────
type Step1Props = {
  nome: string; setNome: (v: string) => void
  apelido: string; setApelido: (v: string) => void
  telefone: string; setTelefone: (v: string) => void
  provinciaId: string; setProvinciaId: (v: string) => void
  provinciaLabel: string; setProvinciaLabel: (v: string) => void
  provincias: any[]
  showProvincias: boolean; setShowProvincias: (v: boolean) => void
  bancoId: string; setBancoId: (v: string) => void
  bancoLabel: string; setBancoLabel: (v: string) => void
  bancos: any[]
  loadingBancos: boolean
  onNext: () => void
}

function Step1({
  nome, setNome, apelido, setApelido,
  telefone, setTelefone,
  provinciaId, setProvinciaId, provinciaLabel, setProvinciaLabel,
  provincias, showProvincias, setShowProvincias,
  bancoId, setBancoId, bancoLabel, setBancoLabel,
  bancos, loadingBancos,
  onNext,
}: Step1Props) {
  const [showBancos, setShowBancos] = useState(false)

  return (
    <>
      <Text style={styles.stepTitle}>Dados pessoais</Text>
      <Text style={styles.stepSub}>Passo 1 de 3</Text>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.label}>NOME *</Text>
          <TextInput style={styles.input} placeholder="João" placeholderTextColor={Colors.muted2} value={nome} onChangeText={setNome} />
        </View>
        <View style={styles.rowItem}>
          <Text style={styles.label}>APELIDO</Text>
          <TextInput style={styles.input} placeholder="Silva" placeholderTextColor={Colors.muted2} value={apelido} onChangeText={setApelido} />
        </View>
      </View>

      <Text style={styles.label}>NÚMERO DE TELEFONE *</Text>
      <TextInput
        style={styles.input}
        placeholder="9XX XXX XXX"
        placeholderTextColor={Colors.muted2}
        keyboardType="phone-pad"
        value={telefone}
        onChangeText={setTelefone}
      />

      {/* Selector de Província */}
      <Text style={styles.label}>PROVÍNCIA *</Text>
      <TouchableOpacity
        style={[styles.input, { justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}
        onPress={() => setShowProvincias(!showProvincias)}
      >
        <Text style={{ color: provinciaId ? Colors.white : Colors.muted2, fontSize: 14 }}>
          {provinciaLabel || 'Selecciona a tua província'}
        </Text>
        <Feather name={showProvincias ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
      </TouchableOpacity>

      {showProvincias && (
        <View style={styles.dropdown}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 200 }}>
            {provincias.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.dropdownItem, provinciaId === p.id && styles.dropdownItemActive]}
                onPress={() => {
                  setProvinciaId(p.id)
                  setProvinciaLabel(`${p.nome} · ${p.capital}`)
                  setShowProvincias(false)
                  setBancoId('')
                  setBancoLabel('')
                }}
              >
                <Text style={styles.dropdownItemNome}>{p.nome}</Text>
                <Text style={styles.dropdownItemSub}>{p.capital}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Selector de Hospital — só aparece após escolher província */}
      {provinciaId !== '' && (
        <>
          <Text style={styles.label}>HOSPITAL / BANCO DE SANGUE *</Text>
          {loadingBancos ? (
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <ActivityIndicator size="small" color={Colors.red} />
              <Text style={{ color: Colors.muted, fontSize: 14 }}>A carregar hospitais...</Text>
            </View>
          ) : bancos.length === 0 ? (
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
              <Feather name="alert-circle" size={16} color={Colors.gold} />
              <Text style={{ color: Colors.muted, fontSize: 14 }}>
                Sem hospitais nesta província ainda
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}
                onPress={() => setShowBancos(!showBancos)}
              >
                <Text style={{ color: bancoId ? Colors.white : Colors.muted2, fontSize: 14 }}>
                  {bancoLabel || 'Selecciona o hospital'}
                </Text>
                <Feather name={showBancos ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.muted} />
              </TouchableOpacity>

              {showBancos && (
                <View style={styles.dropdown}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator style={{ maxHeight: 180 }}>
                    {bancos.map((b: any) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.dropdownItem, bancoId === b.id && styles.dropdownItemActive]}
                        onPress={() => {
                          setBancoId(b.id)
                          setBancoLabel(b.nome)
                          setShowBancos(false)
                        }}
                      >
                        <Text style={styles.dropdownItemNome}>{b.nome}</Text>
                        {b.municipio && (
                          <Text style={styles.dropdownItemSub}>📍 {b.municipio}</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {bancoId !== '' && (
                <View style={styles.bancoSelecionadoBox}>
                  <Feather name="check-circle" size={14} color={Colors.green} />
                  <Text style={styles.bancoSelecionadoText}>
                    Serás registado em <Text style={{ color: Colors.white, fontWeight: '700' }}>{bancoLabel}</Text>
                  </Text>
                </View>
              )}
            </>
          )}
        </>
      )}

      <TouchableOpacity style={[styles.btnPrimary, { marginTop: 16 }]} onPress={onNext}>
        <Text style={styles.btnPrimaryText}>Continuar →</Text>
      </TouchableOpacity>
    </>
  )
}

// ── Passo 2 — Dados de saúde ──────────────────────────
type Step2Props = {
  bi: string; setBi: (v: string) => void
  dataNasc: string; setDataNasc: (v: string) => void
  sexo: string; setSexo: (v: string) => void
  tipoSanguineo: string; setTipoSanguineo: (v: string) => void
  morada: string; setMorada: (v: string) => void
  onBack: () => void
  onNext: () => void
}

function Step2({ bi, setBi, dataNasc, setDataNasc, sexo, setSexo, tipoSanguineo, setTipoSanguineo, morada, setMorada, onBack, onNext }: Step2Props) {
  const tipos = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  const sexos = [{ label: 'Masculino', val: 'M' }, { label: 'Feminino', val: 'F' }]

  // Calcula idade em tempo real
  const idade = dataNasc && dataNasc.length === 10
    ? Math.floor((Date.now() - new Date(dataNasc).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null
  const idadeValida = idade !== null && idade >= 18 && idade <= 65
  const idadeMenor  = idade !== null && idade < 18
  const idadeIdoso  = idade !== null && idade > 65

  return (
    <>
      <Text style={styles.stepTitle}>Dados de saúde</Text>
      <Text style={styles.stepSub}>Passo 2 de 3</Text>

      <Text style={styles.label}>BILHETE DE IDENTIDADE (BI)</Text>
      <TextInput
        style={styles.input}
        placeholder="00XXXXXXX LA XXX"
        placeholderTextColor={Colors.muted2}
        autoCapitalize="characters"
        value={bi} onChangeText={setBi}
      />

      <Text style={styles.label}>DATA DE NASCIMENTO *</Text>
      <TextInput
        style={styles.input}
        placeholder="AAAA-MM-DD"
        placeholderTextColor={Colors.muted2}
        value={dataNasc}
        onChangeText={(text) => {
          let f = text.replace(/\D/g, '')
          if (f.length > 4) f = f.slice(0, 4) + '-' + f.slice(4)
          if (f.length > 7) f = f.slice(0, 7) + '-' + f.slice(7)
          setDataNasc(f.slice(0, 10))
        }}
        keyboardType="numeric"
        maxLength={10}
      />

      {/* Indicador de idade em tempo real */}
      {idade !== null && !isNaN(idade) && (
        <View style={[
          styles.idadeBox,
          idadeValida  && styles.idadeBoxOk,
          idadeMenor   && styles.idadeBoxErro,
          idadeIdoso   && styles.idadeBoxAviso,
        ]}>
          <Feather
            name={idadeValida ? 'check-circle' : 'alert-circle'}
            size={16}
            color={idadeValida ? Colors.green : idadeMenor ? Colors.redSoft : Colors.gold}
          />
          <View style={{ flex: 1 }}>
            <Text style={[
              styles.idadeText,
              { color: idadeValida ? Colors.green : idadeMenor ? Colors.redSoft : Colors.gold }
            ]}>
              {idade} anos
            </Text>
            {idadeMenor && (
              <Text style={styles.idadeSubText}>
                ⚠️ A idade mínima para doação de sangue é 18 anos. Não podes continuar o registo.
              </Text>
            )}
            {idadeIdoso && (
              <Text style={styles.idadeSubText}>
                ⚠️ O limite de idade para doação é 65 anos. Não podes continuar o registo.
              </Text>
            )}
            {idadeValida && (
              <Text style={styles.idadeSubText}>✓ Idade válida para doação de sangue</Text>
            )}
          </View>
        </View>
      )}

      <Text style={styles.label}>MORADA</Text>
      <TextInput
        style={styles.input}
        placeholder="Bairro, Rua..."
        placeholderTextColor={Colors.muted2}
        value={morada} onChangeText={setMorada}
      />

      <Text style={styles.label}>SEXO</Text>
      <View style={styles.optionRow}>
        {sexos.map(s => (
          <TouchableOpacity
            key={s.val}
            style={[styles.optionBtn, sexo === s.val && styles.optionBtnActive]}
            onPress={() => setSexo(s.val)}
          >
            <Text style={[styles.optionText, sexo === s.val && styles.optionTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>TIPO SANGUÍNEO (se souber)</Text>
      <View style={styles.MOGrid}>
        {tipos.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.MOBtn, tipoSanguineo === t && styles.MOBtnActive]}
            onPress={() => setTipoSanguineo(t)}
          >
            <Text style={[styles.MOText, tipoSanguineo === t && styles.MOTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btnBack} onPress={onBack}>
          <Text style={styles.btnBackText}>← Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btnPrimary, { flex: 2 }, (!idadeValida && idade !== null) && { opacity: 0.4 }]}
          onPress={onNext}
          disabled={idadeMenor || idadeIdoso}
        >
          <Text style={styles.btnPrimaryText}>Continuar →</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

// ── Passo 3 — Verificação SMS + PIN ──────────────
type Step3Props = {
  telefone: string
  codigoOtp: string; setCodigoOtp: (v: string) => void
  pin: string; setPin: (v: string) => void
  confirmarPin: string; setConfirmarPin: (v: string) => void
  otpEnviado: boolean
  verificando: boolean
  onEnviarCodigo: () => void
  onBack: () => void
  onSubmit: () => void
}

function Step3({
  telefone, codigoOtp, setCodigoOtp,
  pin, setPin, confirmarPin, setConfirmarPin,
  otpEnviado, verificando,
  onEnviarCodigo, onBack, onSubmit,
}: Step3Props) {
  return (
    <>
      <Text style={styles.stepTitle}>Verificação</Text>
      <Text style={styles.stepSub}>Passo 3 de 3</Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>📱</Text>
        <Text style={styles.infoText}>
          Vamos enviar um código por SMS para {telefone || 'o teu número'}. Depois, cria um PIN de 6 dígitos para acederes à tua conta.
        </Text>
      </View>

      {!otpEnviado ? (
        <TouchableOpacity
          style={[styles.btnPrimary, verificando && styles.btnDisabled]}
          onPress={onEnviarCodigo}
          disabled={verificando}
        >
          {verificando
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.btnPrimaryText}>Enviar Código SMS</Text>
          }
        </TouchableOpacity>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Feather name="check-circle" size={14} color={Colors.green} />
            <Text style={{ fontSize: 12, color: Colors.muted }}>Código enviado por SMS</Text>
          </View>

          <Text style={styles.label}>CÓDIGO DE VERIFICAÇÃO</Text>
          <TextInput
            style={[styles.input, { letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
            value={codigoOtp}
            onChangeText={v => setCodigoOtp(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor={Colors.muted2}
            keyboardType="number-pad"
            maxLength={6}
          />

          <Text style={styles.label}>CRIA O TEU PIN (6 dígitos)</Text>
          <TextInput
            style={[styles.input, { letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
            value={pin}
            onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor={Colors.muted2}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />

          <Text style={styles.label}>CONFIRMA O PIN</Text>
          <TextInput
            style={[styles.input, { letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
            value={confirmarPin}
            onChangeText={v => setConfirmarPin(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            placeholderTextColor={Colors.muted2}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
          />
        </>
      )}

      <View style={[styles.btnRow, { marginTop: 20 }]}>
        <TouchableOpacity style={styles.btnBack} onPress={onBack}>
          <Text style={styles.btnBackText}>← Voltar</Text>
        </TouchableOpacity>
        {otpEnviado && (
          <TouchableOpacity
            style={[styles.btnSuccess, { flex: 2 }, verificando && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={verificando}
          >
            {verificando
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.btnPrimaryText}>🎉 Criar Conta</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </>
  )
}

// ── Componente principal ─────────────
export default function Cadastro() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 768
  const [step, setStep] = useState(1)

  // Passo 1
  const [nome, setNome]                     = useState('')
  const [apelido, setApelido]               = useState('')
  const [telefone, setTelefone]             = useState('')
  const [provinciaId, setProvinciaId]       = useState('')
  const [provinciaLabel, setProvinciaLabel] = useState('')
  const [provincias, setProvincias]         = useState<{ id: string; nome: string; capital: string }[]>([])
  const [showProvincias, setShowProvincias] = useState(false)

  // Passo 2
  const [bi, setBi]                       = useState('')
  const [dataNasc, setDataNasc]           = useState('')
  const [sexo, setSexo]                   = useState('')
  const [tipoSanguineo, setTipoSanguineo] = useState('')
  const [morada, setMorada]               = useState('')

  // Passo 3 — Verificação SMS + PIN
  const [codigoOtp, setCodigoOtp]       = useState('')
  const [pin, setPin]                   = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [otpEnviado, setOtpEnviado]     = useState(false)
  const [verificando, setVerificando]   = useState(false)

  // Estados novos para hospital
const [bancoId, setBancoId]       = useState('')
const [bancoLabel, setBancoLabel] = useState('')
const [bancos, setBancos]         = useState<any[]>([])
const [loadingBancos, setLoadingBancos] = useState(false)

// Sempre que a província mudar, carrega os hospitais dessa província
useEffect(() => {
  if (!provinciaId) { setBancos([]); return }
  carregarBancos(provinciaId)
}, [provinciaId])

async function carregarBancos(provId: string) {
  setLoadingBancos(true)
  const { data } = await supabase
    .from('bancos_sangue')
    .select('id, nome, municipio')
    .eq('provincia_id', provId)
    .eq('ativo', true)
    .order('nome')
  setBancos(data || [])
  // Se só há 1 hospital, selecciona automaticamente
  if (data && data.length === 1) {
    setBancoId(data[0].id)
    setBancoLabel(data[0].nome)
  }
  setLoadingBancos(false)
}

// No handleNextStep1, valida o banco:
function handleNextStep1() {
  if (!nome || !telefone || !provinciaId) {
    mostrarAlerta('Atenção', 'Nome, telefone e província são obrigatórios.')
    return
  }
  if (!bancoId && bancos.length > 0) {
    mostrarAlerta('Atenção', 'Selecciona o hospital onde vais ser registado.')
    return
  }
  setStep(2)
}



  useEffect(() => {
    supabase
      .from('provincias')
      .select('id, nome, capital')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setProvincias(data || []))
  }, [])

  

  function handleNextStep2() {
    setStep(3)
  }

  // Envia código de verificação por SMS
  async function enviarCodigoSMS() {
    setVerificando(true)
    const telefoneFormatado = telefone.startsWith('+') ? telefone : `+244${telefone.replace(/\D/g, '')}`

    const { error } = await supabase.auth.signInWithOtp({ phone: telefoneFormatado })
    if (error) {
      mostrarAlerta('Erro', error.message)
    } else {
      setOtpEnviado(true)
      mostrarAlerta('📱 Código enviado!', `Verifica o SMS recebido em ${telefoneFormatado}`)
    }
    setVerificando(false)
  }

  // Confirma código + define PIN + cria conta completa
  async function confirmarCodigoEDefinirPin() {
    if (!codigoOtp || codigoOtp.length < 4) {
      mostrarAlerta('Atenção', 'Insere o código recebido por SMS.')
      return
    }
    if (pin.length !== 6 || pin !== confirmarPin) {
      mostrarAlerta('Atenção', 'O PIN deve ter 6 dígitos e os dois campos devem coincidir.')
      return
    }

    setVerificando(true)
    const telefoneFormatado = telefone.startsWith('+') ? telefone : `+244${telefone.replace(/\D/g, '')}`

    try {
      // 1. Verifica o código SMS — autentica e cria o utilizador
      const { data, error } = await supabase.auth.verifyOtp({
        phone: telefoneFormatado,
        token: codigoOtp,
        type: 'sms',
      })
      if (error) throw new Error('Código inválido ou expirado.')

      // 2. Define o PIN como password da conta
      const { error: pinError } = await supabase.auth.updateUser({ password: pin })
      if (pinError) throw pinError

      // 3. Cria o perfil
      const userId = data.user!.id
      const nomeCompleto = apelido ? `${nome.trim()} ${apelido.trim()}` : nome.trim()

      const { error: profError } = await supabase.from('profiles').upsert({
        id: userId,
        nome: nomeCompleto,
        telefone: telefoneFormatado,
        tipo: 'voluntario',
        provincia_id: provinciaId || null,
      })
      if (profError) throw profError

      // 4. Cria o registo de voluntário
      const numeroSerial = `MY-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
      const { error: volError } = await supabase.from('voluntarios').insert({
        profile_id: userId,
        numero_serial: numeroSerial,
        tipo_sanguineo: tipoSanguineo || null,
        data_nascimento: dataNasc || null,
        sexo: sexo || null,
        bi_numero: bi || null,
        morada: morada || null,
         banco_id: bancoId || null, 
        estado: 'pendente',
      })
      if (volError) throw volError

      mostrarAlerta('✅ Conta criada!', 'Bem-vindo ao Moyo! A tua conta está pronta.')
      await guardarTelefoneLembrado(telefoneFormatado) 
      router.replace('/(voluntario)' as any)
    } catch (e: any) {
      mostrarAlerta('Erro', e.message)
    }
    setVerificando(false)
  }

  const stepContent = (
    <>
      <StepIndicator step={step} />
      {step === 1 && (
        <Step1
          nome={nome} setNome={setNome}
          apelido={apelido} setApelido={setApelido}
          telefone={telefone} setTelefone={setTelefone}
          provinciaId={provinciaId} setProvinciaId={setProvinciaId}
          provinciaLabel={provinciaLabel} setProvinciaLabel={setProvinciaLabel}
          provincias={provincias}
          showProvincias={showProvincias} setShowProvincias={setShowProvincias}
          bancoId={bancoId} setBancoId={setBancoId}
          bancoLabel={bancoLabel} setBancoLabel={setBancoLabel}
          bancos={bancos}
          loadingBancos={loadingBancos}
          onNext={handleNextStep1}
        />
      )}
      {step === 2 && (
        <Step2
          bi={bi} setBi={setBi}
          dataNasc={dataNasc} setDataNasc={setDataNasc}
          sexo={sexo} setSexo={setSexo}
          tipoSanguineo={tipoSanguineo} setTipoSanguineo={setTipoSanguineo}
          morada={morada} setMorada={setMorada}
          onBack={() => setStep(1)}
          onNext={handleNextStep2}
        />
      )}
      {step === 3 && (
      <>
        <Text style={styles.sectionLabel}>VERIFICAÇÃO POR TELEFONE</Text>

        <Text style={styles.label}>NÚMERO DE TELEFONE *</Text>
        <TextInput
          style={styles.input}
          value={telefone}
          onChangeText={setTelefone}
          placeholder="9XX XXX XXX"
          placeholderTextColor={Colors.muted2}
          keyboardType="phone-pad"
          editable={!otpEnviado}
        />

        {!otpEnviado ? (
          <TouchableOpacity
            style={[styles.btnPrimary, verificando && { opacity: 0.7 }]}
            onPress={enviarCodigoSMS}
            disabled={verificando}
          >
            {verificando
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.btnPrimaryText}>Enviar Código SMS</Text>
            }
          </TouchableOpacity>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Feather name="check-circle" size={14} color={Colors.green} />
              <Text style={{ fontSize: 12, color: Colors.muted }}>Código enviado por SMS</Text>
            </View>

            <Text style={styles.label}>CÓDIGO DE 6 DÍGITOS</Text>
            <TextInput
              style={[styles.input, { letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
              value={codigoOtp}
              onChangeText={v => setCodigoOtp(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={Colors.muted2}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Text style={styles.label}>CRIA O TEU PIN (6 dígitos) *</Text>
            <TextInput
              style={[styles.input, { letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
              value={pin}
              onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={Colors.muted2}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />

            <Text style={styles.label}>CONFIRMA O PIN *</Text>
            <TextInput
              style={[styles.input, { letterSpacing: 6, fontSize: 18, textAlign: 'center' }]}
              value={confirmarPin}
              onChangeText={v => setConfirmarPin(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              placeholderTextColor={Colors.muted2}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />

            <TouchableOpacity
              style={[styles.btnPrimary, verificando && { opacity: 0.7 }]}
              onPress={confirmarCodigoEDefinirPin}
              disabled={verificando}
            >
              {verificando
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.btnPrimaryText}>Confirmar e Criar Conta</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {/* Botão Voltar */}
        <TouchableOpacity style={[styles.btnBack, { marginTop: 12 }]} onPress={() => setStep(2)}>
          <Text style={styles.btnBackText}>← Voltar</Text>
        </TouchableOpacity>
      </>
    )}
        
    </>
  )

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, isWeb && styles.scrollWeb]}
        keyboardShouldPersistTaps="handled"
      >
        {isWeb ? (
          <View style={styles.webContainer}>
            <View style={styles.leftPanel}>
              <Text style={styles.leftLogo}>
                MO<Text style={{ color: Colors.redSoft }}>YO</Text>
              </Text>
              <Text style={styles.leftTitle}>
                Junte-se à{'\n'}
                <Text style={{ color: Colors.redSoft, fontStyle: 'italic' }}>comunidade.</Text>
              </Text>
              <Text style={styles.leftSub}>
                Cadastro gratuito. Exames gratuitos. Salvar vidas não tem preço.
              </Text>
              <View style={styles.activeDot}>
                <View style={styles.dot} />
                <Text style={styles.activeText}>Sistema activo · Namibe</Text>
              </View>
            </View>
            <View style={styles.rightPanel}>
              <View style={styles.formWrap}>
                {stepContent}
                <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.push('/(auth)/login' as any)}>
                  <Text style={styles.switchText}>
                    Já tens conta? <Text style={styles.switchLink}>Entrar</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.mobileContainer}>
            <View style={styles.logoWrap}>
              <Text style={styles.logo}>MO<Text style={styles.logoRed}>YO</Text></Text>
              <Text style={styles.logoSub}>Criar conta gratuita</Text>
            </View>
            <View style={styles.card}>{stepContent}</View>
            <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={styles.switchText}>
                Já tens conta? <Text style={styles.switchLink}>Entrar</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  scrollWeb: { minHeight: '100vh' as any },

  webContainer: { flex: 1, flexDirection: 'row', minHeight: '100vh' as any },
  leftPanel: {
    flex: 1, backgroundColor: Colors.dark2,
    padding: 56, justifyContent: 'center', gap: 20,
  },
  leftLogo: { fontSize: 28, fontWeight: '800', color: Colors.white },
  leftTitle: { fontSize: 40, fontWeight: '700', color: Colors.white, lineHeight: 48 },
  leftSub: { fontSize: 15, color: Colors.muted, lineHeight: 24, maxWidth: 340 },
  activeDot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green },
  activeText: { fontSize: 12, color: Colors.muted2 },
  rightPanel: {
    flex: 1, backgroundColor: Colors.dark,
    justifyContent: 'center', alignItems: 'center', padding: 48,
  },
  formWrap: { width: '100%', maxWidth: 420 },

  mobileContainer: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 32, fontWeight: '800', color: Colors.white },
  logoRed: { color: Colors.redSoft },
  logoSub: { fontSize: 12, color: Colors.muted, marginTop: 6 },
  card: {
    backgroundColor: Colors.dark2, borderRadius: 20,
    padding: 24, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  stepWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.dark4,
    borderWidth: 2, borderColor: Colors.dark5,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { borderColor: Colors.red, backgroundColor: Colors.red },
  stepDotDone: { borderColor: Colors.green, backgroundColor: Colors.green },
  stepNum: { fontSize: 13, fontWeight: '700', color: Colors.muted },
  stepNumActive: { color: Colors.white },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.dark5, marginHorizontal: 6 },
  stepLineDone: { backgroundColor: Colors.green },

  stepTitle: { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  stepSub: { fontSize: 13, color: Colors.muted, marginBottom: 24 },
  label: {
    fontSize: 11, fontWeight: '700', color: Colors.muted,
    letterSpacing: 1, marginBottom: 8, marginTop: 4,
  },
  input: {
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 14, fontSize: 14, color: Colors.white, marginBottom: 14,
  },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },

  MOGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  MOBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, backgroundColor: Colors.dark3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  MOBtnActive: { backgroundColor: Colors.redGlow, borderColor: Colors.red },
  MOText: { fontSize: 14, fontWeight: '600', color: Colors.muted },
  MOTextActive: { color: Colors.redSoft },

  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  optionBtn: {
    flex: 1, padding: 12, borderRadius: 8,
    backgroundColor: Colors.dark3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  optionBtnActive: { backgroundColor: Colors.redGlow, borderColor: Colors.red },
  optionText: { fontSize: 14, fontWeight: '500', color: Colors.muted },
  optionTextActive: { color: Colors.redSoft },

  infoBox: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: 'rgba(232,23,58,0.07)',
    borderWidth: 1, borderColor: 'rgba(232,23,58,0.2)',
    borderRadius: 10, padding: 14, marginBottom: 20,
  },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 18 },

  btnRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: {
    backgroundColor: Colors.red, borderRadius: 10,
    padding: 15, alignItems: 'center',
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  btnSuccess: {
    backgroundColor: Colors.green, borderRadius: 10,
    padding: 15, alignItems: 'center',
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  btnBack: {
    flex: 1, backgroundColor: Colors.dark4,
    borderRadius: 10, padding: 15, alignItems: 'center',
  },
  btnBackText: { color: Colors.muted, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  switchText: { textAlign: 'center', fontSize: 13, color: Colors.muted },
  switchLink: { color: Colors.redSoft, fontWeight: '600' },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
    marginTop: 8,
  },

  dropdown: {
  backgroundColor: Colors.dark3, borderRadius: 10,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  maxHeight: 220, marginBottom: 8, overflow: 'hidden',
},
dropdownItem: {
  flexDirection: 'row', justifyContent: 'space-between',
  alignItems: 'center', padding: 13,
  borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
},
dropdownItemActive: { backgroundColor: Colors.redGlow },
dropdownItemNome:   { fontSize: 14, color: Colors.white, fontWeight: '500' },
dropdownItemSub:    { fontSize: 12, color: Colors.muted },

bancoSelecionadoBox: {
  flexDirection: 'row', alignItems: 'center', gap: 8,
  backgroundColor: 'rgba(46,204,113,0.08)',
  borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
  borderRadius: 10, padding: 12, marginTop: 4,
},
bancoSelecionadoText: { flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },

idadeBox: {
  flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 14,
},
idadeBoxOk:    { backgroundColor: 'rgba(46,204,113,0.08)',  borderColor: 'rgba(46,204,113,0.25)'  },
idadeBoxErro:  { backgroundColor: 'rgba(232,23,58,0.08)',   borderColor: 'rgba(232,23,58,0.25)'   },
idadeBoxAviso: { backgroundColor: 'rgba(232,180,75,0.08)',  borderColor: 'rgba(232,180,75,0.25)'  },
idadeText:     { fontSize: 18, fontWeight: '800', marginBottom: 3 },
idadeSubText:  { fontSize: 12, color: Colors.muted, lineHeight: 17 },
})