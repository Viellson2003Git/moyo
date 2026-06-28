// data/artigos.ts

export type Artigo = {
  id: string
  emoji: string
  titulo: string
  resumo: string
  cor: string
  bg: string
  tempo: string
  tag: string
  videoUrl?: string // adiciona quando tiveres o vídeo
  seccoes: {
    tipo: 'intro' | 'topicos' | 'aviso' | 'lista' | 'dica'
    titulo?: string
    conteudo?: string
    items?: string[]
  }[]
}

export const ARTIGOS: Artigo[] = [
  {
    id: 'quem-pode-doar',
    emoji: '🩸',
    titulo: 'Quem pode doar sangue?',
    resumo: 'Tens entre 18 e 65 anos, peso acima de 50kg e boa saúde? Podes ser doador.',
    cor: '#E8173A',
    bg: 'rgba(232,23,58,0.08)',
    tempo: '3 min',
    tag: 'Elegibilidade',
    videoUrl: undefined, // adiciona depois: 'https://youtube.com/...'
    seccoes: [
      {
        tipo: 'intro',
        conteudo: 'Doar sangue é um acto simples que pode salvar até 3 vidas por cada doação. Mas há alguns critérios básicos de saúde e segurança que precisas de cumprir.',
      },
      {
        tipo: 'topicos',
        titulo: '✅ Podes doar se...',
        items: [
          'Tens entre 18 e 65 anos de idade',
          'Pesas mais de 50 kg',
          'Te sentes bem e saudável no dia da doação',
          'Dormiste pelo menos 6 horas na noite anterior',
          'Não doaste sangue há mais de 60 dias (homens) ou 90 dias (mulheres)',
          'Não tomaste medicamentos nos últimos 3 dias (salvo excepções)',
        ],
      },
      {
        tipo: 'topicos',
        titulo: '❌ Não podes doar se...',
        items: [
          'Estás grávida ou amamentaste nos últimos 3 meses',
          'Tiveste febre ou gripe nas últimas 2 semanas',
          'Fizeste tatuagem ou piercing nos últimos 6 meses',
          'Tiveste malária nos últimos 3 anos',
          'Tomaste antibióticos nos últimos 7 dias',
          'Tiveste relações sexuais de risco nos últimos 12 meses',
        ],
      },
      {
        tipo: 'aviso',
        conteudo: 'Se tens dúvidas sobre se podes ou não doar, o enfermeiro no Hospital Ngola Kimbanda avalia o teu caso gratuitamente antes da doação.',
      },
      {
        tipo: 'dica',
        titulo: '💡 Sabia que...',
        conteudo: 'Em Angola, apenas 1% da população doa sangue regularmente. A OMS recomenda pelo menos 2% para garantir reservas suficientes nos hospitais.',
      },
    ],
  },
  {
    id: 'dia-da-doacao',
    emoji: '💉',
    titulo: 'O que acontece no dia da doação?',
    resumo: 'Do registo ao lanche final — um guia passo a passo.',
    cor: '#4A9EFF',
    bg: 'rgba(74,158,255,0.08)',
    tempo: '5 min',
    tag: 'Processo',
    videoUrl: undefined,
    seccoes: [
      {
        tipo: 'intro',
        conteudo: 'O processo completo de doação de sangue no Hospital Ngola Kimbanda demora entre 45 minutos a 1 hora. Aqui está o que vais encontrar passo a passo.',
      },
      {
        tipo: 'lista',
        titulo: '📋 O processo passo a passo',
        items: [
          '🏥 Chegada e registo — Mostra o teu QR Code do Moyo na recepção e recebes a tua senha',
          '📋 Triagem — Um enfermeiro avalia o teu peso, pressão arterial e hemoglobina (10 min)',
          '🩸 Determinação do tipo sanguíneo — Se não conheces o teu tipo, é determinado neste momento (gratuito)',
          '📝 Questionário — Respondes a perguntas simples sobre a tua saúde recente',
          '💉 Doação — A colheita de sangue em si demora apenas 8 a 12 minutos',
          '🧃 Recuperação — Descansas 10–15 minutos e recebes um lanche e sumo',
        ],
      },
      {
        tipo: 'dica',
        titulo: '💡 Dica importante',
        conteudo: 'A agulha usada é sempre nova e estéril — é descartada imediatamente após a tua doação. Não há risco de infecção.',
      },
      {
        tipo: 'aviso',
        conteudo: 'Após a doação, evita esforços físicos intensos nas próximas 12 horas. Bebe bastante água e come normalmente.',
      },
    ],
  },
  {
    id: 'antes-da-doacao',
    emoji: '🥗',
    titulo: 'O que comer antes de doar?',
    resumo: 'Hidrata-te bem, evita gorduras e faz uma refeição leve.',
    cor: '#2ECC71',
    bg: 'rgba(46,204,113,0.08)',
    tempo: '2 min',
    tag: 'Preparação',
    videoUrl: undefined,
    seccoes: [
      {
        tipo: 'intro',
        conteudo: 'O que comes nas horas antes da doação afecta directamente a qualidade do sangue doado e o teu bem-estar durante e após a doação.',
      },
      {
        tipo: 'topicos',
        titulo: '✅ Come e bebe antes de doar',
        items: [
          'Bebe pelo menos 2–3 copos de água ou sumo nas 2 horas antes',
          'Faz uma refeição leve: arroz, peixe cozido, legumes, fruta',
          'Come iogurte ou cereais se fores de manhã',
          'Pão, ovos mexidos e chá também são boas opções',
        ],
      },
      {
        tipo: 'topicos',
        titulo: '❌ Evita nas 4 horas antes',
        items: [
          'Alimentos gordurosos — frango frito, carne com muita gordura, batata frita',
          'Refrigerantes e bebidas energéticas',
          'Café em excesso (1 chávena está ok)',
          'Álcool — deve ser evitado pelo menos 24 horas antes',
          'Não doas em jejum — isso pode causar tonturas',
        ],
      },
      {
        tipo: 'dica',
        titulo: '💡 Porque é que a gordura importa?',
        conteudo: 'Alimentos muito gordurosos deixam o plasma do sangue leitoso (lipémico), o que pode inutilizar a doação para certos pacientes. Uma refeição leve garante sangue de maior qualidade.',
      },
    ],
  },
  {
    id: 'mitos-verdades',
    emoji: '❤️‍🩹',
    titulo: 'Mitos e verdades sobre a doação',
    resumo: 'Desvendamos os mitos mais comuns sobre doar sangue.',
    cor: '#F39C12',
    bg: 'rgba(243,156,18,0.08)',
    tempo: '4 min',
    tag: 'Desmistificar',
    videoUrl: undefined,
    seccoes: [
      {
        tipo: 'intro',
        conteudo: 'Muitas pessoas evitam doar sangue por causa de ideias erradas. Vamos desfazer os mitos mais comuns de uma vez por todas.',
      },
      {
        tipo: 'lista',
        titulo: '🔍 Mitos vs. Realidade',
        items: [
          '❌ MITO: "Dói muito" → ✅ VERDADE: Sentes apenas uma pequena picada durante a inserção da agulha. A maioria das pessoas descreve como menos doloroso do que uma análise ao sangue normal.',
          '❌ MITO: "Fico fraco durante semanas" → ✅ VERDADE: O teu corpo repõe o volume de sangue em 24–48 horas. Muitos doadores voltam ao trabalho no mesmo dia.',
          '❌ MITO: "Posso apanhar doenças a doar" → ✅ VERDADE: Usamos apenas material estéril de uso único. É impossível apanhar qualquer doença ao DOAR sangue.',
          '❌ MITO: "Não tenho sangue suficiente para dar" → ✅ VERDADE: O adulto médio tem 5–6 litros de sangue. Colhemos apenas 450ml — menos de 10% do total.',
          '❌ MITO: "Diabéticos não podem doar" → ✅ VERDADE: Diabéticos controlados sem insulina podem doar. Cada caso é avaliado individualmente.',
          '❌ MITO: "Faz engordar ou emagrecer" → ✅ VERDADE: A doação de sangue não tem qualquer efeito no peso corporal.',
        ],
      },
      {
        tipo: 'dica',
        titulo: '💡 O impacto real',
        conteudo: 'Uma única doação de 450ml pode salvar até 3 vidas diferentes — porque o sangue é separado em 3 componentes: glóbulos vermelhos, plaquetas e plasma — cada um usado em tratamentos diferentes.',
      },
    ],
  },
]