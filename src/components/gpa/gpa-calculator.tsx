"use client";

import {
  Calculator,
  CheckSquare,
  CircleOff,
  GraduationCap,
  Layers3,
  Sparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { formatPercent, getCourseGradeSummary } from "@/lib/grades";
import {
  calculateGpa,
  getGradePoints,
  gradeOptions,
  percentageToLetterGrade,
  type GpaCourseInput
} from "@/lib/gpa";
import { readGuestData } from "@/lib/guest-session";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

type WhatIfForm = {
  courseName: string;
  credits: string;
  expectedGrade: string;
};

const defaultWhatIfForm: WhatIfForm = {
  courseName: "",
  credits: "3",
  expectedGrade: "A"
};

const inputStyles =
  "mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

function formatGpa(value: number) {
  return value.toFixed(2);
}

function getCoursePercentage(assessments: AssessmentRecord[]) {
  const summary = getCourseGradeSummary(assessments);

  return summary.currentGrade ?? summary.finalProjectedGrade;
}

export function GpaCalculator() {
  const { isGuest, supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [selectedSemesterIds, setSelectedSemesterIds] = useState<string[]>([]);
  const [manualGrades, setManualGrades] = useState<Record<string, string>>({});
  const [whatIfForm, setWhatIfForm] =
    useState<WhatIfForm>(defaultWhatIfForm);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadGpaData() {
      setIsLoading(true);
      setError("");

      if (isGuest) {
        const guestData = readGuestData();
        setSemesters(guestData.semesters);
        setCourses(guestData.courses);
        setAssessments(guestData.assessments);
        setSelectedSemesterIds((current) =>
          current.length > 0
            ? current
            : guestData.semesters.map((semester) => semester.id)
        );
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setError("Log in to load GPA data.");
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
            "Could not load GPA data."
        );
        setIsLoading(false);
        return;
      }

      const loadedSemesters = (semesterResponse.data ?? []) as SemesterRecord[];

      setSemesters(loadedSemesters);
      setCourses((courseResponse.data ?? []) as CourseRecord[]);
      setAssessments((assessmentResponse.data ?? []) as AssessmentRecord[]);
      setSelectedSemesterIds((current) =>
        current.length > 0
          ? current
          : loadedSemesters.map((semester) => semester.id)
      );
      setIsLoading(false);
    }

    void loadGpaData();
  }, [isGuest, supabase, user.id]);

  const assessmentsByCourseId = useMemo(() => {
    const groupedAssessments = new Map<string, AssessmentRecord[]>();

    assessments.forEach((assessment) => {
      groupedAssessments.set(assessment.course_id, [
        ...(groupedAssessments.get(assessment.course_id) ?? []),
        assessment
      ]);
    });

    return groupedAssessments;
  }, [assessments]);

  const selectedCourses = useMemo(
    () =>
      courses.filter((course) =>
        selectedSemesterIds.includes(course.semester_id)
      ),
    [courses, selectedSemesterIds]
  );

  const gpaRows = useMemo(() => {
    return selectedCourses.map((course) => {
      const courseAssessments = assessmentsByCourseId.get(course.id) ?? [];
      const coursePercentage = getCoursePercentage(courseAssessments);
      const automaticLetterGrade = percentageToLetterGrade(coursePercentage);
      const selectedLetterGrade =
        manualGrades[course.id] || automaticLetterGrade;

      return {
        course,
        percentage: coursePercentage,
        automaticLetterGrade,
        selectedLetterGrade,
        isManual: Boolean(manualGrades[course.id]),
        gradePoints: selectedLetterGrade
          ? getGradePoints(selectedLetterGrade)
          : null
      };
    });
  }, [assessmentsByCourseId, manualGrades, selectedCourses]);

  const includedCourseInputs = useMemo<GpaCourseInput[]>(
    () =>
      gpaRows
        .filter((row) => row.gradePoints !== null)
        .map((row) => ({
          id: row.course.id,
          name: row.course.name,
          credits: Number(row.course.credit_hours || 0),
          gradePoints: Number(row.gradePoints)
        })),
    [gpaRows]
  );

  const overallResult = useMemo(
    () => calculateGpa(includedCourseInputs),
    [includedCourseInputs]
  );

  const gpaBySemester = useMemo(() => {
    return semesters
      .filter((semester) => selectedSemesterIds.includes(semester.id))
      .map((semester) => {
        const semesterInputs = includedCourseInputs.filter((courseInput) => {
          const sourceCourse = courses.find(
            (course) => course.id === courseInput.id
          );

          return sourceCourse?.semester_id === semester.id;
        });

        return {
          semester,
          result: calculateGpa(semesterInputs),
          courseCount: semesterInputs.length
        };
      });
  }, [courses, includedCourseInputs, selectedSemesterIds, semesters]);

  const whatIfCourse: GpaCourseInput = useMemo(
    () => ({
      id: "what-if-course",
      name: whatIfForm.courseName || "What-if course",
      credits: Number(whatIfForm.credits) || 0,
      gradePoints: getGradePoints(whatIfForm.expectedGrade)
    }),
    [whatIfForm]
  );

  const projectedResult = useMemo(
    () => calculateGpa([...includedCourseInputs, whatIfCourse]),
    [includedCourseInputs, whatIfCourse]
  );

  function toggleSemester(semesterId: string) {
    setSelectedSemesterIds((current) =>
      current.includes(semesterId)
        ? current.filter((id) => id !== semesterId)
        : [...current, semesterId]
    );
  }

  function updateManualGrade(courseId: string, letterGrade: string) {
    setManualGrades((current) => {
      const nextGrades = { ...current };

      if (letterGrade === "") {
        delete nextGrades[courseId];
      } else {
        nextGrades[courseId] = letterGrade;
      }

      return nextGrades;
    });
  }

  function updateWhatIfForm(field: keyof WhatIfForm, value: string) {
    setWhatIfForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">Loading GPA data...</Card>
      ) : semesters.length === 0 ? (
        <EmptyState
          description="Create semesters and courses first, then return here to calculate GPA."
          icon={<GraduationCap aria-hidden="true" className="h-5 w-5" />}
          title="No semesters yet"
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <Calculator aria-hidden="true" className="h-6 w-6 text-teal-700" />
              <p className="mt-4 text-sm font-medium text-ink-500">
                Current GPA
              </p>
              <p className="mt-1 text-3xl font-semibold text-ink-900">
                {formatGpa(overallResult.gpa)}
              </p>
            </Card>
            <Card className="p-5">
              <CheckSquare aria-hidden="true" className="h-6 w-6 text-lime-700" />
              <p className="mt-4 text-sm font-medium text-ink-500">
                Total credits
              </p>
              <p className="mt-1 text-3xl font-semibold text-ink-900">
                {overallResult.totalCredits}
              </p>
            </Card>
            <Card className="p-5">
              <Layers3 aria-hidden="true" className="h-6 w-6 text-amber-600" />
              <p className="mt-4 text-sm font-medium text-ink-500">
                Courses included
              </p>
              <p className="mt-1 text-3xl font-semibold text-ink-900">
                {includedCourseInputs.length}
              </p>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <Card className="h-fit p-5">
              <h2 className="text-lg font-semibold text-ink-900">
                Include semesters
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Pick which terms should count in this GPA view.
              </p>

              <div className="mt-5 space-y-2">
                {semesters.map((semester) => {
                  const isSelected = selectedSemesterIds.includes(semester.id);
                  const courseCount = courses.filter(
                    (course) => course.semester_id === semester.id
                  ).length;

                  return (
                    <label
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3"
                      key={semester.id}
                    >
                      <input
                        checked={isSelected}
                        className="mt-1 h-4 w-4 accent-teal-700"
                        onChange={() => toggleSemester(semester.id)}
                        type="checkbox"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-900">
                          {semester.name}
                        </span>
                        <span className="mt-1 block text-xs text-ink-500">
                          {semester.term || "Term"} - {courseCount} courses
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-5 rounded-lg border border-ink-200 bg-white p-3">
                <p className="text-sm font-semibold text-ink-900">
                  Grading scale
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {gradeOptions.map((grade) => (
                    <div
                      className="flex items-center justify-between rounded-lg bg-ink-50 px-2 py-1.5"
                      key={grade.label}
                    >
                      <span className="font-medium text-ink-900">
                        {grade.label}
                      </span>
                      <span className="text-ink-500">
                        {grade.points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-ink-200 p-5">
                <h2 className="text-lg font-semibold text-ink-900">
                  Course grades
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Auto uses your course assessment percentage. Select a letter
                  grade to override it.
                </p>
              </div>

              {selectedCourses.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    description="Select at least one semester to include courses in the GPA calculation."
                    icon={<CircleOff aria-hidden="true" className="h-5 w-5" />}
                    title="No courses selected"
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase text-ink-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Course</th>
                        <th className="px-5 py-3 font-semibold">Credits</th>
                        <th className="px-5 py-3 font-semibold">Percentage</th>
                        <th className="px-5 py-3 font-semibold">Grade</th>
                        <th className="px-5 py-3 font-semibold">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {gpaRows.map((row) => (
                        <tr key={row.course.id}>
                          <td className="px-5 py-4">
                            <div className="font-medium text-ink-900">
                              {row.course.name}
                            </div>
                            <div className="mt-1 text-xs text-ink-500">
                              {row.course.code || "Course code not set"}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-ink-700">
                            {Number(row.course.credit_hours)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="w-40">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-ink-900">
                                  {formatPercent(row.percentage)}
                                </span>
                                {row.automaticLetterGrade ? (
                                  <Badge tone="teal">
                                    {row.automaticLetterGrade}
                                  </Badge>
                                ) : null}
                              </div>
                              <Progress
                                className="mt-2"
                                value={row.percentage ?? 0}
                              />
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              className="h-10 w-36 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                              onChange={(event) =>
                                updateManualGrade(
                                  row.course.id,
                                  event.target.value
                                )
                              }
                              value={manualGrades[row.course.id] ?? ""}
                            >
                              <option value="">
                                {row.automaticLetterGrade
                                  ? `Auto (${row.automaticLetterGrade})`
                                  : "Select grade"}
                              </option>
                              {gradeOptions.map((grade) => (
                                <option key={grade.label} value={grade.label}>
                                  {grade.label} ({grade.points.toFixed(1)})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            {row.gradePoints === null ? (
                              <span className="text-ink-400">Not included</span>
                            ) : (
                              <span className="font-semibold text-ink-900">
                                {row.gradePoints.toFixed(1)}
                              </span>
                            )}
                            {row.isManual ? (
                              <span className="ml-2 text-xs text-teal-700">
                                manual
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-ink-900">
                GPA by semester
              </h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {gpaBySemester.map(({ semester, result, courseCount }) => (
                  <div
                    className="rounded-lg border border-ink-200 bg-ink-50 p-4"
                    key={semester.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink-900">
                          {semester.name}
                        </p>
                        <p className="mt-1 text-sm text-ink-500">
                          {courseCount} courses - {result.totalCredits} credits
                        </p>
                      </div>
                      <Badge tone="teal">{formatGpa(result.gpa)}</Badge>
                    </div>
                    <Progress
                      className="mt-4"
                      max={4}
                      value={result.gpa}
                      tone={result.gpa >= 3 ? "green" : "gold"}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    What-if calculator
                  </h2>
                  <p className="mt-1 text-sm text-ink-500">
                    Add one possible course to see the projected GPA.
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <Sparkles aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-ink-700">
                    Course name
                  </span>
                  <input
                    className={inputStyles}
                    onChange={(event) =>
                      updateWhatIfForm("courseName", event.target.value)
                    }
                    placeholder="Organic Chemistry"
                    value={whatIfForm.courseName}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="block">
                    <span className="text-sm font-medium text-ink-700">
                      Credits
                    </span>
                    <input
                      className={inputStyles}
                      min="0"
                      onChange={(event) =>
                        updateWhatIfForm("credits", event.target.value)
                      }
                      step="0.5"
                      type="number"
                      value={whatIfForm.credits}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-ink-700">
                      Expected grade
                    </span>
                    <select
                      className={inputStyles}
                      onChange={(event) =>
                        updateWhatIfForm("expectedGrade", event.target.value)
                      }
                      value={whatIfForm.expectedGrade}
                    >
                      {gradeOptions.map((grade) => (
                        <option key={grade.label} value={grade.label}>
                          {grade.label} ({grade.points.toFixed(1)})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-lg bg-teal-700 p-5 text-white">
                  <p className="text-sm font-medium text-teal-50">
                    Projected GPA
                  </p>
                  <p className="mt-2 text-5xl font-semibold">
                    {formatGpa(projectedResult.gpa)}
                  </p>
                  <p className="mt-2 text-sm text-teal-50">
                    With {projectedResult.totalCredits} total credits
                  </p>
                </div>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
