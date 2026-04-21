import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface AdminUserLike {
  id?: string;
  email?: string | null;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  profile_image_url?: string | null;
}

export function getAdminUserDisplayName(
  user: AdminUserLike | null | undefined,
  fallback = "Unknown",
): string {
  if (!user) return fallback;
  const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  if (name) return name;
  if (user.username) return user.username;
  if (user.email) return user.email.split("@")[0];
  return user.id ?? fallback;
}

export function getAdminUserInitials(
  user: AdminUserLike | null | undefined,
): string {
  if (!user) return "?";
  if (user.first_name || user.last_name) {
    return (
      `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
      "U"
    );
  }
  if (user.username) return user.username.slice(0, 2).toUpperCase();
  if (user.email) return user.email.slice(0, 2).toUpperCase();
  return "U";
}

export function getAdminUserAvatarSrc(
  user: AdminUserLike | null | undefined,
): string | undefined {
  if (!user) return undefined;
  return user.image_url ?? user.profile_image_url ?? undefined;
}

const AVATAR_SIZES = {
  xs: "size-6",
  sm: "size-8",
  md: "size-9",
  lg: "size-10",
  xl: "size-16",
} as const;

type AvatarSize = keyof typeof AVATAR_SIZES;

const FALLBACK_TEXT_SIZE: Record<AvatarSize, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-lg",
};

export function AdminUserAvatar({
  user,
  size = "md",
  className,
}: {
  user: AdminUserLike | null | undefined;
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <Avatar className={cn(AVATAR_SIZES[size], "shrink-0", className)}>
      <AvatarImage src={getAdminUserAvatarSrc(user)} alt="" />
      <AvatarFallback className={FALLBACK_TEXT_SIZE[size]}>
        {getAdminUserInitials(user)}
      </AvatarFallback>
    </Avatar>
  );
}

export function AdminUserCell({
  user,
  fallbackId,
  secondary = "email",
  size = "md",
  className,
}: {
  user: AdminUserLike | null | undefined;
  fallbackId?: string | null;
  secondary?: "email" | "none";
  size?: AvatarSize;
  className?: string;
}) {
  const name = getAdminUserDisplayName(
    user,
    fallbackId ?? "Unknown",
  );
  const email = secondary === "email" ? (user?.email ?? null) : null;

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <AdminUserAvatar user={user} size={size} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        {email ? (
          <span className="truncate text-xs text-muted-foreground">
            {email}
          </span>
        ) : null}
      </div>
    </div>
  );
}
