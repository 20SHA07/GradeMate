alter table courses
  add column if not exists instructor text,
  add column if not exists instructor_email text,
  add column if not exists schedule text,
  add column if not exists classroom text,
  add column if not exists office_hours text,
  add column if not exists prerequisites text,
  add column if not exists textbooks jsonb,
  add column if not exists description text,
  add column if not exists term text;
