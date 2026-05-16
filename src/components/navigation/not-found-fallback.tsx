"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedSessionProvider } from "@/components/auth/protected-session-provider";
import { CourseDetailClient } from "@/components/courses/course-detail-client";
import { AppShell } from "@/components/navigation/app-shell";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function getCourseIdFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const courseSegmentIndex = segments.indexOf("courses");
  const courseId = segments[courseSegmentIndex + 1];

  return courseSegmentIndex >= 0 && courseId && courseId !== "[courseId]"
    ? decodeURIComponent(courseId)
    : "";
}

export function NotFoundFallback() {
  const [courseId, setCourseId] = useState("");

  useEffect(() => {
    setCourseId(getCourseIdFromPath(window.location.pathname));
  }, []);

  if (courseId) {
    return (
      <ProtectedSessionProvider>
        <AppShell>
          <CourseDetailClient courseIdOverride={courseId} />
        </AppShell>
      </ProtectedSessionProvider>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <Card className="max-w-md p-6 text-center">
        <p className="text-sm font-medium text-teal-700">GradeMate</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          This page does not exist, or the course link needs to be opened from
          your GradeMate workspace.
        </p>
        <Link className={buttonStyles({ className: "mt-5" })} href="/">
          Go home
        </Link>
      </Card>
    </main>
  );
}
