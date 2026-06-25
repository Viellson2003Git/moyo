// app/(enfermeiro)/recepcao.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import QRScanner from '../../components/QRScanner'

type DoadorInfo = {
  id: string
  numero_serial: string
  tipo_sanguineo: string | null
  estado: string
  nome: string
  numero_ordem?: number
}

export default function Recepcao() {
  const [bancoId, setBancoId]           = useState<string | null>(null)
  const [doador, setDoador]             = useState<DoadorInfo | null>(null)
  const [loading, setLoading]           = useState(false)
  const [checkInFeito, setCheckInFeito] = useState(false)
  const [totalFila, setTotalFila]       = useState(0)
  const [modoManual, setModoManual]     = useState(false)
  const [serialManual, setSerialManual] = useState('')

  useEffect(() => { loadBanco() }, [])

  async function loadBanco() {
    const { data } = await supabase
      .from('bancos_sangue').select('id').eq('ativo', true).single()
    if (data) {
      setBancoId(data.id)
      loadFila(data.id)
    }
  }

  async function loadFila(bid: string) {
    const hoje = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .eq('banco_id', bid)
      .eq('data', hoje)
      .in('estado', ['aguardando', 'em_atendimento'])
    setTotalFila(count || 0)
  }

  // ── Função principal de processamento — chamada pelo QRScanner e pelo modo manual
  async function processar(codigo: string) {
    if (loading || !codigo.trim()) return
    setLoading(true)
    setDoador(null)
    setCheckInFeito(false)
    setModoManual(false)

    const { data: vol } = await supabase
      .from('voluntarios')
      .select('id, numero_serial, tipo_sanguineo, estado, profiles(nome)')
      .eq('numero_serial', codigo.trim().toUpperCase())
      .single()

    if (!vol) {
      mostrarAlerta('❌ Não encontrado', `Serial "${codigo}" não existe no sistema.`)
      setLoading(false)
      return
    }

    setDoador({
      id: vol.id,
      numero_serial: vol.numero_serial,
      tipo_sanguineo: vol.tipo_sanguineo,
      estado: vol.estado,
      nome: (vol.profiles as any)?.nome || '—',
    })
    setLoading(false)
  }

  async function confirmarCheckIn() {
    if (!doador || !bancoId) return
    setLoading(true)

    const { data: checkIn, error } = await supabase
      .from('check_ins')
      .insert({ voluntario_id: doador.id, banco_id: bancoId })
      .select('numero_ordem')
      .single()

    if (!error && checkIn) {
      setDoador(prev => prev ? { ...prev, numero_ordem: checkIn.numero_ordem } : null)
      setCheckInFeito(true)
      loadFila(bancoId)
    } else {
      mostrarAlerta('Erro', error?.message || 'Erro ao fazer check-in')
    }
    setLoading(false)
  }

  function resetar() {
    setDoador(null)
    setCheckInFeito(false)
    setLoading(false)
    setModoManual(false)
    setSerialManual('')
  }

  return (
    <View style={s.root}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={Colors.muted} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerLogo}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
          <Text style={s.headerSub}>Recepção · Hospital Ngola Kimbanda</Text>
        </View>
        <View style={s.filaCounter}>
          <Text style={s.filaCounterNum}>{totalFila}</Text>
          <Text style={s.filaCounterLabel}>na fila</Text>
        </View>
      </View>

      {/* ── ECRÃ 1: Scanner ── */}
      {!doador && !loading && (
        <View style={s.scannerWrap}>
          {!modoManual ? (
            // Modo câmara — usa o QRScanner robusto
            <>
              <QRScanner
                titulo="Scanner de Check-in"
                onScanned={(codigo) => processar(codigo)}
              />
              {/* Toggle para modo manual */}
              <TouchableOpacity
                style={s.toggleModo}
                onPress={() => setModoManual(true)}
              >
                <Feather name="edit-2" size={14} color={Colors.muted} />
                <Text style={s.toggleModoText}>Inserir manualmente</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Modo manual
            <View style={s.manualWrap}>
              <View style={s.manualCard}>
                <Feather name="hash" size={32} color={Colors.muted2} style={{ marginBottom: 16 }} />
                <Text style={s.manualTitle}>Inserir Número de Série</Text>
                <Text style={s.manualSub}>
                  Escreve o número de série do cartão do doador
                </Text>
                <TextInput
                  style={s.manualInput}
                  value={serialManual}
                  onChangeText={v => setSerialManual(v.toUpperCase())}
                  placeholder="MO-2026-XXXXXX"
                  placeholderTextColor={Colors.muted2}
                  autoCapitalize="characters"
                  autoFocus
                  onSubmitEditing={() => {
                    if (serialManual.trim()) processar(serialManual.trim())
                  }}
                />
                <TouchableOpacity
                  style={[s.manualBtn, !serialManual.trim() && { opacity: 0.5 }]}
                  onPress={() => { if (serialManual.trim()) processar(serialManual.trim()) }}
                  disabled={!serialManual.trim()}
                >
                  <Feather name="search" size={16} color={Colors.white} />
                  <Text style={s.manualBtnText}>Confirmar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.toggleModo}
                  onPress={() => { setModoManual(false); setSerialManual('') }}
                >
                  <Feather name="camera" size={14} color={Colors.muted} />
                  <Text style={s.toggleModoText}>Usar câmara</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── ECRÃ 1b: Loading após scan ── */}
      {loading && !checkInFeito && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.red} />
          <Text style={s.loadingText}>A verificar doador...</Text>
        </View>
      )}

      {/* ── ECRÃ 2: Confirmação do doador ── */}
      {doador && !checkInFeito && (
        <View style={s.center}>
          <View style={s.doadorCard}>

            <View style={s.doadorCardHeader}>
              <View style={s.doadorAvatar}>
                <Text style={s.doadorAvatarText}>
                  {doador.nome.slice(0,2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.doadorCardNome}>{doador.nome}</Text>
                <Text style={s.doadorCardSerial}>{doador.numero_serial}</Text>
              </View>
              {doador.tipo_sanguineo && (
                <View style={s.tipoSangBadge}>
                  <Text style={s.tipoSangText}>{doador.tipo_sanguineo}</Text>
                </View>
              )}
            </View>

            <View style={[
              s.estadoRow,
              doador.estado === 'apto'
                ? { backgroundColor: 'rgba(46,204,113,0.1)', borderColor: 'rgba(46,204,113,0.3)' }
                : { backgroundColor: 'rgba(232,180,75,0.1)', borderColor: 'rgba(232,180,75,0.3)' }
            ]}>
              <Text style={[
                s.estadoText,
                { color: doador.estado === 'apto' ? Colors.green : Colors.gold }
              ]}>
                {doador.estado === 'apto'     ? '✅ Doador Verificado'         :
                 doador.estado === 'pendente' ? '⏳ Candidato — Aguarda Exames' :
                 doador.estado === 'em_exame' ? '🔬 Exames em Curso'            : doador.estado}
              </Text>
            </View>

            <View style={s.doadorBtns}>
              <TouchableOpacity
                style={s.btnConfirmar}
                onPress={confirmarCheckIn}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <>
                      <Feather name="log-in" size={18} color={Colors.white} />
                      <Text style={s.btnConfirmarText}>Confirmar Check-in</Text>
                    </>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.btnCancelar} onPress={resetar}>
                <Text style={s.btnCancelarText}>Não sou eu — voltar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── ECRÃ 3: Check-in confirmado ── */}
      {checkInFeito && doador && (
        <View style={s.center}>
          <View style={s.successCircle}>
            <Feather name="check" size={52} color={Colors.white} />
          </View>
          <Text style={s.successTitle}>Check-in Confirmado!</Text>
          <Text style={s.successNome}>{doador.nome}</Text>

          <View style={s.ordemCard}>
            <Text style={s.ordemLabel}>NÚMERO DE ESPERA</Text>
            <Text style={s.ordemNum}>{doador.numero_ordem ?? '—'}</Text>
            <Text style={s.ordemSub}>Aguarda ser chamado pelo enfermeiro</Text>
          </View>

          <View style={s.doadorInfoRow}>
            <View style={s.doadorInfoItem}>
              <Text style={s.doadorInfoLabel}>Tipo Sanguíneo</Text>
              <Text style={s.doadorInfoVal}>{doador.tipo_sanguineo || '—'}</Text>
            </View>
            <View style={s.doadorInfoItem}>
              <Text style={s.doadorInfoLabel}>Serial</Text>
              <Text style={[s.doadorInfoVal, { fontSize: 13, color: Colors.redSoft }]}>
                {doador.numero_serial}
              </Text>
            </View>
            <View style={s.doadorInfoItem}>
              <Text style={s.doadorInfoLabel}>Na fila</Text>
              <Text style={s.doadorInfoVal}>{totalFila}</Text>
            </View>
          </View>

          <TouchableOpacity style={s.proximoBtn} onPress={resetar}>
            <Feather name="camera" size={16} color={Colors.white} />
            <Text style={s.proximoBtnText}>Próximo Doador</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.dark },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.dark2, paddingHorizontal: 24,
    paddingVertical: 16, borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)', gap: 16,
  },
  backBtn:          { padding: 4 },
  headerCenter:     { flex: 1, alignItems: 'center' },
  headerLogo:       { fontSize: 22, fontWeight: '800', color: Colors.white },
  headerSub:        { fontSize: 11, color: Colors.muted, marginTop: 2 },
  filaCounter:      { alignItems: 'center', backgroundColor: Colors.dark3, borderRadius: 10, padding: 10, minWidth: 56 },
  filaCounterNum:   { fontSize: 22, fontWeight: '800', color: Colors.redSoft },
  filaCounterLabel: { fontSize: 10, color: Colors.muted },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingText: { fontSize: 14, color: Colors.muted, marginTop: 16 },

  scannerWrap: { flex: 1, position: 'relative' },

  toggleModo: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  toggleModoText: { fontSize: 13, color: Colors.muted, fontWeight: '600' },

  manualWrap: { flex: 1, backgroundColor: Colors.dark, justifyContent: 'center', padding: 24 },
  manualCard: {
    backgroundColor: Colors.dark2, borderRadius: 20, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  manualTitle: { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 8, textAlign: 'center' },
  manualSub:   { fontSize: 13, color: Colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  manualInput: {
    width: '100%', backgroundColor: Colors.dark3, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    padding: 14, fontSize: 18, color: Colors.white,
    textAlign: 'center', letterSpacing: 3, fontWeight: '700',
    marginBottom: 14,
  },
  manualBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.red, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 28,
    marginBottom: 16, width: '100%', justifyContent: 'center',
  },
  manualBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  // Sucesso
  successCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.green,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: Colors.white, marginBottom: 6 },
  successNome:  { fontSize: 16, color: Colors.muted, marginBottom: 24 },

  ordemCard: {
    backgroundColor: Colors.dark2, borderRadius: 20,
    padding: 28, alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: Colors.red, width: '100%', maxWidth: 320,
  },
  ordemLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, letterSpacing: 1, marginBottom: 8 },
  ordemNum:   { fontSize: 80, fontWeight: '900', color: Colors.redSoft, lineHeight: 88 },
  ordemSub:   { fontSize: 13, color: Colors.muted, marginTop: 8, textAlign: 'center' },

  doadorInfoRow: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  doadorInfoItem:{ alignItems: 'center' },
  doadorInfoLabel:{ fontSize: 10, color: Colors.muted2, marginBottom: 4 },
  doadorInfoVal:  { fontSize: 18, fontWeight: '800', color: Colors.white },

  proximoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.red, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 32,
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  proximoBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },

  doadorCard: {
    backgroundColor: Colors.dark2, borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  doadorCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  doadorAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
  },
  doadorAvatarText: { fontSize: 20, fontWeight: '800', color: Colors.white },
  doadorCardNome:   { fontSize: 18, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  doadorCardSerial: { fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace' },
  tipoSangBadge: { backgroundColor: Colors.redGlow, borderRadius: 10, padding: 12 },
  tipoSangText:  { fontSize: 22, fontWeight: '800', color: Colors.redSoft },

  estadoRow: { borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 },
  estadoText: { fontSize: 15, fontWeight: '700' },

  doadorBtns: { gap: 10 },
  btnConfirmar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 16,
    shadowColor: Colors.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnConfirmarText: { fontSize: 16, fontWeight: '800', color: Colors.dark },
  btnCancelar:      { padding: 14, alignItems: 'center' },
  btnCancelarText:  { fontSize: 14, color: Colors.muted },
})