"use client";

import * as React from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  parseIsoDate,
  presetToRange,
  RANGE_PRESETS,
  type RangeValue,
  toIsoDate,
} from "@/lib/admin/range";

interface RangePickerProps {
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  className?: string;
  disabled?: boolean;
}

const absoluteDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatRangeLabel(value: RangeValue): string {
  const preset = RANGE_PRESETS.find((p) => p.id === value.preset);
  if (preset) return preset.label;
  const from = parseIsoDate(value.from);
  const to = parseIsoDate(value.to);
  if (!from || !to) return "Custom range";
  return `${absoluteDateFormatter.format(from)} – ${absoluteDateFormatter.format(to)}`;
}

export function RangePicker({
  value,
  onChange,
  className,
  disabled,
}: RangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(() => {
    const from = parseIsoDate(value.from);
    const to = parseIsoDate(value.to);
    return from && to ? { from, to } : undefined;
  });

  React.useEffect(() => {
    if (!open) return;
    const from = parseIsoDate(value.from);
    const to = parseIsoDate(value.to);
    setDraft(from && to ? { from, to } : undefined);
  }, [open, value.from, value.to]);

  const applyDraft = () => {
    if (!draft?.from || !draft?.to) return;
    onChange({
      preset: "custom",
      from: toIsoDate(draft.from),
      to: toIsoDate(draft.to),
    });
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-md border bg-background p-0.5",
        className,
      )}
      role="group"
      aria-label="Time range"
    >
      {RANGE_PRESETS.map((preset) => {
        const active = value.preset === preset.id;
        return (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={active ? "default" : "ghost"}
            disabled={disabled}
            onClick={() => onChange(presetToRange(preset.id))}
            aria-pressed={active}
            className="h-7 px-2.5 text-xs"
          >
            {preset.shortLabel}
          </Button>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={value.preset === "custom" ? "default" : "ghost"}
            disabled={disabled}
            className="h-7 gap-1.5 px-2.5 text-xs"
            aria-label="Choose a custom range"
          >
            <CalendarRange className="size-3.5" aria-hidden="true" />
            <span className="max-w-[18ch] truncate">
              {value.preset === "custom"
                ? formatRangeLabel(value)
                : "Custom"}
            </span>
            <ChevronDown
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={draft}
            onSelect={(range) => setDraft(range)}
            defaultMonth={draft?.from ?? parseIsoDate(value.from) ?? undefined}
            captionLayout="dropdown"
            disabled={{ after: new Date() }}
          />
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <span className="text-xs text-muted-foreground">
              {draft?.from && draft?.to
                ? `${absoluteDateFormatter.format(draft.from)} – ${absoluteDateFormatter.format(draft.to)}`
                : "Pick a start and end date."}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={applyDraft}
                disabled={!draft?.from || !draft?.to}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
