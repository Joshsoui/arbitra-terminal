import type { MarketCode } from "./arbitra";
import type { RawObservation } from "./data-source";
import type { DailyObservation } from "./historical-engine";

export type ProductIdentity = {
  productId: string;
  category: string;
  externalIds: string[];
};

export type ProductResolver = (observation: RawObservation) => ProductIdentity | null;

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

function normalizeSignal(observation: RawObservation) {
  switch (observation.signalType) {
    case "search_interest":
    case "social_velocity":
    case "ad_activity":
    case "review_velocity":
      return clamp(observation.value);
    case "marketplace_rank":
      // Lower rank is stronger. Log-like buckets avoid treating rank 1 vs 2 as huge.
      if (observation.value <= 10) return 100;
      if (observation.value <= 100) return 85;
      if (observation.value <= 1_000) return 70;
      if (observation.value <= 10_000) return 50;
      if (observation.value <= 100_000) return 25;
      return 10;
    case "seller_count":
      // Seller count is retained separately and not treated as demand.
      return null;
    case "price":
      return null;
    default:
      return null;
  }
}

/**
 * Convert heterogeneous source observations to one daily 0-100 demand index.
 * Confidence weights reduce the impact of weak estimates. Search remains the
 * anchor signal, while social/reviews/marketplace add corroboration.
 */
export function aggregateDailyObservations(
  observations: RawObservation[],
  resolveProduct: ProductResolver,
): DailyObservation[] {
  type Accumulator = {
    productId: string;
    category: string;
    market: MarketCode;
    date: string;
    demandWeighted: number;
    demandWeight: number;
    socialWeighted: number;
    socialWeight: number;
    adWeighted: number;
    adWeight: number;
    sellerCount?: number;
    retailPrice?: number;
  };

  const rows = new Map<string, Accumulator>();

  for (const observation of observations) {
    const identity = resolveProduct(observation);
    if (!identity) continue;
    const date = observation.observedAt.slice(0, 10);
    const key = `${identity.productId}:${observation.market}:${date}`;
    const row = rows.get(key) ?? {
      productId: identity.productId,
      category: identity.category,
      market: observation.market,
      date,
      demandWeighted: 0,
      demandWeight: 0,
      socialWeighted: 0,
      socialWeight: 0,
      adWeighted: 0,
      adWeight: 0,
    };

    const confidence = clamp(observation.confidence, 0, 1);
    const normalized = normalizeSignal(observation);

    if (normalized !== null) {
      const sourceWeight = observation.signalType === "search_interest" ? 1.0
        : observation.signalType === "marketplace_rank" ? 0.9
        : observation.signalType === "review_velocity" ? 0.75
        : observation.signalType === "social_velocity" ? 0.65
        : 0.5;
      const weight = sourceWeight * confidence;
      row.demandWeighted += normalized * weight;
      row.demandWeight += weight;
    }

    if (observation.signalType === "social_velocity" && normalized !== null) {
      row.socialWeighted += normalized * confidence;
      row.socialWeight += confidence;
    }
    if (observation.signalType === "ad_activity" && normalized !== null) {
      row.adWeighted += normalized * confidence;
      row.adWeight += confidence;
    }
    if (observation.signalType === "seller_count") row.sellerCount = observation.value;
    if (observation.signalType === "price") row.retailPrice = observation.value;

    rows.set(key, row);
  }

  return [...rows.values()]
    .map((row) => ({
      productId: row.productId,
      category: row.category,
      market: row.market,
      date: row.date,
      demandIndex: Number((row.demandWeight ? row.demandWeighted / row.demandWeight : 0).toFixed(2)),
      socialIndex: row.socialWeight ? Number((row.socialWeighted / row.socialWeight).toFixed(2)) : undefined,
      adIndex: row.adWeight ? Number((row.adWeighted / row.adWeight).toFixed(2)) : undefined,
      sellerCount: row.sellerCount,
      retailPrice: row.retailPrice,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
