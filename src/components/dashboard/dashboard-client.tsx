"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Layers3,
  PlusCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { calculateGpa } from "@/lib/gpa";
import {
  formatPercent,
  getCourseGradeSummary
} from "@/lib/grades";
import { getGradeInfo } from "@/lib/grading";
import { readGuestData } from "@/lib/guest-session";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

function formatGpa(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

export function DashboardClient() {
  const { isGuest, supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      if (isGuest) {
        const guestData = readGuestData();
        setSemesters(guestData.semesters);
        setCourses(guestData.courses);
        setAssessments(guestData.assessments);
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        setError("Log in to load your dashboard.");
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
            "Could not load your dashboard."
        );
        setIsLoading(false);
        return;
      }

      setSemesters((semesterResponse.data ?? []) as SemesterRecord[]);
      setCourses((courseResponse.data ?? []) as CourseRecord[]);
      setAssessments((assessmentResponse.data ?? []) as AssessmentRecord[]);
      setIsLoading(false);
    }

    void loadDashboard();
  }, [isGuest, supabase, user.id]);

  const assessmentGroups = useMemo(() => {
    const groups = new Map<string, AssessmentRecord[]>();

    assessments.forEach((assessment) => {
      groups.set(assessment.course_id, [
        ...(groups.get(assessment.course_id) ?? []),
        assessment
      ]);
    });

    return groups;
  }, [assessments]);

  const courseSummaries = useMemo(() => {
    return courses.map((course) => {
      const courseAssessments = assessmentGroups.get(course.id) ?? [];
      const summary = getCourseGradeSummary(courseAssessments);

      return { course, assessments: courseAssessments, summary };
    });
  }, [assessmentGroups, courses]);

  const totalCredits = useMemo(
    () =>
      courses.reduce(
        (sum, course) => sum + Number(course.credit_hours || 0),
        0
      ),
    [courses]
  );

  const currentGpa = useMemo(() => {
    const gpaInputs = courseSummaries
      .filter(({ summary }) => summary.currentGrade !== null)
      .map(({ course, summary }) => ({
        id: course.id,
        name: course.name,
        credits: Number(course.credit_hours || 0),
        gradePoints: getGradeInfo(summary.currentGrade ?? 0).points
      }));

    if (gpaInputs.length === 0) {
      return null;
    }

    return calculateGpa(gpaInputs).gpa;
  }, [courseSummaries]);

  const attentionItems = useMemo(() => {
    return courseSummaries
      .map(({ course, assessments: courseAssessments, summary }) => {
        const reasons: string[] = [];

        if (courseAssessments.length === 0) {
          reasons.push("No assessments yet");
        }

        if (summary.totalWeight !== 100) {
          reasons.push(
            summary.totalWeight < 100
              ? `Missing ${100 - summary.totalWeight}% weight`
              : `Over by ${summary.totalWeight - 100}% weight`
          );
        }

        if (summary.completedWeight === 0 && courseAssessments.length > 0) {
          reasons.push("No scores yet");
        }

        if (summary.currentGrade !== null && summary.currentGrade < 70) {
          reasons.push("Grade is at risk");
        }

        return { course, reasons, summary };
      })
      .filter((item) => item.reasons.length > 0)
      .slice(0, 5);
  }, [courseSummaries]);

  const recentSemesters = semesters.slice(0, 3);
  const hasNoData = !isLoading && semesters.length === 0 && courses.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className={buttonStyles()} href="/semesters#create-semester">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Create semester
            </Link>
            <Link
              className={buttonStyles({ variant: "secondary" })}
              href="/course-library"
            >
              <BookMarked aria-hidden="true" className="h-4 w-4" />
              Import course
            </Link>
          </>
        }
        description="A quick view of your terms, credits, grades, and courses that need a little attention."
        title="Welcome back"
      />

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {hasNoData ? (
        <Card className="grid gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <Badge tone="teal">Get started</Badge>
            <h2 className="mt-4 text-2xl font-semibold text-ink-900">
              Start by creating your first semester.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-500">
              Add a semester, then create courses or import a syllabus template
              so GradeMate can track your grades in one calm place.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link className={buttonStyles()} href="/semesters#create-semester">
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                Create semester
              </Link>
              <Link
                className={buttonStyles({ variant: "secondary" })}
                href="/course-library"
              >
                Browse course library
              </Link>
            </div>
          </div>
          <div className="rounded-2xl bg-ink-100 p-4">
            <p className="text-sm font-medium text-ink-500">Your progress</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Semesters", "0"],
                ["Courses", "0"],
                ["Current GPA", "-"],
                ["Credits", "0"]
              ].map(([label, value]) => (
                <div className="rounded-xl bg-white/80 p-3" key={label}>
                  <p className="text-xs text-ink-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-ink-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Semesters",
            value: String(semesters.length),
            hint: "Terms you are tracking",
            icon: CalendarDays
          },
          {
            label: "Active courses",
            value: String(courses.length),
            hint: "Across all semesters",
            icon: BookOpen
          },
          {
            label: "Current GPA",
            value: formatGpa(currentGpa),
            hint: currentGpa === null ? "Add scores to calculate" : "From scored courses",
            icon: GraduationCap
          },
          {
            label: "Credits",
            value: String(totalCredits),
            hint: "Total planned credits",
            icon: Layers3
          }
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <Card className="p-4" key={stat.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-ink-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">{stat.hint}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>
            </Card>
          );
        })}
      </section>

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">Loading dashboard...</Card>
      ) : (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Recent semesters
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Open a term to add courses, scores, or assessment weights.
                </p>
              </div>
              <Link
                className={buttonStyles({ size: "sm", variant: "secondary" })}
                href="/semesters"
              >
                View all
              </Link>
            </div>

            {recentSemesters.length === 0 ? (
              <EmptyState
                action={
                  <Link className={buttonStyles()} href="/semesters#create-semester">
                    Create semester
                  </Link>
                }
                description="Your semesters will appear here once you add one."
                icon={<CalendarDays aria-hidden="true" className="h-5 w-5" />}
                title="No semesters yet"
              />
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {recentSemesters.map((semester) => {
                  const semesterCourses = courses.filter(
                    (course) => course.semester_id === semester.id
                  );
                  const credits = semesterCourses.reduce(
                    (sum, course) => sum + Number(course.credit_hours || 0),
                    0
                  );

                  return (
                    <Link
                      className="rounded-2xl bg-ink-100 p-4 transition-colors hover:bg-ink-100"
                      href="/semesters"
                      key={semester.id}
                    >
                      <p className="text-sm font-medium text-teal-700">
                        {semester.term || "Term"} {semester.academic_year || ""}
                      </p>
                      <h3 className="mt-2 font-semibold text-ink-900">
                        {semester.name}
                      </h3>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-ink-500">Courses</p>
                          <p className="font-semibold text-ink-900">
                            {semesterCourses.length}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-500">Credits</p>
                          <p className="font-semibold text-ink-900">{credits}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Courses needing attention
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Quick fixes that make your grades more accurate.
                </p>
              </div>
              <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-600" />
            </div>

            {attentionItems.length === 0 ? (
              <div className="mt-5 rounded-2xl bg-teal-50 p-4 text-sm text-teal-800">
                Everything looks tidy. Add new scores when your next grade comes in.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {attentionItems.map(({ course, reasons, summary }) => (
                  <Link
                    className="block rounded-2xl bg-ink-100 p-4 transition-colors hover:bg-ink-100"
                    href={`/courses/${course.id}/`}
                    key={course.id}
                    prefetch={false}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink-900">
                          {course.code ? `${course.code} ` : ""}
                          {course.name}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          {reasons.join(", ")}
                        </p>
                      </div>
                      <Badge tone={summary.currentGrade !== null && summary.currentGrade < 70 ? "rose" : "gold"}>
                        {formatPercent(summary.currentGrade)}
                      </Badge>
                    </div>
                    <Progress
                      className="mt-3"
                      value={Math.min(summary.totalWeight, 100)}
                      tone={summary.totalWeight === 100 ? "green" : "gold"}
                    />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
