# GradeMate

GradeMate is an MVP skeleton for turning course syllabus PDFs into smart GPA and grade trackers. It includes a no-account Simple Mode for fast GPA, course-grade, and syllabus text/PDF extraction, plus a full Workspace Mode for semester, course, assessment, syllabus, and Course Library workflows.

Workspace Mode also includes customizable degree progress. Students can set
their own total required credits, completed credits before GradeMate, and degree
category targets such as Major Core, General Education, and Free Electives.
Guest settings stay local on the device. Signed-in settings sync through
Supabase when the `degree_plans` table is installed. Degree completion uses
completed credits entered by the student plus tracked courses whose assessments
are fully scored with a passing final grade. Category completion is manually
editable for now.

## Unofficial Disclaimer

GradeMate is an independent student-made tool built for KU students. It is not an official university product. Course information and templates should always be verified against official university materials and your course syllabus.

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
creates `semesters`, `courses`, `assessments`, Course Library tables, row-level
security, and policies so users can only access their own private workspace
records. The private `course-syllabi` storage bucket is only for explicit
syllabus contributions that require admin review, not normal extraction.

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

### Privacy-first syllabus handling

Normal Simple Mode and Workspace extraction never permanently stores syllabus
PDFs. The browser reads the selected PDF locally, GradeMate saves only reviewed
structured course data, assessment rows, confidence/warnings, extractor version,
and a `source_text_hash`, then clears the PDF file from component state after
save. Verified extraction feedback stores confirmed JSON plus a hash by default;
raw extracted text is saved only when the user explicitly checks “Include
extracted syllabus text to help improve detection.”

The only exception is `/contribute-syllabus`: contribution uploads may be stored
privately for admin review after the user confirms that behavior. Normal users
cannot see another user’s uploaded syllabus source. To clean old pending or
rejected contribution PDFs from Supabase Storage without touching user course
data, use:

```bash
npm run storage:cleanup-syllabi:dry
npm run storage:cleanup-syllabi -- --days 30 --confirm
```

If you already ran the older schema, run
[supabase/syllabus-storage.sql](supabase/syllabus-storage.sql) in the SQL editor
to add the private contribution-only `course-syllabi` bucket and storage
policies.

To store extracted course metadata, run
[supabase/course-metadata.sql](supabase/course-metadata.sql) or rerun the full
schema. To collect private verified extraction feedback, run
[supabase/verified-extractions.sql](supabase/verified-extractions.sql). Verified
examples are private to the submitting user through RLS; the service role can
export them later for admin review.

To sync customizable degree progress for signed-in users, run
[supabase/degree-plans.sql](supabase/degree-plans.sql). It creates a private
`degree_plans` table with owner-only RLS. Without this migration, degree
settings still save locally on the current device.

### Syllabus contribution review

To let users submit syllabuses for the shared Course Library, run
[supabase/syllabus-contributions.sql](supabase/syllabus-contributions.sql) in
the Supabase SQL editor, then run
[supabase/course-template-versions.sql](supabase/course-template-versions.sql).
For contributor credit, also run
[supabase/profile-usernames.sql](supabase/profile-usernames.sql). They create:

- `profiles`
- `syllabus_contributions`
- `contribution_assessments`
- `course_template_versions`
- profile `username` / `contributor_name` fields
- public-safe contributor credit fields on published Course Library templates
- private RLS policies for user submissions
- admin-only version history for replaced Course Library templates
- admin-only policies for approving contributions into Course Library templates

After running the SQL, promote your admin account:

```sql
update profiles
set role = 'admin'
where email = 'your-email@example.com';
```

Normal users can create and view only their own contributions. Admins can review
all submissions at `/admin/contributions`, compare them with matching Course
Library templates, and choose whether to replace an existing template, create a
new template version, mark the approved contribution as the latest canonical
template, or approve the feedback without publishing. Replacing a template saves
the previous template and assessment rows in `course_template_versions` before
the shared `course_templates` / `course_template_assessments` rows are updated.

Approval updates the shared Course Library for future imports only. It never
retroactively changes private `semesters`, `courses`, or `assessments` that
students already imported into their own workspaces. Needs-review/conflict or
archived templates stay hidden from normal Course Library browsing unless an
admin intentionally republishes them as `ready`.

Contributors can set a username and display name on `/contribute-syllabus`.
When their contribution is approved and published, GradeMate copies that
public-safe credit onto the shared template, so Course Library users can see who
helped without exposing the contributor's email.

After approving contributions, verify publish integrity:

```bash
npm run contributions:verify-publish
```

This checks that approved contributions point to existing templates, published
templates have assessment rows, replacement history exists for replaced
templates, and ready templates are public-readable. The same admin page also
shows recent verified extraction feedback so corrected examples can be reviewed
for the benchmark. Raw contribution and feedback data is not public.

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

The real rebuilt import also creates a pre-import backup automatically and
aborts before writing if that backup fails. Restore plans are dry-run by default:

```bash
npm run library:restore-backup:dry -- --backup latest
npm run library:restore-backup -- --backup latest --confirm
```

Restore affects only shared Course Library tables:
`course_templates`, `course_template_assessments`, and
`course_template_materials`. It never restores or modifies private user
workspace tables.

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

### Database safety workflow

Protected user/admin tables are `semesters`, `courses`, `assessments`,
`verified_extractions`, `syllabus_contributions`, `contribution_assessments`,
`course_template_versions`, and `profiles`. Course Library maintenance scripts
may only write shared template tables. See
[docs/database-safety.md](docs/database-safety.md) for the full rules.

Before any Course Library update:

```bash
npm run test:dataset
npm run library:rebuild
npm run library:review
npm run library:export-current
npm run library:import-rebuilt:dry
# Inspect training-data/course-library-rebuild/supabase-import-plan.html
npm run db:safety-check
npm run library:import-rebuilt -- --confirm
npm run library:verify-production
npm run db:check-rls
```

Before any schema update:

```bash
# Read the SQL migration first.
npm run db:lint-sql
npm run user-data:backup-counts
# Apply SQL in Supabase, then:
npm run db:check-rls
npm run launch:audit
```

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
npm run db:lint-sql
npm run db:safety-check
npm run db:check-rls
npm run smoke:local
```

Outputs are written to:

- `training-data/launch-audit/report.html`
- `training-data/launch-audit/db-safety-report.html`
- `training-data/launch-audit/sql-lint-report.html`
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
https://20sha07.github.io/GradeMate/workspace
https://20sha07.github.io/GradeMate/dashboard
https://20sha07.github.io/GradeMate/simple
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
http://localhost:3000/workspace
http://localhost:3001/workspace
```

The frontend computes `emailRedirectTo` with the deployed base path, so
production links return to `/GradeMate/auth/callback` and local development
links return to `/auth/callback`. If a confirmation link is opened in a
different browser or after it expires, GradeMate shows a friendly recovery
message, a login link, guest mode, and a resend-confirmation option when the
email address is known. See [Email delivery checklist](docs/email-delivery-checklist.md)
if verification emails do not arrive.

### Friend testing auth setup

For small private friend testing, use normal email/password accounts without
email verification:

1. Open Supabase.
2. Go to **Authentication > Providers > Email**.
3. Turn **Confirm email** off.
4. Friends can sign up and GradeMate will send them directly to Workspace.

Keep Google login disabled/hidden for now. GradeMate's launch UI only exposes
email/password auth and guest mode.

### Public launch auth setup

Before broader public launch:

1. Turn **Confirm email** on in **Authentication > Providers > Email**.
2. Configure custom SMTP in Supabase. Recommended providers: Resend or Brevo.
3. Keep this redirect URL allow-listed:
   `https://20sha07.github.io/GradeMate/auth/callback`.

Supabase built-in email is useful for early testing but may not reliably deliver
public launch verification emails.

## GitHub Pages

This app is configured for static export through GitHub Actions. Push to `main`
or `master`, then set the repository Pages source to **GitHub Actions**. Do not
choose branch root, `docs`, or `public` as the Pages source, because that can
serve the README instead of the exported app. The workflow publishes only the
`out` directory and automatically applies the repository base path for project
pages such as `/GradeMate`.
