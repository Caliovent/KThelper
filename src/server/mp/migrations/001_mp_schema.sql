-- Schéma PostgreSQL officiel — Mode Multijoueur Kill Tilt V2 (Bible p.9-10)
create table if not exists player (
  id uuid primary key,
  pseudo text unique not null,
  email_hash text unique not null,
  adult_attested_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists rating (
  player_id uuid references player(id),
  league text not null,
  season int not null,
  r double precision not null,
  rd double precision not null,
  sigma double precision not null,
  matches int not null default 0,
  last_match_at timestamptz,
  primary key (player_id, league, season)
);

create table if not exists series (
  id uuid primary key,
  seed text not null,
  corpus_version text not null,
  generator_version text not null,
  rules_version text not null,
  template_ids text[] not null
);

create table if not exists match (
  id uuid primary key,
  mode text not null,
  league text not null,
  series_id uuid references series(id),
  state text not null,
  season int not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  settled_at timestamptz,
  daily_key text
);

create table if not exists run (
  id uuid primary key,
  match_id uuid references match(id),
  player_id uuid references player(id),
  phase text not null,
  current_spot int not null default 0,
  deadline timestamptz,
  total_pd int,
  perfects int,
  total_ms int,
  rating_before jsonb,
  rating_after jsonb,
  flags text[] not null default '{}',
  unique (match_id, player_id)
);

create table if not exists attempt (
  run_id uuid references run(id),
  spot_index int not null,
  action text,
  server_ms int not null,
  client_ms int,
  pd int not null,
  loss int,
  loss_unit text,
  timeout boolean not null,
  idempotency_key uuid unique not null,
  primary key (run_id, spot_index)
);

create table if not exists daily (
  daily_key text primary key,
  match_id uuid references match(id),
  seed_commitment text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  revealed_at timestamptz
);

create table if not exists daily_entry (
  daily_key text references daily(daily_key),
  player_id uuid references player(id),
  run_id uuid references run(id),
  primary key (daily_key, player_id)
);

create table if not exists stable (
  id uuid primary key,
  name text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists stable_member (
  stable_id uuid references stable(id),
  player_id uuid references player(id) unique,
  role text not null,
  joined_at timestamptz not null default now(),
  primary key (stable_id, player_id)
);

create table if not exists raid (
  id uuid primary key,
  stable_id uuid references stable(id),
  boss_id text not null,
  state text not null,
  roster uuid[] not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null
);

create table if not exists shared_hand (
  id uuid primary key,
  stable_id uuid references stable(id),
  author_id uuid references player(id),
  payload jsonb not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_match_state_league_expires on match (state, league, expires_at);
create index if not exists idx_run_player_match on run (player_id, match_id);
create index if not exists idx_rating_league_season_r on rating (league, season, r desc);
