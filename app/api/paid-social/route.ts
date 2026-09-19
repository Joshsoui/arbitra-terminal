import { NextRequest, NextResponse } from "next/server";
import type { MarketCode } from "../../../lib/arbitra";
import { MetaAdLibrarySource } from "../../../lib/meta-ads";
import { TikTokTrendSource } from "../../../lib/tiktok-signals";
import { calculatePaidSocialOpportunity } from "../../../lib/paid-social";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const market = (request.nextUrl.searchParams.get("market") ?? "NL") as MarketCode;
  const demandProbability = Number(request.nextUrl.searchParams.get("demand") ?? 50);
  if (!query) return NextResponse.json({ error: "Missing q" }, { status: 400 });

  const results: { meta?: unknown; tiktok?: unknown; errors: string[] } = { errors: [] };
  let meta; let tiktok;
  try { meta = await new MetaAdLibrarySource().signal(query, market); results.meta = meta; } catch (e) { results.errors.push(e instanceof Error ? e.message : "Meta failed"); }
  try { tiktok = await new TikTokTrendSource().signal(query, market); results.tiktok = tiktok; } catch (e) { results.errors.push(e instanceof Error ? e.message : "TikTok failed"); }
  const opportunity = calculatePaidSocialOpportunity({ demandProbability, meta, tiktok });
  return NextResponse.json({ query, market, demandProbability, opportunity, ...results });
}
