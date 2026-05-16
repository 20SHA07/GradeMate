AI syllabus extraction lives in the Supabase Edge Function at:

`supabase/functions/extract-syllabus/index.ts`

Setup checklist:

- Run `supabase/syllabus-ai.sql` in the Supabase SQL editor.
- Deploy the Edge Function with `supabase functions deploy extract-syllabus`.
- Set the Edge Function secret `OPENAI_API_KEY`.
- Optionally set `OPENAI_MODEL`; the default is `gpt-5-mini`.

Flow:

- The browser uploads a PDF to the private `syllabi` Supabase Storage bucket.
- The browser creates a `syllabus_uploads` record owned by the signed-in user.
- The browser invokes the `extract-syllabus` Edge Function.
- The function downloads the PDF, sends it to OpenAI as a PDF file input, validates structured JSON with Zod, updates the course, and inserts assessments.
