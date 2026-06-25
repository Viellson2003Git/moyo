// utils/sendPush.ts
import { supabase } from '../lib/supabase'

export async function enviarPushParaUtilizadores(
  userIds: string[],
  titulo: string,
  mensagem: string,
  dados?: Record<string, any>
) {
  if (userIds.length === 0) return

  // Busca tokens dos utilizadores
  const { data: profiles } = await supabase
    .from('profiles')
    .select('push_token')
    .in('id', userIds)
    .not('push_token', 'is', null)

  const tokens = (profiles || [])
    .map((p: any) => p.push_token)
    .filter(Boolean)

  if (tokens.length === 0) return

  // Envia via Expo Push API
  const messages = tokens.map(token => ({
    to: token,
    title: titulo,
    body: mensagem,
    data: dados || {},
    sound: 'default',
    priority: 'high',
    channelId: dados?.urgente ? 'moyo-urgente' : 'moyo-geral',
    badge: 1,
  }))

  // Envia em lotes de 100
  const chunks = []
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100))
  }

  for (const chunk of chunks) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(chunk),
    })
  }
}

// Envia push urgente para doadores compatíveis
export async function enviarPushUrgente(
  tipoSanguineo: string,
  nome: string,
  morada: string
) {
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

  const tiposCompativeis = COMPATIBILIDADE[tipoSanguineo] || [tipoSanguineo]

  const { data: doadores } = await supabase
    .from('voluntarios')
    .select('profile_id')
    .in('tipo_sanguineo', tiposCompativeis)
    .eq('estado', 'apto')

  const ids = (doadores || []).map((d: any) => d.profile_id)

  await enviarPushParaUtilizadores(
    ids,
    `🚨 Urgente — Sangue ${tipoSanguineo}`,
    `${nome} precisa de sangue ${tipoSanguineo} em ${morada || 'Namibe'}`,
    { urgente: true, tipo: tipoSanguineo }
  )
}