import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent" | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium tracking-[-0.005em] transition-[background-color,color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-fg shadow-sm hover:bg-primary-hover hover:shadow-md",
  accent: "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover hover:shadow-md",
  secondary: "border border-border bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-2",
  outline: "border border-primary/40 bg-transparent text-primary hover:border-primary hover:bg-primary-soft",
  ghost: "text-fg-soft hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-danger-fg shadow-sm hover:bg-danger-hover",
  link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5",
  sm: "h-8 px-3 text-sm [&_svg]:size-4",
  md: "h-10 px-4 text-sm [&_svg]:size-4",
  lg: "h-12 rounded-xl px-6 text-base [&_svg]:size-5",
  icon: "size-10 p-0 [&_svg]:size-[18px]",
  "icon-sm": "size-8 p-0 [&_svg]:size-4",
};

/** Class string for anything that should look like a button (e.g. a <label> or <a>). */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx(base, variants[variant], variant === "link" ? "text-sm" : sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  /** Optional text announced/shown while loading (defaults to children). */
  loadingText?: React.ReactNode;
  /** Icon element (e.g. <Plus />) rendered before the label. Hidden while loading. */
  icon?: React.ReactNode;
  /** Icon element rendered after the label. */
  iconRight?: React.ReactNode;
  /** Stretch to the container width. */
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    loadingText,
    icon,
    iconRight,
    fullWidth,
    disabled,
    className,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, clsx(fullWidth && "w-full", className))}
      {...rest}
    >
      {loading ? <Spinner size={size === "lg" ? 18 : 14} /> : icon ? <span aria-hidden className="contents">{icon}</span> : null}
      {loading && loadingText ? loadingText : children}
      {iconRight && !loading && (
        <span aria-hidden className="contents">
          {iconRight}
        </span>
      )}
    </button>
  );
});

export interface LinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  /** Opens in a new tab with rel="noopener noreferrer". */
  external?: boolean;
  children: React.ReactNode;
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  fullWidth,
  external,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  const cls = buttonClass(variant, size, clsx(fullWidth && "w-full", className));
  const content = (
    <>
      {icon && (
        <span aria-hidden className="contents">
          {icon}
        </span>
      )}
      {children}
      {iconRight && (
        <span aria-hidden className="contents">
          {iconRight}
        </span>
      )}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {content}
    </Link>
  );
}
