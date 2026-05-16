import Link from "next/link";
import { FileUp, PlusCircle } from "lucide-react";
import { CourseCard } from "@/components/course-card";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { courses } from "@/lib/data";

export default function CoursesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        actions={
          <>
            <button className={buttonStyles({ variant: "secondary" })} type="button">
              <FileUp aria-hidden="true" className="h-4 w-4" />
              Upload syllabus
            </button>
            <button className={buttonStyles()} type="button">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              New course
            </button>
          </>
        }
        description="Manage manual course entries, syllabus status, target grades, and weighted assessments."
        eyebrow="Tracking"
        title="Courses"
      />

      {courses.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard course={course} key={course.id} />
          ))}
        </section>
      ) : (
        <EmptyState
          action={
            <Link className={buttonStyles()} href="/courses">
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Add course
            </Link>
          }
          description="Create a course manually or upload a syllabus once storage and extraction are connected."
          icon={<FileUp aria-hidden="true" className="h-5 w-5" />}
          title="No courses yet"
        />
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">
              Syllabus inbox
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-500">
              PDF upload and automatic extraction are reserved for the next phase.
            </p>
          </div>
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            Coming next
          </span>
        </div>
      </Card>
    </div>
  );
}
