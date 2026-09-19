import { NextResponse } from "next/server";
import { buildOpportunities, loadProductSnapshots } from "../../../lib/opportunities";

export const dynamic = "force-dynamic";

export async function GET() {
  const { mode, products } = await loadProductSnapshots();
  const opportunities = buildOpportunities(products);
  return NextResponse.json({ mode, model: "arbitra-forecast-v0.1", opportunities });
}
