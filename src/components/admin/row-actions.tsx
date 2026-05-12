"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface RowActionConfirm {
  title: string;
  description: string;
  /** Defaults to the action label. */
  confirmLabel?: string;
}

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
  /**
   * If provided, the action surfaces an AlertDialog confirmation
   * before invoking `onSelect`. Without this, the previous dropdown
   * would fire the action on the first click — fine for "Copy ID"
   * but a footgun for Ban / Lock / Demote / Delete. The single-user
   * Delete button already wraps its own AlertDialog; this lets the
   * dropdown variant get the same affordance for free.
   */
  confirm?: RowActionConfirm;
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
  // Track which `confirm`-tagged action is currently awaiting
  // confirmation. We render the AlertDialog at the root rather than
  // per-item so the dropdown's own dismissal doesn't unmount it
  // mid-prompt — Radix dropdowns close on `onSelect`, which would
  // otherwise tear down a nested dialog before the user could read it.
  const [pending, setPending] = React.useState<RowAction | null>(null);

  if (actions.length === 0) return null;
  return (
    <>
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
                  if (action.disabled) return;
                  if (action.confirm) {
                    setPending(action);
                    return;
                  }
                  void action.onSelect();
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

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.confirm?.title ?? "Are you sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.confirm?.description ?? ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const current = pending;
                setPending(null);
                if (current) void current.onSelect();
              }}
              className={cn(
                pending?.destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {pending?.confirm?.confirmLabel ?? pending?.label ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
