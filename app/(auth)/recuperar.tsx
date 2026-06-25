// app/(auth)/recuperar.tsx
import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Platform
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'

export default function Recuperar() {
  const [email, setEmail]     = useState('')
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focus, setFocus]     = useState(false)

  async function handleEnviar() {
    if (!email.trim()) {
      mostrarAlerta('Atenção', 'Insere o teu email.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'moyo://recuperar-senha',
    })
    if (error) {
      mostrarAlerta('Erro', error.message)
    } else {
      setEnviado(true)
    }
    setLoading(false)
  }

  return (
    <View style={s.root}>
      <View style={s.bgGlow} />

      <View style={s.content}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.muted} />
          <Text style={s.backText}>Voltar ao login</Text>
        </TouchableOpacity>

        {!enviado ? (
          <>
            <View style={s.iconWrap}>
              <Feather name="lock" size={32} color={Colors.redSoft} />
            </View>

            <Text style={s.title}>Esqueceste a{'\n'}palavra-passe?</Text>
            <Text style={s.sub}>
              Insere o teu email e enviamos um link para criares uma nova palavra-passe.
            </Text>

            <Text style={s.label}>EMAIL</Text>
            <View style={[s.inputWrap, focus && s.inputWrapFocus]}>
              <Feather name="mail" size={16} color={focus ? Colors.redSoft : Colors.muted2} style={{ marginRight: 10 }} />
              <TextInput
                style={[s.input, Platform.OS === 'web' ? { outline: 'none' } as any : {}]}
                value={email}
                onChangeText={setEmail}
                placeholder="o.teu@email.com"
                placeholderTextColor={Colors.muted2}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
              />
            </View>

            <TouchableOpacity
              style={[s.btnEnviar, loading && { opacity: 0.7 }]}
              onPress={handleEnviar}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={s.btnEnviarText}>Enviar Link de Recuperação</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[s.iconWrap, { backgroundColor: 'rgba(46,204,113,0.1)' }]}>
              <Feather name="check-circle" size={32} color={Colors.green} />
            </View>

            <Text style={s.title}>Email enviado!</Text>
            <Text style={s.sub}>
              Enviámos um link para{'\n'}
              <Text style={{ color: Colors.white, fontWeight: '700' }}>{email}</Text>
              {'\n\n'}Verifica a tua caixa de entrada e clica no link para criar uma nova palavra-passe.
            </Text>

            <View style={s.dicaBox}>
              <Feather name="info" size={14} color={Colors.gold} />
              <Text style={s.dicaText}>
                Não recebeste? Verifica a pasta de spam ou tenta novamente.
              </Text>
            </View>

            <TouchableOpacity style={s.btnVoltar} onPress={() => router.replace('/(auth)/login' as any)}>
              <Text style={s.btnVoltarText}>Voltar ao Login</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.btnReenviar} onPress={() => setEnviado(false)}>
              <Text style={s.btnReenviarText}>Tentar com outro email</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.dark, justifyContent: 'center' },
  bgGlow:  { position: 'absolute', top: -100, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(232,23,58,0.07)' },
  content: { padding: 28, maxWidth: 420, width: '100%', alignSelf: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 36 },
  backText:{ fontSize: 13, color: Colors.muted },
  iconWrap:{ width: 68, height: 68, borderRadius: 20, backgroundColor: 'rgba(232,23,58,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:   { fontSize: 28, fontWeight: '800', color: Colors.white, lineHeight: 36, marginBottom: 12 },
  sub:     { fontSize: 14, color: Colors.muted, lineHeight: 22, marginBottom: 28 },
  label:   { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 1, marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark2, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, height: 52, marginBottom: 20,
  },
  inputWrapFocus: { borderColor: Colors.red, backgroundColor: 'rgba(232,23,58,0.04)' },
  input: { flex: 1, fontSize: 15, color: Colors.white },
  btnEnviar: { backgroundColor: Colors.red, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnEnviarText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  dicaBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(232,180,75,0.07)', borderWidth: 1, borderColor: 'rgba(232,180,75,0.2)', borderRadius: 12, padding: 14, marginBottom: 24 },
  dicaText:{ flex: 1, fontSize: 12, color: Colors.muted, lineHeight: 17 },
  btnVoltar: { backgroundColor: Colors.red, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  btnVoltarText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  btnReenviar: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnReenviarText: { fontSize: 14, color: Colors.muted },
})