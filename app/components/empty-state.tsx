import { type LucideIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";

/** Shown in place of a list or panel that has nothing in it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: { box: "px-4 py-5", circle: "size-9 ring-4", icon: "size-4" },
    md: { box: "px-6 py-12", circle: "size-12 ring-8", icon: "size-6" },
    lg: { box: "px-6 py-16 sm:py-24", circle: "size-16 ring-[12px]", icon: "size-8" },
  }[size];

  return (
    <div className={`flex flex-col items-center text-center ${sizes.box} ${className}`}>
      <span
        className={`mb-3 grid place-items-center rounded-full bg-navy-50 text-navy-700 ring-navy-50/50 ${sizes.circle}`}
      >
        <Icon className={sizes.icon} aria-hidden />
      </span>
      <p
        className={`font-semibold text-navy-900 ${size === "lg" ? "text-base" : "text-sm"}`}
      >
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Clears ?q= (and the page number) while staying on the same page. */
export function ClearSearchLink() {
  const { pathname } = useLocation();
  return (
    <Link to={pathname} replace preventScrollReset className="btn-secondary">
      <X className="size-4" aria-hidden />
      Clear search
    </Link>
  );
}
