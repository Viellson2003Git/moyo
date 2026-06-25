// hooks/usePushNotifications.ts
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { supabase } from '../lib/supabase'

// Detecta se estamos a correr dentro do Expo Go
const isExpoGo = Constants.appOwnership === 'expo'

export function usePushNotifications(userId?: string) {
  const [expoPushToken, setExpoPushToken] = useState<string>('')
const notifListener = useRef<any>(undefined)
const responseListener = useRef<any>(undefined)

  useEffect(() => {
    if (!userId) return

    // No Expo Go (SDK 53+) push notifications nativas não funcionam —
    // evita carregar o módulo para não rebentar a app
    if (isExpoGo) {
      console.log('ℹ️ Push notifications desactivadas no Expo Go. Usa um development build para testar push reais.')
      return
    }

    registerForPush()

    // Carrega o módulo dinamicamente só fora do Expo Go
    const Notifications = require('expo-notifications')

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    })

    notifListener.current = Notifications.addNotificationReceivedListener((n: any) => {
      console.log('Notificação recebida:', n)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((r: any) => {
      console.log('Clicou na notificação:', r)
    })

    return () => {
      if (notifListener.current) Notifications.removeNotificationSubscription(notifListener.current)
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current)
    }
  }, [userId])

  async function registerForPush() {
    if (isExpoGo) return

    try {
      const Notifications = require('expo-notifications')
      const Device = require('expo-device')

      if (!Device.isDevice) return

      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') return

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('moyo-urgente', {
          name: 'Moyo Urgente',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#E8173A',
          sound: 'default',
        })
        await Notifications.setNotificationChannelAsync('moyo-geral', {
          name: 'Moyo Geral',
          importance: Notifications.AndroidImportance.DEFAULT,
        })
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId
        ?? Constants.easConfig?.projectId

      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      )
      setExpoPushToken(token.data)

      if (userId && token.data) {
        await supabase.from('profiles').update({
          push_token: token.data,
        }).eq('id', userId)
      }
    } catch (e) {
      console.log('Erro ao registar push (ignorado em dev):', e)
    }
  }

  return { expoPushToken }
}