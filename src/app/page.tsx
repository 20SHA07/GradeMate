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
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const featureCards = [
  {
    title: "Smart Syllabus Auto-Fill",
    description:
      "Upload your syllabus and let GradeMate extract assignments, weights, and deadlines automatically. Less data entry, more studying.",
    icon: Sparkles,
    className: "md:col-span-2"
  },
  {
    title: "KU Course Library",
    description:
      "Access a curated database of common KU courses with pre-configured grading schemas.",
    icon: BookMarked,
    className: ""
  },
  {
    title: "Real-time Projections",
    description:
      "See what you need on the final to secure your target grade instantly.",
    icon: BarChart3,
    className: ""
  },
  {
    title: "Architected for Focus",
    description:
      "A minimalist, dark-themed interface designed to reduce visual fatigue during late-night study sessions.",
    icon: Moon,
    className: "md:col-span-2"
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-ink-50">
      <MarketingNav />
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-5xl flex-col px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-2xl pt-10 text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-normal text-ink-900 sm:text-[42px]">
            Your GPA, simplified.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[13px] leading-5 text-ink-700">
            The student-first grade tracker built specifically for Khalifa University.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
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
        </section>

        <div className="mt-28 grid gap-4 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card
                className={`group flex min-h-44 flex-col p-6 transition-colors hover:border-teal-200 hover:bg-teal-50/20 ${feature.className}`}
                key={feature.title}
              >
                <span className="flex h-10 w-10 items-center justify-center text-teal-300 transition-colors">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 className="mt-5 text-[24px] font-bold leading-tight text-ink-900">
                  {feature.title}
                </h2>
                <p className="mt-3 max-w-md text-[13px] leading-5 text-ink-700">
                  {feature.description}
                </p>
                {feature.title === "Smart Syllabus Auto-Fill" ? (
                  <p className="mt-auto pt-8 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-ink-400">
                    Syllabi are read locally and never stored.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>

        <p className="mx-auto mt-6 max-w-2xl border border-ink-200 bg-white/70 px-4 py-3 text-center text-xs text-ink-600">
          PDFs are read locally and not stored. You decide what course data gets saved.
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
