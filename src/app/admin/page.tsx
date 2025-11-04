import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AdminDashboardWrapper } from "@/components/admin-dashboard-wrapper";

export default async function AdminPage() {
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

  // Check if user is admin using Supabase (server-side only)
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .eq("is_deleted", false)
    .single();

  if (error || !user || !user.is_admin) {
    redirect("/");
  }

  return <AdminDashboardWrapper primaryColor="#3b82f6" />;
}

