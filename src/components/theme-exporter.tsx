"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Check,
  Code2,
  Copy,
  Download,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PREVIEW_ROWS,
  paletteToTokens,
  toJson,
  toTailwindV3Config,
  toTailwindV4Css,
  type ThemeBundle,
  type ThemeTokens,
} from "@/lib/theme-export";
import { getContrastHex } from "@/lib/game/colors";

interface ThemeExporterProps {
  colors: string[];
  pokemonName?: string;
}

type FormatId = "tw4" | "tw3" | "json";

type FormatDef = {
  id: FormatId;
  label: string;
  shortLabel: string;
  filename: (slug: string) => string;
  build: (b: ThemeBundle, name: string) => string;
};

const FORMATS: FormatDef[] = [
  {
    id: "tw4",
    label: "Tailwind v4 (CSS)",
    shortLabel: "Tailwind v4",
    filename: (slug) => `${slug}-theme.css`,
    build: (b, name) => toTailwindV4Css(b, { pokemonName: name }),
  },
  {
    id: "tw3",
    label: "Tailwind v3 (Config)",
    shortLabel: "Tailwind v3",
    filename: (slug) => `${slug}-tailwind.config.js`,
    build: (b, name) => toTailwindV3Config(b, { pokemonName: name }),
  },
  {
    id: "json",
    label: "JSON",
    shortLabel: "JSON",
    filename: (slug) => `${slug}-theme.json`,
    build: (b, name) => toJson(b, { pokemonName: name }),
  },
];

function slugify(name?: string): string {
  if (!name) return "pokemon";
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pokemon"
  );
}

// Lightweight syntax highlighting: highlights /* */ + // comments and #hex
// codes. Returns React nodes - text content is React-escaped, no
// dangerouslySetInnerHTML.
function highlightCode(text: string): ReactNode[] {
  type Token = { type: "comment" | "hex" | "plain"; text: string };
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      tokens.push({ type: "comment", text: text.slice(i, stop) });
      i = stop;
      continue;
    }
    if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      tokens.push({ type: "comment", text: text.slice(i, stop) });
      i = stop;
      continue;
    }
    const hexMatch = /^#[0-9a-fA-F]{6}\b/.exec(text.slice(i, i + 8));
    if (hexMatch) {
      tokens.push({ type: "hex", text: hexMatch[0] });
      i += hexMatch[0].length;
      continue;
    }
    // Coalesce consecutive plain chars in one token.
    const last = tokens[tokens.length - 1];
    if (last && last.type === "plain") {
      last.text += text[i];
    } else {
      tokens.push({ type: "plain", text: text[i] });
    }
    i++;
  }

  return tokens.map((t, idx) => {
    if (t.type === "comment") {
      return (
        <span key={idx} className="text-muted-foreground/70 italic">
          {t.text}
        </span>
      );
    }
    if (t.type === "hex") {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-1 align-baseline"
        >
          <span
            aria-hidden="true"
            className="inline-block size-2 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15 translate-y-[1px]"
            style={{ backgroundColor: t.text }}
          />
          <span className="text-foreground font-medium">{t.text}</span>
        </span>
      );
    }
    return <span key={idx}>{t.text}</span>;
  });
}

// Inline CSS variable overrides for the live themed preview pane. We override
// both the raw `--*` tokens (which the project's @theme inline aliases use)
// and the resolved `--color-*` tokens (Tailwind v4) so shadcn utilities like
// `bg-primary` repaint inside this scope.
function tokensToCssVars(t: ThemeTokens): CSSProperties {
  const v: Record<string, string> = {
    "--background": t.background,
    "--foreground": t.foreground,
    "--card": t.card,
    "--card-foreground": t.cardForeground,
    "--popover": t.popover,
    "--popover-foreground": t.popoverForeground,
    "--primary": t.primary,
    "--primary-foreground": t.primaryForeground,
    "--secondary": t.secondary,
    "--secondary-foreground": t.secondaryForeground,
    "--muted": t.muted,
    "--muted-foreground": t.mutedForeground,
    "--accent": t.accent,
    "--accent-foreground": t.accentForeground,
    "--destructive": t.destructive,
    "--border": t.border,
    "--input": t.input,
    "--ring": t.ring,
    "--color-background": t.background,
    "--color-foreground": t.foreground,
    "--color-card": t.card,
    "--color-card-foreground": t.cardForeground,
    "--color-primary": t.primary,
    "--color-primary-foreground": t.primaryForeground,
    "--color-secondary": t.secondary,
    "--color-secondary-foreground": t.secondaryForeground,
    "--color-muted": t.muted,
    "--color-muted-foreground": t.mutedForeground,
    "--color-accent": t.accent,
    "--color-accent-foreground": t.accentForeground,
    "--color-destructive": t.destructive,
    "--color-border": t.border,
    "--color-input": t.input,
    "--color-ring": t.ring,
  };
  return v as CSSProperties;
}

export function ThemeExporter({ colors, pokemonName }: ThemeExporterProps) {
  const [activeFormat, setActiveFormat] = useState<FormatId>("tw4");
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const [copiedFormat, setCopiedFormat] = useState<FormatId | null>(null);

  const bundle = useMemo(() => paletteToTokens(colors), [colors]);
  const slug = useMemo(() => slugify(pokemonName), [pokemonName]);
  const previewTokens =
    previewMode === "light" ? bundle.light : bundle.dark;

  const outputs = useMemo(() => {
    const map: Record<FormatId, string> = { tw4: "", tw3: "", json: "" };
    for (const f of FORMATS) {
      map[f.id] = f.build(bundle, pokemonName || "pokemon");
    }
    return map;
  }, [bundle, pokemonName]);

  if (colors.length === 0) {
    return null;
  }

  const primaryColor = colors[0];
  const primaryTextColor = getContrastHex(primaryColor);
  const activeFormatDef = FORMATS.find((f) => f.id === activeFormat)!;
  const activeOutput = outputs[activeFormat];
  const lineCount = activeOutput.split("\n").length;
  const previewVars = tokensToCssVars(previewTokens);

  const handleCopy = async (formatId: FormatId) => {
    try {
      await navigator.clipboard.writeText(outputs[formatId]);
      setCopiedFormat(formatId);
      toast.success("Theme code copied to clipboard");
      window.setTimeout(() => setCopiedFormat(null), 1500);
    } catch (error) {
      console.error("Failed to copy theme code", error);
      toast.error("Failed to copy theme code");
    }
  };

  const handleDownload = (formatId: FormatId) => {
    const def = FORMATS.find((f) => f.id === formatId);
    if (!def) return;
    try {
      const blob = new Blob([outputs[formatId]], {
        type:
          formatId === "json"
            ? "application/json"
            : formatId === "tw3"
              ? "application/javascript"
              : "text/css",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = def.filename(slug);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${def.filename(slug)}`);
    } catch (error) {
      console.error("Failed to download theme", error);
      toast.error("Failed to download theme");
    }
  };

  const handleCopyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${value.toUpperCase()}`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <section
      className="w-full max-w-6xl mx-auto px-4 md:px-12 py-6 md:py-12"
      aria-labelledby="theme-export-heading"
    >
      {/* Header */}
      <div className="mb-5 md:mb-8 min-w-0">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium mb-2 border"
          style={{
            backgroundColor: `${primaryColor}1a`,
            color: primaryColor,
            borderColor: `${primaryColor}33`,
          }}
        >
          <Sparkles className="w-3 h-3" aria-hidden="true" />
          Generated theme
        </div>
        <h2
          id="theme-export-heading"
          className="text-xl md:text-2xl font-bold font-heading flex items-center gap-2 text-pretty"
        >
          <Code2 className="w-5 h-5 md:w-6 md:h-6" aria-hidden="true" />
          Export Theme
        </h2>
        <p className="text-sm text-muted-foreground mt-1 text-pretty max-w-xl">
          A full shadcn token set built from this Pokémon’s palette - light
          and dark variants, ready to drop into your project.
        </p>
      </div>

      {/* Two-column layout: preview (left) + code (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 md:gap-6">
        {/* Preview panel */}
        <div
          className="rounded-xl border overflow-hidden flex flex-col"
          style={{
            backgroundColor: previewTokens.background,
            color: previewTokens.foreground,
            borderColor: previewTokens.border,
            ...previewVars,
          }}
        >
          <div
            className="px-3 py-2 border-b flex items-center justify-between gap-2"
            style={{ borderColor: previewTokens.border }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block size-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: previewTokens.primary }}
                aria-hidden="true"
              />
              <span className="text-xs font-medium truncate">
                Live preview
              </span>
            </div>
            <div
              className="inline-flex rounded-md p-0.5 flex-shrink-0"
              role="radiogroup"
              aria-label="Preview mode"
              style={{ backgroundColor: previewTokens.muted }}
            >
              {(["light", "dark"] as const).map((mode) => {
                const active = previewMode === mode;
                const Icon = mode === "light" ? Sun : Moon;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPreviewMode(mode)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                    style={{
                      backgroundColor: active
                        ? previewTokens.background
                        : "transparent",
                      color: active
                        ? previewTokens.foreground
                        : previewTokens.mutedForeground,
                      boxShadow: active
                        ? `0 1px 2px 0 ${previewTokens.border}`
                        : undefined,
                    }}
                  >
                    <Icon className="w-3 h-3" aria-hidden="true" />
                    <span className="capitalize">{mode}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* Themed mini UI - uses inline styles so it works regardless of
                whether scoped CSS variable overrides cascade through. */}
            <div
              className="rounded-lg border p-4"
              style={{
                backgroundColor: previewTokens.card,
                color: previewTokens.cardForeground,
                borderColor: previewTokens.border,
              }}
            >
              <p className="text-sm font-semibold leading-tight">
                Catch &apos;em all
              </p>
              <p
                className="text-xs mt-0.5 mb-3"
                style={{ color: previewTokens.mutedForeground }}
              >
                A tiny demo of your theme.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: previewTokens.primary,
                    color: previewTokens.primaryForeground,
                  }}
                >
                  Primary
                </span>
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: previewTokens.secondary,
                    color: previewTokens.secondaryForeground,
                  }}
                >
                  Secondary
                </span>
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border"
                  style={{
                    borderColor: previewTokens.accent,
                    color: previewTokens.accent,
                  }}
                >
                  Accent
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div
                  className="h-1.5 flex-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: previewTokens.muted }}
                  aria-hidden="true"
                >
                  <div
                    className="h-full w-2/3 rounded-full"
                    style={{ backgroundColor: previewTokens.primary }}
                  />
                </div>
                <span
                  className="text-[10px] font-mono tabular-nums"
                  style={{ color: previewTokens.mutedForeground }}
                >
                  66%
                </span>
              </div>
            </div>

            {/* Compact token list */}
            <ul className="grid grid-cols-2 gap-1.5">
              {PREVIEW_ROWS.map((row) => {
                const value = previewTokens[row.key];
                return (
                  <li key={row.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleCopyValue(value)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                          style={{
                            backgroundColor: "transparent",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              previewTokens.muted;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }}
                          aria-label={`Copy ${row.label} color ${value}`}
                        >
                          <span
                            className="size-4 rounded-sm flex-shrink-0 ring-1"
                            style={{
                              backgroundColor: value,
                              boxShadow: `inset 0 0 0 1px ${previewTokens.border}`,
                            }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-medium leading-tight truncate">
                              {row.label}
                            </span>
                          </span>
                          <span
                            className="text-[10px] font-mono tabular-nums opacity-70 flex-shrink-0"
                            style={{ color: previewTokens.mutedForeground }}
                          >
                            {value.toUpperCase()}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="font-mono text-xs">{row.cssVar}</p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Code panel */}
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col min-w-0">
          {/* Format tabs */}
          <Tabs
            value={activeFormat}
            onValueChange={(v) => setActiveFormat(v as FormatId)}
            aria-label="Theme export format"
            className="gap-0"
          >
            <div className="border-b px-2 py-1.5 flex items-center gap-2 overflow-x-auto">
              <TabsList className="bg-transparent p-0 gap-1 h-auto">
                {FORMATS.map((f) => (
                  <TabsTrigger
                    key={f.id}
                    value={f.id}
                    className="cursor-pointer text-xs h-7 px-2.5 data-[state=active]:bg-muted data-[state=active]:shadow-none rounded-md"
                  >
                    {f.shortLabel}
                  </TabsTrigger>
                ))}
              </TabsList>
              <span className="ml-auto text-[10px] font-mono tabular-nums text-muted-foreground hidden sm:inline">
                {lineCount} lines
              </span>
            </div>

            {FORMATS.map((f) => (
              <TabsContent
                key={f.id}
                value={f.id}
                className="m-0 flex-1 flex flex-col min-h-0"
              >
                {/* Window-style filename bar */}
                <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="size-2.5 rounded-full bg-red-400/70" />
                    <span className="size-2.5 rounded-full bg-yellow-400/70" />
                    <span className="size-2.5 rounded-full bg-green-400/70" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground truncate">
                    {f.filename(slug)}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="cursor-pointer h-7 px-2 text-xs"
                      onClick={() => handleCopy(f.id)}
                      aria-label={`Copy ${f.label} to clipboard`}
                    >
                      {copiedFormat === f.id ? (
                        <>
                          <Check
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          <span className="ml-1">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          <span className="ml-1">Copy</span>
                        </>
                      )}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="cursor-pointer h-7 w-7 p-0"
                          onClick={() => handleDownload(f.id)}
                          aria-label={`Download ${f.label} as a file`}
                        >
                          <Download
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Download {f.filename(slug)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {/* Code body */}
                <pre
                  className="text-xs md:text-[13px] font-mono leading-relaxed overflow-auto max-h-[28rem] lg:max-h-[32rem] p-4 m-0 bg-muted/20 flex-1"
                  tabIndex={0}
                  aria-label={`${f.label} theme code`}
                >
                  <code>{highlightCode(outputs[f.id])}</code>
                </pre>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* CTA strip */}
      <div className="mt-5 md:mt-6 flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-between rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground text-pretty">
          Tip: paste the CSS into your{" "}
          <code className="font-mono px-1 py-0.5 rounded bg-muted text-foreground">
            globals.css
          </code>{" "}
          to instantly try the theme.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => handleCopy(activeFormat)}
          aria-label={`Copy ${activeFormatDef.label} theme code`}
          className="cursor-pointer border-0 font-medium transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-sm motion-reduce:transition-none motion-reduce:hover:scale-100 sm:ml-auto"
          style={{
            backgroundColor: primaryColor,
            color: primaryTextColor,
          }}
        >
          {copiedFormat === activeFormat ? (
            <>
              <Check className="w-4 h-4 mr-2" aria-hidden="true" />
              Copied to clipboard
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
              Copy {activeFormatDef.shortLabel} theme
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
