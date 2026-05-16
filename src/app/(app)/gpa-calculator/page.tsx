import { GpaCalculator } from "@/components/gpa/gpa-calculator";
import { PageHeader } from "@/components/ui/page-header";

export default function GpaCalculatorPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        description="Calculate projected term GPA from credits and letter grades while course import is still manual."
        eyebrow="Manual tool"
        title="GPA Calculator"
      />
      <GpaCalculator />
    </div>
  );
}
