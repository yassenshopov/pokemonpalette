"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface RowAction {
  id: string;
  label: string;
  onSelect: () => void | Promise<void>;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  /** Optional group label rendered above this item. */
  groupLabel?: string;
}

interface RowActionsProps {
  label?: string;
  actions: RowAction[];
  align?: "start" | "end";
}

export function RowActions({
  label = "Row actions",
  actions,
  align = "end",
}: RowActionsProps) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-56"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action, idx) => {
          const node = (
            <DropdownMenuItem
              key={action.id}
              onSelect={(e) => {
                e.preventDefault();
                if (!action.disabled) void action.onSelect();
              }}
              disabled={action.disabled}
              className={cn(
                action.destructive &&
                  "text-destructive focus:text-destructive",
              )}
            >
              {action.icon ? (
                <span className="mr-1 inline-flex size-4 items-center justify-center text-muted-foreground">
                  {action.icon}
                </span>
              ) : null}
              {action.label}
            </DropdownMenuItem>
          );

          const needsSeparator = action.separatorBefore && idx > 0;
          const groupHeader = action.groupLabel ? (
            <DropdownMenuLabel
              key={`${action.id}-label`}
              className="text-xs text-muted-foreground"
            >
              {action.groupLabel}
            </DropdownMenuLabel>
          ) : null;

          return (
            <React.Fragment key={action.id}>
              {needsSeparator ? <DropdownMenuSeparator /> : null}
              {groupHeader}
              {node}
            </React.Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
