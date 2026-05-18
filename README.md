# GradeMate

GradeMate is an MVP skeleton for turning course syllabus PDFs into smart GPA and grade trackers. It includes a no-account Simple Mode for fast GPA, course-grade, and syllabus text/PDF extraction, plus a full Workspace Mode for semester, course, assessment, syllabus, and Course Library workflows.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase-ready auth, database, and storage structure
- Browser rule-based extraction with optional Gemini or local Ollama assist
- Zod-ready validation structure

## Routes

- `/` mode chooser landing page
- `/simple` GradeMate Simple fast GPA and course-grade calculator with local smart extraction
- `/workspace` full GradeMate academic tracking workspace
- `/login` auth entry
- `/signup` auth registration
- `/sign-in` legacy auth alias
- `/sign-up` legacy auth alias
- `/dashboard` legacy workspace overview alias
- `/semesters` semester tracking
- `/courses` course tracking
- `/course-library` reusable course template library
- `/gpa-calculator` semester-aware GPA calculator

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when wiring Supabase and local AI.

## Supabase Setup

Run [supabase/schema.sql](supabase/schema.sql) in your Supabase SQL editor. It
creates `semesters`, `courses`, `assessments`, `syllabus_uploads`, the private
`course-syllabi` storage bucket, row-level security, and policies so users can only
access their own records and files.

If assessment inserts fail with a row-level security error, run
[supabase/fix-assessment-rls.sql](supabase/fix-assessment-rls.sql) in the SQL
editor. It refreshes the assessment policies and adds insert triggers that set
`user_id` from the logged-in Supabase user.

If importing a Course Library template fails with a missing assessment column
such as `category`, run
[supabase/assessment-detail-fields.sql](supabase/assessment-detail-fields.sql).
It adds the optional assessment detail fields used for statuses and backward
compatibility.

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is preferred for newer Supabase
projects. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still supported as a fallback.

For GitHub Pages, add those same public variable names as repository secrets
before the Pages workflow runs. The browser app must never use
`SUPABASE_SERVICE_ROLE_KEY`.

For local syllabus AI extraction during development, run Ollama locally and set:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

For online AI assist on the public GitHub Pages site, GradeMate calls a
Supabase Edge Function. Add these public build variables to `.env.local` and to
your GitHub Pages workflow/repository secrets:

```bash
NEXT_PUBLIC_ONLINE_AI_ENABLED=true
NEXT_PUBLIC_AI_PROVIDER=supabase-edge
```

Then deploy the Gemini Edge Function and set the Gemini key as a Supabase
secret. Do not put `GEMINI_API_KEY` in frontend env files.

```bash
supabase functions deploy ai-extract-syllabus
supabase secrets set GEMINI_API_KEY="your-gemini-api-key"
```

Optional Edge Function secret:

```bash
supabase secrets set GEMINI_MODEL="gemini-2.5-flash"
```

The browser always runs the rule-based parser first. Gemini is only called when
the local result is weak, unclear, or incomplete. AI results are suggestions
only and must be reviewed before saving.

If you already ran the older schema, run
[supabase/syllabus-storage.sql](supabase/syllabus-storage.sql) in the SQL editor
to add the `course-syllabi` bucket, upload table, and storage policies.

## Course Template Import

Create the reusable template tables in Supabase by running
[supabase/course-templates.sql](supabase/course-templates.sql) or the full
[supabase/schema.sql](supabase/schema.sql) in the SQL editor.

### Course Library public read access

Course Library templates are shared reference data, so guests and signed-in
users need read-only access to browse and import them. If `/course-library`
shows zero templates even though the service-role importer can see rows, apply
the public Course Library RLS policies:

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Create a new query.
4. Paste the full contents of
   [supabase/public-course-library-rls.sql](supabase/public-course-library-rls.sql).
5. Click **Run**.
6. Refresh `/course-library`.

That SQL creates `select` policies with `using (true)` for
`course_templates`, `course_template_assessments`, and
`course_template_materials`. It does not create insert, update, or delete
policies, so normal frontend users can browse templates but cannot modify the
shared library directly.

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

## Syllabus Extraction Dataset Builder

Use the dataset scripts to benchmark GradeMate extraction quality before changing
the parser or AI prompts. These scripts do not train a model and do not write to
Supabase.

```bash
npm run dataset:scan -- "C:\Users\shaha\Downloads\drive-download-20260516T203409Z-3-002"
npm run dataset:propose -- "C:\Users\shaha\Downloads\drive-download-20260516T203409Z-3-002"
npm run dataset:summary
npm run dataset:review
npm run dataset:promote-ready
npm run test:dataset
```

Outputs:

- `training-data/extracted-text/` stores extracted syllabus text.
- `training-data/proposed-json/` stores GradeMate's current extraction guesses.
- `training-data/expected-json/` stores human-corrected golden answers.
- `training-data/review-report.html` gives a browser-friendly review report.

The scanner filters for likely syllabus PDFs and DOCX syllabus documents, skips
common course materials such as slides, labs, assignments, exams, notes, and
practice files, and records parsing errors for review. The first golden fixture
is `COSC101_Syllabus_and Syllabus_Supplement`, which checks that detailed
assessment rows are preferred over broad or unrelated tables.

`dataset:summary` prints the same readiness/error counts as the report.
`dataset:promote-ready` copies high-confidence 100% proposed JSON files into
`training-data/expected-json/` without overwriting existing golden files.

`test:dataset` compares every JSON file in `training-data/expected-json/`
against the latest proposal with regression thresholds. It fails if course info
changes, assessment counts change, any assessment weight drifts by more than 1%,
or the total assessment weight differs by more than 1%.

### Golden examples and AI prompts

Golden JSON files are not used to train a model. They are regression fixtures
and prompt examples. After reviewing `training-data/review-report.html`, you can:

1. Edit or add corrected JSON in `training-data/expected-json/`.
2. Run `npm run dataset:propose -- "C:\Users\shaha\Downloads\drive-download-20260516T203409Z-3-002"`.
3. Run `npm run test:dataset`.

GradeMate also keeps a small curated subset of representative golden examples in
`src/lib/syllabus/fewShotExamples.ts`. Local Ollama and the Supabase Gemini Edge
Function include two or three of those examples in the prompt, preferring a
similar department when one is detected and otherwise using a diverse mix of
engineering/science, math, and humanities/business examples. Keep this list
small so prompts stay fast and cheap.

In Supabase Auth URL Configuration, use:

```text
Site URL: https://20sha07.github.io/GradeMate
Redirect URLs:
http://localhost:3000/**
https://20sha07.github.io/GradeMate/**
```

To enable Google login, open **Authentication > Providers > Google** in Supabase,
turn it on, add your Google OAuth client ID/secret, and make sure the same
redirect URLs above are allowed. GradeMate uses the normal Supabase redirect
flow and returns users to `/auth/callback`, then `/workspace`.

## GitHub Pages

This app is configured for static export through GitHub Actions. Push to `main`
or `master`, then set the repository Pages source to **GitHub Actions**. The
workflow publishes the `out` directory and automatically applies the repository
base path for project pages such as `/GradeMate`.
