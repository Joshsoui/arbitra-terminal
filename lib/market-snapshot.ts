import type { MarketCode, MarketSignal } from "./arbitra";
import type { DailyObservation } from "./historical-engine";
import type { PaidSocialSignal } from "./paid-social";

export type MarketSnapshotCoverage = {
  hasSearchSignal: boolean;
  hasAdSignal: boolean;
  hasMarketplaceSignal: boolean;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

// Fields with no wired source yet get this neutral value rather than 0. 0 would
// read as "no competition at all", which silently biases calculateForecast's
// opportunityScore upward — a missing signal must not look like a good signal.
const NEUTRAL = 50;

/**
 * Turns a per-market demand time series (already normalized 0-100 by
 * lib/normalization.ts) plus an optional live Meta Ad Library signal into the
 * MarketSignal shape lib/arbitra.ts's calculateForecast expects.
 *
 * Only Google Trends (search) and Meta Ad Library are wired as of this phase.
 * marketplaceCompetition has no source yet (bol.com/Amazon aren't part of the
 * promotion pipeline), so it always comes back neutral — tracked explicitly in
 * `coverage` rather than silently guessed at.
 */
export function buildMarketSignal({
  market,
  series,
  meta,
  trailingPeriods = 8,
}: {
  market: MarketCode;
  series: DailyObservation[];
  meta?: PaidSocialSignal;
  /** Window size in *observations*, not calendar days — Google Trends rows can be weekly. */
  trailingPeriods?: number;
}): { signal: MarketSignal; coverage: MarketSnapshotCoverage } {
  const ordered = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const latest = ordered[ordered.length - 1];
  const momentum = latest ? clamp(latest.demandIndex) : NEUTRAL;

  const baselineWindow = ordered.slice(Math.max(0, ordered.length - 1 - trailingPeriods), ordered.length - 1);
  const baseline = baselineWindow.length
    ? baselineWindow.reduce((sum, row) => sum + row.demandIndex, 0) / baselineWindow.length
    : momentum;
  // Centered on 50 = "no change vs. its own recent baseline", not an absolute level.
  const acceleration = ordered.length > 1 ? clamp(NEUTRAL + (momentum - baseline)) : NEUTRAL;

  const metaSaturation = meta
    ? clamp((meta.uniqueAdvertisers ?? 0) * 3 + (meta.activeAds ?? 0) * 0.35 + Math.max(0, meta.adGrowth7d ?? 0) * 0.25)
    : null;

  return {
    signal: {
      market,
      momentum,
      acceleration,
      saturation: metaSaturation ?? NEUTRAL,
      adActivity: metaSaturation ?? NEUTRAL,
      marketplaceCompetition: NEUTRAL,
    },
    coverage: {
      hasSearchSignal: ordered.length > 0,
      hasAdSignal: metaSaturation !== null,
      hasMarketplaceSignal: false,
    },
  };
}

export function coverageFraction(coverage: MarketSnapshotCoverage): number {
  const flags = [coverage.hasSearchSignal, coverage.hasAdSignal, coverage.hasMarketplaceSignal];
  return Number((flags.filter(Boolean).length / flags.length).toFixed(2));
}
