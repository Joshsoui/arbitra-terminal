import { describe, expect, it } from "vitest";
import { aggregateDailyObservations } from "./normalization";
import type { RawObservation } from "./data-source";

const resolver = () => ({ productId: "p1", category: "Widgets", externalIds: ["x"] });

function observation(overrides: Partial<RawObservation>): RawObservation {
  return {
    productExternalId: "x",
    productName: "Widget",
    market: "US",
    observedAt: "2024-01-01T00:00:00.000Z",
    source: "test",
    signalType: "search_interest",
    value: 0,
    confidence: 1,
    ...overrides,
  };
}

describe("aggregateDailyObservations", () => {
  it("blends heterogeneous signals into one confidence-weighted demand index, keyed by product/market/day", () => {
    const rows = aggregateDailyObservations(
      [
        observation({ signalType: "search_interest", value: 80, confidence: 1 }),
        observation({ signalType: "marketplace_rank", value: 5, confidence: 0.9 }), // rank <= 10 -> normalized to 100
        observation({ signalType: "social_velocity", value: 60, confidence: 0.8 }),
        observation({ signalType: "ad_activity", value: 40, confidence: 0.7 }),
        observation({ signalType: "seller_count", value: 12, confidence: 1 }),
        observation({ signalType: "price", value: 29.99, confidence: 1 }),
      ],
      resolver,
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.productId).toBe("p1");
    expect(row.market).toBe("US");
    expect(row.date).toBe("2024-01-01");
    // weighted avg of (80*1.0, 100*0.81, 60*0.52, 40*0.35) / (1.0+0.81+0.52+0.35)
    expect(row.demandIndex).toBeCloseTo(76.94, 1);
    expect(row.socialIndex).toBe(60);
    expect(row.adIndex).toBe(40);
    expect(row.sellerCount).toBe(12);
    expect(row.retailPrice).toBe(29.99);
  });

  it("excludes price and seller count from the demand index itself", () => {
    const rows = aggregateDailyObservations(
      [observation({ signalType: "price", value: 500, confidence: 1 }), observation({ signalType: "seller_count", value: 3, confidence: 1 })],
      resolver,
    );
    expect(rows[0].demandIndex).toBe(0);
  });

  it("drops observations the resolver can't identify as a known product", () => {
    const rows = aggregateDailyObservations([observation({})], () => null);
    expect(rows).toHaveLength(0);
  });

  it("keeps separate rows per calendar day", () => {
    const rows = aggregateDailyObservations(
      [observation({ observedAt: "2024-01-01T00:00:00.000Z", value: 50 }), observation({ observedAt: "2024-01-02T00:00:00.000Z", value: 70 })],
      resolver,
    );
    expect(rows.map((r) => r.date)).toEqual(["2024-01-01", "2024-01-02"]);
  });
});
