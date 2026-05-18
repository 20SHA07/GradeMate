import { z } from "npm:zod@3.24.1";
import { formatFewShotExamplesForPrompt } from "../_shared/few-shot-examples.ts";

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
  instructorEmail: z.string().trim().nullable().default(null),
  semester: z.string().trim().nullable().default(null),
  schedule: z.string().trim().nullable().default(null),
  classroom: z.string().trim().nullable().default(null),
  officeHours: z.string().trim().nullable().default(null),
  prerequisites: z.string().trim().nullable().default(null),
  textbooks: z.array(z.string().trim()).default([]),
  courseDescription: z.string().trim().nullable().default(null),
  assessments: z.array(assessmentSchema),
  warnings: z.array(z.string()),
  fieldConfidence: z.record(z.number().min(0).max(1)).default({}),
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
  const examples = formatFewShotExamplesForPrompt(text);

  return `Extract the course grading structure from this syllabus or grading text.

Return strict JSON only.

Schema:
{
  "courseCode": string | null,
  "courseName": string | null,
  "creditHours": number | null,
  "instructor": string | null,
  "instructorEmail": string | null,
  "semester": string | null,
  "schedule": string | null,
  "classroom": string | null,
  "officeHours": string | null,
  "prerequisites": string | null,
  "textbooks": string[],
  "courseDescription": string | null,
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
  "fieldConfidence": object,
  "confidence": number
}

Rules:
- Do not invent missing values.
- Only extract grading components clearly supported by the text.
- If a split is unclear, add a warning instead of guessing.
- If weights do not total 100%, add a warning.
- Use max_score 100 unless explicitly stated otherwise.
- Keep assessment names short and student-friendly.
- Prefer detailed assessment rows over broad grouped rows when both appear.
- Never invent individual assessments from grouped categories.
- Parenthetical examples like "quizzes, homework/project" are descriptions, not separate rows, unless each child item has its own explicit weight.
- Preserve grouped rows when only grouped weights are available.
- Preserve numbered assessments separately only when they are explicitly listed, such as Quiz 1 5%, Quiz 2 5%.
- If a table clearly lists multiple same-type child rows and one shared group weight, split that shared weight evenly across those listed children and add a warning.
- Only group assessments when the syllabus provides only grouped categories.
- Do not extract letter grade scales, grade points, CLO/PLO tables, weekly schedules, room numbers, course codes, or due dates as assessments.
- Return JSON only. No markdown. No explanation.

Examples:
${examples}

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

  if (hasPossibleGradeScaleExtraction(extraction.assessments)) {
    warnings.push("Possible letter grade scale extracted. Please review before saving.");
  }

  if (hasPossibleWeeklyScheduleExtraction(extraction.assessments)) {
    warnings.push("Possible weekly schedule rows extracted. Please review before saving.");
  }

  if (hasSuspiciousCourseCodeWeight(extraction)) {
    warnings.push("Possible course code number extracted as a weight. Please review before saving.");
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

function hasPossibleGradeScaleExtraction(
  assessments: z.infer<typeof assessmentSchema>[]
) {
  return assessments.some((assessment) => {
    const name = assessment.name.trim().toLowerCase();
    const snippet = assessment.source_text_snippet.toLowerCase();

    return (
      /^(a|a-|b\+|b|b-|c\+|c|c-|d|f|letter grade|grade scale|grade points?)$/.test(name) ||
      /\b(letter grade|grade scale|grade points?|a\s*[-:]?\s*9\d|b\+?\s*[-:]?\s*8\d|c\+?\s*[-:]?\s*7\d)\b/.test(snippet)
    );
  });
}

function hasPossibleWeeklyScheduleExtraction(
  assessments: z.infer<typeof assessmentSchema>[]
) {
  return assessments.some((assessment) => {
    const combined = `${assessment.name} ${assessment.source_text_snippet}`.toLowerCase();
    const hasAssessmentWord =
      /\b(quiz|exam|midterm|final|assignment|homework|lab|project|participation|presentation|coursework|test)\b/.test(combined);

    return (
      /\b(week|lecture|topic|chapter|course outcome|clo|plo)\b/.test(combined) &&
      !hasAssessmentWord
    );
  });
}

function hasSuspiciousCourseCodeWeight(extraction: z.infer<typeof extractionSchema>) {
  const courseNumberMatch = extraction.courseCode?.match(/\b[A-Z]{2,5}\s*-?\s*(\d{3,4})\b/i);
  const courseNumber = courseNumberMatch ? Number(courseNumberMatch[1]) : null;

  if (!courseNumber || courseNumber <= 100) {
    return false;
  }

  return extraction.assessments.some((assessment) => {
    const combined = `${assessment.name} ${assessment.source_text_snippet}`.toLowerCase();
    const hasAssessmentWord =
      /\b(quiz|exam|midterm|final|assignment|homework|lab|project|participation|presentation|coursework|test)\b/.test(combined);

    return !hasAssessmentWord && Math.round(assessment.weight_percentage) === courseNumber;
  });
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
