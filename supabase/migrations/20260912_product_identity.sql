create table if not exists trend_candidates (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  market_code text not null references markets(code),
  term text not null,
  normalized_term text,
  observed_at timestamptz,
  category_hint text,
  qualification_label text check (qualification_label in ('PRODUCT','NON_PRODUCT','REVIEW')),
  qualification_confidence numeric check (qualification_confidence between 0 and 1),
  qualification_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source, market_code, term, observed_at)
);

create index if not exists trend_candidates_review_idx
  on trend_candidates(qualification_label, qualification_confidence desc, created_at desc);

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
