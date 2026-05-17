insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-syllabi', 'course-syllabi', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists syllabus_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_url text,
  extracted_text text,
  extraction_status text not null default 'uploaded',
  extraction_error text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table syllabus_uploads add column if not exists file_name text;
alter table syllabus_uploads add column if not exists file_url text;
alter table syllabus_uploads add column if not exists extracted_text text;
alter table syllabus_uploads add column if not exists extraction_status text not null default 'uploaded';
alter table syllabus_uploads add column if not exists extraction_error text;
alter table syllabus_uploads add column if not exists updated_at timestamp with time zone default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'syllabus_uploads'
      and column_name = 'original_filename'
  ) then
    execute 'update syllabus_uploads set file_name = coalesce(file_name, original_filename) where file_name is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'syllabus_uploads'
      and column_name = 'status'
  ) then
    execute 'update syllabus_uploads set extraction_status = coalesce(extraction_status, status) where extraction_status is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'syllabus_uploads'
      and column_name = 'error'
  ) then
    execute 'update syllabus_uploads set extraction_error = coalesce(extraction_error, error) where extraction_error is null';
  end if;
end $$;

update syllabus_uploads
set file_name = coalesce(file_name, split_part(file_path, '/', cardinality(string_to_array(file_path, '/'))))
where file_name is null;

update syllabus_uploads
set extraction_status = 'uploaded'
where extraction_status is null;

alter table syllabus_uploads alter column file_name set not null;
alter table syllabus_uploads alter column extraction_status set default 'uploaded';
alter table syllabus_uploads alter column extraction_status set not null;

create index if not exists syllabus_uploads_user_id_idx on syllabus_uploads(user_id);
create index if not exists syllabus_uploads_course_id_idx on syllabus_uploads(course_id);

alter table syllabus_uploads enable row level security;

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
drop policy if exists "Users can view their own syllabi" on storage.objects;
drop policy if exists "Users can upload their own syllabi" on storage.objects;
drop policy if exists "Users can update their own syllabi" on storage.objects;
drop policy if exists "Users can delete their own syllabi" on storage.objects;

create policy "Users can upload their own syllabi"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view their own syllabi"
on storage.objects for select
to authenticated
using (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own syllabi"
on storage.objects for update
to authenticated
using (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own syllabi"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'course-syllabi'
  and auth.uid()::text = (storage.foldername(name))[1]
);
