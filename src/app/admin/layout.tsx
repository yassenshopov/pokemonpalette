import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { logger } from "@/lib/logger";

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

  return <AdminShell>{children}</AdminShell>;
}
