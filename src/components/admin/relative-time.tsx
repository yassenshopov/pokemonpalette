"use client";

import { formatAbsolute, formatRelative } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

interface RelativeTimeProps {
  value: string | Date | null | undefined;
  className?: string;
  /** When true, renders the absolute datetime as the visible label with relative in tooltip. */
  absolute?: boolean;
}

export function RelativeTime({ value, className, absolute }: RelativeTimeProps) {
  if (!value) {
    return (
      <span className={cn("text-muted-foreground", className)} aria-hidden="true">
        —
      </span>
    );
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    return (
      <span className={cn("text-muted-foreground", className)} aria-hidden="true">
        —
      </span>
    );
  }
  const label = absolute ? formatAbsolute(d) : formatRelative(d);
  const title = absolute ? formatRelative(d) : formatAbsolute(d);
  return (
    <time
      dateTime={d.toISOString()}
      title={title}
      className={cn("tabular-nums", className)}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
