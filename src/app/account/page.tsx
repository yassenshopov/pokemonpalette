import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AccountSettings } from "@/components/account-settings";

export default async function AccountPage() {
  let userId: string | null = null;
  
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (authError) {
    console.error("Auth error:", authError);
  }

  if (!userId) {
    redirect("/");
  }

  return <AccountSettings />;
}

