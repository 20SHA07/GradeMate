"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, GraduationCap, PlusCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/protected-session-provider";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { CourseRecord, SemesterRecord } from "@/types/database";

export function DashboardClient() {
  const { supabase, user } = useAuth();
  const [semesters, setSemesters] = useState<SemesterRecord[]>([]);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      const [semesterResponse, courseResponse] = await Promise.all([
        supabase
          .from("semesters")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("courses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
      ]);

      if (semesterResponse.error || courseResponse.error) {
        setError(
          semesterResponse.error?.message ??
            courseResponse.error?.message ??
            "Could not load dashboard."
        );
        setIsLoading(false);
        return;
      }

      setSemesters((semesterResponse.data ?? []) as SemesterRecord[]);
      setCourses((courseResponse.data ?? []) as CourseRecord[]);
      setIsLoading(false);
    }

    void loadDashboard();
  }, [supabase, user.id]);

  const totalCredits = useMemo(
    () =>
      courses.reduce(
        (sum, course) => sum + Number(course.credit_hours || 0),
        0
      ),
    [courses]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link className={buttonStyles()} href="/semesters">
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            New semester
          </Link>
        }
        description="Your semesters, courses, credit hours, and assessment plans in one place."
        eyebrow="Workspace"
        title="Dashboard"
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <CalendarDays aria-hidden="true" className="h-6 w-6 text-teal-700" />
          <p className="mt-4 text-sm font-medium text-ink-500">Semesters</p>
          <p className="mt-1 text-3xl font-semibold text-ink-900">
            {semesters.length}
          </p>
        </Card>
        <Card className="p-5">
          <BookOpen aria-hidden="true" className="h-6 w-6 text-amber-600" />
          <p className="mt-4 text-sm font-medium text-ink-500">Courses</p>
          <p className="mt-1 text-3xl font-semibold text-ink-900">
            {courses.length}
          </p>
        </Card>
        <Card className="p-5">
          <GraduationCap aria-hidden="true" className="h-6 w-6 text-lime-700" />
          <p className="mt-4 text-sm font-medium text-ink-500">Credit hours</p>
          <p className="mt-1 text-3xl font-semibold text-ink-900">
            {totalCredits}
          </p>
        </Card>
      </section>

      {isLoading ? (
        <Card className="p-5 text-sm text-ink-500">Loading semesters...</Card>
      ) : semesters.length === 0 ? (
        <EmptyState
          action={
            <Link className={buttonStyles()} href="/semesters">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Create semester
            </Link>
          }
          description="Create your first semester, then add courses and weighted assessments inside it."
          icon={<CalendarDays aria-hidden="true" className="h-5 w-5" />}
          title="No semesters yet"
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {semesters.map((semester) => {
            const semesterCourses = courses.filter(
              (course) => course.semester_id === semester.id
            );

            return (
              <Card className="p-5" key={semester.id}>
                <p className="text-sm font-medium text-teal-700">
                  {semester.term || "Term"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink-900">
                  {semester.name}
                </h2>
                <p className="mt-2 text-sm text-ink-500">
                  {semester.academic_year || "Academic year not set"}
                </p>
                <div className="mt-5 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                  <span className="text-ink-500">Courses</span>
                  <span className="font-medium text-ink-900">
                    {semesterCourses.length}
                  </span>
                </div>
                <Link
                  className={buttonStyles({
                    className: "mt-5 w-full",
                    variant: "secondary"
                  })}
                  href="/semesters"
                >
                  Open semester
                </Link>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
