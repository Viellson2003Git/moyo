// utils/sendPush.ts
import { supabase } from '../lib/supabase'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export async function enviarPushParaUtilizadores(
  userIds: string[],
  titulo: string,
  mensagem: string,
  dados?: Record<string, any>
) {
  if (userIds.length === 0) return

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, push_token')
    .in('id', userIds)
    .not('push_token', 'is', null)

  const profilesValidos = (profiles || []).filter(
    (p: any) => p.push_token && p.push_token.startsWith('ExponentPushToken[')
  )

  if (profilesValidos.length === 0) return

  const isUrgente = dados?.urgente === true

  const messages = profilesValidos.map((p: any) => ({
    to: p.push_token,
    title: titulo,
    body: mensagem,
    data: dados || {},
    sound: 'default',
    priority: isUrgente ? 'high' : 'normal',
    badge: 1,
    // channelId só funciona se registado no dispositivo
    // registar em usePushNotifications com setNotificationChannelAsync
    ...(isUrgente && { channelId: 'moyo-urgente' }),
  }))

  // Lotes de 100 (limite da Expo API)
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      })

      const json = await res.json()

      // Limpa tokens inválidos do Supabase
      if (json?.data) {
        const invalidos: string[] = []

        json.data.forEach((result: any, idx: number) => {
          if (
            result.status === 'error' &&
            (result.details?.error === 'DeviceNotRegistered' ||
             result.details?.error === 'InvalidCredentials')
          ) {
            invalidos.push(profilesValidos[i + idx]?.id)
          }
        })

        if (invalidos.length > 0) {
          await supabase
            .from('profiles')
            .update({ push_token: null })
            .in('id', invalidos.filter(Boolean))
        }
      }
    } catch (e: any) {
      console.log('❌ Erro ao enviar push:', e?.message ?? e)
    }
  }
}

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

  const tiposCompativeis = COMPATIBILIDADE[tipoSanguineo] ?? [tipoSanguineo]

  const { data: doadores, error } = await supabase
    .from('voluntarios')
    .select('profile_id')
    .in('tipo_sanguineo', tiposCompativeis)
    .eq('estado', 'apto')
    .not('profile_id', 'is', null)

  if (error) {
    console.log('❌ Erro ao buscar doadores:', error.message)
    return
  }

  const ids = (doadores || [])
    .map((d: any) => d.profile_id)
    .filter(Boolean) as string[]

  if (ids.length === 0) {
    console.log('⚠️ Nenhum doador compatível encontrado')
    return
  }

  console.log(`📢 Enviando push urgente para ${ids.length} doadores compatíveis`)

  await enviarPushParaUtilizadores(
    ids,
    `🚨 Urgente — Sangue ${tipoSanguineo}`,
    `${nome} precisa de sangue ${tipoSanguineo} em ${morada || 'Luanda'}`,
    { urgente: true, tipo: tipoSanguineo }
  )
}