import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 font-sans font-medium tracking-wide transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-forest",
  secondary: "bg-olive text-paper hover:bg-olive-dark",
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink hover:bg-sand-100",
  danger: "bg-burgundy text-paper hover:bg-burgundy-dark",
  link: "text-ink underline underline-offset-4 hover:text-forest px-0",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-xs uppercase",
  md: "h-11 px-5 text-xs uppercase",
  lg: "h-13 px-7 text-sm uppercase py-4",
  icon: "h-11 w-11",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "h-auto" : sizes[size], "rounded-sm", className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
