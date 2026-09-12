import type { MarketCode } from "./arbitra";

export type CandidateMarket = MarketCode;

export type TrendCandidate = {
  id?: string;
  term: string;
  market: CandidateMarket;
  source: string;
  observedAt?: string;
  categoryHint?: string | null;
};

export type QualificationLabel = "PRODUCT" | "NON_PRODUCT" | "REVIEW";

export type QualificationResult = {
  label: QualificationLabel;
  confidence: number;
  reasons: string[];
  normalizedTerm: string;
  canonicalTokens: string[];
};

export type ProductCluster = {
  id: string;
  canonicalName: string;
  aliases: string[];
  category?: string | null;
};

export type MatchResult = {
  clusterId: string | null;
  canonicalName: string | null;
  score: number;
  decision: "MATCH" | "REVIEW" | "NO_MATCH";
  reasons: string[];
};

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "of", "to", "in", "on", "by",
  "de", "het", "een", "en", "voor", "met", "van", "op", "bij",
  "der", "die", "das", "ein", "eine", "und", "fur", "für", "mit", "von", "bei",
  "new", "nieuw", "neue", "best", "top", "2024", "2025", "2026",
]);

const PRODUCT_HINTS = [
  "machine", "maker", "bottle", "lamp", "light", "chair", "desk", "bag", "case", "charger",
  "camera", "speaker", "headphone", "headphones", "keyboard", "mouse", "watch", "vacuum",
  "cleaner", "blender", "mixer", "pan", "pot", "knife", "rack", "holder", "stand", "mat",
  "pillow", "blanket", "shoes", "shoe", "jacket", "dress", "shirt", "shorts", "glasses",
  "tumbler", "mug", "filter", "fan", "heater", "cooler", "bath", "tub", "plunge",
  "massage", "massager", "brush", "dryer", "styler", "serum", "cream", "mask", "patch",
  "ijsbad", "bad", "lamp", "stoel", "bureau", "tas", "oplader", "koptelefoon", "stofzuiger",
  "mixer", "pan", "mes", "rek", "houder", "kussen", "deken", "schoenen", "jas", "bril",
  "fles", "filter", "ventilator", "kachel", "koeler", "borstel", "droger",
  "eisbad", "wanne", "lampe", "stuhl", "tisch", "tasche", "ladegerät", "kopfhorer",
  "kopfhörer", "staubsauger", "messer", "halter", "kissen", "decke", "schuhe", "jacke",
  "flasche", "ventilator", "heizer", "kuhler", "kühler", "burste", "bürste",
];

const NON_PRODUCT_HINTS = [
  "election", "elections", "president", "minister", "war", "earthquake", "score", "match",
  "football", "soccer", "nba", "nfl", "mlb", "formula 1", "f1", "weather", "news", "movie",
  "series", "episode", "song", "lyrics", "concert", "festival", "celebrity", "actor", "actress",
  "verkiezingen", "verkiezing", "minister", "oorlog", "aardbeving", "voetbal", "wedstrijd",
  "weer", "nieuws", "film", "aflevering", "lied", "songtekst", "concert", "festival",
  "wahl", "wahlen", "präsident", "prasident", "minister", "krieg", "erdbeben", "fußball",
  "fussball", "spiel", "wetter", "nachrichten", "film", "folge", "lied", "konzert",
];

const SYNONYM_GROUPS: string[][] = [
  ["cold plunge", "ice bath", "ice bath tub", "portable ice bath", "ijsbad", "koudwaterbad", "eisbad", "kältebad", "kaltebad"],
  ["air fryer", "airfryer", "heteluchtfriteuse", "heissluftfritteuse", "heißluftfritteuse"],
  ["robot vacuum", "robot vacuum cleaner", "robotstofzuiger", "saugroboter"],
  ["walking pad", "under desk treadmill", "loopband bureau", "schreibtisch laufband"],
  ["tumbler", "insulated tumbler", "thermos tumbler", "isoleerbeker", "thermobecher"],
  ["led face mask", "led facial mask", "led gezichtsmasker", "led gesichtsmaske"],
  ["portable blender", "personal blender", "draagbare blender", "tragbarer mixer"],
];

const SYNONYM_LOOKUP = buildSynonymLookup();

function buildSynonymLookup() {
  const lookup = new Map<string, string>();
  for (const group of SYNONYM_GROUPS) {
    const canonical = normalizeBase(group[0]);
    for (const alias of group) lookup.set(normalizeBase(alias), canonical);
  }
  return lookup;
}

function normalizeBase(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s?(?:mm|cm|m|ml|cl|l|g|kg|oz|lb|inch|inches|pack|pcs|stuks|stuk)\b/g, " ")
    .replace(/\b(?:black|white|red|blue|green|pink|purple|yellow|orange|grey|gray|zwart|wit|rood|blauw|groen|roze|paars|geel|grijs|schwarz|weiss|weiß|rot|blau|grun|grün|rosa|gelb|grau)\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProductTerm(input: string) {
  const base = normalizeBase(input);
  const synonym = SYNONYM_LOOKUP.get(base);
  const source = synonym ?? base;
  const tokens = source.split(" ").filter(Boolean).filter((token) => !STOPWORDS.has(token));
  return { normalizedTerm: source, canonicalTokens: Array.from(new Set(tokens)).sort() };
}

export function qualifyTrendCandidate(candidate: TrendCandidate): QualificationResult {
  const { normalizedTerm, canonicalTokens } = normalizeProductTerm(candidate.term);
  const haystack = ` ${normalizedTerm} `;
  const nonProduct = NON_PRODUCT_HINTS.filter((hint) => haystack.includes(` ${normalizeBase(hint)} `));
  const productHints = PRODUCT_HINTS.filter((hint) => canonicalTokens.includes(normalizeBase(hint)));
  const knownProduct = SYNONYM_LOOKUP.has(normalizeBase(candidate.term));
  if (nonProduct.length > 0 && !knownProduct) return { label: "NON_PRODUCT", confidence: 0.9, reasons: [`Non-product signals: ${nonProduct.slice(0,3).join(", ")}`], normalizedTerm, canonicalTokens };
  if (knownProduct) return { label: "PRODUCT", confidence: 0.98, reasons: ["Known multilingual product synonym"], normalizedTerm, canonicalTokens };
  if (productHints.length > 0) return { label: "PRODUCT", confidence: Math.min(0.92, 0.68 + productHints.length * 0.08), reasons: [`Product nouns: ${productHints.slice(0,3).join(", ")}`], normalizedTerm, canonicalTokens };
  if (canonicalTokens.length >= 2) return { label: "REVIEW", confidence: 0.55, reasons: ["Plausible product phrase but insufficient evidence"], normalizedTerm, canonicalTokens };
  return { label: "REVIEW", confidence: 0.4, reasons: ["Insufficient evidence"], normalizedTerm, canonicalTokens };
}

function jaccard(a: string[], b: string[]) {
  const aa = new Set(a); const bb = new Set(b);
  const intersection = [...aa].filter((value) => bb.has(value)).length;
  const union = new Set([...aa, ...bb]).size;
  return union ? intersection / union : 0;
}

export function scoreProductSimilarity(candidate: string, cluster: ProductCluster) {
  const c = normalizeProductTerm(candidate);
  const variants = [cluster.canonicalName, ...cluster.aliases].map(normalizeProductTerm);
  return Math.max(...variants.map((variant) => {
    const setScore = jaccard(c.canonicalTokens, variant.canonicalTokens);
    const cSet = new Set(c.canonicalTokens); const vSet = new Set(variant.canonicalTokens);
    const containment = Math.min(cSet.size, vSet.size) ? [...cSet].filter((t) => vSet.has(t)).length / Math.min(cSet.size, vSet.size) : 0;
    const phraseBonus = c.normalizedTerm === variant.normalizedTerm ? 1 : c.normalizedTerm.includes(variant.normalizedTerm) || variant.normalizedTerm.includes(c.normalizedTerm) ? 0.88 : 0;
    return Math.max(setScore * 0.72 + containment * 0.28, phraseBonus);
  }));
}

export function matchCandidateToClusters(candidate: TrendCandidate, clusters: ProductCluster[]): MatchResult {
  const ranked = clusters.map((cluster) => ({ cluster, score: scoreProductSimilarity(candidate.term, cluster) })).sort((a,b)=>b.score-a.score);
  const best = ranked[0];
  if (!best) return { clusterId: null, canonicalName: null, score: 0, decision: "NO_MATCH", reasons: ["No clusters available"] };
  if (best.score >= 0.86) return { clusterId: best.cluster.id, canonicalName: best.cluster.canonicalName, score: Number(best.score.toFixed(3)), decision: "MATCH", reasons: ["High lexical/synonym similarity"] };
  if (best.score >= 0.62) return { clusterId: best.cluster.id, canonicalName: best.cluster.canonicalName, score: Number(best.score.toFixed(3)), decision: "REVIEW", reasons: ["Possible product identity match"] };
  return { clusterId: null, canonicalName: null, score: Number(best.score.toFixed(3)), decision: "NO_MATCH", reasons: ["Similarity below review threshold"] };
}

export function suggestCanonicalName(term: string) {
  const { normalizedTerm } = normalizeProductTerm(term);
  return normalizedTerm.replace(/\b\w/g, (character) => character.toUpperCase());
}
