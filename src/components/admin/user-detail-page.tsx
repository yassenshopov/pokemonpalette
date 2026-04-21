"use client";

import { UserDetailLoader } from "@/components/admin/user-detail";

/**
 * Full-page user detail view rendered at /admin/users/[id].
 *
 * Uses the shared `UserDetailLoader` to fetch data and render the header,
 * KPI strip, overview card, and recent-activity list. The embedded games /
 * palettes tables are reached via the toolbar buttons on the detail page
 * which link to /admin/game?user_id=... and /admin/palettes?user_id=...
 * (already prefiltered by `user_id`, honoring the server-side list APIs).
 */
export function UserDetailPage({ userId }: { userId: string }) {
  return <UserDetailLoader userId={userId} variant="page" />;
}
