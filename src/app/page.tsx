import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  Calculator,
  Moon,
  Sparkles,
} from "lucide-react";
import { MarketingNav } from "@/components/navigation/marketing-nav";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const featureCards = [
  {
    title: "Smart Syllabus Auto-Fill",
    description:
      "Read syllabus PDFs locally, review detected grading rows, then save only confirmed data.",
    icon: Sparkles,
    className: "md:col-span-2"
  },
  {
    title: "KU Course Library",
    description:
      "Import student-maintained templates with assessment weights already structured.",
    icon: BookMarked,
    className: ""
  },
  {
    title: "Real-time Projections",
    description:
      "Choose a target grade and see the remaining average you need.",
    icon: BarChart3,
    className: ""
  },
  {
    title: "Architected for Focus",
    description:
      "A compact dark workspace for quick checks, late study sessions, and exam planning.",
    icon: Moon,
    className: "md:col-span-2"
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-ink-50">
      <MarketingNav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
        <section className="grid gap-4 border border-ink-200 bg-white/90 p-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:p-6">
          <div className="max-w-2xl">
            <Badge tone="teal">Student Workspace</Badge>
            <h1 className="mt-4 text-[34px] font-bold leading-tight tracking-normal text-ink-900 sm:text-[38px]">
              Your GPA, simplified.
            </h1>
            <p className="mt-4 max-w-xl text-[13px] leading-5 text-ink-700">
              The student-first grade tracker built for KU courses, syllabus
              review, and target planning.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link className={buttonStyles({ size: "lg" })} href="/workspace">
              Enter Workspace
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
          </div>
          <div className="rounded-[3px] bg-ink-100 p-4">
            <p className="text-[13px] font-semibold text-ink-500">
              What GradeMate tracks
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Courses", "weights"],
                ["GPA", "terms"],
                ["Planner", "targets"],
                ["Syllabus", "review"]
              ].map(([label, value]) => (
                <div className="rounded-[3px] bg-white/80 p-3" key={label}>
                  <p className="text-xs text-ink-500">{label}</p>
                  <p className="mt-1 text-[20px] font-bold leading-none text-ink-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card
                className={`group flex min-h-32 flex-col p-4 transition-colors hover:border-teal-200 hover:bg-teal-50/20 ${feature.className}`}
                key={feature.title}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-teal-50 text-teal-300 transition-colors">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 className="mt-3 text-[15px] font-semibold leading-tight text-ink-900">
                  {feature.title}
                </h2>
                <p className="mt-2 max-w-md text-[13px] leading-5 text-ink-700">
                  {feature.description}
                </p>
                {feature.title === "Smart Syllabus Auto-Fill" ? (
                  <p className="mt-auto pt-5 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                    PDFs stay local by default.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-2xl border border-ink-200 bg-white/70 px-4 py-3 text-center text-xs text-ink-600">
          PDFs are read locally and not stored. You decide what course data gets saved.
        </p>

        <p className="mx-auto mt-4 max-w-2xl text-center text-[11px] leading-5 text-ink-500">
          Made by a KU student for KU students. Always verify
          course details with your official syllabus.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-ink-500">
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
