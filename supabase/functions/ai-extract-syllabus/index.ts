import { z } from "npm:zod@3.24.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const maxInputCharacters = 20000;

const assessmentSchema = z.object({
  name: z.string().trim().min(1),
  weight_percentage: z.number().min(0).max(100),
  max_score: z.number().positive().default(100),
  confidence: z.number().min(0).max(1),
  source_text_snippet: z.string().trim().default("")
});

const extractionSchema = z.object({
  courseCode: z.string().trim().nullable(),
  courseName: z.string().trim().nullable(),
  creditHours: z.number().positive().nullable(),
  instructor: z.string().trim().nullable(),
  assessments: z.array(assessmentSchema),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });
}

function getPrompt(text: string) {
  return `Extract the course grading structure from this syllabus or grading text.

Return strict JSON only.

Schema:
{
  "courseCode": string | null,
  "courseName": string | null,
  "creditHours": number | null,
  "instructor": string | null,
  "assessments": [
    {
      "name": string,
      "weight_percentage": number,
      "max_score": number,
      "confidence": number,
      "source_text_snippet": string
    }
  ],
  "warnings": string[],
  "confidence": number
}

Rules:
- Do not invent missing values.
- Only extract grading components clearly supported by the text.
- If a split is unclear, add a warning instead of guessing.
- If weights do not total 100%, add a warning.
- Use max_score 100 unless explicitly stated otherwise.
- Keep assessment names short and student-friendly.
- Return JSON only. No markdown. No explanation.

Text:
${text}`;
}

function extractCandidateText(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const firstCandidate = candidates[0] as
    | { content?: { parts?: Array<{ text?: string }> } }
    | undefined;
  const parts = Array.isArray(firstCandidate?.content?.parts)
    ? firstCandidate.content.parts
    : [];

  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function parseJsonText(text: string) {
  const trimmedText = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const startIndex = trimmedText.indexOf("{");
  const endIndex = trimmedText.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("AI extraction returned an invalid result.");
  }

  return JSON.parse(trimmedText.slice(startIndex, endIndex + 1));
}

function addWeightWarnings(
  extraction: z.infer<typeof extractionSchema>,
  wasTruncated: boolean
) {
  const totalWeight = extraction.assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  );
  const warnings = [...extraction.warnings];

  if (wasTruncated) {
    warnings.push("Long text was shortened before AI extraction.");
  }

  if (extraction.assessments.length === 0) {
    warnings.push("No assessments found");
  }

  if (extraction.assessments.length > 0 && totalWeight < 99.5) {
    warnings.push(`Total weight is below 100 (${totalWeight.toFixed(1)}%)`);
  }

  if (extraction.assessments.length > 0 && totalWeight > 100.5) {
    warnings.push(`Total weight is above 100 (${totalWeight.toFixed(1)}%)`);
  }

  return {
    ...extraction,
    assessments: extraction.assessments.map((assessment) => ({
      ...assessment,
      max_score: assessment.max_score || 100,
      weight_percentage:
        Math.round(Number(assessment.weight_percentage || 0) * 100) / 100
    })),
    warnings: Array.from(new Set(warnings))
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      return jsonResponse(
        {
          error:
            "AI assist is unavailable because GEMINI_API_KEY is not configured."
        },
        500
      );
    }

    const body = (await request.json().catch(() => null)) as
      | { text?: unknown }
      | null;
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";

    if (rawText.length < 6) {
      return jsonResponse({ error: "Text is too short to extract." }, 400);
    }

    const wasTruncated = rawText.length > maxInputCharacters;
    const text = rawText.slice(0, maxInputCharacters);
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: getPrompt(text) }],
              role: "user"
            }
          ],
          generationConfig: {
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            temperature: 0.1
          }
        }),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey
        },
        method: "POST"
      }
    );
    const geminiPayload = (await geminiResponse.json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    if (!geminiResponse.ok) {
      const message =
        typeof (geminiPayload?.error as { message?: unknown } | undefined)
          ?.message === "string"
          ? ((geminiPayload?.error as { message: string }).message)
          : "";

      if (geminiResponse.status === 429) {
        return jsonResponse(
          {
            error:
              "AI quota is temporarily exhausted. You can still use automatic detection."
          },
          429
        );
      }

      return jsonResponse(
        {
          error:
            message ||
            "AI assist is unavailable. You can still use automatic detection."
        },
        geminiResponse.status
      );
    }

    if (!geminiPayload) {
      throw new Error("AI extraction returned an invalid result.");
    }

    const outputText = extractCandidateText(geminiPayload);
    const parsedJson = parseJsonText(outputText);
    const extraction = extractionSchema.parse(parsedJson);

    return jsonResponse(addWeightWarnings(extraction, wasTruncated));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "AI extraction returned an invalid result.";

    return jsonResponse(
      {
        error:
          /invalid|json|parse|zod/i.test(message)
            ? "AI extraction returned an invalid result. Try again or edit manually."
            : message
      },
      422
    );
  }
});
