import clsx from "clsx";

export type Tone = "neutral" | "primary" | "accent" | "success" | "warning" | "danger" | "info";
export type BadgeVariant = "soft" | "solid" | "outline" | "dot";
export type BadgeSize = "sm" | "md";

const soft: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-soft border-border",
  primary: "bg-primary-soft text-primary-soft-fg border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
};
const solid: Record<Tone, string> = {
  neutral: "bg-fg-soft text-surface border-transparent",
  primary: "bg-primary text-primary-fg border-transparent",
  accent: "bg-accent text-accent-fg border-transparent",
  success: "bg-success text-surface border-transparent",
  warning: "bg-warning text-surface border-transparent",
  danger: "bg-danger text-danger-fg border-transparent",
  info: "bg-info text-surface border-transparent",
};
const text: Record<Tone, string> = {
  neutral: "text-fg-soft",
  primary: "text-primary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  size = "sm",
  icon,
  className,
  children,
  title,
}: {
  tone?: Tone;
  /** soft (default) tinted bg · solid · outline · dot (coloured dot + neutral chip) */
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium leading-none [&_svg]:shrink-0",
        size === "sm" ? "h-[22px] px-2 text-xs [&_svg]:size-3" : "h-7 px-2.5 text-small [&_svg]:size-3.5",
        variant === "soft" && soft[tone],
        variant === "solid" && solid[tone],
        variant === "outline" && clsx("bg-transparent border-current/30", text[tone]),
        variant === "dot" && "border-border bg-surface text-fg-soft",
        className,
      )}
    >
      {variant === "dot" && <span aria-hidden className={clsx("size-1.5 rounded-full bg-current", text[tone])} />}
      {icon && <span aria-hidden className="contents">{icon}</span>}
      {children}
    </span>
  );
}

const SEVERITY_CLASS: Record<string, string> = {
  critical: "bg-sev-critical-soft text-sev-critical font-semibold uppercase tracking-wide",
  high: "bg-sev-high-soft text-sev-high capitalize",
  medium: "bg-sev-medium-soft text-sev-medium capitalize",
  low: "bg-sev-low-soft text-sev-low capitalize",
  info: "bg-sev-info-soft text-sev-info capitalize",
};

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium leading-none",
        SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.info,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

const RISK: Record<string, { cls: string; label: string; help: string }> = {
  A: { cls: "bg-risk-a-soft text-risk-a", label: "Class A · low risk", help: "Reversible, low-impact change; may auto-execute when permitted." },
  B: { cls: "bg-risk-b-soft text-risk-b", label: "Class B · moderate", help: "Auto-executes only if you allowed this action type; otherwise needs approval." },
  C: { cls: "bg-risk-c-soft text-risk-c", label: "Class C · material", help: "Material change — always requires approval of the exact draft." },
  D: { cls: "bg-risk-d-soft text-risk-d", label: "Class D · restricted", help: "High-risk change — blocked from automation." },
};

export function RiskBadge({ riskClass, compact, className }: { riskClass: string; compact?: boolean; className?: string }) {
  const r = RISK[riskClass] ?? { cls: "bg-surface-2 text-fg-soft", label: `Class ${riskClass}`, help: "" };
  return (
    <span
      title={r.help || undefined}
      className={clsx(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium leading-none",
        r.cls,
        className,
      )}
    >
      <span aria-hidden className="flex size-4 items-center justify-center rounded-full bg-current/15 text-[10px] font-bold">
        {riskClass}
      </span>
      {compact ? <span className="sr-only">{r.label}</span> : r.label.replace(/^Class \w · /, "")}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  queued: "neutral",
  preflight: "info",
  running: "info",
  validating: "info",
  executing: "info",
  retry_scheduled: "warning",
  awaiting_approval: "warning",
  proposed: "primary",
  approved: "accent",
  succeeded: "success",
  succeeded_with_warnings: "warning",
  resolved: "success",
  healthy: "success",
  open: "primary",
  ignored: "neutral",
  rejected: "neutral",
  expired: "neutral",
  cancelled: "neutral",
  blocked: "danger",
  failed: "danger",
  rollback_pending: "warning",
  rolled_back: "neutral",
  rollback_failed: "danger",
  degraded: "warning",
  unknown: "neutral",
  active: "success",
  invited: "warning",
  past_due: "danger",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const live = ["queued", "preflight", "running", "validating", "executing"].includes(status);
  return (
    <Badge tone={tone} className={clsx("capitalize", className)}>
      <span aria-hidden className={clsx("size-1.5 rounded-full bg-current", live && "animate-pulse")} />
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
