import type { MarketCode } from "./arbitra";
import type { RawObservation } from "./data-source";

export type GoogleTrendsRow = {
  market: MarketCode;
  term: string;
  week: string;
  score: number;
  rank: number;
  percentGain?: number | null;
  regionCode?: string | null;
  regionName?: string | null;
};

const MARKET_MAP: Record<string, MarketCode | undefined> = {
  US:"US", CA:"CA", MX:"MX", BR:"BR", GB:"UK", UK:"UK", DE:"DE", FR:"FR", NL:"NL", BE:"BE", ES:"ES", IT:"IT", SE:"SE", PL:"PL", AU:"AU", JP:"JP", KR:"KR", IN:"IN",
};

export function mapGoogleCountryCode(code: string): MarketCode | null {
  return MARKET_MAP[code.toUpperCase()] ?? null;
}

export function normalizeGoogleTrendsRow(row: GoogleTrendsRow): RawObservation[] {
  const observedAt = new Date(`${row.week}T00:00:00.000Z`).toISOString();
  const base: Omit<RawObservation, "signalType" | "value" | "unit"> = {
    productExternalId: `google:${row.term.toLowerCase().trim()}`,
    productName: row.term.trim(),
    market: row.market,
    observedAt,
    source: "google_trends_public",
    confidence: 0.9,
    metadata: { rank: row.rank, regionCode: row.regionCode ?? null, regionName: row.regionName ?? null, percentGain: row.percentGain ?? null },
  };
  const observations: RawObservation[] = [{ ...base, signalType:"search_interest", value:Math.max(0, Math.min(100,row.score)), unit:"google_trends_score" }];
  if (typeof row.percentGain === "number" && Number.isFinite(row.percentGain)) observations.push({ ...base, signalType:"search_velocity", value:Math.max(0,row.percentGain), unit:"google_trends_percent_gain", confidence:.85 });
  return observations;
}

export const INTERNATIONAL_DISCOVERY_SQL = `
WITH latest_partition AS (
  SELECT MAX(refresh_date) AS refresh_date
  FROM \`bigquery-public-data.google_trends.international_top_rising_terms\`
), ranked AS (
  SELECT country_code, region_code, region_name, term, week, score, rank, percent_gain,
    ROW_NUMBER() OVER (PARTITION BY country_code, region_code, term, week ORDER BY refresh_date DESC) AS row_num
  FROM \`bigquery-public-data.google_trends.international_top_rising_terms\`
  WHERE refresh_date = (SELECT refresh_date FROM latest_partition)
    AND country_code IN ('CA','MX','BR','GB','DE','FR','NL','BE','ES','IT','SE','PL','AU','JP','KR','IN')
)
SELECT country_code, region_code, region_name, term, week, score, rank, percent_gain
FROM ranked WHERE row_num = 1 ORDER BY country_code, term, week;
`;

export const US_DISCOVERY_SQL = `
WITH latest_partition AS (
  SELECT MAX(refresh_date) AS refresh_date
  FROM \`bigquery-public-data.google_trends.top_rising_terms\`
), dma_rows AS (
  SELECT term, week, score, rank, dma_id, dma_name, percent_gain
  FROM \`bigquery-public-data.google_trends.top_rising_terms\`
  WHERE refresh_date = (SELECT refresh_date FROM latest_partition)
), national AS (
  SELECT term, week, AVG(score) AS score, MIN(rank) AS rank, AVG(percent_gain) AS percent_gain, COUNT(DISTINCT dma_id) AS dma_count
  FROM dma_rows GROUP BY term, week
)
SELECT term, week, score, rank, percent_gain, dma_count FROM national ORDER BY term, week;
`;
