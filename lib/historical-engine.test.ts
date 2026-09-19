import { describe, expect, it } from "vitest";
import { buildPropagationGraph, detectBreakouts, findBestUpstreamEdges, type BreakoutEvent, type DailyObservation } from "./historical-engine";

function series(dates: string[], values: number[]): DailyObservation[] {
  return dates.map((date, i) => ({ productId: "p1", category: "Fitness", market: "US", date, demandIndex: values[i] }));
}

describe("detectBreakouts", () => {
  it("only emits on the first day a breakout run starts, not on every elevated day after", () => {
    // 14 flat baseline days at 20, then a spike to 40 (lift 100%, velocity 20), then it
    // plateaus at 40 (velocity drops to 0, so it must not be re-flagged as a new breakout).
    const dates = Array.from({ length: 20 }, (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`);
    const values = dates.map((_, i) => (i < 14 ? 20 : 40));
    const events = detectBreakouts(series(dates, values));

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: "2024-01-15", baseline: 20, velocity: 20, strength: 100 });
  });

  it("requires both a minimum lift and a minimum velocity", () => {
    const dates = Array.from({ length: 16 }, (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`);
    // Lift clears 45% (30 vs a baseline of 20) but velocity never reaches 12/day,
    // which is exactly the "always somewhat popular" case the detector should reject.
    const values = [...Array(14).fill(20), 30, 31];
    const events = detectBreakouts(series(dates, values), { minLiftPct: 45, minVelocity: 12 });
    expect(events).toHaveLength(0);
  });

  it("groups observations independently per product/market key", () => {
    const dates = Array.from({ length: 15 }, (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`);
    const usValues = dates.map((_, i) => (i < 14 ? 20 : 40));
    const ukValues = dates.map(() => 20); // no breakout in UK
    const observations: DailyObservation[] = [
      ...dates.map((date, i) => ({ productId: "p1", category: "Fitness", market: "US" as const, date, demandIndex: usValues[i] })),
      ...dates.map((date, i) => ({ productId: "p1", category: "Fitness", market: "UK" as const, date, demandIndex: ukValues[i] })),
    ];
    const events = detectBreakouts(observations);
    expect(events).toHaveLength(1);
    expect(events[0].market).toBe("US");
  });
});

describe("buildPropagationGraph", () => {
  const events: BreakoutEvent[] = [
    { productId: "p1", category: "Fitness", market: "US", date: "2024-01-01", strength: 100, baseline: 20, velocity: 20 },
    { productId: "p1", category: "Fitness", market: "UK", date: "2024-01-15", strength: 90, baseline: 18, velocity: 15 }, // +14d
    { productId: "p2", category: "Fitness", market: "US", date: "2024-02-01", strength: 100, baseline: 20, velocity: 20 },
    { productId: "p2", category: "Fitness", market: "UK", date: "2024-02-11", strength: 90, baseline: 18, velocity: 15 }, // +10d
    { productId: "p3", category: "Fitness", market: "US", date: "2024-03-01", strength: 100, baseline: 20, velocity: 20 }, // never propagates
  ];

  it("learns a directional transition probability and lag distribution from historical breakouts", () => {
    const edges = buildPropagationGraph(events, ["US", "UK"]);
    const usToUk = edges.find((e) => e.sourceMarket === "US" && e.targetMarket === "UK");
    expect(usToUk).toBeDefined();
    expect(usToUk!.sampleSize).toBe(3); // three products broke out in US
    expect(usToUk!.transitionProbability).toBeCloseTo(2 / 3, 4); // only 2 of 3 later broke out in UK
    expect(usToUk!.medianLagDays).toBe(12); // median of [14, 10]
    expect(usToUk!.p25LagDays).toBe(11);
    expect(usToUk!.p75LagDays).toBe(13);
  });

  it("records a real but zero-probability edge when a market never propagates backward", () => {
    const edges = buildPropagationGraph(events, ["US", "UK"]);
    const ukToUs = edges.find((e) => e.sourceMarket === "UK" && e.targetMarket === "US");
    expect(ukToUs).toBeDefined();
    expect(ukToUs!.transitionProbability).toBe(0);
    expect(ukToUs!.medianLagDays).toBeNull();
  });

  it("does not fabricate an edge for a source market with zero historical breakouts", () => {
    const edges = buildPropagationGraph(events, ["US", "DE"]);
    expect(edges.find((e) => e.sourceMarket === "DE")).toBeUndefined();
  });
});

describe("findBestUpstreamEdges", () => {
  const events: BreakoutEvent[] = [
    { productId: "p1", category: "Fitness", market: "US", date: "2024-01-01", strength: 100, baseline: 20, velocity: 20 },
    { productId: "p1", category: "Fitness", market: "UK", date: "2024-01-15", strength: 90, baseline: 18, velocity: 15 },
    { productId: "p2", category: "Fitness", market: "US", date: "2024-02-01", strength: 100, baseline: 20, velocity: 20 },
    { productId: "p2", category: "Fitness", market: "UK", date: "2024-02-11", strength: 90, baseline: 18, velocity: 15 },
    { productId: "p3", category: "Fitness", market: "US", date: "2024-03-01", strength: 100, baseline: 20, velocity: 20 },
  ];
  const edges = buildPropagationGraph(events, ["US", "UK"]);

  it("filters by category, target market and a minimum sample size", () => {
    expect(findBestUpstreamEdges(edges, "Fitness", "UK", 2)).toHaveLength(1);
    expect(findBestUpstreamEdges(edges, "Fitness", "UK", 5)).toHaveLength(0);
    expect(findBestUpstreamEdges(edges, "Beauty", "UK", 1)).toHaveLength(0);
  });
});
