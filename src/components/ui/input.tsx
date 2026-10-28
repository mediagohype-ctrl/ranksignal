import { forwardRef } from "react";
import clsx from "clsx";
import { AlertCircle } from "lucide-react";

const control =
  "block w-full rounded-lg border border-border bg-surface px-3 text-small text-fg shadow-xs placeholder:text-muted/80 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20";

type Sz = "sm" | "md" | "lg";
const heights: Record<Sz, string> = { sm: "h-8", md: "h-10", lg: "h-12 text-body" };

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Sets aria-invalid (red border). */
  invalid?: boolean;
  inputSize?: Sz;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, inputSize = "md", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={clsx(control, heights[inputSize], className)}
      {...rest}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={clsx(control, "min-h-20 py-2 leading-relaxed", className)}
      {...rest}
    />
  );
});

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  invalid?: boolean;
  inputSize?: Sz;
}

const chevron =
  "appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378839a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, invalid, inputSize = "md", ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || rest["aria-invalid"] || undefined}
      className={clsx(control, chevron, heights[inputSize], "pr-9", className)}
      {...rest}
    >
      {children}
    </select>
  );
});

/** Ids Field uses for its hint/error text, so controls can set aria-describedby={fieldDescribedBy(id, {hint, error})}. */
export function fieldDescribedBy(htmlFor: string, o: { hint?: unknown; error?: unknown }) {
  if (o.error) return `${htmlFor}-error`;
  if (o.hint) return `${htmlFor}-hint`;
  return undefined;
}

/** Label + hint + error wrapper. Pass the control's id via `htmlFor`. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  labelAside,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string | null;
  /** Shows a red asterisk (also set `required` on the control). */
  required?: boolean;
  /** Shows "(optional)" after the label. */
  optional?: boolean;
  /** Right side of the label row, e.g. a "Forgot password?" link. */
  labelAside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="block text-small font-medium text-fg">
          {label}
          {required && (
            <span aria-hidden className="ml-0.5 text-danger">
              *
            </span>
          )}
          {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
        </label>
        {labelAside && <div className="text-small">{labelAside}</div>}
      </div>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle aria-hidden size={13} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
