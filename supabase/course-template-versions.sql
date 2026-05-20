-- Version history and publish metadata for admin-approved syllabus contributions.
-- Run after:
-- 1. supabase/course-templates.sql
-- 2. supabase/course-template-unique-key.sql
-- 3. supabase/syllabus-contributions.sql

create extension if not exists pgcrypto;

create table if not exists course_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references course_templates(id) on delete cascade,
  previous_template_json jsonb not null,
  previous_assessments_json jsonb not null default '[]'::jsonb,
  previous_materials_json jsonb not null default '[]'::jsonb,
  replaced_by_contribution_id uuid references syllabus_contributions(id) on delete set null,
  replaced_by_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table syllabus_contributions
add column if not exists published_template_id uuid references course_templates(id);

alter table syllabus_contributions
add column if not exists reviewed_at timestamp with time zone;

alter table syllabus_contributions
add column if not exists publish_action text;

alter table syllabus_contributions
drop constraint if exists syllabus_contributions_publish_action_check;

alter table syllabus_contributions
add constraint syllabus_contributions_publish_action_check
check (
  publish_action is null
  or publish_action in (
    'replaced_existing',
    'created_new',
    'marked_latest',
    'feedback_only',
    'needs_changes',
    'rejected'
  )
);

create index if not exists course_template_versions_template_id_idx
on course_template_versions(template_id);

create index if not exists course_template_versions_contribution_id_idx
on course_template_versions(replaced_by_contribution_id);

create index if not exists syllabus_contributions_published_template_id_idx
on syllabus_contributions(published_template_id);

create index if not exists syllabus_contributions_reviewed_at_idx
on syllabus_contributions(reviewed_at);

alter table course_template_versions enable row level security;

drop policy if exists "Admins can view course template versions" on course_template_versions;
drop policy if exists "Admins can create course template versions" on course_template_versions;

create policy "Admins can view course template versions"
on course_template_versions for select
using (public.is_admin());

create policy "Admins can create course template versions"
on course_template_versions for insert
with check (public.is_admin());
