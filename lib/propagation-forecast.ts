import type { MarketCode } from "./arbitra";
import type { BreakoutEvent, PropagationEdge } from "./historical-engine";

export type PropagationForecast = {
  targetMarket: MarketCode;
  probability: number;
  confidence: number;
  expectedWindowDays: { min: number | null; max: number | null };
  evidence: Array<{
    sourceMarket: MarketCode;
    sourceBreakoutAt: string;
    transitionProbability: number;
    sampleSize: number;
    medianLagDays: number | null;
  }>;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Combine empirically learned propagation edges for markets that already broke out.
 * Uses a noisy-OR combination so multiple independent upstream confirmations increase
 * probability without simply averaging strong signals away.
 */
export function forecastFromPropagation({
  category,
  targetMarket,
  productBreakouts,
  edges,
}: {
  category: string;
  targetMarket: MarketCode;
  productBreakouts: BreakoutEvent[];
  edges: PropagationEdge[];
}): PropagationForecast {
  const evidence = productBreakouts
    .filter((event) => event.market !== targetMarket)
    .flatMap((event) => {
      const edge = edges.find(
        (candidate) =>
          candidate.category === category &&
          candidate.sourceMarket === event.market &&
          candidate.targetMarket === targetMarket,
      );
      return edge
        ? [{
            sourceMarket: event.market,
            sourceBreakoutAt: event.date,
            transitionProbability: edge.transitionProbability,
            sampleSize: edge.sampleSize,
            medianLagDays: edge.medianLagDays,
            p25LagDays: edge.p25LagDays,
            p75LagDays: edge.p75LagDays,
          }]
        : [];
    })
    .filter((item) => item.sampleSize > 0)
    .sort((a, b) => b.transitionProbability - a.transitionProbability);

  const probability = evidence.length
    ? 1 - evidence.reduce((remaining, item) => remaining * (1 - clamp01(item.transitionProbability)), 1)
    : 0;

  const totalSamples = evidence.reduce((sum, item) => sum + item.sampleSize, 0);
  const sampleConfidence = 1 - Math.exp(-totalSamples / 25);
  const agreementConfidence = evidence.length >= 3 ? 1 : evidence.length / 3;
  const confidence = clamp01(sampleConfidence * 0.75 + agreementConfidence * 0.25);

  const lowerBounds = evidence.map((item) => item.p25LagDays).filter((n): n is number => n !== null);
  const upperBounds = evidence.map((item) => item.p75LagDays).filter((n): n is number => n !== null);

  return {
    targetMarket,
    probability: Math.round(probability * 100),
    confidence: Math.round(confidence * 100),
    expectedWindowDays: {
      min: lowerBounds.length ? Math.max(0, Math.round(Math.min(...lowerBounds))) : null,
      max: upperBounds.length ? Math.max(0, Math.round(Math.max(...upperBounds))) : null,
    },
    evidence: evidence.map(({ p25LagDays: _p25, p75LagDays: _p75, ...item }) => item),
  };
}
