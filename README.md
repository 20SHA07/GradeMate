# GradeMate

GradeMate is an MVP skeleton for turning course syllabus PDFs into smart GPA and grade trackers.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase-ready auth, database, and storage structure
- OpenAI-ready extraction structure
- Zod-ready validation structure

## Routes

- `/` landing page
- `/login` auth entry
- `/signup` auth registration
- `/sign-in` legacy auth alias
- `/sign-up` legacy auth alias
- `/dashboard` app overview
- `/semesters` semester tracking
- `/courses` course tracking
- `/course-library` reusable course template library
- `/gpa-calculator` semester-aware GPA calculator

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when wiring Supabase and OpenAI.

## Supabase Setup

Run [supabase/schema.sql](supabase/schema.sql) in your Supabase SQL editor. It
creates `semesters`, `courses`, `assessments`, `syllabus_uploads`, the private
`syllabi` storage bucket, row-level security, and policies so users can only
access their own records and files.

If assessment inserts fail with a row-level security error, run
[supabase/fix-assessment-rls.sql](supabase/fix-assessment-rls.sql) in the SQL
editor. It refreshes the assessment policies and adds insert triggers that set
`user_id` from the logged-in Supabase user.

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

For GitHub Pages, add those same public variable names as repository secrets
before the Pages workflow runs.

For syllabus AI extraction on the live GitHub Pages app, also deploy the
Supabase Edge Function and set its OpenAI secret:

```bash
supabase functions deploy extract-syllabus
supabase secrets set OPENAI_API_KEY=your_openai_api_key
supabase secrets set OPENAI_MODEL=gpt-5-mini
```

If you already ran the older schema, run
[supabase/syllabus-ai.sql](supabase/syllabus-ai.sql) in the SQL editor to add
the upload table, storage bucket, and storage policies.

## Course Template Import

Create the reusable template tables in Supabase by running
[supabase/course-templates.sql](supabase/course-templates.sql) or the full
[supabase/schema.sql](supabase/schema.sql) in the SQL editor.

To scan a local course-materials folder and upload reusable templates, set a
service-role key in your terminal, then pass the folder path as an argument.
Use the syllabus-only importer for normal GradeMate course templates:

```bash
SUPABASE_URL="https://ipadimpttadajubxubyd.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
npm run import:syllabi -- "C:\Users\shaha\Downloads\drive-download-20260516T203409Z-3-002"
```

Use `--dry-run` first to preview detected courses without changing Supabase:

```bash
npm run import:syllabi:dry -- "C:\Users\shaha\Downloads\drive-download-20260516T203409Z-3-002"
```

The importer does not hardcode the folder path. You can also set
`COURSE_SYLLABI_SOURCE_DIR` instead of passing an argument.

Duplicate detection uses `course_code` + `course_name`. Existing templates only
get missing fields and missing child rows filled in. Use `--force` to overwrite
matching template fields and replace its detected assessment/material rows.

The older `import:templates` command scans broader course-material folders and
is kept for experiments. The Course Library UI only shows templates created from
detected syllabuses.

In Supabase Auth URL Configuration, use:

```text
Site URL: https://20sha07.github.io/GradeMate
Redirect URLs:
http://localhost:3000/**
https://20sha07.github.io/GradeMate/**
```

## GitHub Pages

This app is configured for static export through GitHub Actions. Push to `main`
or `master`, then set the repository Pages source to **GitHub Actions**. The
workflow publishes the `out` directory and automatically applies the repository
base path for project pages such as `/GradeMate`.
