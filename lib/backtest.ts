import type { MarketCode } from "./arbitra";
import { buildPropagationGraph, type BreakoutEvent } from "./historical-engine";
import { forecastFromPropagation } from "./propagation-forecast";

export type BacktestPrediction = {
  productId: string;
  category: string;
  targetMarket: MarketCode;
  cutoffDate: string;
  probability: number;
  confidence: number;
  actualBreakout: boolean;
  actualLagDays: number | null;
};

export type BacktestReport = {
  predictions: number;
  positives: number;
  brierScore: number | null;
  logLoss: number | null;
  calibration: Array<{
    bucket: string;
    predictions: number;
    meanPredicted: number | null;
    observedRate: number | null;
  }>;
  rows: BacktestPrediction[];
};

const MS_PER_DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);

function evaluateCalibration(rows: BacktestPrediction[]) {
  return Array.from({ length: 10 }, (_, index) => {
    const min = index * 10;
    const max = index === 9 ? 100 : min + 9;
    const matches = rows.filter((row) => row.probability >= min && row.probability <= max);
    return {
      bucket: `${min}-${max}`,
      predictions: matches.length,
      meanPredicted: matches.length
        ? Number((matches.reduce((sum, row) => sum + row.probability, 0) / matches.length).toFixed(1))
        : null,
      observedRate: matches.length
        ? Number(((matches.filter((row) => row.actualBreakout).length / matches.length) * 100).toFixed(1))
        : null,
    };
  });
}

/**
 * Walk-forward backtest. For every product cutoff, propagation edges are learned only
 * from OTHER products whose breakout events occurred before the cutoff. This prevents
 * the target product and future information leaking into its own forecast.
 */
export function runPropagationBacktest({
  events,
  targetMarkets = ["US", "UK", "DE", "NL"],
  horizonDays = 30,
  minHistoricalProducts = 8,
}: {
  events: BreakoutEvent[];
  targetMarkets?: MarketCode[];
  horizonDays?: number;
  minHistoricalProducts?: number;
}): BacktestReport {
  const byProduct = new Map<string, BreakoutEvent[]>();
  for (const event of events) {
    const list = byProduct.get(event.productId) ?? [];
    list.push(event);
    byProduct.set(event.productId, list);
  }

  const rows: BacktestPrediction[] = [];

  for (const [productId, productEventsUnsorted] of byProduct.entries()) {
    const productEvents = [...productEventsUnsorted].sort((a, b) => a.date.localeCompare(b.date));
    if (!productEvents.length) continue;
    const category = productEvents[0].category;

    // Generate a forecast after each newly observed breakout, before the next target market event.
    for (let observationIndex = 0; observationIndex < productEvents.length; observationIndex += 1) {
      const cutoff = productEvents[observationIndex].date;
      const knownEvents = productEvents.filter((event) => event.date <= cutoff);
      const historicalEvents = events.filter(
        (event) => event.productId !== productId && event.date < cutoff,
      );
      const historicalProducts = new Set(historicalEvents.map((event) => event.productId));
      if (historicalProducts.size < minHistoricalProducts) continue;

      const edges = buildPropagationGraph(historicalEvents);

      for (const targetMarket of targetMarkets) {
        if (knownEvents.some((event) => event.market === targetMarket)) continue;

        const forecast = forecastFromPropagation({
          category,
          targetMarket,
          productBreakouts: knownEvents,
          edges,
        });
        if (!forecast.evidence.length) continue;

        const futureTarget = productEvents
          .filter((event) => event.market === targetMarket && event.date > cutoff)
          .map((event) => ({ event, lag: daysBetween(cutoff, event.date) }))
          .filter(({ lag }) => lag > 0)
          .sort((a, b) => a.lag - b.lag)[0];

        rows.push({
          productId,
          category,
          targetMarket,
          cutoffDate: cutoff,
          probability: forecast.probability,
          confidence: forecast.confidence,
          actualBreakout: Boolean(futureTarget && futureTarget.lag <= horizonDays),
          actualLagDays: futureTarget?.lag ?? null,
        });
      }
    }
  }

  const brierScore = rows.length
    ? rows.reduce((sum, row) => {
        const p = row.probability / 100;
        const y = row.actualBreakout ? 1 : 0;
        return sum + (p - y) ** 2;
      }, 0) / rows.length
    : null;

  const epsilon = 1e-6;
  const logLoss = rows.length
    ? -rows.reduce((sum, row) => {
        const p = Math.min(1 - epsilon, Math.max(epsilon, row.probability / 100));
        return sum + (row.actualBreakout ? Math.log(p) : Math.log(1 - p));
      }, 0) / rows.length
    : null;

  return {
    predictions: rows.length,
    positives: rows.filter((row) => row.actualBreakout).length,
    brierScore: brierScore === null ? null : Number(brierScore.toFixed(4)),
    logLoss: logLoss === null ? null : Number(logLoss.toFixed(4)),
    calibration: evaluateCalibration(rows),
    rows,
  };
}
