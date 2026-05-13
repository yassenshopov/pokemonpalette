"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, RefreshCw, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { RelativeTime } from "@/components/admin/relative-time";
import { cn } from "@/lib/utils";

/**
 * Row shape returned by `/api/admin/audit`. Field names mirror the
 * Postgres column names (snake_case) so a future "open audit row in
 * detail" hash link can use them directly.
 */
interface AuditRow {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  before_json: unknown;
  after_json: unknown;
  created_at: string;
}

interface AuditResponse {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

// Curated action list for the dropdown. The server accepts any string
// (so a new admin route can ship its own action name without a UI
// change), but every action emitted by the codebase as of writing is
// listed here.
const ACTION_OPTIONS = [
  { value: "", label: "Any action" },
  { value: "user.update", label: "User · Update" },
  { value: "user.ban", label: "User · Ban" },
  { value: "user.unban", label: "User · Unban" },
  { value: "user.lock", label: "User · Lock" },
  { value: "user.unlock", label: "User · Unlock" },
  { value: "user.promote", label: "User · Promote to admin" },
  { value: "user.demote", label: "User · Demote from admin" },
  { value: "user.delete", label: "User · Delete" },
  { value: "user.bulk_ban", label: "User · Bulk ban" },
  { value: "user.bulk_unban", label: "User · Bulk unban" },
  { value: "user.bulk_lock", label: "User · Bulk lock" },
  { value: "user.bulk_unlock", label: "User · Bulk unlock" },
  { value: "user.bulk_delete", label: "User · Bulk delete" },
  { value: "saved_palette.delete", label: "Saved palette · Delete" },
  { value: "saved_palette.bulk_delete", label: "Saved palette · Bulk delete" },
  { value: "game_data.delete", label: "Game data · Delete" },
  { value: "game_data.bulk_delete", label: "Game data · Bulk delete" },
  { value: "pokemon_colors.update", label: "Pokémon colors · Update" },
  { value: "daily_override.upsert", label: "Daily override · Upsert" },
  { value: "daily_override.delete", label: "Daily override · Delete" },
] as const;

const TARGET_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "user", label: "User" },
  { value: "saved_palette", label: "Saved palette" },
  { value: "daily_game_attempt", label: "Daily game attempt" },
  { value: "pokemon_colors", label: "Pokémon colors" },
  { value: "daily_override", label: "Daily override" },
] as const;

const DESTRUCTIVE_ACTIONS = new Set([
  "user.ban",
  "user.lock",
  "user.demote",
  "user.delete",
  "user.bulk_ban",
  "user.bulk_lock",
  "user.bulk_delete",
  "saved_palette.delete",
  "saved_palette.bulk_delete",
  "game_data.delete",
  "game_data.bulk_delete",
  "daily_override.delete",
]);

const PAGE_SIZE = 25;

interface FiltersState {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  from: string;
  to: string;
  page: number;
}

function readState(params: URLSearchParams): FiltersState {
  return {
    actor: params.get("actor") ?? "",
    action: params.get("action") ?? "",
    targetType: params.get("targetType") ?? "",
    targetId: params.get("targetId") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    page: Math.max(1, Number(params.get("page") ?? "1") || 1),
  };
}

function buildQs(state: FiltersState): string {
  const params = new URLSearchParams();
  if (state.actor) params.set("actor", state.actor);
  if (state.action) params.set("action", state.action);
  if (state.targetType) params.set("targetType", state.targetType);
  if (state.targetId) params.set("targetId", state.targetId);
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.page > 1) params.set("page", String(state.page));
  params.set("pageSize", String(PAGE_SIZE));
  return params.toString();
}

export function AdminAuditTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = React.useMemo(
    () => readState(searchParams ?? new URLSearchParams()),
    [searchParams],
  );

  // Local form state mirrors the URL state for the inputs that
  // shouldn't fire a request on every keystroke (actor id, target id).
  // The Select / date inputs commit immediately because they're
  // discrete.
  const [actorInput, setActorInput] = React.useState(state.actor);
  const [targetIdInput, setTargetIdInput] = React.useState(state.targetId);
  React.useEffect(() => setActorInput(state.actor), [state.actor]);
  React.useEffect(() => setTargetIdInput(state.targetId), [state.targetId]);

  const [data, setData] = React.useState<AuditResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const qs = buildQs(state);
    fetch(`/api/admin/audit?${qs}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          let message = `Failed to load (${res.status})`;
          try {
            const body = await res.json();
            if (typeof body?.error === "string") message = body.error;
          } catch {
            // ignore
          }
          throw new Error(message);
        }
        return (await res.json()) as AuditResponse;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Failed to load audit log.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [state, refreshToken]);

  const pushState = React.useCallback(
    (next: FiltersState) => {
      const qs = buildQs(next);
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router],
  );

  const setFilter = (patch: Partial<FiltersState>) => {
    pushState({ ...state, ...patch, page: 1 });
  };

  const clearAll = () => {
    setActorInput("");
    setTargetIdInput("");
    pushState({
      actor: "",
      action: "",
      targetType: "",
      targetId: "",
      from: "",
      to: "",
      page: 1,
    });
  };

  const commitActor = () => {
    if (actorInput.trim() !== state.actor) {
      setFilter({ actor: actorInput.trim() });
    }
  };
  const commitTargetId = () => {
    if (targetIdInput.trim() !== state.targetId) {
      setFilter({ targetId: targetIdInput.trim() });
    }
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE)))
    : 1;

  const hasAnyFilter =
    state.actor ||
    state.action ||
    state.targetType ||
    state.targetId ||
    state.from ||
    state.to;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Filters</CardTitle>
            <div className="flex items-center gap-2">
              {hasAnyFilter ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearAll}
                  className="h-8"
                >
                  <X className="mr-1.5 size-4" aria-hidden="true" />
                  Clear
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRefreshToken((n) => n + 1)}
                className="h-8"
                aria-label="Refresh"
              >
                <RefreshCw
                  className={cn(
                    "size-4",
                    loading && "animate-spin",
                  )}
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="audit-actor" className="text-xs">
              Actor (Clerk user id)
            </Label>
            <Input
              id="audit-actor"
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
              onBlur={commitActor}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitActor();
              }}
              placeholder="user_2…"
              className="h-9 font-mono text-xs"
              translate="no"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-action" className="text-xs">
              Action
            </Label>
            <Select
              value={state.action || "__any__"}
              onValueChange={(v) =>
                setFilter({ action: v === "__any__" ? "" : v })
              }
            >
              <SelectTrigger id="audit-action" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value || "__any__"}
                    value={opt.value || "__any__"}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-target-type" className="text-xs">
              Target type
            </Label>
            <Select
              value={state.targetType || "__any__"}
              onValueChange={(v) =>
                setFilter({ targetType: v === "__any__" ? "" : v })
              }
            >
              <SelectTrigger id="audit-target-type" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value || "__any__"}
                    value={opt.value || "__any__"}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-target-id" className="text-xs">
              Target id
            </Label>
            <Input
              id="audit-target-id"
              value={targetIdInput}
              onChange={(e) => setTargetIdInput(e.target.value)}
              onBlur={commitTargetId}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTargetId();
              }}
              placeholder="row id or bulk:N"
              className="h-9 font-mono text-xs"
              translate="no"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-from" className="text-xs">
              From
            </Label>
            <Input
              id="audit-from"
              type="date"
              value={state.from}
              onChange={(e) => setFilter({ from: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to" className="text-xs">
              To
            </Label>
            <Input
              id="audit-to"
              type="date"
              value={state.to}
              onChange={(e) => setFilter({ to: e.target.value })}
              className="h-9"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card role="alert">
          <CardContent className="py-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">
            {data ? `${data.total.toLocaleString()} actions` : "Actions"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))}
            </div>
          ) : data && data.rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No audit rows match these filters.
            </div>
          ) : (
            <ul className="divide-y" role="list">
              {data?.rows.map((row) => (
                <AuditRowItem key={row.id} row={row} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data && totalPages > 1 ? (
        <div className="flex justify-center">
          <AdminPagination
            page={state.page}
            totalPages={totalPages}
            onPageChange={(p) => pushState({ ...state, page: p })}
          />
        </div>
      ) : null}
    </div>
  );
}

function AuditRowItem({ row }: { row: AuditRow }) {
  const [open, setOpen] = React.useState(false);
  const isDestructive = DESTRUCTIVE_ACTIONS.has(row.action);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none"
        aria-expanded={open}
      >
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <Badge
            variant={isDestructive ? "destructive" : "secondary"}
            className="shrink-0 font-mono text-[10px]"
          >
            {row.action}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            <span className="font-mono" translate="no">
              {row.target_type}
            </span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono" translate="no">
              {row.target_id}
            </span>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="truncate font-mono" translate="no">
              {row.actor_user_id}
            </span>
            <RelativeTime value={row.created_at} />
          </span>
        </div>
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-3 border-t bg-muted/30 px-4 py-3 md:grid-cols-2">
          <JsonPanel title="Before" value={row.before_json} />
          <JsonPanel title="After" value={row.after_json} />
        </div>
      ) : null}
    </li>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  const text = React.useMemo(() => {
    if (value === null || value === undefined) return "—";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <pre
        className="max-h-80 overflow-auto rounded-md bg-background p-2 text-[11px] leading-snug"
        translate="no"
      >
        {text}
      </pre>
    </div>
  );
}
