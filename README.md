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
- `/sign-in` auth entry
- `/sign-up` auth registration
- `/dashboard` app overview
- `/semesters` semester tracking
- `/courses` course tracking
- `/gpa-calculator` manual GPA calculator

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when wiring Supabase and OpenAI.

## GitHub Pages

This app is configured for static export through GitHub Actions. Push to `main`
or `master`, then set the repository Pages source to **GitHub Actions**. The
workflow publishes the `out` directory and automatically applies the repository
base path for project pages such as `/GradeMate`.
