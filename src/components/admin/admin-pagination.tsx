"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisible?: number;
  className?: string;
}

function buildPageList(
  current: number,
  total: number,
  maxVisible: number,
): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  if (total <= maxVisible) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }

  if (current <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(total);
  } else if (current >= total - 2) {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = total - 3; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push("ellipsis");
    for (let i = current - 1; i <= current + 1; i++) pages.push(i);
    pages.push("ellipsis");
    pages.push(total);
  }
  return pages;
}

export function AdminPagination({
  page,
  totalPages,
  onPageChange,
  maxVisible = 5,
  className,
}: AdminPaginationProps) {
  const pages = React.useMemo(
    () => buildPageList(page, totalPages, maxVisible),
    [page, totalPages, maxVisible],
  );

  const navClass = cn("flex items-center gap-1", className);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  const baseBtn = buttonVariants({ variant: "ghost", size: "icon" });
  const activeBtn = buttonVariants({ variant: "outline", size: "icon" });

  return (
    <nav role="navigation" aria-label="Pagination" className={navClass}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={prevDisabled}
        aria-label="Go to previous page"
        className={cn(
          baseBtn,
          "gap-1 px-2.5",
          prevDisabled && "pointer-events-none opacity-50",
        )}
      >
        <ChevronLeft aria-hidden="true" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {pages.map((p, idx) =>
        p === "ellipsis" ? (
          <span
            key={`ellipsis-${idx}`}
            aria-hidden="true"
            className="flex size-9 items-center justify-center text-muted-foreground"
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">More pages</span>
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-label={`Go to page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              p === page ? activeBtn : baseBtn,
              "tabular-nums",
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={nextDisabled}
        aria-label="Go to next page"
        className={cn(
          baseBtn,
          "gap-1 px-2.5",
          nextDisabled && "pointer-events-none opacity-50",
        )}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  );
}
