/**
 * Render the badge wall on /account.
 *
 * Server component on purpose: badge data comes from a server-side
 * evaluator and never needs to react to client interaction. Rendering
 * server-side also means Googlebot sees badge names + descriptions in
 * the initial HTML for the /account route (useful for sitewide content
 * volume, even though /account itself is auth-gated and not indexable).
 */

import {
  BadgeDefinition,
  BADGE_DEFINITIONS,
  BadgeIconKey,
  BadgeProgress,
  evaluateBadges,
} from "@/lib/badges";
import {
  CircleCheck,
  Medal,
  Trophy,
  Crown,
  Library,
  Flame,
  Calendar,
  Rocket,
  Target,
  Eye,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<BadgeIconKey, LucideIcon> = {
  "circle-check": CircleCheck,
  medal: Medal,
  trophy: Trophy,
  crown: Crown,
  library: Library,
  flame: Flame,
  calendar: Calendar,
  rocket: Rocket,
  target: Target,
  eye: Eye,
  sparkles: Sparkles,
};

interface BadgesSectionProps {
  userId: string;
}

export async function BadgesSection({ userId }: BadgesSectionProps) {
  const progress = await evaluateBadges(userId);
  // Pair each definition with its progress entry. Both arrays have the
  // same length and ordering — see evaluateBadges() — but we use a map
  // so the UI is resilient if that contract is ever violated.
  const progressById = new Map(progress.map((p) => [p.id, p]));
  const unlocked = progress.filter((p) => p.unlocked).length;
  const total = BADGE_DEFINITIONS.length;

  return (
    <section className="mb-6 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-heading">
              Badges
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {unlocked === 0
                ? `0 of ${total} earned — start playing to unlock your first one.`
                : `${unlocked} of ${total} earned — keep going!`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-500"
                style={{ width: `${Math.round((unlocked / total) * 100)}%` }}
                aria-hidden="true"
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.round((unlocked / total) * 100)}%
            </span>
          </div>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 sm:p-6">
          {BADGE_DEFINITIONS.map((def) => {
            const p = progressById.get(def.id);
            if (!p) return null;
            return <BadgeCard key={def.id} def={def} progress={p} />;
          })}
        </ul>
      </div>
    </section>
  );
}

function BadgeCard({
  def,
  progress,
}: {
  def: BadgeDefinition;
  progress: BadgeProgress;
}) {
  const Icon = ICONS[def.icon];
  const pct = Math.round(progress.ratio * 100);
  const unlocked = progress.unlocked;
  return (
    <li
      className={`rounded-lg border p-3 sm:p-4 transition-colors ${
        unlocked ? "bg-card" : "bg-muted/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 rounded-lg p-2 ${
            unlocked ? "bg-primary/10" : "bg-muted/60"
          }`}
        >
          <Icon
            className={`w-5 h-5 ${unlocked ? def.accent : "text-muted-foreground"}`}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3
              className={`font-semibold text-sm font-heading ${
                unlocked ? "" : "text-muted-foreground"
              }`}
            >
              {def.name}
            </h3>
            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
              {Math.min(progress.current, def.target).toLocaleString()} /{" "}
              {def.target.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {def.description}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-[width] duration-700 ${
                unlocked ? "bg-primary" : "bg-primary/40"
              }`}
              style={{ width: `${pct}%` }}
              aria-hidden="true"
            />
          </div>
          {unlocked && (
            <p className="mt-1.5 text-[11px] font-medium text-primary">
              Unlocked
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
