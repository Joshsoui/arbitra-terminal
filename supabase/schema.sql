create extension if not exists pgcrypto;

create table if not exists markets (
  code text primary key,
  name text not null,
  currency text not null,
  region text
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  category text,
  brand text,
  created_at timestamptz not null default now()
);

create table if not exists product_aliases (
  id bigserial primary key,
  product_id uuid not null references products(id) on delete cascade,
  market_code text references markets(code),
  source text not null,
  alias text not null,
  external_id text,
  unique(source, external_id)
);

create table if not exists observations (
  id bigserial primary key,
  product_id uuid not null references products(id) on delete cascade,
  market_code text not null references markets(code),
  observed_at timestamptz not null,
  source text not null,
  signal_type text not null,
  value numeric not null,
  unit text,
  confidence numeric check (confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  unique(product_id, market_code, observed_at, source, signal_type)
);

create index if not exists observations_lookup_idx
  on observations(product_id, market_code, observed_at desc);

create table if not exists market_snapshots (
  id bigserial primary key,
  product_id uuid not null references products(id) on delete cascade,
  market_code text not null references markets(code),
  snapshot_date date not null,
  momentum numeric,
  acceleration numeric,
  saturation numeric,
  ad_activity numeric,
  marketplace_competition numeric,
  retail_price numeric,
  landed_cost numeric,
  source_coverage numeric,
  unique(product_id, market_code, snapshot_date)
);

create table if not exists breakout_events (
  id bigserial primary key,
  product_id uuid not null references products(id) on delete cascade,
  market_code text not null references markets(code),
  breakout_at timestamptz not null,
  detector_version text not null,
  strength numeric,
  evidence jsonb not null default '{}'::jsonb
);

create table if not exists forecasts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  target_market text not null references markets(code),
  generated_at timestamptz not null default now(),
  horizon_days integer not null default 30,
  breakout_probability numeric not null,
  confidence numeric not null,
  opportunity_score numeric,
  status text,
  model_version text not null,
  features jsonb not null default '{}'::jsonb
);

create index if not exists forecasts_lookup_idx
  on forecasts(product_id, target_market, generated_at desc);

create table if not exists forecast_outcomes (
  forecast_id uuid primary key references forecasts(id) on delete cascade,
  evaluated_at timestamptz not null default now(),
  actual_breakout boolean not null,
  actual_breakout_at timestamptz,
  realized_growth numeric,
  notes text
);

create table if not exists propagation_edges (
  id bigserial primary key,
  category text not null,
  source_market text not null references markets(code),
  target_market text not null references markets(code),
  sample_size integer not null,
  transition_probability numeric not null,
  median_lag_days numeric,
  p25_lag_days numeric,
  p75_lag_days numeric,
  updated_at timestamptz not null default now(),
  unique(category, source_market, target_market)
);

insert into markets(code, name, currency, region) values
  ('US', 'United States', 'USD', 'North America'),
  ('UK', 'United Kingdom', 'GBP', 'Europe'),
  ('DE', 'Germany', 'EUR', 'Europe'),
  ('NL', 'Netherlands', 'EUR', 'Europe')
on conflict (code) do nothing;
