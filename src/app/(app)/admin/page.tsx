import Link from "next/link";
import { FileText } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        description="Review submitted syllabuses and verified extraction feedback before anything becomes shared library data."
        title="Admin"
      />

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] bg-teal-50 text-teal-700">
              <FileText aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-ink-900">
                Contribution review
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Approve, reject, or request changes for pending syllabus
                contributions. Verified extraction feedback is shown there too.
              </p>
            </div>
          </div>
          <Link className={buttonStyles()} href="/admin/contributions">
            Open review
          </Link>
        </div>
      </Card>
    </div>
  );
}
