import type { MarketCode } from "./arbitra";
import type { MarketplaceIntelligenceSource, MarketplaceProduct, MarketplaceSearchSnapshot } from "./marketplace";

const BOL_API = "https://api.bol.com/retailer";

type BolToken = { access_token: string; expires_in: number };

export class BolMarketplaceSource implements MarketplaceIntelligenceSource {
  id = "bol";
  markets: MarketCode[] = ["NL", "BE"];
  private token?: { value: string; expiresAt: number };

  constructor(private clientId = process.env.BOL_CLIENT_ID, private clientSecret = process.env.BOL_CLIENT_SECRET) {}

  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    if (!this.clientId || !this.clientSecret) throw new Error("Missing BOL_CLIENT_ID/BOL_CLIENT_SECRET");
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch("https://login.bol.com/token?grant_type=client_credentials", {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`bol auth failed: ${response.status}`);
    const json = (await response.json()) as BolToken;
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.accessToken();
    const response = await fetch(`${BOL_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.retailer.v10+json",
        "Content-Type": "application/vnd.retailer.v10+json",
        "Accept-Language": "nl-NL",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`bol request ${path} failed: ${response.status} ${await response.text()}`);
    return response.json() as Promise<T>;
  }

  async searchVolume(query: string) {
    const encoded = encodeURIComponent(query);
    return this.request<{ searchTerms?: Array<{ searchTerm?: string; total?: number; periods?: Array<{ value?: number }> }> }>(
      `/insights/search-terms?search-term=${encoded}&period=WEEK&number-of-periods=1&related=false`,
    );
  }

  async productList(query: string, countryCode: "NL" | "BE") {
    return this.request<{ products?: Array<{ ean: string; title: string }>; hasNextPage?: boolean }>("/products/list", {
      method: "POST",
      body: JSON.stringify({ countryCode, searchTerm: query, page: 1 }),
    });
  }

  async competingOffers(ean: string, countryCode: "NL" | "BE") {
    return this.request<{ offers?: Array<{ offerId?: string; retailerId?: string; price?: number; bestOffer?: boolean }> }>(
      `/products/${encodeURIComponent(ean)}/offers?country-code=${countryCode}`,
    );
  }

  async search(query: string, market: MarketCode): Promise<MarketplaceSearchSnapshot> {
    if (market !== "NL" && market !== "BE") throw new Error(`bol adapter supports NL/BE, got ${market}`);
    const countryCode = market;
    const observedAt = new Date().toISOString();
    const [volume, list] = await Promise.all([this.searchVolume(query), this.productList(query, countryCode)]);
    const searchVolume = volume.searchTerms?.[0]?.total ?? volume.searchTerms?.[0]?.periods?.[0]?.value;
    const top = (list.products ?? []).slice(0, 20);
    const products: MarketplaceProduct[] = await Promise.all(top.map(async (item, index) => {
      let offers: Awaited<ReturnType<BolMarketplaceSource["competingOffers"]>> | undefined;
      try { offers = await this.competingOffers(item.ean, countryCode); } catch { offers = undefined; }
      const offerList = offers?.offers ?? [];
      const prices = offerList.map((offer) => offer.price).filter((price): price is number => typeof price === "number");
      return {
        externalId: item.ean, ean: item.ean, title: item.title, market, source: this.id, rank: index + 1,
        sellerCount: offerList.length || undefined, price: prices.length ? Math.min(...prices) : undefined, currency: "EUR",
        metadata: { searchVolume, offerCount: offerList.length },
      };
    }));
    return { source: this.id, market, query, observedAt, searchVolume, products };
  }
}
