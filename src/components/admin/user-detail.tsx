"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Gamepad2,
  Lock,
  LockOpen,
  Palette,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Trophy,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KpiCard } from "@/components/admin/kpi-card";
import { RelativeTime } from "@/components/admin/relative-time";
import { formatAbsolute, formatAbsoluteDate } from "@/lib/admin/format";

export interface AdminUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
  profile_image_url: string | null;
  banned: boolean;
  locked: boolean;
  two_factor_enabled: boolean;
  totp_enabled: boolean;
  is_admin: boolean;
  last_active_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface UserDetailData {
  user: AdminUser;
  stats: {
    totalGames: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    totalPalettes: number;
  };
  recentAttempts: Array<{
    id: string;
    date: string;
    won: boolean;
    attempts: number;
    hints_used: number;
    created_at: string;
  }>;
}

function getUserDisplayName(user: AdminUser) {
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (name) return name;
  return user.username || user.email?.split("@")[0] || "User";
}

function getUserInitials(user: AdminUser) {
  if (user.first_name || user.last_name) {
    return (
      `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`
        .toUpperCase() || "U"
    );
  }
  if (user.username) return user.username.slice(0, 2).toUpperCase();
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return "U";
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn’t copy ${label}`);
  }
}

export function UserDetailHeader({
  user,
  onPatch,
  onDelete,
  variant = "page",
}: {
  user: AdminUser;
  onPatch: (body: Record<string, unknown>, msg: string) => Promise<void>;
  onDelete: () => Promise<void>;
  variant?: "page" | "sheet";
}) {
  const name = getUserDisplayName(user);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className="size-16">
          <AvatarImage
            src={user.image_url ?? user.profile_image_url ?? undefined}
            alt=""
          />
          <AvatarFallback className="text-lg">
            {getUserInitials(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold">{name}</h2>
            {user.banned ? (
              <Badge variant="destructive">Banned</Badge>
            ) : user.locked ? (
              <Badge variant="destructive">Locked</Badge>
            ) : (
              <Badge variant="secondary">Active</Badge>
            )}
            {user.is_admin ? <Badge variant="default">Admin</Badge> : null}
            {user.two_factor_enabled || user.totp_enabled ? (
              <Badge variant="outline">2FA</Badge>
            ) : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {user.email ?? "No email"}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground" translate="no">
            {user.id}
          </p>
        </div>
        {variant === "sheet" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/users/${user.id}`}>
              <ExternalLink className="mr-1.5 size-4" aria-hidden="true" />
              Full page
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => copy(user.id, "ID")}
        >
          <Copy className="mr-1.5 size-4" aria-hidden="true" />
          Copy ID
        </Button>
        {user.email ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy(user.email as string, "Email")}
          >
            <Copy className="mr-1.5 size-4" aria-hidden="true" />
            Copy email
          </Button>
        ) : null}
        {user.banned ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPatch({ banned: false }, "User unbanned")}
          >
            <UserCheck className="mr-1.5 size-4" aria-hidden="true" />
            Unban
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPatch({ banned: true }, "User banned")}
          >
            <UserX className="mr-1.5 size-4" aria-hidden="true" />
            Ban
          </Button>
        )}
        {user.locked ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPatch({ locked: false }, "User unlocked")}
          >
            <LockOpen className="mr-1.5 size-4" aria-hidden="true" />
            Unlock
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPatch({ locked: true }, "User locked")}
          >
            <Lock className="mr-1.5 size-4" aria-hidden="true" />
            Lock
          </Button>
        )}
        {user.is_admin ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPatch({ is_admin: false }, "Admin removed")}
          >
            <ShieldOff className="mr-1.5 size-4" aria-hidden="true" />
            Remove admin
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPatch({ is_admin: true }, "Promoted to admin")}
          >
            <ShieldCheck className="mr-1.5 size-4" aria-hidden="true" />
            Make admin
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              <Trash2 className="mr-1.5 size-4" aria-hidden="true" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
              <AlertDialogDescription>
                This soft-deletes the account. Their data is retained but
                they’ll no longer appear in the app.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void onDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete user
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function KpiStrip({ stats }: { stats: UserDetailData["stats"] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="Games played"
        value={stats.totalGames.toLocaleString()}
        icon={<Gamepad2 className="size-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Wins"
        value={stats.totalWins.toLocaleString()}
        icon={<Trophy className="size-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Win rate"
        value={`${stats.winRate.toFixed(1)}%`}
        icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
      />
      <KpiCard
        label="Palettes"
        value={stats.totalPalettes.toLocaleString()}
        icon={<Palette className="size-4" aria-hidden="true" />}
      />
    </div>
  );
}

function RecentActivityCard({
  attempts,
}: {
  attempts: UserDetailData["recentAttempts"];
}) {
  if (!attempts || attempts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No games played yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent activity</CardTitle>
        <CardDescription>Latest 30 game attempts.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y" role="list">
          {attempts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                {a.won ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-green-600"
                    aria-label="Won"
                  />
                ) : (
                  <XCircle
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-label="Lost"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm">
                    {formatAbsoluteDate(a.date)} ·{" "}
                    <span className="text-muted-foreground">
                      {a.attempts} attempts
                      {a.hints_used > 0 ? ` · ${a.hints_used} hints` : ""}
                    </span>
                  </p>
                </div>
              </div>
              <Link
                href={`/admin/game/${a.id}`}
                className="shrink-0 text-xs text-muted-foreground hover:text-foreground focus-visible:underline"
              >
                <RelativeTime value={a.created_at} />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function OverviewCard({ user }: { user: AdminUser }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "User ID", value: <span className="font-mono" translate="no">{user.id}</span> },
    { label: "Username", value: user.username ?? "—" },
    {
      label: "Name",
      value:
        user.first_name || user.last_name
          ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
          : "—",
    },
    { label: "Created", value: formatAbsolute(user.created_at) },
    { label: "Last active", value: formatAbsolute(user.last_active_at) },
    { label: "Last sign in", value: formatAbsolute(user.last_sign_in_at) },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="truncate text-sm">{r.value}</dd>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Shared detail body. `children` slot is for the "embedded tables" that the
 * full page uses (games/palettes tables with user_id prefilter). The sheet
 * variant omits it and shows recent activity only.
 */
export interface UserDetailBodyProps {
  data: UserDetailData;
  onPatch: (body: Record<string, unknown>, msg: string) => Promise<void>;
  onDelete: () => Promise<void>;
  variant?: "page" | "sheet";
  children?: React.ReactNode;
}

export function UserDetailBody({
  data,
  onPatch,
  onDelete,
  variant = "page",
  children,
}: UserDetailBodyProps) {
  return (
    <div className="space-y-6">
      <UserDetailHeader
        user={data.user}
        onPatch={onPatch}
        onDelete={onDelete}
        variant={variant}
      />
      <KpiStrip stats={data.stats} />
      <OverviewCard user={data.user} />
      {children}
      <RecentActivityCard attempts={data.recentAttempts} />
    </div>
  );
}

/**
 * Fetches and renders a user detail view. The consumer controls layout
 * (sheet vs. full page) via `variant`.
 */
export function UserDetailLoader({
  userId,
  variant = "page",
  onUserDeleted,
  children,
}: {
  userId: string | null;
  variant?: "page" | "sheet";
  onUserDeleted?: () => void;
  children?: (ctx: { data: UserDetailData }) => React.ReactNode;
}) {
  const router = useRouter();
  const [data, setData] = React.useState<UserDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refresh, setRefresh] = React.useState(0);

  React.useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/admin/users/${userId}`, {
      signal: ctrl.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        return (await res.json()) as UserDetailData;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Failed to load user.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [userId, refresh]);

  const onPatch = React.useCallback(
    async (body: Record<string, unknown>, msg: string) => {
      if (!userId) return;
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
        toast.success(msg);
        setRefresh((n) => n + 1);
      } catch (err) {
        toast.error((err as Error).message || "Something went wrong.");
      }
    },
    [userId],
  );

  const onDelete = React.useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `Failed (${res.status})`);
      toast.success("User deleted");
      onUserDeleted?.();
      if (variant === "page") router.push("/admin/users");
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong.");
    }
  }, [userId, router, variant, onUserDeleted]);

  if (!userId) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card role="alert">
        <CardContent className="py-4 text-sm text-destructive">
          {error ?? "User not found."}
        </CardContent>
      </Card>
    );
  }

  return (
    <UserDetailBody
      data={data}
      onPatch={onPatch}
      onDelete={onDelete}
      variant={variant}
    >
      {children?.({ data })}
    </UserDetailBody>
  );
}
