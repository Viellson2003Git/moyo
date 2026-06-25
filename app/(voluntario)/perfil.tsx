// app/(voluntario)/perfil.tsx
import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform,
  useWindowDimensions, Alert, TextInput
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/colors'
import { limparTelefoneLembrado } from '../../utils/session'

export default function Perfil() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [editMode, setEditMode] = useState(false)

  const [nome, setNome]         = useState('')
  const [telefone, setTelefone] = useState('')
  const [morada, setMorada]     = useState('')
  const [email, setEmail]       = useState('')
  const [serial, setSerial]     = useState('')
  const [tipo, setTipo]         = useState('')
  const [estado, setEstado]     = useState('')
  const [profileId, setProfileId]     = useState('')
  const [voluntarioId, setVoluntarioId] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/(auth)/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('id, nome, email, telefone')
      .eq('id', user.id).single()

    const { data: vol } = await supabase
      .from('voluntarios')
      .select('id, numero_serial, tipo_sanguineo, estado, morada')
      .eq('profile_id', user.id).single()

    if (prof) {
      setProfileId(prof.id)
      setNome(prof.nome || '')
      setEmail(prof.email || '')
      setTelefone(prof.telefone || '')
    }
    if (vol) {
      setVoluntarioId(vol.id)
      setSerial(vol.numero_serial || '')
      setTipo(vol.tipo_sanguineo || '')
      setEstado(vol.estado || '')
      setMorada(vol.morada || '')
    }
    setLoading(false)
  }

  async function handleSalvar() {
    setSaving(true)
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('profiles').update({ nome, telefone }).eq('id', profileId),
      supabase.from('voluntarios').update({ morada }).eq('id', voluntarioId),
    ])
    if (!e1 && !e2) {
      Alert.alert('✅ Perfil actualizado!')
      setEditMode(false)
    } else {
      Alert.alert('Erro', e1?.message || e2?.message)
    }
    setSaving(false)
  }

 
    async function handleLogout() {
  await supabase.auth.signOut()
  await limparTelefoneLembrado()
  router.replace('/(auth)/landing' as any)
  }

  const estadoMap: Record<string, { label: string; color: string; bg: string }> = {
    pendente:     { label: 'Pendente ⏳',  color: Colors.gold,    bg: 'rgba(232,180,75,0.15)'  },
    em_exame:     { label: 'Em Exame 🔬', color: Colors.blue,    bg: 'rgba(74,158,255,0.15)'  },
    apto:         { label: 'Apto ✓',      color: Colors.green,   bg: 'rgba(46,204,113,0.15)'  },
    inapto_temp:  { label: 'Inapto ⚠️',   color: Colors.gold,    bg: 'rgba(232,180,75,0.15)'  },
    inapto_perm:  { label: 'Inapto ❌',   color: Colors.redSoft, bg: 'rgba(232,23,58,0.15)'   },
  }
  const estadoCfg = estadoMap[estado] || estadoMap['pendente']

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.red} /></View>
  )

  return (
    <View style={s.root}>
      {isWeb && <SidebarWeb />}
      <View style={s.main}>

        <View style={s.topbar}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>Meu Perfil</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => editMode ? handleSalvar() : setEditMode(true)}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <>
                  <Feather name={editMode ? 'check' : 'edit-2'} size={14} color={Colors.white} />
                  <Text style={s.editBtnText}>{editMode ? 'Guardar' : 'Editar'}</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.content}>

            {/* Avatar */}
            <View style={s.avatarSection}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{nome.slice(0,2).toUpperCase()}</Text>
              </View>
              <Text style={s.avatarNome}>{nome}</Text>
              <Text style={s.avatarEmail}>{email}</Text>
              <View style={[s.estadoBadge, { backgroundColor: estadoCfg.bg }]}>
                <Text style={[s.estadoBadgeText, { color: estadoCfg.color }]}>{estadoCfg.label}</Text>
              </View>
            </View>

            {/* Info doador */}
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>Informações de Doador</Text>
              <View style={s.infoGrid}>
                <InfoItem icon="hash"      label="Número Serial" value={serial || '—'} valueColor={Colors.redSoft} mono />
                <InfoItem icon="droplet"   label="Tipo Sanguíneo" value={tipo || 'A confirmar'} valueColor={tipo ? Colors.redSoft : Colors.muted} />
                <InfoItem icon="shield"    label="Estado" value={estadoCfg.label} valueColor={estadoCfg.color} />
                <InfoItem icon="plus-square" label="Hospital" value="Ngola Kimbanda, Namibe" />
                <TouchableOpacity
                style={s.actionRow}
                onPress={() => router.push('/(voluntario)/solicitante' as any)}
              >
                <Feather name="heart" size={16} color={Colors.redSoft} />
                <Text style={[s.actionRowText, { color: Colors.redSoft }]}>Modo Solicitante</Text>
                <Feather name="chevron-right" size={16} color={Colors.muted2} />
              </TouchableOpacity>
              </View>
            </View>

            {/* Dados pessoais */}
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>Dados Pessoais</Text>

              <Text style={s.fieldLabel}>NOME COMPLETO</Text>
              {editMode ? (
                <TextInput style={s.input} value={nome} onChangeText={setNome} placeholderTextColor={Colors.muted2} />
              ) : (
                <Text style={s.fieldValue}>{nome}</Text>
              )}

              <Text style={s.fieldLabel}>EMAIL</Text>
              <Text style={[s.fieldValue, { color: Colors.muted }]}>{email}</Text>

              <Text style={s.fieldLabel}>TELEFONE</Text>
              {editMode ? (
                <TextInput style={s.input} value={telefone} onChangeText={setTelefone} placeholder="+244 9XX XXX XXX" placeholderTextColor={Colors.muted2} keyboardType="phone-pad" />
              ) : (
                <Text style={s.fieldValue}>{telefone || '—'}</Text>
              )}

              <Text style={s.fieldLabel}>MORADA</Text>
              {editMode ? (
                <TextInput style={s.input} value={morada} onChangeText={setMorada} placeholder="Namibe, Angola" placeholderTextColor={Colors.muted2} />
              ) : (
                <Text style={s.fieldValue}>{morada || '—'}</Text>
              )}
            </View>

            {/* Acções da conta */}
            <View style={s.infoCard}>
              <Text style={s.infoCardTitle}>Conta</Text>

              <TouchableOpacity
                style={s.actionRow}
                onPress={() => router.push('/(voluntario)/cartao' as any)}
              >
                <Feather name="credit-card" size={16} color={Colors.muted} />
                <Text style={s.actionRowText}>Ver Cartão Digital</Text>
                <Feather name="chevron-right" size={16} color={Colors.muted2} />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.actionRow}
                onPress={() => router.push('/(voluntario)/historico' as any)}
              >
                <Feather name="clock" size={16} color={Colors.muted} />
                <Text style={s.actionRowText}>Histórico de Doações</Text>
                <Feather name="chevron-right" size={16} color={Colors.muted2} />
              </TouchableOpacity>

              <TouchableOpacity style={[s.actionRow, { borderBottomWidth: 0 }]} onPress={handleLogout}>
                <Feather name="log-out" size={16} color={Colors.redSoft} />
                <Text style={[s.actionRowText, { color: Colors.redSoft }]}>Terminar Sessão</Text>
                <Feather name="chevron-right" size={16} color={Colors.muted2} />
              </TouchableOpacity>
            </View>

            {/* Versão */}
            <Text style={s.version}>Moyo v1.0.0 · Hospital Ngola Kimbanda</Text>

            <View style={{ height: isWeb ? 40 : 100 }} />
          </View>
        </ScrollView>

        {!isWeb && <BottomNav />}
      </View>
    </View>
  )
}

function InfoItem({ icon, label, value, valueColor, mono }: {
  icon: keyof typeof Feather.glyphMap
  label: string; value: string
  valueColor?: string; mono?: boolean
}) {
  return (
    <View style={s.infoItem}>
      <Feather name={icon} size={13} color={Colors.muted} style={{ marginBottom: 4 }} />
      <Text style={s.infoItemLabel}>{label}</Text>
      <Text style={[s.infoItemValue, valueColor ? { color: valueColor } : {}, mono ? { fontFamily: 'monospace', fontSize: 12 } : {}]}>
        {value}
      </Text>
    </View>
  )
}

function SidebarWeb() {
  const items: { icon: keyof typeof Feather.glyphMap; label: string; route: string; active?: boolean }[] = [
    { icon: 'grid',        label: 'Dashboard', route: '/(voluntario)'           },
    { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'    },
    { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'   },
    { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico' },
    { icon: 'activity',    label: 'Campanhas', route: '/(voluntario)/campanhas' },
    { icon: 'users',       label: 'ONGs',      route: '/(voluntario)/ongs'      },
    { icon: 'book-open',   label: 'Educação',  route: '/(voluntario)/educacao'  },
  ]
  return (
    <View style={s.sidebar}>
      <View>
        <View style={s.sidebarLogo}>
          <View style={s.sidebarLogoIcon}>
            <Text style={{ color: Colors.white, fontWeight: '800', fontSize: 15 }}>B</Text>
          </View>
          <Text style={s.sidebarLogoText}>MO<Text style={{ color: Colors.redSoft }}>YO</Text></Text>
        </View>
        <View style={{ gap: 3 }}>
          {items.map(n => (
            <TouchableOpacity key={n.label} style={[s.sidebarItem, n.active && s.sidebarItemActive]} onPress={() => router.push(n.route as any)}>
              <Feather name={n.icon} size={15} color={n.active ? Colors.redSoft : Colors.muted} />
              <Text style={[s.sidebarItemLabel, n.active && { color: Colors.redSoft }]}>{n.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={s.sidebarLogout} onPress={async () => { await supabase.auth.signOut(); router.replace('/(auth)/login') }}>
        <Feather name="log-out" size={15} color={Colors.muted} />
        <Text style={s.sidebarLogoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  )
}

function BottomNav() {
  return (
    <View style={s.bottomNav}>
      {([
        { icon: 'grid',        label: 'Início',    route: '/(voluntario)'           },
        { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'    },
        { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'   },
        { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico' },
        { icon: 'user',        label: 'Perfil',    route: '/(voluntario)/perfil', active: true },
      ] as any[]).map((n: any) => (
        <TouchableOpacity key={n.label} style={s.navItem} onPress={() => router.push(n.route)}>
          <Feather name={n.icon} size={20} color={n.active ? Colors.redSoft : Colors.muted} />
          <Text style={[s.navLabel, n.active && { color: Colors.redSoft }]}>{n.label}</Text>
        </TouchableOpacity>
      ))}
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
  topbarTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.red, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  avatarSection: { alignItems: 'center', marginBottom: 20, paddingVertical: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  avatarText:  { fontSize: 28, fontWeight: '800', color: Colors.white },
  avatarNome:  { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 4 },
  avatarEmail: { fontSize: 13, color: Colors.muted, marginBottom: 12 },
  estadoBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  estadoBadgeText: { fontSize: 13, fontWeight: '700' },

  infoCard: {
    backgroundColor: Colors.dark2, borderRadius: 16,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  infoCardTitle: { fontSize: 13, fontWeight: '700', color: Colors.muted, marginBottom: 16, letterSpacing: 0.5 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoItem: { flex: 1, minWidth: '45%' },
  infoItemLabel: { fontSize: 10, color: Colors.muted2, marginBottom: 3, fontWeight: '600', letterSpacing: 0.5 },
  infoItemValue: { fontSize: 14, fontWeight: '600', color: Colors.white },

  fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.muted, letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  fieldValue: { fontSize: 14, fontWeight: '500', color: Colors.white, paddingVertical: 4 },
  input: {
    backgroundColor: Colors.dark3, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    padding: 12, fontSize: 14, color: Colors.white,
  },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  actionRowText: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.white },

  version: { textAlign: 'center', fontSize: 11, color: Colors.muted2, marginTop: 8 },

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