// app/(enfermeiro)/index.tsx
import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform,
  useWindowDimensions, TextInput
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta, confirmar } from '../../utils/alert'
import QRScanner from '../../components/QRScanner'

type Aba = 'rastreio' | 'doacao' | 'consultar' | 'agenda'

export default function EnfermeiroDashboard() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [aba, setAba]         = useState<Aba>('rastreio')
  const [bancoId, setBancoId] = useState<string | null>(null)
  const [bancoNome, setBancoNome] = useState('')
  const [loading, setLoading] = useState(true)
  const [enfermeiroNome, setEnfermeiroNome] = useState('')

  // Fila de rastreio
  const [filaRastreio, setFilaRastreio] = useState<any[]>([])
  const [chamadoRastreio, setChamadoRastreio] = useState<any>(null)
  const [chamandoRastreio, setChamandoRastreio] = useState(false)

  // Fila de doação
  const [filaDoacao, setFilaDoacao] = useState<any[]>([])
  const [chamadoDoacao, setChamadoDoacao] = useState<any>(null)
  const [chamandoDoacao, setChamandoDoacao] = useState(false)

  // Scanner
  const [showScanner, setShowScanner] = useState(false)
  const [scanResultado, setScanResultado] = useState<any>(null)

  // Consultar
  const [searchSerial, setSearchSerial] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Agenda
  const [agendamentos, setAgendamentos] = useState<any[]>([])

  // Stats
  const [stats, setStats] = useState({ rastreio: 0, doacao: 0, concluidos: 0, agendados: 0 })

  useEffect(() => {
    initDashboard()
  }, [])

  async function initDashboard() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('nome').eq('id', user.id).single()
    setEnfermeiroNome(prof?.nome?.split(' ')[0] || 'Enfermeiro')

    const { data: banco } = await supabase
      .from('bancos_sangue').select('id, nome').eq('ativo', true).single()
    if (banco) {
      setBancoId(banco.id)
      setBancoNome(banco.nome)
      await Promise.all([
        loadFilaRastreio(banco.id),
        loadFilaDoacao(banco.id),
        loadAgendamentos(banco.id),
        loadStats(banco.id),
      ])
    }
    setLoading(false)

    // Realtime — fila actualiza automaticamente
    const canal = supabase
      .channel(`enfermeiro-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_exames' }, () => {
        if (banco) { loadFilaRastreio(banco.id); loadFilaDoacao(banco.id); loadStats(banco.id) }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, () => {
        if (banco) loadAgendamentos(banco.id)
      })
      .subscribe()

    return () => { supabase.removeChannel(canal) }
  }

  async function loadFilaRastreio(bid: string) {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('fila_exames')
      .select(`
        id, senha, posicao, estado, tipo, hora_entrada, hora_chamada, created_at,
        voluntarios(id, numero_serial, tipo_sanguineo, estado,
          profiles(nome, telefone))
      `)
      .eq('banco_id', bid)
      .eq('tipo', 'rastreio')
      .eq('data', hoje)
      .not('estado', 'in', '("cancelado","concluido")')
      .order('posicao', { ascending: true })
    setFilaRastreio(data || [])

    const chamado = (data || []).find(f => f.estado === 'chamado' || f.estado === 'em_atendimento')
    if (chamado) setChamadoRastreio(chamado)
  }

  async function loadFilaDoacao(bid: string) {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('fila_exames')
      .select(`
        id, senha, posicao, estado, tipo, hora_entrada, hora_chamada, created_at,
        voluntarios(id, numero_serial, tipo_sanguineo, estado,
          profiles(nome, telefone))
      `)
      .eq('banco_id', bid)
      .eq('tipo', 'doacao')
      .eq('data', hoje)
      .not('estado', 'in', '("cancelado","concluido")')
      .order('posicao', { ascending: true })
    setFilaDoacao(data || [])

    const chamado = (data || []).find(f => f.estado === 'chamado' || f.estado === 'em_atendimento')
    if (chamado) setChamadoDoacao(chamado)
  }

  async function loadAgendamentos(bid: string) {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('agendamentos')
      .select('id, data, hora, estado, voluntarios(numero_serial, tipo_sanguineo, profiles(nome))')
      .eq('banco_id', bid)
      .eq('data', hoje)
      .order('hora', { ascending: true })
    setAgendamentos(data || [])
  }

  async function loadStats(bid: string) {
    const hoje = new Date().toISOString().split('T')[0]
    const [r, d, c, a] = await Promise.all([
      supabase.from('fila_exames').select('*', { count: 'exact', head: true }).eq('banco_id', bid).eq('tipo', 'rastreio').eq('data', hoje).eq('estado', 'aguardando'),
      supabase.from('fila_exames').select('*', { count: 'exact', head: true }).eq('banco_id', bid).eq('tipo', 'doacao').eq('data', hoje).eq('estado', 'aguardando'),
      supabase.from('fila_exames').select('*', { count: 'exact', head: true }).eq('banco_id', bid).eq('data', hoje).eq('estado', 'concluido'),
      supabase.from('agendamentos').select('*', { count: 'exact', head: true }).eq('banco_id', bid).eq('data', hoje),
    ])
    setStats({ rastreio: r.count || 0, doacao: d.count || 0, concluidos: c.count || 0, agendados: a.count || 0 })
  }

  async function chamarProximo(tipo: 'rastreio' | 'doacao') {
    if (!bancoId) return
    if (tipo === 'rastreio') setChamandoRastreio(true)
    else setChamandoDoacao(true)

    const { data, error } = await supabase.rpc('chamar_proximo_fila', {
      p_banco_id: bancoId,
      p_tipo: tipo,
    })

    if (error || !data || data.length === 0) {
      mostrarAlerta('Fila vazia', 'Não há mais nenhuma senha para chamar.')
    } else {
      if (tipo === 'rastreio') setChamadoRastreio(data[0])
      else setChamadoDoacao(data[0])
      await loadFilaRastreio(bancoId)
      await loadFilaDoacao(bancoId)
    }

    if (tipo === 'rastreio') setChamandoRastreio(false)
    else setChamandoDoacao(false)
  }

  async function iniciarAtendimento(filaId: string, tipo: 'rastreio' | 'doacao') {
    await supabase.from('fila_exames')
      .update({ estado: 'em_atendimento' })
      .eq('id', filaId)

    if (tipo === 'rastreio' && chamadoRastreio) {
      const vol = chamadoRastreio.voluntarios
      router.push({
        pathname: '/(enfermeiro)/exames',
        params: {
          voluntarioId: vol?.id,
          filaId: filaId,
          nome: vol?.profiles?.nome,
        }
      } as any)
    }
    if (bancoId) { loadFilaRastreio(bancoId); loadFilaDoacao(bancoId) }
  }

  async function concluirAtendimento(filaId: string, tipo: 'rastreio' | 'doacao') {
    await supabase.from('fila_exames')
      .update({ estado: 'concluido', hora_conclusao: new Date().toISOString() })
      .eq('id', filaId)

    if (tipo === 'rastreio') setChamadoRastreio(null)
    else setChamadoDoacao(null)

    if (bancoId) { loadFilaRastreio(bancoId); loadFilaDoacao(bancoId); loadStats(bancoId) }
  }

  async function marcarAusente(filaId: string, tipo: 'rastreio' | 'doacao') {
    await supabase.from('fila_exames').update({ estado: 'ausente' }).eq('id', filaId)
    if (tipo === 'rastreio') setChamadoRastreio(null)
    else setChamadoDoacao(null)
    if (bancoId) { loadFilaRastreio(bancoId); loadFilaDoacao(bancoId) }
  }

  async function pesquisarVoluntario() {
    if (!searchSerial.trim()) return
    setSearchLoading(true)
    const { data } = await supabase.rpc('pesquisar_voluntario_serial', { p_termo: searchSerial.trim() })
    setSearchResult(data?.[0] ? {
      ...data[0],
      profiles: { nome: data[0].nome, telefone: data[0].telefone }
    } : null)
    if (!data?.length) mostrarAlerta('Não encontrado', 'Nenhum voluntário com esse serial.')
    setSearchLoading(false)
  }

  async function handleQRScanned(codigo: string) {
    setShowScanner(false)
    setSearchSerial(codigo)
    setAba('consultar')

    const { data } = await supabase.rpc('pesquisar_voluntario_serial', { p_termo: codigo })
    if (data?.[0]) {
      setSearchResult({ ...data[0], profiles: { nome: data[0].nome, telefone: data[0].telefone } })
    } else {
      mostrarAlerta('Não encontrado', `Serial "${codigo}" não existe no sistema.`)
    }
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  const ABAS = [
    { id: 'rastreio', label: 'Rastreio', icon: '🧪' as const, count: stats.rastreio },
    { id: 'doacao',   label: 'Doação',   icon: '🩸' as const, count: stats.doacao   },
    { id: 'consultar',label: 'Consultar',icon: '🔍' as const, count: 0               },
    { id: 'agenda',   label: 'Agenda',   icon: '📅' as const, count: stats.agendados },
  ]

  return (
    <View style={s.root}>

      {/* ── HEADER ── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerNome}>Bom dia, {enfermeiroNome} 👋</Text>
          <Text style={s.headerBanco}>{bancoNome}</Text>
        </View>
        <TouchableOpacity style={s.scannerBtn} onPress={() => setShowScanner(true)}>
          <Feather name="camera" size={20} color={Colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={s.logoutBtn} onPress={async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login' as any)
        }}>
          <Feather name="log-out" size={18} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      {/* ── STATS ── */}
      <View style={s.statsRow}>
        <StatCard emoji="🧪" label="Rastreio" value={stats.rastreio} cor={Colors.blue} />
        <StatCard emoji="🩸" label="Doação" value={stats.doacao} cor={Colors.red} />
        <StatCard emoji="✅" label="Concluídos" value={stats.concluidos} cor={Colors.green} />
        <StatCard emoji="📅" label="Agenda" value={stats.agendados} cor={Colors.gold} />
      </View>

      {/* ── ABAS ── */}
      <View style={s.abas}>
        {ABAS.map(a => (
          <TouchableOpacity
            key={a.id}
            style={[s.aba, aba === a.id && s.abaActive]}
            onPress={() => setAba(a.id as Aba)}
          >
            <Text style={{ fontSize: 16 }}>{a.icon}</Text>
            <Text style={[s.abaLabel, aba === a.id && s.abaLabelActive]}>{a.label}</Text>
            {a.count > 0 && (
              <View style={s.abaBadge}><Text style={s.abaBadgeText}>{a.count}</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

        {/* ════ ABA RASTREIO ════ */}
        {aba === 'rastreio' && (
          <>
            {/* Card do chamado actual */}
            <ChamadoCard
              chamado={chamadoRastreio}
              tipo="rastreio"
              onIniciar={(id) => iniciarAtendimento(id, 'rastreio')}
              onConcluir={(id) => concluirAtendimento(id, 'rastreio')}
              onAusente={(id) => marcarAusente(id, 'rastreio')}
            />

            {/* Botão chamar próximo */}
            <TouchableOpacity
              style={[s.btnChamar, chamandoRastreio && { opacity: 0.7 }]}
              onPress={() => chamarProximo('rastreio')}
              disabled={chamandoRastreio || filaRastreio.filter(f => f.estado === 'aguardando').length === 0}
            >
              {chamandoRastreio
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <>
                    <Feather name="bell" size={18} color={Colors.white} />
                    <Text style={s.btnChamarText}>
                      Chamar Próximo · {filaRastreio.filter(f => f.estado === 'aguardando').length} na fila
                    </Text>
                  </>
              }
            </TouchableOpacity>

            {/* Lista da fila */}
            <Text style={s.listaTitulo}>Fila de Rastreio — Hoje</Text>
            {filaRastreio.length === 0 ? (
              <EmptyFila mensagem="Sem senhas de rastreio para hoje." />
            ) : (
              filaRastreio.map(f => (
                <FilaItem key={f.id} item={f} tipo="rastreio" />
              ))
            )}
          </>
        )}

        {/* ════ ABA DOAÇÃO ════ */}
        {aba === 'doacao' && (
          <>
            <ChamadoCard
              chamado={chamadoDoacao}
              tipo="doacao"
              onIniciar={(id) => iniciarAtendimento(id, 'doacao')}
              onConcluir={(id) => concluirAtendimento(id, 'doacao')}
              onAusente={(id) => marcarAusente(id, 'doacao')}
            />

            <TouchableOpacity
              style={[s.btnChamar, { backgroundColor: Colors.red }, chamandoDoacao && { opacity: 0.7 }]}
              onPress={() => chamarProximo('doacao')}
              disabled={chamandoDoacao || filaDoacao.filter(f => f.estado === 'aguardando').length === 0}
            >
              {chamandoDoacao
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <>
                    <Feather name="bell" size={18} color={Colors.white} />
                    <Text style={s.btnChamarText}>
                      Chamar Próximo · {filaDoacao.filter(f => f.estado === 'aguardando').length} na fila
                    </Text>
                  </>
              }
            </TouchableOpacity>

            <Text style={s.listaTitulo}>Fila de Doação — Hoje</Text>
            {filaDoacao.length === 0 ? (
              <EmptyFila mensagem="Sem senhas de doação para hoje." />
            ) : (
              filaDoacao.map(f => (
                <FilaItem key={f.id} item={f} tipo="doacao" />
              ))
            )}
          </>
        )}

        {/* ════ ABA CONSULTAR ════ */}
        {aba === 'consultar' && (
          <>
            <View style={s.searchCard}>
              <Text style={s.sectionTitulo}>🔍 Consultar Voluntário</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[s.searchInput, { flex: 1 }]}
                  value={searchSerial}
                  onChangeText={v => setSearchSerial(v.toUpperCase())}
                  placeholder="MO-2026-XXXXXX"
                  placeholderTextColor={Colors.muted2}
                  autoCapitalize="characters"
                  onSubmitEditing={pesquisarVoluntario}
                  returnKeyType="search"
                />
                <TouchableOpacity style={s.searchBtn} onPress={pesquisarVoluntario} disabled={searchLoading}>
                  {searchLoading ? <ActivityIndicator size="small" color={Colors.white} /> : <Feather name="search" size={18} color={Colors.white} />}
                </TouchableOpacity>
                <TouchableOpacity style={[s.searchBtn, { backgroundColor: Colors.dark3 }]} onPress={() => setShowScanner(true)}>
                  <Feather name="camera" size={18} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            {searchResult && (
              <View style={s.resultadoCard}>
                <View style={s.resultadoHeader}>
                  <View style={s.resultadoAvatar}>
                    <Text style={s.resultadoAvatarText}>
                      {searchResult.nome?.slice(0,2).toUpperCase() || 'MO'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultadoNome}>{searchResult.nome}</Text>
                    <Text style={s.resultadoSerial}>{searchResult.numero_serial}</Text>
                    <Text style={s.resultadoTel}>{searchResult.telefone || '—'}</Text>
                  </View>
                  {searchResult.tipo_sanguineo && (
                    <View style={s.tipoSangBadge}>
                      <Text style={s.tipoSangText}>{searchResult.tipo_sanguineo}</Text>
                    </View>
                  )}
                </View>

                <View style={[s.estadoRow, {
                  backgroundColor: searchResult.estado === 'apto' ? 'rgba(46,204,113,0.08)' : 'rgba(232,180,75,0.08)',
                  borderColor: searchResult.estado === 'apto' ? 'rgba(46,204,113,0.2)' : 'rgba(232,180,75,0.2)',
                }]}>
                  <Text style={[s.estadoText, { color: searchResult.estado === 'apto' ? Colors.green : Colors.gold }]}>
                    {searchResult.estado === 'apto' ? '✅ Apto para doação' :
                     searchResult.estado === 'pendente' ? '⏳ Pendente de exames' :
                     searchResult.estado === 'em_exame' ? '🔬 Em exame' : searchResult.estado}
                  </Text>
                </View>

                <View style={s.resultadoBtns}>
                  <TouchableOpacity
                    style={s.btnExames}
                    onPress={() => router.push({
                      pathname: '/(enfermeiro)/exames',
                      params: { voluntarioId: searchResult.id, nome: searchResult.nome }
                    } as any)}
                  >
                    <Feather name="clipboard" size={14} color={Colors.blue} />
                    <Text style={s.btnExamesText}>Registar Exames</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* ════ ABA AGENDA ════ */}
        {aba === 'agenda' && (
          <>
            <Text style={s.sectionTitulo}>📅 Agendamentos para Hoje</Text>
            {agendamentos.length === 0 ? (
              <EmptyFila mensagem="Sem agendamentos para hoje." />
            ) : (
              agendamentos.map(a => (
                <View key={a.id} style={s.agendaItem}>
                  <View style={s.agendaHora}>
                    <Text style={s.agendaHoraText}>{a.hora?.slice(0,5)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.agendaNome}>{(a.voluntarios as any)?.profiles?.nome}</Text>
                    <Text style={s.agendaSerial}>{(a.voluntarios as any)?.numero_serial}</Text>
                  </View>
                  {(a.voluntarios as any)?.tipo_sanguineo && (
                    <View style={s.tipoSangBadge}>
                      <Text style={s.tipoSangText}>{(a.voluntarios as any).tipo_sanguineo}</Text>
                    </View>
                  )}
                  <View style={[s.agendaEstado, {
                    backgroundColor: a.estado === 'confirmado' ? 'rgba(46,204,113,0.1)' : Colors.dark3
                  }]}>
                    <Text style={[s.agendaEstadoText, {
                      color: a.estado === 'confirmado' ? Colors.green : Colors.muted
                    }]}>
                      {a.estado === 'confirmado' ? 'Confirmado' : a.estado}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}

      </ScrollView>

      {/* Scanner modal */}
      {showScanner && (
        <View style={s.fillObject}>
          <QRScanner
            titulo="Scan do Cartão"
            onScanned={handleQRScanned}
            onFechar={() => setShowScanner(false)}
          />
        </View>
      )}
    </View>
  )
}

// ── Sub-componentes ──

function StatCard({ emoji, label, value, cor }: { emoji: string; label: string; value: number; cor: string }) {
  return (
    <View style={[sc.card, { borderColor: cor + '30' }]}>
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</Text>
      <Text style={[sc.value, { color: cor }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </View>
  )
}
const sc = StyleSheet.create({
  card:  { flex: 1, backgroundColor: Colors.dark2, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  value: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  label: { fontSize: 10, color: Colors.muted, textAlign: 'center' },
})

function ChamadoCard({ chamado, tipo, onIniciar, onConcluir, onAusente }: {
  chamado: any; tipo: string
  onIniciar: (id: string) => void
  onConcluir: (id: string) => void
  onAusente:  (id: string) => void
}) {
  if (!chamado) return null
  const vol = chamado.voluntarios
  const cor = tipo === 'rastreio' ? Colors.blue : Colors.red
  return (
    <View style={[cc.card, { borderColor: cor + '40' }]}>
      <View style={cc.header}>
        <View style={[cc.senhaBox, { backgroundColor: cor + '15' }]}>
          <Text style={cc.senhaLabel}>SENHA</Text>
          <Text style={[cc.senha, { color: cor }]}>{chamado.senha}</Text>
        </View>
        <View style={{ flex: 1, paddingLeft: 14 }}>
          <Text style={cc.nome}>{vol?.profiles?.nome}</Text>
          <Text style={cc.serial}>{vol?.numero_serial}</Text>
          {vol?.tipo_sanguineo && (
            <Text style={[cc.tipo, { color: cor }]}>Tipo {vol.tipo_sanguineo}</Text>
          )}
        </View>
        <View style={[cc.estadoBadge, {
          backgroundColor: chamado.estado === 'chamado' ? 'rgba(232,180,75,0.15)' : 'rgba(74,158,255,0.15)'
        }]}>
          <Text style={[cc.estadoText, {
            color: chamado.estado === 'chamado' ? Colors.gold : Colors.blue
          }]}>
            {chamado.estado === 'chamado' ? '📣 Chamado' : '🔵 Atendimento'}
          </Text>
        </View>
      </View>
      <View style={cc.btns}>
        {chamado.estado === 'chamado' && (
          <>
            <TouchableOpacity style={[cc.btn, { backgroundColor: cor }]} onPress={() => onIniciar(chamado.id)}>
              <Feather name="play" size={14} color={Colors.white} />
              <Text style={cc.btnText}>Iniciar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cc.btnGhost} onPress={() => onAusente(chamado.id)}>
              <Text style={[cc.btnText, { color: Colors.muted }]}>Ausente</Text>
            </TouchableOpacity>
          </>
        )}
        {chamado.estado === 'em_atendimento' && (
          <TouchableOpacity style={[cc.btn, { backgroundColor: Colors.green, flex: 1 }]} onPress={() => onConcluir(chamado.id)}>
            <Feather name="check" size={14} color={Colors.white} />
            <Text style={cc.btnText}>Concluir Atendimento</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}
const cc = StyleSheet.create({
  card:       { backgroundColor: Colors.dark2, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1.5 },
  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  senhaBox:   { borderRadius: 10, padding: 12, alignItems: 'center', minWidth: 72 },
  senhaLabel: { fontSize: 9, color: Colors.muted, letterSpacing: 0.8, marginBottom: 2 },
  senha:      { fontSize: 24, fontWeight: '900', fontFamily: 'monospace' },
  nome:       { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  serial:     { fontSize: 11, color: Colors.redSoft, fontFamily: 'monospace', marginBottom: 3 },
  tipo:       { fontSize: 13, fontWeight: '700' },
  estadoBadge:{ borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  estadoText: { fontSize: 12, fontWeight: '700' },
  btns:       { flexDirection: 'row', gap: 10 },
  btn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, padding: 12 },
  btnGhost:   { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, padding: 12, backgroundColor: Colors.dark3 },
  btnText:    { fontSize: 14, fontWeight: '700', color: Colors.white },
})

function FilaItem({ item, tipo }: { item: any; tipo: string }) {
  const cor = {
    aguardando:     Colors.muted,
    chamado:        Colors.gold,
    em_atendimento: Colors.blue,
    concluido:      Colors.green,
    ausente:        Colors.redSoft,
  }[item.estado as string] || Colors.muted

  const vol = item.voluntarios
  return (
    <View style={[fi.card, { borderLeftColor: cor }]}>
      <View style={[fi.senha, { backgroundColor: cor + '18' }]}>
        <Text style={[fi.senhaText, { color: cor }]}>{item.senha}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={fi.nome}>{vol?.profiles?.nome}</Text>
        <Text style={fi.serial}>{vol?.numero_serial}</Text>
      </View>
      {vol?.tipo_sanguineo && (
        <Text style={[fi.tipo, { color: tipo === 'rastreio' ? Colors.blue : Colors.red }]}>
          {vol.tipo_sanguineo}
        </Text>
      )}
      <View style={[fi.estadoBadge, { backgroundColor: cor + '15' }]}>
        <Text style={[fi.estadoText, { color: cor }]}>
          {item.estado === 'aguardando' ? 'Aguarda' :
           item.estado === 'chamado'    ? 'Chamado' :
           item.estado === 'em_atendimento' ? 'Atendimento' :
           item.estado === 'concluido'  ? 'Concluído' : 'Ausente'}
        </Text>
      </View>
    </View>
  )
}
const fi = StyleSheet.create({
  card:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.dark2, borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  senha:      { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  senhaText:  { fontSize: 15, fontWeight: '800', fontFamily: 'monospace' },
  nome:       { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  serial:     { fontSize: 11, color: Colors.muted },
  tipo:       { fontSize: 14, fontWeight: '800', marginRight: 4 },
  estadoBadge:{ borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  estadoText: { fontSize: 11, fontWeight: '700' },
})

function EmptyFila({ mensagem }: { mensagem: string }) {
  return (
    <View style={{ backgroundColor: Colors.dark2, borderRadius: 14, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
      <Text style={{ fontSize: 32, marginBottom: 10 }}>📭</Text>
      <Text style={{ fontSize: 14, color: Colors.muted, textAlign: 'center' }}>{mensagem}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },

  header: {
    backgroundColor: Colors.dark2, paddingHorizontal: 20,
    paddingVertical: 16, paddingTop: Platform.OS === 'ios' ? 56 : 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerNome:  { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerBanco: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  scannerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
  },
  logoutBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', gap: 8, padding: 14, backgroundColor: Colors.dark2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },

  abas: { flexDirection: 'row', backgroundColor: Colors.dark2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative', gap: 3 },
  abaActive: { borderBottomWidth: 2, borderBottomColor: Colors.red },
  abaLabel:  { fontSize: 11, fontWeight: '600', color: Colors.muted },
  abaLabelActive: { color: Colors.white },
  abaBadge: { position: 'absolute', top: 6, right: '50%', marginRight: -20, backgroundColor: Colors.red, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  abaBadgeText: { fontSize: 9, fontWeight: '800', color: Colors.white },

  btnChamar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.blue, borderRadius: 14, padding: 16, marginBottom: 16,
    shadowColor: Colors.blue, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnChamarText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  listaTitulo: { fontSize: 14, fontWeight: '700', color: Colors.muted, marginBottom: 10, letterSpacing: 0.5 },
  sectionTitulo: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 14 },

  searchCard: { backgroundColor: Colors.dark2, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  searchInput: {
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 12, fontSize: 15, color: Colors.white,
    fontFamily: 'monospace', letterSpacing: 2,
  },
  searchBtn: {
    width: 46, height: 46, backgroundColor: Colors.blue,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },

  resultadoCard: { backgroundColor: Colors.dark2, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  resultadoHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  resultadoAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  resultadoAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  resultadoNome:   { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 2 },
  resultadoSerial: { fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace', marginBottom: 2 },
  resultadoTel:    { fontSize: 12, color: Colors.muted },

  tipoSangBadge: { backgroundColor: Colors.redGlow, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  tipoSangText:  { fontSize: 14, fontWeight: '800', color: Colors.redSoft },

  estadoRow: { borderRadius: 10, padding: 12, borderWidth: 1, marginBottom: 14 },
  estadoText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },

  resultadoBtns: { flexDirection: 'row', gap: 10 },
  btnExames: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(74,158,255,0.1)', borderWidth: 1,
    borderColor: 'rgba(74,158,255,0.25)', borderRadius: 10, padding: 12,
  },
  btnExamesText: { fontSize: 14, fontWeight: '600', color: Colors.blue },

  agendaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.dark2, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  agendaHora: { backgroundColor: Colors.dark3, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  agendaHoraText: { fontSize: 14, fontWeight: '700', color: Colors.white, fontFamily: 'monospace' },
  agendaNome:     { fontSize: 13, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  agendaSerial:   { fontSize: 11, color: Colors.muted },
  agendaEstado:   { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  agendaEstadoText: { fontSize: 11, fontWeight: '700' },

  fillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
})