-- Safe Course Library uniqueness migration.
-- Apply this before running:
-- npm run library:import-rebuilt -- --confirm
--
-- Why:
-- The older course_templates_code_name_unique rule allows only one template per
-- course_code + course_name. GradeMate now keeps distinct templates across
-- semesters and, when a semester is missing, distinct source hashes.

create extension if not exists pgcrypto;

alter table course_templates add column if not exists unique_key text;
alter table course_templates add column if not exists source_file_name text;
alter table course_templates add column if not exists source_folder_path text;
alter table course_templates add column if not exists source_syllabus_file_name text;
alter table course_templates add column if not exists source_syllabus_path text;
alter table course_templates add column if not exists source_hash text;
alter table course_templates add column if not exists extractor_version text;
alter table course_templates add column if not exists extraction_confidence numeric;
alter table course_templates add column if not exists extraction_warnings jsonb default '[]'::jsonb;
alter table course_templates add column if not exists template_status text default 'ready';
alter table course_templates add column if not exists semester text;
alter table course_templates add column if not exists instructor text;
alter table course_templates add column if not exists instructor_email text;
alter table course_templates add column if not exists schedule text;
alter table course_templates add column if not exists classroom text;
alter table course_templates add column if not exists office_hours text;
alter table course_templates add column if not exists prerequisites text;
alter table course_templates add column if not exists textbooks jsonb default '[]'::jsonb;
alter table course_templates add column if not exists course_description text;
alter table course_templates add column if not exists updated_at timestamp with time zone default now();

create or replace function public.grademate_template_key_part(value text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(trim(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)',
      '',
      'g'
    ),
    ''
  );
$$;

create or replace function public.grademate_course_template_unique_key(
  course_code_value text,
  course_name_value text,
  semester_value text,
  term_value text,
  source_hash_value text,
  source_file_value text,
  row_id uuid default null
)
returns text
language sql
immutable
as $$
  select
    coalesce(public.grademate_template_key_part(course_code_value), 'unknown-code') ||
    '::' ||
    coalesce(public.grademate_template_key_part(course_name_value), 'unknown-course') ||
    '::' ||
    case
      when public.grademate_template_key_part(coalesce(semester_value, term_value)) is not null
        then public.grademate_template_key_part(coalesce(semester_value, term_value))
      else
        'unknown::' ||
        coalesce(
          left(public.grademate_template_key_part(source_hash_value), 12),
          left(md5(coalesce(nullif(source_file_value, ''), row_id::text, 'unknown-source')), 12)
        )
    end;
$$;

update course_templates
set unique_key = public.grademate_course_template_unique_key(
  course_code,
  course_name,
  semester,
  term,
  source_hash,
  coalesce(source_file_name, source_syllabus_file_name, source_syllabus_path),
  id
)
where unique_key is null
   or trim(unique_key) = '';

-- Preserve all rows if pre-existing data already contains duplicate generated
-- keys. Older data should usually be unique here, but this keeps the migration
-- non-destructive.
with ranked as (
  select
    id,
    unique_key,
    row_number() over (
      partition by unique_key
      order by updated_at desc nulls last, created_at desc nulls last, id
    ) as duplicate_rank
  from course_templates
)
update course_templates
set unique_key = ranked.unique_key || '::dup-' || left(course_templates.id::text, 8)
from ranked
where course_templates.id = ranked.id
  and ranked.duplicate_rank > 1;

alter table course_templates alter column unique_key set not null;

alter table course_templates
drop constraint if exists course_templates_course_code_key;

alter table course_templates
drop constraint if exists course_templates_code_name_unique;

drop index if exists course_templates_code_name_unique;
drop index if exists course_templates_code_name_semester_unique;

create unique index if not exists course_templates_unique_key_unique
on course_templates(unique_key);

create index if not exists course_templates_code_name_lookup_idx
on course_templates(course_code, course_name);

create index if not exists course_templates_template_status_idx
on course_templates(template_status);

create index if not exists course_templates_source_hash_idx
on course_templates(source_hash);

alter table course_templates
drop constraint if exists course_templates_template_status_check;

alter table course_templates
add constraint course_templates_template_status_check
check (template_status in ('ready', 'needs_review', 'archived'));

alter table course_template_assessments add column if not exists confidence numeric;
alter table course_template_assessments add column if not exists source text;
alter table course_template_assessments add column if not exists inferred boolean default false;
alter table course_template_assessments add column if not exists warning text;
alter table course_template_assessments add column if not exists source_text_snippet text;
alter table course_template_assessments add column if not exists updated_at timestamp with time zone default now();
