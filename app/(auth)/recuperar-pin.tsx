// app/(auth)/recuperar-pin.tsx
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Platform } from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import { guardarTelefoneLembrado } from '../../utils/session'

export default function RecuperarPin() {
  const [telefone, setTelefone] = useState('')
  const [codigo, setCodigo]     = useState('')
  const [novoPin, setNovoPin]   = useState('')
  const [otpEnviado, setOtpEnviado] = useState(false)
  const [loading, setLoading]   = useState(false)

  async function enviarCodigo() {
    if (!telefone) { mostrarAlerta('Atenção', 'Insere o teu telefone.'); return }
    setLoading(true)
    const tel = telefone.startsWith('+') ? telefone : `+244${telefone.replace(/\D/g, '')}`
    const { error } = await supabase.auth.signInWithOtp({ phone: tel })
    if (error) mostrarAlerta('Erro', error.message)
    else setOtpEnviado(true)
    setLoading(false)
  }

  async function confirmarENovoPin() {
    if (codigo.length < 4 || novoPin.length !== 6) {
      mostrarAlerta('Atenção', 'Preenche o código e o novo PIN de 6 dígitos.')
      return
    }
    setLoading(true)
    const tel = telefone.startsWith('+') ? telefone : `+244${telefone.replace(/\D/g, '')}`
    const { error } = await supabase.auth.verifyOtp({ phone: tel, token: codigo, type: 'sms' })
    if (error) { mostrarAlerta('Erro', 'Código inválido.'); setLoading(false); return }

    const { error: pinError } = await supabase.auth.updateUser({ password: novoPin })
    if (pinError) { mostrarAlerta('Erro', pinError.message); setLoading(false); return }

    mostrarAlerta('✅ PIN actualizado!', 'Já podes entrar com o teu novo PIN.')
    await guardarTelefoneLembrado(tel)
    router.replace('/(auth)/login' as any)
    setLoading(false)
  }

  return (
    <View style={s.root}>
      <View style={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.muted} />
          <Text style={s.backText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={s.title}>Recuperar PIN</Text>
        <Text style={s.sub}>Vamos enviar um código SMS para confirmar a tua identidade.</Text>

        <Text style={s.label}>TELEFONE</Text>
        <TextInput style={s.input} value={telefone} onChangeText={setTelefone}
          placeholder="9XX XXX XXX" placeholderTextColor={Colors.muted2}
          keyboardType="phone-pad" editable={!otpEnviado} />

        {!otpEnviado ? (
          <TouchableOpacity style={s.btn} onPress={enviarCodigo} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.btnText}>Enviar Código</Text>}
          </TouchableOpacity>
        ) : (
          <>
            <Text style={s.label}>CÓDIGO RECEBIDO</Text>
            <TextInput style={s.input} value={codigo} onChangeText={v => setCodigo(v.replace(/\D/g,'').slice(0,6))}
              placeholder="••••••" placeholderTextColor={Colors.muted2}
              keyboardType="number-pad" maxLength={6} />

            <Text style={s.label}>NOVO PIN (6 dígitos)</Text>
            <TextInput style={s.input} value={novoPin} onChangeText={v => setNovoPin(v.replace(/\D/g,'').slice(0,6))}
              placeholder="••••••" placeholderTextColor={Colors.muted2}
              keyboardType="number-pad" secureTextEntry maxLength={6} />

            <TouchableOpacity style={s.btn} onPress={confirmarENovoPin} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.btnText}>Definir Novo PIN</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark, justifyContent: 'center' },
  content: { padding: 28, maxWidth: 400, width: '100%', alignSelf: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 30 },
  backText: { fontSize: 13, color: Colors.muted },
  title: { fontSize: 26, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  sub: { fontSize: 13, color: Colors.muted, marginBottom: 26, lineHeight: 19 },
  label: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 1, marginBottom: 8, marginTop: 14 },
  input: { backgroundColor: Colors.dark2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14, fontSize: 15, color: Colors.white },
  btn: { backgroundColor: Colors.red, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 20 },
  btnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
})