create table if not exists public.link_previews (
  normalized_url text primary key,
  original_url text not null,
  hostname text not null,
  title text,
  description text,
  image_url text,
  site_name text,
  status text not null check (status = any (array['ready','failed'])),
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.link_previews enable row level security;

create index if not exists idx_link_previews_expires_at
  on public.link_previews (expires_at);
