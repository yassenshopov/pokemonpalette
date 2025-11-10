import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { EmailService, EmailTemplate, EmailTemplateData } from "@/lib/email-service";

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { template, data } = body as {
      template: EmailTemplate;
      data: EmailTemplateData[EmailTemplate];
    };

    if (!template) {
      return NextResponse.json({ error: "Template is required" }, { status: 400 });
    }

    // Get base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.pokemonpalette.com";
    
    // Ensure gameUrl is set for daily-nudge template
    if (template === "daily-nudge") {
      const nudgeData = data as EmailTemplateData["daily-nudge"];
      nudgeData.gameUrl = `${baseUrl}/game`;
    }

    const preview = EmailService.previewTemplate(template, data);

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("Error previewing email:", error);
    return NextResponse.json(
      { error: "Failed to preview email" },
      { status: 500 }
    );
  }
}

