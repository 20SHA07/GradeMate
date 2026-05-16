"use client";

import { BookOpen, CalendarDays, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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

type AssessmentForm = {
  title: string;
  weight: string;
  score: string;
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

const defaultAssessmentForm: AssessmentForm = {
  title: "Midterm",
  weight: "",
  score: ""
};

export function SemestersManager() {
  const { supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [semesterForm, setSemesterForm] =
    useState<SemesterForm>(defaultSemesterForm);
  const [courseForm, setCourseForm] = useState<CourseForm>(defaultCourseForm);
  const [assessmentForms, setAssessmentForms] = useState<
    Record<string, AssessmentForm>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSemesters() {
      setIsLoading(true);
      setError("");

      const [semesterResponse, courseResponse, assessmentResponse] =
        await Promise.all([
          supabase
            .from("semesters")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("courses")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("assessments")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
        ]);

      if (
        semesterResponse.error ||
        courseResponse.error ||
        assessmentResponse.error
      ) {
        setError(
          semesterResponse.error?.message ??
            courseResponse.error?.message ??
            assessmentResponse.error?.message ??
            "Could not load semesters."
        );
        setIsLoading(false);
        return;
      }

      const loadedSemesters = semesterResponse.data ?? [];
      setSemesters(loadedSemesters);
      setCourses(courseResponse.data ?? []);
      setAssessments(assessmentResponse.data ?? []);
      setSelectedSemesterId((current) => current || loadedSemesters[0]?.id || "");
      setIsLoading(false);
    }

    void loadSemesters();
  }, [supabase, user.id]);

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

  function getAssessmentForm(courseId: string) {
    return assessmentForms[courseId] ?? defaultAssessmentForm;
  }

  function updateAssessmentForm(
    courseId: string,
    field: keyof AssessmentForm,
    value: string
  ) {
    setAssessmentForms((current) => ({
      ...current,
      [courseId]: {
        ...getAssessmentForm(courseId),
        [field]: value
      }
    }));
  }

  async function createSemester(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    const { data, error: createError } = await supabase
      .from("semesters")
      .insert({
        user_id: user.id,
        name: semesterForm.name,
        academic_year: semesterForm.academicYear || null,
        term: semesterForm.term
      })
      .select()
      .single();

    setIsSaving(false);

    const createdSemester = data as SemesterRecord | null;

    if (createError || !createdSemester) {
      setError(createError?.message ?? "Could not create semester.");
      return;
    }

    setSemesters((current) => [createdSemester, ...current]);
    setSelectedSemesterId(createdSemester.id);
    setSemesterForm(defaultSemesterForm);
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedSemester) {
      return;
    }

    setError("");
    setIsSaving(true);

    const { data, error: createError } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        semester_id: selectedSemester.id,
        name: courseForm.name,
        code: courseForm.code || null,
        credit_hours: Number(courseForm.creditHours) || 3
      })
      .select()
      .single();

    setIsSaving(false);

    const createdCourse = data as CourseRecord | null;

    if (createError || !createdCourse) {
      setError(createError?.message ?? "Could not create course.");
      return;
    }

    setCourses((current) => [createdCourse, ...current]);
    setCourseForm(defaultCourseForm);
  }

  async function createAssessment(
    event: FormEvent<HTMLFormElement>,
    courseId: string
  ) {
    event.preventDefault();
    const form = getAssessmentForm(courseId);
    setError("");

    const { data, error: createError } = await supabase
      .from("assessments")
      .insert({
        user_id: user.id,
        course_id: courseId,
        title: form.title,
        weight: Number(form.weight) || 0,
        score: form.score === "" ? null : Number(form.score)
      })
      .select()
      .single();

    const createdAssessment = data as AssessmentRecord | null;

    if (createError || !createdAssessment) {
      setError(createError?.message ?? "Could not create assessment.");
      return;
    }

    setAssessments((current) => [...current, createdAssessment]);
    setAssessmentForms((current) => ({
      ...current,
      [courseId]: defaultAssessmentForm
    }));
  }

  async function addDefaultAssessments(courseId: string) {
    setError("");

    const rows = assessmentTitles.map((title) => ({
      user_id: user.id,
      course_id: courseId,
      title,
      weight: 0,
      score: null
    }));

    const { data, error: createError } = await supabase
      .from("assessments")
      .insert(rows)
      .select();

    const createdAssessments = data as AssessmentRecord[] | null;

    if (createError || !createdAssessments) {
      setError(createError?.message ?? "Could not add default assessments.");
      return;
    }

    setAssessments((current) => [...current, ...createdAssessments]);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        description="Create semesters, open one, then add courses and weighted assessments inside it."
        eyebrow="Planning"
        title="Semesters"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-ink-900">
              Create semester
            </h2>
            <form className="mt-5 space-y-4" onSubmit={createSemester}>
              <label className="block">
                <span className="text-sm font-medium text-ink-700">
                  Semester name
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
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
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) =>
                    setSemesterForm((current) => ({
                      ...current,
                      academicYear: event.target.value
                    }))
                  }
                  placeholder="2026"
                  value={semesterForm.academicYear}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-ink-700">Term</span>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
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

              <Button disabled={isSaving} type="submit">
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                {isSaving ? "Saving..." : "Create semester"}
              </Button>
            </form>
          </Card>

          <Card className="p-3">
            {isLoading ? (
              <p className="p-3 text-sm text-ink-500">Loading semesters...</p>
            ) : semesters.length === 0 ? (
              <div className="p-3 text-sm text-ink-500">No semesters yet.</div>
            ) : (
              <div className="space-y-2">
                {semesters.map((semester) => {
                  const isSelected = semester.id === selectedSemesterId;
                  const courseCount = courses.filter(
                    (course) => course.semester_id === semester.id
                  ).length;

                  return (
                    <button
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left transition",
                        isSelected
                          ? "border-teal-200 bg-teal-50"
                          : "border-transparent hover:bg-ink-50"
                      )}
                      key={semester.id}
                      onClick={() => setSelectedSemesterId(semester.id)}
                      type="button"
                    >
                      <span className="block text-sm font-semibold text-ink-900">
                        {semester.name}
                      </span>
                      <span className="mt-1 block text-xs text-ink-500">
                        {semester.term || "Term"} - {courseCount} courses
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {selectedSemester ? (
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-teal-700">
                  {selectedSemester.term || "Term"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-ink-900">
                  {selectedSemester.name}
                </h2>
                <p className="mt-2 text-sm text-ink-500">
                  {selectedSemester.academic_year || "Academic year not set"}
                </p>
              </div>
              <Badge tone="teal">{selectedCourses.length} courses</Badge>
            </div>

            <form
              className="mt-6 grid gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3 md:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]"
              onSubmit={createCourse}
            >
              <label className="block">
                <span className="text-xs font-medium text-ink-500">
                  Course name
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
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
                <span className="text-xs font-medium text-ink-500">Code</span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
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
                <span className="text-xs font-medium text-ink-500">
                  Credit hours
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
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
              <div className="flex items-end">
                <Button className="w-full md:w-auto" disabled={isSaving} type="submit">
                  Add course
                </Button>
              </div>
            </form>

            <div className="mt-6 space-y-4">
              {selectedCourses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white text-ink-700">
                    <BookOpen aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink-900">
                    No courses in this semester
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500">
                    Add a course to this semester, then define its weighted
                    assessment categories.
                  </p>
                </div>
              ) : (
                selectedCourses.map((course) => {
                  const courseAssessments = getAssessmentsForCourse(course.id);
                  const form = getAssessmentForm(course.id);
                  const totalWeight = courseAssessments.reduce(
                    (sum, assessment) => sum + Number(assessment.weight || 0),
                    0
                  );

                  return (
                    <div
                      className="rounded-lg border border-ink-200 bg-white p-4"
                      key={course.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-teal-700">
                            {course.code || "Course"}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold text-ink-900">
                            {course.name}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="ink">
                            {Number(course.credit_hours)} credits
                          </Badge>
                          <Badge tone={totalWeight === 100 ? "green" : "gold"}>
                            {totalWeight}% weight
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {courseAssessments.map((assessment) => (
                          <div
                            className="rounded-lg bg-ink-50 px-3 py-2 text-sm"
                            key={assessment.id}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-ink-800">
                                {assessment.title}
                              </span>
                              <span className="text-ink-500">
                                {Number(assessment.weight)}%
                              </span>
                            </div>
                            {assessment.score !== null ? (
                              <p className="mt-1 text-xs text-ink-500">
                                Score: {Number(assessment.score)}%
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <form
                        className="mt-4 grid gap-3 rounded-lg bg-ink-50 p-3 md:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]"
                        onSubmit={(event) => createAssessment(event, course.id)}
                      >
                        <label className="block">
                          <span className="text-xs font-medium text-ink-500">
                            Assessment
                          </span>
                          <select
                            className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                            onChange={(event) =>
                              updateAssessmentForm(
                                course.id,
                                "title",
                                event.target.value
                              )
                            }
                            value={form.title}
                          >
                            {assessmentTitles.map((title) => (
                              <option key={title} value={title}>
                                {title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-ink-500">
                            Weight
                          </span>
                          <input
                            className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                            min="0"
                            onChange={(event) =>
                              updateAssessmentForm(
                                course.id,
                                "weight",
                                event.target.value
                              )
                            }
                            placeholder="25"
                            required
                            type="number"
                            value={form.weight}
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium text-ink-500">
                            Score
                          </span>
                          <input
                            className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                            min="0"
                            onChange={(event) =>
                              updateAssessmentForm(
                                course.id,
                                "score",
                                event.target.value
                              )
                            }
                            placeholder="Optional"
                            type="number"
                            value={form.score}
                          />
                        </label>
                        <div className="flex items-end gap-2">
                          <Button className="w-full md:w-auto" type="submit">
                            Add
                          </Button>
                        </div>
                      </form>

                      {courseAssessments.length === 0 ? (
                        <Button
                          className="mt-3"
                          onClick={() => addDefaultAssessments(course.id)}
                          variant="secondary"
                        >
                          <CalendarDays aria-hidden="true" className="h-4 w-4" />
                          Add common assessments
                        </Button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        ) : (
          <EmptyState
            description="Create a semester to start organizing courses."
            icon={<CalendarDays aria-hidden="true" className="h-5 w-5" />}
            title="Select a semester"
          />
        )}
      </section>
    </div>
  );
}
