const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ShadingType, LevelFormat, PageBreak, Footer, PageNumber,
} = require("docx");

// ── Palette (matches the Olivia / Dean Banks brand system) ──
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

// Paragraph built from mixed runs, e.g. bold lead-in + plain description
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

// A step in a process list: bold label — description, with a thin amber rule on the left
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

// ── Title block ──
const titleBlock = [
  new Paragraph({
    spacing: { after: 200 },
    children: [new TextRun({ text: "OLIVIA  ·  WHITE PAPER", bold: true, font: MONO, size: 18, color: AMBER })],
  }),
  new Paragraph({
    spacing: { after: 140 },
    children: [new TextRun({ text: "Ecossistema de Aprendizagem no Local de Trabalho Olivia", bold: true, font: SERIF, size: 56, color: GREEN_DARK })],
  }),
  new Paragraph({
    spacing: { after: 420 },
    children: [new TextRun({ text: "Um Novo Modelo Operacional para a Hotelaria", italics: true, font: SERIF, size: 30, color: GREEN_MID })],
  }),
  pullquote("O futuro da hotelaria não se constrói substituindo pessoas por IA. Constrói‑se dando a cada colaborador a confiança, o espaço e as ferramentas para melhorar a forma como o trabalho é feito."),
  new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun({ text: "Preparado por Olivia  ·  Agosto de 2026", font: MONO, size: 18, color: GRAY })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Body sections ──
const body = [
  h1("Resumo Executivo"),
  p("A hotelaria é um dos setores mais dinâmicos e centrados nas pessoas que existem. O seu sucesso assenta em milhares de pequenas decisões operacionais tomadas todos os dias — por chefs, bartenders, empregados de mesa, supervisores, gerentes, equipas de marketing, compras, finanças e liderança."),
  p("No entanto, as pessoas mais próximas dessas decisões raramente têm uma oportunidade estruturada para experimentar, inovar ou desenvolver competências digitais como parte do seu trabalho normal. A formação acontece noutro lugar, no horário de outra pessoa, desligada do problema que têm à frente."),
  p("A Olivia propõe um modelo diferente. Em vez de introduzir a IA como mais uma plataforma a adotar, a Olivia cria um ecossistema contínuo de aprendizagem no local de trabalho, onde cada colaborador pode explorar ideias em segurança, construir soluções práticas e contribuir para melhorar o negócio — dentro do trabalho que já realiza."),
  p("O objetivo não é implementar inteligência artificial. O objetivo é construir inteligência organizacional. À medida que os colaboradores aprendem, colaboram e resolvem problemas operacionais reais, a organização captura continuamente esse conhecimento, melhora os seus processos e torna‑se mais resiliente ao longo do tempo."),

  h1("Da Adoção de IA à Inteligência Organizacional"),
  p("A maioria das organizações começa por perguntar: \u201cComo implementamos a IA?\u201d A Olivia parte de uma pergunta diferente: \u201cComo ajudamos as pessoas a melhorar o trabalho que já fazem?\u201d"),
  p("A inteligência artificial é apenas uma parte dessa resposta. A verdadeira transformação vem da criação de um ambiente onde a experimentação é encorajada, o conhecimento é partilhado e as melhorias se tornam permanentes — em vez de desaparecerem com o colaborador que as idealizou. Cada problema resolvido passa a fazer parte da memória coletiva da organização, disponível para a próxima pessoa que o enfrentar."),

  h1("A Filosofia Olivia"),
  p("A Olivia baseia‑se num ciclo contínuo, repetido por cada colaborador, em qualquer função, durante todo o tempo em que fizer parte da organização."),
  step("Aprender", "construir conhecimento prático através de experiência guiada e hands‑on, e não de teoria de sala de aula."),
  step("Construir", "aplicar esse conhecimento a um problema operacional real, não hipotético."),
  step("Partilhar", "disponibilizar uma solução funcional aos colegas e a outras unidades."),
  step("Melhorar", "permitir que outros a adaptem, refinem e expandam para o seu próprio contexto."),
  step("Medir", "acompanhar a mudança face a um resultado de negócio concreto, e não à atividade."),
  step("Crescer", "capturar o que foi aprendido e recomeçar o ciclo."),
  p("O ciclo não tem linha de chegada. Cada passagem por ele deixa a organização um pouco mais inteligente do que a anterior.", { }),
  callout("Na prática:", "um bartender que descobre uma forma mais rápida de contar o stock não poupa apenas vinte minutos a si próprio. Documenta a solução, outra unidade adota‑a, um gerente adapta‑a para um layout de bar diferente e, numa temporada, torna‑se o padrão pelo qual todo o grupo conta o stock. Ninguém se propôs “fazer IA”. Alguém resolveu um problema de uma tarde de terça‑feira, e a Olivia levou a resposta a todos os outros que tinham o mesmo problema."),

  h1("Aprendizagem Integrada no Trabalho Diário"),
  p("A formação tradicional afasta os colaboradores do seu trabalho. A Olivia faz o oposto — coloca a aprendizagem dentro do ritmo da hotelaria: alguns minutos de calma antes do serviço, após o fecho, durante o tempo de desenvolvimento programado, ou em casa, a explorar uma ideia num ambiente seguro."),
  p("Em vez de um curso teórico, os colaboradores aprendem resolvendo um problema que interessa à sua própria função. Na prática, isso tem incluído:"),
  ...bullets([
    "melhorar o inventário de stock",
    "analisar o desperdício alimentar",
    "comparar fornecedores",
    "simplificar a passagem de turno",
    "criar conteúdos de marketing",
    "transformar o feedback dos hóspedes num painel de relatórios",
  ]),
  p("A aprendizagem é prática, imediata e pertence a quem a realizou."),

  h1("Créditos de Aprendizagem, Não Limites de Utilização"),
  p("Cada colaborador recebe uma conta Olivia pessoal. Em vez de a medir como se de um consumo de API se tratasse, a Olivia atribui a cada pessoa Créditos de Aprendizagem que incentivam a exploração, em vez de a restringirem. Os créditos permitem:"),
  ...bullets([
    "fazer perguntas e experimentar em segurança",
    "concluir um módulo de aprendizagem guiada",
    "construir um fluxo de trabalho prático",
    "participar num desafio do local de trabalho",
  ]),
  p("Os gestores podem adicionar créditos para reconhecer inovação, colaboração ou uma ideia genuinamente boa. O objetivo nunca foi o consumo. O objetivo é a aprendizagem contínua."),

  h1("Gamificação com Propósito"),
  p("A gamificação só se justifica se reforçar comportamentos que realmente importam — e não a atividade por si só. A Olivia recompensa os colaboradores por resolverem problemas operacionais reais, colaborarem entre departamentos, documentarem o que funcionou, orientarem colegas e medirem o resultado."),
  p("O reconhecimento assume formas familiares — distintivos de competência, marcos, desafios entre unidades e departamentos, nomeações entre pares — mas o alvo subjacente é sempre o mesmo: uma competição amigável que une as equipas, em vez de colocar indivíduos uns contra os outros."),

  h1("As Três Árvores da Olivia"),
  p("O crescimento acontece em três níveis interligados, e cada um fortalece os outros."),
  h2("Árvore Pessoal"),
  p("O percurso de aprendizagem de um colaborador: as competências que construiu, os percursos que completou, aquilo em que orientou outros, o que devolveu à comunidade."),
  h2("Árvore de Equipa"),
  p("A colaboração de um departamento: fluxos de trabalho partilhados, formação cruzada e a consistência operacional que nasce quando uma equipa resolve problemas em conjunto, e não separadamente."),
  h2("Árvore da Organização"),
  p("A inteligência coletiva da empresa: fluxos de trabalho validados, práticas documentadas e as automatizações e melhorias que perduram para além do tempo de qualquer pessoa na organização."),
  p("À medida que cada árvore cresce, as outras crescem com ela."),

  h1("O Conhecimento Torna‑se um Ativo"),
  p("A hotelaria tem uma rotatividade elevada. Tradicionalmente, quando colaboradores experientes saem, a maior parte do que sabiam sai com eles."),
  p("A Olivia muda isso. Os fluxos de trabalho, procedimentos, prompts, relatórios e lições duramente conquistadas que um colaborador constrói permanecem — disponíveis para quem ocupar a função a seguir. O conhecimento deixa de pertencer exclusivamente ao indivíduo e passa a fazer parte da capacidade de longo prazo da organização. A aprendizagem transforma‑se num ativo empresarial permanente, em vez de pessoal."),

  h1("Mercado de Pipelines"),
  p("Os colaboradores são encorajados a partilhar o que funciona. Um fluxo de compras criado numa unidade pode melhorar as aquisições em todo o grupo. Uma automatização de marketing que uma equipa desenvolve pode tornar‑se o padrão utilizado por todos os restaurantes."),
  p("Cada contribuição pode ser reutilizada, melhorada, adaptada a uma unidade diferente e medida em função do resultado para que foi construída. A inovação espalha‑se lateralmente, entre equipas, em vez de depender exclusivamente de iniciativas descendentes."),

  h1("Desenvolvimento Prático de Competências"),
  p("A aprendizagem mantém‑se ancorada a problemas reais do negócio:"),
  ...bullets([
    "compras assistidas por IA",
    "gestão de stock e engenharia de menus",
    "sustentabilidade e relatórios de desperdício alimentar",
    "análise da experiência do hóspede",
    "planeamento da força de trabalho",
  ]),
  p("Cada percurso combina aprendizagem guiada com aplicação prática, e avaliações opcionais reconhecem o que a pessoa realmente fez, em vez do que estudou. Ao longo do tempo, os colaboradores constroem um Passaporte de Competências Olivia — um registo portátil de experiência prática que ajuda a sua carreira e, enquanto estão na empresa, ajuda o negócio que os formou."),

  h1("Medir o Sucesso"),
  p("A Olivia é avaliada pelos resultados operacionais, e não pela quantidade de IA utilizada. Os indicadores que importam: desperdício alimentar, erros de encomenda, tempo de integração, retenção de pessoal, colaboração entre departamentos, reutilização de fluxos de trabalho, participação e satisfação dos hóspedes."),
  p("A pergunta nunca é “quanta IA utilizámos?”. A pergunta é “quanto melhor ficou a organização?”."),
  p("Nada disto é prometido no primeiro dia. Um piloto tem de ver como uma equipa realmente trabalha antes de poder dizer o que vai mudar e em quanto. O que a Olivia oferece à partida é a estrutura para descobrir — e não um número para citar antes de alguém ter experimentado.", { italic: true }),

  h1("Maturidade Organizacional"),
  p("A implementação avança por cinco estágios, por esta ordem:"),
  step("Explorar", "os colaboradores ganham confiança para experimentar."),
  step("Aplicar", "os indivíduos resolvem desafios específicos da sua própria função."),
  step("Partilhar", "as soluções funcionais espalham‑se de equipa para equipa."),
  step("Medir", "a melhoria do negócio torna‑se visível e demonstrável."),
  step("Crescer", "a aprendizagem contínua instala‑se na cultura, em vez de correr ao lado dela como um programa."),
  p("Isto dá à liderança um roteiro prático para uma transformação que se mede em temporadas, não em sprints."),

  h1("Alinhamento com o Financiamento"),
  p("O modelo Olivia situa‑se na interseção de várias prioridades de financiamento em simultâneo: desenvolvimento da força de trabalho, inclusão digital, adoção de IA, produtividade das PME, aprendizagem ao longo da vida, sustentabilidade e desenvolvimento económico regional."),
  p("Por combinar adoção tecnológica, desenvolvimento dos colaboradores, melhoria operacional e resiliência organizacional num único programa, pode qualificar‑se para mais do que uma linha de financiamento ao mesmo tempo. Para além de identificar as oportunidades, a Olivia pode pesquisar a elegibilidade, ajudar a preparar as provas, redigir as candidaturas e acompanhar os programas relevantes para o setor e a localização de uma organização."),

  h1("Por Que Isto é Importante"),
  p("A inteligência artificial, por si só, não transforma uma organização. São as pessoas que o fazem. A tecnologia só ganha valor quando ajuda as pessoas a resolver problemas que importam, a trabalhar melhor em conjunto e a construir conhecimento que lhes sobrevive."),
  p("A Olivia cria as condições para isso — um ambiente seguro onde qualquer pessoa, do ajudante de cozinha ao diretor‑geral, pode contribuir com uma ideia, construir uma competência prática e melhorar a forma como o trabalho é feito."),
  p("O resultado não é simplesmente uma força de trabalho que sabe usar IA. É uma organização que continua a aprender, a melhorar e a conservar o conhecimento que constrói, muito depois de qualquer colaborador ter seguido em frente."),
  pRuns([{ text: "O maior valor que a Olivia cria nunca foi a tecnologia. É a cultura de curiosidade, experimentação e inteligência partilhada que a tecnologia torna possível.", italic: true, color: GREEN_DARK, bold: true }], { after: 200 }),
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
            new TextRun({ text: "Ecossistema de Aprendizagem no Local de Trabalho Olivia   \u00b7   ", font: MONO, size: 15, color: GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: MONO, size: 15, color: GRAY }),
          ],
        })],
      }),
    },
    children: [...titleBlock, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  require("fs").writeFileSync("./olivia-white-paper-pt.docx", buf);
  console.log("Documento em português gerado com sucesso.");
});