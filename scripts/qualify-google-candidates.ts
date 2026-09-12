import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { RawObservation } from "../lib/data-source";
import { qualifyTrendCandidate, type TrendCandidate } from "../lib/product-identity";

const inputPath = process.argv[2] ?? path.join(process.cwd(), "data", "generated", "google-trends-observations.json");
const shouldPersist = process.argv.includes("--persist");

type DiscoveryFile = {
  generatedAt: string;
  source: string;
  observations: RawObservation[];
};

async function main() {
  const raw = JSON.parse(await readFile(inputPath, "utf8")) as DiscoveryFile;
  const unique = new Map<string, TrendCandidate>();

  for (const observation of raw.observations) {
    const key = `${observation.market}:${observation.productName.toLowerCase().trim()}`;
    const existing = unique.get(key);
    if (!existing || (observation.observedAt ?? "") > (existing.observedAt ?? "")) {
      unique.set(key, {
        term: observation.productName,
        market: observation.market,
        source: observation.source,
        observedAt: observation.observedAt,
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

async function persistCandidates(rows: Array<{ candidate: TrendCandidate; qualification: ReturnType<typeof qualifyTrendCandidate> }>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --persist");

  const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });
  const payload = rows.map(({ candidate, qualification }) => ({
    source: candidate.source,
    market_code: candidate.market,
    term: candidate.term,
    normalized_term: qualification.normalizedTerm,
    observed_at: candidate.observedAt ?? null,
    category_hint: candidate.categoryHint ?? null,
    qualification_label: qualification.label,
    qualification_confidence: qualification.confidence,
    qualification_reasons: qualification.reasons,
    metadata: { canonicalTokens: qualification.canonicalTokens, qualifierVersion: "identity-v0.1" },
  }));

  for (let i = 0; i < payload.length; i += 500) {
    const batch = payload.slice(i, i + 500);
    const { error } = await supabase.from("trend_candidates").upsert(batch, {
      onConflict: "source,market_code,term,observed_at",
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }

  console.log(`Persisted ${payload.length} candidates to Supabase.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
