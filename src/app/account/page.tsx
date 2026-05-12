import { Suspense } from "react";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { AccountSettings } from "@/components/account-settings";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "Account - PokémonPalette",
  description: "Manage your PokémonPalette account preferences, API keys, and accessibility settings.",
};

// API-customer rows only change on Stripe checkout success / refund, which
// fires off a separate webhook. Caching this lookup for 60 s eliminates
// the DB roundtrip on every /account and /api-access visit (typical
// pattern: user lands → flips tabs → DB read fires each time). The 60 s
// staleness window is acceptable since the worst case is a freshly-paid
// user not seeing the "Manage API keys" tab for a minute.
function isApiCustomerActive(userId: string) {
  return unstable_cache(
    async () => {
      const row = await prisma.apiCustomer.findUnique({
        where: { userId },
        select: { status: true },
      });
      return row?.status === "active";
    },
    ["api-customer-active", userId],
    { revalidate: 60, tags: [`api-customer:${userId}`] },
  )();
}

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

  const [user, apiCustomerActive] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      select: { isAdmin: true },
    }),
    isApiCustomerActive(userId),
  ]);

  const isAdmin = !!user?.isAdmin;
  const showApiKeys = apiCustomerActive || isAdmin;

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
