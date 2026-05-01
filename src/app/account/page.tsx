import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { AccountSettings } from "@/components/account-settings";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Account - PokémonPalette",
  description: "Manage your PokémonPalette account preferences, API keys, and accessibility settings.",
};

export default async function AccountPage() {
  let userId: string | null = null;

  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    // auth unavailable
  }

  if (!userId) {
    redirect("/");
  }

  const [user, apiCustomer] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      select: { isAdmin: true },
    }),
    prisma.apiCustomer.findUnique({
      where: { userId, status: "active" },
      select: { userId: true },
    }),
  ]);

  const isAdmin = !!user?.isAdmin;
  const showApiKeys = !!apiCustomer || isAdmin;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AccountSettings showApiKeys={showApiKeys} isAdmin={isAdmin} />
    </Suspense>
  );
}
