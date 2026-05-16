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

drop trigger if exists set_semesters_user_id on semesters;
create trigger set_semesters_user_id
before insert on semesters
for each row
execute function public.set_current_user_id();

drop trigger if exists set_courses_user_id on courses;
create trigger set_courses_user_id
before insert on courses
for each row
execute function public.set_current_user_id();

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
