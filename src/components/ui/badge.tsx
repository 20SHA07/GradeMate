import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "teal" | "gold" | "rose" | "ink" | "green";

const toneStyles: Record<BadgeTone, string> = {
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  gold: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  ink: "border-ink-200 bg-ink-50 text-ink-700",
  green: "border-lime-200 bg-lime-50 text-lime-800"
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ className, tone = "ink", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2.5 py-1 text-xs font-medium",
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}
