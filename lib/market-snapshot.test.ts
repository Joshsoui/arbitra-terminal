import { describe, expect, it } from "vitest";
import { buildMarketSignal, coverageFraction } from "./market-snapshot";
import type { DailyObservation } from "./historical-engine";
import type { PaidSocialSignal } from "./paid-social";

function obs(date: string, demandIndex: number): DailyObservation {
  return { productId: "p1", category: "Fitness", market: "US", date, demandIndex };
}

describe("buildMarketSignal", () => {
  it("uses the latest observation as momentum and a neutral 50 when there is no history to compare against", () => {
    const { signal, coverage } = buildMarketSignal({ market: "US", series: [obs("2024-01-01", 70)] });
    expect(signal.momentum).toBe(70);
    expect(signal.acceleration).toBe(50); // only one data point, nothing to accelerate from
    expect(coverage.hasSearchSignal).toBe(true);
  });

  it("returns a fully neutral signal (not an optimistic 0) when there is no search history at all", () => {
    const { signal, coverage } = buildMarketSignal({ market: "US", series: [] });
    expect(signal).toEqual({ market: "US", momentum: 50, acceleration: 50, saturation: 50, adActivity: 50, marketplaceCompetition: 50 });
    expect(coverage).toEqual({ hasSearchSignal: false, hasAdSignal: false, hasMarketplaceSignal: false });
  });

  it("scores acceleration above 50 when the latest value is rising above its own recent baseline", () => {
    const series = [obs("2024-01-01", 20), obs("2024-01-08", 20), obs("2024-01-15", 20), obs("2024-01-22", 60)];
    const { signal } = buildMarketSignal({ market: "US", series });
    expect(signal.momentum).toBe(60);
    expect(signal.acceleration).toBeGreaterThan(50);
  });

  it("scores acceleration below 50 when demand is cooling off", () => {
    const series = [obs("2024-01-01", 80), obs("2024-01-08", 80), obs("2024-01-15", 80), obs("2024-01-22", 30)];
    const { signal } = buildMarketSignal({ market: "US", series });
    expect(signal.acceleration).toBeLessThan(50);
  });

  it("derives ad_activity/saturation from a live Meta signal when one is supplied", () => {
    const meta: PaidSocialSignal = { source: "meta", market: "US", observedAt: "2024-01-01T00:00:00Z", uniqueAdvertisers: 10, activeAds: 20, adGrowth7d: 20, confidence: 0.85 };
    const { signal, coverage } = buildMarketSignal({ market: "US", series: [obs("2024-01-01", 50)], meta });
    // 10*3 + 20*0.35 + 20*0.25 = 30 + 7 + 5 = 42
    expect(signal.adActivity).toBe(42);
    expect(signal.saturation).toBe(42);
    expect(coverage.hasAdSignal).toBe(true);
  });

  it("never invents marketplace competition — it always comes back neutral in this phase", () => {
    const { signal, coverage } = buildMarketSignal({ market: "US", series: [obs("2024-01-01", 90)] });
    expect(signal.marketplaceCompetition).toBe(50);
    expect(coverage.hasMarketplaceSignal).toBe(false);
  });
});

describe("coverageFraction", () => {
  it("reports the share of signal groups that actually have data", () => {
    expect(coverageFraction({ hasSearchSignal: true, hasAdSignal: false, hasMarketplaceSignal: false })).toBeCloseTo(0.33, 2);
    expect(coverageFraction({ hasSearchSignal: true, hasAdSignal: true, hasMarketplaceSignal: true })).toBe(1);
    expect(coverageFraction({ hasSearchSignal: false, hasAdSignal: false, hasMarketplaceSignal: false })).toBe(0);
  });
});
