import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const baseStyles =
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-[3px] border font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 disabled:pointer-events-none disabled:opacity-50";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "border-teal-500 bg-teal-500 text-ink-50 hover:border-teal-300 hover:bg-teal-300 hover:text-ink-50",
  secondary:
    "border-ink-200 bg-white/80 text-ink-900 hover:border-ink-300 hover:bg-ink-100",
  ghost: "border-transparent bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger:
    "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-50/80"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9 p-0"
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(baseStyles, variantStyles[variant], sizeStyles[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonStyles({ variant, size, className })}
      type={type}
      {...props}
    />
  );
}
