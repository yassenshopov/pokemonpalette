import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { AdminShell } from "@/components/admin/admin-shell";

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
    console.error("Auth error:", authError);
  }

  if (!userId) {
    redirect("/");
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("is_admin")
    .eq("id", userId)
    .eq("is_deleted", false)
    .single();

  if (error || !user || !user.is_admin) {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}
