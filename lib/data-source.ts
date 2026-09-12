import type { MarketCode } from "./arbitra";

export type RawObservation = {
  productExternalId: string;
  productName: string;
  market: MarketCode;
  observedAt: string;
  source: string;
  signalType: "search_interest" | "social_velocity" | "ad_activity" | "marketplace_rank" | "price" | "seller_count" | "review_velocity";
  value: number;
  unit?: string;
  confidence: number;
  metadata?: Record<string, unknown>;
};

export interface ProductDataSource {
  id: string;
  markets: MarketCode[];
  fetchObservations(input: { from: Date; to: Date; market: MarketCode }): Promise<RawObservation[]>;
}

export class DataSourceRegistry {
  private sources = new Map<string, ProductDataSource>();

  register(source: ProductDataSource) {
    this.sources.set(source.id, source);
  }

  list() {
    return [...this.sources.values()];
  }

  get(id: string) {
    return this.sources.get(id);
  }
}

// Production adapters should implement this interface. Planned first adapters:
// Google Trends/search demand, marketplace product/price/rank signals,
// Meta/TikTok ad activity and supplier/landed-cost estimates.
