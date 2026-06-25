
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const supabaseUrl     = 'https://gzsaekyexeceelhjckdp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6c2Fla3lleGVjZWVsaGpja2RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODc4ODksImV4cCI6MjA5NTg2Mzg4OX0.dqIlKUvkj3z5vhb2ypsDEmFUjvsA9HAKGp2DQPPnStg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    supabase.auth.signOut()
  }
})