"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ClipboardPaste,
  Edit3,
  FileText,
  Layers3,
  Percent,
  PlusCircle,
  Save,
  Target,
  Trash2,
  UploadCloud,
  Wand2
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  formatPercent,
  getAssessmentMaxScore,
  getAssessmentName,
  getAssessmentStatus,
  getAssessmentWeight,
  getCourseGradeSummary,
  getLetterGrade,
  getWeightedContribution,
  isCompletedAssessment
} from "@/lib/grades";
import {
  createGuestId,
  readGuestData,
  writeGuestData
} from "@/lib/guest-session";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import {
  extractSyllabusFromText,
  parseGradeBreakdownMessage,
  type ExtractedAssessment,
  type ExtractedSyllabus
} from "@/lib/syllabus/extractSyllabus";
import { getAppBasePath } from "@/lib/routes";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

type AssessmentForm = {
  name: string;
  weightPercentage: string;
  score: string;
  maxScore: string;
  category: string;
};

type ReviewAssessment = ExtractedAssessment & {
  id: string;
};

type ExtractionSource = "ai" | "pdf" | "rule";

type ExtractionDraft = {
  extraction: ExtractedSyllabus;
  extractionSource: ExtractionSource;
  reviewRows: ReviewAssessment[];
  updatedAt: string;
};

const assessmentStatuses = ["Remaining", "Completed", "Dropped"];
const assessmentNames = [
  "Midterm",
  "Final",
  "Quizzes",
  "Assignments",
  "Projects",
  "Labs",
  "Participation"
];

const defaultAssessmentForm: AssessmentForm = {
  name: "",
  weightPercentage: "",
  score: "",
  maxScore: "100",
  category: "Remaining"
};

const inputStyles =
  "mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

const extractorTabs = [
  { icon: UploadCloud, label: "Upload PDF", value: "upload" },
  { icon: ClipboardPaste, label: "Paste Text", value: "paste" }
] as const;

function parseOptionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function toFormValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(Number(value));
}

function getStatusTone(status: string) {
  if (status === "Completed") {
    return "green" as const;
  }

  if (status === "Dropped") {
    return "rose" as const;
  }

  return "gold" as const;
}

function getFriendlyStatus(status: string) {
  if (status === "Completed" || status === "Dropped") {
    return status;
  }

  return "Missing score";
}

function buildAssessmentPayload(form: AssessmentForm) {
  const name = form.name.trim();
  const weight = Number(form.weightPercentage) || 0;
  const score = parseOptionalNumber(form.score);
  const maxScore = parseOptionalNumber(form.maxScore);
  const isScored = score !== null && maxScore !== null && maxScore > 0;
  const category =
    form.category === "Dropped" ? "Dropped" : isScored ? "Completed" : "Planned";

  return {
    name,
    weight_percentage: weight,
    score,
    max_score: maxScore,
    category,
    title: name,
    weight
  };
}

function formatWeightDelta(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getWeightReadiness(totalWeight: number) {
  if (totalWeight === 100) {
    return { label: "Ready", tone: "green" as const };
  }

  if (totalWeight < 100) {
    return {
      label: `Missing ${formatWeightDelta(100 - totalWeight)}%`,
      tone: "gold" as const
    };
  }

  return {
    label: `Over by ${formatWeightDelta(totalWeight - 100)}%`,
    tone: "rose" as const
  };
}

function getWeightHelperText(totalWeight: number) {
  if (isWeightCloseToReady(totalWeight)) {
    return "Weight total: 100% - ready";
  }

  if (totalWeight < 100) {
    return `Missing ${formatWeightDelta(100 - totalWeight)}%`;
  }

  return `Over by ${formatWeightDelta(totalWeight - 100)}%`;
}

function getConfidenceInfo(confidence: number) {
  if (confidence >= 0.8) {
    return { label: "High", tone: "green" as const };
  }

  if (confidence >= 0.6) {
    return { label: "Medium", tone: "gold" as const };
  }

  return { label: "Low", tone: "rose" as const };
}

function getExtractionSourceLabel(source: ExtractionSource | null) {
  if (source === "ai") {
    return "Improved with local AI";
  }

  if (source === "pdf") {
    return "Extracted from PDF";
  }

  return "Detected automatically";
}

async function extractTextFromPdfFile(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc =
    pdfjs.GlobalWorkerOptions.workerSrc ||
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const documentTask = pdfjs.getDocument({ data });
  const pdf = await documentTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => {
        const textItem = item as { str?: unknown };
        return typeof textItem.str === "string" ? textItem.str : "";
      })
      .join(" ");

    pages.push(pageText);
  }

  return pages.join("\n");
}

function makeReviewRows(extraction: ExtractedSyllabus): ReviewAssessment[] {
  return extraction.assessments.map((assessment) => ({
    ...assessment,
    id: createGuestId("review-assessment")
  }));
}

function getReviewTotalWeight(rows: ReviewAssessment[]) {
  return rows.reduce((sum, row) => sum + Number(row.weight_percentage || 0), 0);
}

function getExtractionDraftKey(courseId: string) {
  return `grademate_extraction_draft_${courseId}`;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readExtractionDraft(courseId: string): ExtractionDraft | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const rawDraft = localStorage.getItem(getExtractionDraftKey(courseId));

  if (!rawDraft) {
    return null;
  }

  try {
    const parsedDraft = JSON.parse(rawDraft) as ExtractionDraft;

    if (!parsedDraft.extraction || !Array.isArray(parsedDraft.reviewRows)) {
      return null;
    }

    return parsedDraft;
  } catch {
    return null;
  }
}

function writeExtractionDraft(courseId: string, draft: ExtractionDraft) {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.setItem(getExtractionDraftKey(courseId), JSON.stringify(draft));
}

function clearExtractionDraft(courseId: string) {
  if (!canUseLocalStorage()) {
    return;
  }

  localStorage.removeItem(getExtractionDraftKey(courseId));
}

function getExtractionTotalWeight(extraction: ExtractedSyllabus) {
  return extraction.assessments.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage || 0),
    0
  );
}

function isWeightCloseToReady(totalWeight: number) {
  return totalWeight >= 99.5 && totalWeight <= 100.5;
}

function shouldUseRuleExtraction(extraction: ExtractedSyllabus) {
  const totalWeight = getExtractionTotalWeight(extraction);
  const hasUnclearWarning = extraction.warnings.some((warning) =>
    /unclear|low confidence|no assessments/i.test(warning)
  );

  return (
    extraction.assessments.length > 0 &&
    extraction.confidence >= 0.72 &&
    isWeightCloseToReady(totalWeight) &&
    !hasUnclearWarning
  );
}

function getLocalAiErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (/local ai is not running/i.test(error.message)) {
      return "Local AI is not running. You can still use manual detection or start Ollama.";
    }

    return error.message;
  }

  return "Local AI is not running. You can still use manual detection or start Ollama.";
}

async function requestLocalAiExtraction(text: string) {
  const response = await fetch(
    `${getAppBasePath()}/api/local-ai/extract-syllabus/`,
    {
      body: JSON.stringify({ text }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    }
  );
  const payload = (await response.json().catch(() => null)) as
    | (Partial<ExtractedSyllabus> & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ??
        (response.status === 422
          ? "AI extraction returned an invalid result. Try again or edit manually."
          : "Local AI is not running. You can still use manual detection or start Ollama.")
    );
  }

  return payload as ExtractedSyllabus;
}

function normalizeReviewName(value: string) {
  return value.trim().toLowerCase();
}

function splitRowsForSave(
  rows: ReviewAssessment[],
  existingNames: Set<string>,
  mode: "append" | "replace"
) {
  const seenNames = new Set<string>();
  const rowsToSave: ReviewAssessment[] = [];
  const skippedNames: string[] = [];

  rows.forEach((row) => {
    const name = row.name.trim();
    const normalizedName = normalizeReviewName(name);

    if (!name || seenNames.has(normalizedName)) {
      skippedNames.push(name || "Unnamed assessment");
      return;
    }

    seenNames.add(normalizedName);

    if (mode === "append" && existingNames.has(normalizedName)) {
      skippedNames.push(name);
      return;
    }

    rowsToSave.push(row);
  });

  return {
    rowsToSave,
    skippedNames: Array.from(new Set(skippedNames))
  };
}

function buildSaveMessage(savedCount: number, skippedNames: string[]) {
  const savedMessage =
    savedCount === 0
      ? "No new assessments to add."
      : `Saved ${savedCount} assessment${savedCount === 1 ? "" : "s"}.`;

  if (skippedNames.length === 0) {
    return savedMessage;
  }

  return `${savedMessage} Skipped duplicates: ${skippedNames.join(", ")}.`;
}

function SmartSyllabusExtractor({
  assessments,
  course,
  isGuest,
  onSaved
}: {
  assessments: AssessmentRecord[];
  course: CourseRecord;
  isGuest: boolean;
  onSaved: (savedAssessments: AssessmentRecord[], mode: "append" | "replace") => void;
}) {
  const { supabase, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [quickText, setQuickText] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [extraction, setExtraction] = useState<ExtractedSyllabus | null>(null);
  const [extractionSource, setExtractionSource] =
    useState<ExtractionSource | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewAssessment[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSavingExtraction, setIsSavingExtraction] = useState(false);
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reviewTotalWeight = getReviewTotalWeight(reviewRows);
  const reviewReadiness = getWeightReadiness(reviewTotalWeight);
  const hasExistingAssessments = assessments.length > 0;

  useEffect(() => {
    const draft = readExtractionDraft(course.id);

    if (draft) {
      setExtraction(draft.extraction);
      setExtractionSource(draft.extractionSource);
      setReviewRows(draft.reviewRows);
      setMessage("Restored your unsaved extraction draft.");
    } else {
      setExtraction(null);
      setExtractionSource(null);
      setReviewRows([]);
    }

    setIsDraftReady(true);
  }, [course.id]);

  useEffect(() => {
    if (!isDraftReady) {
      return;
    }

    if (!extraction || !extractionSource) {
      clearExtractionDraft(course.id);
      return;
    }

    writeExtractionDraft(course.id, {
      extraction,
      extractionSource,
      reviewRows,
      updatedAt: new Date().toISOString()
    });
  }, [course.id, extraction, extractionSource, isDraftReady, reviewRows]);

  function clearResults() {
    setExtraction(null);
    setExtractionSource(null);
    setReviewRows([]);
    setMessage("");
    setError("");
  }

  function clearReviewOnly() {
    setExtraction(null);
    setExtractionSource(null);
    setReviewRows([]);
    setError("");
  }

  function showExtractionResult(
    result: ExtractedSyllabus,
    source: ExtractionSource
  ) {
    setExtraction(result);
    setExtractionSource(source);
    setReviewRows(makeReviewRows(result));
    setMessage(
      result.assessments.length > 0
        ? `${getExtractionSourceLabel(source)}. Found ${result.assessments.length} possible grading item${
            result.assessments.length === 1 ? "" : "s"
          }. Review them before saving.`
        : "I couldn't find a grading breakdown. Try pasting the grading/evaluation section, like: midterm 25, final 40, assignments 35."
    );
    setError("");
  }

  async function runExtractionPipeline(
    text: string,
    mode: "quick" | "syllabus",
    ruleSource: ExtractionSource
  ) {
    const ruleResult =
      mode === "quick"
        ? parseGradeBreakdownMessage(text)
        : extractSyllabusFromText(text);

    if (shouldUseRuleExtraction(ruleResult)) {
      showExtractionResult(ruleResult, ruleSource);
      return;
    }

    try {
      const aiResult = await requestLocalAiExtraction(text);
      showExtractionResult(aiResult, "ai");
    } catch (aiError) {
      if (ruleResult.assessments.length > 0) {
        showExtractionResult(ruleResult, ruleSource);
      }

      setError(getLocalAiErrorMessage(aiError));
    }
  }

  async function runExtraction(text: string, mode: "quick" | "syllabus") {
    const trimmedText = text.trim();
    const minimumLength = mode === "quick" ? 6 : 20;

    if (trimmedText.length < minimumLength) {
      setError(
        mode === "quick"
          ? "Type a little more, like: quizzes 15, assignments 20, midterm 25, final 40."
          : "Paste more syllabus text so GradeMate can find the grading breakdown."
      );
      return;
    }

    setError("");
    setMessage("");
    setIsExtracting(true);

    try {
      await runExtractionPipeline(trimmedText, mode, "rule");
    } finally {
      setIsExtracting(false);
    }
  }

  async function extractFromPdf() {
    setError("");
    setMessage("");

    if (!file) {
      setError("Choose a PDF syllabus first.");
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("Only PDF syllabus files are supported.");
      return;
    }

    setIsExtracting(true);

    try {
      const pdfText = await extractTextFromPdfFile(file);

      if (pdfText.trim().length < 20) {
        throw new Error(
          "Could not read enough text from this PDF. Try pasting the grading section instead."
        );
      }

      await runExtractionPipeline(pdfText, "syllabus", "pdf");
    } catch (pdfError) {
      setError(
        pdfError instanceof Error
          ? pdfError.message
          : "Could not read this PDF."
      );
    } finally {
      setIsExtracting(false);
    }
  }

  function updateReviewRow(
    rowId: string,
    field: keyof Pick<
      ReviewAssessment,
      "confidence" | "max_score" | "name" | "weight_percentage"
    >,
    value: string
  ) {
    setReviewRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]:
                field === "name" ? value : Number(value) || 0
            }
          : row
      )
    );
  }

  function addReviewRow() {
    setReviewRows((current) => [
      ...current,
      {
        id: createGuestId("review-assessment"),
        name: "Assessment",
        weight_percentage: 0,
        max_score: 100,
        confidence: 0.5,
        source_text_snippet: "Added manually during review"
      }
    ]);
  }

  function deleteReviewRow(rowId: string) {
    setReviewRows((current) => current.filter((row) => row.id !== rowId));
  }

  async function saveExtractedAssessments(mode: "append" | "replace") {
    setError("");

    if (reviewRows.length === 0) {
      setError("There are no extracted assessments to save.");
      return;
    }

    const validRows = reviewRows.filter(
      (row) => row.name.trim() && Number(row.weight_percentage) > 0
    );

    if (validRows.length === 0) {
      setError("Add at least one assessment with a name and weight.");
      return;
    }

    setIsSavingExtraction(true);

    if (isGuest) {
      const guestData = readGuestData();
      const existingNames = new Set(
        guestData.assessments
          .filter((assessment) => assessment.course_id === course.id)
          .map((assessment) => getAssessmentName(assessment).toLowerCase())
      );
      const { rowsToSave, skippedNames } = splitRowsForSave(
        validRows,
        existingNames,
        mode
      );

      if (rowsToSave.length === 0) {
        onSaved([], mode);
        clearReviewOnly();
        setMessage(buildSaveMessage(0, skippedNames));
        setIsSavingExtraction(false);
        return;
      }

      const savedAssessments: AssessmentRecord[] = rowsToSave.map((row) => ({
        id: createGuestId("assessment"),
        user_id: user.id,
        course_id: course.id,
        name: row.name.trim(),
        weight_percentage: Number(row.weight_percentage) || 0,
        score: null,
        max_score: Number(row.max_score) || 100,
        category: "Planned",
        title: row.name.trim(),
        weight: Number(row.weight_percentage) || 0,
        created_at: new Date().toISOString()
      }));
      const remainingAssessments =
        mode === "replace"
          ? guestData.assessments.filter(
              (assessment) => assessment.course_id !== course.id
            )
          : guestData.assessments;

      writeGuestData({
        ...guestData,
        assessments: [...remainingAssessments, ...savedAssessments]
      });
      onSaved(savedAssessments, mode);
      clearReviewOnly();
      setMessage(buildSaveMessage(savedAssessments.length, skippedNames));
      setIsSavingExtraction(false);
      return;
    }

    if (!supabase) {
      setError("Log in to save extracted assessments.");
      setIsSavingExtraction(false);
      return;
    }

    const existingNames = new Set(
      assessments.map((assessment) =>
        getAssessmentName(assessment).toLowerCase()
      )
    );
    const { rowsToSave, skippedNames } = splitRowsForSave(
      validRows,
      existingNames,
      mode
    );

    if (mode === "replace") {
      const { error: deleteError } = await supabase
        .from("assessments")
        .delete()
        .eq("course_id", course.id)
        .eq("user_id", user.id);

      if (deleteError) {
        setError(getSupabaseErrorMessage(deleteError));
        setIsSavingExtraction(false);
        return;
      }
    }

    if (rowsToSave.length === 0) {
      onSaved([], mode);
      clearReviewOnly();
      setMessage(buildSaveMessage(0, skippedNames));
      setIsSavingExtraction(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("assessments")
      .insert(
        rowsToSave.map((row) => ({
          user_id: user.id,
          course_id: course.id,
          name: row.name.trim(),
          weight_percentage: Number(row.weight_percentage) || 0,
          score: null,
          max_score: Number(row.max_score) || 100,
          category: "Planned",
          title: row.name.trim(),
          weight: Number(row.weight_percentage) || 0
        }))
      )
      .select();

    if (insertError) {
      setError(getSupabaseErrorMessage(insertError));
      setIsSavingExtraction(false);
      return;
    }

    const savedAssessments = (data ?? []) as AssessmentRecord[];
    onSaved(savedAssessments, mode);
    clearReviewOnly();
    setMessage(buildSaveMessage(savedAssessments.length, skippedNames));
    setIsSavingExtraction(false);
  }

  return (
    <Card className="p-5" id="syllabus-upload">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
              <FileText aria-hidden="true" className="h-4 w-4" />
              Smart Syllabus Extractor
            </div>
            <Badge tone="teal">AI assist: Local</Badge>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink-900">
            Create assessments from a syllabus
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            Type a quick message, upload a PDF, or paste syllabus text.
            GradeMate will detect the grading breakdown, then ask you to review
            it before saving.
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <Wand2 aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-5 rounded-lg border border-ink-200 bg-ink-100/40 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
          <ClipboardPaste aria-hidden="true" className="h-4 w-4" />
          Quick add grading breakdown
        </div>
        <p className="mt-2 text-sm text-ink-500">
          Type it like a message. GradeMate will turn it into assessments.
        </p>
        <textarea
          className="mt-3 min-h-24 w-full rounded-lg border border-ink-200 bg-white px-3 py-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          onChange={(event) => setQuickText(event.target.value)}
          placeholder="quizzes 15, assignments 20, midterm 25, final 40"
          value={quickText}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            disabled={isExtracting}
            onClick={() => void runExtraction(quickText, "quick")}
          >
            <Wand2 aria-hidden="true" className="h-4 w-4" />
            Auto-detect
          </Button>
          <Button
            onClick={() =>
              setQuickText("quizzes 15, assignments 20, midterm 25, final 40")
            }
            variant="secondary"
          >
            Try sample
          </Button>
          <Button
            onClick={() => {
              setQuickText("");
              clearResults();
            }}
            variant="secondary"
          >
            Clear
          </Button>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Examples: 2 midterms worth 20% each, final 40%, homework 20% - labs
          10%, project 30%, final exam 40%, participation 20%
        </p>
      </div>

      <div className="mt-5 flex rounded-lg bg-ink-100/60 p-1">
        {extractorTabs.map(({ icon: Icon, label, value }) => (
          <button
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === value
                ? "bg-teal-700 text-white"
                : "text-ink-600 hover:bg-ink-100"
            }`}
            key={value}
            onClick={() => setActiveTab(value)}
            type="button"
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "upload" ? (
        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              PDF syllabus
            </span>
            <input
              accept="application/pdf"
              className="mt-1 block w-full rounded-lg border border-dashed border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              disabled={isExtracting}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
            <span className="mt-2 block text-xs text-ink-500">
              PDF text is read locally in your browser. It is not saved until
              you confirm the extracted assessments.
            </span>
          </label>
          <Button
            className="w-full md:w-auto"
            disabled={!file || isExtracting}
            onClick={() => void extractFromPdf()}
          >
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
            {isExtracting ? "Reading PDF..." : "Extract grading breakdown"}
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              Syllabus text
            </span>
            <textarea
              className="mt-1 min-h-44 w-full rounded-lg border border-ink-200 bg-white px-3 py-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
              onChange={(event) => setPastedText(event.target.value)}
              placeholder="Paste the grading breakdown or syllabus text here..."
              value={pastedText}
            />
            <span className="mt-2 block text-xs text-ink-500">
              You can paste the full syllabus or just the grading section.
            </span>
          </label>
          {hasExistingAssessments && reviewRows.length > 0 ? (
            <p className="text-sm text-ink-500">
              This course already has assessments. Choose whether to replace
              them or append only new names.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isExtracting}
              onClick={() => void runExtraction(pastedText, "syllabus")}
            >
              <Wand2 aria-hidden="true" className="h-4 w-4" />
              Extract grading breakdown
            </Button>
            <Button
              onClick={() => {
                setPastedText("");
                clearResults();
              }}
              variant="secondary"
            >
              Clear text
            </Button>
          </div>
        </div>
      )}

      {message ? (
        <p className="mt-4 rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {extraction ? (
        <div className="mt-5 space-y-4 rounded-lg border border-ink-200 bg-ink-50 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg bg-white px-3 py-2 text-sm">
              <p className="text-ink-500">Course code</p>
              <p className="mt-1 font-semibold text-ink-900">
                {extraction.courseCode || course.code || "Not found"}
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-sm md:col-span-2">
              <p className="text-ink-500">Course name</p>
              <p className="mt-1 font-semibold text-ink-900">
                {extraction.courseName || course.name}
              </p>
            </div>
            <div className="rounded-lg bg-white px-3 py-2 text-sm">
              <p className="text-ink-500">Credits</p>
              <p className="mt-1 font-semibold text-ink-900">
                {extraction.creditHours ?? Number(course.credit_hours)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={reviewReadiness.tone}>
              {getWeightHelperText(reviewTotalWeight)}
            </Badge>
            <Badge tone="ink">
              {Math.round(extraction.confidence * 100)}% confidence
            </Badge>
            <Badge
              tone={
                extractionSource === "ai" || extractionSource === "pdf"
                  ? "teal"
                  : "ink"
              }
            >
              {getExtractionSourceLabel(extractionSource)}
            </Badge>
            {extraction.instructor ? (
              <Badge tone="teal">Instructor: {extraction.instructor}</Badge>
            ) : null}
          </div>

          {!isWeightCloseToReady(reviewTotalWeight) && reviewRows.length > 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              You can still save this, but the course weights do not add to
              100% yet.
            </p>
          ) : null}

          {extraction.warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Review notes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {extraction.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {reviewRows.length === 0 ? (
            <div className="rounded-lg border border-ink-200 bg-white p-4 text-sm text-ink-600">
              <p className="font-medium text-ink-900">
                I couldn&apos;t find a grading breakdown.
              </p>
              <p className="mt-1">
                Try pasting the grading/evaluation section, like: midterm 25,
                final 40, assignments 35.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ink-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-ink-100 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Assessment</th>
                    <th className="px-4 py-3 font-semibold">Weight %</th>
                    <th className="px-4 py-3 font-semibold">Max score</th>
                    <th className="px-4 py-3 font-semibold">Confidence</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200 bg-white">
                  {reviewRows.map((row) => {
                    const confidenceInfo = getConfidenceInfo(row.confidence);

                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <input
                            className={inputStyles}
                            onChange={(event) =>
                              updateReviewRow(
                                row.id,
                                "name",
                                event.target.value
                              )
                            }
                            value={row.name}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className={inputStyles}
                            min="0"
                            onChange={(event) =>
                              updateReviewRow(
                                row.id,
                                "weight_percentage",
                                event.target.value
                              )
                            }
                            step="0.01"
                            type="number"
                            value={row.weight_percentage}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className={inputStyles}
                            min="0"
                            onChange={(event) =>
                              updateReviewRow(
                                row.id,
                                "max_score",
                                event.target.value
                              )
                            }
                            step="0.01"
                            type="number"
                            value={row.max_score}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge tone={confidenceInfo.tone}>
                              {confidenceInfo.label}
                            </Badge>
                            <span className="text-xs text-ink-500">
                              {Math.round(row.confidence * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="max-w-xs px-4 py-3 text-ink-600">
                          <details>
                            <summary className="cursor-pointer text-sm font-medium text-teal-700">
                              View snippet
                            </summary>
                            <p className="mt-2 rounded-lg bg-ink-50 p-3 text-xs leading-5 text-ink-600">
                              {row.source_text_snippet ||
                                "No source snippet available."}
                            </p>
                          </details>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            aria-label={`Delete ${row.name}`}
                            onClick={() => deleteReviewRow(row.id)}
                            size="icon"
                            variant="danger"
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={addReviewRow} variant="secondary">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add row
            </Button>
            {reviewRows.length === 0 ? (
              <Button onClick={clearResults} variant="ghost">
                Clear results
              </Button>
            ) : hasExistingAssessments ? (
              <>
                <Button
                  disabled={isSavingExtraction}
                  onClick={() => void saveExtractedAssessments("replace")}
                >
                  Replace existing assessments
                </Button>
                <Button
                  disabled={isSavingExtraction}
                  onClick={() => void saveExtractedAssessments("append")}
                  variant="secondary"
                >
                  Append only new assessments
                </Button>
                <Button onClick={clearResults} variant="ghost">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={isSavingExtraction}
                  onClick={() => void saveExtractedAssessments("append")}
                >
                  Confirm and save
                </Button>
                <Button onClick={clearResults} variant="ghost">
                  Clear results
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function CourseDetailClient({
  courseIdOverride
}: {
  courseIdOverride?: string;
} = {}) {
  const params = useParams();
  const routeCourseId = Array.isArray(params.courseId)
    ? params.courseId[0]
    : params.courseId;
  const [previewCourseId, setPreviewCourseId] = useState<string | null>(null);
  const courseId =
    courseIdOverride ??
    (routeCourseId === "preview" ? (previewCourseId ?? "") : routeCourseId) ??
    "";
  const { isGuest, supabase, user } = useAuth();
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [semester, setSemester] = useState<SemesterRecord | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [assessmentForm, setAssessmentForm] =
    useState<AssessmentForm>(defaultAssessmentForm);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(
    null
  );
  const [targetGrade, setTargetGrade] = useState("90");
  const [selectedNeedAssessmentId, setSelectedNeedAssessmentId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (courseIdOverride || routeCourseId !== "preview") {
      return;
    }

    const queryCourseId = new URLSearchParams(window.location.search).get(
      "courseId"
    );

    setPreviewCourseId(queryCourseId ?? "");
  }, [courseIdOverride, routeCourseId]);

  useEffect(() => {
    async function loadCourse() {
      setIsLoading(true);
      setError("");

      if (routeCourseId === "preview" && previewCourseId === null) {
        return;
      }

      if (!courseId) {
        setError("Course not found.");
        setIsLoading(false);
        return;
      }

      if (isGuest) {
        const guestData = readGuestData();
        const selectedCourse =
          guestData.courses.find((item) => item.id === courseId) ?? null;
        const selectedSemester = selectedCourse
          ? guestData.semesters.find(
              (item) => item.id === selectedCourse.semester_id
            ) ?? null
          : null;

        setCourse(selectedCourse);
        setSemester(selectedSemester);
        setAssessments(
          guestData.assessments.filter((item) => item.course_id === courseId)
        );
        setError(selectedCourse ? "" : "Course not found.");
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setError("Log in to load this course.");
        setIsLoading(false);
        return;
      }

      const [courseResponse, assessmentResponse] = await Promise.all([
        supabase
          .from("courses")
          .select("*")
          .eq("id", courseId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("assessments")
          .select("*")
          .eq("course_id", courseId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
      ]);

      const selectedCourse = courseResponse.data as CourseRecord | null;

      if (courseResponse.error || !selectedCourse) {
        setCourse(null);
        setSemester(null);
        setAssessments([]);
        setError(getSupabaseErrorMessage(courseResponse.error, "Course not found."));
        setIsLoading(false);
        return;
      }

      if (assessmentResponse.error) {
        setError(getSupabaseErrorMessage(assessmentResponse.error));
      }

      const semesterResponse = await supabase
        .from("semesters")
        .select("*")
        .eq("id", selectedCourse.semester_id)
        .eq("user_id", user.id)
        .single();

      setCourse(selectedCourse);
      setSemester((semesterResponse.data as SemesterRecord | null) ?? null);
      setAssessments((assessmentResponse.data ?? []) as AssessmentRecord[]);
      setIsLoading(false);
    }

    void loadCourse();
  }, [courseId, isGuest, previewCourseId, routeCourseId, supabase, user.id]);

  const gradeSummary = useMemo(
    () => getCourseGradeSummary(assessments),
    [assessments]
  );
  const weightReadiness = getWeightReadiness(gradeSummary.totalWeight);
  const currentLetterGrade = getLetterGrade(gradeSummary.currentGrade);
  const sortedAssessments = useMemo(
    () =>
      [...assessments].sort(
        (first, second) =>
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime()
      ),
    [assessments]
  );
  const remainingAssessments = useMemo(
    () =>
      sortedAssessments.filter(
        (assessment) =>
          getAssessmentStatus(assessment) !== "Dropped" &&
          !isCompletedAssessment(assessment) &&
          getAssessmentWeight(assessment) > 0
      ),
    [sortedAssessments]
  );
  const selectedNeedAssessment =
    remainingAssessments.find(
      (assessment) => assessment.id === selectedNeedAssessmentId
    ) ??
    remainingAssessments[0] ??
    null;
  const needCalculator = useMemo(() => {
    if (!selectedNeedAssessment) {
      return null;
    }

    const target = Number(targetGrade);
    const weight = getAssessmentWeight(selectedNeedAssessment);
    const maxScore = getAssessmentMaxScore(selectedNeedAssessment) ?? 100;

    if (!Number.isFinite(target) || weight <= 0 || maxScore <= 0) {
      return null;
    }

    const neededContribution = target - gradeSummary.completedContribution;
    const neededPercent = (neededContribution / weight) * 100;
    const neededScore = (neededPercent / 100) * maxScore;

    return {
      maxScore,
      neededPercent,
      neededScore
    };
  }, [gradeSummary.completedContribution, selectedNeedAssessment, targetGrade]);
  const targetNumeric = Number(targetGrade);
  const bestPossibleGrade =
    gradeSummary.completedContribution + gradeSummary.unscoredWeight;
  const neededRemainingAverage =
    Number.isFinite(targetNumeric) && gradeSummary.unscoredWeight > 0
      ? ((targetNumeric - gradeSummary.completedContribution) /
          gradeSummary.unscoredWeight) *
        100
      : null;
  const predictorStatus =
    Number.isFinite(targetNumeric) &&
    targetNumeric <= gradeSummary.completedContribution
      ? { label: "Already secured", tone: "green" as const }
      : neededRemainingAverage !== null && neededRemainingAverage > 100
        ? { label: "Impossible", tone: "rose" as const }
        : neededRemainingAverage !== null && neededRemainingAverage >= 90
          ? { label: "At risk", tone: "gold" as const }
          : { label: "Possible", tone: "teal" as const };

  function updateAssessmentForm(field: keyof AssessmentForm, value: string) {
    setAssessmentForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetAssessmentForm() {
    setAssessmentForm(defaultAssessmentForm);
    setEditingAssessmentId(null);
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!course) {
      return;
    }

    setError("");
    setIsSaving(true);
    const payload = buildAssessmentPayload(assessmentForm);

    if (isGuest) {
      const guestData = readGuestData();
      const nextAssessments = editingAssessmentId
        ? guestData.assessments.map((assessment) =>
            assessment.id === editingAssessmentId
              ? {
                  ...assessment,
                  ...payload
                }
              : assessment
          )
        : [
            ...guestData.assessments,
            {
              id: createGuestId("assessment"),
              user_id: user.id,
              course_id: course.id,
              ...payload,
              created_at: new Date().toISOString()
            }
          ];

      writeGuestData({ ...guestData, assessments: nextAssessments });
      setAssessments(
        nextAssessments.filter((assessment) => assessment.course_id === course.id)
      );
      resetAssessmentForm();
      setIsSaving(false);
      return;
    }

    if (!supabase) {
      setError("Log in to save assessments.");
      setIsSaving(false);
      return;
    }

    const response = editingAssessmentId
      ? await supabase
          .from("assessments")
          .update(payload)
          .eq("id", editingAssessmentId)
          .eq("user_id", user.id)
          .select()
          .single()
      : await supabase
          .from("assessments")
          .insert({
            ...payload,
            user_id: user.id,
            course_id: course.id
          })
          .select()
          .single();

    setIsSaving(false);

    const savedAssessment = response.data as AssessmentRecord | null;

    if (response.error || !savedAssessment) {
      setError(getSupabaseErrorMessage(response.error, "Could not save assessment."));
      return;
    }

    setAssessments((current) =>
      editingAssessmentId
        ? current.map((assessment) =>
            assessment.id === savedAssessment.id ? savedAssessment : assessment
          )
        : [...current, savedAssessment]
    );
    resetAssessmentForm();
  }

  function startEditing(assessment: AssessmentRecord) {
    setEditingAssessmentId(assessment.id);
  setAssessmentForm({
    name: getAssessmentName(assessment),
    weightPercentage: String(getAssessmentWeight(assessment)),
    score: toFormValue(assessment.score),
    maxScore: toFormValue(getAssessmentMaxScore(assessment)),
    category:
      getAssessmentStatus(assessment) === "Planned"
        ? "Remaining"
        : getAssessmentStatus(assessment)
  });
  }

  async function deleteAssessment(assessmentId: string) {
    if (!course) {
      return;
    }

    setError("");

    if (isGuest) {
      const guestData = readGuestData();
      const nextAssessments = guestData.assessments.filter(
        (assessment) => assessment.id !== assessmentId
      );

      writeGuestData({ ...guestData, assessments: nextAssessments });
      setAssessments(
        nextAssessments.filter((assessment) => assessment.course_id === course.id)
      );

      if (editingAssessmentId === assessmentId) {
        resetAssessmentForm();
      }

      return;
    }

    if (!supabase) {
      setError("Log in to delete assessments.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("assessments")
      .delete()
      .eq("id", assessmentId)
      .eq("user_id", user.id);

    if (deleteError) {
      setError(getSupabaseErrorMessage(deleteError));
      return;
    }

    setAssessments((current) =>
      current.filter((assessment) => assessment.id !== assessmentId)
    );

    if (editingAssessmentId === assessmentId) {
      resetAssessmentForm();
    }
  }

  function handleExtractedAssessmentsSaved(
    savedAssessments: AssessmentRecord[],
    mode: "append" | "replace"
  ) {
    setAssessments((current) =>
      mode === "replace" ? savedAssessments : [...current, ...savedAssessments]
    );
  }

  if (isLoading) {
    return <Card className="p-5 text-sm text-ink-500">Loading course...</Card>;
  }

  if (!course) {
    return (
      <EmptyState
        action={
          <Link className={buttonStyles()} href="/courses">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to courses
          </Link>
        }
        description={error || "This course could not be found."}
        icon={<BookOpen aria-hidden="true" className="h-5 w-5" />}
        title="Course not found"
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link className={buttonStyles({ variant: "secondary" })} href="/semesters">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to semester
          </Link>
        }
        description={
          semester?.name ??
          "Track grades, assessments, predictions, and syllabus uploads."
        }
        eyebrow={course.code || "Course"}
        title={course.name}
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Credit hours</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {Number(course.credit_hours)}
          </p>
          <p className="mt-1 text-sm text-ink-500">Course workload</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Current grade</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {formatPercent(gradeSummary.currentGrade)}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {gradeSummary.completedWeight}% completed weight
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Letter grade</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {currentLetterGrade}
          </p>
          <p className="mt-1 text-sm text-ink-500">Based on current grade</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-ink-500">Total weight</p>
            <Badge tone={weightReadiness.tone}>{weightReadiness.label}</Badge>
          </div>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {gradeSummary.totalWeight}%
          </p>
          <p className="mt-1 text-sm text-ink-500">Target total is 100%</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Remaining weight</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {gradeSummary.remainingWeight}%
          </p>
          <p className="mt-1 text-sm text-ink-500">Still missing from 100%</p>
        </Card>
      </section>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">{course.code || "Course code"}</Badge>
              <Badge tone="ink">{Number(course.credit_hours)} credits</Badge>
              {semester ? <Badge tone="gold">{semester.name}</Badge> : null}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink-900">
              Grade Summary
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
              Your current grade is based on completed work. Missing scores
              count as 0 only in the projected final grade.
            </p>
          </div>
          <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
            <p className="text-sm font-medium text-ink-500">
              Projected final grade
            </p>
            <p className="mt-2 text-3xl font-semibold text-ink-900">
              {formatPercent(gradeSummary.finalProjectedGrade)}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Missing scores count as 0 for now
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
              <Target aria-hidden="true" className="h-4 w-4" />
            What do I need?
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink-900">
              What do I need?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
              Pick a target grade and GradeMate will calculate the score you
              need.
          </p>
        </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={predictorStatus.tone}>{predictorStatus.label}</Badge>
            <Badge tone={remainingAssessments.length > 0 ? "teal" : "ink"}>
              {remainingAssessments.length} remaining
            </Badge>
          </div>
      </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["A", "90"],
            ["B+", "87"],
            ["B", "83"],
            ["C+", "77"],
            ["C", "73"],
            ["Pass", "60"]
          ].map(([label, value]) => (
            <Button
              key={label}
              onClick={() => setTargetGrade(value)}
              size="sm"
              variant={targetGrade === value ? "primary" : "secondary"}
            >
              {label} {value}%
            </Button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)_18rem] lg:items-end">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              Target grade
            </span>
            <input
              className={inputStyles}
              min="0"
              onChange={(event) => setTargetGrade(event.target.value)}
              step="0.1"
              type="number"
              value={targetGrade}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              Remaining assessment
            </span>
            <select
              className={inputStyles}
              disabled={remainingAssessments.length === 0}
              onChange={(event) =>
                setSelectedNeedAssessmentId(event.target.value)
              }
              value={selectedNeedAssessment?.id ?? ""}
            >
              {remainingAssessments.length === 0 ? (
                <option value="">No remaining weighted assessments</option>
              ) : null}
              {remainingAssessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {getAssessmentName(assessment)} -{" "}
                  {getAssessmentWeight(assessment)}%
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
            <p className="text-sm font-medium text-ink-500">Needed score</p>
            {selectedNeedAssessment && needCalculator ? (
              <>
                <p className="mt-2 text-3xl font-semibold text-ink-900">
                  {needCalculator.neededPercent <= 0
                    ? "0.0%"
                    : `${needCalculator.neededPercent.toFixed(1)}%`}
                </p>
                <p className="mt-1 text-sm text-ink-500">
                  {needCalculator.neededPercent <= 0
                    ? "You've already secured this target based on completed work."
                    : needCalculator.neededPercent > 100
                      ? "This target is not possible with this assessment alone."
                      : `${needCalculator.neededScore.toFixed(1)} / ${
                          needCalculator.maxScore
                        }`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-3xl font-semibold text-ink-900">N/A</p>
                <p className="mt-1 text-sm text-ink-500">
                  Add a weighted, unscored assessment.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-ink-100/60 p-3 text-sm">
            <p className="text-ink-500">Current grade so far</p>
            <p className="mt-1 font-semibold text-ink-900">
              {formatPercent(gradeSummary.currentGrade)}
            </p>
          </div>
          <div className="rounded-lg bg-ink-100/60 p-3 text-sm">
            <p className="text-ink-500">Best possible final grade</p>
            <p className="mt-1 font-semibold text-ink-900">
              {formatPercent(bestPossibleGrade)}
            </p>
          </div>
          <div className="rounded-lg bg-ink-100/60 p-3 text-sm">
            <p className="text-ink-500">Needed average remaining</p>
            <p className="mt-1 font-semibold text-ink-900">
              {neededRemainingAverage === null
                ? "No remaining work"
                : formatPercent(neededRemainingAverage)}
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-ink-100/60 p-3 text-sm text-ink-600">
          {neededRemainingAverage === null
            ? "No remaining assessments are available for predictions."
            : targetNumeric <= gradeSummary.completedContribution
              ? "You've already secured this target based on completed work."
              : neededRemainingAverage > 100
                ? `To reach ${targetGrade}%, you would need ${neededRemainingAverage.toFixed(
                    1
                  )}% average on remaining work, so this target is not possible with the current weights.`
                : `You need an average of ${neededRemainingAverage.toFixed(
                    1
                  )}% across your remaining assessments to finish with ${targetGrade}%.`}
        </p>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-200 p-5">
            <h2 className="text-lg font-semibold text-ink-900">
              Assessments
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Add grading items, scores, and weights as the course unfolds.
            </p>
          </div>

          {sortedAssessments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                description="Add your first assessment to start calculating this course grade."
                icon={<Layers3 aria-hidden="true" className="h-5 w-5" />}
                title="No assessments yet"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Assessment</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Weight</th>
                    <th className="px-5 py-3 font-semibold">Score</th>
                    <th className="px-5 py-3 font-semibold">Max score</th>
                    <th className="px-5 py-3 font-semibold">
                      Grade contribution
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sortedAssessments.map((assessment) => {
                    const status = getAssessmentStatus(assessment);
                    const contribution = getWeightedContribution(assessment);
                    const maxScore = getAssessmentMaxScore(assessment);

                    return (
                      <tr key={assessment.id}>
                        <td className="px-5 py-4">
                          <div className="font-medium text-ink-900">
                            {getAssessmentName(assessment)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={getStatusTone(status)}>
                            {getFriendlyStatus(status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {getAssessmentWeight(assessment)}%
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {assessment.score === null ||
                          assessment.score === undefined
                            ? "Not scored"
                            : Number(assessment.score)}
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {maxScore === null ? "Not set" : Number(maxScore)}
                        </td>
                        <td className="px-5 py-4 font-medium text-ink-900">
                          {formatPercent(contribution)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              aria-label={`Edit ${getAssessmentName(assessment)}`}
                              onClick={() => startEditing(assessment)}
                              size="icon"
                              variant="secondary"
                            >
                              <Edit3 aria-hidden="true" className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label={`Delete ${getAssessmentName(assessment)}`}
                              onClick={() => void deleteAssessment(assessment.id)}
                              size="icon"
                              variant="danger"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5" id="add-assessment">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                {editingAssessmentId ? "Edit assessment" : "Add assessment"}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Track weights and scores as the course unfolds.
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              {editingAssessmentId ? (
                <Save aria-hidden="true" className="h-5 w-5" />
              ) : (
                <PlusCircle aria-hidden="true" className="h-5 w-5" />
              )}
            </span>
          </div>

          <form className="mt-5 space-y-4" onSubmit={saveAssessment}>
            <label className="block">
              <span className="text-sm font-medium text-ink-700">Name</span>
              <input
                className={inputStyles}
                list="course-assessment-names"
                onChange={(event) =>
                  updateAssessmentForm("name", event.target.value)
                }
                placeholder="Midterm"
                required
                value={assessmentForm.name}
              />
              <datalist id="course-assessment-names">
                {assessmentNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </datalist>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Weight percentage
                </span>
                <input
                  className={inputStyles}
                  min="0"
                  onChange={(event) =>
                    updateAssessmentForm("weightPercentage", event.target.value)
                  }
                  placeholder="25"
                  required
                  step="0.01"
                  type="number"
                  value={assessmentForm.weightPercentage}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">Status</span>
                <select
                  className={inputStyles}
                  onChange={(event) =>
                    updateAssessmentForm("category", event.target.value)
                  }
                  value={assessmentForm.category}
                >
                  {assessmentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink-700">Score</span>
                <input
                  className={inputStyles}
                  min="0"
                  onChange={(event) =>
                    updateAssessmentForm("score", event.target.value)
                  }
                  placeholder="88"
                  step="0.01"
                  type="number"
                  value={assessmentForm.score}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Max score
                </span>
                <input
                  className={inputStyles}
                  min="0"
                  onChange={(event) =>
                    updateAssessmentForm("maxScore", event.target.value)
                  }
                  placeholder="100"
                  step="0.01"
                  type="number"
                  value={assessmentForm.maxScore}
                />
              </label>
            </div>

            <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
              <div className="flex items-center gap-2 font-medium text-ink-900">
                <Percent aria-hidden="true" className="h-4 w-4 text-teal-700" />
                Grade contribution
              </div>
              <p className="mt-1">
                {assessmentForm.score && assessmentForm.maxScore
                  ? `${formatPercent(
                      (Number(assessmentForm.score) /
                        Number(assessmentForm.maxScore)) *
                        (Number(assessmentForm.weightPercentage) || 0)
                    )} toward the final grade`
                  : "Enter score and max score to preview the grade contribution."}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full" disabled={isSaving} type="submit">
                {editingAssessmentId ? (
                  <Save aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <PlusCircle aria-hidden="true" className="h-4 w-4" />
                )}
                {isSaving
                  ? "Saving..."
                  : editingAssessmentId
                    ? "Save changes"
                    : "Add assessment"}
              </Button>
              {editingAssessmentId ? (
                <Button
                  className="w-full sm:w-auto"
                  onClick={resetAssessmentForm}
                  variant="secondary"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </section>

      <SmartSyllabusExtractor
        assessments={assessments}
        course={course}
        isGuest={isGuest}
        onSaved={handleExtractedAssessmentsSaved}
      />
    </div>
  );
}
