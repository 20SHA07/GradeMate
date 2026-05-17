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

create table if not exists syllabus_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  file_path text not null,
  original_filename text not null,
  status text not null default 'uploaded',
  extraction jsonb,
  error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists course_templates (
  id uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  course_name text not null,
  department text,
  credit_hours numeric not null default 3,
  description text,
  source_file_name text,
  source_folder_path text,
  extraction_confidence numeric not null default 0,
  created_at timestamp with time zone default now()
);

create table if not exists course_template_assessments (
  id uuid primary key default gen_random_uuid(),
  course_template_id uuid not null references course_templates(id) on delete cascade,
  name text not null,
  weight_percentage numeric not null default 0,
  max_score numeric not null default 100,
  confidence numeric not null default 0,
  created_at timestamp with time zone default now()
);

create table if not exists course_template_materials (
  id uuid primary key default gen_random_uuid(),
  course_template_id uuid not null references course_templates(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
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
create index if not exists syllabus_uploads_user_id_idx on syllabus_uploads(user_id);
create index if not exists syllabus_uploads_course_id_idx on syllabus_uploads(course_id);
create index if not exists course_templates_department_idx on course_templates(department);
create index if not exists course_template_assessments_template_id_idx on course_template_assessments(course_template_id);
create index if not exists course_template_materials_template_id_idx on course_template_materials(course_template_id);

alter table semesters enable row level security;
alter table courses enable row level security;
alter table assessments enable row level security;
alter table syllabus_uploads enable row level security;
alter table course_templates enable row level security;
alter table course_template_assessments enable row level security;
alter table course_template_materials enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('syllabi', 'syllabi', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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

drop trigger if exists set_syllabus_uploads_user_id on syllabus_uploads;
create trigger set_syllabus_uploads_user_id
before insert on syllabus_uploads
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

drop policy if exists "Users can view their own syllabus uploads" on syllabus_uploads;
drop policy if exists "Users can create their own syllabus uploads" on syllabus_uploads;
drop policy if exists "Users can update their own syllabus uploads" on syllabus_uploads;
drop policy if exists "Users can delete their own syllabus uploads" on syllabus_uploads;

create policy "Users can view their own syllabus uploads"
on syllabus_uploads for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own syllabus uploads"
on syllabus_uploads for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from courses
    where courses.id = syllabus_uploads.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "Users can update their own syllabus uploads"
on syllabus_uploads for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from courses
    where courses.id = syllabus_uploads.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "Users can delete their own syllabus uploads"
on syllabus_uploads for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Logged-in users can view course templates" on course_templates;
drop policy if exists "Logged-in users can view course template assessments" on course_template_assessments;
drop policy if exists "Logged-in users can view course template materials" on course_template_materials;

create policy "Logged-in users can view course templates"
on course_templates for select
to authenticated
using (true);

create policy "Logged-in users can view course template assessments"
on course_template_assessments for select
to authenticated
using (
  exists (
    select 1
    from course_templates
    where course_templates.id = course_template_assessments.course_template_id
  )
);

create policy "Logged-in users can view course template materials"
on course_template_materials for select
to authenticated
using (
  exists (
    select 1
    from course_templates
    where course_templates.id = course_template_materials.course_template_id
  )
);

drop policy if exists "Users can view their own syllabus files" on storage.objects;
drop policy if exists "Users can upload their own syllabus files" on storage.objects;
drop policy if exists "Users can update their own syllabus files" on storage.objects;
drop policy if exists "Users can delete their own syllabus files" on storage.objects;

create policy "Users can view their own syllabus files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own syllabus files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own syllabus files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own syllabus files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);
