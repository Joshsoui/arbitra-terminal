create table if not exists trend_candidates (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_key text not null,
  canonical_term text not null,
  classification text not null default 'unclassified',
  product_id uuid references products(id) on delete set null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  unique(source, external_key)
);

create index if not exists trend_candidates_status_idx
  on trend_candidates(classification, last_seen_at desc);

create table if not exists trend_candidate_observations (
  id bigserial primary key,
  candidate_id uuid not null references trend_candidates(id) on delete cascade,
  market_code text not null references markets(code),
  observed_at timestamptz not null,
  signal_type text not null,
  value numeric not null,
  unit text,
  confidence numeric check (confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  unique(candidate_id, market_code, observed_at, signal_type)
);

create index if not exists trend_candidate_obs_lookup_idx
  on trend_candidate_observations(candidate_id, market_code, observed_at desc);

alter table trend_candidates
  drop constraint if exists trend_candidates_classification_check;

alter table trend_candidates
  add constraint trend_candidates_classification_check
  check (classification in ('unclassified', 'product', 'non_product', 'ambiguous'));
