import { getAllWasteRecords, type WasteRecord } from './search';

// ──────────────────────────────────────────────────────────────────────────
// Poubelles simplifiées (adaptées à un enfant de 12 ans).
// La bonne poubelle est dérivée des champs réels du dataset (infocollecte /
// infoparc) — jamais devinée à partir du nom de la catégorie.
// ──────────────────────────────────────────────────────────────────────────

export type BinKey = 'pmc' | 'papier' | 'organique' | 'residuel' | 'recyparc' | 'special';

interface Bin {
  key: BinKey;
  label: string; // formulation « se jette dans <label> »
  emoji: string;
}

export const BINS: Record<BinKey, Bin> = {
  pmc: { key: 'pmc', label: 'le sac bleu PMC', emoji: '💙' },
  papier: { key: 'papier', label: 'la collecte des papiers-cartons', emoji: '📰' },
  organique: { key: 'organique', label: 'la poubelle des déchets organiques', emoji: '🍎' },
  residuel: { key: 'residuel', label: 'la poubelle ordinaire (déchets résiduels)', emoji: '🗑️' },
  recyparc: { key: 'recyparc', label: 'le recyparc', emoji: '♻️' },
  special: { key: 'special', label: 'un point de collecte spécial', emoji: '🔴' },
};

function binFromCollecte(text: string): BinKey | null {
  const t = text.toLowerCase();
  if (t.includes('sac bleu')) return 'pmc';
  if (t.includes('papiers-cartons') || t.includes('papiers')) return 'papier';
  if (t.includes('organiques')) return 'organique';
  if (t.includes('résiduels') || t.includes('residuels')) return 'residuel';
  if (t.includes('vendeurs') || t.includes('pvcycle') || t.includes('@') || t.includes('agréés'))
    return 'special';
  return null;
}

function binFromParc(text: string): BinKey | null {
  const t = text.toLowerCase();
  if (t.includes('interdit')) return 'special';
  if (t.includes('recyparc')) return 'recyparc';
  return null;
}

/**
 * Retourne les poubelles acceptables pour un déchet (1 ou 2).
 * La première est la poubelle « principale » utilisée pour formuler les questions.
 */
export function getBins(record: WasteRecord): BinKey[] {
  const bins: BinKey[] = [];
  if (record.infocollecte) {
    const b = binFromCollecte(record.infocollecte);
    if (b) bins.push(b);
  }
  if (record.infoparc) {
    const b = binFromParc(record.infoparc);
    if (b && !bins.includes(b)) bins.push(b);
  }
  return bins;
}

// ──────────────────────────────────────────────────────────────────────────
// Types des questions. La version « publique » (envoyée au client) ne contient
// JAMAIS la bonne réponse : le serveur la recalcule depuis les `id`.
// ──────────────────────────────────────────────────────────────────────────

export interface TrueFalseQuestion {
  format: 'truefalse';
  id: string;
  recordId: number;
  dechet: string;
  shownBin: BinKey;
  statement: string;
}

export interface IntruderQuestion {
  format: 'intruder';
  id: string;
  binLabel: string;
  items: { recordId: number; dechet: string }[];
  prompt: string;
}

export type GameQuestion = TrueFalseQuestion | IntruderQuestion;

export interface AnswerResult {
  correct: boolean;
  reply: string;
}

/** Génère une question (format imposé ou aléatoire en alternant les deux), filtrée par niveau. */
export function newQuestion(format?: string, difficulty?: Difficulty): GameQuestion {
  if (format === 'truefalse') return generateTrueFalse(difficulty);
  if (format === 'intruder') return generateIntruder(difficulty);
  return Math.random() < 0.5 ? generateTrueFalse(difficulty) : generateIntruder(difficulty);
}

/** Texte à afficher pour une question (l'énoncé selon le format). */
export function questionText(q: GameQuestion): string {
  return q.format === 'truefalse' ? q.statement : q.prompt;
}

// ──────────────────────────────────────────────────────────────────────────
// Utilitaires
// ──────────────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function recordById(id: number): WasteRecord | undefined {
  return getAllWasteRecords().find((r) => r.id === id);
}

/** Anecdote éducative tirée du dataset (sans rien inventer). */
function funFact(record: WasteRecord): string {
  if (record.destination) return ` Et tu sais quoi ? ${record.destination}`;
  return '';
}

export type Difficulty = 'debutant' | 'expert';

// Poubelles « maison » → déchets courants (débutant). Recyparc / point spécial → experts.
const HOME_BINS: BinKey[] = ['pmc', 'papier', 'organique', 'residuel'];

/** Niveau d'un déchet : courant = débutant ; spécial (recyparc/point spécial) = expert. */
export function difficultyOf(record: WasteRecord): Difficulty {
  const primary = getBins(record)[0];
  return HOME_BINS.includes(primary) ? 'debutant' : 'expert';
}

/** Interprète le choix de niveau d'un enfant (bouton ou texte libre). Défaut : débutant. */
export function parseDifficulty(message: string): Difficulty {
  const m = normalize(message);
  if (/\b(expert|dur|difficile|fort|special|avance|pro|costaud)\b/.test(m)) return 'expert';
  return 'debutant';
}

// Déchets exploitables : ceux dont on connaît au moins une poubelle, filtrés par niveau.
function playablePool(difficulty?: Difficulty): WasteRecord[] {
  return getAllWasteRecords().filter(
    (r) => getBins(r).length > 0 && (!difficulty || difficultyOf(r) === difficulty)
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Format 1 — Vrai / Faux
// ──────────────────────────────────────────────────────────────────────────

export function generateTrueFalse(difficulty?: Difficulty): TrueFalseQuestion {
  const pool = playablePool(difficulty);
  const record = pick(pool);
  const accepted = getBins(record);

  const makeTrue = Math.random() < 0.5;
  let shownBin: BinKey;
  if (makeTrue) {
    shownBin = accepted[0];
  } else {
    const wrong = (Object.keys(BINS) as BinKey[]).filter((b) => !accepted.includes(b));
    shownBin = pick(wrong);
  }

  return {
    format: 'truefalse',
    id: newId(),
    recordId: record.id,
    dechet: record.dechet,
    shownBin,
    statement: `« ${record.dechet} » se jette dans ${BINS[shownBin].label} ${BINS[shownBin].emoji}.\n\nVrai ou faux ? 🤔`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Format 2 — L'intrus
// ──────────────────────────────────────────────────────────────────────────

export function generateIntruder(difficulty?: Difficulty): IntruderQuestion {
  const pool = playablePool(difficulty);

  // Regroupe par poubelle principale
  const byBin = new Map<BinKey, WasteRecord[]>();
  for (const r of pool) {
    const primary = getBins(r)[0];
    if (!byBin.has(primary)) byBin.set(primary, []);
    byBin.get(primary)!.push(r);
  }

  // Une poubelle avec ≥3 déchets pour les "bons", et au moins une autre pour l'intrus
  const eligible = [...byBin.entries()].filter(([, recs]) => recs.length >= 3);
  const [commonBin, commonRecs] = pick(eligible);
  const others = pool.filter((r) => getBins(r)[0] !== commonBin);

  const goods = shuffle(commonRecs).slice(0, 3);
  const intruder = pick(others);

  const items = shuffle([...goods, intruder]).map((r) => ({
    recordId: r.id,
    dechet: r.dechet,
  }));

  return {
    format: 'intruder',
    id: newId(),
    binLabel: BINS[commonBin].label,
    items,
    prompt: `Voici ${BINS[commonBin].label} ${BINS[commonBin].emoji}. Un seul de ces déchets n'y a pas sa place… lequel est l'intrus ? 🕵️\n\n${items
      .map((it, i) => `${i + 1}. ${it.dechet}`)
      .join('\n')}`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Correction (recalcule la bonne réponse côté serveur)
// ──────────────────────────────────────────────────────────────────────────

function parseYesNo(answer: string): boolean | null {
  const a = normalize(answer);
  if (/\b(vrai|oui|v|yes|y|ok|correct|exact)\b/.test(a)) return true;
  if (/\b(faux|non|f|no|n|incorrect|nope)\b/.test(a)) return false;
  return null;
}

export function checkTrueFalse(q: TrueFalseQuestion, answer: string): AnswerResult {
  const record = recordById(q.recordId);
  const accepted = record ? getBins(record) : [];
  const statementIsTrue = accepted.includes(q.shownBin);

  const userSaidTrue = parseYesNo(answer);
  if (userSaidTrue === null) {
    return {
      correct: false,
      reply: 'Réponds simplement par **Vrai** ✅ ou **Faux** ❌ ! 😊',
    };
  }

  const correct = userSaidTrue === statementIsTrue;
  const realBins = accepted.map((b) => `${BINS[b].label} ${BINS[b].emoji}`).join(' ou ');

  if (correct) {
    return {
      correct: true,
      reply: `Exactement ! ✅ « ${q.dechet} », ça va bien dans ${realBins}.${record ? funFact(record) : ''}`,
    };
  }
  return {
    correct: false,
    reply: `Presque ! 🙃 En fait « ${q.dechet} » se jette dans ${realBins}. Pas de souci, on apprend en se trompant !`,
  };
}

/** Recalcule l'intrus côté serveur (la poubelle majoritaire est la « bonne »). */
function intruderOf(q: IntruderQuestion): {
  index: number;
  item: { recordId: number; dechet: string };
  bins: string;
  record?: WasteRecord;
} {
  const bins = q.items.map((it) => {
    const r = recordById(it.recordId);
    return r ? getBins(r)[0] : null;
  });

  const counts = new Map<BinKey, number>();
  for (const b of bins) if (b) counts.set(b, (counts.get(b) ?? 0) + 1);
  let majorityBin: BinKey | null = null;
  let max = 0;
  for (const [b, c] of counts) if (c > max) { max = c; majorityBin = b; }

  const index = bins.findIndex((b) => b !== majorityBin);
  const item = q.items[index];
  const record = recordById(item.recordId);
  const binsLabel = record
    ? getBins(record).map((b) => `${BINS[b].label} ${BINS[b].emoji}`).join(' ou ')
    : '';
  return { index, item, bins: binsLabel, record };
}

export function checkIntruder(q: IntruderQuestion, answer: string): AnswerResult {
  const { index: intruderIdx, item: intruder, bins: intruderBins, record: intruderRecord } =
    intruderOf(q);

  // L'enfant a pu répondre par numéro ou par nom
  const a = normalize(answer);
  let chosenIdx = -1;
  const numMatch = a.match(/[1-4]/);
  if (numMatch) {
    chosenIdx = parseInt(numMatch[0], 10) - 1;
  } else {
    let best = 0;
    q.items.forEach((it, i) => {
      const name = normalize(it.dechet);
      const score = a.includes(name) || name.includes(a) ? Math.min(name.length, a.length) : 0;
      if (score > best) { best = score; chosenIdx = i; }
    });
  }

  if (chosenIdx === -1) {
    return {
      correct: false,
      reply: `Dis-moi le **numéro** ou le **nom** du déchet que tu penses être l'intrus ! 😊`,
    };
  }

  const correct = chosenIdx === intruderIdx;
  if (correct) {
    return {
      correct: true,
      reply: `Bravo, c'est exactement ça ! 🕵️✅ « ${intruder.dechet} » est l'intrus : il va dans ${intruderBins}, pas dans ${q.binLabel}.${intruderRecord ? funFact(intruderRecord) : ''}`,
    };
  }
  return {
    correct: false,
    reply: `Raté de peu ! 🙃 L'intrus était « ${intruder.dechet} » — il va dans ${intruderBins}, pas dans ${q.binLabel}. Tu feras mieux au prochain ! 💪`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// « Je sais pas » — on révèle la réponse gentiment, sans pénaliser.
// ──────────────────────────────────────────────────────────────────────────

export function explainTrueFalse(q: TrueFalseQuestion): string {
  const record = recordById(q.recordId);
  const accepted = record ? getBins(record) : [];
  const statementIsTrue = accepted.includes(q.shownBin);
  const realBins = accepted.map((b) => `${BINS[b].label} ${BINS[b].emoji}`).join(' ou ');
  const verdict = statementIsTrue ? "c'était **Vrai** ✅" : "c'était **Faux** ❌";
  return `Pas de souci, on apprend ensemble ! 😊 La réponse : ${verdict}. « ${q.dechet} » se jette dans ${realBins}.${record ? funFact(record) : ''}`;
}

export function explainIntruder(q: IntruderQuestion): string {
  const { item: intruder, bins: intruderBins, record } = intruderOf(q);
  return `Pas de souci, je t'explique ! 😊 L'intrus, c'était « ${intruder.dechet} » : il va dans ${intruderBins}, pas dans ${q.binLabel}.${record ? funFact(record) : ''}`;
}

export function explainAnswer(q: GameQuestion): string {
  return q.format === 'truefalse' ? explainTrueFalse(q) : explainIntruder(q);
}
