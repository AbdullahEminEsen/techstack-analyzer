-- ============================================================
-- Tech Stack Analyzer — Supabase şeması
-- Supabase Dashboard → SQL Editor → bu dosyanın tamamını yapıştır → Run
-- ============================================================

-- 1) Analiz sonuçlarının cache'lendiği tablo
create table if not exists public.analyses (
  id          uuid primary key default gen_random_uuid(),
  url         text        not null,          -- normalize edilmiş URL (cache anahtarı)
  html_hash   text        not null,          -- sitenin HTML'inin SHA-256'sı (değişiklik tespiti)
  result      jsonb       not null,          -- Claude'un döndürdüğü analiz JSON'ı
  model       text        not null,          -- hangi modelle üretildi
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (url)                               -- her URL için tek satır; değişince üzerine yazılır
);

create index if not exists analyses_url_idx on public.analyses (url);

-- 2) Cihaz başına kullanım limiti tablosu
create table if not exists public.analysis_usage (
  device_id    text        primary key,      -- cookie'deki UUID
  analyzed_url text        not null,          -- yaptığı tek analizin URL'i (bilgi amaçlı)
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- Bu tablolara YALNIZCA sunucu tarafı (service_role) erişecek.
-- Anon anahtarla tarayıcıdan erişim olmasın diye RLS açık,
-- politika eklenmiyor → anon hiçbir şey göremez/yazamaz.
-- service_role RLS'i bypass eder, sorun olmaz.
-- ============================================================
alter table public.analyses       enable row level security;
alter table public.analysis_usage enable row level security;
