"use client";

import Link from "next/link";
import { BookOpen, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type {
  AssessmentRecord,
  CourseRecord,
  SemesterRecord
} from "@/types/database";

export function CoursesClient() {
  const { supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCourses() {
      setIsLoading(true);
      setError("");

      const [semesterResponse, courseResponse, assessmentResponse] =
        await Promise.all([
          supabase.from("semesters").select("*").eq("user_id", user.id),
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
            "Could not load courses."
        );
        setIsLoading(false);
        return;
      }

      setSemesters((semesterResponse.data ?? []) as SemesterRecord[]);
      setCourses((courseResponse.data ?? []) as CourseRecord[]);
      setAssessments((assessmentResponse.data ?? []) as AssessmentRecord[]);
      setIsLoading(false);
    }

    void loadCourses();
  }, [supabase, user.id]);

  const semesterNames = useMemo(() => {
    return new Map(semesters.map((semester) => [semester.id, semester.name]));
  }, [semesters]);

  function assessmentsForCourse(courseId: string) {
    return assessments.filter((assessment) => assessment.course_id === courseId);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link className={buttonStyles()} href="/semesters">
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            Add in semester
          </Link>
        }
        description="Review all courses connected to your semesters."
        eyebrow="Tracking"
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
            const totalWeight = courseAssessments.reduce(
              (sum, assessment) => sum + Number(assessment.weight || 0),
              0
            );

            return (
              <Card className="p-5" key={course.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-teal-700">
                      {course.code || "Course"}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-ink-900">
                      {course.name}
                    </h2>
                    <p className="mt-2 text-sm text-ink-500">
                      {semesterNames.get(course.semester_id) || "Semester"}
                    </p>
                  </div>
                  <Badge tone="ink">{Number(course.credit_hours)} credits</Badge>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                  <span className="text-ink-500">Assessment weight</span>
                  <span className="font-medium text-ink-900">{totalWeight}%</span>
                </div>

                <div className="mt-4 space-y-2">
                  {courseAssessments.length === 0 ? (
                    <p className="text-sm text-ink-500">No assessments yet.</p>
                  ) : (
                    courseAssessments.map((assessment) => (
                      <div
                        className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 px-3 py-2 text-sm"
                        key={assessment.id}
                      >
                        <span className="font-medium text-ink-800">
                          {assessment.title}
                        </span>
                        <span className="text-ink-500">
                          {Number(assessment.weight)}%
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
