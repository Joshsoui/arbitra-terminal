import type { MarketCode } from "./arbitra";

export type PaidSocialSignal = {
  source: "meta" | "tiktok";
  market: MarketCode;
  observedAt: string;
  activeAds?: number;
  uniqueAdvertisers?: number;
  newAds7d?: number;
  adGrowth7d?: number;
  medianAdAgeDays?: number;
  creativeCount?: number;
  trendVelocity?: number;
  creatorGrowth?: number;
  engagementVelocity?: number;
  confidence: number;
};

export type PaidSocialOpportunityInput = {
  demandProbability: number;
  meta?: PaidSocialSignal;
  tiktok?: PaidSocialSignal;
  marketplaceCompetition?: number;
  marginPercent?: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function calculatePaidSocialOpportunity(input: PaidSocialOpportunityInput) {
  const metaSaturation = input.meta
    ? clamp((input.meta.uniqueAdvertisers ?? 0) * 3 + (input.meta.activeAds ?? 0) * 0.35 + Math.max(0, input.meta.adGrowth7d ?? 0) * 0.25)
    : 45;
  const tiktokMomentum = input.tiktok
    ? clamp((input.tiktok.trendVelocity ?? 0) * 0.45 + (input.tiktok.creatorGrowth ?? 0) * 0.25 + (input.tiktok.engagementVelocity ?? 0) * 0.3)
    : 50;
  const competitionHeadroom = 100 - clamp(input.marketplaceCompetition ?? 50);
  const margin = clamp(input.marginPercent ?? 50);
  const score = clamp(
    input.demandProbability * 0.38 +
    (100 - metaSaturation) * 0.22 +
    tiktokMomentum * 0.2 +
    competitionHeadroom * 0.1 +
    margin * 0.1,
  );
  return {
    score: Math.round(score),
    metaSaturation: Math.round(metaSaturation),
    tiktokMomentum: Math.round(tiktokMomentum),
    status: score >= 80 ? "TEST NOW" : score >= 65 ? "EARLY TEST" : score >= 50 ? "WATCH" : "PASS",
  } as const;
}
