import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET - Get users with emails for email sending (admin only)
export async function GET(req: NextRequest) {
  try {
    let userId: string | null = null;
    
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: currentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_admin")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    if (userError || !currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Get users with emails
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, email, first_name, last_name, username")
      .eq("is_deleted", false)
      .not("email", "is", null)
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    // Filter out invalid emails and format response
    const validUsers = (users || [])
      .filter((user) => user.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))
      .map((user) => ({
        id: user.id,
        email: user.email,
        name: user.first_name || user.last_name
          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
          : user.username || user.email?.split("@")[0] || "User",
      }));

    return NextResponse.json({ users: validUsers });
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/emails/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

