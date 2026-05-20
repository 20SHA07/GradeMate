-- Public-safe contributor credit for syllabus submissions and Course Library templates.
-- Run after supabase/syllabus-contributions.sql and supabase/course-template-versions.sql.

alter table profiles add column if not exists username text;
alter table profiles add column if not exists contributor_name text;

alter table profiles
drop constraint if exists profiles_username_format_check;

alter table profiles
add constraint profiles_username_format_check
check (
  username is null
  or username ~ '^[a-z0-9_]{3,24}$'
);

create unique index if not exists profiles_username_unique
on profiles (lower(username))
where username is not null;

alter table syllabus_contributions add column if not exists contributor_username text;
alter table syllabus_contributions add column if not exists contributor_name text;

alter table course_templates add column if not exists contributor_user_id uuid references auth.users(id) on delete set null;
alter table course_templates add column if not exists contributor_username text;
alter table course_templates add column if not exists contributor_name text;

create index if not exists course_templates_contributor_username_idx
on course_templates(contributor_username);
