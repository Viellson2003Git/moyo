// app/_layout.tsx
import { Stack } from 'expo-router'
import { ProvinciaProvider } from '../contexts/ProvinciaContext'

export default function RootLayout() {
  return (
    <ProvinciaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ProvinciaProvider>
  )
}