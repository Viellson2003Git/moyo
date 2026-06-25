import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, Alert, TextInput, Modal
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import BottomNav from '../../components/BottomNav'

type Doador = {
  id: string
  numero_serial: string
  tipo_sanguineo: string | null
  estado: string
  data_nascimento: string | null
  sexo: string | null
  profiles: { nome: string; email: string; telefone: string | null } | null
}

type CheckIn = {
  id: string
  numero_ordem: number
  hora_chegada: string
  estado: string
  voluntarios: {
    numero_serial: string
    tipo_sanguineo: string | null
    profiles: { nome: string } | null
  } | null
}

type AgendaItem = {
  id: string
  estado: string
  voluntarios: {
    numero_serial: string
    tipo_sanguineo: string | null
    profiles: { nome: string } | null
  } | null
  slots: { hora: string; tipo_doacao: string } | null
}

export default function EnfermeiroDashboard() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [activeTab, setActiveTab]     = useState<'fila' | 'scanner' | 'agenda' | 'exame'>('fila')
  const [loading, setLoading]         = useState(true)
  const [enfermeiroId, setEnfermeiroId] = useState<string | null>(null)
  const [bancoId, setBancoId]         = useState<string | null>(null)

  // Fila de check-ins
  const [fila, setFila]               = useState<CheckIn[]>([])

  // Agenda do dia
  const [agenda, setAgenda]           = useState<AgendaItem[]>([])

  // Doador consultado
  const [doador, setDoador]           = useState<Doador | null>(null)
  const [serial, setSerial]           = useState('')
  const [buscando, setBuscando]       = useState(false)

  // Modal exame
  const [showExame, setShowExame]     = useState(false)
  // Scanner QR
  const [modoScanner, setModoScanner]     = useState<'manual' | 'qr'>('manual')
  const [cameraAtiva, setCameraAtiva]     = useState(false)
  const [scanned, setScanned]             = useState(false)
  const [permissao, pedirPermissao]       = useCameraPermissions()
  const permissaoCamera                   = permissao?.granted
  const [exameDoador, setExameDoador] = useState<Doador | null>(null)
  const [hemoglobina, setHemoglobina] = useState('')
  const [pressao, setPressao]         = useState('')
  const [peso, setPeso]               = useState('')
  const [resultado, setResultado]     = useState<'apto' | 'inapto_temp' | 'inapto_perm' | null>(null)
  const [salvando, setSalvando]       = useState(false)

  useEffect(() => { loadInicial() }, [])
  useEffect(() => { if (bancoId) { loadFila(); loadAgenda() } }, [bancoId])

  async function loadInicial() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('id').eq('id', user.id).single()

    const { data: enf } = await supabase
      .from('enfermeiros').select('id').eq('profile_id', user.id).single()

    // Se não tem registo de enfermeiro, cria um básico
    if (!enf) {
      const { data: novoEnf } = await supabase
        .from('enfermeiros')
        .insert({ profile_id: user.id })
        .select('id').single()
      if (novoEnf) setEnfermeiroId(novoEnf.id)
    } else {
      setEnfermeiroId(enf.id)
    }

    // Pega o primeiro banco de sangue
    const { data: banco } = await supabase
      .from('bancos_sangue').select('id').eq('ativo', true).single()
    if (banco) setBancoId(banco.id)

    setLoading(false)
  }

  async function loadFila() {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('check_ins')
      .select('id, numero_ordem, hora_chegada, estado, voluntarios(numero_serial, tipo_sanguineo, profiles(nome))')
      .eq('banco_id', bancoId)
      .eq('data', hoje)
      .in('estado', ['aguardando', 'em_atendimento'])
      .order('numero_ordem')
    setFila((data as any) || [])
  }

  async function loadAgenda() {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('agendamentos')
      .select('id, estado, voluntarios(numero_serial, tipo_sanguineo, profiles(nome)), slots(hora, tipo_doacao)')
      .in('estado', ['pendente', 'confirmado'])
      .order('created_at')
    setAgenda((data as any) || [])
  }

  async function buscarDoador(serialNum: string) {
    if (!serialNum.trim()) return
    setBuscando(true)
    setDoador(null)

    const { data } = await supabase
      .from('voluntarios')
      .select('id, numero_serial, tipo_sanguineo, estado, data_nascimento, sexo, profiles(nome, email, telefone)')
      .eq('numero_serial', serialNum.trim().toUpperCase())
      .single()

    setDoador((data as any) || null)
    if (!data) Alert.alert('Não encontrado', `Doador com serial "${serialNum}" não existe no sistema.`)
    setBuscando(false)
  }

  async function handleCheckIn(voluntarioId: string) {
    if (!bancoId) return
    const { error } = await supabase.from('check_ins').insert({
      voluntario_id: voluntarioId,
      banco_id: bancoId,
    })
    if (!error) {
      Alert.alert('✅ Check-in registado!', 'O doador foi adicionado à fila.')
      loadFila()
      setDoador(null)
      setSerial('')
    } else {
      Alert.alert('Erro', error.message)
    }
  }

  async function handleChamar(checkInId: string) {
    await supabase.from('check_ins')
      .update({ estado: 'em_atendimento', hora_chamada: new Date().toTimeString().slice(0,8) })
      .eq('id', checkInId)
    loadFila()
  }

  async function handleConcluirAtendimento(checkInId: string) {
    await supabase.from('check_ins')
      .update({ estado: 'coleta_feita', hora_fim: new Date().toTimeString().slice(0,8) })
      .eq('id', checkInId)
    loadFila()
  }

  async function handleSalvarExame() {
    if (!exameDoador || !resultado) {
      Alert.alert('Atenção', 'Preenche pelo menos o resultado.')
      return
    }
    setSalvando(true)
    try {
      const { error: exameError } = await supabase.from('exames').insert({
        voluntario_id:   exameDoador.id,
        enfermeiro_id:   enfermeiroId,
        banco_id:        bancoId,
        hemoglobina:     hemoglobina ? parseFloat(hemoglobina) : null,
        pressao_arterial: pressao || null,
        peso:            peso ? parseFloat(peso) : null,
        resultado,
        data_exame:      new Date().toISOString().split('T')[0],
        data_resultado:  new Date().toISOString().split('T')[0],
        tipo_sanguineo:  exameDoador.tipo_sanguineo,
        fator_rh:        exameDoador.tipo_sanguineo?.includes('+') ? '+' : '-',
      })
      if (exameError) throw exameError

      // Actualiza estado do voluntário
      const novoEstado = resultado === 'apto' ? 'apto' : resultado === 'inapto_temp' ? 'inapto_temp' : 'inapto_perm'
      await supabase.from('voluntarios')
        .update({ estado: novoEstado })
        .eq('id', exameDoador.id)

      Alert.alert(
        '✅ Exame registado!',
        `O candidato foi marcado como "${resultado === 'apto' ? 'Apto' : 'Inapto'}".`,
        [{ text: 'OK', onPress: () => {
          setShowExame(false)
          setExameDoador(null)
          setHemoglobina(''); setPressao(''); setPeso(''); setResultado(null)
          setDoador(null); setSerial('')
        }}]
      )
    } catch (e: any) {
      Alert.alert('Erro', e.message)
    }
    setSalvando(false)
  }

  async function confirmarAgendamento(id: string) {
    await supabase.from('agendamentos').update({ estado: 'confirmado' }).eq('id', id)
    loadAgenda()
  }

  async function registarDoacao(agendamentoId: string, voluntarioId: string) {
    const { error } = await supabase.from('doacoes').insert({
      voluntario_id: voluntarioId,
      enfermeiro_id: enfermeiroId,
      banco_id:      bancoId,
      agendamento_id: agendamentoId,
      data_doacao:   new Date().toISOString().split('T')[0],
      tipo_doacao:   'Sangue Total',
    })

    if (!error) {
      await supabase.from('agendamentos').update({ estado: 'realizado' }).eq('id', agendamentoId)
      Alert.alert('✅ Doação registada!', 'Histórico actualizado.')
      loadAgenda()
    } else {
      Alert.alert('Erro', error.message)
    }
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  const navItems: { icon: keyof typeof Feather.glyphMap; label: string; tab: typeof activeTab }[] = [
    { icon: 'list',       label: 'Fila',     tab: 'fila'    },
    { icon: 'search',     label: 'Consultar',tab: 'scanner' },
    { icon: 'calendar',   label: 'Agenda',   tab: 'agenda'  },
  ]

  return (
    <View style={s.root}>

      {/* Sidebar web */}
      {isWeb && (
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
              {navItems.map(n => (
                <TouchableOpacity
                  key={n.label}
                  style={[s.sidebarItem, activeTab === n.tab && s.sidebarItemActive]}
                  onPress={() => setActiveTab(n.tab)}
                >
                  <Feather name={n.icon} size={15} color={activeTab === n.tab ? Colors.redSoft : Colors.muted} />
                  <Text style={[s.sidebarItemLabel, activeTab === n.tab && { color: Colors.redSoft }]}>
                    {n.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={s.sidebarLogout} onPress={async () => {
            await supabase.auth.signOut()
            router.replace('/(auth)/login')
          }}>
            <Feather name="log-out" size={15} color={Colors.muted} />
            <Text style={s.sidebarLogoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.main}>

        {/* Topbar */}
        <View style={s.topbar}>
          <Text style={s.topbarTitle}>
            {activeTab === 'fila'    ? '🏥 Fila de Check-in' :
             activeTab === 'scanner' ? '🔍 Consultar Doador'  :
             '📅 Agenda do Dia'}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={[s.topbarBadge, { backgroundColor: Colors.blue }]}>
            <Text style={s.topbarBadgeText}>ENFERMEIRO</Text>
          </View>
          {activeTab === 'fila' && (
            <TouchableOpacity onPress={loadFila} style={{ marginLeft: 10 }}>
              <Feather name="refresh-cw" size={18} color={Colors.muted} />
            </TouchableOpacity>
          )}
          {/* ← BOTÃO SAIR */}
            <TouchableOpacity
              onPress={async () => {
                await supabase.auth.signOut()
                router.replace('/(auth)/login')
              }}
              style={{ marginLeft: 10, padding: 6 }}
            >
              <Feather name="log-out" size={18} color={Colors.muted} />
            </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.content}>
            {/* Acesso rápido */}
            <View style={s.quickAccess}>
              <TouchableOpacity
                style={s.quickBtn}
                onPress={() => router.push('/(enfermeiro)/recepcao' as any)}
              >
                <Feather name="camera" size={18} color={Colors.white} />
                <Text style={s.quickBtnText}>Ecrã de Recepção</Text>
                <Feather name="chevron-right" size={14} color={Colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.quickBtn, { borderColor: 'rgba(74,158,255,0.3)' }]}
                onPress={() => router.push('/(enfermeiro)/painel' as any)}
              >
                <Feather name="monitor" size={18} color={Colors.blue} />
                <Text style={s.quickBtnText}>Painel de Fila</Text>
                <Feather name="chevron-right" size={14} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            {/* ══ FILA DE CHECK-IN ══ */}
            {activeTab === 'fila' && (
              <>
                {/* Stats da fila */}
                <View style={s.filaStats}>
                  <View style={s.filaStatCard}>
                    <Text style={[s.filaStatNum, { color: Colors.gold }]}>
                      {fila.filter(f => f.estado === 'aguardando').length}
                    </Text>
                    <Text style={s.filaStatLabel}>Aguardando</Text>
                  </View>
                  <View style={s.filaStatCard}>
                    <Text style={[s.filaStatNum, { color: Colors.blue }]}>
                      {fila.filter(f => f.estado === 'em_atendimento').length}
                    </Text>
                    <Text style={s.filaStatLabel}>Em Atendimento</Text>
                  </View>
                  <View style={s.filaStatCard}>
                    <Text style={[s.filaStatNum, { color: Colors.green }]}>
                      {fila.length}
                    </Text>
                    <Text style={s.filaStatLabel}>Total Hoje</Text>
                  </View>
                </View>

                {fila.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Feather name="users" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
                    <Text style={s.emptyTitle}>Fila vazia</Text>
                    <Text style={s.emptyText}>
                      Nenhum doador fez check-in hoje ainda. Usa a aba "Consultar" para registar chegadas.
                    </Text>
                  </View>
                ) : (
                  fila.map(item => {
                    const vol = item.voluntarios as any
                    const isAtendendo = item.estado === 'em_atendimento'
                    return (
                      <View key={item.id} style={[s.filaItem, isAtendendo && s.filaItemAtendendo]}>
                        {/* Número de ordem */}
                        <View style={[s.filaOrdem, { backgroundColor: isAtendendo ? Colors.blue : Colors.dark4 }]}>
                          <Text style={s.filaOrdemNum}>{item.numero_ordem}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={s.filaName}>{vol?.profiles?.nome || '—'}</Text>
                          <Text style={s.filaSerial}>{vol?.numero_serial}</Text>
                          <Text style={s.filaHora}>
                            Check-in: {item.hora_chegada?.slice(0,5)}
                          </Text>
                        </View>

                        {/* Tipo sanguíneo */}
                        {vol?.tipo_sanguineo && (
                          <View style={s.filaTipo}>
                            <Text style={s.filaTipoText}>{vol.tipo_sanguineo}</Text>
                          </View>
                        )}

                        {/* Botões */}
                        <View style={s.filaBtns}>
                          {!isAtendendo ? (
                            <TouchableOpacity
                              style={s.btnChamar}
                              onPress={() => handleChamar(item.id)}
                            >
                              <Text style={s.btnChamarText}>Chamar</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={s.btnConcluir}
                              onPress={() => handleConcluirAtendimento(item.id)}
                            >
                              <Text style={s.btnConcluirText}>Concluir</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })
                )}
              </>
            )}

            {/* ══ CONSULTAR DOADOR ══ */}
{activeTab === 'scanner' && (
  <>
    {/* Toggle Manual / QR */}
    <View style={s.modoTabs}>
      <TouchableOpacity
        style={[s.modoTab, modoScanner === 'manual' && s.modoTabActive]}
        onPress={() => { setModoScanner('manual'); setCameraAtiva(false) }}
      >
        <Feather name="hash" size={14} color={modoScanner === 'manual' ? Colors.white : Colors.muted} />
        <Text style={[s.modoTabText, modoScanner === 'manual' && { color: Colors.white }]}>
          Número Serial
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.modoTab, modoScanner === 'qr' && s.modoTabActive]}
        onPress={() => { setModoScanner('qr'); setCameraAtiva(true) }}
      >
        <Feather name="camera" size={14} color={modoScanner === 'qr' ? Colors.white : Colors.muted} />
        <Text style={[s.modoTabText, modoScanner === 'qr' && { color: Colors.white }]}>
          Scanner QR
        </Text>
      </TouchableOpacity>
    </View>

    {/* ── MODO MANUAL ── */}
    {modoScanner === 'manual' && (
      <View style={s.searchCard}>
        <Text style={s.searchTitle}>Inserir Número Serial</Text>
        <Text style={s.searchSub}>
          Insere o número serial do cartão do doador manualmente.
        </Text>
        <View style={s.searchRow}>
          <TextInput
            style={s.searchInput}
            value={serial}
            onChangeText={v => setSerial(v.toUpperCase())}
            placeholder="MY-2026-000001"
            placeholderTextColor={Colors.muted2}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={() => buscarDoador(serial)}
          />
          <TouchableOpacity
            style={s.searchBtn}
            onPress={() => buscarDoador(serial)}
            disabled={buscando}
          >
            {buscando
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Feather name="search" size={18} color={Colors.white} />
            }
          </TouchableOpacity>
        </View>
      </View>
    )}

    {/* ── MODO QR SCANNER ── */}
{modoScanner === 'qr' && (
  <View style={s.cameraCard}>
    {cameraAtiva && permissaoCamera ? (
      <>
        <View style={{ position: 'relative', height: 300 }}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
             videoQuality="2160p"
            onBarcodeScanned={scanned ? undefined : ({ data }) => {
              
              setScanned(true)
              setCameraAtiva(false)
              setModoScanner('manual')
              setSerial(data)
              buscarDoador(data)
            }}
          />
          {/* Overlay fora da CameraView */}
          <View style={s.cameraOverlay} pointerEvents="none">
            <View style={s.cameraMira}>
              <View style={[s.cameraMiraCorner, s.cornerTL]} />
              <View style={[s.cameraMiraCorner, s.cornerTR]} />
              <View style={[s.cameraMiraCorner, s.cornerBL]} />
              <View style={[s.cameraMiraCorner, s.cornerBR]} />
            </View>
            <Text style={s.cameraHint}>
              Aponta para o QR Code do cartão
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={s.cameraCancelBtn}
          onPress={() => { setCameraAtiva(false); setModoScanner('manual') }}
        >
          <Feather name="x" size={16} color={Colors.white} />
          <Text style={s.cameraCancelText}>Cancelar Scanner</Text>
        </TouchableOpacity>
        </>
          ) : !permissaoCamera ? (
          <View style={s.cameraPermissao}>
            <Feather name="camera-off" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
            <Text style={s.cameraPermissaoTitle}>Permissão necessária</Text>
            <Text style={s.cameraPermissaoText}>
              O Moyo precisa de acesso à câmara para escanear QR Codes.
            </Text>
            <TouchableOpacity style={s.cameraPermissaoBtn} onPress={pedirPermissao}>
              <Text style={s.cameraPermissaoBtnText}>Dar Permissão</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.cameraReady}>
            <Feather name="camera" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
            <Text style={s.cameraPermissaoTitle}>Scanner pronto</Text>
            <TouchableOpacity
              style={s.cameraPermissaoBtn}
              onPress={() => { setCameraAtiva(true); setScanned(false) }}
            >
              <Text style={s.cameraPermissaoBtnText}>Abrir Câmara</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )}

    {/* Resultado da busca */}
    {doador && (
      <View style={s.doadorCard}>
        <View style={s.doadorHeader}>
          <View style={s.doadorAvatar}>
            <Text style={s.doadorAvatarText}>
              {(doador.profiles as any)?.nome?.slice(0,2).toUpperCase() || 'BH'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.doadorNome}>{(doador.profiles as any)?.nome}</Text>
            <Text style={s.doadorSerial}>{doador.numero_serial}</Text>
          </View>
          <View style={s.doadorTipo}>
            <Text style={s.doadorTipoText}>{doador.tipo_sanguineo || '—'}</Text>
          </View>
        </View>

        <View style={s.doadorInfo}>
          <InfoRow icon="mail"   label="Email"    value={(doador.profiles as any)?.email || '—'} />
          <InfoRow icon="phone"  label="Telefone" value={(doador.profiles as any)?.telefone || '—'} />
          <InfoRow icon="user"   label="Sexo"     value={doador.sexo === 'M' ? 'Masculino' : doador.sexo === 'F' ? 'Feminino' : '—'} />
          <InfoRow icon="shield" label="Estado"   value={estadoLabel(doador.estado)} valueColor={estadoCor(doador.estado)} />
        </View>

        <View style={s.doadorActions}>
          <TouchableOpacity style={s.btnCheckIn} onPress={() => handleCheckIn(doador.id)}>
            <Feather name="log-in" size={14} color={Colors.white} />
            <Text style={s.btnCheckInText}>Registar Check-in</Text>
          </TouchableOpacity>
          {(doador.estado === 'pendente' || doador.estado === 'em_exame') && (
            <TouchableOpacity style={s.btnExame} onPress={() => { setExameDoador(doador); setShowExame(true) }}>
              <Feather name="clipboard" size={14} color={Colors.white} />
              <Text style={s.btnExameText}>Lançar Exame</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Botão escanear outro */}
        <TouchableOpacity
          style={s.scanOutroBtn}
          onPress={() => { setDoador(null); setSerial(''); setScanned(false) }}
        >
          <Feather name="refresh-cw" size={13} color={Colors.muted} />
          <Text style={s.scanOutroBtnText}>Consultar outro doador</Text>
        </TouchableOpacity>
      </View>
    )}
  </>
)}

            {/* ══ AGENDA DO DIA ══ */}
            {activeTab === 'agenda' && (
              <>
                <Text style={s.agendaDate}>
                  {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>

                {agenda.length === 0 ? (
                  <View style={s.emptyBox}>
                    <Feather name="calendar" size={40} color={Colors.muted2} style={{ marginBottom: 12 }} />
                    <Text style={s.emptyTitle}>Agenda vazia</Text>
                    <Text style={s.emptyText}>Nenhum agendamento para hoje.</Text>
                  </View>
                ) : (
                  agenda.map(item => {
                    const vol  = item.voluntarios as any
                    const slot = item.slots as any
                    return (
                      <View key={item.id} style={s.agendaItem}>
                        <View style={s.agendaHoraWrap}>
                          <Text style={s.agendaHora}>{slot?.hora?.slice(0,5) || '—'}</Text>
                          <Text style={s.agendaTipo}>{slot?.tipo_doacao || '—'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.agendaNome}>{vol?.profiles?.nome || '—'}</Text>
                          <Text style={s.agendaSerial}>{vol?.numero_serial}</Text>
                          {vol?.tipo_sanguineo && (
                            <View style={s.agendaTipoSang}>
                              <Text style={s.agendaTipoSangText}>{vol.tipo_sanguineo}</Text>
                            </View>
                          )}
                        </View>
                        <View style={s.agendaBtns}>
                          {item.estado === 'pendente' && (
                            <TouchableOpacity
                              style={s.btnConfirmar}
                              onPress={() => confirmarAgendamento(item.id)}
                            >
                              <Text style={s.btnConfirmarText}>Confirmar</Text>
                            </TouchableOpacity>
                          )}
                          {item.estado === 'confirmado' && (
                            <TouchableOpacity
                              style={s.btnRegistar}
                              onPress={() => registarDoacao(item.id, vol?.id)}
                            >
                              <Text style={s.btnRegistarText}>Registar Doação</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })
                )}
              </>
            )}

            <View style={{ height: isWeb ? 40 : 100 }} />
          </View>
        </ScrollView>

        {/* Bottom nav mobile */}
        {!isWeb && (
        <BottomNav items={[
          { icon: 'list',     label: 'Fila',      onPress: () => setActiveTab('fila'),    active: activeTab === 'fila',    badge: fila.length },
          { icon: 'search',   label: 'Consultar', onPress: () => setActiveTab('scanner'), active: activeTab === 'scanner'  },
          { icon: 'calendar', label: 'Agenda',    onPress: () => setActiveTab('agenda'),  active: activeTab === 'agenda'   },
        ]} />
      )}
      </View>

      {/* ══ MODAL EXAME ══ */}
      <Modal visible={showExame} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>📋 Lançar Exame</Text>
              <TouchableOpacity onPress={() => setShowExame(false)}>
                <Feather name="x" size={20} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            {exameDoador && (
              <Text style={s.modalSubtitle}>
                {(exameDoador.profiles as any)?.nome} · {exameDoador.numero_serial}
              </Text>
            )}

            <ScrollView style={{ maxHeight: 400 }}>
              <Text style={s.modalLabel}>HEMOGLOBINA (g/dL)</Text>
              <TextInput
                style={s.modalInput}
                value={hemoglobina}
                onChangeText={setHemoglobina}
                placeholder="Ex: 14.2"
                placeholderTextColor={Colors.muted2}
                keyboardType="decimal-pad"
              />

              <Text style={s.modalLabel}>PRESSÃO ARTERIAL</Text>
              <TextInput
                style={s.modalInput}
                value={pressao}
                onChangeText={setPressao}
                placeholder="Ex: 120/80"
                placeholderTextColor={Colors.muted2}
              />

              <Text style={s.modalLabel}>PESO (kg)</Text>
              <TextInput
                style={s.modalInput}
                value={peso}
                onChangeText={setPeso}
                placeholder="Ex: 70"
                placeholderTextColor={Colors.muted2}
                keyboardType="decimal-pad"
              />

              <Text style={s.modalLabel}>RESULTADO *</Text>
              <View style={s.resultadoOpts}>
                {[
                  { val: 'apto',        label: '✅ Apto',                color: Colors.green   },
                  { val: 'inapto_temp', label: '⚠️ Inapto Temporário',   color: Colors.gold    },
                  { val: 'inapto_perm', label: '❌ Inapto Permanente',   color: Colors.redSoft },
                ].map(r => (
                  <TouchableOpacity
                    key={r.val}
                    style={[
                      s.resultadoOpt,
                      resultado === r.val && { borderColor: r.color, backgroundColor: r.color + '15' }
                    ]}
                    onPress={() => setResultado(r.val as any)}
                  >
                    <Text style={[s.resultadoOptText, resultado === r.val && { color: r.color }]}>
                      {r.label}
                    </Text>
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
      </Modal>
    </View>
  )
}

// ── Componentes auxiliares ───────────────
function InfoRow({ icon, label, value, valueColor }: {
  icon: keyof typeof Feather.glyphMap
  label: string; value: string; valueColor?: string
}) {
  return (
    <View style={s.infoRow}>
      <Feather name={icon} size={13} color={Colors.muted} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  )
}

function estadoLabel(e: string) {
  return { pendente: 'Pendente', em_exame: 'Em Exame', apto: 'Apto ✓', inapto_temp: 'Inapto Temp.', inapto_perm: 'Inapto Perm.' }[e] || e
}
function estadoCor(e: string) {
  return { pendente: Colors.gold, em_exame: Colors.blue, apto: Colors.green, inapto_temp: Colors.gold, inapto_perm: Colors.redSoft }[e] || Colors.muted
}

// ── Estilos ─────────────────────────────
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
  topbarTitle:     { fontSize: 15, fontWeight: '700', color: Colors.white, flex: 1 },
  topbarBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },

  // Fila stats
  filaStats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  filaStatCard: {
    flex: 1, backgroundColor: Colors.dark2, borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  filaStatNum:   { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  filaStatLabel: { fontSize: 11, color: Colors.muted, textAlign: 'center' },

  // Fila item
  filaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.dark2, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filaItemAtendendo: { borderColor: 'rgba(74,158,255,0.3)', backgroundColor: 'rgba(74,158,255,0.05)' },
  filaOrdem:    { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filaOrdemNum: { fontSize: 18, fontWeight: '800', color: Colors.white },
  filaName:     { fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  filaSerial:   { fontSize: 11, color: Colors.redSoft, fontFamily: 'monospace', marginBottom: 2 },
  filaHora:     { fontSize: 11, color: Colors.muted },
  filaTipo:     { backgroundColor: Colors.redGlow, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  filaTipoText: { fontSize: 13, fontWeight: '800', color: Colors.redSoft },
  filaBtns:     { gap: 6 },
  btnChamar:    { backgroundColor: Colors.red, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  btnChamarText:{ fontSize: 12, fontWeight: '700', color: Colors.white },
  btnConcluir:  { backgroundColor: Colors.green, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  btnConcluirText: { fontSize: 12, fontWeight: '700', color: Colors.dark },

  // Busca
  searchCard: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  searchTitle:  { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 6 },
  searchSub:    { fontSize: 13, color: Colors.muted, marginBottom: 16, lineHeight: 18 },
  searchRow:    { flexDirection: 'row', gap: 10 },
  searchInput:  {
    flex: 1, backgroundColor: Colors.dark3,
    borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 13, fontSize: 15,
    color: Colors.white, fontFamily: 'monospace',
    letterSpacing: 1,
  },
  searchBtn: {
    width: 48, height: 48, borderRadius: 10,
    backgroundColor: Colors.red,
    alignItems: 'center', justifyContent: 'center',
  },

  // Doador card
  doadorCard: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  doadorHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, backgroundColor: Colors.dark3,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  doadorAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  doadorAvatarText: { fontSize: 16, fontWeight: '800', color: Colors.white },
  doadorNome:   { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  doadorSerial: { fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace' },
  doadorTipo:   { backgroundColor: Colors.redGlow, borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  doadorTipoText: { fontSize: 20, fontWeight: '800', color: Colors.redSoft },

  doadorInfo:    { padding: 16, gap: 10 },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel:     { fontSize: 12, color: Colors.muted, width: 70 },
  infoValue:     { fontSize: 13, fontWeight: '600', color: Colors.white, flex: 1 },

  doadorActions: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  btnCheckIn:     { flex: 1, backgroundColor: Colors.dark3, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnCheckInText: { fontSize: 13, fontWeight: '600', color: Colors.white },
  btnExame:       { flex: 1, backgroundColor: Colors.red, borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnExameText:   { fontSize: 13, fontWeight: '600', color: Colors.white },

  // Agenda
  agendaDate:   { fontSize: 14, color: Colors.muted, marginBottom: 14, fontStyle: 'italic' },
  agendaItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.dark2, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  agendaHoraWrap: { alignItems: 'center', minWidth: 56 },
  agendaHora:     { fontSize: 20, fontWeight: '800', color: Colors.white },
  agendaTipo:     { fontSize: 10, color: Colors.muted, textAlign: 'center' },
  agendaNome:     { fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 2 },
  agendaSerial:   { fontSize: 11, color: Colors.redSoft, fontFamily: 'monospace', marginBottom: 4 },
  agendaTipoSang: { backgroundColor: Colors.redGlow, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  agendaTipoSangText: { fontSize: 11, fontWeight: '700', color: Colors.redSoft },
  agendaBtns:     { gap: 6 },
  btnConfirmar:   { backgroundColor: Colors.blue, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  btnConfirmarText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  btnRegistar:    { backgroundColor: Colors.green, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  btnRegistarText:{ fontSize: 12, fontWeight: '700', color: Colors.dark },

  // Empty
  emptyBox: {
    backgroundColor: Colors.dark2, borderRadius: 14,
    padding: 36, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 8 },
  emptyText:  { fontSize: 13, color: Colors.muted, textAlign: 'center', lineHeight: 18 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.dark2,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: Colors.white },
  modalSubtitle: { fontSize: 13, color: Colors.muted, marginBottom: 20 },
  modalLabel:    { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 13, fontSize: 14, color: Colors.white,
  },
  resultadoOpts: { gap: 8, marginBottom: 8 },
  resultadoOpt: {
    padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: Colors.dark3,
  },
  resultadoOptText: { fontSize: 14, fontWeight: '600', color: Colors.muted, textAlign: 'center' },
  modalBtn: {
    backgroundColor: Colors.red, borderRadius: 12,
    padding: 15, alignItems: 'center', marginTop: 16,
  },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

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
  // Modo tabs (manual / qr)
modoTabs:    { flexDirection: 'row', backgroundColor: Colors.dark3, borderRadius: 12, padding: 4, marginBottom: 16 },
modoTab:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 10, borderRadius: 9 },
modoTabActive: { backgroundColor: Colors.red },
modoTabText: { fontSize: 13, fontWeight: '600', color: Colors.muted },

// Camera
cameraCard: {
  backgroundColor: Colors.dark2, borderRadius: 16,
  overflow: 'hidden', marginBottom: 16,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  minHeight: 300,
},
camera: { width: '100%', height: 300 },
cameraOverlay: {
  position: 'absolute', inset: 0,
  alignItems: 'center', justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.4)',
  gap: 16,
},
cameraMira: {
  width: 220, height: 220,
  position: 'relative',
},
cameraMiraCorner: {
  position: 'absolute',
  width: 28, height: 28,
  borderColor: Colors.red, borderWidth: 3,
},
cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
cameraHint: {
  fontSize: 13, color: Colors.white, textAlign: 'center',
  backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16,
  paddingVertical: 8, borderRadius: 20,
},
cameraCancelBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  backgroundColor: Colors.dark3, padding: 14,
},
cameraCancelText: { fontSize: 14, fontWeight: '600', color: Colors.white },
cameraPermissao: { padding: 36, alignItems: 'center' },
cameraReady:     { padding: 36, alignItems: 'center' },
cameraPermissaoTitle: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 8 },
cameraPermissaoText:  { fontSize: 13, color: Colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
cameraPermissaoBtn:   { backgroundColor: Colors.red, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 24 },
cameraPermissaoBtnText: { fontSize: 13, fontWeight: '700', color: Colors.white },

scanOutroBtn: {
  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
},
scanOutroBtnText: { fontSize: 12, color: Colors.muted },
quickAccess: { flexDirection: 'row', gap: 10, marginBottom: 16 },
quickBtn: {
  flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
  backgroundColor: Colors.dark2, borderRadius: 12, padding: 14,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
},
quickBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.white },
})