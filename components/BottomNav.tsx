// components/BottomNav.tsx
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Colors } from '../constants/colors'

type NavItem = {
  icon: keyof typeof Feather.glyphMap
  label: string
  route?: string
  onPress?: () => void
  active?: boolean
  badge?: number
}

export default function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <View style={s.wrapper}>
      <View style={s.pill}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={s.item}
            onPress={() => item.onPress ? item.onPress() : item.route && router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={[s.iconWrap, item.active && s.iconWrapActive]}>
              <Feather
                name={item.icon}
                size={20}
                color={item.active ? Colors.white : Colors.muted}
              />
              {item.badge && item.badge > 0 ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{item.badge > 9 ? '9+' : item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.label, item.active && s.labelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: Colors.dark2,
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrapActive: {
    backgroundColor: Colors.red,
  },
  label: {
    fontSize: 9,
    color: Colors.muted,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.redSoft,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5, borderColor: Colors.dark2,
  },
  badgeText: { fontSize: 7, fontWeight: '800', color: Colors.dark },
})