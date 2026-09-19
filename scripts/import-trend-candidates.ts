import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RawObservation } from "../lib/data-source";

type DiscoveryFile = {
  generatedAt: string;
  source: string;
  observationCount: number;
  observations: RawObservation[];
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env ${name}`);
  return value;
}

async function main() {
  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const inputPath = process.argv[2] || path.join(process.cwd(), "data", "generated", "google-trends-observations.json");
  const payload = JSON.parse(await readFile(inputPath, "utf8")) as DiscoveryFile;

  const grouped = new Map<string, RawObservation[]>();
  for (const observation of payload.observations) {
    const key = observation.productExternalId;
    const list = grouped.get(key) ?? [];
    list.push(observation);
    grouped.set(key, list);
  }

  let candidates = 0;
  let observations = 0;

  for (const [externalKey, rows] of grouped) {
    const ordered = [...rows].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const first = ordered[0];
    const last = ordered[ordered.length - 1];

    const { data: candidate, error: candidateError } = await supabase
      .from("trend_candidates")
      .upsert(
        {
          source: first.source,
          external_key: externalKey,
          canonical_term: first.productName,
          first_seen_at: first.observedAt,
          last_seen_at: last.observedAt,
          metadata: { discovery_batch: payload.generatedAt },
        },
        { onConflict: "source,external_key" }
      )
      .select("id")
      .single();

    if (candidateError) throw candidateError;
    candidates += 1;

    const obsRows = rows.map((row) => ({
      candidate_id: candidate.id,
      market_code: row.market,
      observed_at: row.observedAt,
      signal_type: row.signalType,
      value: row.value,
      unit: row.unit ?? null,
      confidence: row.confidence,
      metadata: row.metadata ?? {},
    }));

    for (let i = 0; i < obsRows.length; i += 500) {
      const chunk = obsRows.slice(i, i + 500);
      const { error } = await supabase
        .from("trend_candidate_observations")
        .upsert(chunk, { onConflict: "candidate_id,market_code,observed_at,signal_type" });
      if (error) throw error;
      observations += chunk.length;
    }
  }

  console.log(`Imported ${candidates} candidates and ${observations} observations.`);
  console.log("Candidates remain unclassified until product qualification/matching promotes them into the products table.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
