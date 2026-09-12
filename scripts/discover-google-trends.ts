import { BigQuery } from "@google-cloud/bigquery";
import { writeFile } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  INTERNATIONAL_DISCOVERY_SQL,
  US_DISCOVERY_SQL,
  mapGoogleCountryCode,
  normalizeGoogleTrendsRow,
  type GoogleTrendsRow,
} from "../lib/google-trends";
import type { RawObservation } from "../lib/data-source";

function toDateString(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 10);
  if (value && typeof value === "object" && "value" in value) {
    return String((value as { value: unknown }).value).slice(0, 10);
  }
  return String(value).slice(0, 10);
}

async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID;
  const bigquery = new BigQuery(projectId ? { projectId } : undefined);

  console.log("ARBITRA Google Trends discovery: querying international rising terms...");
  const [internationalRows] = await bigquery.query({ query: INTERNATIONAL_DISCOVERY_SQL, location: "US" });

  console.log("ARBITRA Google Trends discovery: querying US rising terms...");
  const [usRows] = await bigquery.query({ query: US_DISCOVERY_SQL, location: "US" });

  const observations: RawObservation[] = [];

  for (const row of internationalRows as Record<string, unknown>[]) {
    const market = mapGoogleCountryCode(String(row.country_code ?? ""));
    if (!market) continue;

    const normalized: GoogleTrendsRow = {
      market,
      term: String(row.term ?? "").trim(),
      week: toDateString(row.week),
      score: Number(row.score ?? 0),
      rank: Number(row.rank ?? 0),
      percentGain: row.percent_gain == null ? null : Number(row.percent_gain),
      regionCode: row.region_code == null ? null : String(row.region_code),
      regionName: row.region_name == null ? null : String(row.region_name),
    };

    if (!normalized.term || !normalized.week) continue;
    observations.push(...normalizeGoogleTrendsRow(normalized));
  }

  for (const row of usRows as Record<string, unknown>[]) {
    const normalized: GoogleTrendsRow = {
      market: "US",
      term: String(row.term ?? "").trim(),
      week: toDateString(row.week),
      score: Number(row.score ?? 0),
      rank: Number(row.rank ?? 0),
      percentGain: row.percent_gain == null ? null : Number(row.percent_gain),
      regionCode: "US-NATIONAL-PROXY",
      regionName: "United States DMA aggregate",
    };

    if (!normalized.term || !normalized.week) continue;
    observations.push(...normalizeGoogleTrendsRow(normalized));
  }

  const byMarket = observations.reduce<Record<string, number>>((acc, item) => {
    acc[item.market] = (acc[item.market] ?? 0) + 1;
    return acc;
  }, {});

  const outputDir = path.join(process.cwd(), "data", "generated");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "google-trends-observations.json");
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "bigquery-public-data.google_trends",
        markets: byMarket,
        observationCount: observations.length,
        observations,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote ${observations.length} observations to ${outputPath}`);
  console.log(byMarket);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
