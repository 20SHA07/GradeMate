create extension if not exists pgcrypto;

create table if not exists semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  academic_year text,
  term text,
  created_at timestamp with time zone default now()
);

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  name text not null,
  code text,
  credit_hours numeric not null default 3,
  created_at timestamp with time zone default now()
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  weight_percentage numeric not null default 0,
  score numeric,
  max_score numeric,
  category text not null default 'Planned',
  title text,
  weight numeric,
  created_at timestamp with time zone default now()
);

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

create index if not exists semesters_user_id_idx on semesters(user_id);
create index if not exists courses_user_id_idx on courses(user_id);
create index if not exists courses_semester_id_idx on courses(semester_id);
create index if not exists assessments_user_id_idx on assessments(user_id);
create index if not exists assessments_course_id_idx on assessments(course_id);

alter table semesters enable row level security;
alter table courses enable row level security;
alter table assessments enable row level security;

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

drop policy if exists "Users can view their own semesters" on semesters;
drop policy if exists "Users can create their own semesters" on semesters;
drop policy if exists "Users can update their own semesters" on semesters;
drop policy if exists "Users can delete their own semesters" on semesters;

create policy "Users can view their own semesters"
on semesters for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own semesters"
on semesters for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own semesters"
on semesters for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own semesters"
on semesters for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view their own courses" on courses;
drop policy if exists "Users can create their own courses" on courses;
drop policy if exists "Users can update their own courses" on courses;
drop policy if exists "Users can delete their own courses" on courses;

create policy "Users can view their own courses"
on courses for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own courses"
on courses for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from semesters
    where semesters.id = courses.semester_id
      and semesters.user_id = auth.uid()
  )
);

create policy "Users can update their own courses"
on courses for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from semesters
    where semesters.id = courses.semester_id
      and semesters.user_id = auth.uid()
  )
);

create policy "Users can delete their own courses"
on courses for delete
to authenticated
using (auth.uid() = user_id);

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
