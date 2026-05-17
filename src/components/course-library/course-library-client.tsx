"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  Download,
  FileText,
  FolderOpen,
  Search,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type {
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

const inputStyles =
  "h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

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
  return `${Math.round(confidence * 100)}% confidence`;
}

function totalAssessmentWeight(assessments: CourseTemplateAssessmentRecord[]) {
  return assessments.reduce(
    (sum, assessment) => sum + Number(assessment.weight_percentage),
    0
  );
}

export function CourseLibraryClient() {
  const router = useRouter();
  const { isGuest, signOut, supabase, user } = useAuth();
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [importingTemplateId, setImportingTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateWithDetails | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [expandedMaterialsTemplateId, setExpandedMaterialsTemplateId] =
    useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLibrary() {
      setError("");

      if (isGuest) {
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setError("Log in to browse syllabus-created course templates.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const [
        templatesResponse,
        assessmentsResponse,
        materialsResponse,
        semestersResponse
      ] = await Promise.all([
        supabase
          .from("course_templates")
          .select("*")
          .not("source_syllabus_path", "is", null)
          .order("course_code", { ascending: true }),
        supabase
          .from("course_template_assessments")
          .select("*")
          .order("created_at", { ascending: true }),
        supabase
          .from("course_template_materials")
          .select("*")
          .order("file_name", { ascending: true }),
        supabase
          .from("semesters")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      if (
        templatesResponse.error ||
        assessmentsResponse.error ||
        materialsResponse.error ||
        semestersResponse.error
      ) {
        setError(
          templatesResponse.error?.message ??
            assessmentsResponse.error?.message ??
            materialsResponse.error?.message ??
            semestersResponse.error?.message ??
            "Could not load course library."
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
      const semesterRows = (semestersResponse.data ?? []) as SemesterRecord[];

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
      setSelectedSemesterId((current) => current || semesterRows[0]?.id || "");
      setIsLoading(false);
    }

    void loadLibrary();
  }, [isGuest, supabase, user.id]);

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

    return templates.filter((template) => {
      const matchesDepartment =
        department === "All" || template.department === department;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          template.course_code,
          template.course_name,
          template.department ?? "",
          template.instructor ?? "",
          template.term ?? "",
          template.description ?? "",
          template.source_syllabus_file_name ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesDepartment && matchesQuery;
    });
  }, [department, query, templates]);

  function openImportModal(template: TemplateWithDetails) {
    setSelectedTemplate(template);
    setSelectedSemesterId(semesters[0]?.id ?? "");
    setError("");
  }

  async function importSelectedTemplate() {
    if (!selectedTemplate) {
      return;
    }

    if (!selectedSemesterId) {
      setError("Choose a semester before importing this template.");
      return;
    }

    if (!supabase || isGuest) {
      setError("Log in to import templates into your semesters.");
      return;
    }

    setError("");
    setImportingTemplateId(selectedTemplate.id);

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        semester_id: selectedSemesterId,
        name: selectedTemplate.course_name,
        code: selectedTemplate.course_code,
        credit_hours: Number(selectedTemplate.credit_hours) || 3
      })
      .select()
      .single();

    const createdCourse = courseData as CourseRecord | null;

    if (courseError || !createdCourse) {
      setError(courseError?.message ?? "Could not import this course.");
      setImportingTemplateId("");
      return;
    }

    if (selectedTemplate.assessments.length > 0) {
      const { error: assessmentError } = await supabase
        .from("assessments")
        .insert(
          selectedTemplate.assessments.map((assessment) => ({
            user_id: user.id,
            course_id: createdCourse.id,
            name: assessment.name,
            weight_percentage: Number(assessment.weight_percentage) || 0,
            score: null,
            max_score: Number(assessment.max_score) || 100,
            category: "Planned",
            title: assessment.name,
            weight: Number(assessment.weight_percentage) || 0
          }))
        );

      if (assessmentError) {
        setError(
          `Course imported, but assessments could not be copied: ${assessmentError.message}`
        );
        setImportingTemplateId("");
        return;
      }
    }

    setImportingTemplateId("");
    setSelectedTemplate(null);
    router.push(`/courses/${createdCourse.id}/`);
  }

  if (isGuest) {
    return (
      <div className="space-y-8">
        <PageHeader
          description="Browse reusable course templates created from syllabuses and import them into your own semesters."
          eyebrow="Syllabus library"
          title="Course Library"
        />
        <EmptyState
          action={
            <Button onClick={() => void signOut()}>
              Log in to use templates
            </Button>
          }
          description="Syllabus-created course templates are shared read-only records for logged-in users."
          icon={<BookMarked aria-hidden="true" className="h-5 w-5" />}
          title="Log in to browse the library"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        description="Search syllabus-created course templates, then import one into your own semester."
        eyebrow="Syllabus library"
        title="Course Library"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <Card className="p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem]">
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
                placeholder="Search by code, name, instructor, or term"
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
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">
          Loading syllabus templates...
        </Card>
      ) : templates.length === 0 ? (
        <EmptyState
          description="Run the syllabus-only import script after updating the Supabase course template tables."
          icon={<BookMarked aria-hidden="true" className="h-5 w-5" />}
          title="No syllabus-created templates found"
        />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          description="Try a different search term or department filter."
          icon={<Search aria-hidden="true" className="h-5 w-5" />}
          title="No matching templates"
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredTemplates.map((template) => {
            const totalWeight = totalAssessmentWeight(template.assessments);
            const isMaterialsOpen = expandedMaterialsTemplateId === template.id;

            return (
              <Card className="p-5" key={template.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
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
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-ink-900">
                      {template.course_name}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-ink-500">
                      {template.description ??
                        "Template created from a detected syllabus."}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <FileText aria-hidden="true" className="h-5 w-5" />
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <p className="text-ink-500">Credits</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {Number(template.credit_hours)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <p className="text-ink-500">Assessments</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {template.assessments.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <p className="text-ink-500">Total weight</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {totalWeight}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
                    <p className="text-ink-500">Materials</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {template.materials.length}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-ink-100 px-3 py-2 text-sm">
                    <p className="text-ink-500">Instructor</p>
                    <p className="mt-1 font-medium text-ink-900">
                      {template.instructor ?? "Not detected"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ink-100 px-3 py-2 text-sm">
                    <p className="text-ink-500">Term</p>
                    <p className="mt-1 font-medium text-ink-900">
                      {template.term ?? "Not detected"}
                    </p>
                  </div>
                </div>

                {template.assessments.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.assessments.slice(0, 5).map((assessment) => (
                      <Badge key={assessment.id} tone="gold">
                        {assessment.name}{" "}
                        {Number(assessment.weight_percentage)}%
                      </Badge>
                    ))}
                    {template.assessments.length > 5 ? (
                      <Badge tone="ink">
                        +{template.assessments.length - 5} more
                      </Badge>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Grading breakdown unclear. You can still import the course
                    and add assessments manually.
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="w-full sm:w-auto"
                    disabled={semesters.length === 0}
                    onClick={() => openImportModal(template)}
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Import to Semester
                  </Button>
                  {template.materials.length > 0 ? (
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() =>
                        setExpandedMaterialsTemplateId((current) =>
                          current === template.id ? "" : template.id
                        )
                      }
                      variant="secondary"
                    >
                      <FolderOpen aria-hidden="true" className="h-4 w-4" />
                      View Materials
                    </Button>
                  ) : null}
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

                {isMaterialsOpen ? (
                  <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-ink-200 bg-ink-50 p-3">
                    <div className="space-y-2">
                      {template.materials.slice(0, 60).map((material) => (
                        <div
                          className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                          key={material.id}
                        >
                          <span className="truncate font-medium text-ink-800">
                            {material.file_name}
                          </span>
                          <Badge tone="ink">
                            {material.material_type ?? "other"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {template.source_syllabus_file_name ? (
                  <p className="mt-4 truncate text-xs text-ink-400">
                    Source syllabus: {template.source_syllabus_file_name}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </section>
      )}

      {selectedTemplate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 px-4">
          <Card className="w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  Import to Semester
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink-900">
                  {selectedTemplate.course_code} {selectedTemplate.course_name}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  This creates a personal course and copies the detected
                  assessment template rows. Materials stay as references.
                </p>
              </div>
              <Button
                aria-label="Close import dialog"
                onClick={() => setSelectedTemplate(null)}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-ink-700">
                Semester
              </span>
              <select
                className={`${inputStyles} mt-1`}
                onChange={(event) => setSelectedSemesterId(event.target.value)}
                value={selectedSemesterId}
              >
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                onClick={() => setSelectedTemplate(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto"
                disabled={importingTemplateId === selectedTemplate.id}
                onClick={() => void importSelectedTemplate()}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                {importingTemplateId === selectedTemplate.id
                  ? "Importing..."
                  : "Import course"}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
