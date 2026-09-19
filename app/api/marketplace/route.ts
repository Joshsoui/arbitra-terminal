import { NextRequest, NextResponse } from "next/server";
import type { MarketCode } from "../../../lib/arbitra";
import { BolMarketplaceSource } from "../../../lib/bol-marketplace";
import { AmazonMarketplaceSource } from "../../../lib/amazon-marketplace";
import { marketplaceProductsToObservations } from "../../../lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const source = request.nextUrl.searchParams.get("source") ?? "bol";
  const market = (request.nextUrl.searchParams.get("market") ?? "NL") as MarketCode;
  if (!query) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  try {
    const adapter = source === "amazon" ? new AmazonMarketplaceSource() : new BolMarketplaceSource();
    const snapshot = await adapter.search(query, market);
    return NextResponse.json({ snapshot, observations: marketplaceProductsToObservations(snapshot) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketplace request failed" }, { status: 502 });
  }
}
