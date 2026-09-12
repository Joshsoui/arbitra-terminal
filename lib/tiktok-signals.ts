import type { MarketCode } from "./arbitra";
import type { PaidSocialSignal } from "./paid-social";

// TikTok Creative Center is a valuable public discovery surface, but ARBITRA does
// not scrape it. Production ingestion must use an approved TikTok API/export or
// licensed provider. This adapter accepts that normalized feed when configured.
export class TikTokTrendSource {
  constructor(private endpoint = process.env.TIKTOK_TREND_API_ENDPOINT, private token = process.env.TIKTOK_TREND_API_TOKEN) {}

  async signal(query: string, market: MarketCode): Promise<PaidSocialSignal> {
    if (!this.endpoint || !this.token) {
      throw new Error("TikTok trend feed is not configured. Use an approved TikTok API/export or licensed provider; Creative Center is not scraped by ARBITRA.");
    }
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, market }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`TikTok trend feed failed: ${response.status}`);
    const data = await response.json() as { trendVelocity?: number; creatorGrowth?: number; engagementVelocity?: number; activeAds?: number; creativeCount?: number; confidence?: number };
    return {
      source: "tiktok", market, observedAt: new Date().toISOString(), trendVelocity: data.trendVelocity,
      creatorGrowth: data.creatorGrowth, engagementVelocity: data.engagementVelocity, activeAds: data.activeAds,
      creativeCount: data.creativeCount, confidence: data.confidence ?? 0.75,
    };
  }
}
