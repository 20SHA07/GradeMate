create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists syllabus_contributions (
  id uuid primary key default gen_random_uuid(),
  submitted_by_user_id uuid not null references auth.users(id) on delete cascade,
  course_code text,
  course_name text,
  department text,
  credit_hours numeric,
  university text,
  campus text,
  term text,
  instructor text,
  instructor_email text,
  syllabus_file_name text,
  syllabus_file_path text,
  extracted_json jsonb,
  extraction_confidence numeric,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'needs_changes')),
  reviewer_user_id uuid references auth.users(id),
  review_notes text,
  approved_course_template_id uuid references course_templates(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists contribution_assessments (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references syllabus_contributions(id) on delete cascade,
  name text not null,
  weight_percentage numeric not null default 0,
  max_score numeric not null default 100,
  confidence numeric,
  source_text_snippet text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_profile();

insert into public.profiles (id, email, role)
select id, email, 'user'
from auth.users
on conflict (id) do update
set email = excluded.email,
    updated_at = now();

alter table profiles enable row level security;
alter table syllabus_contributions enable row level security;
alter table contribution_assessments enable row level security;

drop policy if exists "Users can view their own profile" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;
drop policy if exists "Users can update their own profile" on profiles;
drop policy if exists "Admins can view all profiles" on profiles;
drop policy if exists "Admins can update profiles" on profiles;

create policy "Users can view their own profile"
on profiles for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on profiles for insert
with check (auth.uid() = id and role = 'user');

create policy "Users can update their own profile"
on profiles for update
using (auth.uid() = id)
with check (auth.uid() = id and role = 'user');

create policy "Admins can view all profiles"
on profiles for select
using (public.is_admin());

create policy "Admins can update profiles"
on profiles for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can create their own contributions" on syllabus_contributions;
drop policy if exists "Users can view their own contributions" on syllabus_contributions;
drop policy if exists "Users can update editable own contributions" on syllabus_contributions;
drop policy if exists "Admins can view all contributions" on syllabus_contributions;
drop policy if exists "Admins can update contribution reviews" on syllabus_contributions;

create policy "Users can create their own contributions"
on syllabus_contributions for insert
with check (auth.uid() = submitted_by_user_id);

create policy "Users can view their own contributions"
on syllabus_contributions for select
using (auth.uid() = submitted_by_user_id);

create policy "Users can update editable own contributions"
on syllabus_contributions for update
using (
  auth.uid() = submitted_by_user_id
  and status in ('draft', 'needs_changes')
)
with check (
  auth.uid() = submitted_by_user_id
  and status in ('draft', 'pending_review', 'needs_changes')
);

create policy "Admins can view all contributions"
on syllabus_contributions for select
using (public.is_admin());

create policy "Admins can update contribution reviews"
on syllabus_contributions for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can create assessments for own contributions" on contribution_assessments;
drop policy if exists "Users can view assessments for own contributions" on contribution_assessments;
drop policy if exists "Users can update assessments for editable own contributions" on contribution_assessments;
drop policy if exists "Users can delete assessments for editable own contributions" on contribution_assessments;
drop policy if exists "Admins can view all contribution assessments" on contribution_assessments;
drop policy if exists "Admins can update contribution assessments" on contribution_assessments;
drop policy if exists "Admins can delete contribution assessments" on contribution_assessments;

create policy "Users can create assessments for own contributions"
on contribution_assessments for insert
with check (
  exists (
    select 1
    from syllabus_contributions contribution
    where contribution.id = contribution_id
      and contribution.submitted_by_user_id = auth.uid()
      and contribution.status in ('draft', 'pending_review', 'needs_changes')
  )
);

create policy "Users can view assessments for own contributions"
on contribution_assessments for select
using (
  exists (
    select 1
    from syllabus_contributions contribution
    where contribution.id = contribution_id
      and contribution.submitted_by_user_id = auth.uid()
  )
);

create policy "Users can update assessments for editable own contributions"
on contribution_assessments for update
using (
  exists (
    select 1
    from syllabus_contributions contribution
    where contribution.id = contribution_id
      and contribution.submitted_by_user_id = auth.uid()
      and contribution.status in ('draft', 'needs_changes')
  )
)
with check (
  exists (
    select 1
    from syllabus_contributions contribution
    where contribution.id = contribution_id
      and contribution.submitted_by_user_id = auth.uid()
      and contribution.status in ('draft', 'needs_changes')
  )
);

create policy "Users can delete assessments for editable own contributions"
on contribution_assessments for delete
using (
  exists (
    select 1
    from syllabus_contributions contribution
    where contribution.id = contribution_id
      and contribution.submitted_by_user_id = auth.uid()
      and contribution.status in ('draft', 'needs_changes')
  )
);

create policy "Admins can view all contribution assessments"
on contribution_assessments for select
using (public.is_admin());

create policy "Admins can update contribution assessments"
on contribution_assessments for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete contribution assessments"
on contribution_assessments for delete
using (public.is_admin());

drop policy if exists "Admins can create course templates" on course_templates;
drop policy if exists "Admins can update course templates" on course_templates;
drop policy if exists "Admins can delete course templates" on course_templates;
drop policy if exists "Admins can create template assessments" on course_template_assessments;
drop policy if exists "Admins can update template assessments" on course_template_assessments;
drop policy if exists "Admins can delete template assessments" on course_template_assessments;

create policy "Admins can create course templates"
on course_templates for insert
with check (public.is_admin());

create policy "Admins can update course templates"
on course_templates for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete course templates"
on course_templates for delete
using (public.is_admin());

create policy "Admins can create template assessments"
on course_template_assessments for insert
with check (public.is_admin());

create policy "Admins can update template assessments"
on course_template_assessments for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete template assessments"
on course_template_assessments for delete
using (public.is_admin());

-- After running this SQL, promote an admin user from the SQL editor:
-- update profiles set role = 'admin' where email = 'your-email@example.com';
