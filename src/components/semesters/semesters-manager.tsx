"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  formatPercent,
  getAssessmentName,
  getAssessmentWeight,
  getCourseGradeSummary,
  getLetterGrade
} from "@/lib/grades";
import {
  createGuestId,
  readGuestData,
  writeGuestData
} from "@/lib/guest-session";
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

type AssessmentForm = {
  name: string;
  weightPercentage: string;
  score: string;
  maxScore: string;
  category: string;
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
  name: "",
  weightPercentage: "",
  score: "",
  maxScore: "100",
  category: "Planned"
};

export function SemestersManager() {
  const { isGuest, supabase, user } = useAuth();
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

      if (isGuest) {
        const guestData = readGuestData();
        setSemesters(guestData.semesters);
        setCourses(guestData.courses);
        setAssessments(guestData.assessments);
        setSelectedSemesterId(
          (current) => current || guestData.semesters[0]?.id || ""
        );
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setError("Log in to load saved semesters.");
        setIsLoading(false);
        return;
      }

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

      const loadedSemesters = (semesterResponse.data ?? []) as SemesterRecord[];
      setSemesters(loadedSemesters);
      setCourses((courseResponse.data ?? []) as CourseRecord[]);
      setAssessments((assessmentResponse.data ?? []) as AssessmentRecord[]);
      setSelectedSemesterId((current) => current || loadedSemesters[0]?.id || "");
      setIsLoading(false);
    }

    void loadSemesters();
  }, [isGuest, supabase, user.id]);

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

    if (isGuest) {
      const createdSemester: SemesterRecord = {
        id: createGuestId("semester"),
        user_id: user.id,
        name: semesterForm.name,
        academic_year: semesterForm.academicYear || null,
        term: semesterForm.term,
        created_at: new Date().toISOString()
      };
      const nextSemesters = [createdSemester, ...semesters];

      setSemesters(nextSemesters);
      setSelectedSemesterId(createdSemester.id);
      setSemesterForm(defaultSemesterForm);
      writeGuestData({ semesters: nextSemesters, courses, assessments });
      setIsSaving(false);
      return;
    }

    if (!supabase) {
      setError("Log in to save semesters.");
      setIsSaving(false);
      return;
    }

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

    if (isGuest) {
      const createdCourse: CourseRecord = {
        id: createGuestId("course"),
        user_id: user.id,
        semester_id: selectedSemester.id,
        name: courseForm.name,
        code: courseForm.code || null,
        credit_hours: Number(courseForm.creditHours) || 3,
        created_at: new Date().toISOString()
      };
      const nextCourses = [createdCourse, ...courses];

      setCourses(nextCourses);
      setCourseForm(defaultCourseForm);
      writeGuestData({ semesters, courses: nextCourses, assessments });
      setIsSaving(false);
      return;
    }

    if (!supabase) {
      setError("Log in to save courses.");
      setIsSaving(false);
      return;
    }

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

    if (isGuest) {
      const createdAssessment: AssessmentRecord = {
        id: createGuestId("assessment"),
        user_id: user.id,
        course_id: courseId,
        name: form.name,
        weight_percentage: Number(form.weightPercentage) || 0,
        score: form.score === "" ? null : Number(form.score),
        max_score: form.maxScore === "" ? null : Number(form.maxScore),
        category: form.category,
        title: form.name,
        weight: Number(form.weightPercentage) || 0,
        created_at: new Date().toISOString()
      };
      const nextAssessments = [...assessments, createdAssessment];

      setAssessments(nextAssessments);
      setAssessmentForms((current) => ({
        ...current,
        [courseId]: defaultAssessmentForm
      }));
      writeGuestData({ semesters, courses, assessments: nextAssessments });
      return;
    }

    if (!supabase) {
      setError("Log in to save assessments.");
      return;
    }

    const { data, error: createError } = await supabase
      .from("assessments")
      .insert({
        user_id: user.id,
        course_id: courseId,
        name: form.name,
        weight_percentage: Number(form.weightPercentage) || 0,
        score: form.score === "" ? null : Number(form.score),
        max_score: form.maxScore === "" ? null : Number(form.maxScore),
        category: form.category,
        title: form.name,
        weight: Number(form.weightPercentage) || 0
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

    if (isGuest) {
      const createdAssessments: AssessmentRecord[] = assessmentTitles.map(
        (name) => ({
          id: createGuestId("assessment"),
          user_id: user.id,
          course_id: courseId,
          name,
          weight_percentage: 0,
          score: null,
          max_score: null,
          category: "Planned",
          title: name,
          weight: 0,
          created_at: new Date().toISOString()
        })
      );
      const nextAssessments = [...assessments, ...createdAssessments];

      setAssessments(nextAssessments);
      writeGuestData({ semesters, courses, assessments: nextAssessments });
      return;
    }

    if (!supabase) {
      setError("Log in to save assessments.");
      return;
    }

    const rows = assessmentTitles.map((name) => ({
      user_id: user.id,
      course_id: courseId,
      name,
      weight_percentage: 0,
      score: null,
      max_score: null,
      category: "Planned",
      title: name,
      weight: 0
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
    <div className="space-y-6">
      <PageHeader
        actions={
          <Link
            className={buttonStyles({ variant: "secondary" })}
            href="/course-library"
          >
            Import from library
          </Link>
        }
        description="Create terms, add courses, and keep each grading plan easy to scan."
        title="Semesters"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-5" id="create-semester">
            <h2 className="text-lg font-semibold text-ink-900">
              Create semester
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Start with the term name. You can add courses right after.
            </p>
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
                        "w-full rounded-2xl border px-3 py-3 text-left transition",
                        isSelected
                          ? "border-teal-200 bg-teal-50"
                          : "border-transparent bg-ink-100 hover:bg-ink-100"
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
              <div className="flex flex-wrap gap-2">
                <Badge tone="teal">{selectedCourses.length} courses</Badge>
                <Badge tone="ink">
                  {selectedCourses.reduce(
                    (sum, course) => sum + Number(course.credit_hours || 0),
                    0
                  )}{" "}
                  credits
                </Badge>
              </div>
            </div>

            <form
              className="mt-5 grid gap-3 rounded-2xl bg-ink-100 p-3 md:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]"
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
                <div className="rounded-2xl border border-dashed border-ink-200 bg-ink-100 p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-teal-700">
                    <BookOpen aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink-900">
                    No courses in this semester
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500">
                    Add your first course, or import a syllabus-created
                    template from the library.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <Link className={buttonStyles()} href="/course-library">
                      Import from library
                    </Link>
                  </div>
                </div>
              ) : (
                selectedCourses.map((course) => {
                  const courseAssessments = getAssessmentsForCourse(course.id);
                  const form = getAssessmentForm(course.id);
                  const totalWeight = courseAssessments.reduce(
                    (sum, assessment) => sum + getAssessmentWeight(assessment),
                    0
                  );
                  const gradeSummary = getCourseGradeSummary(courseAssessments);

                  return (
                    <div
                      className="rounded-2xl bg-ink-100 p-4"
                      key={course.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-teal-700">
                            {course.code || "Course"}
                          </p>
                          <Link
                            className="mt-1 block text-lg font-semibold text-ink-900 transition-colors hover:text-teal-700"
                            href={getCourseDetailHref(course.id)}
                            prefetch={false}
                          >
                            {course.name}
                          </Link>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="ink">
                            {Number(course.credit_hours)} credits
                          </Badge>
                          <Badge tone={totalWeight === 100 ? "green" : "gold"}>
                            {totalWeight}% weight
                          </Badge>
                          <Badge tone="teal">
                            {formatPercent(gradeSummary.currentGrade)} -{" "}
                            {getLetterGrade(gradeSummary.currentGrade)}
                          </Badge>
                          <Link
                            className={buttonStyles({
                              size: "sm",
                              variant: "secondary"
                            })}
                            href={getCourseDetailHref(course.id)}
                            prefetch={false}
                          >
                            Open course
                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {courseAssessments.map((assessment) => (
                          <div
                            className="rounded-xl bg-white/80 px-3 py-2 text-sm"
                            key={assessment.id}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-ink-800">
                                {getAssessmentName(assessment)}
                              </span>
                              <span className="text-ink-500">
                                {getAssessmentWeight(assessment)}%
                              </span>
                            </div>
                            {assessment.score !== null ? (
                              <p className="mt-1 text-xs text-ink-500">
                                Score: {Number(assessment.score)}
                                {assessment.max_score
                                  ? ` / ${Number(assessment.max_score)}`
                                  : "%"}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <form
                        className="mt-4 grid gap-3 rounded-2xl bg-white/80 p-3 md:grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_auto]"
                        onSubmit={(event) => createAssessment(event, course.id)}
                      >
                        <label className="block">
                          <span className="text-xs font-medium text-ink-500">
                            Assessment
                          </span>
                          <input
                            className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                            list={`assessment-options-${course.id}`}
                            onChange={(event) =>
                              updateAssessmentForm(
                                course.id,
                                "name",
                                event.target.value
                              )
                            }
                            placeholder="Midterm, Lab, Participation..."
                            required
                            value={form.name}
                          />
                          <datalist id={`assessment-options-${course.id}`}>
                            {assessmentTitles.map((title) => (
                              <option key={title} value={title}>
                                {title}
                              </option>
                            ))}
                          </datalist>
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
                                "weightPercentage",
                                event.target.value
                              )
                            }
                            placeholder="25"
                            required
                            type="number"
                            value={form.weightPercentage}
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
                        <label className="block">
                          <span className="text-xs font-medium text-ink-500">
                            Max
                          </span>
                          <input
                            className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                            min="0"
                            onChange={(event) =>
                              updateAssessmentForm(
                                course.id,
                                "maxScore",
                                event.target.value
                              )
                            }
                            placeholder="100"
                            type="number"
                            value={form.maxScore}
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
