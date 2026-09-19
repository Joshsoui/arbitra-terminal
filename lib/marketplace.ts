import type { MarketCode } from "./arbitra";
import type { RawObservation } from "./data-source";

export type MarketplaceProduct = {
  externalId: string;
  title: string;
  market: MarketCode;
  source: string;
  brand?: string;
  ean?: string;
  asin?: string;
  category?: string;
  price?: number;
  currency?: string;
  rank?: number;
  impressions?: number;
  sellerCount?: number;
  sponsored?: boolean;
  metadata?: Record<string, unknown>;
};

export type MarketplaceSearchSnapshot = {
  source: string;
  market: MarketCode;
  query: string;
  observedAt: string;
  searchVolume?: number;
  products: MarketplaceProduct[];
};

export interface MarketplaceIntelligenceSource {
  id: string;
  markets: MarketCode[];
  search(query: string, market: MarketCode): Promise<MarketplaceSearchSnapshot>;
}

export function marketplaceProductsToObservations(
  snapshot: MarketplaceSearchSnapshot,
): RawObservation[] {
  const observations: RawObservation[] = [];
  for (const product of snapshot.products) {
    const base = {
      productExternalId: product.externalId,
      productName: product.title,
      market: product.market,
      observedAt: snapshot.observedAt,
      source: product.source,
      confidence: 0.9,
      metadata: {
        query: snapshot.query,
        ean: product.ean,
        asin: product.asin,
        category: product.category,
        sponsored: product.sponsored,
        currency: product.currency,
        ...product.metadata,
      },
    };

    if (typeof product.rank === "number") observations.push({ ...base, signalType: "marketplace_rank", value: product.rank, unit: "rank" });
    if (typeof product.price === "number") observations.push({ ...base, signalType: "price", value: product.price, unit: product.currency ?? "currency" });
    if (typeof product.sellerCount === "number") observations.push({ ...base, signalType: "seller_count", value: product.sellerCount, unit: "sellers" });
  }
  return observations;
}
