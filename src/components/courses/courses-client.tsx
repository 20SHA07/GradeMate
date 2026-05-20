"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
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
import { getCourseDetailHref } from "@/lib/routes";
import { getWorkspaceSnapshot } from "@/lib/workspace-store";
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
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const courseAssessments = assessmentsForCourse(course.id);
            const gradeSummary = getCourseGradeSummary(courseAssessments);

            return (
              <Card className="p-4" key={course.id}>
                <div className="flex items-start justify-between gap-4">
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
                    <p className="mt-2 text-sm text-ink-500">
                      {semesterNames.get(course.semester_id) || "Semester"}
                    </p>
                  </div>
                  <Badge tone="ink">{Number(course.credit_hours)} credits</Badge>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-lg bg-ink-100 px-3 py-2 text-sm">
                  <span className="text-ink-500">Assessment weight</span>
                  <span className="font-medium text-ink-900">
                    {gradeSummary.totalWeight}%
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-sm">
                  <span className="text-teal-800">Current grade</span>
                  <span className="flex items-center gap-2 font-semibold text-teal-800">
                    {formatPercent(gradeSummary.currentGrade)}
                    <Badge tone="teal">
                      {getLetterGrade(gradeSummary.currentGrade)}
                    </Badge>
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {courseAssessments.length === 0 ? (
                    <p className="text-sm text-ink-500">No assessments yet.</p>
                  ) : (
                    courseAssessments.map((assessment) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-lg bg-ink-100 px-3 py-2 text-sm"
                        key={assessment.id}
                      >
                        <span className="font-medium text-ink-800">
                          {getAssessmentName(assessment)}
                        </span>
                        <span className="text-ink-500">
                          {getAssessmentWeight(assessment)}%
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <Link
                  className={buttonStyles({
                    className: "mt-5 w-full",
                    variant: "secondary"
                  })}
                  href={getCourseDetailHref(course.id)}
                  prefetch={false}
                >
                  Open course
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
