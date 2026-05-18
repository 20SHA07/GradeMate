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
  SlidersHorizontal,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
  getAssessments,
  getWorkspaceSnapshot,
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

const pageSize = 20;

const inputStyles =
  "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

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

  return template.assessments.length > 0 && totalWeight >= 99 && totalWeight <= 101;
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

function templateSourceName(template: CourseTemplateRecord) {
  return (
    template.source_syllabus_file_name ??
    template.source_file_name ??
    "Unknown syllabus"
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
    <div className="rounded-xl bg-ink-100 px-3 py-2 text-sm">
      <p className="text-ink-500">{label}</p>
      <p className="mt-1 font-semibold text-ink-900">{value}</p>
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
  const [importingTemplateId, setImportingTemplateId] = useState("");
  const [detailTemplate, setDetailTemplate] =
    useState<TemplateWithDetails | null>(null);
  const [importTemplate, setImportTemplate] =
    useState<TemplateWithDetails | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [duplicateAction, setDuplicateAction] =
    useState<DuplicateAction>("cancel");
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadLibrary() {
      setError("");

      if (!supabase) {
        setError(supabaseConfig.missingSupabaseMessage);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const [
        templatesResponse,
        assessmentsResponse,
        materialsResponse
      ] = await Promise.all([
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
      ]);

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

      const templateRows =
        (templatesResponse.data ?? []) as CourseTemplateRecord[];
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
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your semesters."
        );
        setIsLoading(false);
        return;
      }

      setTemplates(
        templateRows.map((template) => ({
          ...template,
          assessments: assessmentRows.filter(
            (assessment) => assessment.course_template_id === template.id
          ),
          materials: materialRows.filter(
            (material) => material.course_template_id === template.id
          )
        }))
      );
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
    user.id
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [completeOnly, confidenceFilter, department, query, sortOption]);

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

  function openImportModal(template: TemplateWithDetails) {
    setImportTemplate(template);
    setDetailTemplate(null);
    setSelectedSemesterId((current) => current || semesters[0]?.id || "");
    setDuplicateAction("cancel");
    setImportError("");
    setSuccessMessage("");
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
      throw new Error(getSupabaseErrorMessage(assessmentResponse.error));
    }
  }

  async function importSelectedTemplate() {
    if (!importTemplate) {
      return;
    }

    if (!selectedSemesterId) {
      setImportError("Choose a semester before importing this template.");
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

          await copyTemplateAssessmentsToGuest(targetCourse.id, "missing");
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
        setSuccessMessage("Course imported into your guest workspace.");
        setImportTemplate(null);
        router.push(getCourseDetailHref(targetCourse.id, { imported: true }));
        return;
      }

      if (!supabase) {
        setImportError("Supabase is not available.");
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
          throw new Error(getSupabaseErrorMessage(updateError, "Could not update course."));
        }

        targetCourse = data as CourseRecord;
        await copyTemplateAssessments(targetCourse.id, "missing");
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
      setSuccessMessage("Course imported. Opening the course page...");
      setImportTemplate(null);
      router.push(getCourseDetailHref(targetCourse.id, { imported: true }));
    } catch (importFailure) {
      setImportError(
        getSupabaseErrorMessage(importFailure, "Could not import this template.")
      );
    } finally {
      setImportingTemplateId("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link className={buttonStyles({ variant: "secondary" })} href="/courses">
            <FileText aria-hidden="true" className="h-4 w-4" />
            Contribute syllabus
          </Link>
        }
        description="Search syllabus-created templates, preview the grading breakdown, then import a clean copy into your semester."
        title="Course Library"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
          {successMessage}
        </p>
      ) : null}

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-teal-700">
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          Find a course
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_14rem]">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">Search</span>
            <div className="relative mt-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              />
              <input
                className={`${inputStyles} pl-9`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Course code or course name"
                value={query}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
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
          <label className="block">
            <span className="text-sm font-medium text-ink-700">
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
          <label className="block">
            <span className="text-sm font-medium text-ink-700">Sort</span>
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
        <label className="mt-3 flex items-center gap-3 rounded-xl bg-ink-100 px-3 py-2 text-sm text-ink-700">
          <input
            checked={completeOnly}
            className="h-4 w-4 rounded border-ink-300 text-teal-700 focus:ring-teal-600"
            onChange={(event) => setCompleteOnly(event.target.checked)}
            type="checkbox"
          />
          Show templates with complete grading weights only
        </label>
      </Card>

      <div className="flex flex-col gap-3 rounded-2xl bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
          description="Run the syllabus importer, then refresh this page."
          icon={<BookMarked aria-hidden="true" className="h-5 w-5" />}
          title="No course templates found"
        />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          description="Try a different course code, course name, department, confidence filter, or grading completeness filter."
          icon={<Search aria-hidden="true" className="h-5 w-5" />}
          title="No matching templates"
        />
      ) : (
        <section className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleTemplates.map((template) => {
            const totalWeight = totalAssessmentWeight(template.assessments);

            return (
              <Card className="p-4" key={template.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="teal">{template.course_code}</Badge>
                      {template.department ? (
                        <Badge tone="ink">{template.department}</Badge>
                      ) : null}
                      <Badge
                        tone={confidenceTone(template.extraction_confidence)}
                      >
                        {formatConfidence(template.extraction_confidence)}
                      </Badge>
                      <Badge tone={weightTone(totalWeight)}>
                        {weightLabel(totalWeight)}
                      </Badge>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-ink-900">
                      {template.course_name}
                    </h2>
                    <p className="mt-2 truncate text-xs text-ink-400">
                      Source: {templateSourceName(template)}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <FileText aria-hidden="true" className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <DetailStat
                    label="Credits"
                    value={Number(template.credit_hours)}
                  />
                  <DetailStat
                    label="Assessments"
                    value={template.assessments.length}
                  />
                  <DetailStat
                    label="Total weight"
                    value={`${formatWeight(totalWeight)}%`}
                  />
                </div>

                <p className="mt-3 text-xs text-ink-500">
                  {template.instructor ?? "Instructor not detected"}
                  {template.term ? ` - ${template.term}` : ""}
                </p>

                {template.assessments.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No grading breakdown was detected. You can still import and
                    add assessments manually.
                  </p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.assessments.slice(0, 4).map((assessment) => (
                      <Badge key={assessment.id} tone="gold">
                        {assessment.name}{" "}
                        {formatWeight(Number(assessment.weight_percentage))}%
                      </Badge>
                    ))}
                    {template.assessments.length > 4 ? (
                      <Badge tone="ink">
                        +{template.assessments.length - 4} more
                      </Badge>
                    ) : null}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => setDetailTemplate(template)}
                    variant="secondary"
                  >
                    <Eye aria-hidden="true" className="h-4 w-4" />
                    View details
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={semesters.length === 0}
                    onClick={() => openImportModal(template)}
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Import
                  </Button>
                  {semesters.length === 0 ? (
                    <Link
                      className={buttonStyles({
                        className: "w-full sm:w-auto",
                        variant: "secondary"
                      })}
                      href="/semesters"
                    >
                      Create semester
                    </Link>
                  ) : null}
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
        <Link className={buttonStyles()} href="/courses">
          <FileText aria-hidden="true" className="h-4 w-4" />
          Contribute syllabus
        </Link>
      </Card>

      {detailTemplate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <Card className="max-h-[90vh] w-full max-w-5xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-ink-200 p-5">
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
                <h2 className="mt-3 text-2xl font-semibold text-ink-900">
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

            <div className="max-h-[calc(90vh-6rem)] overflow-y-auto p-5">
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
                      value={detailTemplate.term ?? "Not detected"}
                    />
                  </div>

                  <div className="overflow-hidden rounded-lg border border-ink-200">
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
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase text-ink-500">
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

                <aside className="space-y-4">
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
                    disabled={semesters.length === 0}
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
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {importError}
              </p>
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
                    ["update", "Update existing"]
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
                    Existing assessments are preserved. GradeMate will add
                    template assessments whose names are missing.
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
                disabled={importingTemplateId === importTemplate.id}
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
