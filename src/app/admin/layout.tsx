import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { logger } from "@/lib/logger";

// Matches `SIDEBAR_COOKIE_NAME` in `src/components/ui/sidebar.tsx`. Reading
// it server-side lets the admin shell render with the user's last
// expanded/collapsed state on first paint, avoiding a hydration flash.
const SIDEBAR_COOKIE_NAME = "sidebar_state";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userId: string | null = null;

  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authError) {
    logger.error("admin.layout.auth_failed", {
      error: authError instanceof Error ? authError.message : String(authError),
    });
  }

  if (!userId) {
    redirect("/");
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    redirect("/");
  }

  // The cookie holds the stringified open boolean ("true" / "false"). Default
  // to open when the cookie is missing so first-time visits feel familiar.
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  const defaultOpen = sidebarCookie !== "false";

  return <AdminShell defaultOpen={defaultOpen}>{children}</AdminShell>;
}
