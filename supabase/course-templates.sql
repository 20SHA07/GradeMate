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

create index if not exists course_templates_department_idx on course_templates(department);
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
