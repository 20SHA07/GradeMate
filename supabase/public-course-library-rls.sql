drop policy if exists "Logged-in users can view course templates" on course_templates;
drop policy if exists "Logged-in users can view course template assessments" on course_template_assessments;
drop policy if exists "Logged-in users can view course template materials" on course_template_materials;
drop policy if exists "Anyone can view course templates" on course_templates;
drop policy if exists "Anyone can view course template assessments" on course_template_assessments;
drop policy if exists "Anyone can view course template materials" on course_template_materials;
drop policy if exists "Anyone can view template assessments" on course_template_assessments;
drop policy if exists "Anyone can view template materials" on course_template_materials;

-- Course Library rows are shared reference data. They should be readable by
-- guests and signed-in users, while writes remain blocked because there are no
-- insert, update, or delete policies for browser clients.
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
