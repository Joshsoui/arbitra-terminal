# ARBITRA TERMINAL

**Global Product Intelligence**  
*See demand before it reaches your market.*

ARBITRA is a product-intelligence platform designed to detect how demand propagates across markets and identify commercial opportunities before local saturation occurs.

## Initial focus

- Markets: US, UK, Germany, Netherlands
- Historical product-demand observations
- Cross-market propagation detection
- Forecast probability + confidence
- Opportunity scoring
- Backtesting against historical outcomes
- Terminal-style product and market intelligence UI

## Core principle

ARBITRA separates two questions:

1. **Demand Forecast** — where is demand likely to move next?
2. **Opportunity Engine** — is that demand commercially attractive in the target market?

The long-term moat is the historical `prediction -> outcome` dataset ARBITRA builds over time.

## Historical intelligence pipeline

`raw market observations -> candidate qualification -> product matching -> normalized demand -> breakout events -> propagation graph -> forecast -> backtest`

### Google Trends discovery source

ARBITRA now includes a real first-party Google Trends ingestion path using Google's public BigQuery dataset.

Run:

```bash
npm run trends:discover
```

This queries the latest public rising-term partition for:

- United States (aggregated from DMA-level rows)
- United Kingdom
- Germany
- Netherlands

and writes normalized observations to:

```text
data/generated/google-trends-observations.json
```

Then stage those observations in Supabase:

```bash
npm run trends:import -- data/generated/google-trends-observations.json
```

The public dataset is excellent for **discovery** and contains multi-year history for surfaced terms, but it is not a complete arbitrary-product database. Google only exposes top/rising terms through this public BigQuery dataset. Full arbitrary-term historical backfill should use the official Google Trends API once ARBITRA has alpha/API access.

### Credentials

The BigQuery client supports standard Google Application Default Credentials or Render-friendly inline credentials:

```env
GCP_PROJECT_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
```

Supabase staging requires:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Candidate staging is deliberate

A rising Google query is **not automatically a product**. Search terms can be people, sport, news or entertainment. ARBITRA therefore stores Google discoveries first in:

- `trend_candidates`
- `trend_candidate_observations`

with classification states:

- `unclassified`
- `product`
- `non_product`
- `ambiguous`

Only qualified product candidates should be promoted into the canonical `products` and `observations` tables. This prevents noisy global search trends from corrupting the product propagation model.

### 1. Raw observations

Every source adapter emits the same shape through `lib/data-source.ts`, including source, market, timestamp and confidence. Supported signal families now include search interest and search velocity; marketplace, social, advertising, pricing, seller and review signals plug into the same contract.

### 2. Normalization

`lib/normalization.ts` converts heterogeneous signals into a comparable daily demand index. Source confidence is retained and weak estimates receive less weight.

### 3. Breakout detection

`lib/historical-engine.ts` detects breakouts relative to a product's own recent baseline. A breakout requires both a significant lift and positive daily velocity, reducing false signals from products that are simply always popular.

### 4. Propagation graph

Historical breakout events are converted into directional category-level edges such as:

`US -> UK | probability 0.79 | median lag 13 days | n=184`

The engine does **not** assume that all categories follow `US -> UK -> DE -> NL`; it learns the strongest routes from history.

### 5. Forecast

`lib/propagation-forecast.ts` combines multiple confirmed upstream markets into a target-market breakout probability, confidence score and expected timing window.

### 6. Walk-forward backtest

`lib/backtest.ts` performs time-aware validation. For every forecast, the target product and future events are excluded from the historical training set. Reports include Brier score, log loss, probability calibration, actual breakout outcomes and lead time.

Run:

```bash
npm run backtest:propagation -- data/breakouts.json
```

## API

`POST /api/forecast` exposes the propagation model to the Terminal UI and future external integrations.

## Data integrity rule

ARBITRA must never present estimated signals as exact sales. Every production signal retains its source, confidence and timestamp. Forecasts are stored immutably so their later outcome can be evaluated without hindsight.

## Next data milestones

1. Run and archive Google Trends discovery daily.
2. Add product qualification + multilingual canonical product matching.
3. Add marketplace rank/price/seller/review history.
4. Add advertising and social acceleration signals.
5. Request/enable official Google Trends API access for arbitrary-term five-year backfills.
6. Reconstruct thousands of product trajectories and run the first true out-of-sample ARBITRA backtest.
