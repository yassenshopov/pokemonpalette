"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Copy,
  Eye,
  Gamepad2,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  User as UserIcon,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/admin/kpi-card";
import { GameCalendarView } from "@/components/admin/game-calendar-view";
import {
  DataTable,
  type ColumnDef,
} from "@/components/admin/data-table";
import { RelativeTime } from "@/components/admin/relative-time";
import { formatAbsoluteDate } from "@/lib/admin/format";
import type { RowAction } from "@/components/admin/row-actions";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { AdminUserCell } from "@/components/admin/user-cell";
import { useAdminTable } from "@/hooks/use-admin-table";

type ViewId = "calendar" | "attempts";

interface GameAttempt {
  id: string;
  user_id: string;
  date: string;
  target_pokemon_id: number;
  is_shiny: boolean;
  guesses: number[];
  attempts: number;
  won: boolean;
  pokemon_guessed: number | null;
  hints_used: number;
  created_at: string;
  users?: {
    id: string;
    email: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    profile_image_url: string | null;
  } | null;
}

interface GameStats {
  totalAttempts: number;
  wins: number;
  losses: number;
  winRate: number;
  avgAttempts: number;
  avgHints: number;
  uniquePlayers: number;
  uniqueDates: number;
  topTargets: Array<{ target_pokemon_id: number; count: number }>;
}

function officialArtworkUrl(pokemonId: number, shiny = false) {
  const suffix = shiny ? "/shiny" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork${suffix}/${pokemonId}.png`;
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn’t copy ${label}`);
  }
}

function PokemonBadge({
  id,
  shiny,
  size = 32,
}: {
  id: number;
  shiny?: boolean;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md bg-muted"
      style={{ width: size, height: size }}
    >
      <Image
        src={officialArtworkUrl(id, shiny)}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain"
        unoptimized
      />
    </div>
  );
}

function GameStatsStrip() {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/game-data/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }
  if (!stats) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="Total attempts"
        value={stats.totalAttempts.toLocaleString()}
        icon={<Gamepad2 className="size-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Win rate"
        value={`${stats.winRate}%`}
        icon={<Trophy className="size-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Avg attempts"
        value={stats.avgAttempts.toFixed(2)}
        icon={<Target className="size-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Unique players"
        value={stats.uniquePlayers.toLocaleString()}
        icon={<Users className="size-4" aria-hidden="true" />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attempts view (default)
// ---------------------------------------------------------------------------

function AttemptsView() {
  const router = useRouter();
  const table = useAdminTable<GameAttempt>({
    endpoint: "/api/admin/game-data",
    filterKeys: [
      "won",
      "user_id",
      "target_pokemon_id",
      "date_from",
      "date_to",
      "created_from",
      "created_to",
    ],
    sortableFields: [
      "created_at",
      "date",
      "attempts",
      "hints_used",
      "target_pokemon_id",
    ],
    defaultSort: { field: "created_at", dir: "desc" },
    extraParams: { view: "attempts" },
    getRowId: (row) => row.id,
  });

  const mutate = async (path: string, init: RequestInit, msg: string) => {
    try {
      const res = await fetch(path, init);
      const data = res.headers
        .get("content-type")
        ?.includes("application/json")
        ? await res.json()
        : null;
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      toast.success(msg);
      table.refetch();
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong.");
    }
  };

  const deleteOne = (id: string) =>
    mutate(`/api/admin/game-data/${id}`, { method: "DELETE" }, "Attempt deleted");
  const deleteBulk = (ids: string[]) =>
    mutate(
      `/api/admin/game-data/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
      `Deleted ${ids.length} attempts`,
    );

  const columns = useMemo<ColumnDef<GameAttempt>[]>(
    () => [
      {
        id: "target",
        header: "Target",
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex min-w-0 items-center gap-2">
              <PokemonBadge id={a.target_pokemon_id} shiny={a.is_shiny} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    #{a.target_pokemon_id.toString().padStart(4, "0")}
                  </span>
                  {a.is_shiny ? (
                    <Sparkles
                      className="size-3.5 text-amber-500"
                      aria-label="Shiny"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        },
        meta: { label: "Target", sortField: "target_pokemon_id" },
      },
      {
        id: "result",
        header: "Result",
        cell: ({ row }) =>
          row.original.won ? (
            <Badge variant="default">Win</Badge>
          ) : (
            <Badge variant="secondary">Loss</Badge>
          ),
        meta: { label: "Result" },
      },
      {
        id: "attempts",
        header: "Attempts",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.attempts}</span>
        ),
        meta: { label: "Attempts", sortField: "attempts", align: "right" },
      },
      {
        id: "hints_used",
        header: "Hints",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.hints_used}</span>
        ),
        meta: {
          label: "Hints",
          sortField: "hints_used",
          align: "right",
          defaultHidden: true,
        },
      },
      {
        id: "user",
        header: "Player",
        cell: ({ row }) => {
          const a = row.original;
          return (
            <AdminUserCell
              user={a.users ?? { id: a.user_id }}
              fallbackId={a.user_id}
            />
          );
        },
        meta: { label: "Player" },
      },
      {
        id: "date",
        header: "Puzzle date",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatAbsoluteDate(row.original.date)}
          </span>
        ),
        meta: { label: "Puzzle date", sortField: "date" },
      },
      {
        id: "created_at",
        header: "Played",
        cell: ({ row }) => (
          <RelativeTime
            value={row.original.created_at}
            className="text-xs text-muted-foreground"
          />
        ),
        meta: { label: "Played", sortField: "created_at" },
      },
    ],
    [],
  );

  const rowActions = (a: GameAttempt): RowAction[] => [
    {
      id: "view",
      label: "View attempt",
      icon: <Eye className="size-4" aria-hidden="true" />,
      onSelect: () => router.push(`/admin/game/${a.id}`),
    },
    {
      id: "open-user",
      label: "View player",
      icon: <UserIcon className="size-4" aria-hidden="true" />,
      onSelect: () => router.push(`/admin/users/${a.user_id}`),
    },
    {
      id: "copy-id",
      label: "Copy attempt ID",
      icon: <Copy className="size-4" aria-hidden="true" />,
      onSelect: () => copyText(a.id, "Attempt ID"),
      separatorBefore: true,
    },
    {
      id: "delete",
      label: "Delete attempt",
      icon: <Trash2 className="size-4" aria-hidden="true" />,
      onSelect: () => deleteOne(a.id),
      destructive: true,
      separatorBefore: true,
      confirm: {
        title: "Delete this attempt?",
        description:
          "This permanently removes the daily game attempt and its history. This cannot be undone.",
        confirmLabel: "Delete attempt",
      },
    },
  ];

  const bulkActions: BulkAction[] = [
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="size-4" aria-hidden="true" />,
      onRun: deleteBulk,
      destructive: true,
      confirm: {
        title: "Delete selected attempts?",
        description: (count) =>
          `This permanently deletes ${count.toLocaleString()} attempt${count === 1 ? "" : "s"}. This cannot be undone.`,
        confirmLabel: "Delete",
      },
    },
  ];

  const filtersSlot = (
    <Select
      value={table.state.filters.won ?? "all"}
      onValueChange={(v) => table.setFilter("won", v === "all" ? undefined : v)}
    >
      <SelectTrigger className="h-9 w-[120px]" aria-label="Filter by result">
        <SelectValue placeholder="Result" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All results</SelectItem>
        <SelectItem value="true">Wins only</SelectItem>
        <SelectItem value="false">Losses only</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <DataTable
      table={table}
      columns={columns}
      getRowId={(row) => row.id}
      resourceLabel="attempts"
      searchPlaceholder="Search by user ID…"
      filtersSlot={filtersSlot}
      rowActions={rowActions}
      bulkActions={bulkActions}
      onRowClick={(a) => router.push(`/admin/game/${a.id}`)}
      storageKey="admin-game-attempts"
      exportEndpoint="/api/admin/game-data"
      exportParams={{ view: "attempts" }}
      exportFilename="game-attempts"
    />
  );
}

// ---------------------------------------------------------------------------
// Tab container
// ---------------------------------------------------------------------------

export function AdminGameDataTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams?.get("view");
  // Calendar is the canonical landing view; "attempts" is the only other
  // explicit value we honor. Anything else (legacy `daily`, `by_user`,
  // missing param) collapses back to calendar.
  const view: ViewId = rawView === "attempts" ? "attempts" : "calendar";

  const handleViewChange = (nextView: ViewId) => {
    // Reset all other table params when switching view — their sort/filter
    // fields are not shared between views. Calendar is the default so we
    // strip the query entirely; only "attempts" carries an explicit param.
    const params = new URLSearchParams();
    if (nextView === "attempts") params.set("view", "attempts");
    router.replace(params.toString() ? `?${params.toString()}` : "?", {
      scroll: false,
    });
  };

  return (
    <div className="space-y-6">
      <GameStatsStrip />
      <Tabs
        value={view}
        onValueChange={(v) => handleViewChange(v as ViewId)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarDays className="mr-1.5 size-4" aria-hidden="true" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="attempts">
            <Gamepad2 className="mr-1.5 size-4" aria-hidden="true" />
            Attempts
          </TabsTrigger>
        </TabsList>
        {view === "calendar" ? (
          <GameCalendarView key="calendar" />
        ) : (
          <AttemptsView key="attempts" />
        )}
      </Tabs>
      <noscript>
        <Link href="/admin" className="text-sm underline">
          Enable JavaScript to use the admin console.
        </Link>
      </noscript>
    </div>
  );
}
