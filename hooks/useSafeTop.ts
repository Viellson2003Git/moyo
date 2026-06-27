import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function useSafeTop() {
  const insets = useSafeAreaInsets()
  return insets.top
}