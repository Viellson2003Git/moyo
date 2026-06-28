// app/(voluntario)/educacao.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, useWindowDimensions, Modal
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { SafeAreaView } from 'react-native-safe-area-context'
const ARTIGOS = [
  {
    id: '1', emoji: '🩸', categoria: 'Básico',
    titulo: 'O que é a doação de sangue?',
    resumo: 'Entenda o processo completo, desde a triagem até à coleta e como o seu sangue ajuda outros pacientes.',
    conteudo: `A doação de sangue é um procedimento voluntário e seguro onde uma pessoa doa parte do seu sangue para ser utilizado em transfusões médicas, cirurgias e tratamentos de doenças crónicas.\n\nO processo completo dura entre 45 minutos a 1 hora, mas a coleta em si leva apenas 10 a 15 minutos.\n\nO sangue doado é separado em componentes:\n\n• Glóbulos vermelhos — tratam anemia e perdas de sangue\n• Plaquetas — ajudam na coagulação em pacientes com cancro\n• Plasma — trata queimaduras, choque e coagulopatias\n\nUma única doação pode salvar até 3 vidas!`,
    cor: '#1a0408', corTexto: Colors.redSoft, leitura: '3 min',
  },
  {
    id: '2', emoji: '✅', categoria: 'Requisitos',
    titulo: 'Quem pode ser doador?',
    resumo: 'Requisitos de idade, peso, saúde e outros critérios para ser um doador apto no sistema angolano.',
    conteudo: `Para ser doador de sangue em Angola, precisas de cumprir os seguintes requisitos:\n\n✅ Ter entre 18 e 65 anos\n✅ Pesar mais de 50 kg\n✅ Estar em boas condições de saúde\n✅ Não ter doenças infecciosas\n✅ Ter dormido bem na noite anterior\n\n❌ Não podes doar se:\n• Tiveres febre ou infecção activa\n• Tiveres tomado antibióticos nos últimos 7 dias\n• Tiveres feito tatuagem há menos de 6 meses\n• Estiveres grávida ou a amamentar\n\nAs mulheres podem doar a cada 120 dias e os homens a cada 90 dias.`,
    cor: '#001020', corTexto: Colors.blue, leitura: '2 min',
  },
  {
    id: '3', emoji: '🧬', categoria: 'Ciência',
    titulo: 'Tipos sanguíneos explicados',
    resumo: 'A, B, AB, O — e os factores RH. Descobre o teu tipo e quem podes ajudar com a tua doação.',
    conteudo: `Os tipos sanguíneos são determinados pelos antígenos presentes nos glóbulos vermelhos.\n\n🔴 Tipo A — pode receber de A e O\n🔵 Tipo B — pode receber de B e O\n🟣 Tipo AB — recebe de todos (receptor universal)\n⚪ Tipo O — doa para todos (doador universal)\n\nO Fator RH (+ ou -) determina compatibilidades adicionais.\n\n🌟 O- é o mais valioso — pode ser dado a qualquer pessoa numa emergência!\n\nCompatibilidade básica:\n• O- → doa para todos\n• AB+ → recebe de todos\n• Tipo igual → sempre compatível`,
    cor: '#0a1500', corTexto: Colors.green, leitura: '3 min',
  },
  {
    id: '4', emoji: '💪', categoria: 'Preparação',
    titulo: 'Antes e depois de doar',
    resumo: 'O que comer, o que evitar e como cuidar do teu corpo antes e depois da doação de sangue.',
    conteudo: `ANTES DA DOAÇÃO:\n\n✅ Faz uma refeição leve 2-3 horas antes\n✅ Bebe bastante água (pelo menos 2 litros)\n✅ Dorme bem na noite anterior\n✅ Usa roupa de manga curta ou fácil de arregaçar\n\n❌ Evita:\n• Álcool nas 24h anteriores\n• Refeições muito gordurosas\n• Exercício físico intenso\n\nAPÓS A DOAÇÃO:\n\n✅ Descansa 10-15 minutos após a coleta\n✅ Bebe sumos e água\n✅ Faz um lanche com açúcar\n✅ Evita esforço físico por 6-8 horas\n\nO teu corpo repõe o volume de sangue em 24-48 horas e os glóbulos vermelhos em 4-6 semanas.`,
    cor: '#1a0a00', corTexto: Colors.gold, leitura: '3 min',
  },
  {
    id: '5', emoji: '❓', categoria: 'Mitos',
    titulo: 'Mitos e verdades',
    resumo: 'Desmistificando as dúvidas mais comuns sobre doação de sangue em Angola.',
    conteudo: `MITO: "A doação de sangue enfraquece o corpo"\n✅ VERDADE: O corpo recupera completamente em poucos dias.\n\nMITO: "Posso contrair doenças ao doar"\n✅ VERDADE: Todo o equipamento é descartável. É impossível contrair doenças.\n\nMITO: "Doadores de sangue ficam com menos sangue"\n✅ VERDADE: O volume total é reposto em 24-48 horas.\n\nMITO: "A doação demora horas"\n✅ VERDADE: A coleta leva apenas 10-15 minutos.\n\nMITO: "Diabéticos não podem doar"\n✅ VERDADE: Diabéticos controlados por dieta podem doar normalmente.`,
    cor: '#0d0020', corTexto: '#A855F7', leitura: '4 min',
  },
  {
    id: '6', emoji: '🏆', categoria: 'Impacto',
    titulo: 'Impacto da tua doação',
    resumo: 'Uma doação pode salvar até 3 vidas. Veja como o teu sangue é utilizado no hospital.',
    conteudo: `UMA DOAÇÃO = 3 VIDAS\n\nO sangue que doas é separado em 3 componentes, cada um com usos diferentes:\n\n🔴 Glóbulos Vermelhos (conservados até 42 dias)\n→ Tratam anemia grave, perdas de sangue em cirurgias\n\n🟡 Plaquetas (conservadas apenas 5 dias!)\n→ Essenciais para doentes com leucemia e cancro\n\n🔵 Plasma (conservado até 1 ano)\n→ Trata queimaduras, choque e problemas de coagulação\n\nNO NAMIBE:\n• O Hospital Ngola Kimbanda depende de doadores locais\n• As reservas devem ser renovadas a cada 6 semanas\n• Pacientes de cirurgias e maternidade são os principais beneficiários`,
    cor: '#00150a', corTexto: Colors.green, leitura: '3 min',
  },
]

export default function Educacao() {
  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 900
  const [artigoAberto, setArtigoAberto] = useState<typeof ARTIGOS[0] | null>(null)
  
  // Número de colunas do grid
  const numCols = isWeb ? 3 : 2

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {isWeb && <SidebarWeb />}
      <View style={s.main}>

        {/* Topbar */}
        <View style={[s.topbar]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Feather name="arrow-left" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>Educação</Text>
          <View style={{ flex: 1 }} />
          <View style={[s.topbarBadge, { backgroundColor: Colors.blue }]}>
            <Text style={s.topbarBadgeText}>PÚBLICO</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.content}>

            {/* Header section */}
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderTitle}>
                📚 Educação sobre Doação de Sangue
              </Text>
            </View>

            {/* Grid de artigos */}
            <View style={[s.grid, { }]}>
              {ARTIGOS.map((a, i) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    s.artigoCard,
                    { width: numCols === 3 ? '32%' : '48%' }
                  ]}
                  onPress={() => setArtigoAberto(a)}
                  activeOpacity={0.8}
                >
                  {/* Banner colorido */}
                  <View style={[s.artigoBanner, { backgroundColor: a.cor }]}>
                    <Text style={s.artigoEmoji}>{a.emoji}</Text>
                  </View>

                  {/* Corpo */}
                  <View style={s.artigoCorpo}>
                    <Text style={s.artigoTitulo}>{a.titulo}</Text>
                    <Text style={s.artigoResumo} numberOfLines={3}>{a.resumo}</Text>
                    <View style={s.artigoLerRow}>
                      <Text style={[s.artigoLerText, { color: a.corTexto }]}>
                        Ler artigo →
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: isWeb ? 40 : 100 }} />
          </View>
        </ScrollView>

        {!isWeb && <BottomNav />}
      </View>

      {/* Modal do artigo */}
      <Modal visible={!!artigoAberto} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalEmoji}>{artigoAberto?.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.modalCategoria}>{artigoAberto?.categoria}</Text>
                <Text style={s.modalTitulo}>{artigoAberto?.titulo}</Text>
              </View>
              <TouchableOpacity onPress={() => setArtigoAberto(null)} style={s.modalClose}>
                <Feather name="x" size={22} color={Colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={s.modalLeituraRow}>
              <Feather name="clock" size={12} color={Colors.muted} />
              <Text style={s.modalLeitura}>{artigoAberto?.leitura} de leitura</Text>
            </View>

            <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.modalConteudo}>{artigoAberto?.conteudo}</Text>
            </ScrollView>

            <TouchableOpacity
              style={s.modalBtn}
              onPress={() => {
                setArtigoAberto(null)
                router.push('/(auth)/cadastro' as any)
              }}
            >
              <Text style={s.modalBtnText}>🩸 Quero ser Doador</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

// ── Sidebar ─────────────────────────────
function SidebarWeb() {
  const items: { icon: keyof typeof Feather.glyphMap; label: string; route: string; active?: boolean }[] = [
    { icon: 'grid',        label: 'Dashboard', route: '/(voluntario)'            },
    { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'     },
    { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'    },
    { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico'  },
    { icon: 'activity',    label: 'Campanhas', route: '/(voluntario)/campanhas'  },
    { icon: 'users',       label: 'ONGs',      route: '/(voluntario)/ongs'       },
    { icon: 'book-open',   label: 'Educação',  route: '/(voluntario)/educacao', active: true },
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
      <TouchableOpacity style={s.sidebarLogout} onPress={async () => {
        const { supabase } = await import('../../lib/supabase')
        await supabase.auth.signOut()
        router.replace('/(auth)/login')
      }}>
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
        { icon: 'grid',        label: 'Início',    route: '/(voluntario)'            },
        { icon: 'credit-card', label: 'Cartão',    route: '/(voluntario)/cartao'     },
        { icon: 'calendar',    label: 'Agendar',   route: '/(voluntario)/agendar'    },
        { icon: 'clock',       label: 'Histórico', route: '/(voluntario)/historico'  },
        { icon: 'user',        label: 'Perfil',    route: '/(voluntario)/perfil'     },
      ] as any[]).map((n: any) => (
        <TouchableOpacity key={n.label} style={s.navItem} onPress={() => router.push(n.route)}>
          <Feather name={n.icon} size={20} color={Colors.muted} />
          <Text style={s.navLabel}>{n.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ── Estilos ─────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.dark, flexDirection: 'row' },
  main:    { flex: 1, flexDirection: 'column' },
  content: { padding: 20 },

  topbar: {
    height: 60, backgroundColor: Colors.dark2,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
  },
  topbarTitle:     { fontSize: 16, fontWeight: '700', color: Colors.white },
  topbarBadge:     { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  topbarBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.white, letterSpacing: 0.5 },

  sectionHeader:      { marginBottom: 20 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },

  artigoCard: {
    backgroundColor: Colors.dark2,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  artigoBanner: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artigoEmoji: { fontSize: 40 },
  artigoCorpo: { padding: 14 },
  artigoTitulo: {
    fontSize: 14, fontWeight: '700',
    color: Colors.white, marginBottom: 6, lineHeight: 20,
  },
  artigoResumo: {
    fontSize: 12, color: Colors.muted,
    lineHeight: 17, marginBottom: 12,
  },
  artigoLerRow: { flexDirection: 'row', alignItems: 'center' },
  artigoLerText: { fontSize: 12, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.dark2,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '88%',
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, marginBottom: 8,
  },
  modalEmoji:    { fontSize: 32 },
  modalCategoria:{ fontSize: 11, fontWeight: '700', color: Colors.muted, marginBottom: 3 },
  modalTitulo:   { fontSize: 18, fontWeight: '700', color: Colors.white },
  modalClose:    { padding: 4 },
  modalLeituraRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 16 },
  modalLeitura:  { fontSize: 12, color: Colors.muted },
  modalScroll:   { marginBottom: 16 },
  modalConteudo: { fontSize: 14, color: Colors.offWhite, lineHeight: 24 },
  modalBtn: {
    backgroundColor: Colors.red, borderRadius: 12,
    padding: 15, alignItems: 'center',
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },

  sidebar:           { width: 220, backgroundColor: Colors.dark2, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.05)', padding: 18, justifyContent: 'space-between' },
  sidebarLogo:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  sidebarLogoIcon:   { width: 34, height: 34, borderRadius: 9, backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText:   { fontSize: 17, fontWeight: '800', color: Colors.white },
  sidebarItem:       { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 9 },
  sidebarItemActive: { backgroundColor: Colors.redGlow },
  sidebarItemLabel:  { fontSize: 13, fontWeight: '500', color: Colors.muted },
  sidebarLogout:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  sidebarLogoutText: { fontSize: 13, color: Colors.muted },

  bottomNav: {
    flexDirection: 'row', backgroundColor: Colors.dark2,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, paddingTop: 10,
  },
  navItem:  { flex: 1, alignItems: 'center', gap: 3 },
  navLabel: { fontSize: 10, color: Colors.muted, fontWeight: '500' },
})