import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "glass" | "outline";
type Size = "sm" | "md";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
};

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_0_20px_-4px_var(--accent)]",
  glass:
    "border border-cyan-500/30 bg-slate-900/60 text-foreground backdrop-blur-xl hover:border-cyan-400/50 hover:shadow-[0_0_16px_-4px_rgba(34,211,238,0.5)]",
  outline: "border border-border text-foreground hover:border-cyan-500/40 hover:bg-white/5",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium leading-none transition line-clamp-1";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonAsLink | ButtonAsButton) {
  const cls = `${BASE} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`;

  if ("href" in props && props.href !== undefined) {
    const { href, ...anchorProps } = props as ButtonAsLink;
    return (
      <Link href={href} className={cls} {...anchorProps}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...(props as ButtonAsButton)}>
      {children}
    </button>
  );
}
