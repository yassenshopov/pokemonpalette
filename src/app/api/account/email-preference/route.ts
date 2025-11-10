import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET - Get user's email preference
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

    // Get user's email preference
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("receives_daily_emails")
      .eq("id", userId)
      .eq("is_deleted", false)
      .single();

    if (userError) {
      console.error("Error fetching user:", userError);
      return NextResponse.json(
        { error: "Failed to fetch email preference" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      receivesDailyEmails: user.receives_daily_emails ?? true,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/account/email-preference:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT - Update user's email preference
export async function PUT(req: NextRequest) {
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

    const body = await req.json();
    const { receivesDailyEmails } = body as {
      receivesDailyEmails: boolean;
    };

    if (typeof receivesDailyEmails !== "boolean") {
      return NextResponse.json(
        { error: "receivesDailyEmails must be a boolean" },
        { status: 400 }
      );
    }

    // Update user's email preference
    const { data: user, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ receives_daily_emails: receivesDailyEmails })
      .eq("id", userId)
      .eq("is_deleted", false)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update email preference" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      receivesDailyEmails: user.receives_daily_emails,
    });
  } catch (error) {
    console.error("Unexpected error in PUT /api/account/email-preference:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

