import clsx from "clsx";
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Lightbulb, XCircle } from "lucide-react";

export function SimulatedDataBanner({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      role="note"
      className={clsx(
        "flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-small text-fg-soft",
        className,
      )}
    >
      <FlaskConical size={18} className="mt-px shrink-0 text-warning" aria-hidden />
      <span>
        <strong className="font-semibold text-warning">Simulated demo data</strong>
        {" — "}
        {children ?? "connect a measurement provider for real results."}
      </span>
    </div>
  );
}

export type NoticeTone = "info" | "warning" | "danger" | "success" | "neutral" | "tip";

const NOTICE: Record<NoticeTone, { box: string; icon: string; Icon: typeof Info }> = {
  info: { box: "border-info/25 bg-info-soft", icon: "text-info", Icon: Info },
  warning: { box: "border-warning/30 bg-warning-soft", icon: "text-warning", Icon: AlertTriangle },
  danger: { box: "border-danger/30 bg-danger-soft", icon: "text-danger", Icon: XCircle },
  success: { box: "border-success/30 bg-success-soft", icon: "text-success", Icon: CheckCircle2 },
  neutral: { box: "border-border bg-surface-2", icon: "text-muted", Icon: Info },
  tip: { box: "border-accent/25 bg-accent-soft", icon: "text-accent", Icon: Lightbulb },
};

/**
 * Inline callout. Back-compat: `<Notice tone="warning">text</Notice>` still works.
 * Optional title, custom icon (pass `icon={false}` to hide), and actions row.
 */
export function Notice({
  tone = "info",
  title,
  icon,
  actions,
  className,
  children,
}: {
  tone?: NoticeTone;
  title?: React.ReactNode;
  icon?: React.ReactNode | false;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const t = NOTICE[tone];
  const Icon = t.Icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "note"}
      className={clsx("flex items-start gap-3 rounded-xl border px-4 py-3 text-small text-fg-soft", t.box, className)}
    >
      {icon !== false && (
        <span aria-hidden className={clsx("mt-px shrink-0 [&_svg]:size-[18px]", t.icon)}>
          {icon ?? <Icon />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {title && <div className="mb-0.5 font-semibold text-fg">{title}</div>}
        {children && <div className="leading-relaxed">{children}</div>}
        {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Alias of Notice for editorial/report contexts. */
export const Callout = Notice;
