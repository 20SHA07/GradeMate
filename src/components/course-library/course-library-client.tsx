"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Search,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCourseDetailHref } from "@/lib/routes";
import {
  getCoreAssessmentPayloads,
  isMissingAssessmentOptionalColumnError
} from "@/lib/supabase/assessment-write";
import {
  getSupabaseErrorMessage,
  getSupabasePublicConfig
} from "@/lib/supabase/config";
import {
  createAssessment as storeCreateAssessment,
  createCourse as storeCreateCourse,
  createSemester as storeCreateSemester,
  deleteAssessment as storeDeleteAssessment,
  getAssessments,
  getWorkspaceSnapshot,
  guestUserId,
  recordImportedTemplate,
  updateCourse as storeUpdateCourse
} from "@/lib/workspace-store";
import type {
  AssessmentRecord,
  CourseRecord,
  CourseTemplateAssessmentRecord,
  CourseTemplateMaterialRecord,
  CourseTemplateRecord,
  SemesterRecord
} from "@/types/database";

type TemplateWithDetails = CourseTemplateRecord & {
  assessments: CourseTemplateAssessmentRecord[];
  materials: CourseTemplateMaterialRecord[];
};

type ConfidenceFilter = "All" | "High" | "Medium" | "Low";
type DuplicateAction = "cancel" | "duplicate" | "update";
type SortOption = "code" | "name" | "confidence" | "grading";
type ImportSemesterForm = {
  academicYear: string;
  name: string;
  term: string;
};

const pageSize = 20;
const semesterTerms = ["Fall", "Spring", "Summer"];

const inputStyles =
  "gm-input";

const confidenceFilters: ConfidenceFilter[] = ["All", "High", "Medium", "Low"];

const sortOptions: { label: string; value: SortOption }[] = [
  { label: "Course code A-Z", value: "code" },
  { label: "Course name A-Z", value: "name" },
  { label: "Highest confidence", value: "confidence" },
  { label: "Most complete grading", value: "grading" }
];

function totalAssessmentWeight(assessments: CourseTemplateAssessmentRecord[]) {
  return assessments.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage),
    0
  );
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function hasCompleteGrading(template: TemplateWithDetails) {
  const totalWeight = totalAssessmentWeight(template.assessments);

  return (
    template.assessments.length > 0 &&
    totalWeight >= 99.5 &&
    totalWeight <= 100.5
  );
}

function confidenceLabel(confidence: number): ConfidenceFilter {
  if (confidence >= 0.8) {
    return "High";
  }

  if (confidence >= 0.6) {
    return "Medium";
  }

  return "Low";
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.8) {
    return "green" as const;
  }

  if (confidence >= 0.6) {
    return "teal" as const;
  }

  return "gold" as const;
}

function formatConfidence(confidence: number) {
  return `${confidenceLabel(confidence)} - ${Math.round(confidence * 100)}%`;
}

function weightTone(totalWeight: number) {
  if (totalWeight >= 99 && totalWeight <= 101) {
    return "green" as const;
  }

  if (totalWeight > 101) {
    return "rose" as const;
  }

  return "gold" as const;
}

function weightLabel(totalWeight: number) {
  if (totalWeight >= 99 && totalWeight <= 101) {
    return "Complete";
  }

  if (totalWeight > 101) {
    return `Over by ${formatWeight(totalWeight - 100)}%`;
  }

  return `Missing ${formatWeight(100 - totalWeight)}%`;
}

function gradingCompletenessScore(template: TemplateWithDetails) {
  const totalWeight = totalAssessmentWeight(template.assessments);
  const closeness = Math.max(0, 100 - Math.abs(100 - totalWeight));
  const completeBonus = hasCompleteGrading(template) ? 1000 : 0;

  return completeBonus + closeness + template.assessments.length;
}

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function getDefaultImportSemesterForm(): ImportSemesterForm {
  const year = new Date().getFullYear();
  const term = "Fall";

  return {
    academicYear: String(year),
    name: `${term} ${year}`,
    term
  };
}

function getWorkspaceLoadMessage(isGuest: boolean) {
  return isGuest
    ? "We couldn't load the guest workspace from this device. You can retry or create a semester below."
    : "We couldn't reach your synced workspace. You can retry, then import again.";
}

function getImportFailureMessage(isGuest: boolean) {
  return isGuest
    ? "We couldn't import this course to your guest workspace. Please retry."
    : "We couldn't import this course to your synced workspace. Please retry.";
}

function isHiddenTemplate(template: CourseTemplateRecord) {
  return (
    normalized(template.course_code).replace(/\s+/g, " ") === "phys 121" &&
    Number(template.credit_hours) === 3
  );
}

async function withFriendlyTimeout<T>(
  promise: Promise<T>,
  message: string,
  timeoutMs = 15000
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function templateSourceName(template: CourseTemplateRecord) {
  return (
    template.source_syllabus_file_name ??
    template.source_file_name ??
    "Unknown syllabus"
  );
}

function templateTermLabel(template: CourseTemplateRecord) {
  return template.semester ?? template.term ?? null;
}

function templateWarnings(template: CourseTemplateRecord) {
  return Array.isArray(template.extraction_warnings)
    ? template.extraction_warnings.filter(Boolean)
    : [];
}

function isPublicReadyTemplate(template: CourseTemplateRecord) {
  return (
    !["needs_review", "archived"].includes(
      String(template.template_status ?? "ready").toLowerCase()
    ) &&
    Boolean(template.source_hash) &&
    Boolean(template.extractor_version)
  );
}

function findDuplicateCourse(
  courses: CourseRecord[],
  semesterId: string,
  template: TemplateWithDetails | null
) {
  if (!template || !semesterId) {
    return null;
  }

  const templateCode = normalized(template.course_code);
  const templateName = normalized(template.course_name);

  return (
    courses.find((course) => {
      if (course.semester_id !== semesterId) {
        return false;
      }

      const codeMatches = templateCode.length > 0 && normalized(course.code) === templateCode;
      const nameMatches = templateName.length > 0 && normalized(course.name) === templateName;

      return codeMatches || nameMatches;
    }) ?? null
  );
}

function templateAssessmentPayload(
  assessment: CourseTemplateAssessmentRecord,
  courseId: string,
  userId: string
): Omit<AssessmentRecord, "id" | "created_at"> {
  const weight = Number(assessment.weight_percentage) || 0;
  const name = assessment.name;

  return {
    user_id: userId,
    course_id: courseId,
    name,
    weight_percentage: weight,
    score: null,
    max_score: Number(assessment.max_score) || 100,
    category: "Planned",
    title: name,
    weight
  };
}

function DetailStat({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-ink-100 px-3 py-2 text-sm">
      <p className="text-ink-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-ink-900">{value}</p>
    </div>
  );
}

export function CourseLibraryClient() {
  const router = useRouter();
  const { isGuest, supabase, user } = useAuth();
  const supabaseConfig = useMemo(() => getSupabasePublicConfig(), []);
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [confidenceFilter, setConfidenceFilter] =
    useState<ConfidenceFilter>("All");
  const [completeOnly, setCompleteOnly] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("code");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceRetryKey, setWorkspaceRetryKey] = useState(0);
  const [workspaceError, setWorkspaceError] = useState("");
  const [importingTemplateId, setImportingTemplateId] = useState("");
  const [detailTemplate, setDetailTemplate] =
    useState<TemplateWithDetails | null>(null);
  const [importTemplate, setImportTemplate] =
    useState<TemplateWithDetails | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [duplicateAction, setDuplicateAction] =
    useState<DuplicateAction>("cancel");
  const [semesterForm, setSemesterForm] = useState<ImportSemesterForm>(
    getDefaultImportSemesterForm
  );
  const [isCreatingSemester, setIsCreatingSemester] = useState(false);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadLibrary() {
      setError("");
      setWorkspaceError("");

      if (!supabase) {
        setError(supabaseConfig.missingSupabaseMessage);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      let templatesResponse;
      let assessmentsResponse;
      let materialsResponse;

      try {
        [
          templatesResponse,
          assessmentsResponse,
          materialsResponse
        ] = await withFriendlyTimeout(
          Promise.all([
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
              .order("created_at", { ascending: true }),
            supabase
              .from("course_template_materials")
              .select("*")
              .order("file_name", { ascending: true })
          ]),
          "Course Library is taking longer than expected. Check your connection and try again."
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Course Library is unavailable right now. You can still add courses manually."
        );
        setIsLoading(false);
        return;
      }

      if (
        templatesResponse.error ||
        assessmentsResponse.error ||
        materialsResponse.error
      ) {
        setError(
          getSupabaseErrorMessage(
            templatesResponse.error ??
              assessmentsResponse.error ??
              materialsResponse.error,
            "Could not load course library."
          )
        );
        setIsLoading(false);
        return;
      }

      const templateRows = (
        (templatesResponse.data ?? []) as CourseTemplateRecord[]
      ).filter(
        (template) =>
          isPublicReadyTemplate(template) && !isHiddenTemplate(template)
      );
      const assessmentRows =
        (assessmentsResponse.data ?? []) as CourseTemplateAssessmentRecord[];
      const materialRows =
        (materialsResponse.data ?? []) as CourseTemplateMaterialRecord[];
      let semesterRows: SemesterRecord[] = [];
      let courseRows: CourseRecord[] = [];

      try {
        const workspace = await getWorkspaceSnapshot({
          isGuest,
          supabase,
          userId: user.id
        });
        semesterRows = workspace.semesters;
        courseRows = workspace.courses;
      } catch (loadError) {
        console.error("Course Library workspace load failed", {
          error: loadError,
          isGuest,
          userId: user.id
        });
        setWorkspaceError(getWorkspaceLoadMessage(isGuest));
      }

      const templatesWithDetails = templateRows.map((template) => ({
          ...template,
          assessments: assessmentRows.filter(
            (assessment) => assessment.course_template_id === template.id
          ),
          materials: materialRows.filter(
            (material) => material.course_template_id === template.id
          )
        }));

      setTemplates(templatesWithDetails.filter(hasCompleteGrading));
      setSemesters(semesterRows);
      setCourses(courseRows);
      setSelectedSemesterId((current) => current || semesterRows[0]?.id || "");
      setIsLoading(false);
    }

    void loadLibrary();
  }, [
    isGuest,
    supabase,
    supabaseConfig.hasAnonKey,
    supabaseConfig.hasPublishableKey,
    supabaseConfig.hasUrl,
    supabaseConfig.keyPreview,
    supabaseConfig.missingSupabaseMessage,
    supabaseConfig.publicKeySource,
    user.id,
    workspaceRetryKey
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [completeOnly, confidenceFilter, department, query, sortOption]);

  useEffect(() => {
    if (!detailTemplate) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailTemplate(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [detailTemplate]);

  const departments = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          templates
            .map((template) => template.department)
            .filter((value): value is string => Boolean(value))
        )
      ).sort()
    ];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = templates.filter((template) => {
      const matchesDepartment =
        department === "All" || template.department === department;
      const matchesConfidence =
        confidenceFilter === "All" ||
        confidenceLabel(template.extraction_confidence) === confidenceFilter;
      const matchesComplete = !completeOnly || hasCompleteGrading(template);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [template.course_code, template.course_name]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return (
        matchesDepartment &&
        matchesConfidence &&
        matchesComplete &&
        matchesQuery
      );
    });

    return filtered.sort((first, second) => {
      if (sortOption === "name") {
        return first.course_name.localeCompare(second.course_name);
      }

      if (sortOption === "confidence") {
        return (
          second.extraction_confidence - first.extraction_confidence ||
          first.course_code.localeCompare(second.course_code)
        );
      }

      if (sortOption === "grading") {
        return (
          gradingCompletenessScore(second) - gradingCompletenessScore(first) ||
          first.course_code.localeCompare(second.course_code)
        );
      }

      return first.course_code.localeCompare(second.course_code);
    });
  }, [
    completeOnly,
    confidenceFilter,
    department,
    query,
    sortOption,
    templates
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredTemplates.length / pageSize));
  const visibleTemplates = filteredTemplates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const showingStart =
    filteredTemplates.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const showingEnd = Math.min(currentPage * pageSize, filteredTemplates.length);
  const selectedSemester =
    semesters.find((semester) => semester.id === selectedSemesterId) ?? null;
  const duplicateCourse = findDuplicateCourse(
    courses,
    selectedSemesterId,
    importTemplate
  );
  const selectedTemplateWeight = importTemplate
    ? totalAssessmentWeight(importTemplate.assessments)
    : 0;
  const isSyncedWorkspace = !isGuest;

  function openImportModal(template: TemplateWithDetails) {
    setImportTemplate(template);
    setDetailTemplate(null);
    setSelectedSemesterId((current) => current || semesters[0]?.id || "");
    setDuplicateAction("cancel");
    setImportError("");
    setSuccessMessage("");
  }

  async function createImportSemester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = semesterForm.name.trim();
    const academicYear = semesterForm.academicYear.trim();

    if (!name) {
      setImportError("Name the semester before importing this course.");
      return;
    }

    setIsCreatingSemester(true);
    setImportError("");

    try {
      const createdSemester = await storeCreateSemester(
        { isGuest, supabase, userId: user.id },
        {
          academic_year: academicYear || null,
          name,
          term: semesterForm.term
        }
      );

      setSemesters((current) => [createdSemester, ...current]);
      setSelectedSemesterId(createdSemester.id);
      setWorkspaceError("");
    } catch (createError) {
      console.error("Course Library semester creation failed", {
        error: createError,
        isGuest,
        userId: user.id
      });
      setImportError(
        isGuest
          ? "We couldn't create a guest semester on this device. Please retry."
          : "We couldn't create this semester in your synced workspace. Please retry."
      );
    } finally {
      setIsCreatingSemester(false);
    }
  }

  async function importSelectedTemplateAsGuest() {
    if (!importTemplate) {
      return;
    }

    setImportingTemplateId(importTemplate.id);
    setImportError("");

    try {
      const guestContext = {
        isGuest: true,
        supabase,
        userId: guestUserId
      };
      const now = new Date().toISOString();
      const guestWorkspace = await getWorkspaceSnapshot(guestContext);
      const fallbackSemesterName =
        selectedSemester?.name || semesterForm.name.trim() || "Fall 2026";
      const fallbackAcademicYear =
        (selectedSemester?.academic_year ?? semesterForm.academicYear.trim()) ||
        null;
      const guestSemester =
        guestWorkspace.semesters.find(
          (semester) =>
            normalized(semester.name) === normalized(fallbackSemesterName)
        ) ??
        (await storeCreateSemester(guestContext, {
          academic_year: fallbackAcademicYear,
          name: fallbackSemesterName,
          term: selectedSemester?.term ?? semesterForm.term
        }));

      const targetCourse = await storeCreateCourse(guestContext, {
        code: importTemplate.course_code,
        credit_hours: Number(importTemplate.credit_hours) || 3,
        name: importTemplate.course_name,
        semester_id: guestSemester.id
      });

      await Promise.all(
        importTemplate.assessments.map((assessment) => {
          const { user_id: ignoredUserId, ...payload } =
            templateAssessmentPayload(assessment, targetCourse.id, guestUserId);
          void ignoredUserId;

          return storeCreateAssessment(guestContext, payload);
        })
      );

      recordImportedTemplate({
        templateId: importTemplate.id,
        courseId: targetCourse.id,
        semesterId: guestSemester.id,
        importedAt: now
      });
      setSuccessMessage("Imported to guest workspace.");
      setImportTemplate(null);
    } catch (guestImportError) {
      console.error("Course Library guest fallback import failed", {
        error: guestImportError,
        templateId: importTemplate.id
      });
      setImportError("We couldn't import this course as a guest. Please retry.");
    } finally {
      setImportingTemplateId("");
    }
  }

  async function copyTemplateAssessments(courseId: string, mode: "all" | "missing") {
    if (!supabase || !importTemplate) {
      return;
    }

    let assessmentsToCopy = importTemplate.assessments;

    if (mode === "missing") {
      const { data, error: assessmentLoadError } = await supabase
        .from("assessments")
        .select("*")
        .eq("course_id", courseId)
        .eq("user_id", user.id);

      if (assessmentLoadError) {
        console.error("Course Library assessment load failed", {
          courseId,
          error: assessmentLoadError,
          userId: user.id
        });
        throw new Error(getSupabaseErrorMessage(assessmentLoadError));
      }

      const existingNames = new Set(
        ((data ?? []) as AssessmentRecord[]).map((assessment) =>
          normalized(assessment.name ?? assessment.title ?? "")
        )
      );

      assessmentsToCopy = importTemplate.assessments.filter(
        (assessment) => !existingNames.has(normalized(assessment.name))
      );
    }

    if (assessmentsToCopy.length === 0) {
      return;
    }

    const assessmentPayloads = assessmentsToCopy.map((assessment) =>
      templateAssessmentPayload(assessment, courseId, user.id)
    );
    let assessmentResponse = await supabase
      .from("assessments")
      .insert(assessmentPayloads);

    if (isMissingAssessmentOptionalColumnError(assessmentResponse.error)) {
      assessmentResponse = await supabase
        .from("assessments")
        .insert(getCoreAssessmentPayloads(assessmentPayloads));
    }

    if (assessmentResponse.error) {
      console.error("Course Library assessment insert failed", {
        courseId,
        error: assessmentResponse.error,
        userId: user.id
      });
      throw new Error(getSupabaseErrorMessage(assessmentResponse.error));
    }
  }

  async function importSelectedTemplate() {
    if (!importTemplate) {
      return;
    }

    if (!selectedSemesterId) {
      setImportError("Create or choose a semester before importing this course.");
      return;
    }

    if (duplicateCourse && duplicateAction === "cancel") {
      setImportError(
        "This course already exists in this semester. Choose how you want to continue."
      );
      return;
    }

    setImportError("");
    setError("");
    setSuccessMessage("");
    setImportingTemplateId(importTemplate.id);

    try {
      let targetCourse: CourseRecord | null = null;

      if (isGuest) {
        const workspaceContext = { isGuest, supabase, userId: user.id };
        const now = new Date().toISOString();
        const getAssessmentsToCopy = async (
          courseId: string,
          mode: "all" | "missing"
        ) => {
          if (mode === "all") {
            return importTemplate.assessments;
          }

          const existingAssessments = await getAssessments(workspaceContext);
          const existingNames = new Set(
            existingAssessments
              .filter((assessment) => assessment.course_id === courseId)
              .map((assessment) =>
                normalized(assessment.name ?? assessment.title ?? "")
              )
          );

          return importTemplate.assessments.filter(
            (assessment) => !existingNames.has(normalized(assessment.name))
          );
        };
        const copyTemplateAssessmentsToGuest = async (
          courseId: string,
          mode: "all" | "missing"
        ) => {
          const assessmentsToCopy = await getAssessmentsToCopy(courseId, mode);

          await Promise.all(
            assessmentsToCopy.map((assessment) => {
              const { user_id: ignoredUserId, ...payload } =
                templateAssessmentPayload(assessment, courseId, user.id);
              void ignoredUserId;

              return storeCreateAssessment(workspaceContext, payload);
            })
          );
        };

        if (duplicateCourse && duplicateAction === "update") {
          targetCourse = await storeUpdateCourse(
            workspaceContext,
            duplicateCourse.id,
            {
              name: importTemplate.course_name,
              code: importTemplate.course_code,
              credit_hours: Number(importTemplate.credit_hours) || 3
            }
          );

          if (!targetCourse) {
            throw new Error("Could not update course.");
          }

          const existingAssessments = await getAssessments(workspaceContext);
          await Promise.all(
            existingAssessments
              .filter((assessment) => assessment.course_id === targetCourse?.id)
              .map((assessment) =>
                storeDeleteAssessment(workspaceContext, assessment.id)
              )
          );
          await copyTemplateAssessmentsToGuest(targetCourse.id, "all");
          setCourses((current) =>
            current.map((course) =>
              course.id === targetCourse?.id ? targetCourse : course
            )
          );
        } else {
          targetCourse = await storeCreateCourse(workspaceContext, {
            semester_id: selectedSemesterId,
            name: importTemplate.course_name,
            code: importTemplate.course_code,
            credit_hours: Number(importTemplate.credit_hours) || 3
          });
          await copyTemplateAssessmentsToGuest(targetCourse.id, "all");
          setCourses((current) => [targetCourse as CourseRecord, ...current]);
        }

        recordImportedTemplate({
          templateId: importTemplate.id,
          courseId: targetCourse.id,
          semesterId: selectedSemesterId,
          importedAt: now
        });
        setSuccessMessage("Imported to guest workspace.");
        setImportTemplate(null);
        router.push(getCourseDetailHref(targetCourse.id, { imported: true }));
        return;
      }

      if (!supabase) {
        setImportError(getWorkspaceLoadMessage(false));
        return;
      }

      if (duplicateCourse && duplicateAction === "update") {
        const { data, error: updateError } = await supabase
          .from("courses")
          .update({
            name: importTemplate.course_name,
            code: importTemplate.course_code,
            credit_hours: Number(importTemplate.credit_hours) || 3
          })
          .eq("id", duplicateCourse.id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (updateError || !data) {
          console.error("Course Library course update failed", {
            courseId: duplicateCourse.id,
            error: updateError,
            userId: user.id
          });
          throw new Error(getSupabaseErrorMessage(updateError, "Could not update course."));
        }

        targetCourse = data as CourseRecord;
        const { error: deleteAssessmentsError } = await supabase
          .from("assessments")
          .delete()
          .eq("course_id", targetCourse.id)
          .eq("user_id", user.id);

        if (deleteAssessmentsError) {
          console.error("Course Library assessment replacement failed", {
            courseId: targetCourse.id,
            error: deleteAssessmentsError,
            userId: user.id
          });
          throw new Error(
            getSupabaseErrorMessage(
              deleteAssessmentsError,
              "Could not replace existing assessments."
            )
          );
        }

        await copyTemplateAssessments(targetCourse.id, "all");
      } else {
        const { data, error: courseError } = await supabase
          .from("courses")
          .insert({
            user_id: user.id,
            semester_id: selectedSemesterId,
            name: importTemplate.course_name,
            code: importTemplate.course_code,
            credit_hours: Number(importTemplate.credit_hours) || 3
          })
          .select()
          .single();

        if (courseError || !data) {
          console.error("Course Library course insert failed", {
            error: courseError,
            templateId: importTemplate.id,
            userId: user.id
          });
          throw new Error(
            getSupabaseErrorMessage(courseError, "Could not import this course.")
          );
        }

        targetCourse = data as CourseRecord;
        await copyTemplateAssessments(targetCourse.id, "all");
      }

      setCourses((current) => {
        const withoutUpdated = current.filter(
          (course) => course.id !== targetCourse?.id
        );

        return targetCourse ? [targetCourse, ...withoutUpdated] : current;
      });
      setSuccessMessage("Imported to your workspace.");
      setImportTemplate(null);
      router.push(getCourseDetailHref(targetCourse.id, { imported: true }));
    } catch (importFailure) {
      console.error("Course Library import failed", {
        error: importFailure,
        isGuest,
        templateId: importTemplate.id,
        userId: user.id
      });
      setImportError(getImportFailureMessage(isGuest));
    } finally {
      setImportingTemplateId("");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge tone="teal">Ready KU templates</Badge>
          <h1 className="mt-3 text-[28px] font-bold leading-tight text-ink-900">
            Course Library
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-700">
            Browse and add foundational KU courses to your workspace.
            Pre-configured with credit weights.
          </p>
          <p className="mt-2 max-w-xl text-xs leading-5 text-ink-500">
            Course templates are student-maintained. Always verify with your
            official syllabus.
          </p>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {workspaceError ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p>{workspaceError}</p>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setWorkspaceRetryKey((key) => key + 1)}
            size="sm"
            variant="secondary"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {successMessage ? (
        <p className="rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
          {successMessage}
        </p>
      ) : null}

      <Card className="border-0 bg-transparent p-0">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_15rem] lg:items-end">
          <label className="block min-w-0">
            <span className="block text-sm font-medium text-ink-700">Search</span>
            <div className="relative mt-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              />
              <input
                className={`${inputStyles} pl-9`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search MATH111..."
                value={query}
              />
            </div>
          </label>
          <label className="block min-w-0">
            <span className="block text-sm font-medium text-ink-700">
              Department
            </span>
            <select
              className={`${inputStyles} mt-1`}
              onChange={(event) => setDepartment(event.target.value)}
              value={department}
            >
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="block text-sm font-medium text-ink-700">
              Confidence
            </span>
            <select
              className={`${inputStyles} mt-1`}
              onChange={(event) =>
                setConfidenceFilter(event.target.value as ConfidenceFilter)
              }
              value={confidenceFilter}
            >
              {confidenceFilters.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className="block text-sm font-medium text-ink-700">Sort</span>
            <select
              className={`${inputStyles} mt-1`}
              onChange={(event) =>
                setSortOption(event.target.value as SortOption)
              }
              value={sortOption}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 flex items-center gap-3 border border-ink-200 bg-ink-100 px-3 py-2 text-xs text-ink-700">
          <input
            checked={completeOnly}
            className="h-4 w-4 rounded border-ink-300 text-teal-700 focus:ring-teal-600"
            onChange={(event) => setCompleteOnly(event.target.checked)}
            type="checkbox"
          />
          Show templates with complete grading weights only
        </label>
      </Card>

      <div className="flex flex-col gap-3 border border-ink-200 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-ink-700">
          {isLoading
            ? "Loading syllabus templates..."
            : `Showing ${showingStart}-${showingEnd} of ${filteredTemplates.length} templates`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            disabled={isLoading || currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            size="sm"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            Previous
          </Button>
          <span className="min-w-16 text-center text-sm text-ink-500">
            {currentPage} / {pageCount}
          </span>
          <Button
            disabled={isLoading || currentPage === pageCount}
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount, page + 1))
            }
            size="sm"
            variant="secondary"
          >
            Next
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">
          Loading syllabus templates...
        </Card>
      ) : templates.length === 0 ? (
        <EmptyState
          description={
            error
              ? "Try refreshing in a moment. You can still add courses manually while the shared library is unavailable."
              : "Run the syllabus importer, then refresh this page."
          }
          icon={<BookMarked aria-hidden="true" className="h-5 w-5" />}
          title={error ? "Course Library unavailable" : "No course templates found"}
        />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          description="Try a different course code, course name, department, confidence filter, or grading completeness filter."
          icon={<Search aria-hidden="true" className="h-5 w-5" />}
          title="No matching templates"
        />
      ) : (
        <section className="grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {visibleTemplates.map((template) => {
            const totalWeight = totalAssessmentWeight(template.assessments);

            return (
              <Card
                className="flex min-h-[160px] flex-col p-4 transition-colors hover:border-teal-200 hover:bg-teal-50/20"
                key={template.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-teal-300">
                      {template.course_code}
                    </p>
                    <h2 className="mt-2 text-base font-semibold leading-tight text-ink-900">
                      {template.course_name}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span>{Number(template.credit_hours).toFixed(1)} credits</span>
                      {templateTermLabel(template) ? (
                        <span>{templateTermLabel(template)}</span>
                      ) : null}
                    </div>
                  </div>
                  <Badge tone={weightTone(totalWeight)}>
                    {totalWeight === 100 ? "Complete" : `${formatWeight(totalWeight)}% total`}
                  </Badge>
                </div>

                <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-2">
                  <Button
                    className="w-full"
                    onClick={() => setDetailTemplate(template)}
                    variant="secondary"
                  >
                    <Eye aria-hidden="true" className="h-4 w-4" />
                    View details
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => openImportModal(template)}
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Import
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            Can&apos;t find your course?
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Upload a syllabus from one of your courses and GradeMate can help
            turn it into assessments.
          </p>
        </div>
        <Link className={buttonStyles()} href="/contribute-syllabus">
          <FileText aria-hidden="true" className="h-4 w-4" />
          Contribute syllabus
        </Link>
      </Card>

      {detailTemplate ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 px-3 py-4 sm:px-4 sm:py-6"
          role="dialog"
        >
          <div className="flex min-h-full items-start justify-center">
            <Card className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden sm:max-h-[calc(100dvh-3rem)]">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-200 bg-white/95 p-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="teal">{detailTemplate.course_code}</Badge>
                    <Badge tone={confidenceTone(detailTemplate.extraction_confidence)}>
                      {formatConfidence(detailTemplate.extraction_confidence)}
                    </Badge>
                    <Badge
                      tone={weightTone(totalAssessmentWeight(detailTemplate.assessments))}
                    >
                      {weightLabel(totalAssessmentWeight(detailTemplate.assessments))}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-[24px] font-bold leading-tight text-ink-900">
                    {detailTemplate.course_name}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">
                    {detailTemplate.description ??
                      "Template created from a detected syllabus."}
                  </p>
                </div>
                <Button
                  aria-label="Close details"
                  onClick={() => setDetailTemplate(null)}
                  size="icon"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <DetailStat
                        label="Credit hours"
                        value={Number(detailTemplate.credit_hours)}
                      />
                      <DetailStat
                        label="Instructor"
                        value={detailTemplate.instructor ?? "Not detected"}
                      />
                      <DetailStat
                        label="Term"
                        value={templateTermLabel(detailTemplate) ?? "Not detected"}
                      />
                    </div>
                    {templateWarnings(detailTemplate).length > 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {templateWarnings(detailTemplate).join("; ")}
                      </div>
                    ) : null}

                    <div className="rounded-lg border border-ink-200">
                      <div className="flex items-center justify-between gap-3 border-b border-ink-200 bg-ink-50 px-4 py-3">
                        <div>
                          <h3 className="font-semibold text-ink-900">
                            Assessment breakdown
                          </h3>
                          <p className="text-sm text-ink-500">
                            Total weight:{" "}
                            {formatWeight(
                              totalAssessmentWeight(detailTemplate.assessments)
                            )}
                            %
                          </p>
                        </div>
                        <Badge
                          tone={weightTone(
                            totalAssessmentWeight(detailTemplate.assessments)
                          )}
                        >
                          {weightLabel(
                            totalAssessmentWeight(detailTemplate.assessments)
                          )}
                        </Badge>
                      </div>

                      {detailTemplate.assessments.length === 0 ? (
                        <p className="p-4 text-sm text-ink-500">
                          No assessment weights were detected from this syllabus.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="gm-table min-w-[560px]">
                            <thead className="border-b border-ink-200 bg-ink-50 text-[11px] uppercase tracking-[0.06em] text-ink-500">
                              <tr>
                                <th className="px-4 py-3 font-semibold">Name</th>
                                <th className="px-4 py-3 font-semibold">Weight</th>
                                <th className="px-4 py-3 font-semibold">
                                  Max score
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                  Confidence
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-ink-100">
                              {detailTemplate.assessments.map((assessment) => (
                                <tr key={assessment.id}>
                                  <td className="px-4 py-3 font-medium text-ink-900">
                                    {assessment.name}
                                  </td>
                                  <td className="px-4 py-3 text-ink-700">
                                    {formatWeight(
                                      Number(assessment.weight_percentage)
                                    )}
                                    %
                                  </td>
                                  <td className="px-4 py-3 text-ink-700">
                                    {Number(assessment.max_score)}
                                  </td>
                                  <td className="px-4 py-3 text-ink-700">
                                    {Math.round(Number(assessment.confidence) * 100)}
                                    %
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                    <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
                      <h3 className="font-semibold text-ink-900">Source</h3>
                      <p className="mt-2 break-words text-sm text-ink-500">
                        {templateSourceName(detailTemplate)}
                      </p>
                    </div>

                    <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
                      <div className="flex items-center gap-2 font-semibold text-ink-900">
                        <FolderOpen aria-hidden="true" className="h-4 w-4" />
                        Materials
                      </div>
                      {detailTemplate.materials.length === 0 ? (
                        <p className="mt-2 text-sm text-ink-500">
                          No linked side materials.
                        </p>
                      ) : (
                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                          {detailTemplate.materials.slice(0, 80).map((material) => (
                            <div
                              className="rounded-lg bg-white px-3 py-2 text-sm"
                              key={material.id}
                            >
                              <p className="truncate font-medium text-ink-800">
                                {material.file_name}
                              </p>
                              <Badge className="mt-2" tone="ink">
                                {material.material_type ?? "other"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => openImportModal(detailTemplate)}
                    >
                      <Download aria-hidden="true" className="h-4 w-4" />
                      Import to Semester
                    </Button>
                  </aside>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {importTemplate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  Import to Semester
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink-900">
                  {importTemplate.course_code} {importTemplate.course_name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  Review the course and assessment rows before creating your
                  personal copy.
                </p>
              </div>
              <Button
                aria-label="Close import dialog"
                onClick={() => setImportTemplate(null)}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            {importError ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p>{importError}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => void importSelectedTemplate()}
                    size="sm"
                    variant="secondary"
                  >
                    Retry
                  </Button>
                  <Button
                    onClick={() => {
                      setImportError("");
                      setWorkspaceRetryKey((key) => key + 1);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    Check workspace
                  </Button>
                  {!isGuest ? (
                    <Button
                      onClick={() => void importSelectedTemplateAsGuest()}
                      size="sm"
                      variant="secondary"
                    >
                      Continue as guest
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => setImportTemplate(null)}
                    size="sm"
                    variant="ghost"
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : null}

            {!importError ? (
              <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
                {isSyncedWorkspace
                  ? "This course will be saved to your synced workspace."
                  : "Continue as guest. This course will be saved on this device. Sign in to sync across devices."}
              </p>
            ) : null}

            {workspaceError ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p>{workspaceError}</p>
                <Button
                  className="mt-3"
                  onClick={() => setWorkspaceRetryKey((key) => key + 1)}
                  size="sm"
                  variant="secondary"
                >
                  Retry workspace
                </Button>
              </div>
            ) : null}

            {importTemplate.assessments.length === 0 ? (
              <p className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                This template has no detected assessments. Importing will create
                the course only, and you can add assessments manually.
              </p>
            ) : null}

            {semesters.length === 0 ? (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">
                  No semesters yet.
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Create one to import this course.
                </p>
                <form
                  className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto]"
                  onSubmit={createImportSemester}
                >
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold text-amber-900">
                      Name
                    </span>
                    <input
                      className={`${inputStyles} mt-1 bg-white/80`}
                      onChange={(event) =>
                        setSemesterForm((current) => ({
                          ...current,
                          name: event.target.value
                        }))
                      }
                      placeholder="Fall 2026"
                      value={semesterForm.name}
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold text-amber-900">
                      Term
                    </span>
                    <select
                      className={`${inputStyles} mt-1 bg-white/80`}
                      onChange={(event) =>
                        setSemesterForm((current) => ({
                          ...current,
                          name:
                            current.name ===
                            `${current.term} ${current.academicYear}`
                              ? `${event.target.value} ${current.academicYear}`
                              : current.name,
                          term: event.target.value
                        }))
                      }
                      value={semesterForm.term}
                    >
                      {semesterTerms.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold text-amber-900">
                      Year
                    </span>
                    <input
                      className={`${inputStyles} mt-1 bg-white/80`}
                      inputMode="numeric"
                      onChange={(event) =>
                        setSemesterForm((current) => ({
                          ...current,
                          academicYear: event.target.value,
                          name:
                            current.name ===
                            `${current.term} ${current.academicYear}`
                              ? `${current.term} ${event.target.value}`
                              : current.name
                        }))
                      }
                      placeholder="2026"
                      value={semesterForm.academicYear}
                    />
                  </label>
                  <Button
                    className="self-end"
                    disabled={isCreatingSemester}
                    type="submit"
                    variant="secondary"
                  >
                    {isCreatingSemester ? "Creating..." : "Create"}
                  </Button>
                </form>
              </div>
            ) : (
              <label className="mt-5 block">
                <span className="text-sm font-medium text-ink-700">
                  Semester
                </span>
                <select
                  className={`${inputStyles} mt-1`}
                  onChange={(event) => {
                    setSelectedSemesterId(event.target.value);
                    setDuplicateAction("cancel");
                    setImportError("");
                  }}
                  value={selectedSemesterId}
                >
                  {semesters.map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {duplicateCourse ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-2 text-sm text-amber-800">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <p>
                    This course already exists in {selectedSemester?.name}. Pick
                    how GradeMate should handle it.
                  </p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["cancel", "Cancel"],
                    ["duplicate", "Import anyway"],
                    ["update", "Replace assessments"]
                  ].map(([value, label]) => (
                    <label
                      className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-ink-800"
                      key={value}
                    >
                      <input
                        checked={duplicateAction === value}
                        onChange={() =>
                          setDuplicateAction(value as DuplicateAction)
                        }
                        type="radio"
                        value={value}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {duplicateAction === "update" ? (
                  <p className="mt-3 text-xs leading-5 text-amber-800">
                    GradeMate will update the course info, replace existing
                    assessments, and copy the template breakdown.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-teal-700"
                />
                <div>
                  <h3 className="font-semibold text-ink-900">
                    Import preview
                  </h3>
                  <p className="mt-1 text-sm text-ink-500">
                    Creates{" "}
                    <span className="font-medium text-ink-800">
                      {importTemplate.course_code} {importTemplate.course_name}
                    </span>{" "}
                    in {selectedSemester?.name ?? "the selected semester"} with{" "}
                    {Number(importTemplate.credit_hours) || 3} credits.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <DetailStat
                  label="Assessments copied"
                  value={importTemplate.assessments.length}
                />
                <DetailStat
                  label="Total weight"
                  value={`${formatWeight(selectedTemplateWeight)}%`}
                />
                <DetailStat
                  label="Weight status"
                  value={weightLabel(selectedTemplateWeight)}
                />
              </div>

              {importTemplate.assessments.length > 0 ? (
                <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-ink-200 bg-white">
                  {importTemplate.assessments.map((assessment) => (
                    <div
                      className="flex items-center justify-between gap-3 border-b border-ink-100 px-3 py-2 text-sm last:border-b-0"
                      key={assessment.id}
                    >
                      <span className="font-medium text-ink-800">
                        {assessment.name}
                      </span>
                      <span className="text-ink-500">
                        {formatWeight(Number(assessment.weight_percentage))}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                onClick={() => setImportTemplate(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={
                  importingTemplateId === importTemplate.id ||
                  semesters.length === 0
                }
                onClick={() => void importSelectedTemplate()}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                {importingTemplateId === importTemplate.id
                  ? "Importing..."
                  : "Confirm Import"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
