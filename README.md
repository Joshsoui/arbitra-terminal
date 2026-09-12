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

- `POST /api/forecast` — propagation forecast
- `GET /api/paid-social` — paid-social opportunity signal
- `GET /api/marketplace` — marketplace signal adapter
- `POST /api/product-identity` — candidate qualification and product matching

## Data integrity rule

ARBITRA must never present estimated signals as exact sales. Every production signal retains its source, confidence and timestamp. Forecasts are stored immutably so their later outcome can be evaluated without hindsight.

## Next data milestones

1. Run and archive Google Trends discovery daily across supported markets.
2. Expand multilingual product identity and stable identifier matching.
3. Persist marketplace and paid-social observations by market.
4. Add source-coverage and freshness scoring to every opportunity.
5. Request/enable official Google Trends API access for arbitrary-term five-year backfills.
6. Reconstruct thousands of product trajectories and run the first true out-of-sample ARBITRA backtest.
