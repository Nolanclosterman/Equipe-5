// Maps a free-text reply to one or more glanceable "bin badges" so a 12-year-old
// can see WHERE to throw something at a glance, instead of hunting for it in prose.
// Detection is keyword-based on the Belgian (Wallonia/Brussels) sorting vocabulary
// used in the ODWB dataset (`infocollecte` / `infoparc` values). It's a visual aid
// layered on top of the full text answer — not a replacement for it.

export interface BinBadge {
  id: string;
  label: string;
  emoji: string;
  /** Full, static Tailwind class string (kept literal so v4 content-scanning keeps it). */
  className: string;
}

interface BinDef extends BinBadge {
  pattern: RegExp;
}

// Order is only used to break ties when two bins first appear at the same index.
// More specific phrases (déchets verts, déchets organiques) are listed before the
// generic résiduel match so they win on overlap.
const BINS: BinDef[] = [
  {
    id: 'pmc',
    label: 'Sac bleu PMC',
    emoji: '🔵',
    pattern: /sac bleu|\bP\.?M\.?C\.?\b/i,
    className: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'verre',
    label: 'Bulle à verre',
    emoji: '🍾',
    pattern: /bulle?s? à verre|conteneur à verre|\bverre\b/i,
    className: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    id: 'papier',
    label: 'Papier-carton',
    emoji: '📦',
    pattern: /papiers?-?\s?cartons?|collecte des papiers|\bpapier\b|\bcarton\b/i,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'verts',
    label: 'Déchets verts',
    emoji: '🌿',
    pattern: /déchets verts/i,
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    id: 'organique',
    label: 'Déchets organiques',
    emoji: '🍎',
    pattern: /déchets organiques|\borganiques?\b|compost/i,
    className: 'bg-lime-50 text-lime-700 border-lime-200',
  },
  {
    id: 'recupel',
    label: 'Point Recupel',
    emoji: '🔌',
    pattern: /recupel|\bD\.?E\.?E\.?E\.?\b|équipements? électr/i,
    className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'piles',
    label: 'Point piles',
    emoji: '🔋',
    pattern: /\bpiles?\b|bebat/i,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    id: 'textile',
    label: 'Bulle à textiles',
    emoji: '👕',
    pattern: /textiles?|bulle à vêtements|conteneur à vêtements/i,
    className: 'bg-pink-50 text-pink-700 border-pink-200',
  },
  {
    id: 'huiles',
    label: 'Point huiles',
    emoji: '🛢️',
    pattern: /\bhuiles?\b/i,
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  {
    id: 'recyparc',
    label: 'Recyparc',
    emoji: '🏤',
    pattern: /recyparc|parc à conteneurs|déchet?terie/i,
    className: 'bg-stone-100 text-stone-700 border-stone-300',
  },
  {
    id: 'residuel',
    label: 'Poubelle résiduelle',
    emoji: '🗑️',
    pattern: /déchets ménagers résiduels|ordures ménagères|poubelle (grise|noire|résiduelle)|sac (blanc|poubelle)/i,
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
];

/**
 * Returns up to two distinct bin badges, ordered by where they first appear in the
 * text. Two badges supports double-filière answers (e.g. "à la maison OU au recyparc")
 * while staying glanceable. Returns [] when no known bin is mentioned (e.g. an
 * off-topic refusal or a "je ne suis pas sûr" fallback), so no badge is shown.
 */
export function detectBins(text: string, max = 2): BinBadge[] {
  if (!text) return [];

  const found: { badge: BinBadge; index: number }[] = [];
  for (const bin of BINS) {
    const match = bin.pattern.exec(text);
    if (!match) continue;

    // Skip bins named in a negative context ("jamais dans le sac bleu", "pas au
    // recyparc") so a kid never sees a badge for a bin they should NOT use.
    const before = text.slice(Math.max(0, match.index - 16), match.index);
    if (/jamais|surtout pas|pas dans|pas au\b|pas à la/i.test(before)) continue;

    found.push({
      badge: { id: bin.id, label: bin.label, emoji: bin.emoji, className: bin.className },
      index: match.index,
    });
  }

  return found
    .sort((a, b) => a.index - b.index)
    .slice(0, max)
    .map((f) => f.badge);
}
