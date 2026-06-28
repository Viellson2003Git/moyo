// app/(voluntario)/agendar.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, Alert
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { useProvinciaDoUser } from '../../hooks/useProvincia'
import { SafeAreaView } from 'react-native-safe-area-context'

type Slot = {
  id: string
  data: string
  hora: string
  vagas_totais: number
  vagas_ocupadas: number
  tipo_doacao: string
  banco_id: string
}

type Banco = {
  id: string
  nome: string
  municipio: string
  provincia: string
}

const MESES      = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA_CURTO = ['D','S','T','Q','Q','S','S']
const DIAS_SEMANA_LONGO = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

export default function Agendar() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900
  const { provinciaId } = useProvinciaDoUser()
  const today = new Date()
  const [ano, setAno]     = useState(today.getFullYear())
  const [mes, setMes]     = useState(today.getMonth())
  const [diaSel, setDiaSel] = useState<number | null>(null)

  const [bancos, setBancos]       = useState<Banco[]>([])
  const [bancoSel, setBancoSel]   = useState<string | null>(null)
  const [slots, setSlots]         = useState<Slot[]>([])
  const [diasComSlots, setDiasComSlots] = useState<Set<number>>(new Set())

  const [loading, setLoading]     = useState(true)
  const [agendando, setAgendando] = useState<string | null>(null)
  const [voluntarioId, setVoluntarioId] = useState<string | null>(null)
  const [isApto, setIsApto]       = useState(false)

  useEffect(() => { loadInicial() }, [])
  useEffect(() => { if (voluntarioId) loadSlots() }, [mes, ano, bancoSel, voluntarioId])

  async function loadInicial() {

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const [{ data: vol }, { data: bancosData }] = await Promise.all([
      supabase.from('voluntarios').select('id, estado').eq('profile_id', user.id).single(),
      supabase.from('bancos_sangue').select('id, nome, municipio, provincia').eq('ativo', true).order('nome'),
    ])

    if (vol) {
      setVoluntarioId(vol.id)
      setIsApto(vol.estado === 'apto')
    }

    const lista = (bancosData || []) as Banco[]
    setBancos(lista)
    if (lista.length > 0) setBancoSel(lista[0].id)
    setLoading(false)
  }




async function loadSlots() {
  const primeiroDia  = `${ano}-${String(mes+1).padStart(2,'0')}-01`
  const ultimoDia    = new Date(ano, mes+1, 0)
  const ultimoDiaStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(ultimoDia.getDate()).padStart(2,'0')}`

  let query = supabase
    .from('slots')
    .select('id, data, hora, vagas_totais, vagas_ocupadas, tipo_doacao, banco_id')
    .gte('data', primeiroDia)
    .lte('data', ultimoDiaStr)
    .eq('ativo', true)
    .order('hora')

  if (bancoSel) query = query.eq('banco_id', bancoSel)

  const { data } = await query
  const todos = (data || []) as Slot[]
  setSlots(todos)

  const dias = new Set<number>()
  todos.forEach(s => {
    if (s.vagas_totais - s.vagas_ocupadas > 0)
      dias.add(new Date(s.data + 'T00:00:00').getDate())
  })
  setDiasComSlots(dias)
}


  // Filtra se tiver província definida

  async function handleAgendar(slot: Slot) {
    if (!voluntarioId) return
    if (!isApto) {
      Alert.alert('Conta Pendente', 'Completa os exames no hospital antes de agendar.')
      return
    }
    setAgendando(slot.id)
    try {
      const { data: existing } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('voluntario_id', voluntarioId)
        .eq('slot_id', slot.id)
        .neq('estado', 'cancelado')
        .maybeSingle()

      if (existing) {
        Alert.alert('Atenção', 'Já tens um agendamento neste horário.')
        setAgendando(null)
        return
      }

      const { error } = await supabase.from('agendamentos').insert({
        voluntario_id: voluntarioId,
        slot_id: slot.id,
        estado: 'pendente',
      })

      if (error) throw error

      Alert.alert(
        '✅ Agendado!',
        `Doação marcada para ${formatData(slot.data)} às ${slot.hora.slice(0,5)}.\n\nPresenta o teu QR Code no hospital.`,
        [{ text: 'Ver Histórico', onPress: () => router.push('/(voluntario)/historico' as any) }]
      )
      loadSlots()
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
    setAgendando(null)
  }

  function buildCalendar() {
    const primeiro = new Date(ano, mes, 1).getDay()
    const total    = new Date(ano, mes+1, 0).getDate()
    const cells: (number | null)[] = []
    for (let i = 0; i < primeiro; i++) cells.push(null)
    for (let d = 1; d <= total; d++) cells.push(d)
    return cells
  }

  const cells      = buildCalendar()
  const hoje       = today.getDate()
  const mesAtual   = today.getMonth()
  const anoAtual   = today.getFullYear()
  const slotsDoDia = diaSel ? slots.filter(s => new Date(s.data + 'T00:00:00').getDate() === diaSel) : []
  const bancoAtual = bancos.find(b => b.id === bancoSel)

  function isPast(dia: number) {
    if (ano < anoAtual) return true
    if (ano === anoAtual && mes < mesAtual) return true
    if (ano === anoAtual && mes === mesAtual && dia < hoje) return true
    return false
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {isWeb && <SidebarWeb onLogout={async () => { await supabase.auth.signOut(); router.replace('/(auth)/login') }} />}

      <View style={s.main}>

        {/* Topbar */}
        <View style={[s.topbar]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>📅 Agendar Doação</Text>
          <View style={{ flex: 1 }} />
          <View style={s.topbarBadge}>
            <Text style={s.topbarBadgeText}>VOLUNTÁRIO</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.content}>

            {/* Aviso conta pendente */}
            {!isApto && (
              <View style={s.warningBox}>
                <Feather name="lock" size={18} color={Colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={s.warningTitle}>Conta Pendente</Text>
                  <Text style={s.warningText}>
                    Completa os exames no Hospital Ngola Kimbanda para poderes agendar doações.
                  </Text>
                </View>
              </View>
            )}

            {/* Selector de hospital */}
            <View style={s.hospitalSection}>
              <Text style={s.sectionLabel}>
                <Feather name="map-pin" size={13} color={Colors.muted} /> BANCO DE SANGUE
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={s.bancosRow}>
                  {bancos.map(b => (
                    <TouchableOpacity
                      key={b.id}
                      style={[s.bancoBtn, bancoSel === b.id && s.bancoBtnActive]}
                      onPress={() => { setBancoSel(b.id); setDiaSel(null) }}
                    >
                      <Feather
                        name="activity"
                        size={13}
                        color={bancoSel === b.id ? Colors.white : Colors.muted}
                      />
                      <View>
                        <Text style={[s.bancoBtnNome, bancoSel === b.id && { color: Colors.white }]}>
                          {b.nome}
                        </Text>
                        <Text style={s.bancoBtnLocal}>
                          {b.municipio}, {b.provincia}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {bancos.length === 0 && (
                    <Text style={s.bancoBtnNome}>Nenhum banco disponível</Text>
                  )}
                </View>
              </ScrollView>
            </View>

            {/* Layout principal: calendário + slots */}
            <View style={[s.layout, isWeb && s.layoutWeb]}>

              {/* ── CALENDÁRIO ── */}
              <View style={[s.calCard, isWeb && s.calCardWeb]}>

                {/* Header mês */}
                <View style={s.calHeader}>
                  <TouchableOpacity style={s.calNavBtn} onPress={() => {
                    if (mes === 0) { setMes(11); setAno(a => a-1) } else setMes(m => m-1)
                    setDiaSel(null)
                  }}>
                    <Feather name="chevron-left" size={16} color={Colors.white} />
                  </TouchableOpacity>
                  <Text style={s.calTitle}>{MESES[mes]} {ano}</Text>
                  <TouchableOpacity style={s.calNavBtn} onPress={() => {
                    if (mes === 11) { setMes(0); setAno(a => a+1) } else setMes(m => m+1)
                    setDiaSel(null)
                  }}>
                    <Feather name="chevron-right" size={16} color={Colors.white} />
                  </TouchableOpacity>
                </View>

                {/* Dias da semana */}
                <View style={s.calWeekRow}>
                  {DIAS_SEMANA_CURTO.map((d, i) => (
                    <Text key={i} style={s.calWeekText}>{d}</Text>
                  ))}
                </View>

                {/* Grid */}
                <View style={s.calGrid}>
                  {cells.map((dia, i) => {
                    if (!dia) return <View key={`e${i}`} style={s.calCell} />
                    const hasSlots = diasComSlots.has(dia)
                    const past     = isPast(dia)
                    const isToday  = dia === hoje && mes === mesAtual && ano === anoAtual
                    const selected = dia === diaSel
                    return (
                      <TouchableOpacity
                        key={`d${dia}`}
                        style={[
                          s.calCell,
                          isToday  && s.calCellToday,
                          selected && !isToday && s.calCellSelected,
                        ]}
                        onPress={() => !past && setDiaSel(dia)}
                        disabled={past}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          s.calCellText,
                          past     && s.calCellTextPast,
                          isToday  && s.calCellTextToday,
                          selected && !isToday && s.calCellTextSelected,
                        ]}>
                          {dia}
                        </Text>
                        {hasSlots && !past && (
                          <View style={[s.calDot, selected && { backgroundColor: Colors.white }]} />
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Legenda */}
                <View style={s.calLegenda}>
                  <View style={s.calLegendaItem}>
                    <View style={s.calDotLegenda} />
                    <Text style={s.calLegendaText}>Slots disponíveis</Text>
                  </View>
                </View>
              </View>

              {/* ── SLOTS DO DIA ── */}
              <View style={[s.slotsPanel, isWeb && s.slotsPanelWeb]}>
                {!diaSel ? (
                  <View style={s.slotsPlaceholder}>
                    <View style={s.slotsPlaceholderIcon}>
                      <Feather name="calendar" size={28} color={Colors.muted2} />
                    </View>
                    <Text style={s.slotsPlaceholderTitle}>Selecciona um dia</Text>
                    <Text style={s.slotsPlaceholderText}>
                      Escolhe um dia no calendário para ver os horários disponíveis
                      {bancoAtual ? ` em ${bancoAtual.nome}` : ''}.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Header do dia */}
                    <View style={s.slotsDayHeader}>
                      <Text style={s.slotsDayTitle}>
                        {diaSel} de {MESES[mes]}, {ano}
                      </Text>
                      <Text style={s.slotsDaySubtitle}>
                        {DIAS_SEMANA_LONGO[new Date(ano, mes, diaSel).getDay()]}
                        {bancoAtual ? ` · ${bancoAtual.nome}` : ''}
                      </Text>
                    </View>

                    {slotsDoDia.length === 0 ? (
                      <View style={s.slotsPlaceholder}>
                        <Feather name="slash" size={28} color={Colors.muted2} />
                        <Text style={s.slotsPlaceholderTitle}>Sem horários</Text>
                        <Text style={s.slotsPlaceholderText}>
                          Não há slots disponíveis neste dia. Tenta outro dia ou banco de sangue.
                        </Text>
                      </View>
                    ) : (
                      slotsDoDia.map(slot => {
                        const disp   = slot.vagas_totais - slot.vagas_ocupadas
                        const lotado = disp <= 0
                        const pouco  = disp > 0 && disp <= 3
                        return (
                          <View key={slot.id} style={[s.slotItem, lotado && s.slotItemLotado]}>
                            {/* Hora */}
                            <View style={s.slotHoraWrap}>
                              <Text style={s.slotHora}>{slot.hora.slice(0,5)}</Text>
                            </View>

                            {/* Info */}
                            <View style={s.slotInfo}>
                              <Text style={s.slotHospital}>
                                {bancoAtual?.nome || 'Hospital Ngola Kimbanda'}
                              </Text>
                              <Text style={s.slotTipo}>
                                {slot.tipo_doacao} · {bancoAtual?.municipio || 'Namibe'}
                              </Text>
                            </View>

                            {/* Vagas + botão */}
                            <View style={s.slotActions}>
                              <View style={s.slotVagasWrap}>
                                <Text style={[
                                  s.slotVagasNum,
                                  lotado ? { color: Colors.redSoft } :
                                  pouco  ? { color: Colors.gold }    :
                                  { color: Colors.green }
                                ]}>
                                  {disp}
                                </Text>
                                <Text style={s.slotVagasLabel}>vagas</Text>
                              </View>

                              <TouchableOpacity
                                style={[
                                  s.slotBtn,
                                  lotado   && s.slotBtnLotado,
                                  !isApto  && s.slotBtnDisabled,
                                ]}
                                onPress={() => handleAgendar(slot)}
                                disabled={lotado || !isApto || agendando === slot.id}
                              >
                                {agendando === slot.id
                                  ? <ActivityIndicator size="small" color={Colors.white} />
                                  : <Text style={s.slotBtnText}>
                                      {lotado ? 'Lotado' : 'Agendar'}
                                    </Text>
                                }
                              </TouchableOpacity>
                            </View>
                          </View>
                        )
                      })
                    )}
                  </>
                )}
              </View>
            </View>

            <View style={{ height: isWeb ? 40 : 100 }} />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}

function formatData(data: string) {
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-PT', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
}

function SidebarWeb({ onLogout }: { onLogout: () => void }) {
  const items: { icon: keyof typeof Feather.glyphMap; label: string; route: string; active?: boolean }[] = [
    { icon: 'grid',        label: 'Dashboard', route: '/(voluntario)'            },
    { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'     },
    { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar', active: true },
    { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico'  },
    { icon: 'activity',    label: 'Campanhas', route: '/(voluntario)/campanhas'  },
    { icon: 'users',       label: 'ONGs',      route: '/(voluntario)/ongs'       },
    { icon: 'book-open',   label: 'Educação',  route: '/(voluntario)/educacao'   },
  ]
  return (
    <View style={s.sidebar}>
      <View>
        <View style={s.sidebarLogo}>
          <View style={s.sidebarLogoIcon}>
            <Text style={{ color: Colors.white, fontWeight: '800', fontSize: 15 }}>B</Text>
          </View>
          <Text style={s.sidebarLogoText}>
            MO<Text style={{ color: Colors.redSoft }}>YO</Text>
          </Text>
        </View>
        <View style={{ gap: 3 }}>
          {items.map(n => (
            <TouchableOpacity
              key={n.label}
              style={[s.sidebarItem, n.active && s.sidebarItemActive]}
              onPress={() => router.push(n.route as any)}
            >
              <Feather name={n.icon} size={15} color={n.active ? Colors.redSoft : Colors.muted} />
              <Text style={[s.sidebarItemLabel, n.active && { color: Colors.redSoft }]}>{n.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={s.sidebarLogout} onPress={onLogout}>
        <Feather name="log-out" size={15} color={Colors.muted} />
        <Text style={s.sidebarLogoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },
  main:    { flex: 1, flexDirection: 'column' },
  content: { padding: 20 },

  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  backBtn:         { padding: 8 },
  topbarTitle:     { fontSize: 16, fontWeight: '700', color: Colors.white },
  topbarBadge:     { backgroundColor: Colors.red, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },

  warningBox: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: 'rgba(232,180,75,0.07)',
    borderWidth: 1, borderColor: 'rgba(232,180,75,0.25)',
    borderRadius: 12, padding: 16, marginBottom: 16,
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: Colors.gold, marginBottom: 3 },
  warningText:  { fontSize: 12, color: Colors.muted, lineHeight: 18 },

  // Hospital selector
  hospitalSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8 },
  bancosRow:    { flexDirection: 'row', gap: 8 },
  bancoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.dark2, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    minWidth: 180,
  },
  bancoBtnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  bancoBtnNome:   { fontSize: 13, fontWeight: '600', color: Colors.muted },
  bancoBtnLocal:  { fontSize: 11, color: Colors.muted2, marginTop: 1 },

  // Layout
  layout:    { gap: 16 },
  layoutWeb: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },

  // Calendário
  calCard: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  calCardWeb: { width: 300, flexShrink: 0 },

  calHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  calNavBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: Colors.dark4,
    alignItems: 'center', justifyContent: 'center',
  },
  calTitle: { fontSize: 14, fontWeight: '700', color: Colors.white },

  calWeekRow: { flexDirection: 'row', marginBottom: 6 },
  calWeekText: {
    flex: 1, textAlign: 'center',
    fontSize: 11, fontWeight: '600', color: Colors.muted2,
  },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100/7}%` as any,
    aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, position: 'relative',
  },
  calCellToday:    { backgroundColor: Colors.red },
  calCellSelected: { backgroundColor: 'rgba(232,23,58,0.2)', borderWidth: 1, borderColor: Colors.red },
  calCellText:     { fontSize: 13, color: Colors.white, fontWeight: '500' },
  calCellTextPast: { color: Colors.muted2 },
  calCellTextToday:    { fontWeight: '800', color: Colors.white },
  calCellTextSelected: { color: Colors.redSoft, fontWeight: '700' },
  calDot: {
    position: 'absolute', bottom: 3,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.red,
  },
  calLegenda:     { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  calLegendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calDotLegenda:  { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
  calLegendaText: { fontSize: 11, color: Colors.muted },

  // Slots
  slotsPanel: { flex: 1 },
  slotsPanelWeb: {
    flex: 1, backgroundColor: Colors.dark2,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    minHeight: 327,
  },

  slotsPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  slotsPlaceholderIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.dark3,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  slotsPlaceholderTitle: { fontSize: 15, fontWeight: '700', color: Colors.white },
  slotsPlaceholderText:  { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 18 },

  slotsDayHeader:    { marginBottom: 14 },
  slotsDayTitle:     { fontSize: 16, fontWeight: '700', color: Colors.white },
  slotsDaySubtitle:  { fontSize: 12, color: Colors.muted, marginTop: 2 },

  slotItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark3, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  slotItemLotado: { opacity: 0.5 },

  slotHoraWrap:  { minWidth: 56 },
  slotHora:      { fontSize: 20, fontWeight: '800', color: Colors.white },

  slotInfo:      { flex: 1 },
  slotHospital:  { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  slotTipo:      { fontSize: 12, color: Colors.muted },

  slotActions:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotVagasWrap: { alignItems: 'center' },
  slotVagasNum:  { fontSize: 20, fontWeight: '800' },
  slotVagasLabel:{ fontSize: 9, color: Colors.muted },

  slotBtn: {
    backgroundColor: Colors.red, borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 16,
    minWidth: 80, alignItems: 'center',
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 3,
  },
  slotBtnLotado:   { backgroundColor: Colors.dark5, shadowOpacity: 0 },
  slotBtnDisabled: { opacity: 0.5 },
  slotBtnText:     { fontSize: 13, fontWeight: '700', color: Colors.white },

  // Sidebar
  sidebar:              { width: 220, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 18, justifyContent: 'space-between' },
  sidebarLogo:          { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  sidebarLogoIcon:      { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText:      { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarItem:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive:    { backgroundColor: Colors.redGlow },
  sidebarItemLabel:     { fontSize: 13, fontWeight: '500', color: Colors.muted },
  sidebarLogout:        { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  sidebarLogoutText:    { fontSize: 13, color: Colors.muted },

  bottomNav: {
    flexDirection: 'row', backgroundColor: Colors.dark2,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10,
  },
  navItem:  { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 10, color: Colors.muted, fontWeight: '500' },
})