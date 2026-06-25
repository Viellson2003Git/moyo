// app/index.tsx
import { useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Colors } from '../constants/colors'
import { obterTelefoneLembrado } from '../utils/session'

export default function Index() {
  useEffect(() => { verificar() }, [])

  async function verificar() {
    const lembrado = await obterTelefoneLembrado()

    if (!lembrado) {
      // Nunca fez login neste dispositivo — mostra a landing
      router.replace('/(auth)/landing' as any)
      return
    }

    // Existe um telefone lembrado (válido ou expirado) — o ecrã de login
    // decide se mostra o modo rápido (só PIN) ou pede o telefone de novo
    router.replace('/(auth)/login' as any)
  }

  return (
    <View style={s.root}>
      <Text style={s.logo}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
      <ActivityIndicator size="large" color={Colors.red} style={{ marginTop: 24 }} />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 32, fontWeight: '800', color: Colors.white },
})