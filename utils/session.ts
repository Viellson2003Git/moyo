// utils/session.ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const CHAVE_TELEFONE  = 'moyo_remembered_phone'
const CHAVE_TIMESTAMP = 'moyo_remembered_at'
const VALIDADE_MS     = 24 * 60 * 60 * 1000 // 24 horas — ajusta aqui se quiseres outro prazo

export async function guardarTelefoneLembrado(telefone: string) {
  await AsyncStorage.setItem(CHAVE_TELEFONE, telefone)
  await AsyncStorage.setItem(CHAVE_TIMESTAMP, Date.now().toString())
}

export async function obterTelefoneLembrado(): Promise<{ telefone: string; valido: boolean } | null> {
  const telefone  = await AsyncStorage.getItem(CHAVE_TELEFONE)
  const timestamp = await AsyncStorage.getItem(CHAVE_TIMESTAMP)
  if (!telefone || !timestamp) return null
  const valido = (Date.now() - parseInt(timestamp, 10)) < VALIDADE_MS
  return { telefone, valido }
}

export async function limparTelefoneLembrado() {
  await AsyncStorage.removeItem(CHAVE_TELEFONE)
  await AsyncStorage.removeItem(CHAVE_TIMESTAMP)
}