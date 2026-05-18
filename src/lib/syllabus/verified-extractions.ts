import type { SupabaseBrowserClient } from "@/lib/supabase/client";
import type { ExtractedSyllabus } from "@/lib/syllabus/extractSyllabus";
import type { Json } from "@/types/database";

export type VerifiedExtractionFeedback = "correct" | "incorrect" | "corrected";
export type VerifiedExtractionSource = "pdf" | "pasted_text" | "quick_add" | "course_library";
export type VerifiedExtractionAiProvider =
  | "rule_based"
  | "local_ollama"
  | "gemini"
  | "none";

export type VerifiedExtractionInput = {
  sourceType: VerifiedExtractionSource;
  sourceFileName?: string | null;
  extractedText?: string | null;
  confirmedExtraction: ExtractedSyllabus;
  originalExtraction?: ExtractedSyllabus | null;
  userFeedback: VerifiedExtractionFeedback;
  aiProvider?: VerifiedExtractionAiProvider | null;
  userId?: string | null;
  supabase?: SupabaseBrowserClient | null;
};

const guestVerifiedExtractionsKey = "guestVerifiedExtractions";
export const extractorVersion = "dataset-v1";

function canUseLocalStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function readGuestVerifiedExtractions() {
  if (!canUseLocalStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(guestVerifiedExtractionsKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearGuestVerifiedExtractions() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(guestVerifiedExtractionsKey);
}

function writeGuestVerifiedExtraction(payload: Record<string, unknown>) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(
    guestVerifiedExtractionsKey,
    JSON.stringify([payload, ...readGuestVerifiedExtractions()].slice(0, 100))
  );
}

async function hashText(text: string) {
  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    typeof TextEncoder !== "undefined"
  ) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return `fallback-${Math.abs(hash)}`;
}

function getTotalWeight(extraction: ExtractedSyllabus) {
  return (
    Math.round(
      extraction.assessments.reduce(
        (sum, assessment) => sum + Number(assessment.weight_percentage ?? 0),
        0
      ) * 100
    ) / 100
  );
}

function toConfirmedJson(extraction: ExtractedSyllabus) {
  return {
    assessments: extraction.assessments,
    classroom: extraction.classroom ?? null,
    courseCode: extraction.courseCode ?? null,
    courseDescription: extraction.courseDescription ?? null,
    courseName: extraction.courseName ?? null,
    creditHours: extraction.creditHours ?? null,
    instructor: extraction.instructor ?? null,
    instructorEmail: extraction.instructorEmail ?? null,
    officeHours: extraction.officeHours ?? null,
    prerequisites: extraction.prerequisites ?? null,
    schedule: extraction.schedule ?? null,
    semester: extraction.semester ?? null,
    textbooks: extraction.textbooks ?? []
  } satisfies Json;
}

export async function saveVerifiedExtraction(input: VerifiedExtractionInput) {
  const sourceText = input.extractedText ?? JSON.stringify(toConfirmedJson(input.confirmedExtraction));
  const sourceTextHash = await hashText(sourceText);
  const shouldStoreText =
    input.sourceType !== "pdf" && sourceText.length > 0 && sourceText.length <= 20000;
  const payload = {
    ai_provider: input.aiProvider ?? "none",
    confidence: input.confirmedExtraction.confidence,
    confirmed_json: toConfirmedJson(input.confirmedExtraction),
    course_code: input.confirmedExtraction.courseCode,
    course_name: input.confirmedExtraction.courseName,
    created_at: new Date().toISOString(),
    credit_hours: input.confirmedExtraction.creditHours,
    extracted_text: shouldStoreText ? sourceText : null,
    extractor_version: extractorVersion,
    instructor: input.confirmedExtraction.instructor,
    original_extraction_json: input.originalExtraction
      ? toConfirmedJson(input.originalExtraction)
      : null,
    source_file_name: input.sourceFileName ?? null,
    source_text_hash: sourceTextHash,
    source_type: input.sourceType,
    total_weight: getTotalWeight(input.confirmedExtraction),
    updated_at: new Date().toISOString(),
    user_feedback: input.userFeedback,
    user_id: input.userId ?? null
  };

  if (input.supabase && input.userId) {
    const { error } = await input.supabase.from("verified_extractions").insert(payload);

    if (error) {
      throw error;
    }

    return;
  }

  writeGuestVerifiedExtraction(payload);
}
