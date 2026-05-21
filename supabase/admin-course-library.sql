-- Admin Course Library management policies.
-- Run after:
-- 1. supabase/course-templates.sql
-- 2. supabase/syllabus-contributions.sql
-- 3. supabase/course-template-versions.sql

drop policy if exists "Admins can view all course templates" on course_templates;
drop policy if exists "Admins can view all template assessments" on course_template_assessments;
drop policy if exists "Admins can view all template materials" on course_template_materials;
drop policy if exists "Admins can create template materials" on course_template_materials;
drop policy if exists "Admins can update template materials" on course_template_materials;
drop policy if exists "Admins can delete template materials" on course_template_materials;

create policy "Admins can view all course templates"
on course_templates for select
to authenticated
using (public.is_admin());

create policy "Admins can view all template assessments"
on course_template_assessments for select
to authenticated
using (public.is_admin());

create policy "Admins can view all template materials"
on course_template_materials for select
to authenticated
using (public.is_admin());

create policy "Admins can create template materials"
on course_template_materials for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update template materials"
on course_template_materials for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete template materials"
on course_template_materials for delete
to authenticated
using (public.is_admin());
