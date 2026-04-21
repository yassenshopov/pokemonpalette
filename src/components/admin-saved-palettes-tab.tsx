"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Eye,
  Palette as PaletteIcon,
  Sparkles,
  Trash2,
  Trophy,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/admin/kpi-card";
import {
  DataTable,
  type ColumnDef,
} from "@/components/admin/data-table";
import { RelativeTime } from "@/components/admin/relative-time";
import type { RowAction } from "@/components/admin/row-actions";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { AdminUserCell } from "@/components/admin/user-cell";
import { useAdminTable } from "@/hooks/use-admin-table";

interface SavedPalette {
  id: string;
  user_id: string;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_form: string | null;
  is_shiny: boolean;
  colors: string[];
  image_url: string | null;
  palette_name: string | null;
  created_at: string;
  updated_at: string;
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

interface PaletteStats {
  totalPalettes: number;
  uniquePokemon: number;
  shinyCount: number;
  regularCount: number;
  topPokemon: Array<{ name: string; count: number; pokemon_id: number }>;
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn’t copy ${label}`);
  }
}

function PaletteSwatches({
  colors,
  className,
}: {
  colors: string[];
  className?: string;
}) {
  if (!colors || colors.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No colors</span>
    );
  }
  return (
    <div
      className={className}
      aria-label={`${colors.length} colors: ${colors.join(", ")}`}
      role="img"
    >
      <div className="flex items-center gap-0.5">
        {colors.slice(0, 6).map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="inline-block size-4 rounded-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        {colors.length > 6 ? (
          <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
            +{colors.length - 6}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PaletteStatsStrip() {
  const [stats, setStats] = useState<PaletteStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/saved-palettes/stats", { cache: "no-store" })
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total palettes"
          value={stats.totalPalettes.toLocaleString()}
          icon={<PaletteIcon className="size-4" aria-hidden="true" />}
        />
        <KpiCard
          label="Unique Pokémon"
          value={stats.uniquePokemon.toLocaleString()}
          icon={<Trophy className="size-4" aria-hidden="true" />}
        />
        <KpiCard
          label="Shiny palettes"
          value={stats.shinyCount.toLocaleString()}
          icon={<Sparkles className="size-4" aria-hidden="true" />}
        />
        <KpiCard
          label="Regular palettes"
          value={stats.regularCount.toLocaleString()}
          icon={<PaletteIcon className="size-4" aria-hidden="true" />}
        />
      </div>
      {stats.topPokemon.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Most saved Pokémon</CardTitle>
            <CardDescription>
              Top 5 species by saved palette count.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {stats.topPokemon.map((p) => (
                <li key={p.pokemon_id}>
                  <Badge variant="secondary" className="gap-1.5 px-2 py-1">
                    <span className="capitalize">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      × {p.count.toLocaleString()}
                    </span>
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function AdminSavedPalettesTab() {
  const router = useRouter();

  const table = useAdminTable<SavedPalette>({
    endpoint: "/api/admin/saved-palettes",
    filterKeys: [
      "is_shiny",
      "user_id",
      "pokemon_id",
      "has_image",
      "created_from",
      "created_to",
    ],
    sortableFields: ["created_at", "updated_at", "pokemon_name", "pokemon_id"],
    defaultSort: { field: "created_at", dir: "desc" },
    getRowId: (row) => row.id,
  });

  const mutate = async (
    path: string,
    init: RequestInit,
    successMessage: string,
  ) => {
    try {
      const res = await fetch(path, init);
      const data = res.headers
        .get("content-type")
        ?.includes("application/json")
        ? await res.json()
        : null;
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      toast.success(successMessage);
      table.refetch();
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong.");
    }
  };

  const deleteOne = (id: string) =>
    mutate(
      `/api/admin/saved-palettes/${id}`,
      { method: "DELETE" },
      "Palette deleted",
    );

  const deleteBulk = (ids: string[]) =>
    mutate(
      `/api/admin/saved-palettes/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
      `Deleted ${ids.length} palettes`,
    );

  const columns = useMemo<ColumnDef<SavedPalette>[]>(
    () => [
      {
        id: "palette",
        header: "Palette",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <PaletteIcon
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium capitalize">
                    {p.pokemon_name}
                  </span>
                  {p.is_shiny ? (
                    <Sparkles
                      className="size-3.5 text-amber-500"
                      aria-label="Shiny"
                    />
                  ) : null}
                </div>
                {p.palette_name ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {p.palette_name}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
        meta: { label: "Palette", sortField: "pokemon_name" },
      },
      {
        id: "swatches",
        header: "Colors",
        cell: ({ row }) => <PaletteSwatches colors={row.original.colors} />,
        meta: { label: "Colors" },
      },
      {
        id: "owner",
        header: "Owner",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <AdminUserCell
              user={p.users ?? { id: p.user_id }}
              fallbackId={p.user_id}
            />
          );
        },
        meta: { label: "Owner" },
      },
      {
        id: "pokemon_id",
        header: "Dex ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            #{row.original.pokemon_id.toString().padStart(4, "0")}
          </span>
        ),
        meta: {
          label: "Dex ID",
          sortField: "pokemon_id",
          align: "right",
          defaultHidden: true,
        },
      },
      {
        id: "created_at",
        header: "Created",
        cell: ({ row }) => (
          <RelativeTime
            value={row.original.created_at}
            className="text-xs text-muted-foreground"
          />
        ),
        meta: { label: "Created", sortField: "created_at" },
      },
    ],
    [],
  );

  const rowActions = (p: SavedPalette): RowAction[] => [
    {
      id: "view",
      label: "View details",
      icon: <Eye className="size-4" aria-hidden="true" />,
      onSelect: () => router.push(`/admin/palettes/${p.id}`),
    },
    {
      id: "open-owner",
      label: "View owner",
      icon: <UserIcon className="size-4" aria-hidden="true" />,
      onSelect: () => router.push(`/admin/users/${p.user_id}`),
    },
    {
      id: "open-public",
      label: "Open public page",
      icon: <ExternalLink className="size-4" aria-hidden="true" />,
      onSelect: () => {
        window.open(`/${p.pokemon_name.toLowerCase()}`, "_blank", "noopener");
      },
    },
    {
      id: "copy-colors",
      label: "Copy colors",
      icon: <Copy className="size-4" aria-hidden="true" />,
      onSelect: () => copyText(p.colors.join(", "), "Colors"),
      separatorBefore: true,
    },
    {
      id: "copy-json",
      label: "Copy JSON",
      icon: <Copy className="size-4" aria-hidden="true" />,
      onSelect: () => copyText(JSON.stringify(p, null, 2), "JSON"),
    },
    {
      id: "delete",
      label: "Delete palette",
      icon: <Trash2 className="size-4" aria-hidden="true" />,
      onSelect: () => deleteOne(p.id),
      destructive: true,
      separatorBefore: true,
    },
  ];

  const bulkActions: BulkAction[] = [
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="size-4" aria-hidden="true" />,
      onRun: (ids) => deleteBulk(ids),
      destructive: true,
      confirm: {
        title: "Delete selected palettes?",
        description: (count) =>
          `This permanently deletes ${count.toLocaleString()} palette${count === 1 ? "" : "s"}. This cannot be undone.`,
        confirmLabel: "Delete",
      },
    },
  ];

  const filtersSlot = (
    <>
      <Select
        value={table.state.filters.is_shiny ?? "all"}
        onValueChange={(v) =>
          table.setFilter("is_shiny", v === "all" ? undefined : v)
        }
      >
        <SelectTrigger className="h-9 w-[120px]" aria-label="Filter by variant">
          <SelectValue placeholder="Variant" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All variants</SelectItem>
          <SelectItem value="true">Shiny</SelectItem>
          <SelectItem value="false">Regular</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={table.state.filters.has_image ?? "all"}
        onValueChange={(v) =>
          table.setFilter("has_image", v === "all" ? undefined : v)
        }
      >
        <SelectTrigger className="h-9 w-[130px]" aria-label="Filter by image">
          <SelectValue placeholder="Image" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any image</SelectItem>
          <SelectItem value="true">Has image</SelectItem>
          <SelectItem value="false">No image</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-6">
      <PaletteStatsStrip />
      <DataTable
        table={table}
        columns={columns}
        getRowId={(row) => row.id}
        resourceLabel="palettes"
        searchPlaceholder="Search Pokémon or palette name…"
        filtersSlot={filtersSlot}
        rowActions={rowActions}
        bulkActions={bulkActions}
        onRowClick={(p) => router.push(`/admin/palettes/${p.id}`)}
        storageKey="admin-palettes"
        exportEndpoint="/api/admin/saved-palettes"
        exportFilename="saved-palettes"
      />
    </div>
  );
}
