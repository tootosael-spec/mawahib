-- Guest community interactions and automatic comment screening.
-- Visitors can react, comment, and report comments without signing in.

-- Reactions use a browser-generated visitor UUID instead of requiring an account.
alter table public.talent_likes drop constraint if exists talent_likes_pkey;
alter table public.talent_likes add column if not exists id uuid default gen_random_uuid();
alter table public.talent_likes add column if not exists visitor_id uuid default gen_random_uuid();
alter table public.talent_likes alter column user_id drop not null;
alter table public.talent_likes alter column id set not null;
alter table public.talent_likes alter column visitor_id set not null;
alter table public.talent_likes add constraint talent_likes_pkey primary key (id);
create unique index if not exists talent_likes_visitor_unique
  on public.talent_likes(talent_id, visitor_id);

alter table public.talent_dislikes drop constraint if exists talent_dislikes_pkey;
alter table public.talent_dislikes add column if not exists id uuid default gen_random_uuid();
alter table public.talent_dislikes add column if not exists visitor_id uuid default gen_random_uuid();
alter table public.talent_dislikes alter column user_id drop not null;
alter table public.talent_dislikes alter column id set not null;
alter table public.talent_dislikes alter column visitor_id set not null;
alter table public.talent_dislikes add constraint talent_dislikes_pkey primary key (id);
create unique index if not exists talent_dislikes_visitor_unique
  on public.talent_dislikes(talent_id, visitor_id);

alter table public.talent_likes enable row level security;
revoke all on public.talent_likes from anon, authenticated;
grant select, insert on public.talent_likes to anon, authenticated;
drop policy if exists "Likes are readable" on public.talent_likes;
drop policy if exists "Users like as themselves" on public.talent_likes;
drop policy if exists "Users remove own likes" on public.talent_likes;
drop policy if exists "Guest likes are public" on public.talent_likes;
create policy "Guest likes are public"
on public.talent_likes for select to anon, authenticated using (true);
drop policy if exists "Guests can like" on public.talent_likes;
create policy "Guests can like"
on public.talent_likes for insert to anon, authenticated
with check (visitor_id is not null and user_id is null);

alter table public.talent_dislikes enable row level security;
revoke all on public.talent_dislikes from anon, authenticated;
grant select, insert on public.talent_dislikes to anon, authenticated;
drop policy if exists "Dislikes are publicly readable" on public.talent_dislikes;
drop policy if exists "Users dislike as themselves" on public.talent_dislikes;
drop policy if exists "Users remove own dislikes" on public.talent_dislikes;
drop policy if exists "Guest dislikes are public" on public.talent_dislikes;
create policy "Guest dislikes are public"
on public.talent_dislikes for select to anon, authenticated using (true);
drop policy if exists "Guests can dislike" on public.talent_dislikes;
create policy "Guests can dislike"
on public.talent_dislikes for insert to anon, authenticated
with check (visitor_id is not null and user_id is null);

-- Comments no longer require a profile or a moderation queue.
alter table public.talent_comments alter column user_id drop not null;
alter table public.talent_comments add column if not exists visitor_id uuid default gen_random_uuid();
alter table public.talent_comments alter column visitor_id set not null;

drop policy if exists "Published comments are public" on public.talent_comments;
drop policy if exists "Authenticated users add comments" on public.talent_comments;
drop policy if exists "Users delete own comments" on public.talent_comments;
drop policy if exists "Guest comments are public" on public.talent_comments;
create policy "Guest comments are public"
on public.talent_comments for select to anon, authenticated
using (status = 'published');
drop policy if exists "Guests can add comments" on public.talent_comments;
create policy "Guests can add comments"
on public.talent_comments for insert to anon, authenticated
with check (user_id is null and visitor_id is not null and status = 'published');
revoke all on public.talent_comments from anon, authenticated;
grant select, insert on public.talent_comments to anon, authenticated;

-- Reports now point to the individual comment.
alter table public.talent_reports
  add column if not exists comment_id uuid references public.talent_comments(id) on delete cascade;
alter table public.talent_reports drop constraint if exists talent_reports_check;
alter table public.talent_reports
  add constraint talent_reports_target_check
  check (talent_id is not null or media_id is not null or comment_id is not null);
create index if not exists talent_reports_comment_id_idx
  on public.talent_reports(comment_id);
alter table public.talent_reports enable row level security;
revoke all on public.talent_reports from anon, authenticated;
grant insert on public.talent_reports to anon, authenticated;
drop policy if exists "Users submit reports" on public.talent_reports;
create policy "Visitors can report content"
on public.talent_reports for insert to anon, authenticated
with check (reporter_id is null or reporter_id = (select auth.uid()));

-- Rule-based screening runs inside Postgres, so it cannot be bypassed by the browser.
create or replace function public.screen_talent_comment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if char_length(trim(coalesce(new.body, ''))) < 1
     or char_length(new.body) > 1000
     or new.body ~* '(اباحي|إباحي|جنس(ي|ية)?|ممارسة جنسية|عري|عاري|تحرش|اغتصاب|استغلال جنسي|porn|xxx|nude|sexual|sexually|rape|molest|harass)'
     or new.body ~* '(تهديد|ابتزاز|سأقتلك|اقتل(ك|ه|ها)?|اذبح(ك|ه|ها)?|تفجير|قنبلة|انتحر|سوف أؤذيك|kill you|i will hurt you|bomb threat)'
  then
    raise exception 'COMMENT_BLOCKED: هذا التعليق يخالف إرشادات مواهب وتم حذفه تلقائياً.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists talent_comments_auto_screen on public.talent_comments;
create trigger talent_comments_auto_screen
before insert or update of body on public.talent_comments
for each row execute function public.screen_talent_comment();

revoke all on function public.screen_talent_comment() from public, anon, authenticated;

-- Remove previously stored comments that match the same prohibited-content rules.
delete from public.talent_comments
where body ~* '(اباحي|إباحي|جنس(ي|ية)?|ممارسة جنسية|عري|عاري|تحرش|اغتصاب|استغلال جنسي|porn|xxx|nude|sexual|sexually|rape|molest|harass)'
   or body ~* '(تهديد|ابتزاز|سأقتلك|اقتل(ك|ه|ها)?|اذبح(ك|ه|ها)?|تفجير|قنبلة|انتحر|سوف أؤذيك|kill you|i will hurt you|bomb threat)';

update public.talent_comments set status = 'published' where status = 'pending';
