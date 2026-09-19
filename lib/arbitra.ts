export type MarketCode = "US" | "CA" | "MX" | "BR" | "UK" | "DE" | "FR" | "NL" | "BE" | "ES" | "IT" | "SE" | "PL" | "AU" | "JP" | "KR" | "IN";

export type MarketSignal = {
  market: MarketCode;
  momentum: number;
  acceleration: number;
  saturation: number;
  adActivity: number;
  marketplaceCompetition: number;
  retailPrice?: number;
  landedCost?: number;
  breakoutAt?: string;
};

export type ProductSnapshot = {
  id: string;
  name: string;
  category: string;
  signals: MarketSignal[];
};

export type Forecast = {
  targetMarket: MarketCode;
  breakoutProbability: number;
  confidence: number;
  opportunityScore: number;
  marginPercent: number;
  commercialScore: number;
  status: "WATCH" | "EMERGING" | "EARLY ENTRY" | "SATURATED";
  reasons: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculateForecast(product: ProductSnapshot, targetMarket: MarketCode): Forecast {
  const target = product.signals.find((signal) => signal.market === targetMarket);
  if (!target) throw new Error(`Missing target market ${targetMarket}`);

  const upstream = product.signals.filter((signal) => signal.market !== targetMarket);
  const upstreamMomentum = upstream.reduce((sum, signal) => sum + signal.momentum, 0) / Math.max(upstream.length, 1);
  const upstreamAcceleration = upstream.reduce((sum, signal) => sum + signal.acceleration, 0) / Math.max(upstream.length, 1);

  const propagation = clamp(upstreamMomentum * 0.55 + upstreamAcceleration * 0.45);
  const localEarlyFit = clamp(target.momentum * 0.45 + target.acceleration * 0.35 + (100 - target.saturation) * 0.2);
  const breakoutProbability = clamp(propagation * 0.62 + localEarlyFit * 0.38);

  const marginPercent = target.retailPrice && target.landedCost
    ? clamp(((target.retailPrice - target.landedCost) / target.retailPrice) * 100)
    : 50;

  const competitionHeadroom = clamp(100 - (target.saturation * 0.55 + target.marketplaceCompetition * 0.45));
  const commercialScore = clamp(marginPercent * 0.55 + competitionHeadroom * 0.45);
  const opportunityScore = clamp(breakoutProbability * 0.65 + commercialScore * 0.35);

  const confidence = clamp(
    45 +
      (upstream.length >= 3 ? 15 : upstream.length * 4) +
      (target.momentum > 0 ? 10 : 0) +
      (target.retailPrice && target.landedCost ? 10 : 0) +
      (target.marketplaceCompetition >= 0 ? 10 : 0)
  );

  let status: Forecast["status"] = "WATCH";
  if (target.saturation >= 75) status = "SATURATED";
  else if (opportunityScore >= 75 && breakoutProbability >= 65) status = "EARLY ENTRY";
  else if (breakoutProbability >= 50) status = "EMERGING";

  const reasons: string[] = [];
  if (upstreamMomentum >= 65) reasons.push("Strong upstream demand momentum");
  if (upstreamAcceleration >= 60) reasons.push("Cross-market acceleration detected");
  if (target.saturation <= 40) reasons.push("Target-market saturation remains low");
  if (marginPercent >= 50) reasons.push("Healthy estimated gross spread");
  if (target.adActivity <= 40) reasons.push("Advertising activity is still relatively low");

  return {
    targetMarket,
    breakoutProbability: Math.round(breakoutProbability),
    confidence: Math.round(confidence),
    opportunityScore: Math.round(opportunityScore),
    marginPercent: Math.round(marginPercent),
    commercialScore: Math.round(commercialScore),
    status,
    reasons,
  };
}

export type HistoricalCase = {
  predictedProbability: number;
  actualBreakout: boolean;
};

export function calibrationBuckets(cases: HistoricalCase[]) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ min: i * 10, max: i * 10 + 9, total: 0, hits: 0 }));
  for (const item of cases) {
    const index = Math.min(9, Math.floor(clamp(item.predictedProbability, 0, 99) / 10));
    buckets[index].total += 1;
    if (item.actualBreakout) buckets[index].hits += 1;
  }
  return buckets.map((bucket) => ({
    ...bucket,
    observedRate: bucket.total ? Math.round((bucket.hits / bucket.total) * 100) : null,
  }));
}
