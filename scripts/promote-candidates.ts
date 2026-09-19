import { createClient } from "@supabase/supabase-js";
import type { MarketCode } from "../lib/arbitra";
import type { RawObservation } from "../lib/data-source";
import { aggregateDailyObservations } from "../lib/normalization";
import { buildMarketSignal, coverageFraction } from "../lib/market-snapshot";
import { MetaAdLibrarySource } from "../lib/meta-ads";
import { suggestCanonicalName } from "../lib/product-identity";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env ${name}`);
  return value;
}

type CandidateRow = {
  id: string;
  source: string;
  external_key: string;
  canonical_term: string;
  product_id: string | null;
};

type ObservationRow = {
  market_code: MarketCode;
  observed_at: string;
  signal_type: RawObservation["signalType"];
  value: number;
  unit: string | null;
  confidence: number;
  metadata: Record<string, unknown> | null;
};

async function main() {
  const supabase = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const metaConfigured = Boolean(process.env.META_AD_LIBRARY_ACCESS_TOKEN);
  const meta = metaConfigured ? new MetaAdLibrarySource() : null;
  if (!metaConfigured) console.log("META_AD_LIBRARY_ACCESS_TOKEN not set — ad_activity/saturation will stay neutral for this run.");

  const { data: candidates, error: candidatesError } = await supabase
    .from("trend_candidates")
    .select("id, source, external_key, canonical_term, product_id")
    .eq("classification", "product")
    .returns<CandidateRow[]>();
  if (candidatesError) throw candidatesError;
  if (!candidates?.length) {
    console.log("No candidates classified as 'product' yet — nothing to promote.");
    return;
  }

  let productsCreated = 0;
  let snapshotsWritten = 0;

  for (const candidate of candidates) {
    let productId = candidate.product_id;
    if (!productId) {
      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({ canonical_name: suggestCanonicalName(candidate.canonical_term) })
        .select("id")
        .single();
      if (productError) throw productError;
      productId = product.id as string;
      productsCreated += 1;

      const { error: linkError } = await supabase.from("trend_candidates").update({ product_id: productId }).eq("id", candidate.id);
      if (linkError) throw linkError;
    }

    const { data: observations, error: observationsError } = await supabase
      .from("trend_candidate_observations")
      .select("market_code, observed_at, signal_type, value, unit, confidence, metadata")
      .eq("candidate_id", candidate.id)
      .returns<ObservationRow[]>();
    if (observationsError) throw observationsError;
    if (!observations?.length) continue;

    const rawObservations: RawObservation[] = observations.map((row) => ({
      productExternalId: candidate.external_key,
      productName: candidate.canonical_term,
      market: row.market_code,
      observedAt: row.observed_at,
      source: candidate.source,
      signalType: row.signal_type,
      value: Number(row.value),
      unit: row.unit ?? undefined,
      confidence: Number(row.confidence),
      metadata: row.metadata ?? undefined,
    }));

    const daily = aggregateDailyObservations(rawObservations, () => ({
      productId: candidate.id,
      category: "Uncategorized",
      externalIds: [candidate.external_key],
    }));

    const markets = [...new Set(daily.map((row) => row.market))];
    const snapshotDate = new Date().toISOString().slice(0, 10);

    for (const market of markets) {
      const series = daily.filter((row) => row.market === market);

      let metaSignal;
      if (meta) {
        try {
          metaSignal = await meta.signal(candidate.canonical_term, market);
        } catch (error) {
          console.log(`Meta signal failed for "${candidate.canonical_term}" in ${market}: ${error instanceof Error ? error.message : error}`);
        }
      }

      const { signal, coverage } = buildMarketSignal({ market, series, meta: metaSignal });

      const { error: snapshotError } = await supabase.from("market_snapshots").upsert(
        {
          product_id: productId,
          market_code: market,
          snapshot_date: snapshotDate,
          momentum: signal.momentum,
          acceleration: signal.acceleration,
          saturation: signal.saturation,
          ad_activity: signal.adActivity,
          marketplace_competition: signal.marketplaceCompetition,
          source_coverage: coverageFraction(coverage),
        },
        { onConflict: "product_id,market_code,snapshot_date" },
      );
      if (snapshotError) throw snapshotError;
      snapshotsWritten += 1;
    }
  }

  console.log(`Promoted ${candidates.length} qualified candidates: ${productsCreated} new products, ${snapshotsWritten} market snapshots written/updated.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
