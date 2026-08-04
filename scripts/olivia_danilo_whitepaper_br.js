const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, LevelFormat, PageBreak, Footer, PageNumber,
} = require("docx");

// ── Palette (matches the Olivia brand system used across the project) ──
const GREEN_DARK = "3F6152";
const GREEN_MID  = "7FA98E";
const AMBER      = "D98A5E";
const CREAM      = "F2ECDE";
const INK        = "34302A";
const GRAY       = "6B6458";

const SERIF = "Georgia";
const SANS  = "Calibri";
const MONO  = "Consolas";

// ── Helpers ──
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 480, after: 200 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9CFB8", space: 6 } },
  children: [new TextRun({ text, bold: true, color: GREEN_DARK, font: SERIF, size: 30 })],
});

const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 280, after: 120 },
  children: [new TextRun({ text, bold: true, color: GREEN_MID, font: SERIF, size: 24 })],
});

const p = (text, opts = {}) => new Paragraph({
  spacing: { after: 180, line: 300 },
  children: [new TextRun({ text, font: SANS, size: 22, color: INK, italics: !!opts.italic })],
});

const pRuns = (runs, opts = {}) => new Paragraph({
  spacing: { after: opts.after ?? 180, line: 300 },
  children: runs.map(r => new TextRun({
    text: r.text, font: SANS, size: 22, color: r.color || INK,
    bold: !!r.bold, italics: !!r.italic,
  })),
});

const bullets = (items) => items.map(text => new Paragraph({
  numbering: { reference: "bullets", level: 0 },
  spacing: { after: 90, line: 280 },
  children: [new TextRun({ text, font: SANS, size: 22, color: INK })],
}));

const step = (label, desc) => new Paragraph({
  spacing: { after: 130, line: 280 },
  indent: { left: 260 },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: AMBER, space: 10 } },
  children: [
    new TextRun({ text: label, bold: true, color: GREEN_DARK, font: SANS, size: 22 }),
    new TextRun({ text: "  —  " + desc, font: SANS, size: 22, color: INK }),
  ],
});

const pullquote = (text) => new Paragraph({
  spacing: { before: 200, after: 260 },
  indent: { left: 360 },
  border: { left: { style: BorderStyle.SINGLE, size: 16, color: AMBER, space: 12 } },
  children: [new TextRun({ text, italics: true, font: SERIF, size: 26, color: GREEN_DARK })],
});

const callout = (label, text) => new Paragraph({
  shading: { type: ShadingType.CLEAR, fill: CREAM },
  spacing: { before: 160, after: 260 },
  indent: { left: 200, right: 200 },
  border: {
    left: { style: BorderStyle.SINGLE, size: 12, color: AMBER, space: 10 },
    top: { style: BorderStyle.SINGLE, size: 2, color: "E4DAC2", space: 8 },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: "E4DAC2", space: 8 },
    right: { style: BorderStyle.SINGLE, size: 2, color: "E4DAC2", space: 8 },
  },
  children: [
    new TextRun({ text: label + "  ", bold: true, italics: true, font: SANS, size: 21, color: GREEN_DARK }),
    new TextRun({ text, italics: true, font: SANS, size: 21, color: INK }),
  ],
});

const kicker = (text) => new Paragraph({
  spacing: { after: 200 },
  children: [new TextRun({ text, bold: true, font: MONO, size: 18, color: AMBER })],
});

// ── Cover note, addressed directly to Danilo ──
const coverNote = [
  kicker("OLIVIA  ·  NOTA PARA O DANILO"),
  new Paragraph({
    spacing: { after: 260 },
    children: [new TextRun({ text: "Danilo,", font: SERIF, size: 30, color: GREEN_DARK })],
  }),
  p("Isso aqui é uma nova versão do material sobre o ecossistema de aprendizagem da Olivia. A primeira versão foi escrita pensando em hospitalidade — dessa vez, generalizamos a lógica para qualquer setor, porque a ideia central não depende do segmento em que ela é aplicada."),
  p("Você atua e investe em setores bem diferentes entre si — consultoria, logística, tecnologia, marketing, hospitalidade — e isso te dá um ponto de vista que poucas pessoas têm: a capacidade de julgar, na prática, se uma estrutura como essa realmente se sustenta fora de um nicho específico, ou se é só um discurso que soa bem no papel."),
  p("Não tem outro interesse por trás desse pedido além de ouvir sua opinião com sinceridade — onde faz sentido, onde não faz, o que está fraco, o que sobra. Fica à vontade pra ser direto."),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({ text: "Obrigado desde já.", font: SANS, size: 22, color: INK })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Title block ──
const titleBlock = [
  kicker("OLIVIA  ·  WHITE PAPER"),
  new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({ text: "Olivia — Ecossistema de Aprendizagem no Trabalho", bold: true, font: SERIF, size: 50, color: GREEN_DARK })],
  }),
  new Paragraph({
    spacing: { after: 420 },
    children: [new TextRun({ text: "Um Novo Modelo Operacional de Trabalho, Para Qualquer Setor", italics: true, font: SERIF, size: 28, color: GREEN_MID })],
  }),
  pullquote("O futuro do trabalho não se constrói substituindo pessoas por IA. Se constrói dando a cada colaborador a confiança, o espaço e as ferramentas para melhorar como o trabalho é feito."),
  new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun({ text: "Preparado para Danilo Drigo  ·  Agosto de 2026", font: MONO, size: 18, color: GRAY })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Body sections ──
const body = [
  h1("Resumo Executivo"),
  p("Toda organização — seja uma operação de logística, uma consultoria, um time de tecnologia, uma agência de marketing ou um negócio de hospitalidade — depende de milhares de pequenas decisões operacionais tomadas todos os dias, por pessoas em praticamente todas as áreas: operação, atendimento, supervisão, gestão, marketing, compras, financeiro e liderança."),
  p("Mas as pessoas mais próximas dessas decisões raramente têm uma oportunidade estruturada de experimentar, inovar ou desenvolver competência digital como parte do trabalho que já fazem. O treinamento acontece em outro lugar, na agenda de outra pessoa, desconectado do problema que está na frente delas."),
  p("A Olivia propõe um modelo diferente. Em vez de introduzir IA como mais uma plataforma para adotar, a Olivia cria um ecossistema contínuo de aprendizagem no trabalho, onde cada colaborador pode explorar ideias com segurança, construir soluções práticas e contribuir para melhorar o negócio — dentro do trabalho que já realiza."),
  p("O objetivo não é implementar inteligência artificial. O objetivo é construir inteligência organizacional. Conforme os colaboradores aprendem, colaboram e resolvem problemas operacionais reais, a organização captura esse conhecimento continuamente, aprimora seus processos e se torna mais resiliente ao longo do tempo."),

  h1("Da Adoção de IA à Inteligência Organizacional"),
  p("A maioria das organizações começa perguntando: \u201cComo implementamos IA?\u201d A Olivia começa com uma pergunta diferente: \u201cComo ajudamos as pessoas a melhorar o trabalho que elas já fazem?\u201d"),
  p("A inteligência artificial é só uma parte dessa resposta. A verdadeira transformação vem de construir um ambiente onde a experimentação é incentivada, o conhecimento é compartilhado e as melhorias se tornam permanentes \u2014 em vez de irem embora com o colaborador que teve a ideia. Cada problema resolvido passa a fazer parte da memória coletiva da organização, disponível para a próxima pessoa que enfrentar a mesma situação."),

  h1("A Filosofia da Olivia"),
  p("A Olivia é construída em torno de um ciclo contínuo, repetido por cada colaborador, em cada função, enquanto fizer parte da organização."),
  step("Aprender", "construir conhecimento prático por meio de experiência guiada e mão na massa, não de teoria em sala de aula."),
  step("Construir", "aplicar esse conhecimento a um problema operacional real, não hipotético."),
  step("Compartilhar", "disponibilizar uma solução funcional para colegas e outras unidades."),
  step("Aprimorar", "deixar que outras pessoas adaptem, refinem e estendam a solução para o próprio contexto."),
  step("Medir", "acompanhar a mudança em relação a um resultado de negócio real, não a atividade."),
  step("Crescer", "capturar o que foi aprendido, e recomeçar o ciclo."),
  p("O ciclo não tem linha de chegada. Cada volta deixa a organização um pouco mais inteligente do que na anterior."),
  callout("Na prática:", "um analista de logística encontra uma forma mais rápida de consolidar cargas fracionadas. Ele documenta o método, outra unidade adota, um gestor adapta para uma rota diferente, e em poucos meses virou o padrão de toda a operação. Em uma consultoria, um analista júnior organiza um jeito melhor de estruturar entregáveis para o cliente \u2014 e o time inteiro passa a usar. Ninguém decidiu \u201cusar IA\u201d. Alguém resolveu um problema real de terça-feira à tarde, e a Olivia levou a resposta para quem tinha o mesmo problema."),

  h1("Aprendizagem Integrada ao Trabalho do Dia a Dia"),
  p("O treinamento tradicional tira o colaborador do trabalho. A Olivia faz o oposto \u2014 coloca o aprendizado dentro do ritmo da operação: alguns minutos antes de uma reunião, depois do expediente, durante um tempo de desenvolvimento programado, ou em casa, explorando uma ideia em um ambiente seguro."),
  p("Em vez de um curso teórico, o colaborador aprende resolvendo um problema que importa para a própria função. Na prática, isso já apareceu como:"),
  ...bullets([
    "otimizar o controle de estoque ou de ativos",
    "reduzir desperdício ou retrabalho",
    "comparar fornecedores",
    "simplificar passagens de turno ou handovers de projeto",
    "estruturar conteúdo de marketing",
    "transformar feedback de cliente em um painel de indicadores",
  ]),
  p("O aprendizado é prático, imediato e pertence a quem o construiu."),

  h1("Créditos de Aprendizagem, Não Limites de Uso"),
  p("Cada colaborador recebe uma conta pessoal na Olivia. Em vez de medir o uso como se fosse consumo de API, a Olivia oferece Créditos de Aprendizagem que incentivam a exploração em vez de restringi-la. Os créditos permitem:"),
  ...bullets([
    "fazer perguntas e experimentar com segurança",
    "concluir um módulo de aprendizagem guiado",
    "construir um fluxo de trabalho prático",
    "participar de um desafio interno",
  ]),
  p("Gestores podem adicionar créditos extras para reconhecer inovação, colaboração ou uma ideia genuinamente boa. O objetivo nunca foi o consumo. O objetivo é o aprendizado contínuo."),

  h1("Gamificação com Propósito"),
  p("Gamificação só faz sentido se reforça um comportamento que realmente importa \u2014 não atividade pela atividade. A Olivia reconhece colaboradores que resolvem problemas operacionais reais, colaboram entre áreas, documentam o que funcionou, orientam colegas e medem o resultado."),
  p("O reconhecimento assume um formato familiar \u2014 selos de competência, marcos, desafios entre unidades ou áreas, indicações entre pares \u2014 mas o alvo por trás disso é sempre o mesmo: uma competição saudável que aproxima times, em vez de opor indivíduos."),

  h1("As Três Árvores da Olivia"),
  p("O crescimento acontece em três níveis interligados, e cada um fortalece os outros."),
  h2("Árvore Pessoal"),
  p("A jornada de aprendizagem de um colaborador: as competências que construiu, as trilhas que concluiu, quem já orientou, o que já contribuiu de volta."),
  h2("Árvore de Time"),
  p("A colaboração de uma área: fluxos compartilhados, capacitação cruzada, e a consistência operacional que vem de um time resolvendo problemas juntos, em vez de isoladamente."),
  h2("Árvore da Organização"),
  p("A inteligência coletiva da empresa: fluxos validados, práticas documentadas, e as automações e melhorias que permanecem além do tempo de qualquer pessoa na organização."),
  p("Conforme cada árvore cresce, as outras crescem junto."),

  h1("O Conhecimento Vira um Ativo"),
  p("Setores com alta rotatividade \u2014 operação, vendas, suporte, hospitalidade, linha de frente em geral \u2014 perdem conhecimento toda vez que alguém sai."),
  p("A Olivia muda isso. Os fluxos, procedimentos, prompts, relatórios e aprendizados conquistados na prática por um colaborador permanecem \u2014 disponíveis para quem assumir a função depois. O conhecimento deixa de pertencer só ao indivíduo e passa a fazer parte da capacidade de longo prazo da organização. O aprendizado vira um ativo permanente do negócio, não um ativo pessoal."),

  h1("Marketplace de Fluxos"),
  p("Colaboradores são incentivados a compartilhar o que funciona. Um fluxo de compras construído em uma unidade pode melhorar as aquisições em todo o grupo. Uma automação de marketing criada por um time pode virar o padrão de todas as outras equipes."),
  p("Cada contribuição pode ser reaproveitada, aprimorada, adaptada para um contexto diferente e medida em relação ao resultado para o qual foi criada. A inovação se espalha horizontalmente, entre times, em vez de depender só de iniciativas de cima para baixo."),

  h1("Desenvolvimento Prático de Competências"),
  p("O aprendizado permanece ancorado em problemas reais de negócio:"),
  ...bullets([
    "compras assistidas por IA",
    "gestão de estoque e de ativos",
    "sustentabilidade e redução de desperdício",
    "análise da experiência do cliente",
    "planejamento de força de trabalho",
  ]),
  p("Cada trilha combina aprendizado guiado com aplicação prática, e avaliações opcionais reconhecem o que a pessoa realmente fez, não o que ela estudou. Com o tempo, o colaborador constrói um Passaporte de Competências da Olivia \u2014 um registro portátil de experiência prática que ajuda a carreira dele e, enquanto ele está lá, ajuda o negócio que o formou."),

  h1("Medindo Sucesso"),
  p("A Olivia é avaliada por resultados operacionais, não por quanto de IA foi usado. Os indicadores que importam: desperdício ou retrabalho, erros operacionais, tempo de onboarding, retenção de talentos, colaboração entre áreas, reaproveitamento de fluxos, engajamento e satisfação do cliente."),
  p("A pergunta nunca é \u201cquanto usamos de IA?\u201d. A pergunta é \u201co quanto a organização melhorou?\u201d"),
  p("Nada disso é prometido no primeiro dia. Um piloto precisa observar como um time realmente trabalha antes de dizer o que vai mudar, e quanto. O que a Olivia oferece de início é a estrutura para descobrir isso \u2014 não um número para citar antes de qualquer teste real.", { italic: true }),

  h1("Maturidade Organizacional"),
  p("A implementação avança por cinco estágios, em ordem:"),
  step("Explorar", "os colaboradores ficam confortáveis para experimentar."),
  step("Aplicar", "cada pessoa resolve desafios específicos da própria função."),
  step("Compartilhar", "soluções que funcionam se espalham de time para time."),
  step("Medir", "a melhoria de negócio se torna visível e comprovável."),
  step("Crescer", "o aprendizado contínuo se estabelece na cultura, em vez de rodar ao lado dela como um programa à parte."),
  p("Isso dá à liderança um roteiro prático para uma transformação medida em temporadas, não em sprints."),

  h1("Alinhamento com Linhas de Fomento"),
  p("O modelo da Olivia está na interseção de várias prioridades de fomento ao mesmo tempo: desenvolvimento de força de trabalho, inclusão digital, adoção de IA, produtividade de PMEs, aprendizado contínuo, sustentabilidade e desenvolvimento econômico regional."),
  p("Como combina adoção de tecnologia, desenvolvimento de pessoas, melhoria operacional e resiliência organizacional em um único programa, ele pode se qualificar para mais de uma linha de fomento ao mesmo tempo. Além de identificar as oportunidades, a Olivia pode pesquisar elegibilidade, ajudar a preparar as evidências, redigir as candidaturas e acompanhar os programas relevantes para o setor e a localização de cada organização."),

  h1("Por Que Isso Importa"),
  p("Inteligência artificial sozinha não transforma uma organização. Pessoas transformam. A tecnologia só se torna valiosa quando ajuda pessoas a resolver problemas que importam, trabalhar melhor juntas e construir conhecimento que dura mais do que elas."),
  p("A Olivia cria as condições para isso \u2014 um ambiente seguro onde qualquer pessoa, da operação à liderança, pode contribuir com uma ideia, construir uma competência prática e melhorar a forma como o trabalho é feito."),
  p("O resultado não é simplesmente um time que sabe usar IA. É uma organização que continua aprendendo, continua melhorando, e mantém o conhecimento que constrói muito depois de qualquer colaborador ter seguido em frente."),
  pRuns([{ text: "O maior valor que a Olivia cria nunca foi a tecnologia. É a cultura de curiosidade, experimentação e inteligência compartilhada que a tecnologia torna possível.", italic: true, color: GREEN_DARK, bold: true }], { after: 200 }),
];

const doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u2022",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 560, hanging: 300 } } },
      }],
    }],
  },
  styles: {
    default: {
      document: { run: { font: SANS, size: 22, color: INK } },
      heading1: { run: { font: SERIF, bold: true, size: 30, color: GREEN_DARK } },
      heading2: { run: { font: SERIF, bold: true, size: 24, color: GREEN_MID } },
    },
  },
  sections: [{
    properties: {},
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Olivia \u2014 Ecossistema de Aprendizagem no Trabalho   \u00b7   ", font: MONO, size: 15, color: GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: MONO, size: 15, color: GRAY }),
          ],
        })],
      }),
    },
    children: [...coverNote, ...titleBlock, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  require("fs").writeFileSync("./olivia-white-paper-pt-danilo.docx", buf);
  console.log("written");
});