"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Eye,
  Gamepad2,
  Lock,
  LockOpen,
  Palette,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  type ColumnDef,
} from "@/components/admin/data-table";
import { RelativeTime } from "@/components/admin/relative-time";
import type { RowAction } from "@/components/admin/row-actions";
import type { BulkAction } from "@/components/admin/bulk-action-bar";
import { UserSheet } from "@/components/user-sheet";
import { useAdminTable } from "@/hooks/use-admin-table";

interface User {
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

function getUserDisplayName(user: User) {
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (name) return name;
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0];
  return "User";
}

function getUserInitials(user: User) {
  if (user.first_name || user.last_name) {
    return `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`
      .toUpperCase() || "U";
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

export function AdminUsersTab() {
  const router = useRouter();

  const table = useAdminTable<User>({
    endpoint: "/api/admin/users",
    filterKeys: [
      "status",
      "two_factor",
      "is_admin",
      "created_from",
      "created_to",
    ],
    sortableFields: [
      "created_at",
      "last_active_at",
      "last_sign_in_at",
      "email",
      "username",
    ],
    defaultSort: { field: "created_at", dir: "desc" },
    getRowId: (row) => row.id,
  });

  const [sheetUser, setSheetUser] = useState<User | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = (user: User) => {
    setSheetUser(user);
    setSheetOpen(true);
  };

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

  const patchUser = (id: string, body: Record<string, unknown>, msg: string) =>
    mutate(
      `/api/admin/users/${id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      msg,
    );

  const deleteUser = (id: string) =>
    mutate(`/api/admin/users/${id}`, { method: "DELETE" }, "User deleted");

  const bulkUsers = (ids: string[], op: string, msg: string) =>
    mutate(
      `/api/admin/users/bulk`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, op }),
      },
      msg,
    );

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "user",
        header: "User",
        accessorFn: (row) => getUserDisplayName(row),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage
                  src={user.image_url ?? user.profile_image_url ?? undefined}
                  alt=""
                />
                <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {getUserDisplayName(user)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email ?? "No email"}
                </span>
              </div>
            </div>
          );
        },
        meta: { label: "User" },
      },
      {
        id: "username",
        header: "Username",
        accessorFn: (row) => row.username ?? "",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.username ?? "—"}</span>
        ),
        meta: { label: "Username", sortField: "username" },
      },
      {
        id: "id",
        header: "ID",
        accessorFn: (row) => row.id,
        cell: ({ row }) => (
          <span
            className="block max-w-[140px] truncate font-mono text-xs text-muted-foreground"
            translate="no"
            title={row.original.id}
          >
            {row.original.id}
          </span>
        ),
        meta: { label: "ID", defaultHidden: true },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex flex-wrap gap-1">
              {u.banned ? (
                <Badge variant="destructive">Banned</Badge>
              ) : u.locked ? (
                <Badge variant="destructive">Locked</Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
              {u.is_admin ? <Badge variant="default">Admin</Badge> : null}
            </div>
          );
        },
        meta: { label: "Status" },
      },
      {
        id: "two_factor",
        header: "2FA",
        cell: ({ row }) => {
          const on =
            row.original.two_factor_enabled || row.original.totp_enabled;
          return (
            <Badge variant={on ? "default" : "outline"}>
              {on ? "On" : "Off"}
            </Badge>
          );
        },
        meta: { label: "2FA" },
      },
      {
        id: "last_active_at",
        header: "Last Active",
        cell: ({ row }) => (
          <RelativeTime
            value={row.original.last_active_at}
            className="text-xs text-muted-foreground"
          />
        ),
        meta: { label: "Last Active", sortField: "last_active_at" },
      },
      {
        id: "last_sign_in_at",
        header: "Last Sign In",
        cell: ({ row }) => (
          <RelativeTime
            value={row.original.last_sign_in_at}
            className="text-xs text-muted-foreground"
          />
        ),
        meta: {
          label: "Last Sign In",
          sortField: "last_sign_in_at",
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

  const rowActions = (user: User): RowAction[] => [
    {
      id: "view",
      label: "View details",
      icon: <Eye className="size-4" aria-hidden="true" />,
      onSelect: () => openSheet(user),
    },
    {
      id: "open-full",
      label: "Open full page",
      icon: <ExternalLink className="size-4" aria-hidden="true" />,
      onSelect: () => router.push(`/admin/users/${user.id}`),
    },
    {
      id: "copy-id",
      label: "Copy ID",
      icon: <Copy className="size-4" aria-hidden="true" />,
      onSelect: () => copy(user.id, "ID"),
    },
    ...(user.email
      ? [
          {
            id: "copy-email",
            label: "Copy email",
            icon: <Copy className="size-4" aria-hidden="true" />,
            onSelect: () => copy(user.email as string, "Email"),
          },
        ]
      : []),
    {
      id: "open-games",
      label: "View games",
      icon: <Gamepad2 className="size-4" aria-hidden="true" />,
      onSelect: () => router.push(`/admin/game?user_id=${user.id}`),
      separatorBefore: true,
    },
    {
      id: "open-palettes",
      label: "View palettes",
      icon: <Palette className="size-4" aria-hidden="true" />,
      onSelect: () => router.push(`/admin/palettes?user_id=${user.id}`),
    },
    user.banned
      ? {
          id: "unban",
          label: "Unban user",
          icon: <UserCheck className="size-4" aria-hidden="true" />,
          onSelect: () =>
            patchUser(user.id, { banned: false }, "User unbanned"),
          separatorBefore: true,
        }
      : {
          id: "ban",
          label: "Ban user",
          icon: <UserX className="size-4" aria-hidden="true" />,
          onSelect: () => patchUser(user.id, { banned: true }, "User banned"),
          separatorBefore: true,
          destructive: true,
          confirm: {
            title: "Ban this user?",
            description:
              "They’ll lose access to their account immediately. You can unban them later.",
            confirmLabel: "Ban user",
          },
        },
    user.locked
      ? {
          id: "unlock",
          label: "Unlock user",
          icon: <LockOpen className="size-4" aria-hidden="true" />,
          onSelect: () =>
            patchUser(user.id, { locked: false }, "User unlocked"),
        }
      : {
          id: "lock",
          label: "Lock user",
          icon: <Lock className="size-4" aria-hidden="true" />,
          onSelect: () => patchUser(user.id, { locked: true }, "User locked"),
          destructive: true,
          confirm: {
            title: "Lock this user?",
            description:
              "They’ll be unable to sign in until you unlock the account.",
            confirmLabel: "Lock user",
          },
        },
    user.is_admin
      ? {
          id: "demote",
          label: "Remove admin",
          icon: <ShieldOff className="size-4" aria-hidden="true" />,
          onSelect: () =>
            patchUser(user.id, { is_admin: false }, "Admin removed"),
          destructive: true,
          confirm: {
            title: "Remove admin rights?",
            description:
              "This user will lose access to /admin on their next sign-in.",
            confirmLabel: "Remove admin",
          },
        }
      : {
          id: "promote",
          label: "Make admin",
          icon: <ShieldCheck className="size-4" aria-hidden="true" />,
          onSelect: () =>
            patchUser(user.id, { is_admin: true }, "Promoted to admin"),
          destructive: true,
          confirm: {
            title: "Make this user an admin?",
            description:
              "Admins can view PII, ban accounts, and modify game data. Only grant this to people you trust.",
            confirmLabel: "Make admin",
          },
        },
    {
      id: "delete",
      label: "Delete user",
      icon: <Trash2 className="size-4" aria-hidden="true" />,
      onSelect: () => deleteUser(user.id),
      destructive: true,
      separatorBefore: true,
      confirm: {
        title: "Delete this user?",
        description:
          "This soft-deletes the account. Their data is retained but they’ll no longer appear in the app.",
        confirmLabel: "Delete user",
      },
    },
  ];

  const bulkActions: BulkAction[] = [
    {
      id: "ban",
      label: "Ban",
      icon: <UserX className="size-4" aria-hidden="true" />,
      onRun: (ids) => bulkUsers(ids, "ban", `Banned ${ids.length} users`),
      confirm: {
        title: "Ban selected users?",
        description: (count) =>
          `This will ban ${count.toLocaleString()} user${count === 1 ? "" : "s"}. You can unban them later.`,
        confirmLabel: "Ban",
      },
      destructive: true,
    },
    {
      id: "unban",
      label: "Unban",
      icon: <UserCheck className="size-4" aria-hidden="true" />,
      onRun: (ids) => bulkUsers(ids, "unban", `Unbanned ${ids.length} users`),
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="size-4" aria-hidden="true" />,
      onRun: (ids) => bulkUsers(ids, "delete", `Deleted ${ids.length} users`),
      confirm: {
        title: "Delete selected users?",
        description: (count) =>
          `This will soft-delete ${count.toLocaleString()} user${count === 1 ? "" : "s"}. Their data is retained but they’ll be hidden from the app.`,
        confirmLabel: "Delete",
      },
      destructive: true,
    },
  ];

  const filtersSlot = (
    <>
      <Select
        value={table.state.filters.status ?? "all"}
        onValueChange={(v) =>
          table.setFilter("status", v === "all" ? undefined : v)
        }
      >
        <SelectTrigger className="h-9 w-[130px]" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="banned">Banned</SelectItem>
          <SelectItem value="locked">Locked</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={table.state.filters.two_factor ?? "all"}
        onValueChange={(v) =>
          table.setFilter("two_factor", v === "all" ? undefined : v)
        }
      >
        <SelectTrigger className="h-9 w-[110px]" aria-label="Filter by 2FA">
          <SelectValue placeholder="2FA" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any 2FA</SelectItem>
          <SelectItem value="true">2FA on</SelectItem>
          <SelectItem value="false">2FA off</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={table.state.filters.is_admin ?? "all"}
        onValueChange={(v) =>
          table.setFilter("is_admin", v === "all" ? undefined : v)
        }
      >
        <SelectTrigger className="h-9 w-[110px]" aria-label="Filter by role">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any role</SelectItem>
          <SelectItem value="true">Admins</SelectItem>
          <SelectItem value="false">Users</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <>
      <DataTable
        table={table}
        columns={columns}
        getRowId={(row) => row.id}
        resourceLabel="users"
        searchPlaceholder="Search name, email, username, ID…"
        filtersSlot={filtersSlot}
        rowActions={rowActions}
        bulkActions={bulkActions}
        onRowClick={openSheet}
        storageKey="admin-users"
        exportEndpoint="/api/admin/users"
        exportFilename="users"
      />
      <UserSheet user={sheetUser} open={sheetOpen} onOpenChange={setSheetOpen} />
      <noscript>
        <Link href="/admin" className="text-sm underline">
          Enable JavaScript to use the admin console.
        </Link>
      </noscript>
    </>
  );
}
