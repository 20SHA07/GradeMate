import { cn } from "@/lib/utils";

type ProgressTone = "teal" | "gold" | "rose" | "green";

const toneStyles: Record<ProgressTone, string> = {
  teal: "bg-teal-700",
  gold: "bg-amber-500",
  rose: "bg-rose-500",
  green: "bg-lime-500"
};

type ProgressProps = {
  value: number;
  max?: number;
  tone?: ProgressTone;
  className?: string;
};

export function Progress({
  value,
  max = 100,
  tone = "teal",
  className
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-100", className)}
    >
      <div
        className={cn("h-full rounded-full transition-all", toneStyles[tone])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
