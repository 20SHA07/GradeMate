import { GpaCalculator } from "@/components/gpa/gpa-calculator";
import { PageHeader } from "@/components/ui/page-header";

export default function GpaCalculatorPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        description="Choose semesters, use assessment-derived course grades, override letters, and test what-if outcomes."
        eyebrow="Planning"
        title="GPA Calculator"
      />
      <GpaCalculator />
    </div>
  );
}
