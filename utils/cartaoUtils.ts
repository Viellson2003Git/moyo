import { Platform } from 'react-native'

// ── Capturar imagem ──────────────────────────────
export async function capturarCartao(ref: any, elementId?: string): Promise<string> {
  if (Platform.OS === 'web') {
    // Web — usa html2canvas
    const html2canvas = (await import('html2canvas')).default
    const element = document.getElementById(elementId || 'cartao-digital')
    if (!element) throw new Error('Elemento não encontrado')
    const canvas = await html2canvas(element, { useCORS: true, scale: 2 })
    return canvas.toDataURL('image/png')
  } else {
    // Mobile — usa ViewShot
    if (!ref?.current?.capture) throw new Error('Ref inválida')
    return await ref.current.capture()
  }
}

// ── Descarregar/Guardar ──────────────────────────
export async function guardarCartao(uri: string, nomeArquivo: string) {
  if (Platform.OS === 'web') {
    // Web — download directo via browser
    const link = document.createElement('a')
    link.href = uri
    link.download = `${nomeArquivo}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } else {
    // Mobile — guarda na galeria
    const MediaLibrary = await import('expo-media-library')
    const { status } = await MediaLibrary.requestPermissionsAsync()
    if (status !== 'granted') throw new Error('Permissão negada')
    const asset = await MediaLibrary.createAssetAsync(uri)
    await MediaLibrary.createAlbumAsync('Moyo', asset, false)
  }
}

// ── Partilhar ────────────────────────────────────
export async function partilharCartao(uri: string) {
  if (Platform.OS === 'web') {
    // Web — usa Web Share API (funciona no Chrome/Safari móvel)
    if (navigator.share) {
      const blob = await (await fetch(uri)).blob()
      const file = new File([blob], 'moyo-cartao.png', { type: 'image/png' })
      await navigator.share({ title: 'Meu Cartão Moyo', files: [file] })
    } else {
      // Fallback — faz download
      await guardarCartao(uri, 'moyo-cartao')
    }
  } else {
    // Mobile — usa expo-sharing
    const Sharing = await import('expo-sharing')
    const disponivel = await Sharing.isAvailableAsync()
    if (disponivel) await Sharing.shareAsync(uri)
  }
}