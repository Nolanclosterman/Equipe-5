import Fuse from 'fuse.js';
import fs from 'fs';
import path from 'path';

export interface WasteRecord {
  id: number;
  categorie: string;
  dechet: string;
  infocollecte: string | null;
  infoparc: string | null;
  prevention: string | null;
  destination: string | null;
  en_savoir: string | null;
  photos: {
    id: string;
    filename: string;
    url: string;
    width: number;
    height: number;
    color_summary?: string[];
  } | null;
}

export interface RecyparcRecord {
  denomination: string;
  rue: string;
  numero: string | null;
  code_postal: string;
  localite: string;
  tel: string | null;
  denomination_exploitant: string;
  tel_exploitant: string;
  mail_exploitant: string;
  geo_2d: { lon: number; lat: number };
}

export interface RecupelRecord {
  name: string;
  locations_street1: string;
  locations_housenumber: string | null;
  locations_postalcode: number;
  locations_cityfr: string;
  locations_latitude: string;
  locations_longitude: string;
  point_geo: { lon: number; lat: number };
  locations_categories: string[];
  region_name_french: string;
}

// Singletons loaded once per warm instance
let wasteData: WasteRecord[] = [];
let recyparcData: RecyparcRecord[] = [];
let recupelData: RecupelRecord[] = [];
let synonyms: Record<string, string[]> = {};
let fuseInstance: Fuse<WasteRecord> | null = null;

function loadDatasets() {
  if (fuseInstance) return;

  const datasetDir = path.join(process.cwd(), 'dataset');
  const dataDir = path.join(process.cwd(), 'data');

  wasteData = JSON.parse(fs.readFileSync(path.join(datasetDir, 'guide-de-tri0.json'), 'utf-8'));
  recyparcData = JSON.parse(fs.readFileSync(path.join(datasetDir, 'dechets-recyparcs.json'), 'utf-8'));

  const allRecupel: RecupelRecord[] = JSON.parse(
    fs.readFileSync(path.join(datasetDir, 'recupel-points-collecte.json'), 'utf-8')
  );
  // Pre-filter to Wallonie + Bruxelles only
  recupelData = allRecupel.filter(
    (r) =>
      r.region_name_french === 'Région wallonne' ||
      r.region_name_french === 'Région de Bruxelles-Capitale'
  );

  try {
    synonyms = JSON.parse(fs.readFileSync(path.join(dataDir, 'synonyms.json'), 'utf-8'));
  } catch {
    synonyms = {};
  }

  fuseInstance = new Fuse(wasteData, {
    keys: [
      { name: 'dechet', weight: 0.7 },
      { name: 'categorie', weight: 0.3 },
    ],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  });
}

// Common French filler words that should never drive a dataset match on their own.
const STOPWORDS = new Set([
  'les', 'des', 'une', 'mon', 'ton', 'son', 'ses', 'mes', 'tes', 'dans', 'pour', 'avec',
  'que', 'qui', 'quelle', 'quel', 'poubelle', 'sac', 'jette', 'jeter', 'mets', 'mettre',
  'met', 'vais', 'fait', 'faire', 'recyparc', 'papa', 'pere', 'mere', 'maison', 'vieux',
  'vieille', 'vieilles', 'cassees', 'cassee', 'usage', 'usagee', 'plein', 'vide', 'est',
  'sont', 'aller', 'vont', 'elle', 'elles', 'viens', 'finir', 'comment', 'quand', 'juste',
  'encore', 'rene', 'renove', 'change', 'changer', 'ancien', 'grille', 'grillee', 'quoi',
  'vraiment',
]);

function expandQuery(query: string): string[] {
  const lower = query.toLowerCase();
  const terms = new Set<string>([lower]);
  for (const [canonical, aliases] of Object.entries(synonyms)) {
    const allTerms = [canonical, ...aliases].map((t) => t.toLowerCase());
    // Trigger the group only when one of its aliases actually appears in the
    // query — not the reverse, which let a short word like "bouteille" pull in
    // the unrelated "verre" group via its alias "bouteille verre".
    if (allTerms.some((t) => lower.includes(t))) {
      allTerms.forEach((t) => terms.add(t));
    }
  }
  return Array.from(terms);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function searchWaste(query: string): WasteRecord[] {
  loadDatasets();

  // Search the whole phrase AND each meaningful word it contains, so a natural
  // sentence like "les vieux journaux de mon père, ça va où ?" still grounds on
  // the right record ("Journal") instead of returning nothing.
  const words = query
    .toLowerCase()
    .split(/[^a-zàâäéèêëïîôöùûüœç0-9]+/i)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const candidates = new Set<string>([query, ...words]);
  const queries = new Set<string>();
  for (const c of candidates) expandQuery(c).forEach((q) => queries.add(q));

  // Keep the best (lowest) Fuse score per record across all sub-queries, then
  // rank globally so a precise keyword match wins over noisy full-sentence hits.
  const best = new Map<number, { item: WasteRecord; score: number }>();
  for (const q of queries) {
    for (const hit of fuseInstance!.search(q, { limit: 5 })) {
      const score = hit.score ?? 1;
      const prev = best.get(hit.item.id);
      if (!prev || score < prev.score) best.set(hit.item.id, { item: hit.item, score });
    }
  }

  return Array.from(best.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((x) => x.item);
}

export function searchRecyparc(location: string): RecyparcRecord[] {
  loadDatasets();
  const loc = location.toLowerCase().trim();
  const matches = recyparcData.filter(
    (r) =>
      r.code_postal?.toLowerCase().includes(loc) ||
      r.localite?.toLowerCase().includes(loc)
  );

  if (matches.length === 0) return recyparcData.slice(0, 3);

  // Sort by proximity if we have coordinates
  const ref = matches[0].geo_2d;
  if (ref) {
    matches.sort((a, b) => {
      const da = haversine(ref.lat, ref.lon, a.geo_2d.lat, a.geo_2d.lon);
      const db = haversine(ref.lat, ref.lon, b.geo_2d.lat, b.geo_2d.lon);
      return da - db;
    });
  }

  return matches.slice(0, 3);
}

export function searchRecupelPoints(location: string, categories: string[]): RecupelRecord[] {
  loadDatasets();
  const loc = location.toLowerCase().trim();

  const filtered = recupelData.filter((r) => {
    const matchesLocation =
      String(r.locations_postalcode).includes(loc) ||
      r.locations_cityfr?.toLowerCase().includes(loc);
    const matchesCategory =
      categories.length === 0 ||
      categories.some((cat) => r.locations_categories?.includes(cat));
    return matchesLocation && matchesCategory;
  });

  if (filtered.length === 0) {
    return recupelData.filter((r) =>
      categories.some((cat) => r.locations_categories?.includes(cat))
    ).slice(0, 3);
  }

  return filtered.slice(0, 3);
}

export function getAllWasteNames(): string[] {
  loadDatasets();
  return wasteData.map((w) => `${w.dechet} (${w.categorie})`);
}

export function getAllWasteRecords(): WasteRecord[] {
  loadDatasets();
  return wasteData;
}
