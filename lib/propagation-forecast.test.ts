import { describe, expect, it } from "vitest";
import { forecastFromPropagation } from "./propagation-forecast";
import type { BreakoutEvent, PropagationEdge } from "./historical-engine";

const edge = (overrides: Partial<PropagationEdge>): PropagationEdge => ({
  category: "Fitness",
  sourceMarket: "US",
  targetMarket: "UK",
  sampleSize: 10,
  transitionProbability: 0.5,
  medianLagDays: 10,
  p25LagDays: 5,
  p75LagDays: 15,
  ...overrides,
});

const breakout = (overrides: Partial<BreakoutEvent>): BreakoutEvent => ({
  productId: "p1",
  category: "Fitness",
  market: "US",
  date: "2024-01-01",
  strength: 90,
  baseline: 20,
  velocity: 20,
  ...overrides,
});

describe("forecastFromPropagation", () => {
  it("combines two independent upstream confirmations with a noisy-OR instead of averaging them away", () => {
    const forecast = forecastFromPropagation({
      category: "Fitness",
      targetMarket: "UK",
      productBreakouts: [breakout({ market: "US" }), breakout({ market: "JP", productId: "p1" })],
      edges: [
        edge({ sourceMarket: "US", transitionProbability: 0.6, sampleSize: 20, p25LagDays: 5, p75LagDays: 15 }),
        edge({ sourceMarket: "JP", transitionProbability: 0.5, sampleSize: 15, medianLagDays: 20, p25LagDays: 12, p75LagDays: 30 }),
      ],
    });

    // 1 - (1-0.6)*(1-0.5) = 0.8, strictly higher than either individual edge.
    expect(forecast.probability).toBe(80);
    expect(forecast.probability).toBeGreaterThan(60);
    expect(forecast.expectedWindowDays).toEqual({ min: 5, max: 30 });
    expect(forecast.evidence[0].sourceMarket).toBe("US"); // sorted by transitionProbability desc
  });

  it("returns zero probability and zero confidence with no matching upstream evidence", () => {
    const forecast = forecastFromPropagation({
      category: "Fitness",
      targetMarket: "UK",
      productBreakouts: [breakout({ market: "DE" })],
      edges: [edge({ sourceMarket: "US" })], // no DE->UK edge exists
    });
    expect(forecast.probability).toBe(0);
    expect(forecast.confidence).toBe(0);
    expect(forecast.expectedWindowDays).toEqual({ min: null, max: null });
  });

  it("never uses the target market's own breakout as evidence for itself", () => {
    const forecast = forecastFromPropagation({
      category: "Fitness",
      targetMarket: "UK",
      productBreakouts: [breakout({ market: "UK" })],
      edges: [edge({ sourceMarket: "UK", targetMarket: "UK" })],
    });
    expect(forecast.evidence).toHaveLength(0);
  });

  it("grows confidence as historical sample size grows", () => {
    const small = forecastFromPropagation({
      category: "Fitness",
      targetMarket: "UK",
      productBreakouts: [breakout({ market: "US" })],
      edges: [edge({ sampleSize: 2 })],
    });
    const large = forecastFromPropagation({
      category: "Fitness",
      targetMarket: "UK",
      productBreakouts: [breakout({ market: "US" })],
      edges: [edge({ sampleSize: 200 })],
    });
    expect(large.confidence).toBeGreaterThan(small.confidence);
  });
});
