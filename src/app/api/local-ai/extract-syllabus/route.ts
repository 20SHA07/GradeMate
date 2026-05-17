import { NextResponse } from "next/server";
import { z } from "zod";

const maxInputCharacters = 24000;

const nullableString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable()
);

const nullableNumber = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return Number(value);
}, z.number().finite().nullable());

const boundedNumber = (min: number, max: number) =>
  z.preprocess((value) => Number(value), z.number().finite().min(min).max(max));

const aiAssessmentSchema = z.object({
  name: z.string().trim().min(1),
  weight_percentage: boundedNumber(0, 100),
  max_score: boundedNumber(1, 1000).default(100),
  confidence: boundedNumber(0, 1),
  source_text_snippet: z.string().trim().default("")
});

const aiSyllabusSchema = z.object({
  courseCode: nullableString,
  courseName: nullableString,
  creditHours: nullableNumber,
  instructor: nullableString,
  assessments: z.array(aiAssessmentSchema).default([]),
  warnings: z.array(z.string().trim()).default([]),
  confidence: boundedNumber(0, 1)
});

const requestSchema = z.object({
  text: z.string().trim().min(1)
});

function buildPrompt(text: string) {
  return `Extract the course grading structure from the syllabus or grading text.

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
- If a grading split is unclear, add a warning instead of guessing.
- If weights do not total 100%, add a warning.
- Use max_score 100 unless explicitly stated otherwise.
- Keep assessment names short and student-friendly.
- Return JSON only. No markdown. No explanation.

Text:
${text}`;
}

function parsePossiblyWrappedJson(rawText: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    const firstBrace = rawText.indexOf("{");
    const lastBrace = rawText.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No JSON object found.");
    }

    return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
  }
}

function getWeightTotal(
  assessments: z.infer<typeof aiAssessmentSchema>[]
) {
  return assessments.reduce(
    (sum, assessment) => sum + assessment.weight_percentage,
    0
  );
}

function dedupeWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

export async function POST(request: Request) {
  const requestParse = requestSchema.safeParse(await request.json().catch(() => null));

  if (!requestParse.success) {
    return NextResponse.json(
      { error: "Provide syllabus or grading text to extract." },
      { status: 400 }
    );
  }

  const originalText = requestParse.data.text;
  const wasTruncated = originalText.length > maxInputCharacters;
  const text = wasTruncated
    ? originalText.slice(0, maxInputCharacters)
    : originalText;
  const baseUrl =
    process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2:3b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      body: JSON.stringify({
        format: "json",
        model,
        options: {
          temperature: 0.1
        },
        prompt: buildPrompt(text),
        stream: false
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            response.status === 404
              ? `Local AI model ${model} was not found. Run: ollama pull ${model}`
              : "Local AI is not running. You can still use manual detection or start Ollama."
        },
        { status: 503 }
      );
    }

    const ollamaResponse = (await response.json()) as { response?: unknown };

    if (typeof ollamaResponse.response !== "string") {
      return NextResponse.json(
        { error: "AI extraction returned an invalid result. Try again or edit manually." },
        { status: 422 }
      );
    }

    const parsedJson = parsePossiblyWrappedJson(ollamaResponse.response);
    const parsedSyllabus = aiSyllabusSchema.safeParse(parsedJson);

    if (!parsedSyllabus.success) {
      return NextResponse.json(
        { error: "AI extraction returned an invalid result. Try again or edit manually." },
        { status: 422 }
      );
    }

    const result = parsedSyllabus.data;
    const warnings = [...result.warnings];
    const totalWeight = getWeightTotal(result.assessments);
    const averageAssessmentConfidence =
      result.assessments.length > 0
        ? result.assessments.reduce(
            (sum, assessment) => sum + assessment.confidence,
            0
          ) / result.assessments.length
        : 0;

    if (wasTruncated) {
      warnings.push("Text was long, so only the first part was sent to local AI.");
    }

    if (result.assessments.length === 0) {
      warnings.push("No assessments found");
    }

    if (result.assessments.length > 0 && totalWeight < 99.5) {
      warnings.push(`Total weight is below 100 (${totalWeight.toFixed(1)}%)`);
    }

    if (result.assessments.length > 0 && totalWeight > 100.5) {
      warnings.push(`Total weight is above 100 (${totalWeight.toFixed(1)}%)`);
    }

    if (
      result.confidence < 0.65 ||
      (averageAssessmentConfidence > 0 && averageAssessmentConfidence < 0.65)
    ) {
      warnings.push("Low confidence AI extraction");
    }

    return NextResponse.json({
      ...result,
      assessments: result.assessments.map((assessment) => ({
        ...assessment,
        max_score: assessment.max_score || 100
      })),
      warnings: dedupeWarnings(warnings)
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? "Local AI took too long to respond. Try again with less text."
        : "Local AI is not running. You can still use manual detection or start Ollama.";

    return NextResponse.json({ error: message }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
