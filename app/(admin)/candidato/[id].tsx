// app/(admin)/candidato/[id].tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, Alert, TextInput
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../../lib/supabase'
import { Colors } from '../../../constants/colors'

type Voluntario = {
  id: string
  numero_serial: string
  tipo_sanguineo: string | null
  fator_rh: string | null
  estado: string
  data_nascimento: string | null
  sexo: string | null
  bi_numero: string | null
  morada: string | null
  created_at: string
  profiles: { nome: string; email: string; telefone: string | null } | null
}

type Exame = {
  id: string
  hemoglobina: number | null
  pressao_arterial: string | null
  peso: number | null
  resultado: string | null
  data_exame: string | null
  created_at: string
}

export default function DetalheCandidato() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [vol, setVol]         = useState<Voluntario | null>(null)
  const [exames, setExames]   = useState<Exame[]>([])
  const [loading, setLoading] = useState(true)

  // Modal exame
  const [showExame, setShowExame]     = useState(false)
  const [hemoglobina, setHemoglobina] = useState('')
  const [pressao, setPressao]         = useState('')
  const [peso, setPeso]               = useState('')
  const [resultado, setResultado]     = useState<'apto' | 'inapto_temp' | 'inapto_perm' | null>(null)
  const [salvando, setSalvando]       = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    if (!id) return
    setLoading(true)

    const { data: volData } = await supabase
      .from('voluntarios')
      .select('id, numero_serial, tipo_sanguineo, fator_rh, estado, data_nascimento, sexo, bi_numero, morada, created_at, profiles(nome, email, telefone)')
      .eq('id', id)
      .single()

    setVol(volData as any)

    const { data: examesData } = await supabase
      .from('exames')
      .select('id, hemoglobina, pressao_arterial, peso, resultado, data_exame, created_at')
      .eq('voluntario_id', id)
      .order('created_at', { ascending: false })

    setExames((examesData as any) || [])
    setLoading(false)
  }

  async function handleSalvarExame() {
    if (!resultado) {
      Alert.alert('Atenção', 'Selecciona um resultado.')
      return
    }
    setSalvando(true)
    try {
      const { error: exameError } = await supabase.from('exames').insert({
        voluntario_id:    id,
        hemoglobina:      hemoglobina ? parseFloat(hemoglobina) : null,
        pressao_arterial: pressao || null,
        peso:             peso ? parseFloat(peso) : null,
        resultado,
        data_exame:       new Date().toISOString().split('T')[0],
        data_resultado:   new Date().toISOString().split('T')[0],
        tipo_sanguineo:   vol?.tipo_sanguineo,
        fator_rh:         vol?.fator_rh,
      })
      if (exameError) throw exameError

      const novoEstado = resultado === 'apto' ? 'apto' : resultado
      await supabase.from('voluntarios').update({ estado: novoEstado }).eq('id', id)

      Alert.alert('✅ Exame registado!', `Candidato marcado como ${resultado === 'apto' ? 'Apto' : 'Inapto'}.`)
      setShowExame(false)
      setHemoglobina(''); setPressao(''); setPeso(''); setResultado(null)
      loadData()
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
    setSalvando(false)
  }

  async function handleMudarEstado(novoEstado: string) {
    Alert.alert(
      'Confirmar alteração',
      `Mudar estado para "${estadoLabel(novoEstado)}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: async () => {
          await supabase.from('voluntarios').update({ estado: novoEstado }).eq('id', id)
          loadData()
        }}
      ]
    )
  }

  function estadoLabel(e: string) {
    return {
      pendente: 'Pendente', em_exame: 'Em Exame', apto: 'Apto',
      inapto_temp: 'Inapto Temporário', inapto_perm: 'Inapto Permanente',
    }[e] || e
  }
  function estadoCor(e: string) {
    return {
      pendente: Colors.gold, em_exame: Colors.blue, apto: Colors.green,
      inapto_temp: Colors.gold, inapto_perm: Colors.redSoft,
    }[e] || Colors.muted
  }
  function estadoBg(e: string) {
    return {
      pendente: 'rgba(232,180,75,0.12)', em_exame: 'rgba(74,158,255,0.12)',
      apto: 'rgba(46,204,113,0.12)', inapto_temp: 'rgba(232,180,75,0.12)',
      inapto_perm: 'rgba(232,23,58,0.12)',
    }[e] || Colors.dark3
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  if (!vol) return (
    <View style={s.center}>
      <Feather name="alert-circle" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
      <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '700', marginBottom: 6 }}>Candidato não encontrado</Text>
      <TouchableOpacity onPress={() => router.back()} style={s.backBtnEmpty}>
        <Text style={{ color: Colors.redSoft, fontWeight: '600' }}>← Voltar</Text>
      </TouchableOpacity>
    </View>
  )

  const idade = vol.data_nascimento
    ? Math.floor((Date.now() - new Date(vol.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  return (
    <View style={s.root}>
      <View style={s.main}>

        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>Detalhe do Candidato</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={loadData} style={{ padding: 8 }}>
            <Feather name="refresh-cw" size={16} color={Colors.muted} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.content}>

            {/* Header com avatar + nome + estado */}
            <View style={s.headerCard}>
              <View style={s.headerGlow} />
              <View style={s.headerTop}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {vol.profiles?.nome?.slice(0,2).toUpperCase() || 'BH'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome}>{vol.profiles?.nome || '—'}</Text>
                  <Text style={s.serial}>{vol.numero_serial}</Text>
                </View>
                {vol.tipo_sanguineo && (
                  <View style={s.tipoBadge}>
                    <Text style={s.tipoBadgeText}>{vol.tipo_sanguineo}</Text>
                  </View>
                )}
              </View>

              <View style={[s.estadoRow, { backgroundColor: estadoBg(vol.estado) }]}>
                <View style={[s.estadoDot, { backgroundColor: estadoCor(vol.estado) }]} />
                <Text style={[s.estadoText, { color: estadoCor(vol.estado) }]}>
                  {estadoLabel(vol.estado)}
                </Text>
                <Text style={s.estadoDate}>
                  desde {new Date(vol.created_at).toLocaleDateString('pt-PT')}
                </Text>
              </View>
            </View>

            {/* Informações pessoais */}
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>Informações Pessoais</Text>
              <View style={s.infoGrid}>
                <InfoItem icon="mail"      label="Email"          value={vol.profiles?.email || '—'} />
                <InfoItem icon="phone"     label="Telefone"       value={vol.profiles?.telefone || '—'} />
                <InfoItem icon="credit-card" label="Nº BI"        value={vol.bi_numero || '—'} mono />
                <InfoItem icon="calendar"  label="Idade"          value={idade ? `${idade} anos` : '—'} />
                <InfoItem icon="user"      label="Sexo"           value={vol.sexo === 'M' ? 'Masculino' : vol.sexo === 'F' ? 'Feminino' : '—'} />
                <InfoItem icon="map-pin"   label="Morada"         value={vol.morada || '—'} />
              </View>
            </View>

            {/* Acções rápidas - mudar estado */}
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>Acções</Text>
              <View style={s.actionsGrid}>
                {vol.estado !== 'apto' && (
                  <ActionBtn icon="check-circle" label="Marcar Apto" color={Colors.green} onPress={() => handleMudarEstado('apto')} />
                )}
                {vol.estado !== 'em_exame' && (
                  <ActionBtn icon="activity" label="Em Exame" color={Colors.blue} onPress={() => handleMudarEstado('em_exame')} />
                )}
                {vol.estado !== 'inapto_temp' && (
                  <ActionBtn icon="alert-triangle" label="Inapto Temp." color={Colors.gold} onPress={() => handleMudarEstado('inapto_temp')} />
                )}
                {vol.estado !== 'inapto_perm' && (
                  <ActionBtn icon="x-circle" label="Inapto Perm." color={Colors.redSoft} onPress={() => handleMudarEstado('inapto_perm')} />
                )}
              </View>
              <TouchableOpacity style={s.lancarExameBtn} onPress={() => setShowExame(true)}>
                <Feather name="clipboard" size={15} color={Colors.white} />
                <Text style={s.lancarExameBtnText}>Lançar Novo Exame</Text>
              </TouchableOpacity>
            </View>

            {/* Histórico de exames */}
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>Histórico de Exames ({exames.length})</Text>
              {exames.length === 0 ? (
                <View style={s.emptyExames}>
                  <Feather name="file-text" size={28} color={Colors.muted2} style={{ marginBottom: 8 }} />
                  <Text style={s.emptyExamesText}>Nenhum exame registado ainda.</Text>
                </View>
              ) : (
                exames.map(ex => (
                  <View key={ex.id} style={s.exameItem}>
                    <View style={[
                      s.exameResultBadge,
                      { backgroundColor: ex.resultado === 'apto' ? 'rgba(46,204,113,0.12)' : 'rgba(232,180,75,0.12)' }
                    ]}>
                      <Text style={[
                        s.exameResultText,
                        { color: ex.resultado === 'apto' ? Colors.green : Colors.gold }
                      ]}>
                        {ex.resultado === 'apto' ? '✓' : '!'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.exameData}>
                        {ex.data_exame ? new Date(ex.data_exame).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                      </Text>
                      <View style={s.exameValores}>
                        {ex.hemoglobina && <Text style={s.exameValor}>Hb: {ex.hemoglobina} g/dL</Text>}
                        {ex.pressao_arterial && <Text style={s.exameValor}>PA: {ex.pressao_arterial}</Text>}
                        {ex.peso && <Text style={s.exameValor}>Peso: {ex.peso}kg</Text>}
                      </View>
                    </View>
                    <Text style={[
                      s.exameResultLabel,
                      { color: ex.resultado === 'apto' ? Colors.green : Colors.gold }
                    ]}>
                      {ex.resultado === 'apto' ? 'Apto' : 'Inapto'}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={{ height: 60 }} />
          </View>
        </ScrollView>
      </View>

      {/* Modal Lançar Exame */}
      {showExame && (
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>📋 Lançar Exame</Text>
              <TouchableOpacity onPress={() => setShowExame(false)}>
                <Feather name="x" size={20} color={Colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSubtitle}>{vol.profiles?.nome} · {vol.numero_serial}</Text>

            <ScrollView style={{ maxHeight: 380 }}>
              <Text style={s.modalLabel}>HEMOGLOBINA (g/dL)</Text>
              <TextInput style={s.modalInput} value={hemoglobina} onChangeText={setHemoglobina}
                placeholder="Ex: 14.2" placeholderTextColor={Colors.muted2} keyboardType="decimal-pad" />

              <Text style={s.modalLabel}>PRESSÃO ARTERIAL</Text>
              <TextInput style={s.modalInput} value={pressao} onChangeText={setPressao}
                placeholder="Ex: 120/80" placeholderTextColor={Colors.muted2} />

              <Text style={s.modalLabel}>PESO (kg)</Text>
              <TextInput style={s.modalInput} value={peso} onChangeText={setPeso}
                placeholder="Ex: 70" placeholderTextColor={Colors.muted2} keyboardType="decimal-pad" />

              <Text style={s.modalLabel}>RESULTADO *</Text>
              <View style={{ gap: 8 }}>
                {[
                  { val: 'apto',        label: '✅ Apto',               color: Colors.green   },
                  { val: 'inapto_temp', label: '⚠️ Inapto Temporário',  color: Colors.gold    },
                  { val: 'inapto_perm', label: '❌ Inapto Permanente',  color: Colors.redSoft },
                ].map(r => (
                  <TouchableOpacity
                    key={r.val}
                    style={[
                      s.resultadoOpt,
                      resultado === r.val && { borderColor: r.color, backgroundColor: r.color + '15' }
                    ]}
                    onPress={() => setResultado(r.val as any)}
                  >
                    <Text style={[s.resultadoOptText, resultado === r.val && { color: r.color }]}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[s.modalBtn, salvando && { opacity: 0.7 }]}
              onPress={handleSalvarExame}
              disabled={salvando}
            >
              {salvando
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={s.modalBtnText}>Guardar Exame</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

function InfoItem({ icon, label, value, mono }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.infoItem}>
      <Feather name={icon} size={13} color={Colors.muted} style={{ marginBottom: 4 }} />
      <Text style={s.infoItemLabel}>{label}</Text>
      <Text style={[s.infoItemValue, mono && { fontFamily: 'monospace', fontSize: 12 }]}>{value}</Text>
    </View>
  )
}

function ActionBtn({ icon, label, color, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.actionBtn, { borderColor: color + '40' }]} onPress={onPress}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[s.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark, padding: 24 },
  main:   { flex: 1, flexDirection: 'column' },
  content:{ padding: 20, maxWidth: 700, width: '100%', alignSelf: 'center' },

  backBtnEmpty: { marginTop: 16, padding: 10 },

  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  backBtn:     { padding: 8 },
  topbarTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },

  // Header
  headerCard: {
    backgroundColor: Colors.dark2, borderRadius: 18, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden', position: 'relative',
  },
  headerGlow: {
    position: 'absolute', top: -60, right: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.redGlow,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: Colors.white },
  nome:   { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  serial: { fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace' },
  tipoBadge: { backgroundColor: Colors.redGlow, borderRadius: 12, padding: 12, alignItems: 'center', justifyContent: 'center' },
  tipoBadgeText: { fontSize: 22, fontWeight: '800', color: Colors.redSoft },

  estadoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12 },
  estadoDot: { width: 8, height: 8, borderRadius: 4 },
  estadoText:{ fontSize: 13, fontWeight: '700', flex: 1 },
  estadoDate:{ fontSize: 11, color: Colors.muted },

  infoCard: {
    backgroundColor: Colors.dark2, borderRadius: 16, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  infoCardTitle: { fontSize: 13, fontWeight: '700', color: Colors.muted, marginBottom: 16, letterSpacing: 0.5 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  infoItem: { flex: 1, minWidth: '45%' },
  infoItemLabel: { fontSize: 10, color: Colors.muted2, marginBottom: 3, fontWeight: '600', letterSpacing: 0.5 },
  infoItemValue: { fontSize: 14, fontWeight: '600', color: Colors.white },

  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: Colors.dark3,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  lancarExameBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.red, borderRadius: 10, padding: 13,
  },
  lancarExameBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },

  // Exames
  emptyExames: { alignItems: 'center', padding: 24 },
  emptyExamesText: { fontSize: 13, color: Colors.muted },
  exameItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  exameResultBadge: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  exameResultText:  { fontSize: 16, fontWeight: '800' },
  exameData: { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 4 },
  exameValores: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  exameValor: { fontSize: 11, color: Colors.muted },
  exameResultLabel: { fontSize: 12, fontWeight: '700' },

  // Modal
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: Colors.dark2, width: '100%', maxWidth: 480,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
  modalSubtitle: { fontSize: 13, color: Colors.muted, marginBottom: 20 },
  modalLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 13, fontSize: 14, color: Colors.white,
  },
  resultadoOpt: {
    padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: Colors.dark3,
  },
  resultadoOptText: { fontSize: 14, fontWeight: '600', color: Colors.muted, textAlign: 'center' },
  modalBtn: { backgroundColor: Colors.red, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 16 },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
})