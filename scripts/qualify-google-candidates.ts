import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { RawObservation } from "../lib/data-source";
import { qualifyTrendCandidate, type QualificationLabel, type TrendCandidate } from "../lib/product-identity";

const inputPath = process.argv[2] ?? path.join(process.cwd(), "data", "generated", "google-trends-observations.json");
const shouldPersist = process.argv.includes("--persist");

type DiscoveryFile = {
  generatedAt: string;
  source: string;
  observations: RawObservation[];
};

// external key must match the productExternalId used by scripts/import-trend-candidates.ts
// (source+term, not source+market+term) so classification updates land on the same row
// that import created via trend_candidates(source, external_key).
type CandidateWithKey = TrendCandidate & { externalKey: string };

const CLASSIFICATION_BY_LABEL: Record<QualificationLabel, string> = {
  PRODUCT: "product",
  NON_PRODUCT: "non_product",
  REVIEW: "ambiguous",
};

async function main() {
  const raw = JSON.parse(await readFile(inputPath, "utf8")) as DiscoveryFile;
  const unique = new Map<string, CandidateWithKey>();

  for (const observation of raw.observations) {
    const key = observation.productExternalId;
    const existing = unique.get(key);
    if (!existing || (observation.observedAt ?? "") > (existing.observedAt ?? "")) {
      unique.set(key, {
        term: observation.productName,
        market: observation.market,
        source: observation.source,
        observedAt: observation.observedAt,
        externalKey: key,
      });
    }
  }

  const qualified = [...unique.values()].map((candidate) => ({
    candidate,
    qualification: qualifyTrendCandidate(candidate),
  }));

  const stats = qualified.reduce<Record<string, number>>((acc, item) => {
    acc[item.qualification.label] = (acc[item.qualification.label] ?? 0) + 1;
    return acc;
  }, {});

  const outputDir = path.join(process.cwd(), "data", "generated");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "product-candidates.json");
  await writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), stats, candidates: qualified }, null, 2), "utf8");

  console.log(`Qualified ${qualified.length} unique terms.`);
  console.log(stats);
  console.log(`Wrote ${outputPath}`);

  if (shouldPersist) await persistCandidates(qualified);
}

/**
 * Updates classification on trend_candidates rows that scripts/import-trend-candidates.ts
 * already created (source, external_key). This does not upsert new rows: qualification
 * without a prior import has nothing to classify, so it is reported as skipped rather
 * than silently creating a partial row with a schema that doesn't match trend_candidates.
 */
async function persistCandidates(rows: Array<{ candidate: CandidateWithKey; qualification: ReturnType<typeof qualifyTrendCandidate> }>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --persist");

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
  let updated = 0;
  let skipped = 0;

  for (const { candidate, qualification } of rows) {
    const { data, error } = await supabase
      .from("trend_candidates")
      .update({ classification: CLASSIFICATION_BY_LABEL[qualification.label] })
      .eq("source", candidate.source)
      .eq("external_key", candidate.externalKey)
      .select("id");

    if (error) throw error;
    if (data?.length) updated += 1;
    else skipped += 1;
  }

  console.log(`Updated classification for ${updated} trend candidates.`);
  if (skipped) console.log(`Skipped ${skipped} candidates with no matching row — run "npm run trends:import" first.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
