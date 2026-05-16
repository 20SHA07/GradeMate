"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Edit3,
  Layers3,
  Percent,
  PlusCircle,
  Save,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  formatPercent,
  getAssessmentMaxScore,
  getAssessmentName,
  getAssessmentStatus,
  getAssessmentWeight,
  getCourseGradeSummary,
  getLetterGrade,
  getWeightedContribution,
  isCompletedAssessment
} from "@/lib/grades";
import {
  createGuestId,
  readGuestData,
  writeGuestData
} from "@/lib/guest-session";
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

const assessmentStatuses = ["Planned", "Completed", "Dropped"];
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
  category: "Planned"
};

const inputStyles =
  "mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

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

function buildAssessmentPayload(form: AssessmentForm) {
  const name = form.name.trim();
  const weight = Number(form.weightPercentage) || 0;
  const score = parseOptionalNumber(form.score);
  const maxScore = parseOptionalNumber(form.maxScore);

  return {
    name,
    weight_percentage: weight,
    score,
    max_score: maxScore,
    category: form.category,
    title: name,
    weight
  };
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
  const courseId = courseIdOverride ?? routeCourseId ?? "";
  const { isGuest, supabase, user } = useAuth();
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [semester, setSemester] = useState<SemesterRecord | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [assessmentForm, setAssessmentForm] =
    useState<AssessmentForm>(defaultAssessmentForm);
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourse() {
      setIsLoading(true);
      setError("");

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
        setError(courseResponse.error?.message ?? "Course not found.");
        setIsLoading(false);
        return;
      }

      if (assessmentResponse.error) {
        setError(assessmentResponse.error.message);
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
  }, [courseId, isGuest, supabase, user.id]);

  const gradeSummary = useMemo(
    () => getCourseGradeSummary(assessments),
    [assessments]
  );
  const currentLetterGrade = getLetterGrade(gradeSummary.currentGrade);
  const sortedAssessments = useMemo(
    () =>
      [...assessments].sort(
        (first, second) =>
          new Date(first.created_at).getTime() -
          new Date(second.created_at).getTime()
      ),
    [assessments]
  );

  function updateAssessmentForm(field: keyof AssessmentForm, value: string) {
    setAssessmentForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetAssessmentForm() {
    setAssessmentForm(defaultAssessmentForm);
    setEditingAssessmentId(null);
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

    const response = editingAssessmentId
      ? await supabase
          .from("assessments")
          .update(payload)
          .eq("id", editingAssessmentId)
          .eq("user_id", user.id)
          .select()
          .single()
      : await supabase
          .from("assessments")
          .insert({
            ...payload,
            user_id: user.id,
            course_id: course.id
          })
          .select()
          .single();

    setIsSaving(false);

    const savedAssessment = response.data as AssessmentRecord | null;

    if (response.error || !savedAssessment) {
      setError(response.error?.message ?? "Could not save assessment.");
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
    setAssessmentForm({
      name: getAssessmentName(assessment),
      weightPercentage: String(getAssessmentWeight(assessment)),
      score: toFormValue(assessment.score),
      maxScore: toFormValue(getAssessmentMaxScore(assessment)),
      category: getAssessmentStatus(assessment)
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
      setError(deleteError.message);
      return;
    }

    setAssessments((current) =>
      current.filter((assessment) => assessment.id !== assessmentId)
    );

    if (editingAssessmentId === assessmentId) {
      resetAssessmentForm();
    }
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

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link className={buttonStyles({ variant: "secondary" })} href="/semesters">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to semester
          </Link>
        }
        description={semester?.name ?? "Course details and weighted assessments"}
        eyebrow={course.code || "Course"}
        title={course.name}
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Credit hours</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {Number(course.credit_hours)}
          </p>
          <p className="mt-1 text-sm text-ink-500">Course workload</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Current grade</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {formatPercent(gradeSummary.currentGrade)}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {gradeSummary.completedWeight}% completed weight
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Letter grade</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {currentLetterGrade}
          </p>
          <p className="mt-1 text-sm text-ink-500">Based on current grade</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Total weight</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {gradeSummary.totalWeight}%
          </p>
          <p className="mt-1 text-sm text-ink-500">Target total is 100%</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-500">Remaining weight</p>
          <p className="mt-2 text-3xl font-semibold text-ink-900">
            {gradeSummary.remainingWeight}%
          </p>
          <p className="mt-1 text-sm text-ink-500">Not completed yet</p>
        </Card>
      </section>

      <Card className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="teal">{course.code || "Course code"}</Badge>
              <Badge tone="ink">{Number(course.credit_hours)} credits</Badge>
              {semester ? <Badge tone="gold">{semester.name}</Badge> : null}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink-900">
              Final projection
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
              Current grade uses only assessments with both a score and max
              score. Final projection appears once every active assessment has
              a score.
            </p>
          </div>
          <div className="rounded-lg border border-ink-200 bg-ink-50 p-4">
            <p className="text-sm font-medium text-ink-500">
              Projected final grade
            </p>
            <p className="mt-2 text-3xl font-semibold text-ink-900">
              {formatPercent(gradeSummary.finalProjectedGrade)}
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {gradeSummary.allAssessmentsScored
                ? "All active assessments scored"
                : "Add remaining scores to calculate"}
            </p>
          </div>
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="overflow-hidden">
          <div className="border-b border-ink-200 p-5">
            <h2 className="text-lg font-semibold text-ink-900">
              Assessment table
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Example: 88 / 100 on a 25% midterm contributes 22%.
            </p>
          </div>

          {sortedAssessments.length === 0 ? (
            <div className="p-5">
              <EmptyState
                description="Add your first assessment to start calculating this course grade."
                icon={<Layers3 aria-hidden="true" className="h-5 w-5" />}
                title="No assessments yet"
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase text-ink-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Assessment</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Weight</th>
                    <th className="px-5 py-3 font-semibold">Score</th>
                    <th className="px-5 py-3 font-semibold">Contribution</th>
                    <th className="px-5 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sortedAssessments.map((assessment) => {
                    const status = getAssessmentStatus(assessment);
                    const contribution = getWeightedContribution(assessment);
                    const maxScore = getAssessmentMaxScore(assessment);

                    return (
                      <tr key={assessment.id}>
                        <td className="px-5 py-4">
                          <div className="font-medium text-ink-900">
                            {getAssessmentName(assessment)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={getStatusTone(status)}>{status}</Badge>
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {getAssessmentWeight(assessment)}%
                        </td>
                        <td className="px-5 py-4 text-ink-700">
                          {isCompletedAssessment(assessment)
                            ? `${Number(assessment.score)} / ${Number(maxScore)}`
                            : "Not scored"}
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

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink-900">
                {editingAssessmentId ? "Edit assessment" : "Add assessment"}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Track weights and scores as the course unfolds.
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
                Weighted contribution
              </div>
              <p className="mt-1">
                {assessmentForm.score && assessmentForm.maxScore
                  ? `${formatPercent(
                      (Number(assessmentForm.score) /
                        Number(assessmentForm.maxScore)) *
                        (Number(assessmentForm.weightPercentage) || 0)
                    )} toward the final grade`
                  : "Enter score and max score to preview contribution."}
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
      </section>
    </div>
  );
}
