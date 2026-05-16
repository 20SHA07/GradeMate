alter table assessments add column if not exists name text;
alter table assessments add column if not exists weight_percentage numeric not null default 0;
alter table assessments add column if not exists max_score numeric;
alter table assessments add column if not exists category text not null default 'Planned';
alter table assessments add column if not exists title text;
alter table assessments add column if not exists weight numeric;

update assessments
set name = coalesce(name, title, 'Assessment')
where name is null;

update assessments
set weight_percentage = coalesce(nullif(weight_percentage, 0), weight, 0)
where weight is not null;

alter table assessments alter column name set not null;
alter table assessments alter column weight_percentage set default 0;
alter table assessments alter column category set default 'Planned';
alter table assessments alter column title drop not null;

create or replace function public.set_current_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_assessments_user_id on assessments;
create trigger set_assessments_user_id
before insert on assessments
for each row
execute function public.set_current_user_id();

drop policy if exists "Users can view their own assessments" on assessments;
drop policy if exists "Users can create their own assessments" on assessments;
drop policy if exists "Users can update their own assessments" on assessments;
drop policy if exists "Users can delete their own assessments" on assessments;

create policy "Users can view their own assessments"
on assessments for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own assessments"
on assessments for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from courses
    where courses.id = assessments.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "Users can update their own assessments"
on assessments for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from courses
    where courses.id = assessments.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "Users can delete their own assessments"
on assessments for delete
to authenticated
using (auth.uid() = user_id);
