import { calculateForecast, type Forecast, type MarketCode, type ProductSnapshot } from "./arbitra";
import { getSupabaseServerClient } from "./supabase";

export type Opportunity = {
  product: { id: string; name: string; category: string };
  market: MarketCode;
  route: MarketCode[];
  signal: { momentum: number; acceleration: number; saturation: number };
  forecast: Forecast;
};

/**
 * Demo snapshots use the same ProductSnapshot shape and the same calculateForecast
 * engine as live data. Nothing here is a separate scoring formula, so switching
 * a market to live Supabase data changes zero UI code.
 */
const DEMO_PRODUCTS: ProductSnapshot[] = [
  {
    id: "demo-cold-plunge",
    name: "Portable Cold Plunge",
    category: "Fitness & Recovery",
    signals: [
      { market: "US", momentum: 90, acceleration: 92, saturation: 55, adActivity: 60, marketplaceCompetition: 50, retailPrice: 249, landedCost: 95 },
      { market: "UK", momentum: 78, acceleration: 84, saturation: 22, adActivity: 30, marketplaceCompetition: 25, retailPrice: 259, landedCost: 100 },
      { market: "DE", momentum: 60, acceleration: 70, saturation: 15, adActivity: 20, marketplaceCompetition: 18, retailPrice: 269, landedCost: 105 },
      { market: "NL", momentum: 50, acceleration: 60, saturation: 10, adActivity: 15, marketplaceCompetition: 12, retailPrice: 259, landedCost: 100 },
    ],
  },
  {
    id: "demo-scalp-massager",
    name: "LED Scalp Massager",
    category: "Beauty",
    signals: [
      { market: "JP", momentum: 88, acceleration: 93, saturation: 40, adActivity: 45, marketplaceCompetition: 35, retailPrice: 39, landedCost: 11 },
      { market: "US", momentum: 65, acceleration: 80, saturation: 18, adActivity: 25, marketplaceCompetition: 15, retailPrice: 45, landedCost: 13 },
      { market: "UK", momentum: 40, acceleration: 55, saturation: 12, adActivity: 15, marketplaceCompetition: 10, retailPrice: 42, landedCost: 12 },
      { market: "DE", momentum: 35, acceleration: 50, saturation: 10, adActivity: 12, marketplaceCompetition: 8, retailPrice: 44, landedCost: 12 },
    ],
  },
  {
    id: "demo-walking-pad",
    name: "Walking Pad",
    category: "Home Fitness",
    signals: [
      { market: "US", momentum: 75, acceleration: 60, saturation: 55, adActivity: 55, marketplaceCompetition: 50, retailPrice: 299, landedCost: 140 },
      { market: "DE", momentum: 55, acceleration: 50, saturation: 38, adActivity: 30, marketplaceCompetition: 28, retailPrice: 319, landedCost: 150 },
      { market: "UK", momentum: 50, acceleration: 45, saturation: 42, adActivity: 28, marketplaceCompetition: 30, retailPrice: 309, landedCost: 145 },
      { market: "FR", momentum: 45, acceleration: 40, saturation: 35, adActivity: 22, marketplaceCompetition: 24, retailPrice: 319, landedCost: 150 },
    ],
  },
  {
    id: "demo-thermal-printer",
    name: "Mini Thermal Printer",
    category: "Electronics",
    signals: [
      { market: "JP", momentum: 62, acceleration: 65, saturation: 50, adActivity: 30, marketplaceCompetition: 40, retailPrice: 59, landedCost: 22 },
      { market: "US", momentum: 48, acceleration: 55, saturation: 45, adActivity: 25, marketplaceCompetition: 35, retailPrice: 65, landedCost: 24 },
      { market: "DE", momentum: 40, acceleration: 48, saturation: 40, adActivity: 20, marketplaceCompetition: 30, retailPrice: 69, landedCost: 25 },
      { market: "ES", momentum: 35, acceleration: 42, saturation: 38, adActivity: 18, marketplaceCompetition: 28, retailPrice: 65, landedCost: 24 },
    ],
  },
];

type SnapshotRow = {
  product_id: string;
  market_code: MarketCode;
  momentum: number | null;
  acceleration: number | null;
  saturation: number | null;
  ad_activity: number | null;
  marketplace_competition: number | null;
  retail_price: number | null;
  landed_cost: number | null;
  snapshot_date: string;
  products: { canonical_name: string; category: string | null } | null;
};

export async function loadProductSnapshots(): Promise<{ mode: "live" | "demo"; products: ProductSnapshot[] }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { mode: "demo", products: DEMO_PRODUCTS };

  const { data, error } = await supabase
    .from("market_snapshots")
    .select(
      "product_id, market_code, momentum, acceleration, saturation, ad_activity, marketplace_competition, retail_price, landed_cost, snapshot_date, products(canonical_name, category)",
    )
    .order("snapshot_date", { ascending: false });

  if (error || !data?.length) return { mode: "demo", products: DEMO_PRODUCTS };

  const rows = data as unknown as SnapshotRow[];
  const latestByKey = new Map<string, SnapshotRow>();
  for (const row of rows) {
    const key = `${row.product_id}:${row.market_code}`;
    if (!latestByKey.has(key)) latestByKey.set(key, row); // rows are ordered by date desc
  }

  const byProduct = new Map<string, ProductSnapshot>();
  for (const row of latestByKey.values()) {
    const product = byProduct.get(row.product_id) ?? {
      id: row.product_id,
      name: row.products?.canonical_name ?? row.product_id,
      category: row.products?.category ?? "Uncategorized",
      signals: [],
    };
    product.signals.push({
      market: row.market_code,
      momentum: Number(row.momentum ?? 0),
      acceleration: Number(row.acceleration ?? 0),
      saturation: Number(row.saturation ?? 0),
      adActivity: Number(row.ad_activity ?? 0),
      marketplaceCompetition: Number(row.marketplace_competition ?? 0),
      retailPrice: row.retail_price ?? undefined,
      landedCost: row.landed_cost ?? undefined,
    });
    byProduct.set(row.product_id, product);
  }

  // calculateForecast needs at least one upstream market plus the target market.
  const products = [...byProduct.values()].filter((product) => product.signals.length >= 2);
  return products.length ? { mode: "live", products } : { mode: "demo", products: DEMO_PRODUCTS };
}

export function buildOpportunities(products: ProductSnapshot[]): Opportunity[] {
  const opportunities: Opportunity[] = [];
  for (const product of products) {
    for (const signal of product.signals) {
      const forecast = calculateForecast(product, signal.market);
      opportunities.push({
        product: { id: product.id, name: product.name, category: product.category },
        market: signal.market,
        route: product.signals.map((s) => s.market),
        signal: { momentum: signal.momentum, acceleration: signal.acceleration, saturation: signal.saturation },
        forecast,
      });
    }
  }
  return opportunities.sort((a, b) => b.forecast.opportunityScore - a.forecast.opportunityScore);
}
