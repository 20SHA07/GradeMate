import Link from "next/link";
import {
  BookOpen,
  Calculator,
  FileText,
  GraduationCap,
  Library,
  Upload
} from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { courses, dashboardMetrics, semesters } from "@/lib/data";

const metricIcons = [GraduationCap, Library, BookOpen, FileText];

export default function DashboardPage() {
  const activeSemester = semesters[0];
  const activeCourses = courses.filter(
    (course) => course.semesterId === activeSemester.id
  );

  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <Link
              className={buttonStyles({ variant: "secondary" })}
              href="/gpa-calculator"
            >
              <Calculator aria-hidden="true" className="h-4 w-4" />
              Calculator
            </Link>
            <Link className={buttonStyles()} href="/courses">
              <Upload aria-hidden="true" className="h-4 w-4" />
              Add syllabus
            </Link>
          </>
        }
        description="A single place to track semesters, courses, syllabus status, weighted grades, and GPA progress."
        eyebrow="Workspace"
        title="Dashboard"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric, index) => {
          const Icon = metricIcons[index];
          return <StatCard icon={Icon} key={metric.label} {...metric} />;
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-ink-900">Active courses</h2>
            <Link
              className="text-sm font-medium text-teal-700 hover:text-teal-800"
              href="/courses"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {activeCourses.slice(0, 2).map((course) => (
              <CourseCard course={course} key={course.id} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{activeSemester.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-ink-700">GPA target</span>
                  <span className="text-ink-500">
                    {activeSemester.currentGpa.toFixed(2)} /{" "}
                    {activeSemester.targetGpa.toFixed(2)}
                  </span>
                </div>
                <Progress
                  value={activeSemester.currentGpa}
                  max={activeSemester.targetGpa}
                  tone="green"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-xs font-medium text-ink-500">Credits</p>
                  <p className="mt-1 text-xl font-semibold text-ink-900">
                    {activeSemester.credits}
                  </p>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-xs font-medium text-ink-500">Courses</p>
                  <p className="mt-1 text-xl font-semibold text-ink-900">
                    {activeCourses.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeCourses.map((course) => (
                <div
                  className="flex items-center justify-between gap-4 rounded-lg border border-ink-200 px-3 py-2"
                  key={course.id}
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">
                      {course.code}
                    </p>
                    <p className="text-xs text-ink-500">{course.title}</p>
                  </div>
                  <span className="text-xs font-medium capitalize text-ink-500">
                    {course.syllabusStatus}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
