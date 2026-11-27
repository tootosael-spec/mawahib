-- Community interactions for Mawahib: dislikes.
-- Likes, comments and reports already exist in migration 001.
create table if not exists public.talent_dislikes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  talent_id uuid not null references public.talents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, talent_id)
);

create index if not exists talent_dislikes_talent_id_idx
  on public.talent_dislikes(talent_id);

alter table public.talent_dislikes enable row level security;

revoke all on table public.talent_dislikes from anon, authenticated;
grant select on table public.talent_dislikes to anon, authenticated;
grant insert, delete on table public.talent_dislikes to authenticated;

drop policy if exists "Dislikes are publicly readable" on public.talent_dislikes;
create policy "Dislikes are publicly readable"
on public.talent_dislikes for select
to anon, authenticated
using (true);

drop policy if exists "Users dislike as themselves" on public.talent_dislikes;
create policy "Users dislike as themselves"
on public.talent_dislikes for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users remove own dislikes" on public.talent_dislikes;
create policy "Users remove own dislikes"
on public.talent_dislikes for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Explicit least-privilege grants for the existing community tables.
alter table public.talent_likes enable row level security;
revoke all on table public.talent_likes from anon, authenticated;
grant select on table public.talent_likes to anon, authenticated;
grant insert, delete on table public.talent_likes to authenticated;

alter table public.talent_comments enable row level security;
revoke all on table public.talent_comments from anon, authenticated;
grant select on table public.talent_comments to anon, authenticated;
grant insert, delete on table public.talent_comments to authenticated;

alter table public.talent_reports enable row level security;
revoke all on table public.talent_reports from anon, authenticated;
grant insert on table public.talent_reports to anon, authenticated;
