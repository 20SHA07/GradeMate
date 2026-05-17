import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <Card className="flex min-h-56 flex-col items-center justify-center p-7 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  );
}
