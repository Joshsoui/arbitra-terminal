import { describe, expect, it } from "vitest";
import { calculateForecast, calibrationBuckets, type ProductSnapshot } from "./arbitra";

function snapshot(overrides: Partial<Record<string, unknown>> = {}): ProductSnapshot {
  return {
    id: "p1",
    name: "Test Product",
    category: "Test",
    signals: [
      { market: "US", momentum: 80, acceleration: 80, saturation: 30, adActivity: 30, marketplaceCompetition: 30 },
      { market: "UK", momentum: 50, acceleration: 50, saturation: 20, adActivity: 20, marketplaceCompetition: 20, retailPrice: 100, landedCost: 40 },
    ],
    ...overrides,
  } as ProductSnapshot;
}

describe("calculateForecast", () => {
  it("throws when the target market has no signal", () => {
    expect(() => calculateForecast(snapshot(), "DE")).toThrow(/Missing target market/);
  });

  it("marks a heavily saturated target market as SATURATED regardless of upstream strength", () => {
    const product = snapshot();
    product.signals[1].saturation = 90;
    const forecast = calculateForecast(product, "UK");
    expect(forecast.status).toBe("SATURATED");
  });

  it("keeps every score within 0-100", () => {
    const product = snapshot();
    const forecast = calculateForecast(product, "UK");
    for (const value of [forecast.breakoutProbability, forecast.confidence, forecast.opportunityScore, forecast.marginPercent, forecast.commercialScore]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("computes marginPercent from retail price and landed cost when both are present", () => {
    const product = snapshot();
    const forecast = calculateForecast(product, "UK");
    // (100 - 40) / 100 = 60%
    expect(forecast.marginPercent).toBe(60);
  });

  it("falls back to a neutral 50% margin when price/cost are missing", () => {
    const product = snapshot();
    delete product.signals[1].retailPrice;
    delete product.signals[1].landedCost;
    const forecast = calculateForecast(product, "UK");
    expect(forecast.marginPercent).toBe(50);
  });

  it("only surfaces reasons whose underlying condition actually holds", () => {
    const product = snapshot();
    product.signals[0].momentum = 10; // weak upstream momentum
    product.signals[0].acceleration = 10;
    const forecast = calculateForecast(product, "UK");
    expect(forecast.reasons).not.toContain("Strong upstream demand momentum");
    expect(forecast.reasons).not.toContain("Cross-market acceleration detected");
  });

  it("requires both a high breakout probability and a high opportunity score for EARLY ENTRY", () => {
    const product = snapshot();
    // Strong opportunity score but saturation keeps breakout probability capped.
    product.signals[1].saturation = 74; // just under SATURATED
    product.signals[1].momentum = 5;
    product.signals[1].acceleration = 5;
    const forecast = calculateForecast(product, "UK");
    expect(forecast.status).not.toBe("EARLY ENTRY");
  });
});

describe("calibrationBuckets", () => {
  it("buckets predictions into ten equal-width probability ranges", () => {
    const buckets = calibrationBuckets([
      { predictedProbability: 5, actualBreakout: true },
      { predictedProbability: 12, actualBreakout: false },
      { predictedProbability: 95, actualBreakout: true },
    ]);
    expect(buckets).toHaveLength(10);
    expect(buckets[0].total).toBe(1);
    expect(buckets[0].hits).toBe(1);
    expect(buckets[1].total).toBe(1);
    expect(buckets[9].total).toBe(1);
    expect(buckets[9].hits).toBe(1);
  });

  it("reports observedRate as null for empty buckets instead of dividing by zero", () => {
    const buckets = calibrationBuckets([{ predictedProbability: 50, actualBreakout: true }]);
    expect(buckets[0].observedRate).toBeNull();
    expect(buckets[5].observedRate).toBe(100);
  });
});
