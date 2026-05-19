# GradeMate Database Safety

GradeMate has two kinds of database data. Treat them differently.

## Protected User Data

These tables contain private user/workspace data and must never be changed by
Course Library rebuild/import scripts:

- `semesters`
- `courses`
- `assessments`
- `verified_extractions`
- `syllabus_contributions`
- `contribution_assessments`
- `profiles`

Course Library imports, template rebuilds, and restore operations must not write,
delete, truncate, or backfill these tables.

## Shared Course Library Data

Course Library maintenance scripts may write only these shared template tables:

- `course_templates`
- `course_template_assessments`
- `course_template_materials`

Normal users can read ready templates. Admins/service-role scripts can import or
review templates. Needs-review and conflict templates should not be public.

## Migration Checklist

Before applying any SQL migration:

1. Read the full SQL file.
2. Run `npm run db:lint-sql`.
3. Run `npm run user-data:backup-counts` if service-role credentials are
   configured.
4. Confirm the migration uses `create table if not exists`, `add column if not
   exists`, and `create index if not exists` where possible.
5. Apply the SQL in Supabase.
6. Run `npm run db:check-rls`.
7. Run `npm run launch:audit`.

Safe migration rules:

- Do not drop user tables.
- Do not truncate user tables.
- Do not delete from user tables.
- Do not disable RLS.
- Do not drop columns from protected user tables.
- If replacing policies, keep replacement policies in the same migration and add
  a `-- SAFE_MIGRATION_EXPLAIN: ...` comment.
- If changing constraints, preserve/backfill existing data first.
- If adding a `NOT NULL` column, add it nullable, backfill safely, then constrain
  only after verifying data.

## Course Library Backup And Import

Before any Course Library update:

```bash
npm run test:dataset
npm run library:rebuild
npm run library:review
npm run library:export-current
npm run library:import-rebuilt:dry
npm run db:safety-check
npm run library:import-rebuilt -- --confirm
npm run library:verify-production
npm run db:check-rls
```

The real import automatically creates a pre-import backup. If backup creation
fails, the import aborts before writing anything.

Backups are written to:

```text
training-data/course-library-backups/
```

Each complete backup includes:

- `course_templates_TIMESTAMP.json`
- `course_template_assessments_TIMESTAMP.json`
- `course_template_materials_TIMESTAMP.json`
- `course_library_backup_TIMESTAMP.json`

## Restore Course Library From Backup

Dry-run a restore:

```bash
npm run library:restore-backup:dry -- --backup latest
```

Restore after review:

```bash
npm run library:restore-backup -- --backup latest --confirm
```

You can pass a timestamp instead of `latest`.

Restore affects only:

- `course_templates`
- `course_template_assessments`
- `course_template_materials`

It creates a fresh pre-restore backup before writing. It never touches user
workspace tables.

## Service Role Key Safety

The Supabase service-role key belongs only in local/server automation
environments. Never put it in:

- frontend code
- `NEXT_PUBLIC_*` variables
- GitHub Pages public variables
- screenshots or shared logs

To rotate the key:

1. Go to Supabase Project Settings > API.
2. Regenerate the service-role secret.
3. Update local `.env.local` or shell environment.
4. Remove the old value from password managers or CI secrets.
5. Run `npm run db:safety-check` to confirm the frontend does not reference it.

## Recovery Notes

If a Course Library import looks wrong:

1. Stop further imports.
2. Run `npm run library:verify-production`.
3. Pick the latest known-good backup in
   `training-data/course-library-backups/`.
4. Run `npm run library:restore-backup:dry -- --backup <timestamp>`.
5. Inspect `training-data/course-library-rebuild/restore-plan.html`.
6. Run `npm run library:restore-backup -- --backup <timestamp> --confirm`.
7. Run `npm run library:verify-production`.

## Never Do This

- Never run `truncate` against protected user tables.
- Never run broad `delete from semesters`, `delete from courses`, or
  `delete from assessments`.
- Never disable row level security.
- Never use the service-role key in the browser.
- Never import needs-review templates into production unless they have been
  manually approved.
- Never use Course Library restore tooling to restore private user data.
