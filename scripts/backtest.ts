import { calibrationBuckets, HistoricalCase } from "../lib/arbitra";

export type BacktestRow = HistoricalCase & {
  productId: string;
  targetMarket: string;
  forecastDate: string;
  horizonDays: number;
};

export function summarizeBacktest(rows: BacktestRow[]) {
  const total = rows.length;
  const positives = rows.filter((row) => row.actualBreakout).length;
  const brier = total
    ? rows.reduce((sum, row) => {
        const p = row.predictedProbability / 100;
        const y = row.actualBreakout ? 1 : 0;
        return sum + (p - y) ** 2;
      }, 0) / total
    : null;

  return {
    total,
    actualBreakouts: positives,
    baseRate: total ? positives / total : null,
    brierScore: brier,
    calibration: calibrationBuckets(rows),
  };
}

// Next step: load immutable historical forecasts + outcomes from Supabase,
// split by time (train on earlier periods, test on later unseen periods),
// and report calibration, precision at top-k, recall and lead time.
