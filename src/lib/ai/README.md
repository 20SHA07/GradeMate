AI extraction is optional and review-only.

Production online assist:

- Edge Function: `supabase/functions/ai-extract-syllabus/index.ts`
- Deploy with `supabase functions deploy ai-extract-syllabus`.
- Set `GEMINI_API_KEY` as a Supabase Edge Function secret.
- Optionally set `GEMINI_MODEL`; the default is `gemini-2.5-flash`.
- Enable the frontend provider at build time with:
  - `NEXT_PUBLIC_ONLINE_AI_ENABLED=true`
  - `NEXT_PUBLIC_AI_PROVIDER=supabase-edge`

Local development assist:

- `src/app/api/local-ai/extract-syllabus/route.ts`
- Uses Ollama through `OLLAMA_BASE_URL` and `OLLAMA_MODEL`.
- This route is local-only and should not be relied on by GitHub Pages.

Flow:

- The browser rule-based parser runs first.
- If the parser is strong and weights are close to 100%, the app uses that result.
- If the parser is weak, unclear, or incomplete, the app calls the configured AI provider.
- The AI provider returns structured JSON suggestions.
- The user reviews and confirms before any assessments are saved.
