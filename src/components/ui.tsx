import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { DeploymentStatus } from "@/lib/data";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// ---------- buttons ----------

const buttonStyles = {
  primary:
    "bg-fg text-background hover:bg-fg/85 border border-transparent font-medium",
  accent:
    "bg-accent text-white hover:bg-accent-hover border border-transparent font-medium",
  secondary:
    "bg-transparent text-fg border border-edge-strong hover:border-fg-faint hover:text-fg",
  ghost: "bg-transparent text-fg-muted hover:text-fg border border-transparent",
  danger:
    "bg-danger/10 text-danger border border-danger/40 hover:bg-danger hover:text-white",
};

const buttonSizes = {
  sm: "h-8 px-3 text-[13px] rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-md gap-2",
  lg: "h-12 px-6 text-base rounded-lg gap-2",
};

type ButtonOwnProps = {
  variant?: keyof typeof buttonStyles;
  size?: keyof typeof buttonSizes;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonOwnProps & ComponentProps<"button">) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
        buttonStyles[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonOwnProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cx(
        "inline-flex items-center justify-center whitespace-nowrap transition-colors",
        buttonStyles[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

// ---------- form elements ----------

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-md border border-edge-strong bg-transparent px-3 text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:border-fg-faint focus:ring-2 focus:ring-white/10",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cx("mb-1.5 block text-[13px] font-medium text-fg-muted", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(
        "h-10 w-full appearance-none rounded-md border border-edge-strong bg-background px-3 text-sm text-fg outline-none transition-colors focus:border-fg-faint",
        className
      )}
      {...props}
    />
  );
}

// ---------- surfaces ----------

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("rounded-xl border border-edge bg-surface", className)}>
      {children}
    </div>
  );
}

// ---------- status ----------

export const STATUS_META: Record<
  DeploymentStatus,
  { label: string; dot: string; text: string; pulse?: boolean }
> = {
  QUEUED: { label: "Queued", dot: "bg-fg-faint", text: "text-fg-muted", pulse: true },
  BUILDING: { label: "Building", dot: "bg-warning", text: "text-warning", pulse: true },
  DEPLOYING: { label: "Deploying", dot: "bg-warning", text: "text-warning", pulse: true },
  READY: { label: "Ready", dot: "bg-success", text: "text-success" },
  ERROR: { label: "Error", dot: "bg-danger", text: "text-danger" },
  CANCELED: { label: "Canceled", dot: "bg-fg-faint", text: "text-fg-muted" },
};

export function StatusDot({ status, withLabel = true }: { status: DeploymentStatus; withLabel?: boolean }) {
  const meta = STATUS_META[status] ?? STATUS_META.QUEUED;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cx("h-2.5 w-2.5 rounded-full", meta.dot, meta.pulse && "animate-pulse-dot")}
      />
      {withLabel && <span className={cx("text-sm", meta.text)}>{meta.label}</span>}
    </span>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
}) {
  const tones = {
    default: "border-edge-strong text-fg-muted",
    success: "border-success/40 text-success",
    warning: "border-warning/40 text-warning",
    danger: "border-danger/40 text-danger",
    accent: "border-accent/50 text-[#52a8ff]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

// ---------- misc ----------

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx("h-4 w-4 animate-spin text-fg-muted", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-edge-strong px-6 py-16 text-center">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}
