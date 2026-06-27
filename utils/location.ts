// utils/location.ts
import { Platform } from 'react-native'

export async function obterLocalizacao(): Promise<{ latitude: number; longitude: number } | null> {
  if (Platform.OS === 'web') {
    // Web — usa a API do browser
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 10000 }
      )
    })
  }

  // Mobile nativo — usa expo-location
  try {
    const Location = await import('expo-location')
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
  } catch {
    return null
  }
}

/**
 * Converte coordenadas numa morada legível (geocodificação inversa).
 * Na Web usa a API pública do Nominatim/OpenStreetMap.
 * Em Android/iOS usa expo-location (Location.reverseGeocodeAsync).
 */
export async function obterMorada(lat: number, lng: number): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      )
      const data = await res.json()
      const addr = data.address
      const m = [addr.road, addr.suburb, addr.city || addr.town || addr.village]
        .filter(Boolean).join(', ')
      return m || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
  }

  // Mobile nativo — usa expo-location
  try {
    const Location = await import('expo-location')
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    if (results && results[0]) {
      const r = results[0]
      const m = [r.street, r.district, r.city].filter(Boolean).join(', ')
      if (m) return m
    }
  } catch {
    // ignora — cai no fallback abaixo
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}