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

For GitHub Pages, add those same names as repository secrets before the Pages
workflow runs.

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
