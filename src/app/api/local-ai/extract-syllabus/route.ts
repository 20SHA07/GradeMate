import { NextResponse } from "next/server";
import { z } from "zod";
import { formatFewShotExamplesForPrompt } from "@/lib/syllabus/fewShotExamples";

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
  instructorEmail: nullableString.default(null),
  semester: nullableString.default(null),
  schedule: nullableString.default(null),
  classroom: nullableString.default(null),
  officeHours: nullableString.default(null),
  prerequisites: nullableString.default(null),
  textbooks: z.array(z.string().trim()).default([]),
  courseDescription: nullableString.default(null),
  assessments: z.array(aiAssessmentSchema).default([]),
  warnings: z.array(z.string().trim()).default([]),
  fieldConfidence: z.record(z.number().min(0).max(1)).default({}),
  confidence: boundedNumber(0, 1)
});

const requestSchema = z.object({
  text: z.string().trim().min(1)
});

function buildPrompt(text: string) {
  const examples = formatFewShotExamplesForPrompt(text);

  return `Extract the course grading structure from the syllabus or grading text.

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
- If a grading split is unclear, add a warning instead of guessing.
- If weights do not total 100%, add a warning.
- Use max_score 100 unless explicitly stated otherwise.
- Keep assessment names short and student-friendly.
- Prefer detailed assessment rows over broad grouped rows when both appear.
- Preserve numbered assessments separately. Do not bundle Quiz 1, Quiz 2, Assignment 1, Lab 1, Project 1, Test 1, or Exam 1 into a grouped parent row.
- Only group assessments when the syllabus provides only grouped categories.
- Do not extract letter grade scales, grade points, CLO/PLO tables, weekly schedules, room numbers, course codes, or due dates as assessments.
- Return JSON only. No markdown. No explanation.

Examples:
${examples}

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

function addQualityWarnings(
  result: z.infer<typeof aiSyllabusSchema>,
  warnings: string[]
) {
  const nextWarnings = [...warnings];

  if (hasPossibleGradeScaleExtraction(result.assessments)) {
    nextWarnings.push("Possible letter grade scale extracted. Please review before saving.");
  }

  if (hasPossibleWeeklyScheduleExtraction(result.assessments)) {
    nextWarnings.push("Possible weekly schedule rows extracted. Please review before saving.");
  }

  if (hasSuspiciousCourseCodeWeight(result)) {
    nextWarnings.push("Possible course code number extracted as a weight. Please review before saving.");
  }

  if (result.assessments.some((assessment) => !assessment.name.trim())) {
    nextWarnings.push("One or more assessment names are empty.");
  }

  return nextWarnings;
}

function hasPossibleGradeScaleExtraction(
  assessments: z.infer<typeof aiAssessmentSchema>[]
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
  assessments: z.infer<typeof aiAssessmentSchema>[]
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

function hasSuspiciousCourseCodeWeight(result: z.infer<typeof aiSyllabusSchema>) {
  const courseNumberMatch = result.courseCode?.match(/\b[A-Z]{2,5}\s*-?\s*(\d{3,4})\b/i);
  const courseNumber = courseNumberMatch ? Number(courseNumberMatch[1]) : null;

  if (!courseNumber || courseNumber <= 100) {
    return false;
  }

  return result.assessments.some((assessment) => {
    const combined = `${assessment.name} ${assessment.source_text_snippet}`.toLowerCase();
    const hasAssessmentWord =
      /\b(quiz|exam|midterm|final|assignment|homework|lab|project|participation|presentation|coursework|test)\b/.test(combined);

    return !hasAssessmentWord && Math.round(assessment.weight_percentage) === courseNumber;
  });
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

    const qualityWarnings = addQualityWarnings(result, warnings);

    return NextResponse.json({
      ...result,
      assessments: result.assessments.map((assessment) => ({
        ...assessment,
        max_score: assessment.max_score || 100
      })),
      warnings: dedupeWarnings(qualityWarnings)
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
