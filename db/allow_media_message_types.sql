-- Allow media message types in DMs.
-- The original CHECK only permitted ('text','system','invite'), so inserting an
-- image/video/audio/file message was rejected by Postgres and the message never
-- reached the recipient. Applied to project hmvyqgjbtryysxgpbmcb.

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type = any (array['text','system','invite','image','video','audio','file']));
