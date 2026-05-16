import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { courses, semesters } from "@/lib/data";

export default function SemestersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <Link className={buttonStyles()} href="/courses">
            <PlusCircle aria-hidden="true" className="h-4 w-4" />
            Add course
          </Link>
        }
        description="Group courses by term, track credits, and compare actual GPA against your plan."
        eyebrow="Planning"
        title="Semesters"
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {semesters.map((semester) => {
          const semesterCourses = courses.filter(
            (course) => course.semesterId === semester.id
          );

          return (
            <Card className="p-5" key={semester.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-700">
                    {semester.term} {semester.year}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-ink-900">
                    {semester.title}
                  </h2>
                </div>
                <span className="rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-medium text-lime-800">
                  {semester.credits} credits
                </span>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-ink-700">GPA progress</span>
                  <span className="text-ink-500">
                    {semester.currentGpa.toFixed(2)} / {semester.targetGpa.toFixed(2)}
                  </span>
                </div>
                <Progress
                  max={semester.targetGpa}
                  tone="green"
                  value={semester.currentGpa}
                />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-xs font-medium text-ink-500">Courses</p>
                  <p className="mt-1 text-2xl font-semibold text-ink-900">
                    {semesterCourses.length}
                  </p>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-xs font-medium text-ink-500">Current GPA</p>
                  <p className="mt-1 text-2xl font-semibold text-ink-900">
                    {semester.currentGpa.toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
