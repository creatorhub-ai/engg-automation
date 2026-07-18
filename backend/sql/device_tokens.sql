-- device_tokens: one row per installed app/device that registered for push.
-- Run this once in the Supabase SQL editor.
--
-- The backend upserts on `token` (POST /api/push/register) and looks tokens up
-- by `user_email` when sending (sendPushToEmails).

create table if not exists public.device_tokens (
  token       text primary key,
  user_email  text not null,
  platform    text default 'android',
  updated_at  timestamptz default now()
);

-- Fast lookup of all devices belonging to a user when sending a push.
create index if not exists device_tokens_user_email_idx
  on public.device_tokens (lower(user_email));
