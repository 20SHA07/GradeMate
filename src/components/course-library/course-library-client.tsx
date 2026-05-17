"use client";

import Link from "next/link";
import { BookMarked, CheckCircle2, Download, Search } from "lucide-react";
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

type TemplateWithCounts = CourseTemplateRecord & {
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

export function CourseLibraryClient() {
  const { isGuest, signOut, supabase, user } = useAuth();
  const [templates, setTemplates] = useState<TemplateWithCounts[]>([]);
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [selectedSemesters, setSelectedSemesters] = useState<
    Record<string, string>
  >({});
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [importingTemplateId, setImportingTemplateId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    message: string;
    courseId: string;
  } | null>(null);

  useEffect(() => {
    async function loadLibrary() {
      setError("");
      setSuccess(null);

      if (isGuest) {
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setError("Log in to browse course templates.");
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
      setSelectedSemesters(
        Object.fromEntries(
          templateRows.map((template) => [template.id, semesterRows[0]?.id ?? ""])
        )
      );
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
          template.description ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesDepartment && matchesQuery;
    });
  }, [department, query, templates]);

  async function importTemplate(template: TemplateWithCounts) {
    const semesterId = selectedSemesters[template.id];
    setError("");
    setSuccess(null);

    if (!semesterId) {
      setError("Choose a semester before importing this template.");
      return;
    }

    if (!supabase || isGuest) {
      setError("Log in to import templates into your semesters.");
      return;
    }

    setImportingTemplateId(template.id);

    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        semester_id: semesterId,
        name: template.course_name,
        code: template.course_code,
        credit_hours: Number(template.credit_hours) || 3
      })
      .select()
      .single();

    const createdCourse = courseData as CourseRecord | null;

    if (courseError || !createdCourse) {
      setError(courseError?.message ?? "Could not import this course.");
      setImportingTemplateId("");
      return;
    }

    if (template.assessments.length > 0) {
      const { error: assessmentError } = await supabase
        .from("assessments")
        .insert(
          template.assessments.map((assessment) => ({
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

    setSuccess({
      message: `${template.course_code} imported into your semester.`,
      courseId: createdCourse.id
    });
    setImportingTemplateId("");
  }

  if (isGuest) {
    return (
      <div className="space-y-8">
        <PageHeader
          description="Browse reusable templates created from course materials and import them into your own semesters."
          eyebrow="Templates"
          title="Course Library"
        />
        <EmptyState
          action={
            <Button onClick={() => void signOut()}>
              Log in to use templates
            </Button>
          }
          description="Course templates are shared read-only records for logged-in users. Guest mode can still create courses manually from the Semesters page."
          icon={<BookMarked aria-hidden="true" className="h-5 w-5" />}
          title="Log in to browse the library"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        description="Search reusable course templates, then import one into your own semester."
        eyebrow="Templates"
        title="Course Library"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <div className="flex flex-col gap-3 rounded-lg border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800 sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            {success.message}
          </span>
          <Link
            className={buttonStyles({ variant: "secondary", size: "sm" })}
            href={`/courses/${success.courseId}/`}
            prefetch={false}
          >
            Open course
          </Link>
        </div>
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
                placeholder="Search by code, name, or department"
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
          Loading course templates...
        </Card>
      ) : templates.length === 0 ? (
        <EmptyState
          description="Run the template import script after creating the Supabase course template tables."
          icon={<BookMarked aria-hidden="true" className="h-5 w-5" />}
          title="No templates found"
        />
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          description="Try a different search term or department filter."
          icon={<Search aria-hidden="true" className="h-5 w-5" />}
          title="No matching templates"
        />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredTemplates.map((template) => (
            <Card className="p-5" key={template.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="teal">{template.course_code}</Badge>
                    {template.department ? (
                      <Badge tone="ink">{template.department}</Badge>
                    ) : null}
                    <Badge tone={confidenceTone(template.extraction_confidence)}>
                      {formatConfidence(template.extraction_confidence)}
                    </Badge>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-ink-900">
                    {template.course_name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink-500">
                    {template.description ??
                      "Template created from local course materials."}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <BookMarked aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
                  <p className="text-ink-500">Materials</p>
                  <p className="mt-1 font-semibold text-ink-900">
                    {template.materials.length}
                  </p>
                </div>
              </div>

              {template.assessments.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {template.assessments.slice(0, 5).map((assessment) => (
                    <Badge key={assessment.id} tone="gold">
                      {assessment.name} {Number(assessment.weight_percentage)}%
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
                  Grading breakdown unclear. You can still import the course and
                  add assessments manually.
                </p>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="block">
                  <span className="text-sm font-medium text-ink-700">
                    Import to semester
                  </span>
                  <select
                    className={`${inputStyles} mt-1`}
                    disabled={semesters.length === 0}
                    onChange={(event) =>
                      setSelectedSemesters((current) => ({
                        ...current,
                        [template.id]: event.target.value
                      }))
                    }
                    value={selectedSemesters[template.id] ?? ""}
                  >
                    {semesters.length === 0 ? (
                      <option value="">Create a semester first</option>
                    ) : null}
                    {semesters.map((semester) => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    ))}
                  </select>
                </label>
                {semesters.length === 0 ? (
                  <Link
                    className={buttonStyles({ variant: "secondary" })}
                    href="/semesters"
                  >
                    Create semester
                  </Link>
                ) : (
                  <Button
                    disabled={importingTemplateId === template.id}
                    onClick={() => void importTemplate(template)}
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    {importingTemplateId === template.id
                      ? "Importing..."
                      : "Import"}
                  </Button>
                )}
              </div>

              {template.source_file_name ? (
                <p className="mt-4 truncate text-xs text-ink-400">
                  Source: {template.source_file_name}
                </p>
              ) : null}
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
