// app/(enfermeiro)/exames.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, ActivityIndicator,
  Platform, useWindowDimensions
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { mostrarAlerta } from '../../utils/alert'
import { SafeAreaView } from 'react-native-safe-area-context'

const TIPOS_SANGUE = ['A+','A-','B+','B-','AB+','AB-','O+','O-']

const TIPOS_EXAME = [
  { val: 'triagem',           label: 'Triagem Geral',       icon: '🩺', desc: 'Avaliação completa: hemoglobina, pressão, peso e resultado final' },
  { val: 'hemoglobina',       label: 'Hemoglobina',         icon: '🔬', desc: 'Apenas nível de hemoglobina no sangue' },
  { val: 'pressao',           label: 'Pressão Arterial',    icon: '💓', desc: 'Apenas medição da pressão arterial' },
  { val: 'peso',              label: 'Peso Corporal',       icon: '⚖️', desc: 'Apenas verificação do peso mínimo' },
  { val: 'tipo_sanguineo',    label: 'Tipo Sanguíneo',      icon: '🩸', desc: 'Determinação do grupo sanguíneo' },
  { val: 'doenca_infecciosa', label: 'Doenças Infecciosas', icon: '🧪', desc: 'Rastreio de doenças infecciosas' },
  { val: 'outro',             label: 'Outro',               icon: '📋', desc: 'Outro tipo de exame' },
] as const

type TipoExame = typeof TIPOS_EXAME[number]['val']
type Resultado = 'apto' | 'inapto_temp' | 'inapto_perm'

export default function Exames() {
  const params = useLocalSearchParams<{ voluntarioId?: string; nome?: string }>()
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [voluntario, setVoluntario]     = useState<any>(null)
  const [exames, setExames]             = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [salvando, setSalvando]         = useState(false)
  const [enfermeiroId, setEnfermeiroId] = useState<string | null>(null)
  const [bancoId, setBancoId]           = useState<string | null>(null)

  // Form
  const [tipoExame, setTipoExame]         = useState<TipoExame>('triagem')
  const [resultado, setResultado]         = useState<Resultado | null>(null)
  const [tipoSanguineo, setTipoSanguineo] = useState('')
  const [hemoglobina, setHemoglobina]     = useState('')
  const [pressao, setPressao]             = useState('')
  const [peso, setPeso]                   = useState('')
  const [observacoes, setObservacoes]     = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
const user = session?.user
    if (!user) return

    // ✅ busca o id correcto da tabela enfermeiros
  const { data: enfermeiro } = await supabase
    .from('enfermeiros')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!enfermeiro) {
    mostrarAlerta('Erro', 'Perfil de enfermeiro não encontrado.')
    return
  }
  setEnfermeiroId(enfermeiro.id) 

    const { data: banco } = await supabase
      .from('bancos_sangue').select('id').eq('ativo', true).single()
    if (banco) setBancoId(banco.id)

    if (!params.voluntarioId) { setLoading(false); return }

    const { data: vol } = await supabase
      .from('voluntarios')
      .select('id, numero_serial, tipo_sanguineo, estado, data_nascimento, sexo, profiles(nome, telefone)')
      .eq('id', params.voluntarioId)
      .single()
    setVoluntario(vol)

    const { data: examesData } = await supabase
      .from('exames')
      .select('*')
      .eq('voluntario_id', params.voluntarioId)
      .order('created_at', { ascending: false })
    setExames(examesData || [])

    setLoading(false)
  }

  async function registarExame() {
    if (!voluntario || !enfermeiroId) return
    if (tipoExame === 'tipo_sanguineo' && !tipoSanguineo) {
      mostrarAlerta('Atenção', 'Selecciona o tipo sanguíneo determinado.')
      return
    }
    if (!resultado) {
      mostrarAlerta('Atenção', 'Selecciona o resultado do exame.')
      return
    }

    setSalvando(true)
    try {
      const { error } = await supabase.from('exames').insert({
        voluntario_id:    voluntario.id,
        enfermeiro_id:    enfermeiroId,
        banco_id:         bancoId,
        tipo:             tipoExame,
        resultado,
        tipo_sanguineo:   tipoSanguineo || null,
        fator_rh:         tipoSanguineo ? (tipoSanguineo.includes('+') ? '+' : '-') : null,
        hemoglobina:      hemoglobina ? parseFloat(hemoglobina) : null,
        pressao_arterial: pressao || null,
        peso:             peso ? parseFloat(peso) : null,
        observacoes:      observacoes.trim() || null,
        data_exame:       new Date().toISOString().split('T')[0],
        data_resultado:   new Date().toISOString().split('T')[0],
      })
      if (error) throw error

      mostrarAlerta(
        resultado === 'apto' ? '✅ Exame registado!' :
        resultado === 'inapto_temp' ? '⚠️ Exame registado' : '❌ Exame registado',
        tipoExame === 'triagem'
          ? `Candidato marcado como ${resultado === 'apto' ? 'APTO' : resultado === 'inapto_temp' ? 'Inapto Temporário' : 'Inapto Permanente'}.`
          : `Exame de ${TIPOS_EXAME.find(t => t.val === tipoExame)?.label} registado.`
      )

      setResultado(null)
      setTipoSanguineo('')
      setHemoglobina(''); setPressao(''); setPeso('')
      setObservacoes('')

      loadData()
    } catch (e: any) {
      mostrarAlerta('Erro', e.message)
    }
    setSalvando(false)
  }

  const estadoCfg: Record<string, { label: string; cor: string }> = {
    apto:        { label: 'Apto',              cor: Colors.green   },
    pendente:    { label: 'Pendente',          cor: Colors.gold    },
    em_exame:    { label: 'Em Exame',          cor: Colors.blue    },
    inapto_temp: { label: 'Inapto Temporário', cor: Colors.redSoft },
    inapto_perm: { label: 'Inapto Permanente', cor: Colors.redSoft },
  }

  const tipoSelecionado     = TIPOS_EXAME.find(t => t.val === tipoExame)
  const precisaTipoSang     = tipoExame === 'tipo_sanguineo' || tipoExame === 'triagem'
  const precisaHemoglobina  = tipoExame === 'hemoglobina' || tipoExame === 'triagem'
  const precisaPressao      = tipoExame === 'pressao' || tipoExame === 'triagem'
  const precisaPeso         = tipoExame === 'peso' || tipoExame === 'triagem'

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  if (!voluntario) return (
    <View style={s.center}>
      <Text style={{ color: Colors.muted }}>Voluntário não encontrado</Text>
    </View>
  )

  const est = estadoCfg[voluntario.estado] || estadoCfg['pendente']

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={[s.topbar]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Feather name="arrow-left" size={20} color={Colors.white} />
        </TouchableOpacity>
        <Text style={s.topbarTitle}>Registar Exames</Text>
        <View style={{ flex: 1 }} />
        <View style={[s.estadoBadge, { backgroundColor: est.cor + '18' }]}>
          <View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: est.cor }]} />
          <Text style={[s.estadoBadgeText, { color: est.cor }]}>{est.label}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={s.content}>

          <View style={s.candidatoCard}>
            <View style={s.candidatoAvatar}>
              <Text style={s.candidatoAvatarText}>
                {(voluntario.profiles as any)?.nome?.slice(0,2).toUpperCase() || 'MO'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.candidatoNome}>{(voluntario.profiles as any)?.nome}</Text>
              <Text style={s.candidatoSerial}>{voluntario.numero_serial}</Text>
              <View style={s.candidatoMeta}>
                {voluntario.tipo_sanguineo ? (
                  <View style={s.tipoSangBadge}>
                    <Text style={s.tipoSangText}>{voluntario.tipo_sanguineo}</Text>
                  </View>
                ) : (
                  <View style={[s.tipoSangBadge, { backgroundColor: Colors.dark4 }]}>
                    <Text style={[s.tipoSangText, { color: Colors.muted }]}>Tipo desconhecido</Text>
                  </View>
                )}
                {voluntario.data_nascimento && (
                  <Text style={s.candidatoIdade}>
                    {Math.floor((Date.now() - new Date(voluntario.data_nascimento).getTime()) / (365.25*24*60*60*1000))} anos
                    {voluntario.sexo ? ` · ${voluntario.sexo === 'M' ? 'Masculino' : 'Feminino'}` : ''}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {!voluntario.tipo_sanguineo && (
            <View style={s.avisoBox}>
              <Feather name="alert-circle" size={16} color={Colors.gold} />
              <Text style={s.avisoText}>
                Este candidato não conhece o seu tipo sanguíneo. Regista um exame de <Text style={{ fontWeight: '700', color: Colors.white }}>Tipo Sanguíneo</Text> ou faz uma <Text style={{ fontWeight: '700', color: Colors.white }}>Triagem Geral</Text>.
              </Text>
            </View>
          )}

          <View style={s.formCard}>
            <Text style={s.formTitulo}>📋 Novo Exame</Text>

            <Text style={s.formLabel}>TIPO DE EXAME *</Text>
            <View style={s.tiposGrid}>
              {TIPOS_EXAME.map(t => (
                <TouchableOpacity
                  key={t.val}
                  style={[s.tipoBtn, tipoExame === t.val && s.tipoBtnActive]}
                  onPress={() => setTipoExame(t.val)}
                >
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</Text>
                  <Text style={[s.tipoBtnLabel, tipoExame === t.val && { color: Colors.white }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tipoSelecionado && (
              <Text style={s.tipoDesc}>{tipoSelecionado.desc}</Text>
            )}

            {precisaTipoSang && (
              <>
                <Text style={s.formLabel}>
                  TIPO SANGUÍNEO {tipoExame === 'tipo_sanguineo' ? '*' : '(se determinado)'}
                </Text>
                {!voluntario.tipo_sanguineo ? (
                  <>
                    <View style={s.tipoSangGrid}>
                      {TIPOS_SANGUE.map(t => (
                        <TouchableOpacity
                          key={t}
                          style={[s.tipoSangBtn, tipoSanguineo === t && s.tipoSangBtnActive]}
                          onPress={() => setTipoSanguineo(tipoSanguineo === t ? '' : t)}
                        >
                          <Text style={[s.tipoSangBtnText, tipoSanguineo === t && { color: Colors.redSoft }]}>
                            {t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {tipoSanguineo && (
                      <View style={s.tipoSangSelecionado}>
                        <Feather name="check-circle" size={14} color={Colors.green} />
                        <Text style={s.tipoSangSelecionadoText}>
                          Tipo <Text style={{ fontWeight: '800', color: Colors.redSoft }}>{tipoSanguineo}</Text> — será guardado no perfil do candidato
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={[s.tipoSangJaConhece, { backgroundColor: Colors.redGlow }]}>
                    <Text style={[s.tipoSangBtnText, { color: Colors.redSoft, fontSize: 18 }]}>
                      {voluntario.tipo_sanguineo}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.muted }}>Já registado</Text>
                  </View>
                )}
              </>
            )}

            {precisaHemoglobina && (
              <>
                <Text style={s.formLabel}>HEMOGLOBINA (g/dL) {tipoExame === 'hemoglobina' ? '*' : ''}</Text>
                <TextInput
                  style={s.formInput}
                  value={hemoglobina}
                  onChangeText={setHemoglobina}
                  placeholder="Ex: 13.5"
                  placeholderTextColor={Colors.muted2}
                  keyboardType="decimal-pad"
                />
                <Text style={s.referencia}>✓ Normal: Homens ≥13.0 g/dL · Mulheres ≥12.0 g/dL</Text>
              </>
            )}

            {precisaPressao && (
              <>
                <Text style={s.formLabel}>PRESSÃO ARTERIAL {tipoExame === 'pressao' ? '*' : ''}</Text>
                <TextInput
                  style={s.formInput}
                  value={pressao}
                  onChangeText={setPressao}
                  placeholder="Ex: 120/80"
                  placeholderTextColor={Colors.muted2}
                />
                <Text style={s.referencia}>✓ Aceitável: Sistólica ≤180 mmHg · Diastólica ≤100 mmHg</Text>
              </>
            )}

            {precisaPeso && (
              <>
                <Text style={s.formLabel}>PESO (kg) {tipoExame === 'peso' ? '*' : ''}</Text>
                <TextInput
                  style={s.formInput}
                  value={peso}
                  onChangeText={setPeso}
                  placeholder="Ex: 68"
                  placeholderTextColor={Colors.muted2}
                  keyboardType="decimal-pad"
                />
                <Text style={s.referencia}>✓ Mínimo para doação: 50 kg</Text>
              </>
            )}

            <Text style={s.formLabel}>RESULTADO *</Text>
            <View style={s.resultadoRow}>
              {([
                { val: 'apto',        label: 'Apto',         icon: 'check-circle', cor: Colors.green   },
                { val: 'inapto_temp', label: 'Inapto Temp.', icon: 'clock',        cor: Colors.gold    },
                { val: 'inapto_perm', label: 'Inapto Perm.', icon: 'x-circle',     cor: Colors.redSoft },
              ] as const).map(r => (
                <TouchableOpacity
                  key={r.val}
                  style={[s.resultadoBtn, resultado === r.val && { borderColor: r.cor, backgroundColor: r.cor + '18' }]}
                  onPress={() => setResultado(r.val)}
                >
                  <Feather name={r.icon as any} size={18} color={resultado === r.val ? r.cor : Colors.muted} />
                  <Text style={[s.resultadoBtnText, resultado === r.val && { color: r.cor }]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {resultado === 'apto' && tipoExame === 'triagem' && (
              <View style={s.resultadoAviso}>
                <Feather name="info" size={13} color={Colors.green} />
                <Text style={[s.resultadoAvisoText, { color: Colors.green }]}>
                  A triagem aprovada vai marcar o candidato como <Text style={{ fontWeight: '800' }}>APTO</Text> para doação.
                </Text>
              </View>
            )}
            {(resultado === 'inapto_temp' || resultado === 'inapto_perm') && (
              <View style={[s.resultadoAviso, { backgroundColor: 'rgba(232,23,58,0.07)', borderColor: 'rgba(232,23,58,0.2)' }]}>
                <Feather name="alert-triangle" size={13} color={Colors.redSoft} />
                <Text style={[s.resultadoAvisoText, { color: Colors.redSoft }]}>
                  Este resultado vai marcar o candidato como <Text style={{ fontWeight: '800' }}>
                    {resultado === 'inapto_temp' ? 'INAPTO TEMPORÁRIO' : 'INAPTO PERMANENTE'}
                  </Text> independentemente do tipo de exame.
                </Text>
              </View>
            )}

            <Text style={s.formLabel}>OBSERVAÇÕES</Text>
            <TextInput
              style={[s.formInput, { height: 80, textAlignVertical: 'top' }]}
              value={observacoes}
              onChangeText={setObservacoes}
              placeholder="Notas clínicas, recomendações..."
              placeholderTextColor={Colors.muted2}
              multiline
            />

            <TouchableOpacity
              style={[s.btnRegistar, salvando && { opacity: 0.7 }]}
              onPress={registarExame}
              disabled={salvando}
            >
              {salvando
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <>
                    <Feather name="save" size={16} color={Colors.white} />
                    <Text style={s.btnRegistarText}>Registar Exame</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          <View style={s.historicoCard}>
            <Text style={s.formTitulo}>🗂️ Histórico de Exames ({exames.length})</Text>
            {exames.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🧪</Text>
                <Text style={s.emptyText}>Sem exames registados ainda.</Text>
              </View>
            ) : (
              exames.map(e => {
                const apto = e.resultado === 'apto'
                const inaptoPerm = e.resultado === 'inapto_perm'
                const cor = apto ? Colors.green : inaptoPerm ? Colors.redSoft : Colors.gold
                const tipoInfo = TIPOS_EXAME.find(t => t.val === e.tipo)
                return (
                  <View key={e.id} style={[s.exameItem, { borderLeftColor: cor }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ fontSize: 16 }}>{tipoInfo?.icon || '📋'}</Text>
                        <Text style={s.exameTipo}>{tipoInfo?.label || e.tipo}</Text>
                        {e.tipo_sanguineo && (
                          <View style={[s.tipoSangBadge, { marginLeft: 4 }]}>
                            <Text style={s.tipoSangText}>{e.tipo_sanguineo}</Text>
                          </View>
                        )}
                      </View>
                      {(e.hemoglobina || e.pressao_arterial || e.peso) && (
                        <Text style={s.exameValor}>
                          {[
                            e.hemoglobina ? `Hb: ${e.hemoglobina} g/dL` : null,
                            e.pressao_arterial ? `PA: ${e.pressao_arterial}` : null,
                            e.peso ? `Peso: ${e.peso} kg` : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                      {e.observacoes && (
                        <Text style={s.exameObs}>{e.observacoes}</Text>
                      )}
                      <Text style={s.exameData}>
                        {new Date(e.created_at).toLocaleDateString('pt-PT', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </Text>
                    </View>
                    <View style={[s.exameResultBadge, { backgroundColor: cor + '18', borderColor: cor + '40' }]}>
                      <Feather
                        name={apto ? 'check-circle' : inaptoPerm ? 'x-circle' : 'clock'}
                        size={13} color={cor}
                      />
                      <Text style={[s.exameResultText, { color: cor }]}>
                        {apto ? 'Apto' : inaptoPerm ? 'Inapto Perm.' : 'Inapto Temp.'}
                      </Text>
                    </View>
                  </View>
                )
              })
            )}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.dark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark },

  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  topbarTitle:      { fontSize: 16, fontWeight: '700', color: Colors.white },
  estadoBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  estadoBadgeText:  { fontSize: 11, fontWeight: '700' },

  content: { padding: 16, maxWidth: 600, width: '100%', alignSelf: 'center' },

  candidatoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  candidatoAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
  },
  candidatoAvatarText: { fontSize: 18, fontWeight: '800', color: Colors.white },
  candidatoNome:   { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 3 },
  candidatoSerial: { fontSize: 12, color: Colors.redSoft, fontFamily: 'monospace', marginBottom: 6 },
  candidatoMeta:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  candidatoIdade:  { fontSize: 12, color: Colors.muted },

  tipoSangBadge: { backgroundColor: Colors.redGlow, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tipoSangText:  { fontSize: 13, fontWeight: '800', color: Colors.redSoft },

  avisoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(232,180,75,0.08)',
    borderWidth: 1, borderColor: 'rgba(232,180,75,0.25)',
    borderRadius: 12, padding: 14, marginBottom: 14,
  },
  avisoText: { flex: 1, fontSize: 13, color: Colors.muted, lineHeight: 18 },

  formCard: {
    backgroundColor: Colors.dark2, borderRadius: 18,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  historicoCard: {
    backgroundColor: Colors.dark2, borderRadius: 18,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  formTitulo: { fontSize: 16, fontWeight: '700', color: Colors.white, marginBottom: 16 },
  formLabel:  { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 8, marginTop: 14 },
  formInput: {
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: 12, fontSize: 14, color: Colors.white,
  },

  tiposGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoBtn: {
    alignItems: 'center', padding: 12,
    backgroundColor: Colors.dark3, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    minWidth: 85,
  },
  tipoBtnActive: { backgroundColor: Colors.redGlow, borderColor: Colors.red },
  tipoBtnLabel:  { fontSize: 11, fontWeight: '600', color: Colors.muted, textAlign: 'center' },
  tipoDesc:      { fontSize: 12, color: Colors.muted, marginTop: 8, fontStyle: 'italic' },

  tipoSangGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  tipoSangBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  tipoSangBtnActive: { backgroundColor: Colors.redGlow, borderColor: Colors.red },
  tipoSangBtnText:   { fontSize: 15, fontWeight: '700', color: Colors.muted },
  tipoSangSelecionado: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
    borderRadius: 10, padding: 10,
  },
  tipoSangSelecionadoText: { flex: 1, fontSize: 12, color: Colors.muted },
  tipoSangJaConhece: {
    alignItems: 'center', padding: 12, borderRadius: 10, alignSelf: 'flex-start',
  },

  referencia: { fontSize: 11, color: Colors.muted, marginTop: 6, fontStyle: 'italic' },

  resultadoRow: { flexDirection: 'row', gap: 10 },
  resultadoBtn: {
    flex: 1, alignItems: 'center', gap: 6, padding: 12,
    backgroundColor: Colors.dark3, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  resultadoBtnText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  resultadoAviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(46,204,113,0.07)',
    borderWidth: 1, borderColor: 'rgba(46,204,113,0.2)',
    borderRadius: 10, padding: 10, marginTop: 10,
  },
  resultadoAvisoText: { flex: 1, fontSize: 12, lineHeight: 17 },

  btnRegistar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.red, borderRadius: 12,
    padding: 15, marginTop: 20,
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnRegistarText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  exameItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.dark3, borderRadius: 12,
    padding: 14, marginBottom: 8, borderLeftWidth: 3,
  },
  exameTipo:  { fontSize: 14, fontWeight: '700', color: Colors.white },
  exameValor: { fontSize: 13, color: Colors.white, marginTop: 3 },
  exameObs:   { fontSize: 12, color: Colors.muted, marginTop: 3, fontStyle: 'italic' },
  exameData:  { fontSize: 11, color: Colors.muted2, marginTop: 4 },
  exameResultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  exameResultText: { fontSize: 11, fontWeight: '700' },

  emptyBox: { alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 13, color: Colors.muted },
})
