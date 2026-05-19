import Link from "next/link";
import { ExtractorLabClient } from "@/components/extractor-lab/extractor-lab-client";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ExtractorLabPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_EXTRACTOR_LAB !== "true"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
        <Card className="w-full max-w-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-ink-900">
            Extractor Lab is development-only
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-500">
            The public app keeps the testing lab hidden so students stay focused
            on the calculator, workspace, and Course Library.
          </p>
          <Link className={buttonStyles({ className: "mt-5" })} href="/">
            Back to GradeMate
          </Link>
        </Card>
      </main>
    );
  }

  return <ExtractorLabClient />;
}
