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

The first engine is deliberately source-independent:

`raw market observations -> normalized daily demand -> breakout events -> propagation graph -> forecast -> backtest`

### 1. Raw observations

Every source adapter emits the same shape through `lib/data-source.ts`. Planned sources include search interest, marketplace rank/sales proxies, social velocity, advertising activity, prices, seller counts and review velocity.

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

`lib/backtest.ts` performs time-aware validation. For every forecast, the target product and future events are excluded from the historical training set. Reports include:

- Brier score
- log loss
- probability calibration
- actual breakout outcomes
- lead time

This is more important than raw classification accuracy because ARBITRA should produce probabilities that are genuinely trustworthy.

## Historical breakout input

The runnable backtest currently accepts a JSON array:

```json
[
  {
    "productId": "product-123",
    "category": "Home & Kitchen",
    "market": "US",
    "date": "2025-02-04",
    "strength": 82,
    "baseline": 21.4,
    "velocity": 18.2
  }
]
```

Run:

```bash
npm run backtest:propagation -- data/breakouts.json
```

## API

`POST /api/forecast` exposes the propagation model to the Terminal UI and future external integrations.

## Data integrity rule

ARBITRA must never present estimated signals as exact sales. Every production signal should retain its source, confidence and timestamp. Forecasts are stored immutably so their later outcome can be evaluated without hindsight.

## Next milestone

Connect historical data sources and reconstruct a first large set of real product trajectories for US, UK, DE and NL. The first go/no-go metric is whether the highest-probability forecasts are materially better calibrated than the underlying market base rate on unseen historical cases.
