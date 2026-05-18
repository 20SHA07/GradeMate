import Link from "next/link";
import { ArrowRight, Calculator, GraduationCap, Layers3 } from "lucide-react";
import { MarketingNav } from "@/components/navigation/marketing-nav";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const modeCards = [
  {
    title: "Quick GPA Calculator",
    description:
      "No account. No setup. Calculate your semester and cumulative GPA in seconds.",
    button: "Start quick calculator",
    href: "/simple",
    icon: Calculator
  },
  {
    title: "GradeMate Workspace",
    description:
      "Track semesters, courses, assessments, syllabi, predictions, and course templates.",
    button: "Open workspace",
    href: "/dashboard",
    icon: Layers3
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-50">
      <MarketingNav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm shadow-teal-950/30">
            <GraduationCap aria-hidden="true" className="h-7 w-7" />
          </span>
          <h1 className="mt-6 text-4xl font-semibold text-ink-900 sm:text-5xl">
            GradeMate
          </h1>
          <p className="mt-4 text-lg leading-8 text-ink-500">
            Choose how you want to track your grades.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {modeCards.map((mode) => {
            const Icon = mode.icon;

            return (
              <Card
                className="flex min-h-72 flex-col p-6 transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-950/10"
                key={mode.title}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <h2 className="mt-6 text-2xl font-semibold text-ink-900">
                  {mode.title}
                </h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-ink-500">
                  {mode.description}
                </p>
                <Link
                  className={buttonStyles({
                    className: "mt-6 w-full",
                    size: "lg",
                    variant: mode.href === "/simple" ? "primary" : "secondary"
                  })}
                  href={mode.href}
                >
                  {mode.button}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
