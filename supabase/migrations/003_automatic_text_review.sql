-- Automatic text screening for new or edited talent profiles.
-- Clean text is published automatically; risky or contact-heavy text stays pending.
-- This is a rule-based first filter, not AI moderation and not image scanning.

create or replace function public.auto_review_talent_text()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  content_text text;
begin
  -- Dashboard/service-role maintenance can set moderation status explicitly.
  if (select auth.uid()) is null then
    return new;
  end if;

  content_text := coalesce(new.title, '') || ' ' || coalesce(new.description, '');

  if
    char_length(trim(coalesce(new.title, ''))) < 3
    or char_length(trim(coalesce(new.description, ''))) < 15
    or char_length(coalesce(new.title, '')) > 120
    or char_length(coalesce(new.description, '')) > 2000
    or content_text ~* '(https?://|www\.|[[:alnum:]_.%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,})'
    or content_text ~ '([0-9٠-٩]{8,})'
    or content_text ~* '(اباحي|إباحي|جنسي|عاري|عري|تحرش|استغلال جنسي|مخدرات|حشيش|كوكايين|هيروين|ابتزاز|تهديد|قنبلة|مسدس|سلاح ناري|porn|xxx|nude|sexual|cocaine|heroin|weapon|bomb|blackmail)'
  then
    new.status := 'pending';
  else
    new.status := 'published';
  end if;

  return new;
end;
$$;

drop trigger if exists talents_auto_text_review on public.talents;
create trigger talents_auto_text_review
before insert or update of title, description, status
on public.talents
for each row
execute function public.auto_review_talent_text();

revoke all on function public.auto_review_talent_text() from public, anon, authenticated;
