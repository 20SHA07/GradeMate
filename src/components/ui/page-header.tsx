import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-ink-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-sm font-medium uppercase tracking-normal text-teal-700">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-base leading-7 text-ink-600">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}
