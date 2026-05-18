"use client";

import {
  BookOpen,
  ClipboardPaste,
  Download,
  FileText,
  FileUp,
  GraduationCap,
  PlusCircle,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import { ModeSwitch } from "@/components/navigation/mode-switch";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import {
  extractGradeBreakdown,
  type ExtractedAssessment,
  type ExtractedSyllabus
} from "@/lib/syllabus/extractSyllabus";
import { extractTextFromPdfFile } from "@/lib/syllabus/pdfText";
import {
  readGuestVerifiedExtractions,
  saveVerifiedExtraction,
  type VerifiedExtractionFeedback,
  type VerifiedExtractionSource
} from "@/lib/syllabus/verified-extractions";
import {
  getGradeInfo,
  getGradePoint,
  getLetterGrade,
  gradeScale,
  type LetterGrade
} from "@/lib/grading";
import type {
  CourseTemplateAssessmentRecord,
  CourseTemplateRecord
} from "@/types/database";

type GradeSource = "calculated" | "manual";
type ExtractionSource = "quick" | "paste" | "pdf" | "online-ai";

type SimpleAssessment = {
  id: string;
  name: string;
  weightPercentage: string;
  score: string;
  maxScore: string;
  confidence?: number;
  sourceTextSnippet?: string;
};

type SimpleCourse = {
  id: string;
  code: string;
  name: string;
  creditHours: string;
  letterGrade: LetterGrade;
  gradeSource: GradeSource;
  assessments: SimpleAssessment[];
  instructor?: string;
  instructorEmail?: string;
  semester?: string;
  schedule?: string;
  classroom?: string;
  officeHours?: string;
  prerequisites?: string;
  textbooks?: string[];
  courseDescription?: string;
};

type SimpleGpaData = {
  existingCgpa: string;
  completedHours: string;
  courses: SimpleCourse[];
};

type ReviewAssessment = ExtractedAssessment & {
  id: string;
};

type ReviewState = {
  courseId: string;
  extraction: ExtractedSyllabus;
  courseInfo: CourseInfoReviewField[];
  rows: ReviewAssessment[];
  source: ExtractionSource;
};

type CourseInfoReviewField = {
  key: keyof Pick<
    SimpleCourse,
    | "classroom"
    | "code"
    | "courseDescription"
    | "creditHours"
    | "instructor"
    | "instructorEmail"
    | "name"
    | "officeHours"
    | "prerequisites"
    | "schedule"
    | "semester"
  >;
  label: string;
  value: string;
  apply: boolean;
  confidence?: number;
};

type PendingFeedback = {
  extraction: ExtractedSyllabus;
  source: ExtractionSource;
  courseName: string;
};

type PredictorState = {
  selectedAssessmentId: string;
  targetGrade: string;
};

type SimpleTemplate = CourseTemplateRecord & {
  assessments: CourseTemplateAssessmentRecord[];
};

type PdfPreview = {
  fileName: string;
  text: string;
  warning?: string;
};

const simpleStorageKey = "grademate_simple_gpa";
const sampleBreakdown = "quizzes 15, assignments 20, midterm 25, final 40";
const inputStyles =
  "h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";
const textareaStyles =
  "w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

const defaultCourse: Omit<SimpleCourse, "id"> = {
  assessments: [],
  code: "",
  creditHours: "3",
  gradeSource: "manual",
  letterGrade: "A",
  name: ""
};

function createSimpleId(prefix = "simple") {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isLetterGrade(value: unknown): value is LetterGrade {
  return gradeScale.some((grade) => grade.letter === value);
}

function createAssessment(
  assessment?: Partial<SimpleAssessment>
): SimpleAssessment {
  return {
    confidence: assessment?.confidence,
    id: assessment?.id ?? createSimpleId("assessment"),
    maxScore: assessment?.maxScore ?? "100",
    name: assessment?.name ?? "Assessment",
    score: assessment?.score ?? "",
    sourceTextSnippet: assessment?.sourceTextSnippet,
    weightPercentage: assessment?.weightPercentage ?? "0"
  };
}

function createCourse(course?: Partial<SimpleCourse>): SimpleCourse {
  const assessments = Array.isArray(course?.assessments)
    ? course.assessments.map((assessment) => createAssessment(assessment))
    : [];

  return {
    id: course?.id ?? createSimpleId("course"),
    ...defaultCourse,
    ...course,
    assessments,
    gradeSource:
      course?.gradeSource === "calculated" || course?.gradeSource === "manual"
        ? course.gradeSource
        : assessments.length > 0
          ? "calculated"
          : "manual",
    letterGrade: isLetterGrade(course?.letterGrade) ? course.letterGrade : "A"
  };
}

function getDefaultData(): SimpleGpaData {
  return {
    completedHours: "",
    courses: [createCourse()],
    existingCgpa: ""
  };
}

function parsePositiveNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function parseOptionalNonNegativeNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function formatGpa(value: number | null) {
  return value === null || Number.isNaN(value) ? "--" : value.toFixed(2);
}

function formatPercent(value: number | null) {
  return value === null || Number.isNaN(value) ? "--" : `${value.toFixed(1)}%`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getConfidenceInfo(confidence = 0.5) {
  if (confidence >= 0.8) {
    return { label: "High", tone: "green" as const };
  }

  if (confidence >= 0.6) {
    return { label: "Medium", tone: "gold" as const };
  }

  return { label: "Low", tone: "rose" as const };
}

function getExtractionSourceLabel(source: ExtractionSource) {
  if (source === "online-ai") {
    return "Improved with online AI";
  }

  if (source === "pdf") {
    return "Extracted from PDF";
  }

  return "Detected automatically";
}

function getExtractionQualityLabel(
  extraction: ExtractedSyllabus,
  source: ExtractionSource
) {
  if (source === "online-ai") {
    return "Improved with online AI";
  }

  return shouldUseRuleExtraction(extraction)
    ? "Detected automatically"
    : "Needs review";
}

function getExtractionQualityTone(
  extraction: ExtractedSyllabus,
  source: ExtractionSource
) {
  if (source === "online-ai") {
    return "teal" as const;
  }

  return shouldUseRuleExtraction(extraction) ? ("green" as const) : ("gold" as const);
}

function makeReviewRows(extraction: ExtractedSyllabus): ReviewAssessment[] {
  return extraction.assessments.map((assessment) => ({
    ...assessment,
    id: createSimpleId("review")
  }));
}

function makeCourseInfoReviewFields(
  extraction: ExtractedSyllabus
): CourseInfoReviewField[] {
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
      key: "creditHours",
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
      key: "instructorEmail",
      label: "Instructor email",
      value: extraction.instructorEmail ?? "",
      confidence: extraction.fieldConfidence?.instructorEmail
    },
    {
      key: "semester",
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
      key: "officeHours",
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
      key: "courseDescription",
      label: "Course description",
      value: extraction.courseDescription ?? "",
      confidence: extraction.fieldConfidence?.courseDescription
    }
  ];

  return fields
    .filter((field) => field.value.trim())
    .map((field) => ({ ...field, apply: true }));
}

function getReviewTotalWeight(rows: ReviewAssessment[]) {
  return rows.reduce((sum, row) => sum + Number(row.weight_percentage || 0), 0);
}

function isWeightReady(totalWeight: number) {
  return totalWeight >= 99.5 && totalWeight <= 100.5;
}

function getWeightText(totalWeight: number) {
  if (isWeightReady(totalWeight)) {
    return "Weight total: 100% ready";
  }

  if (totalWeight < 100) {
    return `Missing ${(100 - totalWeight).toFixed(1)}%`;
  }

  return `Over by ${(totalWeight - 100).toFixed(1)}%`;
}

function getExtractionTotalWeight(extraction: ExtractedSyllabus) {
  return extraction.assessments.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage || 0),
    0
  );
}

function shouldUseRuleExtraction(extraction: ExtractedSyllabus) {
  const totalWeight = getExtractionTotalWeight(extraction);
  const hasUnclearWarning = extraction.warnings.some((warning) =>
    /unclear|low confidence|no assessments/i.test(warning)
  );

  return (
    extraction.assessments.length > 0 &&
    extraction.confidence >= 0.72 &&
    isWeightReady(totalWeight) &&
    !hasUnclearWarning
  );
}

function isOnlineAiEnabled() {
  return (
    process.env.NEXT_PUBLIC_ONLINE_AI_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_AI_PROVIDER === "supabase-edge"
  );
}

async function getFunctionErrorMessage(error: unknown) {
  const fallback =
    "Online AI assist is unavailable. You can still review the automatic detection.";
  const context =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : null;
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  if (context instanceof Response) {
    const payload = (await context
      .clone()
      .json()
      .catch(() => null)) as { error?: unknown } | null;

    if (typeof payload?.error === "string") {
      const edgeMessage = payload.error;

      if (/gemini|api key|secret/i.test(edgeMessage)) {
        return "Online AI assist is missing its Gemini API key. You can still review the automatic detection.";
      }

      if (/quota|rate limit|too many requests/i.test(edgeMessage)) {
        return "Online AI assist hit its usage limit. You can still review the automatic detection.";
      }

      return edgeMessage;
    }

    if (context.status === 404) {
      return "Online AI assist is not deployed yet. You can still review the automatic detection.";
    }

    if (context.status === 401 || context.status === 403) {
      return "Online AI assist is blocked by configuration. You can still review the automatic detection.";
    }

    if (context.status === 429) {
      return "Online AI assist hit its usage limit. You can still review the automatic detection.";
    }

    if (context.status >= 500) {
      return "Online AI assist is temporarily unavailable. You can still review the automatic detection.";
    }
  }

  if (/failed to send|fetch|network|cors|load failed/i.test(rawMessage)) {
    return fallback;
  }

  if (/function.*not.*found|not deployed|404/i.test(rawMessage)) {
    return "Online AI assist is not deployed yet. You can still review the automatic detection.";
  }

  if (/quota|rate limit|too many requests/i.test(rawMessage)) {
    return "Online AI assist hit its usage limit. You can still review the automatic detection.";
  }

  if (/gemini|api key|secret/i.test(rawMessage)) {
    return "Online AI assist is missing its Gemini API key. You can still review the automatic detection.";
  }

  return fallback;
}

function logOnlineAiDebug(
  stage: "attempt" | "error",
  details?: { message?: string }
) {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const config = getSupabasePublicConfig();

  console.log("Simple Mode online AI debug", {
    edgeFunction: "ai-extract-syllabus",
    errorMessage: details?.message ?? null,
    hasPublicKey: config.hasPublicKey,
    hasUrl: config.hasUrl,
    stage
  });
}

function validateExtractionPayload(payload: unknown): ExtractedSyllabus {
  if (!payload || typeof payload !== "object") {
    throw new Error(
      "AI extraction returned an invalid result. Try again or edit manually."
    );
  }

  const extraction = payload as Partial<ExtractedSyllabus>;

  if (
    !Array.isArray(extraction.assessments) ||
    !Array.isArray(extraction.warnings) ||
    typeof extraction.confidence !== "number"
  ) {
    throw new Error(
      "AI extraction returned an invalid result. Try again or edit manually."
    );
  }

  return {
    ...extraction,
    classroom: extraction.classroom ?? null,
    courseDescription: extraction.courseDescription ?? null,
    courseName: extraction.courseName ?? null,
    courseCode: extraction.courseCode ?? null,
    creditHours: extraction.creditHours ?? null,
    fieldConfidence: extraction.fieldConfidence ?? {},
    instructor: extraction.instructor ?? null,
    instructorEmail: extraction.instructorEmail ?? null,
    officeHours: extraction.officeHours ?? null,
    prerequisites: extraction.prerequisites ?? null,
    schedule: extraction.schedule ?? null,
    semester: extraction.semester ?? null,
    textbooks: extraction.textbooks ?? []
  } as ExtractedSyllabus;
}

async function requestOnlineAiExtraction(text: string) {
  if (!isOnlineAiEnabled()) {
    throw new Error(
      "Online AI assist is unavailable. You can still review the automatic detection."
    );
  }

  let supabase: ReturnType<typeof createSupabaseBrowserClient>;

  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    throw new Error(
      "Online AI assist is unavailable. You can still review the automatic detection."
    );
  }

  logOnlineAiDebug("attempt");

  const { data, error } = await supabase.functions.invoke<
    ExtractedSyllabus | { error?: string }
  >("ai-extract-syllabus", {
    body: { text }
  });

  if (error) {
    const message = await getFunctionErrorMessage(error);
    logOnlineAiDebug("error", { message });
    throw new Error(message);
  }

  if (data && "error" in data && data.error) {
    throw new Error(await getFunctionErrorMessage(new Error(data.error)));
  }

  return validateExtractionPayload(data);
}

function getCourseGradeStats(course: SimpleCourse) {
  const rows = course.assessments.map((assessment) => {
    const weight = parsePositiveNumber(assessment.weightPercentage);
    const score = parseOptionalNonNegativeNumber(assessment.score);
    const maxScore = parsePositiveNumber(assessment.maxScore);
    const isCompleted = score !== null && maxScore > 0;
    const contribution = isCompleted ? (score / maxScore) * weight : 0;

    return {
      assessment,
      contribution,
      isCompleted,
      maxScore,
      score,
      weight
    };
  });
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const completedWeight = rows.reduce(
    (sum, row) => sum + (row.isCompleted ? row.weight : 0),
    0
  );
  const completedPoints = rows.reduce(
    (sum, row) => sum + row.contribution,
    0
  );
  const remainingWeight = rows.reduce(
    (sum, row) => sum + (!row.isCompleted ? row.weight : 0),
    0
  );
  const currentGrade =
    completedWeight > 0 ? (completedPoints / completedWeight) * 100 : null;
  const calculatedLetter =
    currentGrade === null ? null : getLetterGrade(currentGrade);

  return {
    bestPossibleGrade: completedPoints + remainingWeight,
    calculatedLetter,
    completedPoints,
    completedWeight,
    currentGrade,
    projectedFinalGrade: completedPoints,
    remainingWeight,
    rows,
    totalWeight
  };
}

function getEffectiveLetterGrade(course: SimpleCourse) {
  const stats = getCourseGradeStats(course);

  if (course.gradeSource === "calculated" && stats.calculatedLetter) {
    return stats.calculatedLetter;
  }

  return course.letterGrade;
}

function getCourseQualityPoints(course: SimpleCourse) {
  return (
    parsePositiveNumber(course.creditHours) *
    getGradePoint(getEffectiveLetterGrade(course))
  );
}

function getVerifiedSource(source: ExtractionSource): VerifiedExtractionSource {
  if (source === "pdf") return "pdf";
  if (source === "paste" || source === "online-ai") return "pasted_text";
  return "quick_add";
}

function buildConfirmedExtraction(
  extraction: ExtractedSyllabus,
  rows: ReviewAssessment[]
): ExtractedSyllabus {
  return {
    ...extraction,
    assessments: rows.map((row) => ({
      confidence: Number(row.confidence) || 0.7,
      max_score: Number(row.max_score) || 100,
      name: row.name.trim(),
      source_text_snippet: row.source_text_snippet,
      weight_percentage: Number(row.weight_percentage) || 0
    }))
  };
}

function sanitizeImportedData(value: unknown): SimpleGpaData {
  if (!value || typeof value !== "object") {
    throw new Error("That file does not look like GradeMate Simple data.");
  }

  const data = value as Partial<SimpleGpaData>;
  const courses = Array.isArray(data.courses)
    ? data.courses.map((course) =>
        createCourse({
          assessments: Array.isArray(course.assessments)
            ? course.assessments.map((assessment) =>
                createAssessment({
                  confidence:
                    typeof assessment.confidence === "number"
                      ? assessment.confidence
                      : undefined,
                  id:
                    typeof assessment.id === "string"
                      ? assessment.id
                      : createSimpleId("assessment"),
                  maxScore:
                    typeof assessment.maxScore === "string"
                      ? assessment.maxScore
                      : String(assessment.maxScore ?? "100"),
                  name:
                    typeof assessment.name === "string"
                      ? assessment.name
                      : "Assessment",
                  score:
                    typeof assessment.score === "string"
                      ? assessment.score
                      : String(assessment.score ?? ""),
                  sourceTextSnippet:
                    typeof assessment.sourceTextSnippet === "string"
                      ? assessment.sourceTextSnippet
                      : undefined,
                  weightPercentage:
                    typeof assessment.weightPercentage === "string"
                      ? assessment.weightPercentage
                      : String(assessment.weightPercentage ?? "0")
                })
            )
            : [],
          code: typeof course.code === "string" ? course.code : "",
          creditHours:
            typeof course.creditHours === "string"
              ? course.creditHours
              : String(course.creditHours ?? "3"),
          gradeSource:
            course.gradeSource === "calculated" || course.gradeSource === "manual"
              ? course.gradeSource
              : undefined,
          id: typeof course.id === "string" ? course.id : createSimpleId("course"),
          instructor:
            typeof course.instructor === "string" ? course.instructor : "",
          instructorEmail:
            typeof course.instructorEmail === "string"
              ? course.instructorEmail
              : "",
          letterGrade: isLetterGrade(course.letterGrade)
            ? course.letterGrade
            : "A",
          name: typeof course.name === "string" ? course.name : "",
          semester: typeof course.semester === "string" ? course.semester : "",
          schedule: typeof course.schedule === "string" ? course.schedule : "",
          classroom: typeof course.classroom === "string" ? course.classroom : "",
          officeHours:
            typeof course.officeHours === "string" ? course.officeHours : "",
          prerequisites:
            typeof course.prerequisites === "string" ? course.prerequisites : "",
          textbooks: Array.isArray(course.textbooks)
            ? course.textbooks.filter((item): item is string => typeof item === "string")
            : [],
          courseDescription:
            typeof course.courseDescription === "string"
              ? course.courseDescription
              : ""
        })
      )
    : [];

  return {
    completedHours:
      typeof data.completedHours === "string" ? data.completedHours : "",
    courses: courses.length > 0 ? courses : [createCourse()],
    existingCgpa: typeof data.existingCgpa === "string" ? data.existingCgpa : ""
  };
}

function readStoredData(): SimpleGpaData {
  if (typeof window === "undefined") {
    return getDefaultData();
  }

  const rawData = window.localStorage.getItem(simpleStorageKey);

  if (!rawData) {
    return getDefaultData();
  }

  try {
    return sanitizeImportedData(JSON.parse(rawData));
  } catch {
    return getDefaultData();
  }
}

export function SimpleGpaCalculator() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<SimpleGpaData>(() => getDefaultData());
  const [isLoaded, setIsLoaded] = useState(false);
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [quickTextByCourse, setQuickTextByCourse] = useState<
    Record<string, string>
  >({});
  const [syllabusTextByCourse, setSyllabusTextByCourse] = useState<
    Record<string, string>
  >({});
  const [pdfFileByCourse, setPdfFileByCourse] = useState<
    Record<string, File | null>
  >({});
  const [pdfPreviewByCourse, setPdfPreviewByCourse] = useState<
    Record<string, PdfPreview>
  >({});
  const [review, setReview] = useState<ReviewState | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(
    null
  );
  const [isExtractingCourseId, setIsExtractingCourseId] = useState<string | null>(
    null
  );
  const [predictors, setPredictors] = useState<
    Record<string, PredictorState>
  >({});
  const [courseSearch, setCourseSearch] = useState("");
  const [libraryTemplates, setLibraryTemplates] = useState<SimpleTemplate[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [libraryError, setLibraryError] = useState("");

  useEffect(() => {
    setData(readStoredData());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(simpleStorageKey, JSON.stringify(data));
  }, [data, isLoaded]);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      const config = getSupabasePublicConfig();

      if (process.env.NODE_ENV === "development") {
        console.log("Simple Mode course library debug", {
          hasPublicKey: config.hasPublicKey,
          hasUrl: config.hasUrl
        });
      }

      if (!config.isConfigured) {
        if (isMounted) {
          setLibraryError(
            "Course Library unavailable. You can still add a course manually."
          );
          setIsLoadingLibrary(false);
        }
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const [templatesResponse, assessmentsResponse] = await Promise.all([
          supabase
            .from("course_templates")
            .select("*")
            .or(
              "source_syllabus_path.not.is.null,source_syllabus_file_name.not.is.null,source_file_name.not.is.null"
            )
            .order("course_code", { ascending: true }),
          supabase
            .from("course_template_assessments")
            .select("*")
            .order("created_at", { ascending: true })
        ]);

        if (templatesResponse.error || assessmentsResponse.error) {
          throw new Error(
            templatesResponse.error?.message ??
              assessmentsResponse.error?.message ??
              "Could not load course templates."
          );
        }

        const assessmentRows =
          (assessmentsResponse.data ?? []) as CourseTemplateAssessmentRecord[];
        const templates = ((templatesResponse.data ?? []) as CourseTemplateRecord[])
          .map((template) => ({
            ...template,
            assessments: assessmentRows.filter(
              (assessment) => assessment.course_template_id === template.id
            )
          }));

        if (isMounted) {
          setLibraryTemplates(templates);
          setLibraryError("");
          setIsLoadingLibrary(false);
        }
      } catch (loadError) {
        if (process.env.NODE_ENV === "development") {
          console.log("Simple Mode course library error", {
            message:
              loadError instanceof Error ? loadError.message : "Unknown error"
          });
        }

        if (isMounted) {
          setLibraryError(
            "Course Library unavailable. You can still add a course manually."
          );
          setIsLoadingLibrary(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const semesterHours = data.courses.reduce(
      (sum, course) => sum + parsePositiveNumber(course.creditHours),
      0
    );
    const semesterQualityPoints = data.courses.reduce(
      (sum, course) => sum + getCourseQualityPoints(course),
      0
    );
    const semesterGpa =
      semesterHours > 0 ? semesterQualityPoints / semesterHours : null;
    const existingCgpa = Number(data.existingCgpa);
    const completedHours = parsePositiveNumber(data.completedHours);
    const hasExistingGpa =
      Number.isFinite(existingCgpa) && existingCgpa >= 0 && existingCgpa <= 4;
    const cumulativeHours = completedHours + semesterHours;
    const cumulativeGpa =
      hasExistingGpa && cumulativeHours > 0
        ? (existingCgpa * completedHours + semesterQualityPoints) /
          cumulativeHours
        : semesterGpa;

    return {
      cumulativeGpa,
      cumulativeHours,
      semesterGpa,
      semesterHours,
      semesterQualityPoints
    };
  }, [data]);

  const courseSearchResults = useMemo(() => {
    const normalizedQuery = courseSearch.trim().toLowerCase();

    if (!normalizedQuery) {
      return {
        localCourses: [] as SimpleCourse[],
        templates: [] as SimpleTemplate[]
      };
    }

    return {
      localCourses: data.courses
        .filter((course) =>
          [course.code, course.name]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        )
        .slice(0, 5),
      templates: libraryTemplates
        .filter((template) =>
          [template.course_code, template.course_name]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        )
        .slice(0, 8)
    };
  }, [courseSearch, data.courses, libraryTemplates]);

  function resetNotices() {
    setMessage("");
    setError("");
  }

  function updateData(nextData: Partial<SimpleGpaData>) {
    setData((current) => ({
      ...current,
      ...nextData
    }));
    resetNotices();
  }

  function updateCourse(
    courseId: string,
    field: keyof Omit<SimpleCourse, "id" | "assessments">,
    value: string
  ) {
    setData((current) => ({
      ...current,
      courses: current.courses.map((course) => {
        if (course.id !== courseId) {
          return course;
        }

        if (field === "letterGrade") {
          return {
            ...course,
            letterGrade: isLetterGrade(value) ? value : course.letterGrade
          };
        }

        if (field === "gradeSource") {
          return {
            ...course,
            gradeSource: value === "calculated" ? "calculated" : "manual"
          };
        }

        return {
          ...course,
          [field]: value
        };
      })
    }));
    resetNotices();
  }

  function updateCourseAssessments(
    courseId: string,
    updater: (assessments: SimpleAssessment[]) => SimpleAssessment[]
  ) {
    setData((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? {
              ...course,
              assessments: updater(course.assessments),
              gradeSource: "calculated"
            }
          : course
      )
    }));
    resetNotices();
  }

  function updateAssessment(
    courseId: string,
    assessmentId: string,
    field: keyof Pick<
      SimpleAssessment,
      "maxScore" | "name" | "score" | "weightPercentage"
    >,
    value: string
  ) {
    updateCourseAssessments(courseId, (assessments) =>
      assessments.map((assessment) =>
        assessment.id === assessmentId
          ? {
              ...assessment,
              [field]: value
            }
          : assessment
      )
    );
  }

  function addCourse(course?: Partial<SimpleCourse>) {
    const newCourse = createCourse(course);

    setData((current) => ({
      ...current,
      courses: [...current.courses, newCourse]
    }));
    setMessage(
      course?.name ? `Added ${course.name} to the calculator.` : ""
    );
    setError("");
  }

  function removeCourse(courseId: string) {
    setData((current) => {
      const courses = current.courses.filter((course) => course.id !== courseId);
      return {
        ...current,
        courses: courses.length > 0 ? courses : [createCourse()]
      };
    });
    setReview((current) => (current?.courseId === courseId ? null : current));
    setPdfPreviewByCourse((current) => {
      const next = { ...current };
      delete next[courseId];
      return next;
    });
  }

  function addTemplateToCalculator(template: SimpleTemplate) {
    addCourse({
      assessments: template.assessments.map((assessment) =>
        createAssessment({
          confidence: Number(assessment.confidence) || 0.8,
          maxScore: String(Number(assessment.max_score) || 100),
          name: assessment.name,
          score: "",
          sourceTextSnippet: assessment.source_text_snippet ?? undefined,
          weightPercentage: String(Number(assessment.weight_percentage) || 0)
        })
      ),
      code: template.course_code,
      creditHours: String(Number(template.credit_hours) || 3),
      gradeSource: template.assessments.length > 0 ? "calculated" : "manual",
      name: template.course_name
    });
  }

  function duplicateLocalCourse(course: SimpleCourse) {
    addCourse({
      ...course,
      assessments: course.assessments.map((assessment) =>
        createAssessment({
          ...assessment,
          id: createSimpleId("assessment")
        })
      ),
      id: createSimpleId("course"),
      name: course.name ? `${course.name} copy` : "Course copy"
    });
  }

  function addAssessment(courseId: string) {
    updateCourseAssessments(courseId, (assessments) => [
      ...assessments,
      createAssessment()
    ]);
  }

  function removeAssessment(courseId: string, assessmentId: string) {
    updateCourseAssessments(courseId, (assessments) =>
      assessments.filter((assessment) => assessment.id !== assessmentId)
    );
  }

  function exportData() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...data,
            verifiedExtractions: readGuestVerifiedExtractions()
          },
          null,
          2
        )
      ],
      {
      type: "application/json"
      }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "grademate-simple-gpa.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Exported your quick calculator data.");
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const importedData = sanitizeImportedData(JSON.parse(text));
      setData(importedData);
      setImportText("");
      setMessage("Imported your quick calculator data.");
      setError("");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import that file."
      );
    }
  }

  function importFromText() {
    try {
      const importedData = sanitizeImportedData(JSON.parse(importText));
      setData(importedData);
      setImportText("");
      setMessage("Imported your quick calculator data.");
      setError("");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Paste a valid GradeMate Simple export."
      );
    }
  }

  function updateCourseText(
    setter: Dispatch<SetStateAction<Record<string, string>>>,
    courseId: string,
    value: string
  ) {
    setter((current) => ({
      ...current,
      [courseId]: value
    }));
  }

  function showExtractionResult(
    courseId: string,
    extraction: ExtractedSyllabus,
    source: ExtractionSource
  ) {
    setReview({
      courseId,
      courseInfo: makeCourseInfoReviewFields(extraction),
      extraction,
      rows: makeReviewRows(extraction),
      source
    });
    setMessage(
      extraction.assessments.length > 0
        ? `${getExtractionSourceLabel(source)}. Review the grading items before saving.`
        : "No grading breakdown found. Paste the grading/evaluation section or edit manually."
    );
    setError("");
  }

  async function runExtractionPipeline(
    courseId: string,
    text: string,
    mode: "quick" | "syllabus",
    ruleSource: ExtractionSource
  ) {
    const ruleResult = extractGradeBreakdown(text, { mode });

    if (shouldUseRuleExtraction(ruleResult)) {
      showExtractionResult(courseId, ruleResult, ruleSource);
      return;
    }

    if (isOnlineAiEnabled()) {
      try {
        const aiResult = await requestOnlineAiExtraction(text);
        showExtractionResult(courseId, aiResult, "online-ai");
        return;
      } catch (aiError) {
        showExtractionResult(courseId, ruleResult, ruleSource);
        setError(
          aiError instanceof Error
            ? aiError.message
            : "AI assist is unavailable. You can still use automatic detection."
        );
        return;
      }
    }

    showExtractionResult(courseId, ruleResult, ruleSource);

    if (!shouldUseRuleExtraction(ruleResult)) {
      setError(
        "AI assist is unavailable. You can still use automatic detection."
      );
    }
  }

  async function runExtraction(
    courseId: string,
    text: string,
    mode: "quick" | "syllabus",
    source: ExtractionSource
  ) {
    const trimmedText = text.trim();
    const minimumLength = mode === "quick" ? 6 : 20;

    if (trimmedText.length < minimumLength) {
      setError(
        mode === "quick"
          ? `Type a little more, like: ${sampleBreakdown}.`
          : "Paste more syllabus text so GradeMate can find the grading breakdown."
      );
      return;
    }

    setIsExtractingCourseId(courseId);
    setError("");
    setMessage("");

    try {
      await runExtractionPipeline(courseId, trimmedText, mode, source);
    } finally {
      setIsExtractingCourseId(null);
    }
  }

  async function extractFromPdf(courseId: string) {
    const file = pdfFileByCourse[courseId];

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

    setIsExtractingCourseId(courseId);
    setError("");
    setMessage("");

    try {
      const pdfText = await extractTextFromPdfFile(file);
      const previewWarning =
        pdfText.trim().length < 120
          ? "This PDF may be scanned or image-based. Try pasting the grading section instead."
          : undefined;

      setPdfPreviewByCourse((current) => ({
        ...current,
        [courseId]: {
          fileName: file.name,
          text: pdfText.slice(0, 6000),
          warning: previewWarning
        }
      }));

      if (pdfText.trim().length < 20) {
        throw new Error(
          "This PDF may be scanned or image-based. Try pasting the grading section instead."
        );
      }

      await runExtractionPipeline(courseId, pdfText, "syllabus", "pdf");
    } catch (pdfError) {
      console.warn("PDF text extraction failed", pdfError);
      setError(
        pdfError instanceof Error &&
          /scanned|image-based|pasting/i.test(pdfError.message)
          ? pdfError.message
          : "PDF text extraction failed. Paste the grading section instead."
      );
    } finally {
      setIsExtractingCourseId(null);
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
    setReview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    [field]: field === "name" ? value : Number(value) || 0
                  }
                : row
            )
          }
        : current
    );
  }

  function addReviewRow() {
    setReview((current) =>
      current
        ? {
            ...current,
            rows: [
              ...current.rows,
              {
                confidence: 0.5,
                id: createSimpleId("review"),
                max_score: 100,
                name: "Assessment",
                source_text_snippet: "Added manually during review",
                weight_percentage: 0
              }
            ]
          }
        : current
    );
  }

  function deleteReviewRow(rowId: string) {
    setReview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.filter((row) => row.id !== rowId)
          }
        : current
    );
  }

  function updateCourseInfoField(
    key: CourseInfoReviewField["key"],
    updates: Partial<Pick<CourseInfoReviewField, "apply" | "value">>
  ) {
    setReview((current) =>
      current
        ? {
            ...current,
            courseInfo: current.courseInfo.map((field) =>
              field.key === key ? { ...field, ...updates } : field
            )
          }
        : current
    );
  }

  function saveReview(mode: "append" | "replace") {
    if (!review) {
      return;
    }

    const validRows = review.rows.filter(
      (row) => row.name.trim() && Number(row.weight_percentage) > 0
    );

    if (validRows.length === 0) {
      setError("Add at least one assessment with a name and weight.");
      return;
    }

    let skippedNames: string[] = [];
    let savedCount = 0;
    const confirmedExtraction = buildConfirmedExtraction(
      review.extraction,
      validRows
    );

    setData((current) => ({
      ...current,
      courses: current.courses.map((course) => {
        if (course.id !== review.courseId) {
          return course;
        }

        const existingNames = new Set(
          course.assessments.map((assessment) => normalizeName(assessment.name))
        );
        const seenNames = new Set<string>();
        const newAssessments: SimpleAssessment[] = [];

        validRows.forEach((row) => {
          const normalizedName = normalizeName(row.name);

          if (!normalizedName || seenNames.has(normalizedName)) {
            skippedNames = [...skippedNames, row.name || "Unnamed assessment"];
            return;
          }

          seenNames.add(normalizedName);

          if (mode === "append" && existingNames.has(normalizedName)) {
            skippedNames = [...skippedNames, row.name];
            return;
          }

          newAssessments.push(
            createAssessment({
              confidence: row.confidence,
              maxScore: String(row.max_score || 100),
              name: row.name.trim(),
              score: "",
              sourceTextSnippet: row.source_text_snippet,
              weightPercentage: String(row.weight_percentage || 0)
            })
          );
        });

        savedCount = newAssessments.length;
        const selectedInfo = Object.fromEntries(
          review.courseInfo
            .filter((field) => field.apply && field.value.trim())
            .map((field) => [field.key, field.value.trim()])
        ) as Partial<SimpleCourse>;

        return {
          ...course,
          ...selectedInfo,
          creditHours: selectedInfo.creditHours ?? course.creditHours,
          assessments:
            mode === "replace"
              ? newAssessments
              : [...course.assessments, ...newAssessments],
          gradeSource: "calculated"
        };
      })
    }));

    setReview(null);
    setPendingFeedback({
      courseName: confirmedExtraction.courseName ?? "this course",
      extraction: confirmedExtraction,
      source: review.source
    });
    setError("");
    setMessage(
      [
        savedCount === 1
          ? "Saved 1 assessment."
          : `Saved ${savedCount} assessments.`,
        skippedNames.length > 0
          ? `Skipped duplicates: ${Array.from(new Set(skippedNames)).join(", ")}.`
          : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function updatePredictor(
    courseId: string,
    nextState: Partial<PredictorState>
  ) {
    setPredictors((current) => {
      const existing = current[courseId] ?? {
        selectedAssessmentId: "",
        targetGrade: "90"
      };

      return {
        ...current,
        [courseId]: {
          ...existing,
          ...nextState
        }
      };
    });
  }

  async function sendFeedback(feedback: VerifiedExtractionFeedback) {
    if (!pendingFeedback) {
      return;
    }

    try {
      await saveVerifiedExtraction({
        aiProvider: pendingFeedback.source === "online-ai" ? "gemini" : "rule_based",
        confirmedExtraction: pendingFeedback.extraction,
        originalExtraction: pendingFeedback.extraction,
        sourceType: getVerifiedSource(pendingFeedback.source),
        userFeedback: feedback
      });
      setMessage(
        feedback === "correct"
          ? "Thanks — this helps GradeMate improve future extractions."
          : "Thanks — we'll use your corrected version to improve future extraction."
      );
      setPendingFeedback(null);
    } catch {
      setError("Could not save feedback right now. Your assessments are still saved.");
    }
  }

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-6 text-ink-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-ink-200 bg-white/90 p-5 shadow-soft shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shadow-teal-950/30">
              <GraduationCap aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <Badge tone="teal">Fast Mode</Badge>
              <h1 className="mt-2 text-2xl font-semibold text-ink-900">
                GradeMate Simple
              </h1>
              <p className="mt-1 text-sm text-ink-500">
                Quick GPA and course-grade planning with optional smart extraction.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportData} variant="secondary">
              <Download aria-hidden="true" className="h-4 w-4" />
              Export
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
            >
              <FileUp aria-hidden="true" className="h-4 w-4" />
              Import
            </Button>
            <ModeSwitch className="w-full sm:w-72" compact />
            <ThemeToggle />
            <input
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void importFile(file);
                }

                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-500">Semester GPA</p>
            <p className="mt-3 text-4xl font-semibold text-ink-900">
              {formatGpa(summary.semesterGpa)}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Current semester only
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-500">Cumulative GPA</p>
            <p className="mt-3 text-4xl font-semibold text-ink-900">
              {formatGpa(summary.cumulativeGpa)}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Existing GPA plus this term
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-500">Credit Hours</p>
            <p className="mt-3 text-4xl font-semibold text-ink-900">
              {summary.semesterHours}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              {summary.cumulativeHours} cumulative hours
            </p>
          </Card>
        </section>

        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-lime-200 bg-lime-50 text-lime-800"
            }`}
          >
            {error || message}
          </div>
        )}

        {pendingFeedback ? (
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Help GradeMate improve
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Was this extraction correct for {pendingFeedback.courseName}?
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void sendFeedback("correct")} size="sm">
                  Yes, looks correct
                </Button>
                <Button
                  onClick={() => void sendFeedback("incorrect")}
                  size="sm"
                  variant="secondary"
                >
                  No, needs improvement
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-ink-900">
                Student Information
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Add your current GPA to calculate a cumulative result.
              </p>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-ink-700">
                    Existing CGPA
                  </span>
                  <input
                    className={inputStyles}
                    max="4"
                    min="0"
                    onChange={(event) =>
                      updateData({ existingCgpa: event.target.value })
                    }
                    placeholder="3.45"
                    step="0.01"
                    type="number"
                    value={data.existingCgpa}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink-700">
                    Completed hours
                  </span>
                  <input
                    className={inputStyles}
                    min="0"
                    onChange={(event) =>
                      updateData({ completedHours: event.target.value })
                    }
                    placeholder="60"
                    step="1"
                    type="number"
                    value={data.completedHours}
                  />
                </label>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Search aria-hidden="true" className="h-5 w-5 text-teal-700" />
                <h2 className="text-lg font-semibold text-ink-900">
                  Find a course
                </h2>
              </div>
              <p className="mt-1 text-sm text-ink-500">
                Search your calculator or add a Course Library template locally.
              </p>
              <label className="mt-4 block">
                <span className="text-sm font-medium text-ink-700">
                  Search course code or name
                </span>
                <input
                  className={`${inputStyles} mt-1`}
                  onChange={(event) => setCourseSearch(event.target.value)}
                  placeholder="Search course code or name"
                  value={courseSearch}
                />
              </label>

              {libraryError ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {libraryError}
                </p>
              ) : null}

              {courseSearch.trim() ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-normal text-ink-400">
                      Added courses
                    </p>
                    {courseSearchResults.localCourses.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-500">
                        No matching local courses.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {courseSearchResults.localCourses.map((course) => (
                          <div
                            className="rounded-xl border border-ink-200 bg-white p-3"
                            key={course.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-teal-700">
                                  {course.code || "No code"}
                                </p>
                                <p className="mt-1 truncate font-medium text-ink-900">
                                  {course.name || "Untitled course"}
                                </p>
                                <p className="mt-1 text-xs text-ink-500">
                                  {parsePositiveNumber(course.creditHours)} credits
                                  {" · "}
                                  {course.assessments.length} assessments
                                </p>
                              </div>
                              <Button
                                onClick={() => duplicateLocalCourse(course)}
                                size="sm"
                                variant="secondary"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-normal text-ink-400">
                      Course Library
                    </p>
                    {isLoadingLibrary ? (
                      <p className="mt-2 text-sm text-ink-500">
                        Loading course templates...
                      </p>
                    ) : courseSearchResults.templates.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-500">
                        No matching templates. You can still add a course manually.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {courseSearchResults.templates.map((template) => (
                          <div
                            className="rounded-xl border border-ink-200 bg-white p-3"
                            key={template.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone="teal">
                                    {template.course_code}
                                  </Badge>
                                  <Badge tone="ink">
                                    {Number(template.credit_hours) || 3} credits
                                  </Badge>
                                </div>
                                <p className="mt-2 font-medium text-ink-900">
                                  {template.course_name}
                                </p>
                                <p className="mt-1 text-xs text-ink-500">
                                  {template.assessments.length} detected assessments
                                </p>
                              </div>
                              <Button
                                onClick={() => addTemplateToCalculator(template)}
                                size="sm"
                              >
                                <BookOpen
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                />
                                Add
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-500">
                  Start typing to find a course already in your calculator or a
                  reusable Course Library template.
                </p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold text-ink-900">
                Import JSON
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Paste a GradeMate Simple export here.
              </p>
              <textarea
                className={`${textareaStyles} mt-4 min-h-32`}
                onChange={(event) => setImportText(event.target.value)}
                placeholder='{"existingCgpa":"3.5","completedHours":"60","courses":[...]}'
                value={importText}
              />
              <Button
                className="mt-3 w-full"
                disabled={!importText.trim()}
                onClick={importFromText}
                variant="secondary"
              >
                Import pasted JSON
              </Button>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-ink-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Current Semester Courses
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Add each course, credits, grades, and optional coursework.
                </p>
              </div>
              <Button onClick={() => addCourse()}>
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                Add course
              </Button>
            </div>

            <div className="divide-y divide-ink-200">
              {data.courses.map((course, index) => {
                const stats = getCourseGradeStats(course);
                const effectiveLetter = getEffectiveLetterGrade(course);
                const gradePoints = getGradePoint(effectiveLetter);
                const qualityPoints = getCourseQualityPoints(course);
                const calculatedInfo =
                  stats.currentGrade === null
                    ? null
                    : getGradeInfo(stats.currentGrade);

                return (
                  <div className="space-y-4 p-5" key={course.id}>
                    <div className="grid gap-3 xl:grid-cols-[8rem_minmax(0,1.4fr)_7rem_9rem_9rem_7rem_8rem_auto] xl:items-end">
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Course code
                        </span>
                        <input
                          className={inputStyles}
                          onChange={(event) =>
                            updateCourse(course.id, "code", event.target.value)
                          }
                          placeholder="CS 101"
                          value={course.code}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Course name
                        </span>
                        <input
                          className={inputStyles}
                          onChange={(event) =>
                            updateCourse(course.id, "name", event.target.value)
                          }
                          placeholder={`Course ${index + 1}`}
                          value={course.name}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Credits
                        </span>
                        <input
                          className={inputStyles}
                          min="0"
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              "creditHours",
                              event.target.value
                            )
                          }
                          step="0.5"
                          type="number"
                          value={course.creditHours}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Grade source
                        </span>
                        <select
                          className={inputStyles}
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              "gradeSource",
                              event.target.value
                            )
                          }
                          value={course.gradeSource}
                        >
                          <option value="calculated">Use coursework</option>
                          <option value="manual">Manual grade</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Letter grade
                        </span>
                        <select
                          className={inputStyles}
                          disabled={course.gradeSource === "calculated"}
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              "letterGrade",
                              event.target.value
                            )
                          }
                          value={
                            course.gradeSource === "calculated" &&
                            stats.calculatedLetter
                              ? stats.calculatedLetter
                              : course.letterGrade
                          }
                        >
                          {gradeScale.map((grade) => (
                            <option key={grade.letter} value={grade.letter}>
                              {grade.letter}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <span className="text-sm font-medium text-ink-700">
                          Points
                        </span>
                        <p className="mt-1 flex h-10 items-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-900">
                          {gradePoints.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-ink-700">
                          Quality points
                        </span>
                        <p className="mt-1 flex h-10 items-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-900">
                          {qualityPoints.toFixed(1)}
                        </p>
                      </div>
                      <Button
                        aria-label={`Remove ${course.name || `course ${index + 1}`}`}
                        onClick={() => removeCourse(course.id)}
                        size="icon"
                        variant="danger"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-medium text-ink-500">
                          Course grade
                        </p>
                        <p className="mt-1 text-lg font-semibold text-ink-900">
                          {formatPercent(stats.currentGrade)}
                        </p>
                      </div>
                      <div className="rounded-xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-medium text-ink-500">
                          Letter
                        </p>
                        <p className="mt-1 text-lg font-semibold text-ink-900">
                          {calculatedInfo?.letter ?? effectiveLetter}
                        </p>
                      </div>
                      <div className="rounded-xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-medium text-ink-500">
                          Weight
                        </p>
                        <p className="mt-1 text-lg font-semibold text-ink-900">
                          {stats.totalWeight.toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-xl bg-ink-100 px-4 py-3">
                        <p className="text-xs font-medium text-ink-500">
                          Remaining
                        </p>
                        <p className="mt-1 text-lg font-semibold text-ink-900">
                          {stats.remainingWeight.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <CourseworkDetails
                      addAssessment={addAssessment}
                      addReviewRow={addReviewRow}
                      course={course}
                      deleteReviewRow={deleteReviewRow}
                      extractFromPdf={extractFromPdf}
                      isExtracting={isExtractingCourseId === course.id}
                      pdfFile={pdfFileByCourse[course.id] ?? null}
                      pdfPreview={pdfPreviewByCourse[course.id] ?? null}
                      predictor={predictors[course.id]}
                      quickText={quickTextByCourse[course.id] ?? ""}
                      removeAssessment={removeAssessment}
                      review={review?.courseId === course.id ? review : null}
                      runExtraction={runExtraction}
                      saveReview={saveReview}
                      setPdfFile={(file) =>
                        setPdfFileByCourse((current) => ({
                          ...current,
                          [course.id]: file
                        }))
                      }
                      setQuickText={(value) =>
                        updateCourseText(setQuickTextByCourse, course.id, value)
                      }
                      setReview={setReview}
                      setSyllabusText={(value) =>
                        updateCourseText(
                          setSyllabusTextByCourse,
                          course.id,
                          value
                        )
                      }
                      stats={stats}
                      syllabusText={syllabusTextByCourse[course.id] ?? ""}
                      updateAssessment={updateAssessment}
                      updateCourseInfoField={updateCourseInfoField}
                      updatePredictor={updatePredictor}
                      updateReviewRow={updateReviewRow}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function CourseworkDetails({
  addAssessment,
  addReviewRow,
  course,
  deleteReviewRow,
  extractFromPdf,
  isExtracting,
  pdfFile,
  pdfPreview,
  predictor,
  quickText,
  removeAssessment,
  review,
  runExtraction,
  saveReview,
  setPdfFile,
  setQuickText,
  setReview,
  setSyllabusText,
  stats,
  syllabusText,
  updateAssessment,
  updateCourseInfoField,
  updatePredictor,
  updateReviewRow
}: {
  addAssessment: (courseId: string) => void;
  addReviewRow: () => void;
  course: SimpleCourse;
  deleteReviewRow: (rowId: string) => void;
  extractFromPdf: (courseId: string) => Promise<void>;
  isExtracting: boolean;
  pdfFile: File | null;
  pdfPreview: PdfPreview | null;
  predictor: PredictorState | undefined;
  quickText: string;
  removeAssessment: (courseId: string, assessmentId: string) => void;
  review: ReviewState | null;
  runExtraction: (
    courseId: string,
    text: string,
    mode: "quick" | "syllabus",
    source: ExtractionSource
  ) => Promise<void>;
  saveReview: (mode: "append" | "replace") => void;
  setPdfFile: (file: File | null) => void;
  setQuickText: (value: string) => void;
  setReview: Dispatch<SetStateAction<ReviewState | null>>;
  setSyllabusText: (value: string) => void;
  stats: ReturnType<typeof getCourseGradeStats>;
  syllabusText: string;
  updateAssessment: (
    courseId: string,
    assessmentId: string,
    field: keyof Pick<
      SimpleAssessment,
      "maxScore" | "name" | "score" | "weightPercentage"
    >,
    value: string
  ) => void;
  updateCourseInfoField: (
    key: CourseInfoReviewField["key"],
    updates: Partial<Pick<CourseInfoReviewField, "apply" | "value">>
  ) => void;
  updatePredictor: (
    courseId: string,
    nextState: Partial<PredictorState>
  ) => void;
  updateReviewRow: (
    rowId: string,
    field: keyof Pick<
      ReviewAssessment,
      "confidence" | "max_score" | "name" | "weight_percentage"
    >,
    value: string
  ) => void;
}) {
  const remainingAssessments = stats.rows.filter((row) => !row.isCompleted);
  const activePredictor = {
    selectedAssessmentId:
      predictor?.selectedAssessmentId || remainingAssessments[0]?.assessment.id || "",
    targetGrade: predictor?.targetGrade || "90"
  };
  const selectedRemaining = remainingAssessments.find(
    (row) => row.assessment.id === activePredictor.selectedAssessmentId
  );
  const targetGrade = Number(activePredictor.targetGrade);
  const neededScore =
    selectedRemaining && Number.isFinite(targetGrade) && selectedRemaining.weight > 0
      ? ((targetGrade - stats.completedPoints) / selectedRemaining.weight) * 100
      : null;
  const neededAverage =
    stats.remainingWeight > 0 && Number.isFinite(targetGrade)
      ? ((targetGrade - stats.completedPoints) / stats.remainingWeight) * 100
      : null;
  const predictorMessage =
    neededScore === null
      ? "Add a remaining assessment to calculate what you need."
      : targetGrade <= stats.completedPoints
        ? "You've already secured this target based on completed work."
        : neededScore > 100
          ? "This target is not possible with the remaining weight."
          : neededScore < 0
            ? "You've already secured this target based on completed work."
            : `You need ${neededScore.toFixed(1)}% on ${selectedRemaining?.assessment.name} to reach ${targetGrade.toFixed(1)}%.`;

  return (
    <details className="rounded-2xl border border-ink-200 bg-ink-100/50 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold text-ink-900">
        Coursework details
      </summary>

      <div className="mt-5 space-y-5">
        {[
          course.instructor,
          course.instructorEmail,
          course.semester,
          course.schedule,
          course.classroom,
          course.officeHours,
          course.prerequisites,
          course.courseDescription,
          ...(course.textbooks ?? [])
        ].some(Boolean) ? (
          <section className="rounded-2xl border border-ink-200 bg-white p-4">
            <h3 className="font-semibold text-ink-900">Course details</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[
                ["Instructor", course.instructor],
                ["Email", course.instructorEmail],
                ["Semester", course.semester],
                ["Schedule", course.schedule],
                ["Classroom", course.classroom],
                ["Office hours", course.officeHours],
                ["Prerequisites", course.prerequisites]
              ].map(([label, value]) =>
                value ? (
                  <div className="rounded-xl bg-ink-100/70 p-3 text-sm" key={label}>
                    <p className="text-ink-500">{label}</p>
                    <p className="mt-1 font-medium text-ink-900">{value}</p>
                  </div>
                ) : null
              )}
            </div>
            {course.textbooks?.length ? (
              <div className="mt-3 rounded-xl bg-ink-100/70 p-3 text-sm">
                <p className="text-ink-500">Textbooks</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {course.textbooks.map((textbook) => (
                    <li key={textbook}>{textbook}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {course.courseDescription ? (
              <p className="mt-3 rounded-xl bg-ink-100/70 p-3 text-sm leading-6 text-ink-700">
                {course.courseDescription}
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">Assessments</h3>
              <p className="mt-1 text-ink-500">
                Your course grade is based on completed work only.
              </p>
            </div>
            <Badge tone={isWeightReady(stats.totalWeight) ? "green" : "gold"}>
              {getWeightText(stats.totalWeight)}
            </Badge>
          </div>

          {course.assessments.length === 0 ? (
            <div className="mt-3 rounded-xl border border-ink-200 bg-white p-4 text-ink-500">
              No coursework yet. Add assessments manually or use smart extraction.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-xl border border-ink-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-ink-100 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Assessment</th>
                    <th className="px-4 py-3 font-semibold">Weight</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Max</th>
                    <th className="px-4 py-3 font-semibold">Contribution</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200 bg-white">
                  {stats.rows.map((row) => (
                    <tr key={row.assessment.id}>
                      <td className="px-4 py-3">
                        <input
                          className={inputStyles}
                          onChange={(event) =>
                            updateAssessment(
                              course.id,
                              row.assessment.id,
                              "name",
                              event.target.value
                            )
                          }
                          value={row.assessment.name}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={inputStyles}
                          min="0"
                          onChange={(event) =>
                            updateAssessment(
                              course.id,
                              row.assessment.id,
                              "weightPercentage",
                              event.target.value
                            )
                          }
                          step="0.01"
                          type="number"
                          value={row.assessment.weightPercentage}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={inputStyles}
                          min="0"
                          onChange={(event) =>
                            updateAssessment(
                              course.id,
                              row.assessment.id,
                              "score",
                              event.target.value
                            )
                          }
                          placeholder="--"
                          step="0.01"
                          type="number"
                          value={row.assessment.score}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          className={inputStyles}
                          min="0"
                          onChange={(event) =>
                            updateAssessment(
                              course.id,
                              row.assessment.id,
                              "maxScore",
                              event.target.value
                            )
                          }
                          step="0.01"
                          type="number"
                          value={row.assessment.maxScore}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-900">
                        {row.isCompleted
                          ? `${row.contribution.toFixed(1)}%`
                          : "Remaining"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          aria-label={`Delete ${row.assessment.name}`}
                          onClick={() =>
                            removeAssessment(course.id, row.assessment.id)
                          }
                          size="icon"
                          variant="danger"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button className="mt-3" onClick={() => addAssessment(course.id)}>
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            Add assessment manually
          </Button>
        </section>

        <section className="rounded-2xl border border-ink-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 font-semibold text-ink-900">
              <Wand2 aria-hidden="true" className="h-4 w-4 text-teal-700" />
              Smart extraction
            </div>
            <Badge tone={isOnlineAiEnabled() ? "teal" : "ink"}>
              {isOnlineAiEnabled() ? "AI assist: Online" : "AI assist: Automatic"}
            </Badge>
          </div>

          <div className="mt-4 rounded-xl bg-ink-100/70 p-4">
            <div className="flex items-center gap-2 font-medium text-teal-700">
              <ClipboardPaste aria-hidden="true" className="h-4 w-4" />
              Quick add grading breakdown
            </div>
            <p className="mt-1 text-ink-500">
              Type it like a message. GradeMate will turn it into assessments.
            </p>
            <textarea
              className={`${textareaStyles} mt-3 min-h-24`}
              onChange={(event) => setQuickText(event.target.value)}
              placeholder={sampleBreakdown}
              value={quickText}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setQuickText(sampleBreakdown)} variant="secondary">
                Try sample
              </Button>
              <Button
                disabled={isExtracting}
                onClick={() =>
                  void runExtraction(course.id, quickText, "quick", "quick")
                }
              >
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Auto-detect
              </Button>
              <Button onClick={() => setQuickText("")} variant="secondary">
                Clear
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 font-medium text-ink-900">
                <FileText aria-hidden="true" className="h-4 w-4 text-teal-700" />
                Paste syllabus text
              </div>
              <textarea
                className={`${textareaStyles} mt-3 min-h-32`}
                onChange={(event) => setSyllabusText(event.target.value)}
                placeholder="Paste the grading breakdown or syllabus text here..."
                value={syllabusText}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={isExtracting}
                  onClick={() =>
                    void runExtraction(
                      course.id,
                      syllabusText,
                      "syllabus",
                      "paste"
                    )
                  }
                >
                  Extract grading breakdown
                </Button>
                <Button onClick={() => setSyllabusText("")} variant="secondary">
                  Clear text
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 font-medium text-ink-900">
                <UploadCloud
                  aria-hidden="true"
                  className="h-4 w-4 text-teal-700"
                />
                Upload PDF
              </div>
              <input
                accept="application/pdf"
                className="mt-3 block w-full rounded-xl border border-dashed border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <p className="mt-2 text-xs text-ink-500">
                PDF text is read locally in your browser. If it fails, paste the
                grading section instead.
              </p>
              <Button
                className="mt-3"
                disabled={!pdfFile || isExtracting}
                onClick={() => void extractFromPdf(course.id)}
              >
                {isExtracting ? "Reading PDF..." : "Extract from PDF"}
              </Button>
              {pdfPreview ? (
                <details className="mt-3 rounded-xl border border-ink-200 bg-ink-50 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-teal-700">
                    Extracted text preview
                  </summary>
                  {pdfPreview.warning ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {pdfPreview.warning}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs font-medium text-ink-500">
                    {pdfPreview.fileName}
                  </p>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-ink-700">
                    {pdfPreview.text || "No text was extracted."}
                  </pre>
                </details>
              ) : null}
            </div>
          </div>
        </section>

        {review ? (
          <ExtractionReview
            course={course}
            deleteReviewRow={deleteReviewRow}
            review={review}
            saveReview={saveReview}
            setReview={setReview}
            updateCourseInfoField={updateCourseInfoField}
            updateReviewRow={updateReviewRow}
            addReviewRow={addReviewRow}
          />
        ) : null}

        <section className="rounded-2xl border border-ink-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">What do I need?</h3>
              <p className="mt-1 text-ink-500">
                Pick a target grade and one remaining assessment.
              </p>
            </div>
            <Badge
              tone={
                neededScore === null
                  ? "ink"
                  : neededScore > 100
                    ? "rose"
                    : neededScore < 0 || targetGrade <= stats.completedPoints
                      ? "green"
                      : "teal"
              }
            >
              {neededScore === null
                ? "Needs remaining work"
                : neededScore > 100
                  ? "Impossible"
                  : neededScore < 0 || targetGrade <= stats.completedPoints
                    ? "Already secured"
                    : "Possible"}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-ink-700">
                Target grade
              </span>
              <input
                className={inputStyles}
                max="100"
                min="0"
                onChange={(event) =>
                  updatePredictor(course.id, {
                    targetGrade: event.target.value
                  })
                }
                step="0.1"
                type="number"
                value={activePredictor.targetGrade}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-ink-700">
                Remaining assessment
              </span>
              <select
                className={inputStyles}
                disabled={remainingAssessments.length === 0}
                onChange={(event) =>
                  updatePredictor(course.id, {
                    selectedAssessmentId: event.target.value
                  })
                }
                value={activePredictor.selectedAssessmentId}
              >
                {remainingAssessments.length === 0 ? (
                  <option>No remaining assessments</option>
                ) : (
                  remainingAssessments.map((row) => (
                    <option
                      key={row.assessment.id}
                      value={row.assessment.id}
                    >
                      {row.assessment.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-ink-100 px-4 py-3">
              <p className="text-xs font-medium text-ink-500">
                Needed score
              </p>
              <p className="mt-1 text-lg font-semibold text-ink-900">
                {formatPercent(neededScore)}
              </p>
            </div>
            <div className="rounded-xl bg-ink-100 px-4 py-3">
              <p className="text-xs font-medium text-ink-500">
                Needed average
              </p>
              <p className="mt-1 text-lg font-semibold text-ink-900">
                {formatPercent(neededAverage)}
              </p>
            </div>
            <div className="rounded-xl bg-ink-100 px-4 py-3">
              <p className="text-xs font-medium text-ink-500">
                Best possible
              </p>
              <p className="mt-1 text-lg font-semibold text-ink-900">
                {formatPercent(stats.bestPossibleGrade)}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-600">{predictorMessage}</p>
        </section>
      </div>
    </details>
  );
}

function ExtractionReview({
  addReviewRow,
  course,
  deleteReviewRow,
  review,
  saveReview,
  setReview,
  updateCourseInfoField,
  updateReviewRow
}: {
  addReviewRow: () => void;
  course: SimpleCourse;
  deleteReviewRow: (rowId: string) => void;
  review: ReviewState;
  saveReview: (mode: "append" | "replace") => void;
  setReview: Dispatch<SetStateAction<ReviewState | null>>;
  updateCourseInfoField: (
    key: CourseInfoReviewField["key"],
    updates: Partial<Pick<CourseInfoReviewField, "apply" | "value">>
  ) => void;
  updateReviewRow: (
    rowId: string,
    field: keyof Pick<
      ReviewAssessment,
      "confidence" | "max_score" | "name" | "weight_percentage"
    >,
    value: string
  ) => void;
}) {
  const reviewTotalWeight = getReviewTotalWeight(review.rows);
  const hasExistingAssessments = course.assessments.length > 0;

  return (
    <section className="space-y-4 rounded-2xl border border-ink-200 bg-ink-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isWeightReady(reviewTotalWeight) ? "green" : "gold"}>
          {getWeightText(reviewTotalWeight)}
        </Badge>
        <Badge tone="ink">
          {Math.round(review.extraction.confidence * 100)}% confidence
        </Badge>
        <Badge tone={review.source === "online-ai" ? "teal" : "ink"}>
          {getExtractionSourceLabel(review.source)}
        </Badge>
        <Badge tone={getExtractionQualityTone(review.extraction, review.source)}>
          {getExtractionQualityLabel(review.extraction, review.source)}
        </Badge>
      </div>

      {process.env.NODE_ENV === "development" && review.extraction.debug ? (
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-xs text-ink-600">
          <p className="font-semibold text-ink-800">Dev extraction debug</p>
          <p className="mt-1">
            Text length: {review.extraction.debug.textLength} · Candidates:{" "}
            {review.extraction.debug.candidateCount} · Chosen:{" "}
            {review.extraction.debug.chosenCandidateLabel} · Score:{" "}
            {review.extraction.debug.chosenCandidateScore}
          </p>
        </div>
      ) : null}

      {!isWeightReady(reviewTotalWeight) && review.rows.length > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can still save this, but the weights do not add to 100% yet.
        </p>
      ) : null}

      {review.extraction.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Review notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {review.extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {review.courseInfo.length > 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white p-4">
          <h3 className="font-semibold text-ink-900">Course info suggestions</h3>
          <p className="mt-1 text-sm text-ink-500">
            Choose which detected fields to apply to this quick course.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {review.courseInfo.map((field) => {
              const confidenceInfo = getConfidenceInfo(field.confidence ?? 0);

              return (
                <label
                  className="rounded-xl border border-ink-200 bg-ink-50 p-3"
                  key={field.key}
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
                    <span className="inline-flex items-center gap-2">
                      <input
                        checked={field.apply}
                        onChange={(event) =>
                          updateCourseInfoField(field.key, {
                            apply: event.target.checked
                          })
                        }
                        type="checkbox"
                      />
                      {field.label}
                    </span>
                    <Badge tone={confidenceInfo.tone}>{confidenceInfo.label}</Badge>
                  </span>
                  <input
                    className={`${inputStyles} mt-2`}
                    onChange={(event) =>
                      updateCourseInfoField(field.key, {
                        value: event.target.value
                      })
                    }
                    value={field.value}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {review.rows.length === 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white p-4 text-sm text-ink-600">
          <p className="font-medium text-ink-900">
            I couldn&apos;t find a grading breakdown.
          </p>
          <p className="mt-1">
            Try pasting the grading/evaluation section, like: midterm 25, final
            40, assignments 35.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200">
          <table className="w-full min-w-[900px] text-left text-sm">
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
              {review.rows.map((row) => {
                const confidenceInfo = getConfidenceInfo(row.confidence);

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <input
                        className={inputStyles}
                        onChange={(event) =>
                          updateReviewRow(row.id, "name", event.target.value)
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
                          updateReviewRow(row.id, "max_score", event.target.value)
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
        {review.rows.length === 0 ? (
          <Button onClick={() => setReview(null)} variant="ghost">
            Cancel
          </Button>
        ) : hasExistingAssessments ? (
          <>
            <Button onClick={() => saveReview("replace")}>
              Replace existing assessments
            </Button>
            <Button onClick={() => saveReview("append")} variant="secondary">
              Append new assessments only
            </Button>
            <Button onClick={() => setReview(null)} variant="ghost">
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => saveReview("append")}>
              Confirm and Save
            </Button>
            <Button onClick={() => setReview(null)} variant="ghost">
              Cancel
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
