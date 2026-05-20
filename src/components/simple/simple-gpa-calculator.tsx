"use client";

import Link from "next/link";
import {
  BookOpen,
  Calculator,
  CheckCircle,
  ClipboardPaste,
  Download,
  FileText,
  FileUp,
  PlusCircle,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
  X
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradePlannerPanel } from "@/components/planner/grade-planner-panel";
import type { PlannerAssessmentInput } from "@/lib/grade-planner";
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
type ExtractionSource = "quick" | "paste" | "pdf";

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
  sourceFileName?: string | null;
  sourceText?: string | null;
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
  confirmedExtraction: ExtractedSyllabus;
  includeExtractedText: boolean;
  originalExtraction: ExtractedSyllabus;
  source: ExtractionSource;
  sourceFileName?: string | null;
  sourceText?: string | null;
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

type ExtractionTab = "quick" | "paste" | "pdf";

const simpleStorageKey = "grademate_simple_gpa";
const sampleBreakdown = "quizzes 15, assignments 20, midterm 25, final 40";
const inputStyles = "gm-input";
const textareaStyles = "gm-textarea";

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
  if (source === "pdf") {
    return "Extracted from PDF";
  }

  return source === "paste" ? "Detected from syllabus" : "Detected automatically";
}

function getExtractionQualityLabel(extraction: ExtractedSyllabus) {
  return shouldUseRuleExtraction(extraction)
    ? "Detected automatically"
    : "Needs review";
}

function getExtractionQualityTone(extraction: ExtractedSyllabus) {
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
    return "Total weight: 100% ready";
  }

  if (totalWeight < 100) {
    return `Total weight: missing ${(100 - totalWeight).toFixed(1)}%`;
  }

  return `Total weight: over by ${(totalWeight - 100).toFixed(1)}%`;
}

function getExtractionTotalWeight(extraction: ExtractedSyllabus) {
  return extraction.assessments.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage || 0),
    0
  );
}

function getTemplateTotalWeight(template: SimpleTemplate) {
  return template.assessments.reduce(
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
  if (source === "paste") return "pasted_text";
  return "quick_add";
}

function getSimplePlannerAssessments(course: SimpleCourse): PlannerAssessmentInput[] {
  return course.assessments.map((assessment) => {
    const score = parseOptionalNonNegativeNumber(assessment.score);
    const maxScore = assessment.maxScore.trim()
      ? parsePositiveNumber(assessment.maxScore)
      : null;
    const weight = assessment.weightPercentage.trim()
      ? Number(assessment.weightPercentage)
      : null;

    return {
      id: assessment.id,
      name: assessment.name,
      weightPercentage: Number.isFinite(weight) ? weight : null,
      score,
      maxScore: maxScore && maxScore > 0 ? maxScore : null,
      status: score !== null && maxScore && maxScore > 0 ? "Completed" : "Remaining"
    };
  });
}

function buildConfirmedExtraction(
  extraction: ExtractedSyllabus,
  rows: ReviewAssessment[],
  courseInfo: CourseInfoReviewField[] = []
): ExtractedSyllabus {
  const selectedInfo = Object.fromEntries(
    courseInfo
      .filter((field) => field.apply && field.value.trim())
      .map((field) => [field.key, field.value.trim()])
  ) as Partial<Record<CourseInfoReviewField["key"], string>>;

  return {
    ...extraction,
    classroom: selectedInfo.classroom ?? extraction.classroom,
    courseCode: selectedInfo.code ?? extraction.courseCode,
    courseDescription:
      selectedInfo.courseDescription ?? extraction.courseDescription,
    courseName: selectedInfo.name ?? extraction.courseName,
    creditHours:
      selectedInfo.creditHours !== undefined
        ? Number(selectedInfo.creditHours) || extraction.creditHours
        : extraction.creditHours,
    instructor: selectedInfo.instructor ?? extraction.instructor,
    instructorEmail:
      selectedInfo.instructorEmail ?? extraction.instructorEmail,
    officeHours: selectedInfo.officeHours ?? extraction.officeHours,
    prerequisites: selectedInfo.prerequisites ?? extraction.prerequisites,
    schedule: selectedInfo.schedule ?? extraction.schedule,
    semester: selectedInfo.semester ?? extraction.semester,
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
  const courseNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const studentInfoRef = useRef<HTMLDetailsElement | null>(null);
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
  const [isFindCourseOpen, setIsFindCourseOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isStudentInfoOpen, setIsStudentInfoOpen] = useState(false);
  const [activeExtractionCourseId, setActiveExtractionCourseId] = useState<
    string | null
  >(null);
  const [extractionTab, setExtractionTab] = useState<ExtractionTab>("quick");
  const [activePredictorCourseId, setActivePredictorCourseId] = useState<
    string | null
  >(null);

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
          .filter(
            (template) =>
              !["needs_review", "archived"].includes(
                String(template.template_status ?? "ready").toLowerCase()
              ) &&
              Boolean(template.source_hash) &&
              Boolean(template.extractor_version)
          )
          .map((template) => ({
            ...template,
            assessments: assessmentRows.filter(
              (assessment) => assessment.course_template_id === template.id
            )
          }))
          .filter((template) => isWeightReady(getTemplateTotalWeight(template)));

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

  const activeExtractionCourse =
    data.courses.find((course) => course.id === activeExtractionCourseId) ?? null;
  const activePredictorCourse =
    data.courses.find((course) => course.id === activePredictorCourseId) ?? null;
  const termGpaPercent =
    summary.semesterGpa === null
      ? 0
      : Math.min(100, Math.max(0, (summary.semesterGpa / 4) * 100));

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
    window.setTimeout(() => courseNameInputRefs.current[newCourse.id]?.focus(), 0);
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
    setIsFindCourseOpen(false);
    setCourseSearch("");
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
    setIsFindCourseOpen(false);
    setCourseSearch("");
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
      setIsImportOpen(false);
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
      setIsImportOpen(false);
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
    source: ExtractionSource,
    sourceText?: string | null,
    sourceFileName?: string | null
  ) {
    setActiveExtractionCourseId(courseId);
    setReview({
      courseId,
      courseInfo: makeCourseInfoReviewFields(extraction),
      extraction,
      rows: makeReviewRows(extraction),
      source,
      sourceFileName,
      sourceText
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
    ruleSource: ExtractionSource,
    sourceFileName?: string | null
  ) {
    const ruleResult = extractGradeBreakdown(text, { mode });
    showExtractionResult(courseId, ruleResult, ruleSource, text, sourceFileName);
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
    setActiveExtractionCourseId(courseId);
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

      await runExtractionPipeline(courseId, pdfText, "syllabus", "pdf", file.name);
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

    const targetCourse = data.courses.find((course) => course.id === review.courseId);

    if (!targetCourse) {
      setError("Could not find this course. Refresh and try again.");
      return;
    }

    const existingNames = new Set(
      targetCourse.assessments.map((assessment) => normalizeName(assessment.name))
    );
    const seenNames = new Set<string>();
    const skippedNames: string[] = [];
    const newAssessments: SimpleAssessment[] = [];

    validRows.forEach((row) => {
      const normalizedName = normalizeName(row.name);

      if (!normalizedName || seenNames.has(normalizedName)) {
        skippedNames.push(row.name || "Unnamed assessment");
        return;
      }

      seenNames.add(normalizedName);

      if (mode === "append" && existingNames.has(normalizedName)) {
        skippedNames.push(row.name);
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

    const savedCount = newAssessments.length;
    const wasPdfSource = review.source === "pdf";
    const confirmedExtraction = buildConfirmedExtraction(
      review.extraction,
      validRows,
      review.courseInfo
    );
    const selectedInfo = Object.fromEntries(
      review.courseInfo
        .filter((field) => field.apply && field.value.trim())
        .map((field) => [field.key, field.value.trim()])
    ) as Partial<SimpleCourse>;

    setData((current) => ({
      ...current,
      courses: current.courses.map((course) => {
        if (course.id !== review.courseId) {
          return course;
        }

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
    if (wasPdfSource) {
      setPdfFileByCourse((current) => ({
        ...current,
        [review.courseId]: null
      }));
      setPdfPreviewByCourse((current) => {
        const next = { ...current };
        delete next[review.courseId];
        return next;
      });
    }
    setPendingFeedback({
      courseName: confirmedExtraction.courseName ?? "this course",
      confirmedExtraction,
      includeExtractedText: false,
      originalExtraction: review.extraction,
      source: review.source,
      sourceFileName: review.sourceFileName,
      sourceText: review.sourceText
    });
    setError("");
    const savedMessage =
      savedCount === 1
        ? "Saved 1 assessment."
        : `Saved ${savedCount} assessments.`;
    setMessage(
      [
        wasPdfSource ? "Saved. The PDF was not stored." : "",
        savedMessage,
        skippedNames.length > 0
          ? `Skipped duplicates: ${Array.from(new Set(skippedNames)).join(", ")}.`
          : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
    setActiveExtractionCourseId(null);
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
        userFeedback: feedback
      });
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
      setPendingFeedback(null);
    } catch {
      setError("Could not save feedback right now. Your assessments are still saved.");
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-ink-50 text-ink-900">
      <div className="grid min-h-screen lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-ink-200 bg-ink-100 lg:flex lg:flex-col">
          <div className="px-4 py-5">
            <Link className="block font-semibold text-teal-300" href="/">
              <span className="block text-[21px] font-bold leading-5">
                GradeMate
              </span>
              <span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.08em] text-ink-700">
                Khalifa University
              </span>
            </Link>
          </div>
          <div className="px-4">
            <Button
              className="w-full uppercase tracking-[0.08em]"
              onClick={() => addCourse()}
              size="sm"
            >
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              New Course
            </Button>
          </div>
          <nav className="mt-5 grid gap-1 px-3 text-xs font-semibold">
            <Link className="rounded-[3px] px-3 py-2 text-ink-700 hover:bg-ink-200/60 hover:text-ink-900" href="/workspace">
              Dashboard
            </Link>
            <Link className="rounded-[3px] px-3 py-2 text-ink-700 hover:bg-ink-200/60 hover:text-ink-900" href="/course-library">
              Course Library
            </Link>
            <Link className="rounded-[3px] bg-teal-700 px-3 py-2 text-ink-900" href="/simple">
              GPA Calculator
            </Link>
            <Link className="rounded-[3px] px-3 py-2 text-ink-700 hover:bg-ink-200/60 hover:text-ink-900" href="/courses">
              Syllabus Review
            </Link>
          </nav>
          <div className="mt-auto border-t border-ink-200 p-4">
            <p className="text-xs font-bold text-ink-900">Student Workspace</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-700">
              Khalifa University
            </p>
            <p className="mt-3 text-[10px] font-normal leading-4 tracking-normal text-ink-500">
              GradeMate is student-made and not affiliated with Khalifa University.
            </p>
          </div>
        </aside>

        <div className="min-w-0 space-y-5 px-4 py-5 sm:px-6 lg:px-9 lg:py-8 xl:px-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[26px] font-bold leading-tight text-ink-900">GPA Calculator</h1>
            <p className="mt-2 max-w-xl text-[13px] leading-5 text-ink-800">
              Add courses and see your GPA.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-[3px] border border-ink-200 bg-white/80 p-1">
            <Button onClick={() => setIsImportOpen(true)} size="sm" variant="ghost">
              <FileUp aria-hidden="true" className="h-4 w-4" />
              Import
            </Button>
            <Button onClick={exportData} size="sm" variant="ghost">
              <Download aria-hidden="true" className="h-4 w-4" />
              Save
            </Button>
            <Button
              onClick={() => {
                setIsStudentInfoOpen(true);
                window.requestAnimationFrame(() =>
                  studentInfoRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                  })
                );
              }}
              size="sm"
              variant="secondary"
            >
              <Calculator aria-hidden="true" className="h-4 w-4" />
              What-if
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-300">
              Current term
            </p>
            <p className="mt-2 text-base font-semibold text-ink-900">
              Fall 2024
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {data.courses.length} course{data.courses.length === 1 ? "" : "s"}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-700">
              Total credits
            </p>
            <p className="mt-2 text-base font-semibold text-ink-900">
              {Number(summary.semesterHours).toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-ink-500">This semester</p>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-700">
              Quality points
            </p>
            <p className="mt-2 text-base font-semibold text-ink-900">
              {summary.semesterQualityPoints.toFixed(1)}
            </p>
            <p className="mt-1 text-xs text-ink-500">Credits x grade points</p>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-300">
              Estimated term GPA
            </p>
            <p className="mt-2 text-[30px] font-bold leading-none text-ink-900">
              {formatGpa(summary.semesterGpa)}
            </p>
            <div className="mt-3 h-1 rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-teal-300"
                style={{ width: `${termGpaPercent}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-semibold text-ink-700">
              <span>0.0</span>
              <span>4.0</span>
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-700">
              Cumulative impact
            </p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink-900">Current CGPA</p>
                <p className="text-[10px] text-ink-700">
                  {summary.cumulativeHours} credits
                </p>
              </div>
              <p className="text-sm font-semibold text-ink-900">
                {data.existingCgpa || formatGpa(summary.cumulativeGpa)}
              </p>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3 text-teal-300">
              <div>
                <p className="text-xs font-semibold">Projected</p>
                <p className="text-[10px]">
                  {summary.cumulativeHours} credits total
                </p>
              </div>
              <p className="text-sm font-semibold">
                {formatGpa(summary.cumulativeGpa)}
              </p>
            </div>
          </Card>
        </section>

        {(message || error) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
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
                <label className="mt-3 flex items-center gap-2 text-xs text-ink-500">
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
                <Button onClick={() => void sendFeedback("correct")} size="sm">
                  Yes, looks correct
                </Button>
                <Button
                  onClick={() => void sendFeedback("corrected")}
                  size="sm"
                  variant="secondary"
                >
                  I corrected it
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

        <section className="space-y-5">
          {false ? (
          <div className="hidden">
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
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
                            className="rounded-lg border border-ink-200 bg-white p-3"
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
                        No matching templates. You can still add a course
                        manually or{" "}
                        <a
                          className="font-medium text-teal-700 hover:text-teal-600"
                          href="/contribute-syllabus"
                        >
                          contribute a syllabus
                        </a>
                        .
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {courseSearchResults.templates.map((template) => (
                          <div
                            className="rounded-lg border border-ink-200 bg-white p-3"
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

          ) : null}

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Current semester courses</h2>
                <p className="mt-1 text-sm text-ink-500">
                  Add each course, credits, and grade. Coursework stays tucked away until you need it.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setIsFindCourseOpen(true)} variant="secondary">
                  <Search aria-hidden="true" className="h-4 w-4" />
                  Find course
                </Button>
                <Button onClick={() => addCourse()}>
                  <PlusCircle aria-hidden="true" className="h-4 w-4" />
                  Add course
                </Button>
              </div>
            </div>

            <div className="divide-y divide-ink-200">
              {data.courses.map((course, index) => {
                const stats = getCourseGradeStats(course);
                const qualityPoints = getCourseQualityPoints(course);

                return (
                  <div className="space-y-3 px-4 py-3" key={course.id}>
                    <div className="grid gap-3 xl:grid-cols-[7rem_minmax(10rem,1fr)_4.75rem_8rem_7rem_5.5rem_auto] xl:items-end">
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
                          ref={(node) => {
                            courseNameInputRefs.current[course.id] = node;
                          }}
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
                        <span className="mt-1 block text-[11px] text-ink-500">
                          {course.gradeSource === "calculated"
                            ? formatPercent(stats.currentGrade)
                            : "Manual"}
                        </span>
                      </label>
                      <div>
                        <p className="text-sm font-medium text-ink-700">
                          Quality pts
                        </p>
                        <p className="mt-1 rounded-[3px] border border-ink-200 bg-ink-50 px-3 py-2 text-sm font-semibold text-ink-900">
                          {qualityPoints.toFixed(1)}
                        </p>
                      </div>
                      <Button
                        aria-label={`Remove ${course.name || `course ${index + 1}`}`}
                        className="justify-self-start xl:justify-self-end"
                        onClick={() => removeCourse(course.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>

                    <details className="rounded-lg border border-ink-200 bg-white/70 px-4 py-3 text-sm">
                      <summary className="cursor-pointer font-semibold text-ink-900">
                        Coursework and tools
                      </summary>
                      <CourseworkDetails
                        addAssessment={addAssessment}
                        course={course}
                        openExtraction={() => {
                          setActiveExtractionCourseId(course.id);
                          setExtractionTab("quick");
                        }}
                        openPredictor={() => setActivePredictorCourseId(course.id)}
                        removeAssessment={removeAssessment}
                        stats={stats}
                        updateAssessment={updateAssessment}
                      />
                    </details>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        <details
          className="border border-ink-200 bg-white/80 px-4 py-3"
          onToggle={(event) => setIsStudentInfoOpen(event.currentTarget.open)}
          open={isStudentInfoOpen}
          ref={studentInfoRef}
        >
          <summary className="cursor-pointer text-sm font-semibold text-ink-900">
            Student information
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        </details>

        <p className="text-center text-[11px] leading-5 text-ink-500">
          GradeMate is student-made and not affiliated with Khalifa University.
        </p>

        {isFindCourseOpen ? (
          <SimpleModal
            onClose={() => setIsFindCourseOpen(false)}
            title="Find a course"
          >
            <CourseSearchModal
              addTemplateToCalculator={addTemplateToCalculator}
              courseSearch={courseSearch}
              courseSearchResults={courseSearchResults}
              duplicateLocalCourse={duplicateLocalCourse}
              isLoadingLibrary={isLoadingLibrary}
              libraryError={libraryError}
              setCourseSearch={setCourseSearch}
            />
          </SimpleModal>
        ) : null}

        {isImportOpen ? (
          <SimpleModal
            onClose={() => setIsImportOpen(false)}
            title="Import GradeMate Simple"
          >
            <ImportModal
              fileInputRef={fileInputRef}
              importFile={importFile}
              importFromText={importFromText}
              importText={importText}
              setImportText={setImportText}
            />
          </SimpleModal>
        ) : null}

        {activeExtractionCourse ? (
          <SimpleModal
            onClose={() => {
              setActiveExtractionCourseId(null);
              setReview(null);
            }}
            title="Auto-fill Coursework"
            wide
          >
            <ExtractionModalContent
              activeTab={extractionTab}
              addReviewRow={addReviewRow}
              course={activeExtractionCourse}
              deleteReviewRow={deleteReviewRow}
              extractFromPdf={extractFromPdf}
              isExtracting={isExtractingCourseId === activeExtractionCourse.id}
              pdfFile={pdfFileByCourse[activeExtractionCourse.id] ?? null}
              pdfPreview={pdfPreviewByCourse[activeExtractionCourse.id] ?? null}
              quickText={quickTextByCourse[activeExtractionCourse.id] ?? ""}
              review={
                review?.courseId === activeExtractionCourse.id ? review : null
              }
              runExtraction={runExtraction}
              saveReview={saveReview}
              setActiveTab={setExtractionTab}
              setPdfFile={(file) =>
                setPdfFileByCourse((current) => ({
                  ...current,
                  [activeExtractionCourse.id]: file
                }))
              }
              setQuickText={(value) =>
                updateCourseText(
                  setQuickTextByCourse,
                  activeExtractionCourse.id,
                  value
                )
              }
              setReview={setReview}
              setSyllabusText={(value) =>
                updateCourseText(
                  setSyllabusTextByCourse,
                  activeExtractionCourse.id,
                  value
                )
              }
              syllabusText={
                syllabusTextByCourse[activeExtractionCourse.id] ?? ""
              }
              updateCourseInfoField={updateCourseInfoField}
              updateReviewRow={updateReviewRow}
            />
          </SimpleModal>
        ) : null}

        {activePredictorCourse ? (
          <SimpleModal
            onClose={() => setActivePredictorCourseId(null)}
            title="Grade Planner"
            wide
          >
            <PredictorModalContent
              course={activePredictorCourse}
              onScanSyllabus={() => {
                setActivePredictorCourseId(null);
                setActiveExtractionCourseId(activePredictorCourse.id);
                setExtractionTab("quick");
              }}
              predictor={predictors[activePredictorCourse.id]}
              updatePredictor={updatePredictor}
            />
          </SimpleModal>
        ) : null}
      </div>
      </div>
    </main>
  );
}

function CourseworkDetails({
  addAssessment,
  course,
  openExtraction,
  openPredictor,
  removeAssessment,
  stats,
  updateAssessment
}: {
  addAssessment: (courseId: string) => void;
  course: SimpleCourse;
  openExtraction: () => void;
  openPredictor: () => void;
  removeAssessment: (courseId: string, assessmentId: string) => void;
  stats: ReturnType<typeof getCourseGradeStats>;
  updateAssessment: (
    courseId: string,
    assessmentId: string,
    field: keyof Pick<
      SimpleAssessment,
      "maxScore" | "name" | "score" | "weightPercentage"
    >,
    value: string
  ) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
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
          <section className="rounded-lg bg-white p-3">
            <h3 className="font-semibold text-ink-900">Course details</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
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
                  <div className="rounded-lg bg-ink-100/70 p-3 text-sm" key={label}>
                    <p className="text-ink-500">{label}</p>
                    <p className="mt-1 font-medium text-ink-900">{value}</p>
                  </div>
                ) : null
              )}
            </div>
            {course.textbooks?.length ? (
              <div className="mt-3 rounded-lg bg-ink-100/70 p-3 text-sm">
                <p className="text-ink-500">Textbooks</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {course.textbooks.map((textbook) => (
                    <li key={textbook}>{textbook}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {course.courseDescription ? (
              <p className="mt-3 rounded-lg bg-ink-100/70 p-3 text-sm leading-6 text-ink-700">
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
            <div className="mt-3 rounded-lg border border-ink-200 bg-white p-4 text-ink-500">
              No coursework yet. Add rows manually or scan a syllabus.
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-ink-200">
              <table className="gm-table min-w-[720px]">
                <thead className="bg-ink-100 text-[11px] uppercase tracking-[0.06em] text-ink-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Assessment</th>
                    <th className="px-4 py-3 font-semibold">Score</th>
                    <th className="px-4 py-3 font-semibold">Max</th>
                    <th className="px-4 py-3 font-semibold">Weight %</th>
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

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => addAssessment(course.id)} variant="secondary">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add coursework
            </Button>
            <Button onClick={openExtraction}>
              <Wand2 aria-hidden="true" className="h-4 w-4" />
              Scan syllabus
            </Button>
            <Button onClick={openPredictor} variant="secondary">
              <Calculator aria-hidden="true" className="h-4 w-4" />
              What do I need?
            </Button>
          </div>
        </section>
    </div>
  );
}

function SimpleModal({
  children,
  onClose,
  title,
  wide = false
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <div className="gm-modal-backdrop">
      <div
        className={`max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-lg border border-ink-200 bg-white ${
          wide ? "max-w-5xl" : "max-w-2xl"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <Button aria-label="Close modal" onClick={onClose} size="icon" variant="ghost">
            <X aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[calc(100vh-6.5rem)] overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

function CourseSearchModal({
  addTemplateToCalculator,
  courseSearch,
  courseSearchResults,
  duplicateLocalCourse,
  isLoadingLibrary,
  libraryError,
  setCourseSearch
}: {
  addTemplateToCalculator: (template: SimpleTemplate) => void;
  courseSearch: string;
  courseSearchResults: {
    localCourses: SimpleCourse[];
    templates: SimpleTemplate[];
  };
  duplicateLocalCourse: (course: SimpleCourse) => void;
  isLoadingLibrary: boolean;
  libraryError: string;
  setCourseSearch: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
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
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {libraryError}
        </p>
      ) : null}

      {!courseSearch.trim() ? (
        <p className="text-sm text-ink-500">
          Search your added courses or Course Library templates. Templates are added locally.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-ink-400">
              Added courses
            </p>
            <div className="mt-2 space-y-2">
              {courseSearchResults.localCourses.length === 0 ? (
                <p className="rounded-lg bg-ink-100 p-3 text-sm text-ink-500">
                  No matching local courses.
                </p>
              ) : (
                courseSearchResults.localCourses.map((course) => (
                  <div className="rounded-lg border border-ink-200 bg-white p-3" key={course.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-teal-700">
                          {course.code || "No code"}
                        </p>
                        <p className="mt-1 truncate font-medium text-ink-900">
                          {course.name || "Untitled course"}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          {parsePositiveNumber(course.creditHours)} credits ·{" "}
                          {course.assessments.length} assessments
                        </p>
                      </div>
                      <Button onClick={() => duplicateLocalCourse(course)} size="sm" variant="secondary">
                        Add
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-ink-400">
              Course Library
            </p>
            <div className="mt-2 space-y-2">
              {isLoadingLibrary ? (
                <p className="rounded-lg bg-ink-100 p-3 text-sm text-ink-500">
                  Loading course templates...
                </p>
              ) : courseSearchResults.templates.length === 0 ? (
                <p className="rounded-lg bg-ink-100 p-3 text-sm text-ink-500">
                  No matching templates. You can still add a course manually or{" "}
                  <a
                    className="font-medium text-teal-700 hover:text-teal-600"
                    href="/contribute-syllabus"
                  >
                    contribute a syllabus
                  </a>
                  .
                </p>
              ) : (
                courseSearchResults.templates.map((template) => (
                  <div className="rounded-lg border border-ink-200 bg-white p-3" key={template.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="teal">{template.course_code}</Badge>
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
                      <Button onClick={() => addTemplateToCalculator(template)} size="sm">
                        <BookOpen aria-hidden="true" className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportModal({
  fileInputRef,
  importFile,
  importFromText,
  importText,
  setImportText
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  importFile: (file: File) => Promise<void>;
  importFromText: () => void;
  importText: string;
  setImportText: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">
        Import a saved GradeMate Simple JSON file, or paste exported JSON below.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fileInputRef.current?.click()}>
          <FileUp aria-hidden="true" className="h-4 w-4" />
          Choose JSON file
        </Button>
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
      <label className="block">
        <span className="text-sm font-medium text-ink-700">Paste JSON</span>
        <textarea
          className={`${textareaStyles} mt-2 min-h-32`}
          onChange={(event) => setImportText(event.target.value)}
          placeholder='{"existingCgpa":"3.5","completedHours":"60","courses":[...]}'
          value={importText}
        />
      </label>
      <Button
        disabled={!importText.trim()}
        onClick={importFromText}
        variant="secondary"
      >
        Import pasted JSON
      </Button>
    </div>
  );
}

function ExtractionModalContent({
  activeTab,
  addReviewRow,
  course,
  deleteReviewRow,
  extractFromPdf,
  isExtracting,
  pdfFile,
  pdfPreview,
  quickText,
  review,
  runExtraction,
  saveReview,
  setActiveTab,
  setPdfFile,
  setQuickText,
  setReview,
  setSyllabusText,
  syllabusText,
  updateCourseInfoField,
  updateReviewRow
}: {
  activeTab: ExtractionTab;
  addReviewRow: () => void;
  course: SimpleCourse;
  deleteReviewRow: (rowId: string) => void;
  extractFromPdf: (courseId: string) => Promise<void>;
  isExtracting: boolean;
  pdfFile: File | null;
  pdfPreview: PdfPreview | null;
  quickText: string;
  review: ReviewState | null;
  runExtraction: (
    courseId: string,
    text: string,
    mode: "quick" | "syllabus",
    source: ExtractionSource
  ) => Promise<void>;
  saveReview: (mode: "append" | "replace") => void;
  setActiveTab: (tab: ExtractionTab) => void;
  setPdfFile: (file: File | null) => void;
  setQuickText: (value: string) => void;
  setReview: Dispatch<SetStateAction<ReviewState | null>>;
  setSyllabusText: (value: string) => void;
  syllabusText: string;
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
  const tabs: Array<{ id: ExtractionTab; label: string }> = [
    { id: "quick", label: "Quick Text" },
    { id: "paste", label: "Paste Syllabus" },
    { id: "pdf", label: "Upload PDF" }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="teal">Smart extraction</Badge>
        <span className="text-sm text-ink-500">
          Results are reviewed before they are applied to {course.name || "this course"}.
        </span>
      </div>

      {!review ? (
        <>
          <div className="grid grid-cols-3 rounded-[3px] bg-ink-100 p-1">
            {tabs.map((tab) => (
              <button
                className={`rounded-[3px] px-3 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-teal-600 text-[color:var(--accent-on)]"
                    : "text-ink-500 hover:bg-ink-200 hover:text-ink-900"
                }`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "quick" ? (
            <div className="rounded-lg bg-ink-100/70 p-4">
              <div className="flex items-center gap-2 font-medium text-teal-700">
                <ClipboardPaste aria-hidden="true" className="h-4 w-4" />
                Quick add grading breakdown
              </div>
              <p className="mt-1 text-sm text-ink-500">
                Type it like a message. GradeMate will turn it into assessments.
              </p>
              <textarea
                className={`${textareaStyles} mt-3 min-h-28`}
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
          ) : null}

          {activeTab === "paste" ? (
            <div className="rounded-lg bg-ink-100/70 p-4">
              <div className="flex items-center gap-2 font-medium text-ink-900">
                <FileText aria-hidden="true" className="h-4 w-4 text-teal-700" />
                Paste syllabus text
              </div>
              <textarea
                className={`${textareaStyles} mt-3 min-h-40`}
                onChange={(event) => setSyllabusText(event.target.value)}
                placeholder="Paste the grading breakdown or syllabus text here..."
                value={syllabusText}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={isExtracting}
                  onClick={() =>
                    void runExtraction(course.id, syllabusText, "syllabus", "paste")
                  }
                >
                  Extract
                </Button>
                <Button onClick={() => setSyllabusText("")} variant="secondary">
                  Clear text
                </Button>
              </div>
            </div>
          ) : null}

          {activeTab === "pdf" ? (
            <div className="rounded-lg bg-ink-100/70 p-4">
              <div className="flex items-center gap-2 font-medium text-ink-900">
                <UploadCloud aria-hidden="true" className="h-4 w-4 text-teal-700" />
                Upload PDF
              </div>
              <input
                accept="application/pdf"
                className="mt-3 block w-full rounded-[3px] border border-dashed border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-900 file:mr-3 file:rounded-[3px] file:border-0 file:bg-teal-500 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink-50"
                onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                type="file"
              />
              <p className="mt-2 text-[11px] text-ink-500">
                PDFs are read locally and not stored. If it fails, paste the grading section instead.
              </p>
              <Button
                className="mt-3"
                disabled={!pdfFile || isExtracting}
                onClick={() => void extractFromPdf(course.id)}
              >
                {isExtracting ? "Reading PDF..." : "Extract from PDF"}
              </Button>
              {pdfPreview ? (
                <details className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
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
          ) : null}
        </>
      ) : (
        <>
          {activeTab === "pdf" && pdfPreview ? (
            <details className="rounded-lg border border-ink-200 bg-ink-50 p-3">
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
          <ExtractionReview
            addReviewRow={addReviewRow}
            course={course}
            deleteReviewRow={deleteReviewRow}
            review={review}
            saveReview={saveReview}
            setReview={setReview}
            updateCourseInfoField={updateCourseInfoField}
            updateReviewRow={updateReviewRow}
          />
        </>
      )}
    </div>
  );
}

function PredictorModalContent({
  course,
  onScanSyllabus,
  predictor,
  updatePredictor
}: {
  course: SimpleCourse;
  onScanSyllabus: () => void;
  predictor: PredictorState | undefined;
  updatePredictor: (
    courseId: string,
    nextState: Partial<PredictorState>
  ) => void;
}) {
  return (
    <GradePlannerPanel
      assessments={getSimplePlannerAssessments(course)}
      courseName={course.name || course.code || "this course"}
      onScanSyllabus={onScanSyllabus}
      onTargetGradeChange={(value) =>
        updatePredictor(course.id, { targetGrade: value })
      }
      targetGrade={predictor?.targetGrade || "90"}
    />
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
    <section className="space-y-4 border border-ink-200 bg-white/90 p-4">
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
          Syllabus successfully processed locally. {review.rows.length} grading milestones identified.
        </p>
        <p className="ml-auto hidden text-xs font-medium sm:block">
          PDFs are read locally and not stored.
        </p>
      </div>
      <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
        Always confirm grading details with your official course syllabus.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isWeightReady(reviewTotalWeight) ? "green" : "gold"}>
          {getWeightText(reviewTotalWeight)}
        </Badge>
        <Badge tone="ink">
          {Math.round(review.extraction.confidence * 100)}% confidence
        </Badge>
        <Badge tone={review.source === "pdf" ? "teal" : "ink"}>
          {getExtractionSourceLabel(review.source)}
        </Badge>
        <Badge tone={getExtractionQualityTone(review.extraction)}>
          {getExtractionQualityLabel(review.extraction)}
        </Badge>
      </div>

      {!isWeightReady(reviewTotalWeight) && review.rows.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can still save this, but the weights do not add to 100% yet.
        </p>
      ) : null}

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p className="font-medium">Warnings</p>
        {review.extraction.warnings.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {review.extraction.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">No warnings detected.</p>
        )}
      </div>

      {review.courseInfo.length > 0 ? (
        <div className="rounded-lg border border-ink-200 bg-white p-4">
          <h3 className="font-semibold text-ink-900">Course info suggestions</h3>
          <p className="mt-1 text-sm text-ink-500">
            Choose which detected fields to apply to this quick course.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {review.courseInfo.map((field) => {
              const confidenceInfo = getConfidenceInfo(field.confidence ?? 0);

              return (
                <label
                  className="rounded-lg border border-ink-200 bg-ink-50 p-3"
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
        <div className="rounded-lg border border-ink-200 bg-white p-4 text-sm text-ink-600">
          <p className="font-medium text-ink-900">
            I couldn&apos;t find a grading breakdown.
          </p>
          <p className="mt-1">
            Try pasting the grading/evaluation section, like: midterm 25, final
            40, assignments 35.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-ink-200">
          <table className="gm-table min-w-[900px]">
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
            {reviewTotalWeight.toFixed(Number.isInteger(reviewTotalWeight) ? 0 : 1)}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={addReviewRow} variant="secondary">
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            Add row
          </Button>
          <Button onClick={() => setReview(null)} variant="secondary">
            Re-upload
          </Button>
          {review.rows.length === 0 ? (
            <Button onClick={() => setReview(null)} variant="ghost">
              Cancel
            </Button>
          ) : hasExistingAssessments ? (
            <>
              <Button onClick={() => saveReview("append")}>
                Confirm & Save
              </Button>
              <Button onClick={() => saveReview("replace")} variant="secondary">
                Replace existing
              </Button>
              <Button onClick={() => setReview(null)} variant="ghost">
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => saveReview("append")}>
                Confirm & Save
              </Button>
              <Button onClick={() => setReview(null)} variant="ghost">
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
