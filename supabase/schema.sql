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
  title text not null,
  weight numeric not null default 0,
  score numeric,
  created_at timestamp with time zone default now()
);

create index if not exists semesters_user_id_idx on semesters(user_id);
create index if not exists courses_user_id_idx on courses(user_id);
create index if not exists courses_semester_id_idx on courses(semester_id);
create index if not exists assessments_user_id_idx on assessments(user_id);
create index if not exists assessments_course_id_idx on assessments(course_id);

alter table semesters enable row level security;
alter table courses enable row level security;
alter table assessments enable row level security;

drop policy if exists "Users can view their own semesters" on semesters;
drop policy if exists "Users can create their own semesters" on semesters;
drop policy if exists "Users can update their own semesters" on semesters;
drop policy if exists "Users can delete their own semesters" on semesters;

create policy "Users can view their own semesters"
on semesters for select
using (auth.uid() = user_id);

create policy "Users can create their own semesters"
on semesters for insert
with check (auth.uid() = user_id);

create policy "Users can update their own semesters"
on semesters for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own semesters"
on semesters for delete
using (auth.uid() = user_id);

drop policy if exists "Users can view their own courses" on courses;
drop policy if exists "Users can create their own courses" on courses;
drop policy if exists "Users can update their own courses" on courses;
drop policy if exists "Users can delete their own courses" on courses;

create policy "Users can view their own courses"
on courses for select
using (auth.uid() = user_id);

create policy "Users can create their own courses"
on courses for insert
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
using (auth.uid() = user_id);

drop policy if exists "Users can view their own assessments" on assessments;
drop policy if exists "Users can create their own assessments" on assessments;
drop policy if exists "Users can update their own assessments" on assessments;
drop policy if exists "Users can delete their own assessments" on assessments;

create policy "Users can view their own assessments"
on assessments for select
using (auth.uid() = user_id);

create policy "Users can create their own assessments"
on assessments for insert
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
using (auth.uid() = user_id);
