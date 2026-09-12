export type CandidateMarket = "US" | "UK" | "DE" | "NL";

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
  const map = new Map<string, string>();
  for (const group of SYNONYM_GROUPS) {
    const canonical = normalizeBasic(group[0]);
    for (const alias of group) map.set(normalizeBasic(alias), canonical);
  }
  return map;
}

function normalizeBasic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCommercialNoise(value: string) {
  return value
    .replace(/\b\d+(?:[.,]\d+)?\s?(?:ml|l|cl|oz|kg|g|mg|cm|mm|m|inch|inches|w|kw|mah|gb|tb|pack|pcs|piece|pieces|stuks|stuck|stück)\b/gi, " ")
    .replace(/\b(?:set|bundle|kit|pack of)\s*\d*\b/gi, " ")
    .replace(/\b(?:black|white|red|blue|green|pink|beige|zwart|wit|rood|blauw|groen|roze|schwarz|weiss|weiß|rot|blau|grun|grün)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProductTerm(term: string) {
  const basic = normalizeBasic(term);
  const synonym = SYNONYM_LOOKUP.get(basic);
  const cleaned = stripCommercialNoise(synonym ?? basic);
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token));

  return {
    normalized: tokens.join(" "),
    tokens: [...new Set(tokens)].sort(),
    synonymCanonical: synonym ?? null,
  };
}

function containsHint(normalized: string, hints: string[]) {
  return hints.some((hint) => normalized === hint || normalized.includes(` ${hint} `) || normalized.startsWith(`${hint} `) || normalized.endsWith(` ${hint}`));
}

export function qualifyTrendCandidate(candidate: TrendCandidate): QualificationResult {
  const { normalized, tokens, synonymCanonical } = normalizeProductTerm(candidate.term);
  const reasons: string[] = [];

  if (!normalized || normalized.length < 3) {
    return { label: "NON_PRODUCT", confidence: 0.98, reasons: ["Term is empty or too short after normalization"], normalizedTerm: normalized, canonicalTokens: tokens };
  }

  const padded = ` ${normalized} `;
  if (containsHint(padded, NON_PRODUCT_HINTS)) {
    return { label: "NON_PRODUCT", confidence: 0.9, reasons: ["Contains a strong news, entertainment, sport, or event signal"], normalizedTerm: normalized, canonicalTokens: tokens };
  }

  if (synonymCanonical) {
    reasons.push("Matches a known multilingual product synonym group");
    return { label: "PRODUCT", confidence: 0.98, reasons, normalizedTerm: synonymCanonical, canonicalTokens: normalizeProductTerm(synonymCanonical).tokens };
  }

  const productHint = containsHint(padded, PRODUCT_HINTS);
  if (productHint) reasons.push("Contains a strong physical-product noun");

  const tokenCount = tokens.length;
  if (tokenCount >= 2 && tokenCount <= 6) reasons.push("Term shape resembles a product query");

  const hasQuestionIntent = /\b(how|why|when|where|who|wat|waarom|wanneer|waar|wie|wie|warum|wann|wo|wer)\b/i.test(candidate.term);
  if (hasQuestionIntent) reasons.push("Contains informational/question intent");

  let score = 0.35;
  if (productHint) score += 0.4;
  if (tokenCount >= 2 && tokenCount <= 6) score += 0.15;
  if (hasQuestionIntent) score -= 0.35;
  if (tokenCount > 8) score -= 0.2;

  score = Math.max(0, Math.min(1, score));
  if (score >= 0.72) return { label: "PRODUCT", confidence: score, reasons, normalizedTerm: normalized, canonicalTokens: tokens };
  if (score <= 0.3) return { label: "NON_PRODUCT", confidence: 1 - score, reasons, normalizedTerm: normalized, canonicalTokens: tokens };
  return { label: "REVIEW", confidence: 1 - Math.abs(0.5 - score), reasons, normalizedTerm: normalized, canonicalTokens: tokens };
}

function jaccard(a: string[], b: string[]) {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

function containment(a: string[], b: string[]) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const overlap = [...setA].filter((token) => setB.has(token)).length;
  return overlap / Math.min(setA.size, setB.size);
}

export function scoreProductSimilarity(a: string, b: string) {
  const na = normalizeProductTerm(a);
  const nb = normalizeProductTerm(b);

  if (na.synonymCanonical && nb.synonymCanonical && na.synonymCanonical === nb.synonymCanonical) return 1;
  if (na.normalized === nb.normalized && na.normalized) return 1;

  const jac = jaccard(na.tokens, nb.tokens);
  const cont = containment(na.tokens, nb.tokens);
  const phraseBonus = na.normalized.includes(nb.normalized) || nb.normalized.includes(na.normalized) ? 0.12 : 0;
  return Math.min(1, jac * 0.55 + cont * 0.33 + phraseBonus);
}

export function matchCandidateToClusters(candidate: TrendCandidate, clusters: ProductCluster[]): MatchResult {
  const qualification = qualifyTrendCandidate(candidate);
  if (qualification.label === "NON_PRODUCT") {
    return { clusterId: null, canonicalName: null, score: 0, decision: "NO_MATCH", reasons: qualification.reasons };
  }

  let best: { cluster: ProductCluster; score: number; alias: string } | null = null;
  for (const cluster of clusters) {
    for (const alias of [cluster.canonicalName, ...cluster.aliases]) {
      const score = scoreProductSimilarity(candidate.term, alias);
      if (!best || score > best.score) best = { cluster, score, alias };
    }
  }

  if (!best) return { clusterId: null, canonicalName: null, score: 0, decision: "NO_MATCH", reasons: ["No existing product clusters available"] };

  const reasons = [`Best lexical/semantic-normalized alias: ${best.alias}`];
  if (best.score >= 0.86) return { clusterId: best.cluster.id, canonicalName: best.cluster.canonicalName, score: best.score, decision: "MATCH", reasons };
  if (best.score >= 0.62) return { clusterId: best.cluster.id, canonicalName: best.cluster.canonicalName, score: best.score, decision: "REVIEW", reasons: [...reasons, "Similarity is plausible but below automatic merge threshold"] };
  return { clusterId: null, canonicalName: null, score: best.score, decision: "NO_MATCH", reasons: [...reasons, "Similarity is below review threshold"] };
}

export function suggestCanonicalName(candidate: TrendCandidate) {
  const normalized = normalizeProductTerm(candidate.term);
  return normalized.synonymCanonical ?? normalized.normalized;
}
