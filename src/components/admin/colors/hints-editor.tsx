"use client";

import * as React from "react";
import { Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  HINT_CATEGORIES,
  HINT_CATEGORY_BUCKETS,
  HINT_CATEGORY_LABELS,
  buildCategoryPreview,
  type HintBucket,
  type HintCategory,
  type HintConfig,
} from "@/lib/game/hints";
import type { Pokemon } from "@/types/pokemon";
import { cn } from "@/lib/utils";

interface HintsEditorProps {
  pokemon: Pokemon | null;
  value: HintConfig | null;
  onChange: (next: HintConfig | null) => void;
  onAnnounce?: (msg: string) => void;
}

const OVERRIDE_MAX_LEN = 200;
const BUCKET_DESCRIPTIONS: Record<HintBucket, string> = {
  vague: "Broad — first hint slot",
  medium: "Narrowing — second hint slot",
  specific: "Revealing — used only as backup",
};

function bucketToneClass(bucket: HintBucket) {
  switch (bucket) {
    case "vague":
      return "text-emerald-600 dark:text-emerald-400";
    case "medium":
      return "text-amber-600 dark:text-amber-400";
    case "specific":
      return "text-rose-600 dark:text-rose-400";
  }
}

function setDisabled(
  config: HintConfig | null,
  category: HintCategory,
  disabled: boolean,
): HintConfig | null {
  const current = new Set(config?.disabled ?? []);
  if (disabled) current.add(category);
  else current.delete(category);
  const next: HintConfig = {
    disabled: Array.from(current),
    overrides: { ...(config?.overrides ?? {}) },
  };
  return normalize(next);
}

function setOverride(
  config: HintConfig | null,
  category: HintCategory,
  override: string,
): HintConfig | null {
  const overrides = { ...(config?.overrides ?? {}) };
  if (override.trim().length === 0) {
    delete overrides[category];
  } else {
    overrides[category] = override.slice(0, OVERRIDE_MAX_LEN);
  }
  const next: HintConfig = {
    disabled: [...(config?.disabled ?? [])],
    overrides,
  };
  return normalize(next);
}

function normalize(config: HintConfig): HintConfig | null {
  const disabled = config.disabled?.filter(Boolean) ?? [];
  const overrides = config.overrides ?? {};
  const hasOverrides = Object.keys(overrides).some(
    (k) =>
      typeof overrides[k as HintCategory] === "string" &&
      (overrides[k as HintCategory] as string).length > 0,
  );
  if (disabled.length === 0 && !hasOverrides) return null;
  return { disabled, overrides };
}

export function HintsEditor({
  pokemon,
  value,
  onChange,
  onAnnounce,
}: HintsEditorProps) {
  const preview = React.useMemo(
    () =>
      pokemon
        ? buildCategoryPreview(pokemon)
        : ({
            type: null,
            evolution_stage: null,
            generation: null,
            species: null,
            description: null,
          } as Record<HintCategory, string | null>),
    [pokemon],
  );

  const disabledSet = React.useMemo(
    () => new Set(value?.disabled ?? []),
    [value],
  );
  const overrides = value?.overrides ?? {};

  const activeOverrides = Object.values(overrides).filter(
    (v) => typeof v === "string" && v.length > 0,
  ).length;
  const summary = `${disabledSet.size} disabled · ${activeOverrides} overrides`;

  return (
    <div className="space-y-4" aria-label="Hints editor">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <Lightbulb
              className="size-3.5 text-amber-500"
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold">Daily hints</h3>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {summary}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Toggle categories off to remove them from the candidate pool. The
            game still picks a vague + medium hint (then reveals the full
            palette), so keep at least one of each bucket enabled.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 gap-1 text-xs"
          onClick={() => {
            onChange(null);
            onAnnounce?.("Hints reset to defaults");
          }}
          disabled={value === null}
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          Reset
        </Button>
      </div>

      <ul className="space-y-2.5" aria-label="Hint categories">
        {HINT_CATEGORIES.map((category) => {
          const autoText = preview[category];
          const override = overrides[category] ?? "";
          const isDisabled = disabledSet.has(category);
          const bucket = HINT_CATEGORY_BUCKETS[category];
          const available = autoText !== null;
          return (
            <li
              key={category}
              className={cn(
                "rounded-md border bg-card p-3",
                isDisabled && "opacity-60",
              )}
            >
              <HintCategoryRow
                category={category}
                bucket={bucket}
                autoText={autoText}
                available={available}
                isDisabled={isDisabled}
                override={override ?? ""}
                onDisabledChange={(d) =>
                  onChange(setDisabled(value, category, d))
                }
                onOverrideChange={(text) =>
                  onChange(setOverride(value, category, text))
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface HintCategoryRowProps {
  category: HintCategory;
  bucket: HintBucket;
  autoText: string | null;
  available: boolean;
  isDisabled: boolean;
  override: string;
  onDisabledChange: (disabled: boolean) => void;
  onOverrideChange: (override: string) => void;
}

function HintCategoryRow({
  category,
  bucket,
  autoText,
  available,
  isDisabled,
  override,
  onDisabledChange,
  onOverrideChange,
}: HintCategoryRowProps) {
  const textareaId = `hint-override-${category}`;
  const switchId = `hint-enabled-${category}`;
  const hasOverride = override.trim().length > 0;
  const remaining = OVERRIDE_MAX_LEN - override.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <label
            htmlFor={switchId}
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            {HINT_CATEGORY_LABELS[category]}
          </label>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span className={bucketToneClass(bucket)}>{bucket}</span>
            <span className="text-muted-foreground/70">·</span>
            <span>{BUCKET_DESCRIPTIONS[bucket]}</span>
            {hasOverride ? (
              <>
                <span className="text-muted-foreground/70">·</span>
                <span className="inline-flex items-center gap-1 text-primary">
                  <Sparkles className="size-3" aria-hidden="true" />
                  override
                </span>
              </>
            ) : null}
          </div>
        </div>
        <Switch
          id={switchId}
          checked={!isDisabled}
          onCheckedChange={(checked) => onDisabledChange(!checked)}
          disabled={!available}
          aria-label={`${isDisabled ? "Enable" : "Disable"} ${HINT_CATEGORY_LABELS[category]} hint`}
        />
      </div>

      <div
        className="rounded border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground"
        aria-label="Auto-generated text for this category"
      >
        {available ? (
          <span>
            <span className="font-medium text-foreground/80">Auto: </span>
            {autoText}
          </span>
        ) : (
          <span className="italic">
            Not available for this Pokémon (missing data).
          </span>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label
            htmlFor={textareaId}
            className="text-[11px] font-medium text-muted-foreground"
          >
            Custom override (optional)
          </label>
          <span
            className={cn(
              "text-[10px] tabular-nums",
              remaining < 20 ? "text-amber-500" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {remaining} left
          </span>
        </div>
        <Textarea
          id={textareaId}
          value={override ?? ""}
          onChange={(e) => onOverrideChange(e.target.value)}
          placeholder={autoText ?? "No auto text to fall back to…"}
          maxLength={OVERRIDE_MAX_LEN}
          rows={2}
          spellCheck
          autoComplete="off"
          className="mt-1 min-h-[52px] text-sm"
          disabled={!available && !hasOverride}
        />
      </div>
    </div>
  );
}
