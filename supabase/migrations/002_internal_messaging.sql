-- Mawahib internal messaging
-- Customers must sign in before requesting a service. Only conversation participants can read messages.

create table if not exists public.talent_conversations (
  id uuid primary key default gen_random_uuid(),
  talent_id uuid not null references public.talents(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  talent_owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_id <> talent_owner_id)
);

create table if not exists public.talent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.talent_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists talent_conversations_client_idx
  on public.talent_conversations(client_id, updated_at desc);
create index if not exists talent_conversations_owner_idx
  on public.talent_conversations(talent_owner_id, updated_at desc);
create index if not exists talent_messages_conversation_idx
  on public.talent_messages(conversation_id, created_at);

alter table public.talent_conversations enable row level security;
alter table public.talent_messages enable row level security;

drop policy if exists "Participants read own talent conversations" on public.talent_conversations;
create policy "Participants read own talent conversations"
on public.talent_conversations for select to authenticated
using (client_id = (select auth.uid()) or talent_owner_id = (select auth.uid()));

drop policy if exists "Signed-in clients start conversations with published talents" on public.talent_conversations;
create policy "Signed-in clients start conversations with published talents"
on public.talent_conversations for insert to authenticated
with check (
  client_id = (select auth.uid())
  and client_id <> talent_owner_id
  and exists (
    select 1 from public.talents t
    where t.id = talent_id
      and t.owner_id = talent_owner_id
      and t.status = 'published'
  )
);

drop policy if exists "Participants read messages in their conversations" on public.talent_messages;
create policy "Participants read messages in their conversations"
on public.talent_messages for select to authenticated
using (
  exists (
    select 1 from public.talent_conversations c
    where c.id = conversation_id
      and (c.client_id = (select auth.uid()) or c.talent_owner_id = (select auth.uid()))
  )
);

drop policy if exists "Participants send messages in open conversations" on public.talent_messages;
create policy "Participants send messages in open conversations"
on public.talent_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.talent_conversations c
    where c.id = conversation_id
      and c.status = 'open'
      and (c.client_id = (select auth.uid()) or c.talent_owner_id = (select auth.uid()))
  )
);

grant select, insert on public.talent_conversations to authenticated;
grant select, insert on public.talent_messages to authenticated;
