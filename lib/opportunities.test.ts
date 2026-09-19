import { describe, expect, it } from "vitest";
import { buildOpportunities } from "./opportunities";
import { calculateForecast, type ProductSnapshot } from "./arbitra";

const products: ProductSnapshot[] = [
  {
    id: "p1",
    name: "Product One",
    category: "Cat",
    signals: [
      { market: "US", momentum: 90, acceleration: 90, saturation: 20, adActivity: 20, marketplaceCompetition: 20 },
      { market: "UK", momentum: 40, acceleration: 40, saturation: 40, adActivity: 30, marketplaceCompetition: 30 },
    ],
  },
  {
    id: "p2",
    name: "Product Two",
    category: "Cat",
    signals: [{ market: "US", momentum: 10, acceleration: 10, saturation: 90, adActivity: 80, marketplaceCompetition: 80 }],
  },
];

describe("buildOpportunities", () => {
  it("produces one opportunity per product/market signal, using the same engine as a direct calculateForecast call", () => {
    const opportunities = buildOpportunities(products);
    expect(opportunities).toHaveLength(3); // p1 has 2 markets, p2 has 1

    const p1Uk = opportunities.find((o) => o.product.id === "p1" && o.market === "UK")!;
    const directForecast = calculateForecast(products[0], "UK");
    expect(p1Uk.forecast).toEqual(directForecast);
  });

  it("sorts opportunities by opportunity score, descending", () => {
    const opportunities = buildOpportunities(products);
    const scores = opportunities.map((o) => o.forecast.opportunityScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("carries the full market route so the UI can render cross-market propagation", () => {
    const opportunities = buildOpportunities(products);
    const p1Us = opportunities.find((o) => o.product.id === "p1" && o.market === "US")!;
    expect(p1Us.route).toEqual(["US", "UK"]);
  });
});
