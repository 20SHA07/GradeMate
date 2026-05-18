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
  instructor text,
  instructor_email text,
  schedule text,
  classroom text,
  office_hours text,
  prerequisites text,
  textbooks jsonb,
  description text,
  term text,
  created_at timestamp with time zone default now()
);

alter table courses
  add column if not exists instructor text,
  add column if not exists instructor_email text,
  add column if not exists schedule text,
  add column if not exists classroom text,
  add column if not exists office_hours text,
  add column if not exists prerequisites text,
  add column if not exists textbooks jsonb,
  add column if not exists description text,
  add column if not exists term text;

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
  file_name text not null,
  file_path text not null,
  file_url text,
  extracted_text text,
  extraction_status text not null default 'uploaded',
  extraction_error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists course_templates (
  id uuid primary key default gen_random_uuid(),
  course_code text not null,
  course_name text not null,
  department text,
  credit_hours numeric not null default 3,
  instructor text,
  term text,
  description text,
  source_file_name text,
  source_folder_path text,
  source_syllabus_file_name text,
  source_syllabus_path text,
  extraction_confidence numeric not null default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table course_templates add column if not exists instructor text;
alter table course_templates add column if not exists term text;
alter table course_templates add column if not exists source_syllabus_file_name text;
alter table course_templates add column if not exists source_syllabus_path text;
alter table course_templates add column if not exists updated_at timestamp with time zone default now();

alter table course_templates drop constraint if exists course_templates_course_code_key;

create unique index if not exists course_templates_code_name_unique
on course_templates(course_code, course_name);

create table if not exists course_template_assessments (
  id uuid primary key default gen_random_uuid(),
  course_template_id uuid not null references course_templates(id) on delete cascade,
  name text not null,
  weight_percentage numeric not null default 0,
  max_score numeric not null default 100,
  confidence numeric not null default 0,
  source_text_snippet text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table course_template_assessments add column if not exists source_text_snippet text;
alter table course_template_assessments add column if not exists updated_at timestamp with time zone default now();

create table if not exists course_template_materials (
  id uuid primary key default gen_random_uuid(),
  course_template_id uuid not null references course_templates(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  material_type text,
  created_at timestamp with time zone default now()
);

alter table course_template_materials add column if not exists material_type text;

alter table assessments add column if not exists name text;
alter table assessments add column if not exists weight_percentage numeric not null default 0;
alter table assessments add column if not exists max_score numeric;
alter table assessments add column if not exists category text not null default 'Planned';
alter table assessments add column if not exists title text;
alter table assessments add column if not exists weight numeric;

alter table syllabus_uploads add column if not exists file_name text;
alter table syllabus_uploads add column if not exists file_url text;
alter table syllabus_uploads add column if not exists extracted_text text;
alter table syllabus_uploads add column if not exists extraction_status text not null default 'uploaded';
alter table syllabus_uploads add column if not exists extraction_error text;
alter table syllabus_uploads add column if not exists updated_at timestamp with time zone default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'syllabus_uploads'
      and column_name = 'original_filename'
  ) then
    execute 'update syllabus_uploads set file_name = coalesce(file_name, original_filename) where file_name is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'syllabus_uploads'
      and column_name = 'status'
  ) then
    execute 'update syllabus_uploads set extraction_status = coalesce(extraction_status, status) where extraction_status is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'syllabus_uploads'
      and column_name = 'error'
  ) then
    execute 'update syllabus_uploads set extraction_error = coalesce(extraction_error, error) where extraction_error is null';
  end if;
end $$;

update syllabus_uploads
set file_name = coalesce(file_name, split_part(file_path, '/', cardinality(string_to_array(file_path, '/'))))
where file_name is null;

update syllabus_uploads
set extraction_status = 'uploaded'
where extraction_status is null;

alter table syllabus_uploads alter column file_name set not null;
alter table syllabus_uploads alter column extraction_status set default 'uploaded';
alter table syllabus_uploads alter column extraction_status set not null;

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
create index if not exists course_templates_source_syllabus_path_idx on course_templates(source_syllabus_path);
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
values ('course-syllabi', 'course-syllabi', false, 10485760, array['application/pdf'])
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
drop policy if exists "Anyone can view course templates" on course_templates;
drop policy if exists "Anyone can view course template assessments" on course_template_assessments;
drop policy if exists "Anyone can view course template materials" on course_template_materials;

create policy "Anyone can view course templates"
on course_templates for select
to anon, authenticated
using (true);

create policy "Anyone can view course template assessments"
on course_template_assessments for select
to anon, authenticated
using (true);

create policy "Anyone can view course template materials"
on course_template_materials for select
to anon, authenticated
using (true);

drop policy if exists "Users can view their own syllabus files" on storage.objects;
drop policy if exists "Users can upload their own syllabus files" on storage.objects;
drop policy if exists "Users can update their own syllabus files" on storage.objects;
drop policy if exists "Users can delete their own syllabus files" on storage.objects;
drop policy if exists "Users can view their own syllabi" on storage.objects;
drop policy if exists "Users can upload their own syllabi" on storage.objects;
drop policy if exists "Users can update their own syllabi" on storage.objects;
drop policy if exists "Users can delete their own syllabi" on storage.objects;

create policy "Users can upload their own syllabi"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view their own syllabi"
on storage.objects for select
to authenticated
using (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own syllabi"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own syllabi"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create table if not exists verified_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_type text not null check (
    source_type in ('pdf', 'pasted_text', 'quick_add', 'course_library')
  ),
  source_file_name text,
  source_text_hash text not null,
  extracted_text text,
  course_code text,
  course_name text,
  credit_hours numeric,
  instructor text,
  confirmed_json jsonb not null,
  original_extraction_json jsonb,
  user_feedback text not null check (
    user_feedback in ('correct', 'incorrect', 'corrected')
  ),
  extractor_version text not null default 'dataset-v1',
  ai_provider text check (
    ai_provider is null
    or ai_provider in ('rule_based', 'local_ollama', 'gemini', 'none')
  ),
  confidence numeric,
  total_weight numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table verified_extractions enable row level security;

drop policy if exists "Users can view their own verified extractions" on verified_extractions;
drop policy if exists "Users can create their own verified extractions" on verified_extractions;

create policy "Users can view their own verified extractions"
on verified_extractions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own verified extractions"
on verified_extractions for insert
to authenticated
with check (auth.uid() = user_id);
