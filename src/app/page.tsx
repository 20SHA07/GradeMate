import Link from "next/link";
import {
  ArrowRight,
  BookMarked,
  Calculator,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";
import { MarketingNav } from "@/components/navigation/marketing-nav";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const featureCards = [
  {
    title: "Smart Syllabus Auto-Fill",
    description:
      "Upload or paste a syllabus, review the detected grading rows, and save only what you confirm.",
    icon: Sparkles
  },
  {
    title: "KU Course Library",
    description:
      "Start from rebuilt course templates with ready assessment weights for common KU courses.",
    icon: BookMarked
  },
  {
    title: "Grade Planner",
    description:
      "Pick any target grade and see the score or remaining average you need before finals week.",
    icon: Target
  },
  {
    title: "Privacy-first PDFs",
    description:
      "Normal syllabus scans happen locally in your browser. PDFs are not stored after saving.",
    icon: ShieldCheck
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-ink-50">
      <MarketingNav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl text-center">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1 text-sm font-medium text-teal-700">
            <GraduationCap aria-hidden="true" className="h-4 w-4" />
            Built for KU students
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-ink-900 sm:text-6xl">
            Your GPA, courses, and syllabus grades in one place.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-500 sm:text-lg">
            GradeMate keeps the calculator calm by default, then brings in
            syllabus auto-fill, course templates, and target planning exactly
            when you need them.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className={buttonStyles({ size: "lg" })} href="/workspace">
              Open Workspace
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link
              className={buttonStyles({ size: "lg", variant: "secondary" })}
              href="/simple"
            >
              <Calculator aria-hidden="true" className="h-4 w-4" />
              Quick GPA Calculator
            </Link>
          </div>
        </section>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card
                className="group flex min-h-52 flex-col p-5 transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40"
                key={feature.title}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700 transition group-hover:bg-teal-600 group-hover:text-white">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <h2 className="mt-5 text-lg font-semibold text-ink-900">
                  {feature.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-ink-500">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm text-ink-500">
          <Link className="rounded-md px-3 py-2 hover:bg-ink-100 hover:text-teal-700" href="/course-library">
            Browse Course Library
          </Link>
          <Link className="rounded-md px-3 py-2 hover:bg-ink-100 hover:text-teal-700" href="/login">
            Sign in with email
          </Link>
        </div>
      </main>
    </div>
  );
}
