import { describe, expect, it } from "vitest";
import { runPropagationBacktest } from "./backtest";
import type { BreakoutEvent } from "./historical-engine";

describe("runPropagationBacktest", () => {
  // Product A is purely historical evidence: it broke out in the US on day 1 and
  // in the UK 10 days later. Product B is the one being forecast, and it breaks
  // out in JP on day 0 (before A's US breakout even exists), then in the US on
  // day 50, then in the UK 15 days after that.
  const events: BreakoutEvent[] = [
    { productId: "A", category: "Fitness", market: "US", date: "2024-01-01", strength: 100, baseline: 20, velocity: 20 },
    { productId: "A", category: "Fitness", market: "UK", date: "2024-01-11", strength: 90, baseline: 18, velocity: 15 },
    { productId: "B", category: "Fitness", market: "JP", date: "2023-12-31", strength: 80, baseline: 20, velocity: 15 },
    { productId: "B", category: "Fitness", market: "US", date: "2024-02-20", strength: 100, baseline: 20, velocity: 20 },
    { productId: "B", category: "Fitness", market: "UK", date: "2024-03-06", strength: 90, baseline: 18, velocity: 15 }, // +15d after the US cutoff
  ];

  it("produces no prediction when there isn't yet enough historical evidence before the cutoff (no lookahead leakage)", () => {
    // At B's earliest cutoff (the JP breakout on 2023-12-31), A hasn't broken out
    // anywhere yet (A's first event is 2024-01-01, one day later). If the backtester
    // leaked future data, it would still be able to build a propagation edge here.
    const report = runPropagationBacktest({ events, targetMarkets: ["UK"], minHistoricalProducts: 1 });
    const earlyCutoffRows = report.rows.filter((row) => row.productId === "B" && row.cutoffDate === "2023-12-31");
    expect(earlyCutoffRows).toHaveLength(0);
  });

  it("forecasts using only breakouts strictly before the cutoff, and scores the eventual outcome correctly", () => {
    const report = runPropagationBacktest({ events, targetMarkets: ["UK"], minHistoricalProducts: 1, horizonDays: 30 });
    const row = report.rows.find((row) => row.productId === "B" && row.cutoffDate === "2024-02-20");

    expect(row).toBeDefined();
    expect(row!.probability).toBe(100); // A's single US->UK transition was 100% historically
    expect(row!.actualBreakout).toBe(true);
    expect(row!.actualLagDays).toBe(15);
  });

  it("never re-forecasts a target market that has already broken out by the cutoff", () => {
    const report = runPropagationBacktest({ events, targetMarkets: ["UK"], minHistoricalProducts: 1 });
    const rowsAtOwnBreakout = report.rows.filter((row) => row.productId === "B" && row.cutoffDate === "2024-03-06");
    expect(rowsAtOwnBreakout).toHaveLength(0);
  });

  it("summarizes prediction quality with Brier score and calibration buckets", () => {
    const report = runPropagationBacktest({ events, targetMarkets: ["UK"], minHistoricalProducts: 1 });
    expect(report.predictions).toBeGreaterThan(0);
    expect(report.brierScore).not.toBeNull();
    expect(report.brierScore).toBeCloseTo(0, 2); // predicted 100%, and it did break out
    const topBucket = report.calibration.find((b) => b.bucket === "90-100");
    expect(topBucket?.predictions).toBe(1);
    expect(topBucket?.observedRate).toBe(100);
  });
});
