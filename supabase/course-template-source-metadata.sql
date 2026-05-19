-- Optional metadata columns for deterministic Course Library rebuilds.
-- For rebuilt imports, prefer supabase/course-template-unique-key.sql. It
-- includes these metadata columns and replaces the old course_code+course_name
-- uniqueness rule with stable unique_key upserts.

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

alter table course_templates
drop constraint if exists course_templates_template_status_check;

alter table course_templates
add constraint course_templates_template_status_check
check (template_status in ('ready', 'needs_review', 'archived'));

alter table course_templates
drop constraint if exists course_templates_code_name_unique;

drop index if exists course_templates_code_name_unique;
drop index if exists course_templates_code_name_semester_unique;

create index if not exists course_templates_template_status_idx
on course_templates(template_status);

create index if not exists course_templates_source_hash_idx
on course_templates(source_hash);

alter table course_template_assessments add column if not exists confidence numeric;
alter table course_template_assessments add column if not exists source text;
alter table course_template_assessments add column if not exists inferred boolean default false;
alter table course_template_assessments add column if not exists warning text;
alter table course_template_assessments add column if not exists source_text_snippet text;
alter table course_template_assessments add column if not exists updated_at timestamp with time zone default now();
