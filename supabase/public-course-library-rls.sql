drop policy if exists "Logged-in users can view course templates" on course_templates;
drop policy if exists "Logged-in users can view course template assessments" on course_template_assessments;
drop policy if exists "Logged-in users can view course template materials" on course_template_materials;
drop policy if exists "Anyone can view course templates" on course_templates;
drop policy if exists "Anyone can view template assessments" on course_template_assessments;
drop policy if exists "Anyone can view template materials" on course_template_materials;

create policy "Anyone can view course templates"
on course_templates for select
using (true);

create policy "Anyone can view template assessments"
on course_template_assessments for select
using (true);

create policy "Anyone can view template materials"
on course_template_materials for select
using (true);
