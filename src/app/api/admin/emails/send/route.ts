import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { EmailService, EmailTemplate, EmailTemplateData } from "@/lib/email-service";

const TEMPLATE_SUBJECTS: Record<EmailTemplate, string> = {
  "daily-nudge": "🎮 Don't forget today's Pokémon Palette challenge!",
};

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
    const { template, data, to, userIds } = body as {
      template: EmailTemplate;
      data: EmailTemplateData[EmailTemplate];
      to?: string | string[];
      userIds?: string[];
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

    let recipients: string[] = [];
    let users: Array<{ 
      id: string;
      email: string; 
      first_name: string | null; 
      last_name: string | null;
      receives_daily_emails?: boolean;
    }> = [];

    // If userIds are provided, fetch their emails
    if (userIds && userIds.length > 0) {
      // For daily-nudge template, filter by receives_daily_emails preference
      let query = supabaseAdmin
        .from("users")
        .select("id, email, first_name, last_name, receives_daily_emails")
        .in("id", userIds)
        .eq("is_deleted", false)
        .not("email", "is", null);

      // Filter by email preference for daily-nudge template
      if (template === "daily-nudge") {
        query = query.eq("receives_daily_emails", true);
      }

      const { data: fetchedUsers, error: usersError } = await query;

      if (usersError) {
        return NextResponse.json(
          { error: "Failed to fetch user emails" },
          { status: 500 }
        );
      }

      users = (fetchedUsers || []) as Array<{ 
        id: string;
        email: string; 
        first_name: string | null; 
        last_name: string | null;
        receives_daily_emails?: boolean;
      }>;
      recipients = users
        .map((user) => user.email)
        .filter((email): email is string => email !== null && EmailService.isValidEmail(email));
    }
    
    // Add custom email addresses if provided
    if (to) {
      const customEmails = Array.isArray(to) ? to : [to];
      const validCustomEmails = customEmails.filter((email) => EmailService.isValidEmail(email));
      recipients = [...recipients, ...validCustomEmails];
    }

    // Deduplicate recipients (case-insensitive)
    const uniqueRecipients = Array.from(
      new Map(
        recipients.map((email) => [email.toLowerCase(), email])
      ).values()
    );

    if (uniqueRecipients.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found" },
        { status: 400 }
      );
    }

    // Use deduplicated list
    recipients = uniqueRecipients;

    // Send emails with rate limiting (Resend allows 2 requests per second)
    // Process in batches of 2 with 500ms delay between batches
    const batchSize = 2;
    const delayBetweenBatches = 500; // 500ms = 0.5 seconds, so 2 requests per second
    const results: Array<{ 
      success: boolean; 
      messageId?: string; 
      error?: string;
      html?: string;
      text?: string;
      subject?: string;
      fromEmail?: string;
      fromName?: string;
    }> = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (email) => {
          // For daily-nudge, personalize with user name if available
          let personalizedData = { ...data };
          if (template === "daily-nudge") {
            const user = users.find((u) => u.email === email);
            if (user) {
              personalizedData = {
                ...personalizedData,
                userName: user.first_name || user.last_name 
                  ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                  : undefined,
              } as EmailTemplateData[EmailTemplate];
            }
          }

          return EmailService.sendEmail({
            to: email,
            template,
            data: personalizedData,
          });
        })
      );

      results.push(...batchResults);

      // Add delay between batches (except for the last batch)
      if (i + batchSize < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Log all emails to database
    const emailLogs = await Promise.all(
      results.map(async (result, index) => {
        const email = recipients[index];
        const user = users.find((u) => u.email === email);
        
        const { error: logError } = await supabaseAdmin
          .from("emails")
          .insert({
            resend_id: result.messageId || null,
            user_id: user?.id || null,
            recipient_email: email,
            sender_email: result.fromEmail || process.env.RESEND_FROM_EMAIL || "noreply@pokemonpalette.com",
            sender_name: result.fromName || process.env.RESEND_FROM_NAME || "Yasssen Shopov",
            subject: result.subject || TEMPLATE_SUBJECTS[template],
            template_type: template,
            html_content: result.html || null,
            text_content: result.text || null,
            status: result.success ? "sent" : "failed",
            error_message: result.error || null,
          });

        if (logError) {
          console.error(`Failed to log email for ${email}:`, logError);
        }

        return { email, success: result.success, messageId: result.messageId, error: result.error };
      })
    );

    const successCount = emailLogs.filter((r) => r.success).length;
    const failedCount = emailLogs.length - successCount;

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      total: recipients.length,
      results: emailLogs,
    });
  } catch (error) {
    console.error("Error sending emails:", error);
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 }
    );
  }
}

