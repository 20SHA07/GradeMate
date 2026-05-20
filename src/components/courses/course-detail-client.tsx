"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle,
  ClipboardPaste,
  Edit3,
  FileText,
  Info,
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
import { GradePlannerPanel } from "@/components/planner/grade-planner-panel";
import type { PlannerAssessmentInput } from "@/lib/grade-planner";
import {
  formatPercent,
  getAssessmentMaxScore,
  getAssessmentName,
  getAssessmentStatus,
  getAssessmentWeight,
  getCourseGradeSummary,
  getWeightedContribution
} from "@/lib/grades";
import {
  createGuestId,
  readGuestData,
  writeGuestData
} from "@/lib/guest-session";
import { getSupabaseErrorMessage } from "@/lib/supabase/config";
import {
  extractGradeBreakdown,
  type ExtractedAssessment,
  type ExtractedSyllabus
} from "@/lib/syllabus/extractSyllabus";
import { extractTextFromPdfFile } from "@/lib/syllabus/pdfText";
import {
  saveVerifiedExtraction,
  type VerifiedExtractionFeedback,
  type VerifiedExtractionSource
} from "@/lib/syllabus/verified-extractions";
import {
  getCoreAssessmentPayload,
  getCoreAssessmentPayloads,
  isMissingAssessmentOptionalColumnError
} from "@/lib/supabase/assessment-write";
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

type CourseDetailTab = "assessments" | "planner" | "extractor" | "details";

type ReviewAssessment = ExtractedAssessment & {
  id: string;
};

type CourseInfoReviewField = {
  key:
    | "classroom"
    | "code"
    | "description"
    | "credit_hours"
    | "instructor"
    | "instructor_email"
    | "name"
    | "office_hours"
    | "prerequisites"
    | "schedule"
    | "term";
  label: string;
  value: string;
  apply: boolean;
  confidence?: number;
};

type ExtractionSource = "pdf" | "rule";

type ExtractionDraft = {
  extraction: ExtractedSyllabus;
  extractionSource: ExtractionSource;
  courseInfoRows?: CourseInfoReviewField[];
  reviewRows: ReviewAssessment[];
  sourceFileName?: string | null;
  sourceText?: string | null;
  updatedAt: string;
};

type PendingFeedback = {
  confirmedExtraction: ExtractedSyllabus;
  includeExtractedText: boolean;
  originalExtraction: ExtractedSyllabus;
  source: ExtractionSource;
  sourceFileName?: string | null;
  sourceText?: string | null;
};

type PdfPreview = {
  fileName: string;
  text: string;
  warning?: string;
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
  "mt-1 gm-input";

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
  if (isWeightCloseToReady(totalWeight)) {
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
    return "Total weight: 100% ready";
  }

  if (totalWeight < 100) {
    return `Total weight: missing ${formatWeightDelta(100 - totalWeight)}%`;
  }

  return `Total weight: over by ${formatWeightDelta(totalWeight - 100)}%`;
}

function getCoursePlannerAssessments(
  assessments: AssessmentRecord[]
): PlannerAssessmentInput[] {
  return assessments.map((assessment) => ({
    id: assessment.id,
    name: getAssessmentName(assessment),
    weightPercentage:
      assessment.weight_percentage ?? assessment.weight ?? null,
    score: assessment.score,
    maxScore: assessment.max_score,
    status: getAssessmentStatus(assessment)
  }));
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
  if (source === "pdf") {
    return "Extracted from PDF";
  }

  return "Detected automatically";
}

function getExtractionQualityLabel(
  extraction: ExtractedSyllabus
) {
  return shouldUseRuleExtraction(extraction)
    ? "Detected automatically"
    : "Needs review";
}

function getExtractionQualityTone(
  extraction: ExtractedSyllabus
) {
  return shouldUseRuleExtraction(extraction) ? ("green" as const) : ("gold" as const);
}

function makeReviewRows(extraction: ExtractedSyllabus): ReviewAssessment[] {
  return extraction.assessments.map((assessment) => ({
    ...assessment,
    id: createGuestId("review-assessment")
  }));
}

function makeCourseInfoRows(extraction: ExtractedSyllabus): CourseInfoReviewField[] {
  const fields: Array<Omit<CourseInfoReviewField, "apply">> = [
    {
      key: "code",
      label: "Course code",
      value: extraction.courseCode ?? "",
      confidence: extraction.fieldConfidence?.courseCode
    },
    {
      key: "name",
      label: "Course name",
      value: extraction.courseName ?? "",
      confidence: extraction.fieldConfidence?.courseName
    },
    {
      key: "credit_hours",
      label: "Credit hours",
      value: extraction.creditHours === null ? "" : String(extraction.creditHours),
      confidence: extraction.fieldConfidence?.creditHours
    },
    {
      key: "instructor",
      label: "Instructor",
      value: extraction.instructor ?? "",
      confidence: extraction.fieldConfidence?.instructor
    },
    {
      key: "instructor_email",
      label: "Instructor email",
      value: extraction.instructorEmail ?? "",
      confidence: extraction.fieldConfidence?.instructorEmail
    },
    {
      key: "term",
      label: "Semester",
      value: extraction.semester ?? "",
      confidence: extraction.fieldConfidence?.semester
    },
    {
      key: "schedule",
      label: "Schedule",
      value: extraction.schedule ?? "",
      confidence: extraction.fieldConfidence?.schedule
    },
    {
      key: "classroom",
      label: "Classroom",
      value: extraction.classroom ?? "",
      confidence: extraction.fieldConfidence?.classroom
    },
    {
      key: "office_hours",
      label: "Office hours",
      value: extraction.officeHours ?? "",
      confidence: extraction.fieldConfidence?.officeHours
    },
    {
      key: "prerequisites",
      label: "Prerequisites",
      value: extraction.prerequisites ?? "",
      confidence: extraction.fieldConfidence?.prerequisites
    },
    {
      key: "description",
      label: "Course description",
      value: extraction.courseDescription ?? "",
      confidence: extraction.fieldConfidence?.courseDescription
    }
  ];

  return fields
    .filter((field) => field.value.trim())
    .map((field) => ({ ...field, apply: true }));
}

function buildConfirmedExtraction(
  extraction: ExtractedSyllabus,
  rows: ReviewAssessment[],
  courseInfoRows: CourseInfoReviewField[] = []
): ExtractedSyllabus {
  const selectedInfo = Object.fromEntries(
    courseInfoRows
      .filter((field) => field.apply && field.value.trim())
      .map((field) => [field.key, field.value.trim()])
  ) as Partial<Record<CourseInfoReviewField["key"], string>>;

  return {
    ...extraction,
    classroom: selectedInfo.classroom ?? extraction.classroom,
    courseCode: selectedInfo.code ?? extraction.courseCode,
    courseDescription: selectedInfo.description ?? extraction.courseDescription,
    courseName: selectedInfo.name ?? extraction.courseName,
    creditHours:
      selectedInfo.credit_hours !== undefined
        ? Number(selectedInfo.credit_hours) || extraction.creditHours
        : extraction.creditHours,
    instructor: selectedInfo.instructor ?? extraction.instructor,
    instructorEmail: selectedInfo.instructor_email ?? extraction.instructorEmail,
    officeHours: selectedInfo.office_hours ?? extraction.officeHours,
    prerequisites: selectedInfo.prerequisites ?? extraction.prerequisites,
    schedule: selectedInfo.schedule ?? extraction.schedule,
    semester: selectedInfo.term ?? extraction.semester,
    assessments: rows.map((row) => ({
      confidence: Number(row.confidence) || 0.7,
      inferred: row.inferred,
      max_score: Number(row.max_score) || 100,
      name: row.name.trim(),
      source_text_snippet: row.source_text_snippet,
      warning: row.warning,
      weight_percentage: Number(row.weight_percentage) || 0
    }))
  };
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

function getVerifiedSource(source: ExtractionSource | null): VerifiedExtractionSource {
  if (source === "pdf") return "pdf";
  return "pasted_text";
}

function SmartSyllabusExtractor({
  assessments,
  course,
  isGuest,
  onCourseUpdated,
  onSaved
}: {
  assessments: AssessmentRecord[];
  course: CourseRecord;
  isGuest: boolean;
  onCourseUpdated: (course: CourseRecord) => void;
  onSaved: (savedAssessments: AssessmentRecord[], mode: "append" | "replace") => void;
}) {
  const { supabase, user } = useAuth();
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const [quickText, setQuickText] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [extraction, setExtraction] = useState<ExtractedSyllabus | null>(null);
  const [extractionSource, setExtractionSource] =
    useState<ExtractionSource | null>(null);
  const [extractionSourceFileName, setExtractionSourceFileName] =
    useState<string | null>(null);
  const [extractionSourceText, setExtractionSourceText] =
    useState<string | null>(null);
  const [courseInfoRows, setCourseInfoRows] = useState<CourseInfoReviewField[]>(
    []
  );
  const [reviewRows, setReviewRows] = useState<ReviewAssessment[]>([]);
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(
    null
  );
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
      setExtractionSourceFileName(draft.sourceFileName ?? null);
      setExtractionSourceText(draft.sourceText ?? null);
      setCourseInfoRows(draft.courseInfoRows ?? makeCourseInfoRows(draft.extraction));
      setReviewRows(draft.reviewRows);
      setMessage("Restored your unsaved extraction draft.");
    } else {
      setExtraction(null);
      setExtractionSource(null);
      setCourseInfoRows([]);
      setReviewRows([]);
    }

    setPdfPreview(null);
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
      courseInfoRows,
      reviewRows,
      sourceFileName: extractionSourceFileName,
      sourceText: extractionSourceText,
      updatedAt: new Date().toISOString()
    });
  }, [
    course.id,
    courseInfoRows,
    extraction,
    extractionSource,
    extractionSourceFileName,
    extractionSourceText,
    isDraftReady,
    reviewRows
  ]);

  function clearResults() {
    setExtraction(null);
    setExtractionSource(null);
    setExtractionSourceFileName(null);
    setExtractionSourceText(null);
    setCourseInfoRows([]);
    setReviewRows([]);
    setFile(null);
    setPdfPreview(null);
    setMessage("");
    setError("");
  }

  function clearReviewOnly() {
    setExtraction(null);
    setExtractionSource(null);
    setExtractionSourceFileName(null);
    setExtractionSourceText(null);
    setCourseInfoRows([]);
    setReviewRows([]);
    setError("");
  }

  function showExtractionResult(
    result: ExtractedSyllabus,
    source: ExtractionSource,
    sourceText?: string | null,
    sourceFileName?: string | null
  ) {
    setExtraction(result);
    setExtractionSource(source);
    setExtractionSourceFileName(sourceFileName ?? null);
    setExtractionSourceText(sourceText ?? null);
    setCourseInfoRows(makeCourseInfoRows(result));
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
    ruleSource: ExtractionSource,
    sourceFileName?: string | null
  ) {
    const ruleResult = extractGradeBreakdown(text, { mode });
    showExtractionResult(ruleResult, ruleSource, text, sourceFileName);
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
      const previewWarning =
        pdfText.trim().length < 120
          ? "This PDF may be scanned or image-based. Try pasting the grading section instead."
          : undefined;

      setPdfPreview({
        fileName: file.name,
        text: pdfText.slice(0, 6000),
        warning: previewWarning
      });

      if (pdfText.trim().length < 20) {
        throw new Error(
          "Could not read enough text from this PDF. Try pasting the grading section instead."
        );
      }

      await runExtractionPipeline(pdfText, "syllabus", "pdf", file.name);
    } catch (pdfError) {
      console.warn("PDF text extraction failed", pdfError);
      setError(
        "PDF text extraction failed. You can paste the grading section instead."
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

  function updateCourseInfoRow(
    key: CourseInfoReviewField["key"],
    updates: Partial<Pick<CourseInfoReviewField, "apply" | "value">>
  ) {
    setCourseInfoRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...updates } : row))
    );
  }

  function getSelectedCourseInfoUpdates() {
    return Object.fromEntries(
      courseInfoRows
        .filter((row) => row.apply && row.value.trim())
        .map((row) => [
          row.key,
          row.key === "credit_hours" ? Number(row.value) || 3 : row.value.trim()
        ])
    ) as Partial<CourseRecord>;
  }

  async function saveExtractedAssessments(mode: "append" | "replace") {
    setError("");

    if (reviewRows.length === 0) {
      setError("There are no extracted assessments to save.");
      return;
    }

    if (!extraction) {
      setError("Run extraction again before saving.");
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
    const selectedCourseUpdates = getSelectedCourseInfoUpdates();
    const confirmedExtraction = buildConfirmedExtraction(
      extraction,
      validRows,
      courseInfoRows
    );
    const savedExtractionSource = extractionSource ?? "rule";
    const savedSourceFileName = extractionSourceFileName;
    const savedSourceText = extractionSourceText;
    const buildPrivacyAwareSaveMessage = (
      count: number,
      skippedNames: string[]
    ) => {
      const saveMessage = buildSaveMessage(count, skippedNames);
      return savedExtractionSource === "pdf"
        ? `Saved. The PDF was not stored. ${saveMessage}`
        : saveMessage;
    };
    const discardSavedPdf = () => {
      if (savedExtractionSource === "pdf") {
        setFile(null);
        setPdfPreview(null);
      }
    };

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
        discardSavedPdf();
        setMessage(buildPrivacyAwareSaveMessage(0, skippedNames));
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
      const updatedCourse = {
        ...course,
        ...selectedCourseUpdates
      };

      writeGuestData({
        ...guestData,
        courses: guestData.courses.map((item) =>
          item.id === course.id ? updatedCourse : item
        ),
        assessments: [...remainingAssessments, ...savedAssessments]
      });
      onCourseUpdated(updatedCourse);
      onSaved(savedAssessments, mode);
      clearReviewOnly();
      setPendingFeedback({
        confirmedExtraction,
        includeExtractedText: false,
        originalExtraction: extraction,
        source: savedExtractionSource,
        sourceFileName: savedSourceFileName,
        sourceText: savedSourceText
      });
      discardSavedPdf();
      setMessage(buildPrivacyAwareSaveMessage(savedAssessments.length, skippedNames));
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
      discardSavedPdf();
      setMessage(buildPrivacyAwareSaveMessage(0, skippedNames));
      setIsSavingExtraction(false);
      return;
    }

    const insertPayloads = rowsToSave.map((row) => ({
      user_id: user.id,
      course_id: course.id,
      name: row.name.trim(),
      weight_percentage: Number(row.weight_percentage) || 0,
      score: null,
      max_score: Number(row.max_score) || 100,
      category: "Planned",
      title: row.name.trim(),
      weight: Number(row.weight_percentage) || 0
    }));
    let insertResponse = await supabase
      .from("assessments")
      .insert(insertPayloads)
      .select();

    if (isMissingAssessmentOptionalColumnError(insertResponse.error)) {
      insertResponse = await supabase
        .from("assessments")
        .insert(getCoreAssessmentPayloads(insertPayloads))
        .select();
    }

    if (insertResponse.error) {
      setError(getSupabaseErrorMessage(insertResponse.error));
      setIsSavingExtraction(false);
      return;
    }

    if (Object.keys(selectedCourseUpdates).length > 0) {
      let updateResponse = await supabase
        .from("courses")
        .update(selectedCourseUpdates)
        .eq("id", course.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (
        updateResponse.error &&
        /column|schema cache|does not exist/i.test(updateResponse.error.message)
      ) {
        const coreUpdates: Partial<CourseRecord> = {};

        if (selectedCourseUpdates.name) coreUpdates.name = selectedCourseUpdates.name;
        if (selectedCourseUpdates.code) coreUpdates.code = selectedCourseUpdates.code;
        if (selectedCourseUpdates.credit_hours) {
          coreUpdates.credit_hours = selectedCourseUpdates.credit_hours;
        }

        updateResponse = await supabase
          .from("courses")
          .update(coreUpdates)
          .eq("id", course.id)
          .eq("user_id", user.id)
          .select()
          .single();
      }

      if (updateResponse.error) {
        setError(getSupabaseErrorMessage(updateResponse.error));
        setIsSavingExtraction(false);
        return;
      }

      if (updateResponse.data) {
        onCourseUpdated(updateResponse.data as CourseRecord);
      }
    }

    const savedAssessments = (insertResponse.data ?? []) as AssessmentRecord[];
    onSaved(savedAssessments, mode);
    clearReviewOnly();
    setPendingFeedback({
      confirmedExtraction,
      includeExtractedText: false,
      originalExtraction: extraction,
      source: savedExtractionSource,
      sourceFileName: savedSourceFileName,
      sourceText: savedSourceText
    });
    discardSavedPdf();
    setMessage(buildPrivacyAwareSaveMessage(savedAssessments.length, skippedNames));
    setIsSavingExtraction(false);
  }

  async function sendExtractionFeedback(feedback: VerifiedExtractionFeedback) {
    if (!pendingFeedback) {
      return;
    }

    try {
      await saveVerifiedExtraction({
        aiProvider: "rule_based",
        confirmedExtraction: pendingFeedback.confirmedExtraction,
        extractedText: pendingFeedback.includeExtractedText
          ? pendingFeedback.sourceText ?? null
          : null,
        includeExtractedText: pendingFeedback.includeExtractedText,
        originalExtraction: pendingFeedback.originalExtraction,
        sourceFileName: pendingFeedback.sourceFileName,
        sourceTextForHash: pendingFeedback.sourceText ?? null,
        sourceType: getVerifiedSource(pendingFeedback.source),
        supabase: isGuest ? null : supabase,
        userFeedback: feedback,
        userId: isGuest ? null : user.id
      });
      setPendingFeedback(null);
      setMessage(
        feedback === "correct"
          ? "Thanks, this helps GradeMate improve future extractions."
          : "Thanks, we'll use your corrected version to improve future extraction."
      );
      if (feedback === "correct") {
        setMessage("Thanks - this helps GradeMate improve future extractions.");
      }
      if (feedback === "corrected") {
        setMessage("Thanks - your corrections help GradeMate improve future extraction.");
      }
      if (feedback === "incorrect") {
        setMessage("Thanks - we'll use this signal to improve future extraction.");
      }
    } catch (feedbackError) {
      setError(
        feedbackError instanceof Error
          ? getSupabaseErrorMessage(feedbackError)
          : "Could not save extraction feedback right now."
      );
    }
  }

  return (
    <Card className="p-5" id="syllabus-upload">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
              <FileText aria-hidden="true" className="h-4 w-4" />
              Syllabus Auto-Fill
            </div>
            <Badge tone="teal">Smart extraction</Badge>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink-900">
            Create assessments from a syllabus
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-500">
            Type a quick message, upload a PDF, or paste syllabus text.
            GradeMate will detect the grading breakdown locally, then ask you
            to review it before saving.
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
          className="gm-textarea mt-3 min-h-24"
          onChange={(event) => setQuickText(event.target.value)}
          placeholder="quizzes 15, assignments 20, midterm 25, final 40"
          value={quickText}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() =>
              setQuickText("quizzes 15, assignments 20, midterm 25, final 40")
            }
            variant="secondary"
          >
            Try sample
          </Button>
          <Button
            disabled={isExtracting}
            onClick={() => void runExtraction(quickText, "quick")}
          >
            <Wand2 aria-hidden="true" className="h-4 w-4" />
            Auto-detect
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
                ? "bg-teal-600 text-[color:var(--accent-on)]"
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
        <div className="mt-5 space-y-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                PDF syllabus
              </span>
              <input
                accept="application/pdf"
                className="mt-1 block w-full rounded-[3px] border border-dashed border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-900 file:mr-3 file:rounded-[3px] file:border-0 file:bg-teal-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-50"
                disabled={isExtracting}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <span className="mt-2 block text-[11px] text-ink-500">
                PDFs are read locally and not stored. Only reviewed course data is saved.
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

          {pdfPreview ? (
            <details className="rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
              <summary className="cursor-pointer font-medium text-ink-800">
                Extracted text preview
              </summary>
              {pdfPreview.warning ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  {pdfPreview.warning}
                </p>
              ) : null}
              <p className="mt-3 text-xs font-medium text-ink-500">
                {pdfPreview.fileName}
              </p>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs leading-5 text-ink-600">
                {pdfPreview.text || "No text was extracted."}
              </pre>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
              Syllabus text
            </span>
            <textarea
              className="gm-textarea mt-1 min-h-44"
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

      {pendingFeedback ? (
        <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink-900">
                Help GradeMate improve
              </p>
              <p className="mt-1 text-sm text-ink-600">
                Was this extraction correct?
              </p>
              <label className="mt-3 flex items-center gap-2 text-xs text-ink-600">
                <input
                  checked={pendingFeedback.includeExtractedText}
                  className="h-4 w-4 rounded border-ink-300 text-teal-700"
                  onChange={(event) =>
                    setPendingFeedback((current) =>
                      current
                        ? {
                            ...current,
                            includeExtractedText: event.target.checked
                          }
                        : current
                    )
                  }
                  type="checkbox"
                />
                Include extracted syllabus text to help improve detection
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void sendExtractionFeedback("correct")}
                size="sm"
              >
                Yes, looks correct
              </Button>
              <Button
                onClick={() => void sendExtractionFeedback("corrected")}
                size="sm"
                variant="secondary"
              >
                I corrected it
              </Button>
              <Button
                onClick={() => void sendExtractionFeedback("incorrect")}
                size="sm"
                variant="secondary"
              >
                No, needs improvement
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {extraction ? (
        <div className="mt-5 space-y-4 border border-ink-200 bg-white/90 p-4">
          <div>
            <div>
              <h3 className="text-[28px] font-bold leading-tight text-ink-900">
                Review Extraction
              </h3>
              <p className="mt-2 text-sm text-ink-700">
                Syllabus processed locally. Review before saving.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            <CheckCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <p>
              Syllabus successfully processed locally. {reviewRows.length} grading milestones identified.
            </p>
            <p className="ml-auto hidden text-xs font-medium sm:block">
              PDFs are read locally and not stored.
            </p>
          </div>
          <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
            Always confirm grading details with your official course syllabus.
          </p>
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
              tone={extractionSource === "pdf" ? "teal" : "ink"}
            >
              {getExtractionSourceLabel(extractionSource)}
            </Badge>
            <Badge tone={getExtractionQualityTone(extraction)}>
              {getExtractionQualityLabel(extraction)}
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

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">Warnings</p>
            {extraction.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {extraction.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">No warnings detected.</p>
            )}
          </div>

          {courseInfoRows.length > 0 ? (
            <div className="rounded-lg border border-ink-200 bg-white p-4">
              <h3 className="font-semibold text-ink-900">
                Course info suggestions
              </h3>
              <p className="mt-1 text-sm text-ink-500">
                Select fields to apply. Existing course details only change if
                you keep the checkbox on.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {courseInfoRows.map((row) => {
                  const confidenceInfo = getConfidenceInfo(row.confidence ?? 0);
                  const courseValues = course as Record<string, unknown>;
                  const oldValue = String(
                    row.key === "credit_hours"
                      ? course.credit_hours
                      : (courseValues[row.key] ?? "")
                  );
                  const willReplace =
                    row.apply &&
                    oldValue.trim() &&
                    row.value.trim() &&
                    oldValue.trim() !== row.value.trim();

                  return (
                    <label
                      className="rounded-lg border border-ink-200 bg-ink-50 p-3"
                      key={row.key}
                    >
                      <span className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
                        <span className="inline-flex items-center gap-2">
                          <input
                            checked={row.apply}
                            onChange={(event) =>
                              updateCourseInfoRow(row.key, {
                                apply: event.target.checked
                              })
                            }
                            type="checkbox"
                          />
                          {row.label}
                        </span>
                        <Badge tone={confidenceInfo.tone}>
                          {confidenceInfo.label}
                        </Badge>
                      </span>
                      <input
                        className={inputStyles}
                        onChange={(event) =>
                          updateCourseInfoRow(row.key, {
                            value: event.target.value
                          })
                        }
                        value={row.value}
                      />
                      {willReplace ? (
                        <p className="mt-2 text-xs text-amber-700">
                          This will replace {oldValue} with {row.value}.
                        </p>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {hasExistingAssessments && reviewRows.length > 0 ? (
            <p className="rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
              This course already has assessments. Choose whether to replace
              them or append only new names.
            </p>
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
              <table className="gm-table min-w-[980px]">
                <thead className="bg-ink-100 text-[11px] uppercase tracking-[0.06em] text-ink-500">
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
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={confidenceInfo.tone}>
                              {confidenceInfo.label}
                            </Badge>
                            {row.inferred ? <Badge tone="gold">Inferred</Badge> : null}
                            {row.warning ? <Badge tone="gold">Warning</Badge> : null}
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
                            {row.warning ? (
                              <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                {row.warning}
                              </p>
                            ) : null}
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

          <div className="flex flex-col gap-3 border-t border-ink-200 bg-ink-100/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-700">
                Total weight check
              </p>
              <p className="mt-1 text-[26px] font-bold leading-none text-teal-300">
                {formatWeightDelta(reviewTotalWeight)}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
            <Button onClick={addReviewRow} variant="secondary">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add row
            </Button>
            <Button
              onClick={() => {
                clearResults();
                if (extractionSource === "pdf") {
                  setActiveTab("upload");
                }
              }}
              variant="secondary"
            >
              Re-upload
            </Button>
            {reviewRows.length === 0 ? (
              <Button onClick={clearResults} variant="ghost">
                Cancel
              </Button>
            ) : hasExistingAssessments ? (
              <>
                <Button
                  disabled={isSavingExtraction}
                  onClick={() => void saveExtractedAssessments("append")}
                >
                  Confirm & Save
                </Button>
                <Button
                  disabled={isSavingExtraction}
                  onClick={() => void saveExtractedAssessments("replace")}
                  variant="secondary"
                >
                  Replace existing
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
                  Confirm & Save
                </Button>
                <Button onClick={clearResults} variant="ghost">
                  Cancel
                </Button>
              </>
            )}
            </div>
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
  const [activeTab, setActiveTab] = useState<CourseDetailTab>("assessments");
  const [isAssessmentFormOpen, setIsAssessmentFormOpen] = useState(false);
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
  const sortedAssessments = useMemo(
    () =>
      [...assessments].sort(
        (first, second) =>
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime()
      ),
    [assessments]
  );
  const plannerAssessments = useMemo(
    () => getCoursePlannerAssessments(sortedAssessments),
    [sortedAssessments]
  );
  const hasCourseDetails = [
    course?.instructor,
    course?.instructor_email,
    course?.term,
    course?.schedule,
    course?.classroom,
    course?.office_hours,
    course?.prerequisites,
    course?.description
  ].some(Boolean) || (Array.isArray(course?.textbooks) && course.textbooks.length > 0);

  function updateAssessmentForm(field: keyof AssessmentForm, value: string) {
    setAssessmentForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetAssessmentForm() {
    setAssessmentForm(defaultAssessmentForm);
    setEditingAssessmentId(null);
    setIsAssessmentFormOpen(false);
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

    const writePayload = editingAssessmentId
      ? payload
      : {
          ...payload,
          user_id: user.id,
          course_id: course.id
        };
    let response = editingAssessmentId
      ? await supabase
          .from("assessments")
          .update(writePayload)
          .eq("id", editingAssessmentId)
          .eq("user_id", user.id)
          .select()
          .single()
      : await supabase
          .from("assessments")
          .insert(writePayload)
          .select()
          .single();

    if (isMissingAssessmentOptionalColumnError(response.error)) {
      const corePayload = getCoreAssessmentPayload(writePayload);

      response = editingAssessmentId
        ? await supabase
            .from("assessments")
            .update(corePayload)
            .eq("id", editingAssessmentId)
            .eq("user_id", user.id)
            .select()
            .single()
        : await supabase
            .from("assessments")
            .insert(corePayload)
            .select()
            .single();
    }

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
    setIsAssessmentFormOpen(true);
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

  const detailTabs: {
    id: CourseDetailTab;
    label: string;
    icon: typeof Layers3;
  }[] = [
    { id: "assessments", label: "Assessments", icon: Layers3 },
    { id: "planner", label: "Planner", icon: Target },
    { id: "extractor", label: "Syllabus", icon: Wand2 },
    { id: "details", label: "Details", icon: Info }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className={buttonStyles({ variant: "secondary" })} href="/semesters">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back
            </Link>
            <Button
              onClick={() => {
                setActiveTab("assessments");
                resetAssessmentForm();
                setIsAssessmentFormOpen(true);
              }}
            >
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add assessment
            </Button>
            <Button onClick={() => setActiveTab("extractor")} variant="secondary">
              <Wand2 aria-hidden="true" className="h-4 w-4" />
              Scan syllabus
            </Button>
          </div>
        }
        description={semester?.name ?? "Track this course without the clutter."}
        eyebrow={course.code || "Course"}
        title={course.name}
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Credits", Number(course.credit_hours), "Course workload"],
          [
            "Current grade",
            formatPercent(gradeSummary.currentGrade),
            `${gradeSummary.completedWeight}% completed`
          ],
          ["Completed weight", `${gradeSummary.completedWeight}%`, "Scored so far"],
          ["Remaining weight", `${gradeSummary.unscoredWeight}%`, "Unscored work"]
        ].map(([label, value, helper]) => (
          <Card className="p-4" key={label}>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-300">{label}</p>
            <p className="mt-2 text-[26px] font-bold leading-none text-ink-900">
              {value}
            </p>
            <p className="mt-1 text-xs text-ink-500">{helper}</p>
          </Card>
        ))}
      </section>

      <Card className="p-1.5">
        <div className="flex gap-1 overflow-x-auto">
          {detailTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                className={`flex min-w-fit items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-teal-600 text-[color:var(--accent-on)]"
                    : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {activeTab === "assessments" ? (
        <section
          className={`grid gap-5 ${
            isAssessmentFormOpen || editingAssessmentId
              ? "xl:grid-cols-[minmax(0,1fr)_23rem]"
              : ""
          }`}
        >
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-ink-200 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Assessments
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Scores and weights stay in one focused list.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={weightReadiness.tone}>
                  {gradeSummary.totalWeight}% total
                </Badge>
                <Button
                  onClick={() => {
                    resetAssessmentForm();
                    setIsAssessmentFormOpen(true);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  <PlusCircle aria-hidden="true" className="h-4 w-4" />
                  Add row
                </Button>
              </div>
            </div>

            {sortedAssessments.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        onClick={() => {
                          resetAssessmentForm();
                          setIsAssessmentFormOpen(true);
                        }}
                        variant="secondary"
                      >
                        <PlusCircle aria-hidden="true" className="h-4 w-4" />
                        Add manually
                      </Button>
                      <Button onClick={() => setActiveTab("extractor")}>
                        <Wand2 aria-hidden="true" className="h-4 w-4" />
                        Scan syllabus
                      </Button>
                    </div>
                  }
                  description="Add one manually or scan your syllabus to unlock predictions."
                  icon={<Layers3 aria-hidden="true" className="h-5 w-5" />}
                  title="No assessments yet"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="gm-table min-w-[820px]">
                  <thead className="border-b border-ink-200 bg-ink-50 text-[11px] uppercase tracking-[0.06em] text-ink-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Assessment</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Weight</th>
                      <th className="px-5 py-3 font-semibold">Score</th>
                      <th className="px-5 py-3 font-semibold">Contribution</th>
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {sortedAssessments.map((assessment) => {
                      const status = getAssessmentStatus(assessment);
                      const contribution = getWeightedContribution(assessment);
                      const maxScore = getAssessmentMaxScore(assessment);

                      return (
                        <tr className="hover:bg-ink-50/60" key={assessment.id}>
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
                            {assessment.score == null || maxScore == null
                              ? "Not scored"
                              : `${Number(assessment.score)} / ${Number(maxScore)}`}
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

          {isAssessmentFormOpen || editingAssessmentId ? (
          <Card className="p-5" id="add-assessment">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {editingAssessmentId ? "Edit assessment" : "Add assessment"}
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Keep it quick: name, weight, score.
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
                    : "Enter score and max score to preview the contribution."}
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
          ) : null}
        </section>
      ) : null}

      {activeTab === "planner" ? (
        <GradePlannerPanel
          assessments={plannerAssessments}
          courseName={course.name}
          onAddAssessments={() => {
            setActiveTab("assessments");
            setIsAssessmentFormOpen(true);
          }}
          onScanSyllabus={() => setActiveTab("extractor")}
          onTargetGradeChange={setTargetGrade}
          targetGrade={targetGrade}
        />
      ) : null}

      {activeTab === "extractor" ? (
        <SmartSyllabusExtractor
          assessments={assessments}
          course={course}
          isGuest={isGuest}
          onCourseUpdated={setCourse}
          onSaved={handleExtractedAssessmentsSaved}
        />
      ) : null}

      {activeTab === "details" ? (
        <Card className="p-5">
          {hasCourseDetails ? (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                <CalendarDays aria-hidden="true" className="h-4 w-4" />
                Course details
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  ["Instructor", course.instructor],
                  ["Email", course.instructor_email],
                  ["Semester", course.term],
                  ["Schedule", course.schedule],
                  ["Classroom", course.classroom],
                  ["Office hours", course.office_hours],
                  ["Prerequisites", course.prerequisites]
                ].map(([label, value]) =>
                  value ? (
                    <div className="rounded-lg bg-ink-100/70 p-3 text-sm" key={label}>
                      <p className="text-ink-500">{label}</p>
                      <p className="mt-1 font-medium text-ink-900">{value}</p>
                    </div>
                  ) : null
                )}
              </div>
              {Array.isArray(course.textbooks) && course.textbooks.length > 0 ? (
                <div className="mt-3 rounded-lg bg-ink-100/70 p-3 text-sm">
                  <p className="text-ink-500">Textbooks</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {course.textbooks.map((textbook) => (
                      <li key={String(textbook)}>{String(textbook)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {course.description ? (
                <p className="mt-3 rounded-lg bg-ink-100/70 p-3 text-sm leading-6 text-ink-700">
                  {course.description}
                </p>
              ) : null}
            </>
          ) : (
            <EmptyState
              description="Scan a syllabus to auto-fill instructor, schedule, office hours, textbooks, and description."
              icon={<Info aria-hidden="true" className="h-5 w-5" />}
              title="No extra course details yet"
            />
          )}
        </Card>
      ) : null}
    </div>
  );
}
