import { NextResponse } from "next/server";
import { z } from "zod";
import { forecastFromPropagation } from "../../../lib/propagation-forecast";

const marketSchema = z.enum(["US", "UK", "DE", "NL"]);

const breakoutSchema = z.object({
  productId: z.string().min(1),
  category: z.string().min(1),
  market: marketSchema,
  date: z.string().min(10),
  strength: z.number(),
  baseline: z.number(),
  velocity: z.number(),
});

const edgeSchema = z.object({
  category: z.string().min(1),
  sourceMarket: marketSchema,
  targetMarket: marketSchema,
  sampleSize: z.number().int().nonnegative(),
  transitionProbability: z.number().min(0).max(1),
  medianLagDays: z.number().nullable(),
  p25LagDays: z.number().nullable(),
  p75LagDays: z.number().nullable(),
});

const requestSchema = z.object({
  category: z.string().min(1),
  targetMarket: marketSchema,
  productBreakouts: z.array(breakoutSchema),
  edges: z.array(edgeSchema),
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const forecast = forecastFromPropagation(payload);
    return NextResponse.json({ model: "propagation-v0.1", forecast });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid forecast request", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Unable to generate forecast" }, { status: 500 });
  }
}
