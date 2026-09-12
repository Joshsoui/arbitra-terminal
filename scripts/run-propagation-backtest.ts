import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPropagationBacktest } from "../lib/backtest";
import type { BreakoutEvent } from "../lib/historical-engine";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run backtest:propagation -- data/breakouts.json");
  process.exit(1);
}

const path = resolve(process.cwd(), input);
const payload = JSON.parse(readFileSync(path, "utf8")) as BreakoutEvent[];

if (!Array.isArray(payload)) {
  throw new Error("Expected a JSON array of breakout events");
}

const report = runPropagationBacktest({ events: payload });

console.log("\nARBITRA PROPAGATION BACKTEST\n");
console.log(`Predictions: ${report.predictions}`);
console.log(`Actual breakouts: ${report.positives}`);
console.log(`Brier score: ${report.brierScore ?? "n/a"}`);
console.log(`Log loss: ${report.logLoss ?? "n/a"}\n`);
console.table(report.calibration);
