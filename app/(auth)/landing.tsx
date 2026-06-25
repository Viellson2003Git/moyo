// app/(auth)/landing.tsx
import { useRef, useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, useWindowDimensions, Animated, ScrollView
} from 'react-native'
import { router } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Image } from 'react-native'

export default function Landing() {
  const [modalAberto, setModalAberto] = useState<string | null>(null)
  const [modalVideo, setModalVideo]   = useState(false)

  const { width } = useWindowDimensions()
  const isWeb = Platform.OS === 'web' && width > 768

  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(24)).current
 
  const [showProvSel, setShowProvSel]     = useState(false)

  
  const ARTIGOS_EDUCACAO = [
    {
      id: '1',
      emoji: '🩸',
      titulo: 'Quem pode doar sangue?',
      resumo: 'Tens entre 18 e 65 anos, peso acima de 50kg e boa saúde? Podes ser doador. Descobre todos os critérios.',
      cor: Colors.red,
      bg: 'rgba(232,23,58,0.08)',
      tempo: '3 min',
      tag: 'Elegibilidade',
    },
    {
      id: '2',
      emoji: '💉',
      titulo: 'O que acontece no dia da doação?',
      resumo: 'Do registo ao lanche final — um guia passo a passo para saberes exactamente o que esperar.',
      cor: Colors.blue,
      bg: 'rgba(74,158,255,0.08)',
      tempo: '5 min',
      tag: 'Processo',
    },
    {
      id: '3',
      emoji: '🥗',
      titulo: 'O que comer antes de doar?',
      resumo: 'Hidrata-te bem, evita gorduras e faz uma refeição leve. Os detalhes que fazem a diferença.',
      cor: Colors.green,
      bg: 'rgba(46,204,113,0.08)',
      tempo: '2 min',
      tag: 'Preparação',
    },
    {
      id: '4',
      emoji: '❤️‍🩹',
      titulo: 'Mitos e verdades sobre a doação',
      resumo: '"Dói muito", "fica fraco uma semana" — desvendamos os mitos mais comuns sobre doar sangue.',
      cor: Colors.gold,
      bg: 'rgba(232,180,75,0.08)',
      tempo: '4 min',
      tag: 'Desmistificar',
    },
  ]

  // ── TABELA DE COMPATIBILIDADE ──
  const COMPATIBILIDADE = [
    { tipo: 'O-',  doa: ['O-','O+','A-','A+','B-','B+','AB-','AB+'], recebe: ['O-'],                           cor: '#E8173A' },
    { tipo: 'O+',  doa: ['O+','A+','B+','AB+'],                       recebe: ['O-','O+'],                       cor: '#FF4D6D' },
    { tipo: 'A-',  doa: ['A-','A+','AB-','AB+'],                      recebe: ['O-','A-'],                       cor: '#4A9EFF' },
    { tipo: 'A+',  doa: ['A+','AB+'],                                  recebe: ['O-','O+','A-','A+'],             cor: '#74B4FF' },
    { tipo: 'B-',  doa: ['B-','B+','AB-','AB+'],                      recebe: ['O-','B-'],                       cor: '#2ECC71' },
    { tipo: 'B+',  doa: ['B+','AB+'],                                  recebe: ['O-','O+','B-','B+'],             cor: '#58D68D' },
    { tipo: 'AB-', doa: ['AB-','AB+'],                                 recebe: ['O-','A-','B-','AB-'],            cor: '#F39C12' },
    { tipo: 'AB+', doa: ['AB+'],                                       recebe: ['O-','O+','A-','A+','B-','B+','AB-','AB+'], cor: '#F8C471' },
  ]


  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <View style={s.root}>
      <View style={s.bgGlow1} />
      <View style={s.bgGlow2} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Navbar */}
        <View style={s.navbar}>
          <Text style={s.navLogo}>
            {'MO'}
            <Text style={{ color: Colors.redSoft }}>{'YO'}</Text>
          </Text>
          <View style={s.navRight}>
            {isWeb && (
              <TouchableOpacity onPress={() => router.push('/(auth)/emergencia' as any)} style={s.navEmergencia}>
                <View style={s.navEmergenciaDot} />
                <Text style={s.navEmergenciaText}>{'Preciso de sangue'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.navEntrar} onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={s.navEntrarText}>{'Entrar'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* YO */}
        <Animated.View style={[s.YO, isWeb && s.YOWeb, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          <View style={[s.YOLeft, isWeb && s.YOLeftWeb]}>
            <View style={s.YOBadge}>
              <View style={s.YOBadgeDot} />
              <Text style={s.YOBadgeText}>{'Hospital Ngola Kimbanda · Namibe'}</Text>
            </View>

          

            <Text style={[s.YOTitle, isWeb && s.YOTitleWeb]}>
              {'Doe sangue.\n'}
              <Text style={s.YOTitleRed}>{'Salve vidas.'}</Text>
            </Text>

            <Text style={[s.YOSub, isWeb && s.YOSubWeb]}>
              {'A plataforma digital de gestão de doações do Hospital Ngola Kimbanda. Gratuito, seguro e com impacto real na comunidade.'}
            </Text>

            <View style={[s.YOBtns, isWeb && { flexDirection: 'row' }]}>
              <TouchableOpacity style={s.btnPrimary} onPress={() => router.push('/(auth)/cadastro' as any)}>
                <Text style={s.btnPrimaryText}>{'🩸 Quero Ser Doador'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnGhost} onPress={() => router.push('/(auth)/login' as any)}>
                <Text style={s.btnGhostText}>{'Já tenho conta →'}</Text>
              </TouchableOpacity>
            </View>
            

            <View style={s.stats}>
              <StatItem value="3x" label="vidas por doação" />
              <View style={s.statDiv} />
              <StatItem value="0kz" label="custo para o doador" />
              <View style={s.statDiv} />
              <StatItem value="90d" label="entre doações" />
            </View>
          </View>

          {/* Card flutuante — web */}
          {isWeb && (
            <View style={s.YORight}>
              <View style={s.floatCard}>
                <View style={s.floatCardHeader}>
                  <Text style={s.floatCardLogo}>
                    {'MO'}
                    <Text style={{ color: Colors.redSoft }}>{'YO'}</Text>
                  </Text>
                  <View style={s.floatCardVerif}>
                    <Text style={s.floatCardVerifText}>{'✓ VERIFICADO'}</Text>
                  </View>
                </View>
                <Text style={s.floatCardMO}>{'A+'}</Text>
                <Text style={s.floatCardMOSub}>{'Tipo A · Fator RH Positivo'}</Text>
                <View style={s.floatCardLine} />
                <Text style={s.floatCardLabel}>{'NOME COMPLETO'}</Text>
                <Text style={s.floatCardValue}>{'João Mateus Silva'}</Text>
                <Text style={[s.floatCardLabel, { marginTop: 10 }]}>{'SERIAL'}</Text>
                <Text style={[s.floatCardValue, { color: Colors.redSoft, fontFamily: 'monospace' }]}>
                  {'MY-2026-000001'}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Features */}
        <View style={[s.section, isWeb && s.sectionWeb]}>
          <Text style={s.sectionBadge}>{'FUNCIONALIDADES'}</Text>
          <Text style={s.sectionTitle}>{'Tudo o que precisas'}</Text>
          <View style={[s.featGrid, isWeb && s.featGridWeb]}>
            {FUNCIONALIDADES.map(f => (
              <TouchableOpacity
                key={f.id}
                style={s.featCard}
                onPress={() => setModalAberto(f.id)}
                activeOpacity={0.7}
              >
                <View style={[s.featIcon, { backgroundColor: f.color + '18' }]}>
                  <Feather name={f.icon} size={20} color={f.color} />
                </View>
                <Text style={s.featTitle}>{f.title}</Text>
                <Text style={s.featDesc}>{f.desc}</Text>
                <View style={s.featSaibaMais}>
                  <Text style={s.featSaibaMaisText}>Saber mais</Text>
                  <Feather name="arrow-right" size={11} color={f.color} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Como usar o Moyo — vídeo */}
        <View style={[s.section, isWeb && s.sectionWeb]}>
          <TouchableOpacity
            style={s.videoCard}
            onPress={() => setModalVideo(true)}
            activeOpacity={0.85}
          >
            <View style={s.videoGlow} />
            <View style={s.videoPlayBtn}>
              <Feather name="play" size={22} color={Colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.videoTitle}>{'Como usar o Moyo'}</Text>
              <Text style={s.videoSub}>{'Vê um vídeo curto sobre como funciona toda a plataforma'}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </TouchableOpacity>
        </View>

       
        {/* ── SECÇÃO EDUCAÇÃO ── */}
        <View style={[s.section, isWeb && s.sectionWeb]}>
          <View style={s.sectionBadge}>
            <Text style={s.sectionBadge}>📚 EDUCAÇÃO</Text>
          </View>
          <Text style={s.sectionTitle}>Tudo o que precisas de saber</Text>
          <Text style={s.sectionSub}>Artigos curtos e claros sobre doação de sangue</Text>

          <View style={[s.educGrid, isWeb && s.educGridWeb]}>
            {ARTIGOS_EDUCACAO.map(a => (
              <TouchableOpacity
                key={a.id}
                style={[s.educCard, { borderColor: a.cor + '30' }]}
                onPress={() => router.push('/(auth)/login' as any)}
                activeOpacity={0.8}
              >
                <View style={[s.educCardIcon, { backgroundColor: a.bg }]}>
                  <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
                </View>
                <View style={[s.educTag, { backgroundColor: a.bg }]}>
                  <Text style={[s.educTagText, { color: a.cor }]}>{a.tag}</Text>
                  <Text style={s.educTempo}>⏱ {a.tempo}</Text>
                </View>
                <Text style={s.educTitulo}>{a.titulo}</Text>
                <Text style={s.educResumo}>{a.resumo}</Text>
                <View style={s.educLerMais}>
                  <Text style={[s.educLerMaisText, { color: a.cor }]}>Ler mais</Text>
                  <Feather name="arrow-right" size={13} color={a.cor} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── SECÇÃO COMPATIBILIDADE SANGUÍNEA ── */}
        <View style={[s.section, s.compatSection, isWeb && s.sectionWeb]}>
          <View style={s.sectionBadge}>
            <Text style={s.sectionBadge}>🔬 CIÊNCIA</Text>
          </View>
          <Text style={s.sectionTitle}>Compatibilidade Sanguínea</Text>
          <Text style={s.sectionSub}>
            Descobre quem podes ajudar com a tua dádiva
          </Text>

          <View style={s.compatGrid}>
            {COMPATIBILIDADE.map(c => (
              <View key={c.tipo} style={[s.compatCard, { borderColor: c.cor + '40' }]}>
                {/* Tipo */}
                <View style={[s.compatTipoBadge, { backgroundColor: c.cor + '18' }]}>
                  <Text style={[s.compatTipo, { color: c.cor }]}>{c.tipo}</Text>
                </View>

                {/* Doa para */}
                <View style={s.compatSection2}>
                  <Text style={s.compatLabel}>
                    <Feather name="arrow-up-right" size={11} color={Colors.green} /> Doa para
                  </Text>
                  <View style={s.compatTags}>
                    {c.doa.map(t => (
                      <View key={t} style={[s.compatTag, { backgroundColor: 'rgba(46,204,113,0.1)' }]}>
                        <Text style={[s.compatTagText, { color: Colors.green }]}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Recebe de */}
                <View style={s.compatSection2}>
                  <Text style={s.compatLabel}>
                    <Feather name="arrow-down-left" size={11} color={Colors.blue} /> Recebe de
                  </Text>
                  <View style={s.compatTags}>
                    {c.recebe.map(t => (
                      <View key={t} style={[s.compatTag, { backgroundColor: 'rgba(74,158,255,0.1)' }]}>
                        <Text style={[s.compatTagText, { color: Colors.blue }]}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Destaque doador universal */}
                {c.tipo === 'O-' && (
                  <View style={s.universalBadge}>
                    <Text style={s.universalText}>⭐ Doador Universal</Text>
                  </View>
                )}
                {c.tipo === 'AB+' && (
                  <View style={[s.universalBadge, { backgroundColor: 'rgba(248,196,113,0.15)', borderColor: Colors.gold + '40' }]}>
                    <Text style={[s.universalText, { color: Colors.gold }]}>👑 Receptor Universal</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={s.compatDica}>
            <Feather name="info" size={14} color={Colors.blue} />
            <Text style={s.compatDicaText}>
              O grupo <Text style={{ color: Colors.redSoft, fontWeight: '700' }}>O-</Text> é o doador universal — o seu sangue é compatível com qualquer pessoa. O grupo <Text style={{ color: Colors.gold, fontWeight: '700' }}>AB+</Text> pode receber de todos os tipos.
            </Text>
          </View>
        </View>

        {/* Urgência */}
        <View style={s.urgSection}>
          <View style={s.urgGlow} />
          <Text style={s.urgBadge}>{'🚨 PEDIDO URGENTE ACTIVO'}</Text>
          <Text style={s.urgTitle}>
            {'O Namibe precisa\nde ti agora.'}
          </Text>
          <Text style={s.urgSub}>
            {'Qualquer pessoa pode enviar um alerta de emergência para doadores compatíveis.'}
          </Text>
          <TouchableOpacity style={s.urgBtn} onPress={() => router.push('/(auth)/emergencia' as any)}>
            <Text style={s.urgBtnText}>{'🩸 Pedir Sangue Urgente'}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerLogo}>
            {'MO'}
            <Text style={{ color: Colors.redSoft }}>{'YO'}</Text>
          </Text>
          <Text style={s.footerSub}>
            {'Hospital Ngola Kimbanda · Namibe, Angola'}
          </Text>
          <View style={s.footerLinks}>
            <FooterLink label="Entrar"       onPress={() => router.push('/(auth)/login' as any)} />
            <FooterLink label="Cadastrar"    onPress={() => router.push('/(auth)/cadastro' as any)} />
            <FooterLink label="Registar ONG" onPress={() => router.push('/(auth)/registar-ong' as any)} />
            <FooterLink label="Emergência"   onPress={() => router.push('/(auth)/emergencia' as any)} />
          </View>
          <Text style={s.footerCopy}>{'© 2026 Moyo · Doe sangue. Salve vidas.'}</Text>
        </View>

      </ScrollView>
      {/* Modal de funcionalidade */}
{modalAberto && (
  <TouchableOpacity
    style={s.modalOverlay}
    activeOpacity={1}
    onPress={() => setModalAberto(null)}
  >
    <View style={s.modalCard} onStartShouldSetResponder={() => true}>
      {(() => {
        const f = FUNCIONALIDADES.find(x => x.id === modalAberto)!
        return (
          <>
            <View style={s.modalHeader}>
              <View style={[s.modalIcon, { backgroundColor: f.color + '18' }]}>
                <Feather name={f.icon} size={26} color={f.color} />
              </View>
              <TouchableOpacity onPress={() => setModalAberto(null)} style={s.modalCloseBtn}>
                <Feather name="x" size={18} color={Colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={s.modalTitle}>{f.title}</Text>
            <Text style={s.modalExplicacao}>{f.explicacao}</Text>
            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: f.color }]}
              onPress={() => { setModalAberto(null); router.push('/(auth)/cadastro' as any) }}
            >
              <Text style={s.modalBtnText}>Criar conta e experimentar</Text>
            </TouchableOpacity>
          </>
        )
      })()}
    </View>
  </TouchableOpacity>
)}

{/* Modal de vídeo */}
{modalVideo && (
  <TouchableOpacity
    style={s.modalOverlay}
    activeOpacity={1}
    onPress={() => setModalVideo(false)}
  >
    <View style={[s.modalCard, s.modalCardVideo]} onStartShouldSetResponder={() => true}>
      <View style={s.modalHeader}>
        <Text style={s.modalTitle}>{'Como usar o Moyo'}</Text>
        <TouchableOpacity onPress={() => setModalVideo(false)} style={s.modalCloseBtn}>
          <Feather name="x" size={18} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      {Platform.OS === 'web' ? (
        <video
          controls
          autoPlay
          style={{ width: '100%', borderRadius: 12, backgroundColor: '#000' } as any}
          src="https://SEU-LINK-DO-VIDEO-AQUI.mp4"
        />
      ) : (
        <View style={s.videoPlaceholderMobile}>
          <Feather name="film" size={40} color={Colors.muted2} />
          <Text style={{ color: Colors.muted, fontSize: 13, marginTop: 10 }}>
            Reprodução de vídeo disponível no web por agora
          </Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
)}
    </View>
  )
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function FeatCard({ icon, title, desc, color }: { icon: keyof typeof Feather.glyphMap; title: string; desc: string; color: string }) {
  return (
    <View style={s.featCard}>
      <View style={[s.featIcon, { backgroundColor: color + '18' }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={s.featTitle}>{title}</Text>
      <Text style={s.featDesc}>{desc}</Text>
    </View>
  )
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text style={s.footerLink}>{label}</Text>
    </TouchableOpacity>
  )
}

const FUNCIONALIDADES = [
  {
    id: 'cartao',
    icon: 'credit-card' as const,
    title: 'Cartão Digital',
    desc: 'QR Code único sempre disponível.',
    color: Colors.red,
    explicacao: 'O teu cartão digital tem um QR Code único associado ao teu número de série. Sempre que fores doar, basta apresentares o QR ao enfermeiro para check-in instantâneo — sem papéis, sem filas longas. Está sempre acessível na app, mesmo offline.',
  },
  {
    id: 'agendamento',
    icon: 'calendar' as const,
    title: 'Agendamento',
    desc: 'Marca doações online facilmente.',
    color: Colors.blue,
    explicacao: 'Escolhe o hospital, o dia e a hora que melhor te convém. Vês a disponibilidade de vagas em tempo real e recebes lembretes antes da tua doação. Podes cancelar ou remarcar a qualquer momento pela app.',
  },
  {
    id: 'alertas',
    icon: 'bell' as const,
    title: 'Alertas',
    desc: 'Notificações do teu tipo sanguíneo.',
    color: Colors.gold,
    explicacao: 'Quando alguém precisa urgentemente do teu tipo sanguíneo na tua região, recebes uma notificação imediata. Podes aceitar ajudar com um simples toque — o teu contacto só é partilhado depois de confirmares.',
  },
  {
    id: 'ongs',
    icon: 'users' as const,
    title: 'ONGs',
    desc: 'Junta-te a organizações parceiras.',
    color: Colors.green,
    explicacao: 'Explora ONGs activas na tua província, vê a sua missão e adere para participar em campanhas conjuntas. As ONGs no Moyo passam por verificação legal — garantindo organizações de confiança.',
  },
  {
    id: 'educacao',
    icon: 'book-open' as const,
    title: 'Educação',
    desc: 'Aprende tudo sobre doação de sangue.',
    color: '#A855F7',
    explicacao: 'Artigos curtos e claros sobre tipos sanguíneos, o que esperar no dia da doação, cuidados antes e depois, e mitos comuns desfeitos. Tudo pensado para te dares confiança antes da tua primeira doação.',
  },
  {
    id: 'seguro',
    icon: 'shield' as const,
    title: 'Seguro',
    desc: 'Dados protegidos. 100% gratuito.',
    color: Colors.blue,
    explicacao: 'Os teus dados pessoais e de saúde são protegidos com encriptação. O Moyo nunca cobra nada aos doadores — todo o processo, desde o registo até à doação, é completamente gratuito.',
  },
]

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.dark },
  bgGlow1: { position: 'absolute', top: -120, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: 'rgba(232,23,58,0.07)' },
  bgGlow2: { position: 'absolute', top: 300, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(74,158,255,0.05)' },

  navbar:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 16 },
  navLogo:             { fontSize: 20, fontWeight: '800', color: Colors.white },
  navRight:            { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navEmergencia:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(232,23,58,0.1)', borderWidth: 1, borderColor: 'rgba(232,23,58,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  navEmergenciaDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.red },
  navEmergenciaText:   { fontSize: 12, fontWeight: '600', color: Colors.redSoft },
  navEntrar:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  navEntrarText:       { fontSize: 13, fontWeight: '600', color: Colors.white },

  YO:        { padding: 24, paddingTop: 16, paddingBottom: 40 },
  YOWeb:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 60, paddingVertical: 64, gap: 40 },
  YOLeft:    { flex: 1 },
  YOLeftWeb: { maxWidth: 520 },

  YOBadge:    { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 20, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  YOBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  YOBadgeText:{ fontSize: 11, color: Colors.muted, fontWeight: '500' },

  YOTitle:    { fontSize: 38, fontWeight: '800', color: Colors.white, lineHeight: 46, marginBottom: 16 },
  YOTitleWeb: { fontSize: 52, lineHeight: 62 },
  YOTitleRed: { color: Colors.redSoft, fontStyle: 'italic' },
  YOSub:      { fontSize: 15, color: Colors.muted, lineHeight: 24, marginBottom: 28 },
  YOSubWeb:   { fontSize: 16 },

  YOBtns:    { gap: 10, marginBottom: 32 },
  btnPrimary:  { backgroundColor: Colors.red, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', shadowColor: Colors.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  btnGhost:    { borderRadius: 14, paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  btnGhostText:{ fontSize: 14, fontWeight: '600', color: Colors.white },

  stats:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statValue:{ fontSize: 20, fontWeight: '800', color: Colors.redSoft, marginBottom: 2, textAlign: 'center' },
  statLabel:{ fontSize: 10, color: Colors.muted, textAlign: 'center' },
  statDiv:  { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },

  YORight:     { flex: 1, alignItems: 'center' },
  floatCard:     { backgroundColor: '#1a0408', borderRadius: 20, padding: 22, width: 260, borderWidth: 1, borderColor: 'rgba(232,23,58,0.3)', shadowColor: Colors.red, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  floatCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  floatCardLogo:   { fontSize: 14, fontWeight: '800', color: Colors.white },
  floatCardVerif:  { backgroundColor: 'rgba(46,204,113,0.15)', borderWidth: 1, borderColor: 'rgba(46,204,113,0.3)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  floatCardVerifText: { fontSize: 8, fontWeight: '700', color: Colors.green, letterSpacing: 0.5 },
  floatCardMO:  { fontSize: 46, fontWeight: '800', color: Colors.redSoft, lineHeight: 50, marginBottom: 4 },
  floatCardMOSub: { fontSize: 11, color: Colors.muted, marginBottom: 16 },
  floatCardLine:   { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  floatCardLabel:  { fontSize: 8, fontWeight: '700', color: Colors.muted2, letterSpacing: 0.8, marginBottom: 3 },
  floatCardValue:  { fontSize: 13, fontWeight: '600', color: Colors.white },

  section:     { padding: 24, paddingVertical: 44 },
  sectionWeb:  { paddingHorizontal: 60, paddingVertical: 56 },
  sectionDark: { backgroundColor: Colors.dark2, padding: 24, paddingVertical: 44 },
  sectionBadge:{ fontSize: 10, fontWeight: '800', color: Colors.redSoft, letterSpacing: 2, marginBottom: 10 },
  sectionTitle:{ fontSize: 26, fontWeight: '800', color: Colors.white, lineHeight: 34, marginBottom: 10 },
  sectionSub:  { fontSize: 13, color: Colors.muted, lineHeight: 20, marginBottom: 24 },

  featGrid:    { gap: 10 },
  featGridWeb: { flexDirection: 'row', flexWrap: 'wrap' },
  featCard:    { backgroundColor: Colors.dark2, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 2, ...(Platform.OS === 'web' ? { width: '31%' } : {}) },
  featIcon:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  featTitle:   { fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 5 },
  featDesc:    { fontSize: 12, color: Colors.muted, lineHeight: 17 },

  artigosRow:  { gap: 10 },
  artigoCard:  { backgroundColor: Colors.dark, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', flex: 1 },
  artigoEmoji: { fontSize: 28, marginBottom: 10 },
  artigoTitulo:{ fontSize: 14, fontWeight: '700', color: Colors.white, marginBottom: 5 },
  artigoSub:   { fontSize: 12, color: Colors.muted, marginBottom: 10 },
  artigoLer:   { fontSize: 12, fontWeight: '700', color: Colors.redSoft },

  urgSection: { backgroundColor: '#6B0000', padding: 32, position: 'relative', overflow: 'hidden' },
  urgGlow:    { position: 'absolute', top: -60, right: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(232,23,58,0.3)' },
  urgBadge:   { fontSize: 11, fontWeight: '800', color: 'rgba(255,150,150,0.9)', letterSpacing: 1.5, marginBottom: 14 },
  urgTitle:   { fontSize: 28, fontWeight: '800', color: Colors.white, lineHeight: 36, marginBottom: 12 },
  urgSub:     { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20, marginBottom: 24 },
  urgBtn:     { backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, alignSelf: 'flex-start' },
  urgBtnText: { fontSize: 14, fontWeight: '700', color: Colors.dark },

  footer:      { backgroundColor: Colors.dark2, padding: 28, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  footerLogo:  { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  footerSub:   { fontSize: 12, color: Colors.muted, marginBottom: 18 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 16 },
  footerLink:  { fontSize: 12, color: Colors.muted },
  footerCopy:  { fontSize: 10, color: Colors.muted2 },
  provBtn: {
  flexDirection: 'row', alignItems: 'center', gap: 8,
  backgroundColor: 'rgba(232,23,58,0.08)',
  borderWidth: 1, borderColor: 'rgba(232,23,58,0.2)',
  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
},
provBtnText: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.white },
provDropdown: {
  backgroundColor: Colors.dark2, borderRadius: 12, marginTop: 6,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  overflow: 'hidden',
},
provItem: {
  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  padding: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
},
provItemActive: { backgroundColor: Colors.redGlow },
provItemNome:   { fontSize: 13, fontWeight: '600', color: Colors.white },
provItemCapital:{ fontSize: 11, color: Colors.muted },
provInfo: {
  flexDirection: 'row', alignItems: 'center', gap: 6,
  marginTop: 8, paddingHorizontal: 4,
},
provInfoText: { fontSize: 11, color: Colors.muted },

featSaibaMais: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
featSaibaMaisText: { fontSize: 11, fontWeight: '700', color: Colors.muted },

videoCard: {
  flexDirection: 'row', alignItems: 'center', gap: 16,
  backgroundColor: Colors.dark2, borderRadius: 18, padding: 20,
  borderWidth: 1, borderColor: 'rgba(232,23,58,0.15)',
  position: 'relative', overflow: 'hidden',
},
videoGlow: {
  position: 'absolute', top: -40, right: -40,
  width: 140, height: 140, borderRadius: 70,
  backgroundColor: 'rgba(232,23,58,0.1)',
},
videoPlayBtn: {
  width: 52, height: 52, borderRadius: 26,
  backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
  shadowColor: Colors.red, shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
},
videoTitle: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 4 },
videoSub:   { fontSize: 12, color: Colors.muted },

modalOverlay: {
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  alignItems: 'center', justifyContent: 'center',
  padding: 24, zIndex: 999,
},
modalCard: {
  backgroundColor: Colors.dark2, borderRadius: 22,
  padding: 26, width: '100%', maxWidth: 420,
  borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
},
modalCardVideo: { maxWidth: 600 },
modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
modalIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
modalCloseBtn: { padding: 6 },
modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.white, marginBottom: 12 },
modalExplicacao: { fontSize: 14, color: Colors.muted, lineHeight: 22, marginBottom: 22 },
modalBtn: { borderRadius: 12, padding: 15, alignItems: 'center' },
modalBtnText: { fontSize: 14, fontWeight: '700', color: Colors.white },
videoPlaceholderMobile: { alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: Colors.dark3, borderRadius: 12 },

// Educação
educGrid: { gap: 14 },
educGridWeb: { flexDirection: 'row', flexWrap: 'wrap' },
educCard: {
  backgroundColor: Colors.dark2, borderRadius: 16, padding: 18,
  borderWidth: 1,
  ...(Platform.OS === 'web' ? { width: '48%' } : {}),
},
educCardIcon: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
educTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 10, gap: 10 },
educTagText: { fontSize: 11, fontWeight: '700' },
educTempo: { fontSize: 10, color: Colors.muted },
educTitulo: { fontSize: 15, fontWeight: '700', color: Colors.white, marginBottom: 8, lineHeight: 21 },
educResumo: { fontSize: 13, color: Colors.muted, lineHeight: 19, marginBottom: 12 },
educLerMais: { flexDirection: 'row', alignItems: 'center', gap: 5 },
educLerMaisText: { fontSize: 13, fontWeight: '700' },

// Compatibilidade
compatSection: { backgroundColor: Colors.dark2 },
compatGrid: {
  flexDirection: 'row', flexWrap: 'wrap',
  gap: 10, marginTop: 8,
},
compatCard: {
  backgroundColor: Colors.dark3, borderRadius: 14, padding: 14,
  borderWidth: 1,
  width: Platform.OS === 'web' ? '23%' : '47%',
  minWidth: 150,
},
compatTipoBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 12 },
compatTipo: { fontSize: 22, fontWeight: '900' },
compatSection2: { marginBottom: 10 },
compatLabel: { fontSize: 10, color: Colors.muted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
compatTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
compatTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
compatTagText: { fontSize: 11, fontWeight: '700' },
universalBadge: {
  backgroundColor: 'rgba(232,23,58,0.12)', borderWidth: 1, borderColor: 'rgba(232,23,58,0.3)',
  borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 6,
},
universalText: { fontSize: 11, fontWeight: '700', color: Colors.redSoft, textAlign: 'center' },
compatDica: {
  flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  backgroundColor: 'rgba(74,158,255,0.07)',
  borderWidth: 1, borderColor: 'rgba(74,158,255,0.2)',
  borderRadius: 12, padding: 14, marginTop: 16,
},
compatDicaText: { flex: 1, fontSize: 13, color: Colors.muted, lineHeight: 19 },
})