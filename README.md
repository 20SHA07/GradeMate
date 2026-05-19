# GradeMate

GradeMate is an MVP skeleton for turning course syllabus PDFs into smart GPA and grade trackers. It includes a no-account Simple Mode for fast GPA, course-grade, and syllabus text/PDF extraction, plus a full Workspace Mode for semester, course, assessment, syllabus, and Course Library workflows.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase-ready auth, database, and storage structure
- Browser PDF text extraction plus deterministic syllabus parsing
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
- `/contribute-syllabus` submit a syllabus for Course Library review
- `/my-contributions` track your submitted syllabus contributions
- `/admin/contributions` admin review queue for submitted syllabuses
- `/gpa-calculator` semester-aware GPA calculator
- `/extractor-lab` development page for manually testing syllabus extraction

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when wiring Supabase.

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

Syllabus extraction runs locally in the browser. GradeMate reads PDF text with
PDF.js, runs the shared deterministic extractor, shows course info and
assessment suggestions, then requires review before saving. Public GitHub Pages
extraction does not depend on Gemini, Ollama, OpenAI, or Supabase Edge
Functions.

If you already ran the older schema, run
[supabase/syllabus-storage.sql](supabase/syllabus-storage.sql) in the SQL editor
to add the `course-syllabi` bucket, upload table, and storage policies.

To store extracted course metadata, run
[supabase/course-metadata.sql](supabase/course-metadata.sql) or rerun the full
schema. To collect private verified extraction feedback, run
[supabase/verified-extractions.sql](supabase/verified-extractions.sql). Verified
examples are private to the submitting user through RLS; the service role can
export them later for admin review.

### Syllabus contribution review

To let users submit syllabuses for the shared Course Library, run
[supabase/syllabus-contributions.sql](supabase/syllabus-contributions.sql) in
the Supabase SQL editor. It creates:

- `profiles`
- `syllabus_contributions`
- `contribution_assessments`
- private RLS policies for user submissions
- admin-only policies for approving contributions into Course Library templates

After running the SQL, promote your admin account:

```sql
update profiles
set role = 'admin'
where email = 'your-email@example.com';
```

Normal users can create and view only their own contributions. Admins can review
all submissions at `/admin/contributions`, approve them into `course_templates`
using the rebuilt `unique_key` model, request changes, or reject them. The same
admin page also shows recent verified extraction feedback so corrected examples
can be reviewed for the benchmark. Raw contribution and feedback data is not
public.

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

### Rebuild Course Library from the deterministic extractor

After improving the golden examples and extractor rules, rebuild Course Library
templates from the collected syllabuses instead of using older extraction output:

```bash
npm run test:dataset
npm run library:rebuild
npm run library:review
npm run library:diff
npm run library:import-rebuilt:dry
```

The rebuild writes JSON templates to
`training-data/course-library-rebuild/templates/`. The review and dry-run reports
separate ready canonical templates from needs-review files, duplicate conflicts,
non-canonical duplicates, and related materials. Inspect these before importing:

- `training-data/course-library-rebuild/review-report.html`
- `training-data/course-library-rebuild/supabase-import-plan.html`
- `training-data/course-library-rebuild/supabase-import-plan.json`

For Supabase backup/import commands, set server-only credentials in your
terminal. The service-role key must never be placed in frontend code or GitHub
Pages public variables.

PowerShell:

```powershell
$env:SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Bash:

```bash
export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

`NEXT_PUBLIC_SUPABASE_URL` is also accepted for the project URL, but
`SUPABASE_SERVICE_ROLE_KEY` is required for backup, real import, and production
verification.

Back up the current Course Library before importing:

```bash
npm run library:export-current
```

Before the first rebuilt import, run
[supabase/course-template-unique-key.sql](supabase/course-template-unique-key.sql)
in the Supabase SQL editor. This preserves existing templates, adds
`course_templates.unique_key`, drops the old `course_code + course_name`
uniqueness rule, and lets the same course exist across different semesters or
source-specific unknown-term templates.

Preview the rebuilt import without writing to Supabase:

```bash
npm run library:import-rebuilt:dry
```

Apply the import only after reviewing the plan:

```bash
npm run library:import-rebuilt -- --confirm
```

The real import refuses to run without `--confirm` and skips needs-review
templates, duplicate conflicts, and non-canonical duplicates by default. Use
these flags only after manual review:

```bash
npm run library:import-rebuilt -- --confirm --include-needs-review
npm run library:import-rebuilt -- --confirm --resolve-conflicts
npm run library:import-rebuilt -- --confirm --canonical-file "Source File.pdf"
```

After importing, verify production rows:

```bash
npm run library:verify-production
```

This checks that every selected ready canonical template exists in Supabase, has
assessment rows, and totals 99.5-100.5%. It writes
`training-data/course-library-rebuild/production-verify-report.html`.

## Launch Readiness Checks

Before sharing GradeMate with friends, run the local launch checks. These do not
write to Supabase and do not import Course Library rows:

```bash
npm run test:extraction
npm run test:dataset
npm run library:rebuild
npm run library:review
npm run build
npm run typecheck
npm run launch:audit
npm run db:check-rls
npm run smoke:local
```

Outputs are written to:

- `training-data/launch-audit/report.html`
- `training-data/launch-audit/rls-report.html`
- `training-data/launch-audit/smoke-report.html`

When Supabase service-role credentials are configured locally, also run:

```bash
npm run library:export-current
npm run library:import-rebuilt:dry
npm run library:verify-production
```

Do not run the real Course Library import again unless the dry-run and
production verification indicate a problem, and never run it without `--confirm`.

## Syllabus Extraction Dataset Builder

Use the dataset scripts to benchmark GradeMate extraction quality before changing
the deterministic parser. These scripts do not train a model and do not write to
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

### Golden examples and deterministic extraction

Golden JSON files are not used to train a model. They are regression fixtures
for the deterministic extractor. After reviewing `training-data/review-report.html`, you can:

1. Edit or add corrected JSON in `training-data/expected-json/`.
2. Run `npm run dataset:propose -- "C:\Users\shaha\Downloads\drive-download-20260516T203409Z-3-002"`.
3. Run `npm run test:dataset`.

The extractor improves through better section detection, candidate scoring, and
new golden examples. Add corrected examples over time, rerun
`dataset:propose`, then run `test:dataset` to catch regressions.

### Extractor Lab

Open `/extractor-lab` in development when you want to test a random syllabus
quickly. The lab uploads PDFs, extracts all pages locally, runs the same
dataset-backed extractor used by Simple and Workspace, and shows course info,
assessment rows, warnings, candidate scores, and final JSON. Use **Copy JSON**
or **Download expected JSON** to create new golden examples.

### Verified Extraction Feedback

After a user confirms extracted rows in Simple or Workspace, GradeMate asks
whether the extraction looked correct, was corrected, or needs improvement.
Guest feedback is stored locally under `guestVerifiedExtractions`; signed-in
Workspace feedback is inserted into the private `verified_extractions` table
when that table is configured. If the insert fails, GradeMate falls back to the
local guest store so the user is not blocked. This does not train any model
automatically.

Admins can export verified examples for manual review:

```bash
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" npm run dataset:export-verified
npm run dataset:review-verified
npm run dataset:promote-verified
```

The improvement loop is:

1. Collect verified examples from user-confirmed or user-corrected extractions.
2. Run `dataset:export-verified` to write them into `training-data/verified-json/`.
3. Run `dataset:review-verified` and inspect
   `training-data/verified-review-report.html`.
4. Run `dataset:promote-verified` to copy approved correct/corrected examples
   into `training-data/expected-json/` without overwriting existing golden files.
5. Run `dataset:propose`, `test:dataset`, and `test:extraction`.
6. Improve parser rules when the benchmark shows a regression or new pattern.

### Supabase Auth URLs for GitHub Pages

GradeMate is a static GitHub Pages app, so Supabase Auth must return directly to
the exported client route. In **Authentication > URL Configuration**, use these
exact URLs:

```text
Site URL: https://20sha07.github.io/GradeMate

Redirect URLs:
https://20sha07.github.io/GradeMate/auth/callback
https://20sha07.github.io/GradeMate/dashboard
https://20sha07.github.io/GradeMate/workspace
https://20sha07.github.io/GradeMate/simple
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
http://localhost:3000/dashboard
http://localhost:3001/dashboard
```

The frontend computes `emailRedirectTo` with the deployed base path, so
production links return to `/GradeMate/auth/callback` and local development
links return to `/auth/callback`. If a confirmation link is opened in a
different browser or after its PKCE session expires, GradeMate shows recovery
steps, a login link, guest mode, and a resend-confirmation option when the email
address is known.

To enable Google login, open **Authentication > Providers > Google** in Supabase,
turn it on, add your Google OAuth client ID/secret, and make sure the same
redirect URLs above are allowed. GradeMate uses the normal Supabase redirect
flow and returns users to `/auth/callback`, then `/workspace`.

## GitHub Pages

This app is configured for static export through GitHub Actions. Push to `main`
or `master`, then set the repository Pages source to **GitHub Actions**. Do not
choose branch root, `docs`, or `public` as the Pages source, because that can
serve the README instead of the exported app. The workflow publishes only the
`out` directory and automatically applies the repository base path for project
pages such as `/GradeMate`.
