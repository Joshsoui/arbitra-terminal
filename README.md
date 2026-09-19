# ARBITRA TERMINAL

**Global Product Intelligence**  
*See demand before it reaches your market.*

ARBITRA is a product-intelligence platform designed to detect how demand propagates across markets and identify commercial opportunities before local saturation occurs.

## Initial focus

- Major consumer markets across North America, Europe, Asia-Pacific and Latin America
- Historical product-demand observations
- Cross-market propagation detection
- Forecast probability + confidence
- Paid-social opportunity scoring for Meta and TikTok
- Marketplace validation and competition signals
- Backtesting against historical outcomes
- Terminal-style product and market intelligence UI

The Terminal currently exposes selectable target markets including US, Canada, Mexico, Brazil, UK, Germany, France, Netherlands, Belgium, Spain, Italy, Sweden, Poland, Australia, Japan, South Korea and India. Source coverage is tracked separately per market; a selectable market does not imply identical live data coverage everywhere.

## Core principle

ARBITRA separates two questions:

1. **Demand Forecast** — where is demand likely to move next?
2. **Opportunity Engine** — is that demand commercially attractive in the target market, especially for paid social?

The long-term moat is the historical `prediction -> outcome` dataset ARBITRA builds over time.

## Historical intelligence pipeline

`raw market observations -> candidate qualification -> product matching -> normalized demand -> breakout events -> propagation graph -> forecast -> paid-social opportunity -> backtest`

### Google Trends discovery source

ARBITRA includes a first-party Google Trends ingestion path using Google's public BigQuery dataset.

Run:

```bash
npm run trends:discover
```

The public dataset is useful for discovery and multi-year history for surfaced terms, but it is not a complete arbitrary-product database. Full arbitrary-term historical backfill should use the official Google Trends API once ARBITRA has access.

### Daily ingestion cadence

`render.yaml` defines an `arbitra-trend-ingestion` cron service (06:00 UTC) running `npm run ingest:daily`, which chains discovery → import → qualify/classify → promote against Supabase. This is what turns the pipeline into an accumulating historical dataset instead of something that only runs when someone remembers to run it by hand.

### Promoting candidates into live opportunities

```bash
npm run candidates:promote
```

`scripts/promote-candidates.ts` is what actually connects raw signals to `GET /api/opportunities`. For every `trend_candidates` row classified `product`: it creates (once) a matching `products` row, reruns `lib/normalization.ts` over that candidate's `trend_candidate_observations` to get a per-market demand time series, optionally calls the live Meta Ad Library adapter for the same term/market, and writes the result through `lib/market-snapshot.ts` into `market_snapshots` — which is the only table `GET /api/opportunities` actually reads.

This phase only wires **Google Trends (search) + Meta Ad Library (ad saturation)**. `marketplaceCompetition` has no source yet (bol.com/Amazon aren't part of this pipeline) and always comes back as a neutral 50 rather than a value that would make the market look artificially uncompetitive — tracked explicitly per snapshot via `source_coverage` (fraction of the 3 signal groups — search/ads/marketplace — that actually had data). Breakout detection, propagation-graph refresh and backtesting are the next layer on top of this and still need to be run separately via `lib/historical-engine.ts`/`lib/backtest.ts` once enough snapshot history accumulates.

### Credentials

The BigQuery client supports standard Google Application Default Credentials or Render-friendly inline credentials:

```env
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON=
```

Supabase staging requires:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Paid-social and marketplace adapters use environment-only credentials. See `.env.example` for the current set.

### Candidate staging is deliberate

A rising Google query is **not automatically a product**. Search terms can be people, sport, news or entertainment. ARBITRA therefore stages discoveries for qualification before they enter the canonical product model.

### 1. Raw observations

Every source adapter emits the same shape through `lib/data-source.ts`, including source, market, timestamp and confidence. Signal families include search interest, search velocity, marketplace rank, price, seller count and paid-social indicators.

### 2. Normalization

`lib/normalization.ts` converts heterogeneous signals into a comparable daily demand index. Source confidence is retained and weak estimates receive less weight.

### 3. Breakout detection

`lib/historical-engine.ts` detects breakouts relative to a product's own recent baseline. A breakout requires both a significant lift and positive daily velocity, reducing false signals from products that are simply always popular.

### 4. Propagation graph

Historical breakout events are converted into directional category-level edges such as:

`US -> UK | probability 0.79 | median lag 13 days | n=184`

The engine does **not** assume one fixed country sequence; it learns the strongest routes from history.

### 5. Forecast

`lib/propagation-forecast.ts` combines multiple confirmed upstream markets into a target-market breakout probability, confidence score and expected timing window.

### 6. Paid Social Opportunity

`lib/paid-social.ts` combines demand probability, Meta saturation, TikTok momentum, marketplace competition and margin headroom into a paid-social opportunity score with actions such as `TEST NOW`, `EARLY TEST`, `WATCH` and `PASS`.

### 7. Walk-forward backtest

`lib/backtest.ts` performs time-aware validation. For every forecast, the target product and future events are excluded from the historical training set. Reports include Brier score, log loss, probability calibration, actual breakout outcomes and lead time.

Run:

```bash
npm run backtest:propagation -- data/breakouts.json
```

## API

- `GET /api/opportunities` — ranked product × market opportunities powering the terminal UI. Reads live `market_snapshots` from Supabase when configured; otherwise scores typed demo snapshots with the same `calculateForecast` engine, so the UI never has its own separate scoring logic.
- `POST /api/forecast` — propagation forecast
- `GET /api/paid-social` — paid-social opportunity signal
- `GET /api/marketplace` — marketplace signal adapter
- `POST /api/product-identity` — candidate qualification and product matching
- `GET /api/system-status` — which data sources are configured

## Data integrity rule

ARBITRA must never present estimated signals as exact sales. Every production signal retains its source, confidence and timestamp. Forecasts are stored immutably so their later outcome can be evaluated without hindsight.

## Next data milestones

1. ~~Run and archive Google Trends discovery daily across supported markets.~~ Done via the `arbitra-trend-ingestion` Render cron job.
2. Expand multilingual product identity and stable identifier matching.
3. ~~Promote qualified trend candidates into `products`/`market_snapshots` so `GET /api/opportunities` can run on live data instead of the demo fallback.~~ Done via `scripts/promote-candidates.ts`, wired into the daily cron — currently sourced from Google Trends + Meta Ad Library only.
4. Persist marketplace observations (bol.com/Amazon) by market and wire them into the promotion step as the missing `marketplaceCompetition` source.
5. Add freshness scoring (how stale is each snapshot) alongside the existing `source_coverage` fraction.
6. Request/enable official Google Trends API access for arbitrary-term five-year backfills.
7. Reconstruct thousands of product trajectories and run the first true out-of-sample ARBITRA backtest.

## Known schema issue

An earlier migration (`supabase/migrations/20260912_product_identity.sql`) tried to redefine `trend_candidates` with a different column set than `002_trend_discovery.sql`. Because Postgres `create table if not exists` silently no-ops when the table already exists, that redefinition never took effect — it has been removed from the migration file. `trend_candidates` is `(source, external_key, canonical_term, classification, product_id, first_seen_at, last_seen_at, metadata)`, full stop; treat `scripts/import-trend-candidates.ts` and `scripts/qualify-google-candidates.ts` as the source of truth if a future migration touches this table again.
