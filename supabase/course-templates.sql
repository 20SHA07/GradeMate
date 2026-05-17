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

create index if not exists course_templates_department_idx on course_templates(department);
create index if not exists course_templates_source_syllabus_path_idx on course_templates(source_syllabus_path);
create index if not exists course_template_assessments_template_id_idx on course_template_assessments(course_template_id);
create index if not exists course_template_materials_template_id_idx on course_template_materials(course_template_id);

alter table course_templates enable row level security;
alter table course_template_assessments enable row level security;
alter table course_template_materials enable row level security;

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
