import { NextResponse } from "next/server";
import { z } from "zod";
import {
  matchCandidateToClusters,
  qualifyTrendCandidate,
  suggestCanonicalName,
  type ProductCluster,
  type TrendCandidate,
} from "../../../lib/product-identity";

const candidateSchema = z.object({
  term: z.string().min(1),
  market: z.enum(["US", "UK", "DE", "NL"]),
  source: z.string().min(1).default("manual"),
  observedAt: z.string().optional(),
  categoryHint: z.string().nullable().optional(),
});

const clusterSchema = z.object({
  id: z.string().min(1),
  canonicalName: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  category: z.string().nullable().optional(),
});

const bodySchema = z.object({
  candidate: candidateSchema,
  clusters: z.array(clusterSchema).default([]),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const candidate = parsed.data.candidate as TrendCandidate;
  const clusters = parsed.data.clusters as ProductCluster[];
  const qualification = qualifyTrendCandidate(candidate);
  const match = matchCandidateToClusters(candidate, clusters);

  return NextResponse.json({
    qualification,
    match,
    suggestedCanonicalName: suggestCanonicalName(candidate),
    matcherVersion: "identity-v0.1",
  });
}
