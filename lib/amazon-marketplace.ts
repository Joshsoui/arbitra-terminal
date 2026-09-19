import type { MarketCode } from "./arbitra";
import type { MarketplaceIntelligenceSource, MarketplaceSearchSnapshot } from "./marketplace";

// Amazon Product Advertising API 5.0 was deprecated in May 2026.
// ARBITRA targets the replacement Creators API behind this adapter.
export class AmazonMarketplaceSource implements MarketplaceIntelligenceSource {
  id = "amazon-creators";
  markets: MarketCode[] = ["US","CA","MX","BR","UK","DE","FR","NL","BE","ES","IT","SE","PL","AU","JP","IN"];

  constructor(
    private endpoint = process.env.AMAZON_CREATORS_API_ENDPOINT,
    private token = process.env.AMAZON_CREATORS_API_TOKEN,
  ) {}

  async search(query: string, market: MarketCode): Promise<MarketplaceSearchSnapshot> {
    if (!this.markets.includes(market)) throw new Error(`Amazon adapter not configured for ${market}`);
    if (!this.endpoint || !this.token) {
      throw new Error("Amazon Creators API is not configured. Set AMAZON_CREATORS_API_ENDPOINT and AMAZON_CREATORS_API_TOKEN after access is approved.");
    }
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ operation: "searchItems", query, market }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Amazon Creators API failed: ${response.status}`);
    const payload = await response.json() as { items?: Array<{ asin: string; title: string; price?: number; currency?: string; rank?: number }> };
    return {
      source: this.id,
      market,
      query,
      observedAt: new Date().toISOString(),
      products: (payload.items ?? []).map((item) => ({ externalId:item.asin, asin:item.asin, title:item.title, market, source:this.id, price:item.price, currency:item.currency, rank:item.rank })),
    };
  }
}
