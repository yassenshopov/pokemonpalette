import { Suspense } from "react";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { AccountSettings } from "@/components/account-settings";
import { BadgesSection } from "@/components/badges-section";
import { PublicProfileCard } from "@/components/public-profile-card";
import { SupportersDisplay } from "@/components/supporters-display";
import { fetchSupporters } from "@/lib/buymeacoffee";
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

  const [user, apiCustomerActive, supporters] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, isDeleted: false },
      select: { isAdmin: true, username: true },
    }),
    isApiCustomerActive(userId),
    fetchSupporters(),
  ]);

  const isAdmin = !!user?.isAdmin;
  const showApiKeys = apiCustomerActive || isAdmin;
  const username = user?.username ?? null;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AccountSettings showApiKeys={showApiKeys} isAdmin={isAdmin} />
      {/* Public profile pointer — surfaces /u/[username] so the user can
          share their Pokédex. If they haven't claimed a Clerk username
          yet, the card explains how to do so. */}
      <PublicProfileCard username={username} />
      {/* Badge wall — server-rendered, derived from existing PokedexEntry /
          DailyGameAttempt rows + the user_game_stats RPC. No new schema. */}
      <BadgesSection userId={userId} />
      <SupportersDisplay
        // Amber + orange are the Buy Me a Coffee brand colors — using them
        // here ties this section visually to the existing CoffeeAsk and the
        // floating coffee CTA so the whole monetization surface reads as
        // one consistent thing.
        primaryColor="#f59e0b"
        secondaryColor="#fb923c"
        supporters={supporters}
        heading="Project supporters"
      />
    </Suspense>
  );
}
