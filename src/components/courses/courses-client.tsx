"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, PlusCircle, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import {
  formatPercent,
  getCourseGradeSummary,
  getLetterGrade
} from "@/lib/grades";
import { getCourseDetailHref } from "@/lib/routes";
import {
  deleteCourse as storeDeleteCourse,
  getWorkspaceSnapshot
} from "@/lib/workspace-store";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

export function CoursesClient() {
  const { isGuest, supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingCourseId, setDeletingCourseId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourses() {
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
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Could not load courses."
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadCourses();
  }, [isGuest, supabase, user.id]);

  const semesterNames = useMemo(() => {
    return new Map(semesters.map((semester) => [semester.id, semester.name]));
  }, [semesters]);

  function assessmentsForCourse(courseId: string) {
    return assessments.filter((assessment) => assessment.course_id === courseId);
  }

  async function deleteCourse(course: CourseRecord) {
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
        { isGuest, supabase, userId: user.id },
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
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <Link className={buttonStyles()} href="/semesters">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add course
            </Link>
            <Link
              className={buttonStyles({ variant: "secondary" })}
              href="/course-library"
            >
              Import course
            </Link>
          </>
        }
        description="Open a course to update scores, check remaining work, or upload a syllabus."
        title="Courses"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">Loading courses...</Card>
      ) : courses.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonStyles()} href="/semesters">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add course
            </Link>
          }
          description="Open a semester and add courses with credit hours and assessment weights."
          icon={<BookOpen aria-hidden="true" className="h-5 w-5" />}
          title="No courses yet"
        />
      ) : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const courseAssessments = assessmentsForCourse(course.id);
            const gradeSummary = getCourseGradeSummary(courseAssessments);
            const readiness =
              gradeSummary.totalWeight === 100
                ? "Ready"
                : `${gradeSummary.totalWeight}% weight`;

            return (
              <Card className="flex min-h-[188px] flex-col p-4" key={course.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="teal">{course.code || "Course"}</Badge>
                      <Badge tone="ink">{Number(course.credit_hours)} credits</Badge>
                    </div>
                    <Link
                      className="mt-3 block truncate text-base font-semibold text-ink-900 transition-colors hover:text-teal-300"
                      href={getCourseDetailHref(course.id)}
                      prefetch={false}
                    >
                      {course.name}
                    </Link>
                    <p className="mt-1 text-xs text-ink-500">
                      {semesterNames.get(course.semester_id) || "Semester"}
                    </p>
                  </div>
                  <Badge tone={gradeSummary.totalWeight === 100 ? "green" : "gold"}>
                    {readiness}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-ink-500">Grade</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {formatPercent(gradeSummary.currentGrade)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Letter</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {getLetterGrade(gradeSummary.currentGrade)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-500">Rows</p>
                    <p className="mt-1 font-semibold text-ink-900">
                      {courseAssessments.length}
                    </p>
                  </div>
                </div>

                <Progress
                  className="mt-4"
                  value={Math.min(gradeSummary.totalWeight, 100)}
                  tone={gradeSummary.totalWeight === 100 ? "green" : "gold"}
                />

                <Link
                  className={buttonStyles({
                    className: "mt-auto w-full",
                    variant: "secondary"
                  })}
                  href={getCourseDetailHref(course.id)}
                  prefetch={false}
                >
                  Open course
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Button
                  className="mt-2 w-full"
                  disabled={deletingCourseId === course.id}
                  onClick={() => void deleteCourse(course)}
                  variant="danger"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  {deletingCourseId === course.id ? "Removing..." : "Remove course"}
                </Button>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
