/**
 * Benchmark Haiku 4.5 vs Sonnet 4.6 for the Trico tri-des-déchets assistant.
 *
 * Faithful to the running app: reuses the real SYSTEM_PROMPT, buildChatMessages
 * (context injection + cache_control), and searchWaste from lib/. The only thing
 * the harness owns is the API call itself — so it can stream per-model, time the
 * first token, and read per-call usage.
 *
 * Measures, per model:
 *   - Latency:    TTFT (time to first token) and total wall-clock per turn
 *   - Throughput: output tokens / second (the "feels fast" metric for kids)
 *   - Quality:    LLM-as-judge scores (exactitude, complétude, persona, scope,
 *                 ancrage/anti-hallucination) against the dataset-grounded answer
 *   - Cost:       estimated $/turn from real token usage × published pricing
 *
 * Run:  node --env-file=.env.local evals/benchmark.ts
 *   (Node 22+ strips TS types natively; --env-file loads ANTHROPIC_API_KEY.)
 *
 * Cheap, deterministic-ish: temperature 0.2, a 12-case representative suite.
 */
import Anthropic from '@anthropic-ai/sdk';
import { searchWaste } from '../lib/search.ts';
import { SYSTEM_PROMPT, buildChatMessages } from '../lib/claude.ts';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6'] as const;
type Model = (typeof MODELS)[number];

// Published API pricing, $/1M tokens (input, output). Source: model catalog.
const PRICING: Record<Model, { in: number; out: number }> = {
  'claude-haiku-4-5': { in: 1.0, out: 5.0 },
  'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
};

const JUDGE_MODEL = 'claude-sonnet-4-6'; // judges both models identically → fair
const TEMPERATURE = 0.2; // mirror the app default
const MAX_TOKENS = 1024;

// Representative 12-case suite drawn from evals/chatbot-evals.md. Covers every tri
// type (PMC domicile, recyparc, résiduel, collecteur), the documented traps
// (double filière, deux matériaux, "pas dans les bulles à verre"), and the scope
// guard. Expected points are the dataset-grounded key facts the judge checks.
interface Case {
  id: string;
  question: string;
  expected: string;
  inScope: boolean;
}
const CASES: Case[] = [
  { id: 'Q1 bouteille plastique', inScope: true,
    question: 'Je viens de finir ma bouteille de coca en plastique, je la mets où ?',
    expected: 'Sac bleu des PMC. Destination: lavée, broyée, transformée en pellets/granulés puis fondue pour de nouveaux produits. Bonus prévention: bouteilles en verre consigné ou gourdes.' },
  { id: 'Q2 canette métal', inScope: true,
    question: 'Ma canette de soda est vide, elle va dans quelle poubelle ?',
    expected: 'Sac bleu des PMC (bien vidée). Destination: lavée/broyée/fondue en nouveaux produits. Bonus: verre consigné, gourde, eau du robinet.' },
  { id: 'Q4 GSM DEEE', inScope: true,
    question: 'Mon vieux téléphone ne marche plus, je fais quoi avec ?',
    expected: 'Au recyparc — DEEE. Métaux précieux et plastiques réutilisés. Bonus: réparer/reconditionner avant de jeter. Redirection Recupel possible.' },
  { id: 'Q5 piles', inScope: true,
    question: 'Où est-ce que je jette mes vieilles piles ?',
    expected: 'Au recyparc — piles (ou bulles à piles en magasin / Recupel). Démantelées puis matières premières (fer, nickel) réutilisées. Bonus: piles rechargeables.' },
  { id: 'Q6 fleur fanée (double filière)', inScope: true,
    question: "J'ai des fleurs fanées, c'est quel sac ?",
    expected: 'DEUX options à présenter: collecte des déchets organiques à domicile ET recyparc (déchets verts). Transformées en compost. Doit mentionner les deux.' },
  { id: 'Q7 ampoule LED', inScope: true,
    question: 'Mon ampoule LED est grillée, c\'est quoi la poubelle ?',
    expected: 'Au recyparc — DEEE. PAS dans les bulles à verre (point important). Verre/métal/plastique réutilisés. Redirection Recupel possible.' },
  { id: 'Q8 pneu', inScope: true,
    question: "On a changé les pneus de la voiture, on en fait quoi des vieux ?",
    expected: 'Au recyparc — pneus. Récupérés par Recytyre: réemployés, réparés, recyclés ou valorisés en énergie.' },
  { id: 'Q14 huile de vidange', inScope: true,
    question: 'Mon père a vidangé la voiture, on fait quoi de l\'huile usagée ?',
    expected: 'Au recyparc — huiles de vidange, contenant max 20 L. Recyclées en huile de base ou valorisées en énergie. Pas de collecte à domicile.' },
  { id: 'Q15 lunettes résiduel', inScope: true,
    question: 'Mes vieilles lunettes sont cassées, je les mets dans quelle poubelle ?',
    expected: 'Collecte des déchets ménagers résiduels (sac blanc/gris). Incinérés pour produire chaleur et électricité. Pas de filière de recyclage spécifique.' },
  { id: 'Q16 sachet de thé (2 matériaux)', inScope: true,
    question: 'Mon sachet de thé, il va dans les déchets organiques ?',
    expected: 'DÉPEND du matériau: papier → déchets organiques (biométhanisé); synthétique → déchets ménagers résiduels (incinéré). Idéalement demander de préciser ou donner les deux cas. Bonus: thé en vrac.' },
  { id: 'Q18 bouchon liège', inScope: true,
    question: 'Le bouchon en liège de la bouteille de vin, c\'est dans le verre ?',
    expected: 'NON, pas dans les bulles à verre (corriger). Au recyparc — bouchons de liège. Broyés en isolant pour bioconstruction. Distinct du bouchon synthétique (sac bleu PMC).' },
  { id: 'Q20 hors-scope maths', inScope: false,
    question: 'Tu peux m\'aider avec mes devoirs de maths ?',
    expected: 'REFUS poli + recentrage vers le tri des déchets. AUCUNE information mathématique. Ton enfant, bienveillant.' },
];

interface RunResult {
  caseId: string;
  model: Model;
  text: string;
  ttftMs: number;
  totalMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  tokPerSec: number;
  costUsd: number;
  scores: Scores | null;
}

interface Scores {
  exactitude: number;   // 0-2: consigne de tri correcte vs dataset
  completude: number;   // 0-2: destination/prévention/sources pertinentes
  persona: number;      // 0-2: tutoiement, émojis, bienveillant, concis
  scope: number;        // 0-2: reste dans le domaine / refuse le hors-sujet
  ancrage: number;      // 0-2: 0 si hallucination (orga/chiffre inventé)
  verdict: string;      // courte justification
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One turn against one model, streamed, with TTFT + usage capture. */
async function runTurn(model: Model, c: Case): Promise<RunResult> {
  const context = searchWaste(c.question);
  const messages = buildChatMessages(c.question, context, []);
  const system = [
    { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
  ];

  const t0 = performance.now();
  let ttft = -1;
  let text = '';

  const stream = anthropic.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      if (ttft < 0) ttft = performance.now() - t0;
      text += event.delta.text;
    }
  }
  const totalMs = performance.now() - t0;
  const final = await stream.finalMessage();
  const u = final.usage;
  const outTok = u.output_tokens;
  const inTok = u.input_tokens;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  // Throughput over the generation phase (after first token), the honest tok/s.
  const genMs = Math.max(totalMs - Math.max(ttft, 0), 1);
  const tokPerSec = (outTok / genMs) * 1000;
  const p = PRICING[model];
  const costUsd = ((inTok + cacheRead) * p.in + outTok * p.out) / 1_000_000;

  return {
    caseId: c.id, model, text,
    ttftMs: ttft < 0 ? totalMs : ttft,
    totalMs, inputTokens: inTok, outputTokens: outTok,
    cacheReadTokens: cacheRead, tokPerSec, costUsd, scores: null,
  };
}

const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['exactitude', 'completude', 'persona', 'scope', 'ancrage', 'verdict'],
  properties: {
    exactitude: { type: 'integer' },
    completude: { type: 'integer' },
    persona: { type: 'integer' },
    scope: { type: 'integer' },
    ancrage: { type: 'integer' },
    verdict: { type: 'string' },
  },
};

/** LLM-as-judge: grade one answer against the dataset-grounded expectation. */
async function judge(c: Case, answer: string): Promise<Scores> {
  const prompt = `Tu es un évaluateur strict d'un assistant de tri des déchets pour enfants (~12 ans) en Wallonie/Bruxelles.

QUESTION DE L'ENFANT:
${c.question}

RÉPONSE ATTENDUE (faits ancrés dans le dataset officiel):
${c.expected}

RÉPONSE DE L'ASSISTANT À ÉVALUER:
${answer}

Note chaque critère de 0 à 2 (0 = absent/faux, 1 = partiel, 2 = correct):
- exactitude: la consigne de tri correspond-elle aux faits attendus ?
- completude: mentionne les infos pertinentes (destination, prévention, sources, double filière si applicable) ?
- persona: tutoiement, émojis, ton bienveillant et enfant, concis (2-5 phrases) ?
- scope: ${c.inScope ? "reste bien dans le tri des déchets ?" : "REFUSE poliment le hors-sujet et recentre, SANS donner d'info hors domaine ? (2 = refus net, 0 = a répondu au hors-sujet)"}
- ancrage: AUCUNE info inventée (organisme/chiffre non fourni) ? 2 = tout est ancré, 0 = hallucination claire.
verdict: une phrase de justification.`;

  const msg = await anthropic.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: 400,
    temperature: 0,
    output_config: { format: { type: 'json_schema', schema: JUDGE_SCHEMA } },
    messages: [{ role: 'user', content: prompt }],
  });
  const parsed = msg.parsed_output as Scores | null;
  if (!parsed) return { exactitude: 0, completude: 0, persona: 0, scope: 0, ancrage: 0, verdict: 'judge-failed' };
  return parsed;
}

/** Retry wrapper for transient 429/529. */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if ((status === 429 || status === 529 || status === 500) && attempt < 4) {
        const wait = 2000 * (attempt + 1);
        console.warn(`  ⏳ ${label}: ${status}, retry in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

function fmt(n: number, d = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY manquant. Lance avec: node --env-file=.env.local evals/benchmark.ts');
    process.exit(1);
  }
  console.log(`\n🔬 Benchmark Trico — ${CASES.length} cas × ${MODELS.length} modèles (temp ${TEMPERATURE})`);
  console.log(`   Modèles: ${MODELS.join(' vs ')}  |  Juge: ${JUDGE_MODEL}\n`);

  const results: RunResult[] = [];

  for (const c of CASES) {
    for (const model of MODELS) {
      process.stdout.write(`• ${model.padEnd(18)} ${c.id} … `);
      const r = await withRetry(() => runTurn(model, c), `gen ${c.id}`);
      r.scores = await withRetry(() => judge(c, r.text), `judge ${c.id}`);
      results.push(r);
      const s = r.scores;
      const total = s ? s.exactitude + s.completude + s.persona + s.scope + s.ancrage : 0;
      console.log(`TTFT ${fmt(r.ttftMs)}ms  ${fmt(r.tokPerSec, 1)} tok/s  score ${total}/10`);
      await sleep(400); // gentle on rate limits
    }
  }

  // ---- Aggregate ----
  console.log('\n\n================  RÉSULTATS AGRÉGÉS  ================\n');
  const agg = (m: Model) => results.filter((r) => r.model === m);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const rows: Record<string, (string | number)[]> = {};
  const header = ['Métrique', ...MODELS.map((m) => m.replace('claude-', ''))];

  const collect = (label: string, pick: (r: RunResult) => number, reducer: (xs: number[]) => number, dec = 0, suffix = '') => {
    rows[label] = MODELS.map((m) => fmt(reducer(agg(m).map(pick)), dec) + suffix);
  };
  const scoreOf = (r: RunResult, k: keyof Scores) => (r.scores ? Number(r.scores[k]) : 0);
  const totalScore = (r: RunResult) => r.scores ? r.scores.exactitude + r.scores.completude + r.scores.persona + r.scores.scope + r.scores.ancrage : 0;

  collect('TTFT médian (ms)', (r) => r.ttftMs, median);
  collect('TTFT moyen (ms)', (r) => r.ttftMs, mean);
  collect('Total médian (ms)', (r) => r.totalMs, median);
  collect('Débit moyen (tok/s)', (r) => r.tokPerSec, mean, 1);
  collect('Tokens out moyen', (r) => r.outputTokens, mean);
  collect('Coût moyen / tour ($)', (r) => r.costUsd, mean, 5);
  collect('Score total /10', totalScore, mean, 2);
  collect('  Exactitude /2', (r) => scoreOf(r, 'exactitude'), mean, 2);
  collect('  Complétude /2', (r) => scoreOf(r, 'completude'), mean, 2);
  collect('  Persona /2', (r) => scoreOf(r, 'persona'), mean, 2);
  collect('  Scope /2', (r) => scoreOf(r, 'scope'), mean, 2);
  collect('  Ancrage /2', (r) => scoreOf(r, 'ancrage'), mean, 2);

  // Pretty print table
  const colW = Math.max(22, ...Object.keys(rows).map((k) => k.length));
  const valW = 18;
  console.log(header[0].padEnd(colW) + header.slice(1).map((h) => h.padStart(valW)).join(''));
  console.log('-'.repeat(colW + valW * MODELS.length));
  for (const [label, vals] of Object.entries(rows)) {
    console.log(label.padEnd(colW) + vals.map((v) => String(v).padStart(valW)).join(''));
  }

  // Per-case quick table
  console.log('\n--- Score /10 par cas ---');
  console.log('Cas'.padEnd(34) + MODELS.map((m) => m.replace('claude-', '').padStart(16)).join(''));
  for (const c of CASES) {
    const cells = MODELS.map((m) => {
      const r = results.find((x) => x.caseId === c.id && x.model === m)!;
      return String(totalScore(r)).padStart(16);
    });
    console.log(c.id.padEnd(34) + cells.join(''));
  }

  // ---- Persist raw + markdown ----
  const fs = await import('node:fs');
  const out = { ranAt: new Date().toISOString(), temperature: TEMPERATURE, models: MODELS, results, summary: rows };
  fs.writeFileSync(new URL('./benchmark-results.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log('\n💾 Détail brut → evals/benchmark-results.json');

  // Verdict hint
  const [haiku, sonnet] = MODELS.map((m) => mean(agg(m).map(totalScore)));
  const [hCost, sCost] = MODELS.map((m) => mean(agg(m).map((r) => r.costUsd)));
  const [hTtft, sTtft] = MODELS.map((m) => median(agg(m).map((r) => r.ttftMs)));
  console.log('\n================  LECTURE  ================');
  console.log(`Qualité : Haiku ${haiku.toFixed(2)}/10  vs  Sonnet ${sonnet.toFixed(2)}/10  (Δ ${(sonnet - haiku).toFixed(2)})`);
  console.log(`Coût    : Haiku $${hCost.toFixed(5)}  vs  Sonnet $${sCost.toFixed(5)}  (Sonnet ${(sCost / hCost).toFixed(1)}× plus cher / tour)`);
  console.log(`Latence : Haiku ${hTtft.toFixed(0)}ms TTFT  vs  Sonnet ${sTtft.toFixed(0)}ms TTFT`);
  console.log('Arbitrage robustesse ⇆ sobriété: si Δqualité est faible, Haiku gagne sur le budget tokens du hackathon.\n');
}

main().catch((e) => {
  console.error('Benchmark failed:', e);
  process.exit(1);
});
