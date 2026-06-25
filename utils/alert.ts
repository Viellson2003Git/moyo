import { Alert, Platform } from 'react-native'

export function mostrarAlerta(titulo: string, mensagem?: string) {
  if (Platform.OS === 'web') {
    window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo)
  } else {
    Alert.alert(titulo, mensagem)
  }
}

export function confirmar(titulo: string, mensagem: string, onConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) onConfirmar()
  } else {
    Alert.alert(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: onConfirmar },
    ])
  }
}