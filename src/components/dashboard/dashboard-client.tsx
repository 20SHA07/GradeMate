"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CalendarDays,
  Pencil,
  PlusCircle,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { calculateGpa } from "@/lib/gpa";
import {
  formatPercent,
  getCourseGradeSummary
} from "@/lib/grades";
import { getGradeInfo } from "@/lib/grading";
import { getCourseDetailHref } from "@/lib/routes";
import {
  defaultDegreePlanSettings,
  deleteCourse as storeDeleteCourse,
  getDegreePlanSettings,
  getWorkspaceSnapshot,
  resetDegreePlanSettings,
  saveDegreePlanSettings,
  type DegreePlanCategory,
  type DegreePlanResult,
  type DegreePlanSettings
} from "@/lib/workspace-store";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

function formatGpa(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

function formatCredits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function titleCaseName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferNameFromEmail(email?: string | null) {
  const username = email?.split("@")[0]?.toLowerCase() ?? "";

  if (!username) {
    return "";
  }

  if (username.includes("shahad")) {
    return "Shahad";
  }

  const separated = username
    .split(/[._-]+/)
    .map((part) => part.replace(/\d+/g, ""))
    .find((part) => part.length >= 3 && part.length <= 16);

  return separated ? titleCaseName(separated) : "";
}

function getMetadataName(userMetadata: Record<string, unknown> | undefined) {
  const name =
    typeof userMetadata?.full_name === "string"
      ? userMetadata.full_name
      : typeof userMetadata?.name === "string"
        ? userMetadata.name
        : "";

  return name.trim() ? titleCaseName(name) : "";
}

function createCategoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `category-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCategoryTotal(categories: DegreePlanCategory[]) {
  return categories.reduce(
    (sum, category) => sum + Number(category.requiredCredits || 0),
    0
  );
}

async function loadProfileFullName({
  isGuest,
  supabase,
  userId
}: {
  isGuest: boolean;
  supabase: ReturnType<typeof useAuth>["supabase"];
  userId: string;
}) {
  if (isGuest || !supabase) {
    return "";
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return "";
  }

  const profile = data as { full_name?: unknown } | null;

  return typeof profile?.full_name === "string" && profile.full_name.trim()
    ? titleCaseName(profile.full_name)
    : "";
}

export function DashboardClient() {
  const { isGuest, openSaveProgress, supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [profileName, setProfileName] = useState("");
  const [degreePlan, setDegreePlan] = useState<DegreePlanSettings>(
    defaultDegreePlanSettings
  );
  const [isDegreePlanDefault, setIsDegreePlanDefault] = useState(true);
  const [degreeSyncStatus, setDegreeSyncStatus] =
    useState<DegreePlanResult["syncStatus"]>("local");
  const [isDegreeSettingsOpen, setIsDegreeSettingsOpen] = useState(false);
  const [degreeSettingsError, setDegreeSettingsError] = useState("");
  const [degreeSettingsMessage, setDegreeSettingsMessage] = useState("");
  const [deletingCourseId, setDeletingCourseId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const context = {
          isGuest,
          supabase,
          userId: user.id
        };
        const [snapshot, degreePlanResult, loadedProfileName] =
          await Promise.all([
            getWorkspaceSnapshot(context),
            getDegreePlanSettings(context),
            loadProfileFullName(context)
          ]);

        setSemesters(snapshot.semesters);
        setCourses(snapshot.courses);
        setAssessments(snapshot.assessments);
        setDegreePlan(degreePlanResult.settings);
        setIsDegreePlanDefault(degreePlanResult.isDefault);
        setDegreeSyncStatus(degreePlanResult.syncStatus);
        setProfileName(loadedProfileName);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your dashboard."
        );
      } finally {
        setIsLoading(false);
      }
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

  const completedCourseCredits = useMemo(() => {
    return courseSummaries.reduce((sum, { course, summary }) => {
      const finalGrade =
        summary.totalWeight >= 99.5 && summary.allAssessmentsScored
          ? summary.finalProjectedGrade
          : null;

      if (finalGrade !== null && finalGrade >= 60) {
        return sum + Number(course.credit_hours || 0);
      }

      return sum;
    }, 0);
  }, [courseSummaries]);

  const degreeCompletedCredits = Math.min(
    degreePlan.totalCredits,
    degreePlan.completedCredits + completedCourseCredits
  );
  const degreeProgressPercent =
    degreePlan.totalCredits > 0
      ? Math.min(100, (degreeCompletedCredits / degreePlan.totalCredits) * 100)
      : 0;
  const categoryTotal = getCategoryTotal(degreePlan.categories);
  const displayName =
    profileName ||
    getMetadataName(user.user_metadata as Record<string, unknown> | undefined) ||
    inferNameFromEmail(user.email);
  const welcomeTitle = displayName
    ? `Welcome back, ${displayName}`
    : "Welcome back";

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
  const activeSemester = recentSemesters[0];
  const hasNoData = !isLoading && semesters.length === 0 && courses.length === 0;
  const workspaceModeLabel = isGuest ? "Using Guest Mode" : "Synced workspace";

  async function handleSaveDegreePlan(nextSettings: DegreePlanSettings) {
    setDegreeSettingsError("");
    setDegreeSettingsMessage("");

    try {
      const result = await saveDegreePlanSettings(
        {
          isGuest,
          supabase,
          userId: user.id
        },
        nextSettings
      );

      setDegreePlan(result.settings);
      setIsDegreePlanDefault(result.isDefault);
      setDegreeSyncStatus(result.syncStatus);
      setDegreeSettingsMessage(
        result.syncStatus === "supabase"
          ? "Degree settings saved."
          : "Degree settings saved on this device."
      );
      return true;
    } catch (saveError) {
      setDegreeSettingsError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save degree settings."
      );
      return false;
    }
  }

  async function handleDeleteCourse(course: CourseRecord) {
    const shouldDelete = window.confirm(
      `Remove ${course.name}? This also removes its saved assessments.`
    );

    if (!shouldDelete) {
      return;
    }

    setError("");
    setDeletingCourseId(course.id);

    try {
      await storeDeleteCourse(
        {
          isGuest,
          supabase,
          userId: user.id
        },
        course.id
      );
      setCourses((current) =>
        current.filter((currentCourse) => currentCourse.id !== course.id)
      );
      setAssessments((current) =>
        current.filter((assessment) => assessment.course_id !== course.id)
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not remove course."
      );
    } finally {
      setDeletingCourseId("");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-ink-900">
            {welcomeTitle}
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-ink-700">
            Track your courses, grades, and degree progress.
          </p>
          {activeSemester ? (
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-teal-300">
              {activeSemester.name} overview
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={buttonStyles({ size: "sm" })}
            href="/semesters#create-semester"
          >
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            Add course
          </Link>
          <Link
            className={buttonStyles({ size: "sm", variant: "secondary" })}
            href="/course-library"
          >
            <BookMarked aria-hidden="true" className="h-4 w-4" />
            Import course
          </Link>
          <Link
            className={buttonStyles({ size: "sm", variant: "ghost" })}
            href="/course-library"
          >
            Browse library
          </Link>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {hasNoData ? (
        <Card className="grid gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <Badge tone={isGuest ? "teal" : "green"}>{workspaceModeLabel}</Badge>
            <h2 className="mt-4 text-[24px] font-bold leading-tight text-ink-900">
              Start tracking your grades
            </h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-5 text-ink-500">
              Create a semester, add your courses, and GradeMate will help you
              know what you need.
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
              {isGuest ? (
                <Button onClick={openSaveProgress} variant="secondary">
                  Save progress
                </Button>
              ) : null}
            </div>
            {isGuest ? (
              <p className="mt-4 text-xs text-ink-500">
                Using Guest Mode - save your progress anytime.
              </p>
            ) : (
              <p className="mt-4 text-xs text-ink-500">
                Signed in as {user.email ?? "your account"}.
              </p>
            )}
          </div>
          <div className="rounded-lg bg-ink-100 p-4">
            <p className="text-[13px] font-semibold text-ink-500">Your progress</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Semesters", "0"],
                ["Courses", "0"],
                ["Current GPA", "-"],
                ["Credits", "0"]
              ].map(([label, value]) => (
                <div className="rounded-lg bg-white/80 p-3" key={label}>
                  <p className="text-xs text-ink-500">{label}</p>
                  <p className="mt-1 text-[26px] font-bold leading-none text-ink-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-teal-300">
            Current GPA
          </p>
          <p className="mt-3 text-[30px] font-bold leading-none text-ink-900">
            {currentGpa === null ? "-" : formatGpa(currentGpa)}
          </p>
          <p className="mt-2 text-xs text-ink-500">
            {currentGpa === null ? "Add scores to calculate." : "Based on saved courses."}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-teal-300">
            Courses
          </p>
          <p className="mt-3 text-[30px] font-bold leading-none text-ink-900">
            {courses.length}
          </p>
          <p className="mt-2 text-xs text-ink-500">
            {semesters.length} semester{semesters.length === 1 ? "" : "s"}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-teal-300">
            Tracked credits
          </p>
          <p className="mt-3 text-[30px] font-bold leading-none text-ink-900">
            {formatCredits(totalCredits)}
          </p>
          <p className="mt-2 text-xs text-ink-500">Current GradeMate courses.</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-teal-300">
                Degree progress
              </p>
              <p className="mt-3 text-lg font-semibold text-ink-900">
                {formatCredits(degreeCompletedCredits)} /{" "}
                {formatCredits(degreePlan.totalCredits)} credits
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Completed / required credits
              </p>
            </div>
            <Button
              className="h-8 shrink-0 px-2.5 text-[12px]"
              onClick={() => {
                setDegreeSettingsError("");
                setIsDegreeSettingsOpen(true);
              }}
              size="sm"
              variant="primary"
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress className="flex-1" value={degreeProgressPercent} />
            <span className="text-xs font-semibold text-ink-900">
              {Math.round(degreeProgressPercent)}%
            </span>
          </div>
          {isDegreePlanDefault ? (
            <p className="mt-3 text-xs font-medium text-teal-300">
              Edit this to match your major.
            </p>
          ) : null}
          <details className="mt-3 text-xs text-ink-500">
            <summary className="cursor-pointer font-semibold text-ink-700">
              More details
            </summary>
            <div className="mt-3 grid gap-2">
              <p>Before GradeMate: {formatCredits(degreePlan.completedCredits)}</p>
              <p>Completed courses: {formatCredits(completedCourseCredits)}</p>
              <p>Tracked credits: {formatCredits(totalCredits)}</p>
              {degreePlan.categories.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {degreePlan.categories.map((category) => (
                    <span
                      className="border border-ink-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-700"
                      key={category.id}
                    >
                      {category.label}:{" "}
                      {category.requiredCredits > 0
                        ? `${formatCredits(category.completedCredits)}/${formatCredits(category.requiredCredits)}`
                        : "target unset"}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </details>
          {categoryTotal > 0 &&
          Math.abs(categoryTotal - degreePlan.totalCredits) > 0.1 ? (
            <p className="mt-3 text-xs text-amber-700">
              Category targets total {formatCredits(categoryTotal)} credits.
            </p>
          ) : null}
          {degreeSyncStatus === "fallback" ? (
            <p className="mt-3 text-xs text-ink-500">
              Saved on this device until sync is enabled.
            </p>
          ) : null}
          {degreeSettingsMessage ? (
            <p className="mt-3 text-xs font-medium text-teal-300">
              {degreeSettingsMessage}
            </p>
          ) : null}
        </Card>
      </section>

      {!hasNoData && !isLoading ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Current courses
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Open a course to update scores.
              </p>
            </div>
            <Link
              className={buttonStyles({ size: "sm", variant: "secondary" })}
              href="/courses"
            >
              View courses
            </Link>
          </div>

          {courseSummaries.length === 0 ? (
            <div className="p-5">
              <EmptyState
                action={
                  <Link className={buttonStyles()} href="/semesters">
                    Add course
                  </Link>
                }
                description="Courses appear here after you add them to a semester or import a template."
                icon={<BookOpen aria-hidden="true" className="h-5 w-5" />}
                title="No courses yet"
              />
            </div>
          ) : (
            <div className="grid gap-px bg-ink-200 md:grid-cols-2 xl:grid-cols-3">
              {courseSummaries.map(({ course, summary }) => {
                return (
                  <div
                    className="min-w-0 bg-white/90 p-4 transition-colors hover:bg-ink-100/80"
                    key={course.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {course.code ? (
                          <p className="text-xs font-bold uppercase tracking-[0.06em] text-teal-300">
                            {course.code}
                          </p>
                        ) : null}
                        <h3 className="mt-1 truncate text-base font-semibold text-ink-900">
                          {course.name}
                        </h3>
                        <p className="mt-1 text-xs text-ink-500">
                          {Number(course.credit_hours || 0)} credits
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink-900">
                          {formatPercent(summary.currentGrade)}
                        </p>
                        <button
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 transition hover:text-rose-800"
                          disabled={deletingCourseId === course.id}
                          onClick={() => void handleDeleteCourse(course)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                          {deletingCourseId === course.id ? "Removing" : "Remove"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-500">
                      <span>{summary.completedWeight}% completed</span>
                      <Link
                        className="font-semibold text-teal-300 hover:text-teal-200"
                        href={getCourseDetailHref(course.id)}
                        prefetch={false}
                      >
                        Open
                      </Link>
                    </div>
                    <Progress
                      className="mt-2"
                      value={Math.min(summary.totalWeight, 100)}
                      tone={summary.totalWeight === 100 ? "green" : "gold"}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">Loading dashboard...</Card>
      ) : !hasNoData ? (
        <details className="border border-ink-200 bg-white/80 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink-900">
            More workspace details
          </summary>
          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Recent semesters
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Open a term to add courses, scores, or grade weights.
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
                      className="rounded-lg bg-ink-100 p-4 transition-colors hover:bg-ink-100"
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
              <div className="mt-5 rounded-lg bg-teal-50 p-4 text-sm text-teal-800">
                Everything looks tidy. Add new scores when your next grade comes in.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {attentionItems.map(({ course, reasons, summary }) => (
                  <Link
                    className="block rounded-lg bg-ink-100 p-4 transition-colors hover:bg-ink-100"
                    href={getCourseDetailHref(course.id)}
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
        </details>
      ) : null}

      {isDegreeSettingsOpen ? (
        <DegreeSettingsModal
          error={degreeSettingsError}
          initialSettings={degreePlan}
          isDefault={isDegreePlanDefault}
          onClose={() => setIsDegreeSettingsOpen(false)}
          onSave={handleSaveDegreePlan}
        />
      ) : null}
    </div>
  );
}

function DegreeSettingsModal({
  error,
  initialSettings,
  isDefault,
  onClose,
  onSave
}: {
  error: string;
  initialSettings: DegreePlanSettings;
  isDefault: boolean;
  onClose: () => void;
  onSave: (settings: DegreePlanSettings) => Promise<boolean>;
}) {
  const [settings, setSettings] = useState<DegreePlanSettings>(initialSettings);
  const [validationError, setValidationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const categoryTotal = getCategoryTotal(settings.categories);
  const categoryTotalWarning =
    Math.abs(categoryTotal - settings.totalCredits) > 0.1
      ? `Category totals add up to ${formatCredits(categoryTotal)} credits, but your degree total is ${formatCredits(settings.totalCredits)}.`
      : "";

  function updateCategory(
    categoryId: string,
    updates: Partial<DegreePlanCategory>
  ) {
    setSettings((current) => ({
      ...current,
      categories: current.categories.map((category) =>
        category.id === categoryId ? { ...category, ...updates } : category
      )
    }));
  }

  function removeCategory(categoryId: string) {
    setSettings((current) => ({
      ...current,
      categories: current.categories.filter((category) => category.id !== categoryId)
    }));
  }

  function addCategory() {
    setSettings((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          completedCredits: 0,
          id: createCategoryId(),
          label: "New category",
          requiredCredits: 0
        }
      ]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");

    if (settings.totalCredits <= 0) {
      setValidationError("Total required credits must be greater than 0.");
      return;
    }

    const hasNegativeCategory = settings.categories.some(
      (category) =>
        category.requiredCredits < 0 || category.completedCredits < 0
    );

    if (hasNegativeCategory) {
      setValidationError("Category credits cannot be negative.");
      return;
    }

    setIsSaving(true);
    const didSave = await onSave(settings);
    setIsSaving(false);

    if (didSave) {
      onClose();
    }
  }

  return (
    <div className="gm-modal-backdrop">
      <Card className="w-full max-w-2xl p-5">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-teal-300">
                Degree settings
              </p>
              <h2 className="mt-1 text-xl font-bold leading-tight text-ink-900">
                Edit degree progress
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-ink-500">
                Set completed credits, required credits, and degree categories.
              </p>
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-ink-200 bg-ink-50 text-ink-700 transition hover:bg-ink-100 hover:text-ink-900"
              onClick={onClose}
              type="button"
            >
              <span className="sr-only">Close</span>
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500">
                Total required credits
              </span>
              <input
                className="gm-input mt-2"
                min="1"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    totalCredits: Number(event.target.value) || 0
                  }))
                }
                step="0.5"
                type="number"
                value={settings.totalCredits}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-500">
                Completed before GradeMate
              </span>
              <input
                className="gm-input mt-2"
                min="0"
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    completedCredits: Number(event.target.value) || 0
                  }))
                }
                step="0.5"
                type="number"
                value={settings.completedCredits}
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink-900">
                  Categories
                </h3>
                <p className="mt-1 text-xs text-ink-500">
                  Track target credits for each degree bucket.
                </p>
              </div>
              <Button onClick={addCategory} size="sm" type="button" variant="secondary">
                Add category
              </Button>
            </div>

            <div className="mt-3 overflow-x-auto border border-ink-200">
              <table className="gm-table min-w-[560px]">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Required</th>
                    <th>Completed</th>
                    <th className="w-12">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {settings.categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <input
                          className="gm-input"
                          onChange={(event) =>
                            updateCategory(category.id, {
                              label: event.target.value
                            })
                          }
                          value={category.label}
                        />
                      </td>
                      <td>
                        <input
                          className="gm-input"
                          min="0"
                          onChange={(event) =>
                            updateCategory(category.id, {
                              requiredCredits: Number(event.target.value) || 0
                            })
                          }
                          step="0.5"
                          type="number"
                          value={category.requiredCredits}
                        />
                      </td>
                      <td>
                        <input
                          className="gm-input"
                          min="0"
                          onChange={(event) =>
                            updateCategory(category.id, {
                              completedCredits: Number(event.target.value) || 0
                            })
                          }
                          step="0.5"
                          type="number"
                          value={category.completedCredits}
                        />
                      </td>
                      <td>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-ink-200 text-rose-700 transition hover:bg-rose-50"
                          onClick={() => removeCategory(category.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">Remove category</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {categoryTotalWarning ? (
            <p className="mt-3 rounded-[3px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {categoryTotalWarning}
            </p>
          ) : null}
          {validationError || error ? (
            <p className="mt-3 rounded-[3px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {validationError || error}
            </p>
          ) : null}
          {isDefault ? (
            <p className="mt-3 text-xs text-ink-500">
              The default starts at 120 credits. Save once to personalize it.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              onClick={() => setSettings(resetDegreePlanSettings())}
              type="button"
              variant="ghost"
            >
              Reset to 120-credit default
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={onClose} type="button" variant="secondary">
                Cancel
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
