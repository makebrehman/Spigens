-- Allow media message types in community chats.
-- The original CHECK only permitted ('text','system','invite'); sending an
-- image/video/audio/file/contact was rejected by Postgres. community_messages
-- already has message_type + metadata columns, so only the constraint needs widening.

alter table public.community_messages drop constraint if exists community_messages_message_type_check;
alter table public.community_messages add constraint community_messages_message_type_check
  check (message_type = any (array['text','system','invite','image','video','audio','file','contact']));
