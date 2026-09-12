import type { MarketCode } from "./arbitra";

export type DailyObservation = {
  productId: string;
  category: string;
  market: MarketCode;
  date: string;
  demandIndex: number;
  socialIndex?: number;
  adIndex?: number;
  sellerCount?: number;
  retailPrice?: number;
};

export type BreakoutEvent = {
  productId: string;
  category: string;
  market: MarketCode;
  date: string;
  strength: number;
  baseline: number;
  velocity: number;
};

export type PropagationEdge = {
  category: string;
  sourceMarket: MarketCode;
  targetMarket: MarketCode;
  sampleSize: number;
  transitionProbability: number;
  medianLagDays: number | null;
  p25LagDays: number | null;
  p75LagDays: number | null;
};

const MS_PER_DAY = 86_400_000;
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const index = (ordered.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return ordered[lower];
  return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower);
}

/**
 * Detect a product breakout from its own recent history instead of using a fixed absolute threshold.
 * The detector requires both level and velocity so a permanently popular product is not repeatedly
 * classified as a new breakout.
 */
export function detectBreakouts(
  observations: DailyObservation[],
  options: { baselineDays?: number; minLiftPct?: number; minVelocity?: number } = {},
): BreakoutEvent[] {
  const baselineDays = options.baselineDays ?? 14;
  const minLiftPct = options.minLiftPct ?? 45;
  const minVelocity = options.minVelocity ?? 12;
  const groups = new Map<string, DailyObservation[]>();

  for (const observation of observations) {
    const key = `${observation.productId}:${observation.market}`;
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }

  const events: BreakoutEvent[] = [];

  for (const series of groups.values()) {
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
    let previousWasBreakout = false;

    for (let i = baselineDays; i < sorted.length; i += 1) {
      const current = sorted[i];
      const baselineWindow = sorted.slice(i - baselineDays, i);
      const baseline = baselineWindow.reduce((sum, row) => sum + row.demandIndex, 0) / baselineWindow.length;
      const prior = sorted[i - 1].demandIndex;
      const liftPct = baseline > 0 ? ((current.demandIndex - baseline) / baseline) * 100 : 0;
      const velocity = current.demandIndex - prior;
      const isBreakout = liftPct >= minLiftPct && velocity >= minVelocity;

      // Emit only on the first day of a breakout run.
      if (isBreakout && !previousWasBreakout) {
        events.push({
          productId: current.productId,
          category: current.category,
          market: current.market,
          date: current.date,
          baseline: Number(baseline.toFixed(2)),
          velocity: Number(velocity.toFixed(2)),
          strength: Number(clamp(liftPct).toFixed(2)),
        });
      }
      previousWasBreakout = isBreakout;
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Learn directional market-to-market transitions from detected breakouts.
 * A transition counts when target breaks out after source within maxLagDays.
 */
export function buildPropagationGraph(
  events: BreakoutEvent[],
  markets: MarketCode[] = ["US", "UK", "DE", "NL"],
  maxLagDays = 90,
): PropagationEdge[] {
  const products = new Map<string, BreakoutEvent[]>();
  for (const event of events) {
    const list = products.get(event.productId) ?? [];
    list.push(event);
    products.set(event.productId, list);
  }

  const categories = [...new Set(events.map((event) => event.category))];
  const edges: PropagationEdge[] = [];

  for (const category of categories) {
    for (const sourceMarket of markets) {
      for (const targetMarket of markets) {
        if (sourceMarket === targetMarket) continue;

        let sourceBreakouts = 0;
        const lags: number[] = [];

        for (const productEvents of products.values()) {
          const categoryEvents = productEvents.filter((event) => event.category === category);
          const source = categoryEvents.find((event) => event.market === sourceMarket);
          if (!source) continue;
          sourceBreakouts += 1;

          const target = categoryEvents
            .filter((event) => event.market === targetMarket)
            .map((event) => ({ event, lag: daysBetween(source.date, event.date) }))
            .filter(({ lag }) => lag > 0 && lag <= maxLagDays)
            .sort((a, b) => a.lag - b.lag)[0];

          if (target) lags.push(target.lag);
        }

        if (!sourceBreakouts) continue;
        edges.push({
          category,
          sourceMarket,
          targetMarket,
          sampleSize: sourceBreakouts,
          transitionProbability: Number((lags.length / sourceBreakouts).toFixed(4)),
          medianLagDays: median(lags),
          p25LagDays: percentile(lags, 0.25),
          p75LagDays: percentile(lags, 0.75),
        });
      }
    }
  }

  return edges.sort((a, b) => b.transitionProbability - a.transitionProbability || b.sampleSize - a.sampleSize);
}

export function findBestUpstreamEdges(
  edges: PropagationEdge[],
  category: string,
  targetMarket: MarketCode,
  minSamples = 5,
) {
  return edges
    .filter((edge) => edge.category === category && edge.targetMarket === targetMarket && edge.sampleSize >= minSamples)
    .sort((a, b) => b.transitionProbability - a.transitionProbability || b.sampleSize - a.sampleSize);
}
