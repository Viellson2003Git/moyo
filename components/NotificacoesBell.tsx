// components/NotificacoesBell.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Platform
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Colors } from '../constants/colors'

type Notificacao = {
  id: string
  titulo: string
  mensagem: string | null
  tipo: string
  lida: boolean
  created_at: string
}

export default function NotificacoesBell({ userId }: { userId: string }) {
  const [notifs, setNotifs]       = useState<Notificacao[]>([])
  const [showModal, setShowModal] = useState(false)
  const naoLidas = notifs.filter(n => !n.lida).length

useEffect(() => {
  if (!userId) return
  loadNotifs()

  // Nome único por cada montagem do componente — elimina qualquer colisão
  const channelName = `notificacoes-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const canal = supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notificacoes',
      filter: `usuario_id=eq.${userId}`,
    }, () => loadNotifs())
    .subscribe()

  return () => { supabase.removeChannel(canal) }
}, [userId])

  async function loadNotifs() {
    const { data } = await supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, tipo, lida, created_at')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs((data as any) || [])
  }

  async function marcarLida(id: string) {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
  }

  async function marcarTodasLidas() {
    await supabase.from('notificacoes')
      .update({ lida: true })
      .eq('usuario_id', userId)
      .eq('lida', false)
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
  }

  function tipoIcon(tipo: string): keyof typeof Feather.glyphMap {
    const map: Record<string, keyof typeof Feather.glyphMap> = {
      urgente: 'alert-circle',
      sucesso: 'check-circle',
      aviso:   'alert-triangle',
      info:    'info',
    }
    return map[tipo] || 'bell'
  }

  function tipoCor(tipo: string) {
    return {
      urgente: Colors.redSoft,
      sucesso: Colors.green,
      aviso:   Colors.gold,
      info:    Colors.blue,
    }[tipo] || Colors.muted
  }

  function formatHora(dateStr: string) {
    const d = new Date(dateStr)
    const agora = new Date()
    const diff = agora.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const horas = Math.floor(mins / 60)
    const dias = Math.floor(horas / 24)
    if (mins < 1)   return 'agora'
    if (mins < 60)  return `${mins}m`
    if (horas < 24) return `${horas}h`
    return `${dias}d`
  }

  return (
    <>
      {/* Sino */}
      <TouchableOpacity
        style={s.bellWrap}
        onPress={() => setShowModal(true)}
      >
        <Feather name="bell" size={20} color={Colors.muted} />
        {naoLidas > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {naoLidas > 9 ? '9+' : naoLidas}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal de notificações */}
      <Modal visible={showModal} transparent animationType="fade">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowModal(false)}
        >
          <View
            style={[s.panel, Platform.OS === 'web' && s.panelWeb]}
            onStartShouldSetResponder={() => true}
          >
            {/* Header */}
            <View style={s.panelHeader}>
              <Text style={s.panelTitle}>Notificações</Text>
              <View style={s.panelHeaderRight}>
                {naoLidas > 0 && (
                  <TouchableOpacity onPress={marcarTodasLidas}>
                    <Text style={s.marcarTodasText}>Marcar todas como lidas</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Feather name="x" size={18} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lista */}
            <ScrollView style={s.lista} showsVerticalScrollIndicator={false}>
              {notifs.length === 0 ? (
                <View style={s.empty}>
                  <Feather name="bell-off" size={32} color={Colors.muted2} style={{ marginBottom: 10 }} />
                  <Text style={s.emptyText}>Sem notificações</Text>
                </View>
              ) : (
                notifs.map(n => (
                  <TouchableOpacity
                    key={n.id}
                    style={[s.item, !n.lida && s.itemNaoLido]}
                    onPress={() => marcarLida(n.id)}
                  >
                    <View style={[s.itemIcon, { backgroundColor: tipoCor(n.tipo) + '20' }]}>
                      <Feather name={tipoIcon(n.tipo)} size={16} color={tipoCor(n.tipo)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemTitulo}>{n.titulo}</Text>
                      {n.mensagem && (
                        <Text style={s.itemMensagem} numberOfLines={2}>{n.mensagem}</Text>
                      )}
                    </View>
                    <View style={s.itemRight}>
                      <Text style={s.itemHora}>{formatHora(n.created_at)}</Text>
                      {!n.lida && <View style={s.itemDot} />}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  bellWrap: { position: 'relative', padding: 6 },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.red,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2, borderColor: Colors.dark2,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'flex-end', justifyContent: 'flex-start',
    paddingTop: 60, paddingRight: 16,
  },
  panel: {
    backgroundColor: Colors.dark2,
    borderRadius: 16, width: 320, maxHeight: 480,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  panelWeb: { width: 360 },

  panelHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  panelTitle:      { fontSize: 15, fontWeight: '700', color: Colors.white },
  panelHeaderRight:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  marcarTodasText: { fontSize: 11, color: Colors.redSoft, fontWeight: '600' },

  lista: { maxHeight: 400 },

  item: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    padding: 14, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  itemNaoLido: { backgroundColor: 'rgba(255,255,255,0.03)' },
  itemIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  itemTitulo:   { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 3 },
  itemMensagem: { fontSize: 11, color: Colors.muted, lineHeight: 16 },
  itemRight:    { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  itemHora:     { fontSize: 10, color: Colors.muted2 },
  itemDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.red },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: Colors.muted },
})