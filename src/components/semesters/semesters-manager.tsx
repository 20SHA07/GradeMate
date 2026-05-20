"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, PlusCircle, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { calculateGpa } from "@/lib/gpa";
import {
  formatPercent,
  getAssessmentWeight,
  getCourseGradeSummary,
  getLetterGrade
} from "@/lib/grades";
import { getGradeInfo } from "@/lib/grading";
import {
  createAssessment as storeCreateAssessment,
  createCourse as storeCreateCourse,
  createSemester as storeCreateSemester,
  getWorkspaceSnapshot
} from "@/lib/workspace-store";
import { getCourseDetailHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

const terms = ["Fall", "Spring", "Summer"];
const assessmentTitles = [
  "Midterm",
  "Final",
  "Quizzes",
  "Assignments",
  "Projects"
];

type SemesterForm = {
  name: string;
  academicYear: string;
  term: string;
};

type CourseForm = {
  name: string;
  code: string;
  creditHours: string;
};

const defaultSemesterForm: SemesterForm = {
  name: "",
  academicYear: "",
  term: "Fall"
};

const defaultCourseForm: CourseForm = {
  name: "",
  code: "",
  creditHours: "3"
};

const inputStyles =
  "mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

export function SemestersManager() {
  const { isGuest, supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [semesterForm, setSemesterForm] =
    useState<SemesterForm>(defaultSemesterForm);
  const [courseForm, setCourseForm] = useState<CourseForm>(defaultCourseForm);
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSemesters() {
      setIsLoading(true);
      setError("");

      try {
        const snapshot = await getWorkspaceSnapshot({
          isGuest,
          supabase,
          userId: user.id
        });

        setSemesters(snapshot.semesters);
        setCourses(snapshot.courses);
        setAssessments(snapshot.assessments);
        setSelectedSemesterId(
          (current) => current || snapshot.semesters[0]?.id || ""
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load semesters."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadSemesters();
  }, [isGuest, supabase, user.id]);

  useEffect(() => {
    if (window.location.hash === "#create-semester") {
      setIsSemesterModalOpen(true);
    }
  }, []);

  const selectedSemester = useMemo(
    () => semesters.find((semester) => semester.id === selectedSemesterId),
    [selectedSemesterId, semesters]
  );

  const selectedCourses = useMemo(
    () =>
      courses.filter((course) => course.semester_id === selectedSemesterId),
    [courses, selectedSemesterId]
  );

  function getAssessmentsForCourse(courseId: string) {
    return assessments.filter((assessment) => assessment.course_id === courseId);
  }

  function getSemesterStats(semesterId: string) {
    const semesterCourses = courses.filter(
      (course) => course.semester_id === semesterId
    );
    const credits = semesterCourses.reduce(
      (sum, course) => sum + Number(course.credit_hours || 0),
      0
    );
    const gpaCourses = semesterCourses
      .map((course) => {
        const summary = getCourseGradeSummary(getAssessmentsForCourse(course.id));

        if (summary.currentGrade === null) {
          return null;
        }

        return {
          id: course.id,
          name: course.name,
          credits: Number(course.credit_hours || 0),
          gradePoints: getGradeInfo(summary.currentGrade).points
        };
      })
      .filter((course): course is NonNullable<typeof course> => Boolean(course));
    const gpa = gpaCourses.length > 0 ? calculateGpa(gpaCourses).gpa : null;

    return {
      courses: semesterCourses,
      credits,
      gpa
    };
  }

  async function createSemester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const createdSemester = await storeCreateSemester(
        { isGuest, supabase, userId: user.id },
        {
          name: semesterForm.name,
          academic_year: semesterForm.academicYear || null,
          term: semesterForm.term
        }
      );

      setSemesters((current) => [createdSemester, ...current]);
      setSelectedSemesterId(createdSemester.id);
      setSemesterForm(defaultSemesterForm);
      setIsSemesterModalOpen(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create semester."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSemester) {
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const createdCourse = await storeCreateCourse(
        { isGuest, supabase, userId: user.id },
        {
          semester_id: selectedSemester.id,
          name: courseForm.name,
          code: courseForm.code || null,
          credit_hours: Number(courseForm.creditHours) || 3
        }
      );

      setCourses((current) => [createdCourse, ...current]);
      setCourseForm(defaultCourseForm);
      setIsCourseModalOpen(false);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create course."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function addDefaultAssessments(courseId: string) {
    setError("");

    try {
      const createdAssessments = await Promise.all(
        assessmentTitles.map((name) =>
          storeCreateAssessment(
            { isGuest, supabase, userId: user.id },
            {
              course_id: courseId,
              name,
              weight_percentage: 0,
              score: null,
              max_score: null,
              category: "Planned",
              title: name,
              weight: 0
            }
          )
        )
      );

      setAssessments((current) => [...current, ...createdAssessments]);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not add default assessments."
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Button onClick={() => setIsSemesterModalOpen(true)}>
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              New semester
            </Button>
            <Link
              className={buttonStyles({ variant: "secondary" })}
              href="/course-library"
            >
              Import course
            </Link>
          </>
        }
        description="Keep each term tidy, then open a course when you are ready to add scores."
        title="Semesters"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">Loading semesters...</Card>
      ) : semesters.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setIsSemesterModalOpen(true)}>
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              New semester
            </Button>
          }
          description="Create your first semester to start tracking your GPA."
          icon={<CalendarDays aria-hidden="true" className="h-5 w-5" />}
          title="No semesters yet"
        />
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {semesters.map((semester) => {
            const stats = getSemesterStats(semester.id);
            const isSelected = semester.id === selectedSemesterId;

            return (
              <Card
                className={cn(
                  "p-4 transition-colors",
                  isSelected ? "border-teal-200 bg-teal-50" : "hover:bg-white/80"
                )}
                key={semester.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-teal-700">
                      {semester.term || "Term"} {semester.academic_year || ""}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-ink-900">
                      {semester.name}
                    </h2>
                  </div>
                  <Button
                    onClick={() => setSelectedSemesterId(semester.id)}
                    size="sm"
                    variant={isSelected ? "primary" : "secondary"}
                  >
                    Open
                  </Button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-xs text-ink-500">Courses</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {stats.courses.length}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-xs text-ink-500">Credits</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {stats.credits}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3">
                    <p className="text-xs text-ink-500">GPA</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {stats.gpa === null ? "-" : stats.gpa.toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {selectedSemester ? (
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-teal-700">
                Open semester
              </p>
              <h2 className="mt-1 text-[26px] font-bold leading-tight text-ink-900">
                {selectedSemester.name}
              </h2>
              <p className="mt-2 text-sm text-ink-500">
                {selectedSemester.academic_year || "Academic year not set"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setIsCourseModalOpen(true)}>
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                Add course
              </Button>
              <Link
                className={buttonStyles({ variant: "secondary" })}
                href="/course-library"
              >
                Import course
              </Link>
            </div>
          </div>

          {selectedCourses.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-ink-200 bg-ink-100 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white/80 text-teal-700">
                <BookOpen aria-hidden="true" className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink-900">
                No courses yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500">
                Add your first course or import a library course.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <Button onClick={() => setIsCourseModalOpen(true)}>
                  Add course
                </Button>
                <Link
                  className={buttonStyles({ variant: "secondary" })}
                  href="/course-library"
                >
                  Browse course library
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 lg:grid-cols-2">
              {selectedCourses.map((course) => {
                const courseAssessments = getAssessmentsForCourse(course.id);
                const totalWeight = courseAssessments.reduce(
                  (sum, assessment) => sum + getAssessmentWeight(assessment),
                  0
                );
                const gradeSummary = getCourseGradeSummary(courseAssessments);

                return (
                  <div className="rounded-lg bg-ink-100 p-4" key={course.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-teal-700">
                          {course.code || "Course"}
                        </p>
                        <h3 className="mt-1 truncate text-lg font-semibold text-ink-900">
                          {course.name}
                        </h3>
                      </div>
                      <Badge tone="ink">{Number(course.credit_hours)} credits</Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg bg-white/80 p-3">
                        <p className="text-xs text-ink-500">Grade</p>
                        <p className="mt-1 font-semibold text-ink-900">
                          {formatPercent(gradeSummary.currentGrade)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/80 p-3">
                        <p className="text-xs text-ink-500">Letter</p>
                        <p className="mt-1 font-semibold text-ink-900">
                          {getLetterGrade(gradeSummary.currentGrade)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/80 p-3">
                        <p className="text-xs text-ink-500">Weight</p>
                        <p className="mt-1 font-semibold text-ink-900">
                          {totalWeight}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        className={buttonStyles({ size: "sm" })}
                        href={getCourseDetailHref(course.id)}
                        prefetch={false}
                      >
                        Open course
                        <ArrowRight aria-hidden="true" className="h-4 w-4" />
                      </Link>
                      {courseAssessments.length === 0 ? (
                        <Button
                          onClick={() => addDefaultAssessments(course.id)}
                          size="sm"
                          variant="secondary"
                        >
                          Add common grading items
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}

      {isSemesterModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <Card className="w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink-900">
                  New semester
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Name the term. You can add courses next.
                </p>
              </div>
              <Button
                aria-label="Close"
                onClick={() => setIsSemesterModalOpen(false)}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={createSemester}>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Semester name
                </span>
                <input
                  className={inputStyles}
                  onChange={(event) =>
                    setSemesterForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder="Fall 2026"
                  required
                  value={semesterForm.name}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Academic year
                </span>
                <input
                  className={inputStyles}
                  onChange={(event) =>
                    setSemesterForm((current) => ({
                      ...current,
                      academicYear: event.target.value
                    }))
                  }
                  placeholder="2026-2027"
                  value={semesterForm.academicYear}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">Term</span>
                <select
                  className={inputStyles}
                  onChange={(event) =>
                    setSemesterForm((current) => ({
                      ...current,
                      term: event.target.value
                    }))
                  }
                  value={semesterForm.term}
                >
                  {terms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </label>
              <Button className="w-full" disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Create semester"}
              </Button>
            </form>
          </Card>
        </div>
      ) : null}

      {isCourseModalOpen && selectedSemester ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <Card className="w-full max-w-md p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink-900">
                  Add course
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Add a course to {selectedSemester.name}.
                </p>
              </div>
              <Button
                aria-label="Close"
                onClick={() => setIsCourseModalOpen(false)}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
            <form className="mt-5 space-y-4" onSubmit={createCourse}>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Course name
                </span>
                <input
                  className={inputStyles}
                  onChange={(event) =>
                    setCourseForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder="Data Structures"
                  required
                  value={courseForm.name}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Course code
                </span>
                <input
                  className={inputStyles}
                  onChange={(event) =>
                    setCourseForm((current) => ({
                      ...current,
                      code: event.target.value
                    }))
                  }
                  placeholder="CS 230"
                  value={courseForm.code}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Credit hours
                </span>
                <input
                  className={inputStyles}
                  min="0"
                  onChange={(event) =>
                    setCourseForm((current) => ({
                      ...current,
                      creditHours: event.target.value
                    }))
                  }
                  step="0.5"
                  type="number"
                  value={courseForm.creditHours}
                />
              </label>
              <Button className="w-full" disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Add course"}
              </Button>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
