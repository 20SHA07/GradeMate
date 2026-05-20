alter table profiles add column if not exists full_name text;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    'user'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();

  return new;
end;
$$;

create table if not exists degree_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  total_credits numeric not null default 120 check (total_credits > 0),
  completed_credits numeric not null default 0 check (completed_credits >= 0),
  categories jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists degree_plans_user_id_idx on degree_plans(user_id);

alter table degree_plans enable row level security;

drop policy if exists "Users can view their own degree plan" on degree_plans;
drop policy if exists "Users can create their own degree plan" on degree_plans;
drop policy if exists "Users can update their own degree plan" on degree_plans;
drop policy if exists "Users can delete their own degree plan" on degree_plans;

create policy "Users can view their own degree plan"
on degree_plans for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own degree plan"
on degree_plans for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own degree plan"
on degree_plans for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own degree plan"
on degree_plans for delete
to authenticated
using (auth.uid() = user_id);
