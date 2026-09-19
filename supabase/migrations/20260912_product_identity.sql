-- trend_candidates is defined in 002_trend_discovery.sql (source, external_key,
-- canonical_term, classification, product_id, first_seen_at, last_seen_at). An
-- earlier version of this migration tried to redefine it here with a different
-- column set (market_code, qualification_label, ...); since 002 already created
-- the table, that `create table if not exists` silently no-opped and those
-- columns never existed. Removed rather than left as misleading dead schema —
-- scripts/qualify-google-candidates.ts and scripts/import-trend-candidates.ts
-- are the source of truth for what trend_candidates actually looks like.

create table if not exists product_identity_matches (
  id bigserial primary key,
  candidate_id uuid not null references trend_candidates(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  match_score numeric not null check (match_score between 0 and 1),
  decision text not null check (decision in ('MATCH','REVIEW','NO_MATCH')),
  matched_alias text,
  reasons jsonb not null default '[]'::jsonb,
  matcher_version text not null,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  unique(candidate_id, matcher_version)
);

create index if not exists product_identity_matches_review_idx
  on product_identity_matches(decision, match_score desc, created_at desc);

create table if not exists product_identifiers (
  id bigserial primary key,
  product_id uuid not null references products(id) on delete cascade,
  identifier_type text not null,
  identifier_value text not null,
  source text,
  market_code text references markets(code),
  confidence numeric check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique(identifier_type, identifier_value, market_code)
);

comment on table trend_candidates is 'Raw discovered terms staged before entering the canonical ARBITRA product graph.';
comment on table product_identity_matches is 'Versioned candidate-to-product matching decisions. Ambiguous matches remain reviewable.';
comment on table product_identifiers is 'Stable marketplace/product identifiers such as GTIN, EAN, UPC, ASIN or marketplace IDs.';
