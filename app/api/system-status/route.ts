import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const google = Boolean(
    (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID) &&
    (process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  );
  const meta = Boolean(process.env.META_AD_LIBRARY_ACCESS_TOKEN);
  const tiktok = Boolean(process.env.TIKTOK_TREND_API_ENDPOINT && process.env.TIKTOK_TREND_API_TOKEN);
  const bol = Boolean(process.env.BOL_CLIENT_ID && process.env.BOL_CLIENT_SECRET);
  const amazon = Boolean(process.env.AMAZON_CREATORS_API_ENDPOINT && process.env.AMAZON_CREATORS_API_TOKEN);
  const supabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  const connected = [google, meta, tiktok, bol || amazon].filter(Boolean).length;

  return NextResponse.json({
    mode: connected === 4 && supabase ? "live-ready" : connected > 0 ? "partial" : "demo",
    connected,
    totalSignalGroups: 4,
    persistence: supabase,
    sources: {
      google: { configured: google, role: "Demand formation + cross-market search momentum" },
      meta: { configured: meta, role: "Advertiser saturation + commercial competition" },
      tiktok: { configured: tiktok, role: "Early cultural and creative acceleration" },
      bol: { configured: bol, role: "NL/BE marketplace validation" },
      amazon: { configured: amazon, role: "International marketplace validation" },
    },
    note: "Configured only indicates credentials/settings are present. It does not guarantee upstream API access or data quality.",
  });
}
