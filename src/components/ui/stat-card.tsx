import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold text-ink-500">{label}</p>
          <p className="mt-2 text-[26px] font-bold leading-none text-ink-900">{value}</p>
          <p className="mt-1 text-xs text-ink-500">{hint}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}
