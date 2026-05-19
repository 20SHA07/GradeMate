drop policy if exists "Logged-in users can view course templates" on course_templates;
drop policy if exists "Logged-in users can view course template assessments" on course_template_assessments;
drop policy if exists "Logged-in users can view course template materials" on course_template_materials;
drop policy if exists "Anyone can view course templates" on course_templates;
drop policy if exists "Anyone can view course template assessments" on course_template_assessments;
drop policy if exists "Anyone can view course template materials" on course_template_materials;
drop policy if exists "Anyone can view template assessments" on course_template_assessments;
drop policy if exists "Anyone can view template materials" on course_template_materials;

-- Course Library rows are shared reference data. Public users should only see
-- ready templates. Needs-review, archived, and conflict rows stay private to
-- admin/service-role workflows.
create policy "Anyone can view course templates"
on course_templates for select
to anon, authenticated
using (coalesce(template_status, 'ready') = 'ready');

create policy "Anyone can view course template assessments"
on course_template_assessments for select
to anon, authenticated
using (
  exists (
    select 1
    from course_templates
    where course_templates.id = course_template_assessments.course_template_id
      and coalesce(course_templates.template_status, 'ready') = 'ready'
  )
);

create policy "Anyone can view course template materials"
on course_template_materials for select
to anon, authenticated
using (
  exists (
    select 1
    from course_templates
    where course_templates.id = course_template_materials.course_template_id
      and coalesce(course_templates.template_status, 'ready') = 'ready'
  )
);
