-- ============================================================================
-- Fire the push-fanout Edge Function on every new message (DM + community).
-- Run AFTER deploying the function and AFTER db/device_tokens.sql.
-- ============================================================================

create extension if not exists pg_net;

-- Configure these once (replace the placeholders). They are read at runtime so no
-- secret is hard-coded in this file:
--   alter database postgres set app.push_fn_url = 'https://<PROJECT_REF>.supabase.co/functions/v1/push-fanout';
--   alter database postgres set app.push_secret = '<PUSH_WEBHOOK_SECRET>';
-- (<PROJECT_REF> is the subdomain in your NEXT_PUBLIC_SUPABASE_URL;
--  <PUSH_WEBHOOK_SECRET> must match the Edge Function secret of the same name.)

create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fn_url text := current_setting('app.push_fn_url', true);
  secret text := current_setting('app.push_secret', true);
begin
  if fn_url is null or fn_url = '' then
    return NEW; -- not configured yet → no-op
  end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', coalesce(secret, '')
    ),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists trg_push_messages on public.messages;
create trigger trg_push_messages
  after insert on public.messages
  for each row execute function public.notify_push();

drop trigger if exists trg_push_community_messages on public.community_messages;
create trigger trg_push_community_messages
  after insert on public.community_messages
  for each row execute function public.notify_push();
