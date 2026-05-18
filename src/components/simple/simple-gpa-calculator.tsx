"use client";

import Link from "next/link";
import {
  Download,
  FileUp,
  GraduationCap,
  PlusCircle,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getGradePoint, gradeScale, type LetterGrade } from "@/lib/grading";

type SimpleCourse = {
  id: string;
  name: string;
  creditHours: string;
  letterGrade: LetterGrade;
};

type SimpleGpaData = {
  existingCgpa: string;
  completedHours: string;
  courses: SimpleCourse[];
};

const simpleStorageKey = "grademate_simple_gpa";
const defaultCourse: Omit<SimpleCourse, "id"> = {
  name: "",
  creditHours: "3",
  letterGrade: "A"
};

function createSimpleId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `simple-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createCourse(course?: Partial<SimpleCourse>): SimpleCourse {
  return {
    id: createSimpleId(),
    ...defaultCourse,
    ...course
  };
}

function getDefaultData(): SimpleGpaData {
  return {
    existingCgpa: "",
    completedHours: "",
    courses: [createCourse()]
  };
}

function readStoredData(): SimpleGpaData {
  if (typeof window === "undefined") {
    return getDefaultData();
  }

  const rawData = window.localStorage.getItem(simpleStorageKey);

  if (!rawData) {
    return getDefaultData();
  }

  try {
    const parsedData = JSON.parse(rawData) as Partial<SimpleGpaData>;
    const courses = Array.isArray(parsedData.courses)
      ? parsedData.courses.map((course) =>
          createCourse({
            id: typeof course.id === "string" ? course.id : createSimpleId(),
            name: typeof course.name === "string" ? course.name : "",
            creditHours:
              typeof course.creditHours === "string"
                ? course.creditHours
                : String(course.creditHours ?? "3"),
            letterGrade: isLetterGrade(course.letterGrade)
              ? course.letterGrade
              : "A"
          })
        )
      : [];

    return {
      existingCgpa:
        typeof parsedData.existingCgpa === "string"
          ? parsedData.existingCgpa
          : "",
      completedHours:
        typeof parsedData.completedHours === "string"
          ? parsedData.completedHours
          : "",
      courses: courses.length > 0 ? courses : [createCourse()]
    };
  } catch {
    return getDefaultData();
  }
}

function isLetterGrade(value: unknown): value is LetterGrade {
  return gradeScale.some((grade) => grade.letter === value);
}

function parseNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function formatGpa(value: number | null) {
  return value === null || Number.isNaN(value) ? "--" : value.toFixed(2);
}

function getCourseQualityPoints(course: SimpleCourse) {
  return parseNumber(course.creditHours) * getGradePoint(course.letterGrade);
}

function sanitizeImportedData(value: unknown): SimpleGpaData {
  if (!value || typeof value !== "object") {
    throw new Error("That file does not look like GradeMate Simple data.");
  }

  const data = value as Partial<SimpleGpaData>;
  const courses = Array.isArray(data.courses)
    ? data.courses.map((course) =>
        createCourse({
          name: typeof course.name === "string" ? course.name : "",
          creditHours:
            typeof course.creditHours === "string"
              ? course.creditHours
              : String(course.creditHours ?? "3"),
          letterGrade: isLetterGrade(course.letterGrade)
            ? course.letterGrade
            : "A"
        })
      )
    : [];

  return {
    existingCgpa: typeof data.existingCgpa === "string" ? data.existingCgpa : "",
    completedHours:
      typeof data.completedHours === "string" ? data.completedHours : "",
    courses: courses.length > 0 ? courses : [createCourse()]
  };
}

export function SimpleGpaCalculator() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [data, setData] = useState<SimpleGpaData>(() => getDefaultData());
  const [isLoaded, setIsLoaded] = useState(false);
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setData(readStoredData());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    window.localStorage.setItem(simpleStorageKey, JSON.stringify(data));
  }, [data, isLoaded]);

  const summary = useMemo(() => {
    const semesterHours = data.courses.reduce(
      (sum, course) => sum + parseNumber(course.creditHours),
      0
    );
    const semesterQualityPoints = data.courses.reduce(
      (sum, course) => sum + getCourseQualityPoints(course),
      0
    );
    const semesterGpa =
      semesterHours > 0 ? semesterQualityPoints / semesterHours : null;
    const existingCgpa = Number(data.existingCgpa);
    const completedHours = parseNumber(data.completedHours);
    const hasExistingGpa =
      Number.isFinite(existingCgpa) && existingCgpa >= 0 && existingCgpa <= 4;
    const cumulativeHours = completedHours + semesterHours;
    const cumulativeGpa =
      hasExistingGpa && cumulativeHours > 0
        ? (existingCgpa * completedHours + semesterQualityPoints) /
          cumulativeHours
        : semesterGpa;

    return {
      cumulativeGpa,
      cumulativeHours,
      semesterGpa,
      semesterHours,
      semesterQualityPoints
    };
  }, [data]);

  function updateData(nextData: Partial<SimpleGpaData>) {
    setData((current) => ({
      ...current,
      ...nextData
    }));
    setMessage("");
    setError("");
  }

  function updateCourse(
    courseId: string,
    field: keyof Omit<SimpleCourse, "id">,
    value: string
  ) {
    const nextValue =
      field === "letterGrade" ? (isLetterGrade(value) ? value : "A") : value;

    setData((current) => ({
      ...current,
      courses: current.courses.map((course) =>
        course.id === courseId
          ? {
              ...course,
              [field]: nextValue
            }
          : course
      )
    }));
    setMessage("");
    setError("");
  }

  function addCourse() {
    setData((current) => ({
      ...current,
      courses: [...current.courses, createCourse()]
    }));
  }

  function removeCourse(courseId: string) {
    setData((current) => {
      const courses = current.courses.filter((course) => course.id !== courseId);
      return {
        ...current,
        courses: courses.length > 0 ? courses : [createCourse()]
      };
    });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "grademate-simple-gpa.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Exported your quick calculator data.");
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const importedData = sanitizeImportedData(JSON.parse(text));
      setData(importedData);
      setImportText("");
      setMessage("Imported your quick calculator data.");
      setError("");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import that file."
      );
    }
  }

  function importFromText() {
    try {
      const importedData = sanitizeImportedData(JSON.parse(importText));
      setData(importedData);
      setImportText("");
      setMessage("Imported your quick calculator data.");
      setError("");
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Paste a valid GradeMate Simple export."
      );
    }
  }

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-6 text-ink-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-ink-200 bg-white/90 p-5 shadow-soft shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shadow-teal-950/30">
              <GraduationCap aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <Badge tone="teal">Simple Mode</Badge>
              <h1 className="mt-2 text-2xl font-semibold text-ink-900">
                GradeMate Simple
              </h1>
              <p className="mt-1 text-sm text-ink-500">
                Fast GPA math. No account. Saved on this device.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportData} variant="secondary">
              <Download aria-hidden="true" className="h-4 w-4" />
              Export
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
            >
              <FileUp aria-hidden="true" className="h-4 w-4" />
              Import
            </Button>
            <Link
              className={buttonStyles({ variant: "primary" })}
              href="/dashboard"
            >
              Open Workspace
            </Link>
            <ThemeToggle />
            <input
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  void importFile(file);
                }

                event.target.value = "";
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-500">Semester GPA</p>
            <p className="mt-3 text-4xl font-semibold text-ink-900">
              {formatGpa(summary.semesterGpa)}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Current semester only
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-500">Cumulative GPA</p>
            <p className="mt-3 text-4xl font-semibold text-ink-900">
              {formatGpa(summary.cumulativeGpa)}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Existing GPA plus this term
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-500">Credit Hours</p>
            <p className="mt-3 text-4xl font-semibold text-ink-900">
              {summary.semesterHours}
            </p>
            <p className="mt-2 text-sm text-ink-500">
              {summary.cumulativeHours} cumulative hours
            </p>
          </Card>
        </section>

        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-lime-200 bg-lime-50 text-lime-800"
            }`}
          >
            {error || message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-ink-900">
                Student Information
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Add your current GPA to calculate a cumulative result.
              </p>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-ink-700">
                    Existing CGPA
                  </span>
                  <input
                    className="mt-1 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                    max="4"
                    min="0"
                    onChange={(event) =>
                      updateData({ existingCgpa: event.target.value })
                    }
                    placeholder="3.45"
                    step="0.01"
                    type="number"
                    value={data.existingCgpa}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-ink-700">
                    Completed hours
                  </span>
                  <input
                    className="mt-1 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                    min="0"
                    onChange={(event) =>
                      updateData({ completedHours: event.target.value })
                    }
                    placeholder="60"
                    step="1"
                    type="number"
                    value={data.completedHours}
                  />
                </label>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold text-ink-900">
                Import JSON
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Paste a GradeMate Simple export here.
              </p>
              <textarea
                className="mt-4 min-h-32 w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                onChange={(event) => setImportText(event.target.value)}
                placeholder='{"existingCgpa":"3.5","completedHours":"60","courses":[...]}'
                value={importText}
              />
              <Button
                className="mt-3 w-full"
                disabled={!importText.trim()}
                onClick={importFromText}
                variant="secondary"
              >
                Import pasted JSON
              </Button>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-ink-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Current Semester Courses
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Add each course, credit hours, and expected letter grade.
                </p>
              </div>
              <Button onClick={addCourse}>
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                Add course
              </Button>
            </div>

            <div className="divide-y divide-ink-200">
              {data.courses.map((course, index) => {
                const gradePoints = getGradePoint(course.letterGrade);
                const qualityPoints = getCourseQualityPoints(course);

                return (
                  <div className="space-y-4 p-5" key={course.id}>
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_8rem_9rem_8rem_9rem_auto] lg:items-end">
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Course name
                        </span>
                        <input
                          className="mt-1 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                          onChange={(event) =>
                            updateCourse(course.id, "name", event.target.value)
                          }
                          placeholder={`Course ${index + 1}`}
                          value={course.name}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Credits
                        </span>
                        <input
                          className="mt-1 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                          min="0"
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              "creditHours",
                              event.target.value
                            )
                          }
                          step="0.5"
                          type="number"
                          value={course.creditHours}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-ink-700">
                          Letter grade
                        </span>
                        <select
                          className="mt-1 h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                          onChange={(event) =>
                            updateCourse(
                              course.id,
                              "letterGrade",
                              event.target.value
                            )
                          }
                          value={course.letterGrade}
                        >
                          {gradeScale.map((grade) => (
                            <option key={grade.letter} value={grade.letter}>
                              {grade.letter}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div>
                        <span className="text-sm font-medium text-ink-700">
                          Points
                        </span>
                        <p className="mt-1 flex h-11 items-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-900">
                          {gradePoints.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-ink-700">
                          Quality points
                        </span>
                        <p className="mt-1 flex h-11 items-center rounded-xl bg-ink-100 px-3 text-sm font-semibold text-ink-900">
                          {qualityPoints.toFixed(1)}
                        </p>
                      </div>
                      <Button
                        aria-label={`Remove ${course.name || `course ${index + 1}`}`}
                        onClick={() => removeCourse(course.id)}
                        size="icon"
                        variant="danger"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </div>

                    <details className="rounded-xl bg-ink-100/60 px-4 py-3 text-sm text-ink-500">
                      <summary className="cursor-pointer font-medium text-ink-700">
                        Coursework details
                      </summary>
                      <p className="mt-2">
                        Keep this quick calculator simple for now. Use the
                        GradeMate Workspace when you want assessments,
                        predictions, syllabi, and AI assist.
                      </p>
                    </details>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}
