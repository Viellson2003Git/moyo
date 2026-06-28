import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'

const isExpoGo = Constants.appOwnership === 'expo'
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function usePushNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string>('')
  const notifListener    = useRef<Notifications.Subscription | null>(null)
  const responseListener = useRef<Notifications.Subscription | null>(null)

  useEffect(() => {
    if (!userId)               return
    if (Platform.OS === 'web') return
    if (isExpoGo) {
      console.log('🧪 Expo Go → push desativado (SDK 53+)')
      return
    }

    registerForPush(userId)

    notifListener.current = Notifications.addNotificationReceivedListener(n => {
      console.log('📩 Notificação recebida:', n)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(r => {
      console.log('👆 Utilizador clicou:', r)
    })

    return () => {
  notifListener.current?.remove()
  responseListener.current?.remove()
}
  }, [userId])

  async function registerForPush(uid: string) {
    try {
      if (!Device.isDevice) {
        console.log('⛔ Emulador — push não funciona corretamente')
        return
      }

      // ── Canais Android (obrigatório para channelId funcionar) ──
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('moyo-geral', {
          name: 'Geral',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 150, 150, 150],
          lightColor: '#E8173A',
        })
        await Notifications.setNotificationChannelAsync('moyo-urgente', {
          name: 'Urgente',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E8173A',
          bypassDnd: true,
        })
      }

      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        console.log('⛔ Permissão negada pelo utilizador')
        return
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId

      if (!projectId) {
        console.log('⛔ projectId não encontrado no app.json')
        return
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

      console.log('🔔 Push token:', token)
      setExpoPushToken(token)

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', uid)

      if (error) console.log('❌ Erro ao guardar token:', error.message)
      else        console.log('✅ Token guardado no Supabase')

    } catch (e: any) {
      console.log('❌ Erro no registo push:', e?.message ?? e)
    }
  }

  return { expoPushToken }
}