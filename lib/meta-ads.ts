import type { MarketCode } from "./arbitra";
import type { PaidSocialSignal } from "./paid-social";

const MARKET_COUNTRY: Record<MarketCode, string> = {
  US:"US", CA:"CA", MX:"MX", BR:"BR", UK:"GB", DE:"DE", FR:"FR", NL:"NL", BE:"BE", ES:"ES", IT:"IT", SE:"SE", PL:"PL", AU:"AU", JP:"JP", KR:"KR", IN:"IN",
};

type MetaAd = { id?: string; page_id?: string; ad_creation_time?: string; ad_delivery_start_time?: string; ad_delivery_stop_time?: string };

export class MetaAdLibrarySource {
  constructor(private token = process.env.META_AD_LIBRARY_ACCESS_TOKEN, private apiVersion = process.env.META_GRAPH_API_VERSION ?? "v24.0") {}

  async signal(query: string, market: MarketCode): Promise<PaidSocialSignal> {
    if (!this.token) throw new Error("Missing META_AD_LIBRARY_ACCESS_TOKEN");
    const params = new URLSearchParams({
      access_token: this.token,
      search_terms: query,
      ad_reached_countries: JSON.stringify([MARKET_COUNTRY[market]]),
      ad_active_status: "ALL",
      ad_type: "ALL",
      fields: "id,page_id,ad_creation_time,ad_delivery_start_time,ad_delivery_stop_time",
      limit: "100",
    });
    const response = await fetch(`https://graph.facebook.com/${this.apiVersion}/ads_archive?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Meta Ad Library failed: ${response.status} ${await response.text()}`);
    const payload = await response.json() as { data?: MetaAd[] };
    const ads = payload.data ?? [];
    const now = Date.now();
    const sevenDays = 7 * 86400000;
    const active = ads.filter((ad) => !ad.ad_delivery_stop_time || new Date(ad.ad_delivery_stop_time).getTime() >= now);
    const newAds7d = ads.filter((ad) => {
      const date = ad.ad_delivery_start_time ?? ad.ad_creation_time;
      return date ? now - new Date(date).getTime() <= sevenDays : false;
    }).length;
    const advertisers = new Set(ads.map((ad) => ad.page_id).filter(Boolean)).size;
    const ages = ads.map((ad) => ad.ad_delivery_start_time ?? ad.ad_creation_time).filter(Boolean).map((date) => Math.max(0, (now - new Date(date!).getTime()) / 86400000)).sort((a,b)=>a-b);
    return {
      source: "meta", market, observedAt: new Date().toISOString(), activeAds: active.length,
      uniqueAdvertisers: advertisers, newAds7d, adGrowth7d: ads.length ? (newAds7d / ads.length) * 100 : 0,
      medianAdAgeDays: ages.length ? ages[Math.floor(ages.length / 2)] : undefined,
      creativeCount: ads.length, confidence: ads.length >= 20 ? 0.85 : ads.length ? 0.65 : 0.45,
    };
  }
}
