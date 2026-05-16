import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  ClipboardCheck,
  FileUp,
  Gauge,
  ShieldCheck
} from "lucide-react";
import { MarketingNav } from "@/components/navigation/marketing-nav";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const featureCards = [
  {
    title: "Syllabus workspace",
    description: "Keep PDFs, grading weights, assessments, and course rules together.",
    icon: FileUp
  },
  {
    title: "Grade tracking",
    description: "Track current grades against targets before finals arrive.",
    icon: ClipboardCheck
  },
  {
    title: "GPA planning",
    description: "Model semester outcomes with a simple calculator and course history.",
    icon: Calculator
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <MarketingNav />
      <main>
        <section className="border-b border-ink-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:px-8 lg:py-20">
            <div className="flex flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-normal text-teal-700">
                Course clarity, before crunch time
              </p>
              <h1 className="mt-4 text-5xl font-semibold text-ink-900 sm:text-6xl">
                GradeMate
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-600">
                Turn course syllabi into organized grade trackers, semester views,
                and GPA projections. The first MVP is ready for manual tracking now
                and designed for AI extraction later.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  className={buttonStyles({ variant: "primary", size: "lg" })}
                  href="/dashboard"
                >
                  Open dashboard
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
                <Link
                  className={buttonStyles({ variant: "secondary", size: "lg" })}
                  href="/gpa-calculator"
                >
                  Try GPA calculator
                </Link>
              </div>
            </div>

            <Card className="p-5 shadow-soft">
              <div className="flex items-center justify-between border-b border-ink-100 pb-4">
                <div>
                  <p className="text-sm font-medium text-teal-700">Spring 2026</p>
                  <h2 className="mt-1 text-xl font-semibold text-ink-900">
                    Semester snapshot
                  </h2>
                </div>
                <span className="rounded-full border border-lime-200 bg-lime-50 px-3 py-1 text-xs font-medium text-lime-800">
                  3.58 GPA
                </span>
              </div>
              <div className="mt-5 space-y-4">
                {[
                  ["MATH 201", "Calculus II", 91],
                  ["CS 230", "Data Structures", 87],
                  ["BIO 120", "Human Biology", 0]
                ].map(([code, title, grade]) => (
                  <div className="rounded-lg border border-ink-200 p-4" key={code}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-teal-700">{code}</p>
                        <p className="mt-1 font-medium text-ink-900">{title}</p>
                      </div>
                      <span className="text-sm font-semibold text-ink-700">
                        {grade}%
                      </span>
                    </div>
                    <Progress
                      className="mt-3"
                      tone={Number(grade) > 0 ? "teal" : "gold"}
                      value={Number(grade)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card className="p-5" key={feature.title}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold text-ink-900">
                    {feature.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink-500">
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    Built for Supabase and OpenAI
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink-500">
                    Auth, storage, data models, and validation can be added without
                    reshaping the route structure.
                  </p>
                </div>
                <ShieldCheck
                  aria-hidden="true"
                  className="h-10 w-10 shrink-0 text-teal-700"
                />
              </div>
            </Card>
            <Card className="p-5">
              <Gauge aria-hidden="true" className="h-10 w-10 text-amber-600" />
              <h2 className="mt-4 text-lg font-semibold text-ink-900">
                MVP first
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-500">
                Manual course tracking ships before AI extraction enters the flow.
              </p>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
