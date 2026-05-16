create table if not exists syllabus_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  file_path text not null,
  original_filename text not null,
  status text not null default 'uploaded',
  extraction jsonb,
  error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists syllabus_uploads_user_id_idx on syllabus_uploads(user_id);
create index if not exists syllabus_uploads_course_id_idx on syllabus_uploads(course_id);

alter table syllabus_uploads enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('syllabi', 'syllabi', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.set_current_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_syllabus_uploads_user_id on syllabus_uploads;
create trigger set_syllabus_uploads_user_id
before insert on syllabus_uploads
for each row
execute function public.set_current_user_id();

drop policy if exists "Users can view their own syllabus uploads" on syllabus_uploads;
drop policy if exists "Users can create their own syllabus uploads" on syllabus_uploads;
drop policy if exists "Users can update their own syllabus uploads" on syllabus_uploads;
drop policy if exists "Users can delete their own syllabus uploads" on syllabus_uploads;

create policy "Users can view their own syllabus uploads"
on syllabus_uploads for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own syllabus uploads"
on syllabus_uploads for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from courses
    where courses.id = syllabus_uploads.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "Users can update their own syllabus uploads"
on syllabus_uploads for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from courses
    where courses.id = syllabus_uploads.course_id
      and courses.user_id = auth.uid()
  )
);

create policy "Users can delete their own syllabus uploads"
on syllabus_uploads for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can view their own syllabus files" on storage.objects;
drop policy if exists "Users can upload their own syllabus files" on storage.objects;
drop policy if exists "Users can update their own syllabus files" on storage.objects;
drop policy if exists "Users can delete their own syllabus files" on storage.objects;

create policy "Users can view their own syllabus files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can upload their own syllabus files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can update their own syllabus files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can delete their own syllabus files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'syllabi'
  and (storage.foldername(name))[1] = auth.uid()::text
);
