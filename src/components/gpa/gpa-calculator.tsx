"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  calculateGpa,
  gradeOptions,
  type GpaCourseInput
} from "@/lib/gpa";

const initialCourses: GpaCourseInput[] = [
  { id: "course-1", name: "Course 1", credits: 3, gradePoints: 4 },
  { id: "course-2", name: "Course 2", credits: 3, gradePoints: 3.3 },
  { id: "course-3", name: "Course 3", credits: 4, gradePoints: 3.7 }
];

function createCourse(): GpaCourseInput {
  return {
    id: `course-${Date.now()}`,
    name: "New course",
    credits: 3,
    gradePoints: 4
  };
}

export function GpaCalculator() {
  const [courses, setCourses] = useState<GpaCourseInput[]>(initialCourses);

  const result = useMemo(() => calculateGpa(courses), [courses]);

  function updateCourse(
    id: string,
    field: keyof Omit<GpaCourseInput, "id">,
    value: string
  ) {
    setCourses((currentCourses) =>
      currentCourses.map((course) => {
        if (course.id !== id) {
          return course;
        }

        if (field === "credits" || field === "gradePoints") {
          const numericValue = Number(value);
          return {
            ...course,
            [field]: Number.isFinite(numericValue) ? numericValue : 0
          };
        }

        return { ...course, [field]: value };
      })
    );
  }

  function removeCourse(id: string) {
    setCourses((currentCourses) =>
      currentCourses.length > 1
        ? currentCourses.filter((course) => course.id !== id)
        : currentCourses
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Course inputs</h2>
            <p className="mt-1 text-sm text-ink-500">
              Enter credits and letter grades to estimate term GPA.
            </p>
          </div>
          <Button onClick={() => setCourses((current) => [...current, createCourse()])}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add course
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {courses.map((course, index) => (
            <div
              className="grid gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_2.5rem] sm:items-end"
              key={course.id}
            >
              <label className="block">
                <span className="text-xs font-medium text-ink-500">
                  Course {index + 1}
                </span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) =>
                    updateCourse(course.id, "name", event.target.value)
                  }
                  value={course.name}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-ink-500">Credits</span>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  min="0"
                  onChange={(event) =>
                    updateCourse(course.id, "credits", event.target.value)
                  }
                  step="0.5"
                  type="number"
                  value={course.credits}
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-ink-500">Grade</span>
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                  onChange={(event) =>
                    updateCourse(course.id, "gradePoints", event.target.value)
                  }
                  value={course.gradePoints}
                >
                  {gradeOptions.map((grade) => (
                    <option key={grade.label} value={grade.points}>
                      {grade.label} ({grade.points.toFixed(1)})
                    </option>
                  ))}
                </select>
              </label>

              <Button
                aria-label={`Remove ${course.name}`}
                disabled={courses.length === 1}
                onClick={() => removeCourse(course.id)}
                size="icon"
                variant="ghost"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="h-fit p-5">
        <h2 className="text-lg font-semibold text-ink-900">GPA estimate</h2>
        <div className="mt-5 rounded-lg bg-teal-700 p-5 text-white">
          <p className="text-sm font-medium text-teal-50">Projected term GPA</p>
          <p className="mt-2 text-5xl font-semibold">{result.gpa.toFixed(2)}</p>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <dt className="text-ink-500">Credits</dt>
            <dd className="font-medium text-ink-900">{result.totalCredits}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <dt className="text-ink-500">Quality points</dt>
            <dd className="font-medium text-ink-900">
              {result.totalPoints.toFixed(1)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-500">Courses</dt>
            <dd className="font-medium text-ink-900">{courses.length}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
