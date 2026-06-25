-- Allow the 'contact' message type in DMs.
-- Shared contacts are sent as message_type='contact' with the contact details as an
-- encrypted JSON body, rendered as a rich contact card. Without this, Postgres'
-- CHECK constraint rejects the insert and the contact never reaches the recipient.

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type = any (array['text','system','invite','image','video','audio','file','contact']));
