"use client";

import * as React from "react";
import { X } from "lucide-react";
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
import { cn } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Called with the selected row ids. Return a promise to disable the bar while running. */
  onRun: (ids: string[]) => void | Promise<void>;
  destructive?: boolean;
  /** If provided, shows a confirm dialog with this body before running. */
  confirm?: {
    title: string;
    description: (count: number) => string;
    confirmLabel: string;
  };
  disabled?: boolean;
}

interface BulkActionBarProps {
  selectedCount: number;
  totalOnPage: number;
  actions: BulkAction[];
  onClear: () => void;
  onSelectAllMatching?: () => void;
  selectedIds: string[];
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  totalOnPage,
  actions,
  onClear,
  onSelectAllMatching,
  selectedIds,
  className,
}: BulkActionBarProps) {
  const [pendingAction, setPendingAction] = React.useState<BulkAction | null>(
    null,
  );
  const [running, setRunning] = React.useState(false);

  if (selectedCount === 0) return null;

  const runAction = async (action: BulkAction) => {
    setRunning(true);
    try {
      await action.onRun(selectedIds);
    } finally {
      setRunning(false);
      setPendingAction(null);
    }
  };

  return (
    <>
      <div
        role="region"
        aria-label={`${selectedCount} selected`}
        className={cn(
          "sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 shadow-sm",
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear selection"
            onClick={onClear}
            className="size-7"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
          <span
            className="text-sm font-medium tabular-nums"
            aria-live="polite"
          >
            {selectedCount.toLocaleString()} selected
          </span>
          {onSelectAllMatching && selectedCount === totalOnPage ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={onSelectAllMatching}
            >
              Select all matching
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.destructive ? "destructive" : "secondary"}
              disabled={action.disabled || running}
              onClick={() => {
                if (action.confirm) setPendingAction(action);
                else void runAction(action);
              }}
            >
              {action.icon ? (
                <span className="mr-1 inline-flex size-4 items-center justify-center">
                  {action.icon}
                </span>
              ) : null}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !running) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.confirm?.title ?? "Are you sure?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.confirm?.description(selectedCount) ??
                `This will affect ${selectedCount.toLocaleString()} items.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={running}
              onClick={(e) => {
                e.preventDefault();
                if (pendingAction) void runAction(pendingAction);
              }}
              className={cn(
                pendingAction?.destructive &&
                  "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {running
                ? "Working…"
                : (pendingAction?.confirm?.confirmLabel ?? "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
