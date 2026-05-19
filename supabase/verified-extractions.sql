create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
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

create table if not exists verified_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_type text not null check (
    source_type in ('pdf', 'pasted_text', 'quick_add', 'course_library')
  ),
  source_file_name text,
  source_text_hash text not null,
  extracted_text text,
  course_code text,
  course_name text,
  credit_hours numeric,
  instructor text,
  confirmed_json jsonb not null,
  original_extraction_json jsonb,
  user_feedback text not null check (
    user_feedback in ('correct', 'incorrect', 'corrected')
  ),
  extractor_version text not null default 'dataset-v1',
  ai_provider text check (
    ai_provider is null
    or ai_provider in ('rule_based', 'local_ollama', 'gemini', 'none')
  ),
  confidence numeric,
  total_weight numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table verified_extractions enable row level security;

drop policy if exists "Users can view their own verified extractions" on verified_extractions;
drop policy if exists "Users can create their own verified extractions" on verified_extractions;
drop policy if exists "Admins can view all verified extractions" on verified_extractions;

create policy "Users can view their own verified extractions"
on verified_extractions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own verified extractions"
on verified_extractions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Admins can view all verified extractions"
on verified_extractions for select
to authenticated
using (public.is_admin());
