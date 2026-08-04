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
    children: [new TextRun({ text: "Olivia Workplace Learning Ecosystem", bold: true, font: SERIF, size: 56, color: GREEN_DARK })],
  }),
  new Paragraph({
    spacing: { after: 420 },
    children: [new TextRun({ text: "A New Operating Model for Hospitality", italics: true, font: SERIF, size: 30, color: GREEN_MID })],
  }),
  pullquote("The future of hospitality is not built by replacing people with AI. It is built by giving every employee the confidence, space, and tools to improve how work is done."),
  new Paragraph({
    spacing: { before: 300 },
    children: [new TextRun({ text: "Prepared by Olivia  ·  August 2026", font: MONO, size: 18, color: GRAY })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Body sections ──
const body = [
  h1("Executive Summary"),
  p("Hospitality is one of the most dynamic, people-driven industries there is. Its success rests on thousands of small operational decisions made every day — by chefs, bartenders, servers, supervisors, managers, marketers, procurement teams, finance, and leadership."),
  p("Yet the people closest to those decisions are rarely given a structured opportunity to experiment, innovate, or build digital skill as part of their normal work. Training happens elsewhere, on someone else's schedule, disconnected from the problem in front of them."),
  p("Olivia proposes a different model. Rather than introducing AI as another platform to adopt, Olivia creates a continuous workplace learning ecosystem where every employee can safely explore ideas, build practical solutions, and contribute to improving the business — inside the work they already do."),
  p("The objective is not to deploy artificial intelligence. The objective is to build organisational intelligence. As employees learn, collaborate, and solve real operational problems, the organisation continuously captures that knowledge, improves its processes, and becomes more resilient over time."),

  h1("From AI Adoption to Organisational Intelligence"),
  p("Most organisations start by asking, \u201cHow do we implement AI?\u201d Olivia starts with a different question: \u201cHow do we help people improve the work they already do?\u201d"),
  p("Artificial intelligence is only one part of that answer. The real transformation comes from building an environment where experimentation is encouraged, knowledge is shared, and improvements become permanent \u2014 instead of leaving with whichever employee thought of them. Every solved problem becomes part of the organisation\u2019s collective memory, available to the next person who runs into it."),

  h1("The Olivia Philosophy"),
  p("Olivia is built around one continuous cycle, repeated by every employee, in every role, for as long as they\u2019re part of the organisation."),
  step("Learn", "build practical knowledge through guided, hands-on experience, not classroom theory."),
  step("Build", "apply that knowledge to a real operational problem, not a hypothetical one."),
  step("Share", "make a working solution available to colleagues and other venues."),
  step("Improve", "let others adapt, refine, and extend it for their own context."),
  step("Measure", "track the change against a real business outcome, not activity."),
  step("Grow", "capture what was learned, and start the cycle again."),
  p("The cycle has no finish line. Each pass through it leaves the organisation a little smarter than the last one.", { }),
  callout("In practice:", "a bartender who finds a faster way to count stock doesn\u2019t just save herself twenty minutes. She writes it up, another venue picks it up, a manager adapts it for a different bar layout, and within a season it\u2019s the standard the whole group counts stock by. Nobody set out to \u201cdo AI.\u201d Someone solved a Tuesday-afternoon problem, and Olivia carried the answer to everyone else who had the same one."),

  h1("Learning Integrated into Everyday Work"),
  p("Traditional training pulls employees away from their work. Olivia does the opposite \u2014 it puts learning inside the rhythm of hospitality: a few quiet minutes before service, after close, during scheduled development time, or at home, exploring an idea in a safe environment."),
  p("Instead of a theoretical course, employees learn by solving a problem that matters to their own role. In practice, that has looked like:"),
  ...bullets([
    "improving stock-taking",
    "analysing food waste",
    "comparing suppliers",
    "simplifying shift handovers",
    "drafting marketing content",
    "turning guest feedback into a reporting dashboard",
  ]),
  p("The learning is practical, immediate, and owned by the person who did it."),

  h1("Learning Credits, Not Usage Limits"),
  p("Every employee gets a personal Olivia account. Rather than metering it like API usage, Olivia gives each person Learning Credits that encourage exploration rather than restrict it. Credits let someone:"),
  ...bullets([
    "ask questions and experiment safely",
    "complete a guided learning module",
    "build a practical workflow",
    "take part in a workplace challenge",
  ]),
  p("Managers can top up credits to recognise innovation, collaboration, or a genuinely good idea. The point was never consumption. The point is continuous learning."),

  h1("Gamification with Purpose"),
  p("Gamification only earns its place if it reinforces behaviour that actually matters \u2014 not activity for its own sake. Olivia rewards employees for solving real operational problems, collaborating across departments, documenting what worked, mentoring colleagues, and measuring the outcome."),
  p("Recognition takes a familiar shape \u2014 skill badges, milestones, venue and department challenges, peer nominations \u2014 but the target underneath it is always the same: friendly competition that pulls teams together instead of pitting individuals against each other."),

  h1("The Three Trees of Olivia"),
  p("Growth happens at three interconnected levels, and each one strengthens the others."),
  h2("Personal Tree"),
  p("One employee\u2019s own learning journey: the skills they\u2019ve built, the paths they\u2019ve completed, what they\u2019ve mentored others through, what they\u2019ve contributed back."),
  h2("Team Tree"),
  p("A department\u2019s collaboration: shared workflows, cross-training, and the operational consistency that comes from a team solving problems together instead of separately."),
  h2("Organization Tree"),
  p("The company\u2019s collective intelligence: validated workflows, documented practice, and the automations and improvements that outlast any one person\u2019s time there."),
  p("As each tree grows, the others grow with it."),

  h1("Knowledge Becomes an Asset"),
  p("Hospitality has high turnover. Traditionally, when experienced staff leave, most of what they knew leaves with them."),
  p("Olivia changes that. The workflows, procedures, prompts, reports, and hard-won lessons an employee builds stay behind \u2014 available to whoever fills that role next. Knowledge stops belonging solely to the individual and becomes part of the organisation\u2019s long-term capability. Learning turns into a permanent business asset instead of a personal one."),

  h1("Pipeline Marketplace"),
  p("Employees are encouraged to share what works. A procurement workflow built in one venue can improve purchasing across the whole group. A marketing automation one team builds can become the standard every restaurant uses."),
  p("Each contribution can be reused, improved, adapted to a different venue, and measured against the outcome it was built for. Innovation spreads sideways, between teams, instead of depending entirely on top-down initiatives."),

  h1("Practical Skill Development"),
  p("Learning stays anchored to real business problems:"),
  ...bullets([
    "AI-assisted procurement",
    "stock management and menu engineering",
    "sustainability and food-waste reporting",
    "guest experience analysis",
    "workforce planning",
  ]),
  p("Each pathway pairs guided learning with practical application, and optional assessments recognise what someone has actually done rather than what they\u2019ve studied. Over time, employees build an Olivia Skills Passport \u2014 a portable record of practical experience that helps their career and, while they\u2019re there, helps the business that trained them."),

  h1("Measuring Success"),
  p("Olivia is judged on operational outcomes, not on how much AI got used. The indicators that matter: food waste, ordering errors, onboarding time, staff retention, cross-department collaboration, workflow reuse, participation, and guest satisfaction."),
  p("The question is never \u201chow much AI did we use?\u201d The question is \u201chow much better did the organisation get?\u201d"),
  p("None of that is promised on day one. A pilot has to see how a team actually works before it can say what will change, and by how much. What Olivia offers up front is the structure to find out \u2014 not a number to quote before anyone\u2019s tried it.", { italic: true }),

  h1("Organisational Maturity"),
  p("Implementation moves through five stages, in order:"),
  step("Explore", "employees get comfortable experimenting."),
  step("Apply", "individuals solve challenges specific to their own role."),
  step("Share", "working solutions spread from team to team."),
  step("Measure", "the business improvement becomes visible and provable."),
  step("Grow", "continuous learning settles into the culture, rather than running alongside it as a programme."),
  p("This gives leadership a practical roadmap for a transformation that\u2019s measured in seasons, not sprints."),

  h1("Funding Alignment"),
  p("The Olivia model sits at the intersection of several funding priorities at once: workforce development, digital inclusion, AI adoption, SME productivity, lifelong learning, sustainability, and regional economic development."),
  p("Because it combines technology adoption, employee development, operational improvement, and organisational resilience in a single programme, it can qualify for more than one funding stream simultaneously. Beyond identifying the opportunities, Olivia can research eligibility, help prepare the evidence, draft the applications, and track the programmes relevant to an organisation\u2019s industry and location."),

  h1("Why This Matters"),
  p("Artificial intelligence alone doesn\u2019t transform an organisation. People do. Technology only becomes valuable once it helps people solve problems that matter, work together better, and build knowledge that outlasts them."),
  p("Olivia creates the conditions for that \u2014 a safe environment where everyone, from kitchen porter to general manager, can contribute an idea, build a practical skill, and improve the way work gets done."),
  p("The result isn\u2019t simply a workforce that knows how to use AI. It\u2019s an organisation that keeps learning, keeps improving, and keeps the knowledge it builds long after any one employee has moved on."),
  pRuns([{ text: "The greatest value Olivia creates was never the technology. It\u2019s the culture of curiosity, experimentation, and shared intelligence the technology makes possible.", italic: true, color: GREEN_DARK, bold: true }], { after: 200 }),
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
            new TextRun({ text: "Olivia Workplace Learning Ecosystem   \u00b7   ", font: MONO, size: 15, color: GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], font: MONO, size: 15, color: GRAY }),
          ],
        })],
      }),
    },
    children: [...titleBlock, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  require("fs").writeFileSync("/home/claude/olivia-white-paper.docx", buf);
  console.log("written");
});