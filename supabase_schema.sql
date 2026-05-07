-- ============================================================
-- RUNPLAN — Supabase Schema
-- Jalankan ini di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. TABEL USERS (profil publik, terpisah dari auth.users bawaan Supabase)
--    Kita pakai custom auth sederhana (bukan Supabase Auth)
--    karena kamu hanya butuh username + password

create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  username    text unique not null,
  password    text not null,          -- disimpan as bcrypt hash (dihandle di client via library)
  created_at  timestamptz default now()
);

-- Index untuk pencarian username cepat
create index if not exists users_username_idx on public.users(username);

-- 2. TABEL PLANS (program lari tiap user)
create table if not exists public.plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  type          text not null check (type in ('road', 'trail')),
  filosofi      text not null,
  dist          text,                  -- untuk road: '5k','10k','hm','fm'
  level         text not null,
  race_name     text not null,
  race_date     text,                  -- format ISO: '2026-07-04'
  target_minutes int,
  race_dist_km  numeric,
  race_elev_gain int,
  pace_min      int,
  pace_sec      int,
  program       jsonb not null,        -- seluruh array minggu × hari disimpan sebagai JSON
  current_week  int default 0,
  paused_weeks  jsonb default '[]',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists plans_user_id_idx on public.plans(user_id);

-- 3. TABEL SESSION_LOGS (status tiap sesi: done / skip + catatan)
create table if not exists public.session_logs (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references public.plans(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  week_idx  int not null,
  day_idx   int not null,
  status    text check (status in ('done', 'skip', null)),
  note      text,
  logged_at timestamptz default now(),
  unique(plan_id, week_idx, day_idx)   -- satu status per sesi per plan
);

create index if not exists session_logs_plan_id_idx on public.session_logs(plan_id);

-- 4. TRIGGER: auto-update updated_at pada plans
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger plans_updated_at
  before update on public.plans
  for each row execute function update_updated_at();

-- 5. ROW LEVEL SECURITY (RLS) — penting agar data user tidak bocor
--    Karena kita pakai custom auth (bukan Supabase Auth),
--    kita set policy berdasarkan anon key + validasi di app level.
--    Untuk project pribadi simpel, disable RLS dulu:

alter table public.users disable row level security;
alter table public.plans disable row level security;
alter table public.session_logs disable row level security;

-- ============================================================
-- CATATAN SETUP:
-- 1. Buka supabase.com → New Project
-- 2. Pergi ke SQL Editor → paste & run script ini
-- 3. Pergi ke Settings → API → copy:
--    - Project URL  → taruh di supabase_config.js sebagai SUPABASE_URL
--    - anon public  → taruh di supabase_config.js sebagai SUPABASE_KEY
-- ============================================================