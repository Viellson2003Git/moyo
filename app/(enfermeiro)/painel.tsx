// app/(enfermeiro)/painel.tsx
import { useEffect, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Animated
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'

type CheckIn = {
  id: string
  numero_ordem: number
  estado: string
  voluntarios: { tipo_sanguineo: string | null; profiles: { nome: string } | null } | null
}

export default function PainelFila() {
  const [fila, setFila]           = useState<CheckIn[]>([])
  const [emAtendimento, setEmAtendimento] = useState<CheckIn | null>(null)
  const [bancoId, setBancoId]     = useState<string | null>(null)
  const [hora, setHora]           = useState('')
  const pulseAnim                 = useRef(new Animated.Value(1)).current

  useEffect(() => {
    loadBanco()
    // Actualiza hora
    const timerHora = setInterval(() => {
      setHora(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    setHora(new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }))

    // Animação pulsar
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    pulse.start()

    return () => { clearInterval(timerHora); pulse.stop() }
  }, [])

  useEffect(() => {
    if (!bancoId) return
    loadFila()
    // Actualiza a fila a cada 5 segundos
    const timer = setInterval(loadFila, 5000)
    return () => clearInterval(timer)
  }, [bancoId])

  async function loadBanco() {
    const { data } = await supabase
      .from('bancos_sangue').select('id').eq('ativo', true).single()
    if (data) setBancoId(data.id)
  }

  async function loadFila() {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('check_ins')
      .select('id, numero_ordem, estado, voluntarios(tipo_sanguineo, profiles(nome))')
      .eq('banco_id', bancoId)
      .eq('data', hoje)
      .in('estado', ['aguardando', 'em_atendimento'])
      .order('numero_ordem')

    const todos = (data as any) || []
    setEmAtendimento(todos.find((f: CheckIn) => f.estado === 'em_atendimento') || null)
    setFila(todos.filter((f: CheckIn) => f.estado === 'aguardando'))
  }

  const hoje = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  })

  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={18} color={Colors.muted} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerLogo}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
          <Text style={s.headerSub}>Painel de Fila · Hospital Ngola Kimbanda</Text>
        </View>
        <View style={s.headerHora}>
          <Text style={s.hora}>{hora}</Text>
          <Text style={s.data}>{hoje}</Text>
        </View>
      </View>

      <View style={s.body}>

        {/* Em Atendimento */}
        <View style={s.atendimentoSection}>
          <Text style={s.sectionLabel}>EM ATENDIMENTO</Text>
          {emAtendimento ? (
            <Animated.View style={[s.atendimentoCard, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={s.atendimentoNum}>{emAtendimento.numero_ordem}</Text>
              <View style={s.atendimentoInfo}>
                <Text style={s.atendimentoNome}>
                  {(emAtendimento.voluntarios as any)?.profiles?.nome || '—'}
                </Text>
                {(emAtendimento.voluntarios as any)?.tipo_sanguineo && (
                  <View style={s.atendimentoTipo}>
                    <Text style={s.atendimentoTipoText}>
                      {(emAtendimento.voluntarios as any).tipo_sanguineo}
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.atendimentoDot} />
            </Animated.View>
          ) : (
            <View style={s.semAtendimento}>
              <Text style={s.semAtendimentoText}>Nenhum em atendimento</Text>
            </View>
          )}
        </View>

        {/* Fila de espera */}
        <View style={s.filaSection}>
          <View style={s.filaHeader}>
            <Text style={s.sectionLabel}>AGUARDANDO</Text>
            <Text style={s.filaTotal}>{fila.length} na fila</Text>
          </View>

          {fila.length === 0 ? (
            <View style={s.filaVazia}>
              <Feather name="check-circle" size={32} color={Colors.green} style={{ marginBottom: 8 }} />
              <Text style={s.filaVaziaText}>Fila vazia</Text>
            </View>
          ) : (
            <View style={s.filaGrid}>
              {fila.map((item, i) => (
                <View
                  key={item.id}
                  style={[s.filaItem, i === 0 && s.filaItemNext]}
                >
                  <Text style={[s.filaItemNum, i === 0 && s.filaItemNumNext]}>
                    {item.numero_ordem}
                  </Text>
                  {i === 0 && (
                    <Text style={s.nextLabel}>PRÓXIMO</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

      </View>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.footerDot} />
        <Text style={s.footerText}>
          Painel actualizado automaticamente a cada 5 segundos · Moyo
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark2, paddingHorizontal: 28,
    paddingVertical: 18, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)', gap: 16,
  },
  backBtn:     { padding: 4 },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerLogo:  { fontSize: 24, fontWeight: '800', color: Colors.white },
  headerSub:   { fontSize: 11, color: Colors.muted, marginTop: 2 },
  headerHora:  { alignItems: 'flex-end' },
  hora:        { fontSize: 28, fontWeight: '800', color: Colors.white, fontVariant: ['tabular-nums'] },
  data:        { fontSize: 11, color: Colors.muted, marginTop: 2 },

  body: { flex: 1, padding: 28, gap: 24 },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: Colors.muted,
    letterSpacing: 2, marginBottom: 14,
  },

  atendimentoSection: { },
  atendimentoCard: {
    backgroundColor: Colors.dark2, borderRadius: 20,
    padding: 28, flexDirection: 'row', alignItems: 'center', gap: 24,
    borderWidth: 2, borderColor: Colors.red,
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
    position: 'relative', overflow: 'hidden',
  },
  atendimentoNum: {
    fontSize: 72, fontWeight: '900', color: Colors.redSoft,
    lineHeight: 80, minWidth: 100, textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  atendimentoInfo:     { flex: 1 },
  atendimentoNome:     { fontSize: 28, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  atendimentoTipo:     { backgroundColor: Colors.redGlow, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start' },
  atendimentoTipoText: { fontSize: 20, fontWeight: '800', color: Colors.redSoft },
  atendimentoDot: {
    position: 'absolute', top: 20, right: 20,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.green,
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 4,
  },
  semAtendimento: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  semAtendimentoText: { fontSize: 16, color: Colors.muted },

  filaSection: { flex: 1 },
  filaHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  filaTotal:   { fontSize: 14, fontWeight: '600', color: Colors.muted },

  filaVazia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filaVaziaText: { fontSize: 18, color: Colors.muted },

  filaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  filaItem: {
    width: 90, height: 90, borderRadius: 16,
    backgroundColor: Colors.dark2, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  filaItemNext: {
    backgroundColor: 'rgba(232,23,58,0.1)',
    borderColor: 'rgba(232,23,58,0.4)',
    borderWidth: 2,
  },
  filaItemNum:     { fontSize: 32, fontWeight: '800', color: Colors.muted, fontVariant: ['tabular-nums'] },
  filaItemNumNext: { color: Colors.redSoft },
  nextLabel: { fontSize: 9, fontWeight: '800', color: Colors.redSoft, letterSpacing: 0.5, marginTop: 2 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14,
    backgroundColor: Colors.dark2, borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  footerText: { fontSize: 11, color: Colors.muted2 },
})