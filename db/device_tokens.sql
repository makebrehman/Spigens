-- ============================================================================
-- Native push (FCM) device tokens
-- Run this in the Supabase SQL editor (project: spigens-5df38).
-- ============================================================================

create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null unique,
  platform    text not null default 'android',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists idx_device_tokens_user on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

-- A user can read/delete only their own device tokens from the client.
drop policy if exists device_tokens_select_own on public.device_tokens;
create policy device_tokens_select_own on public.device_tokens
  for select using (auth.uid() = user_id);

drop policy if exists device_tokens_delete_own on public.device_tokens;
create policy device_tokens_delete_own on public.device_tokens
  for delete using (auth.uid() = user_id);

-- Registration goes through this SECURITY DEFINER function so a token can be
-- reassigned to the current user when accounts are switched on one device
-- (which a plain RLS-guarded upsert could not do).
create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.device_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), p_token, coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = excluded.platform,
        updated_at = now();
end;
$$;

grant execute on function public.register_device_token(text, text) to authenticated;
