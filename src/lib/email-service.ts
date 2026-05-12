import { Resend } from "resend";
import { DailyNudgeTemplate } from "@/lib/email-templates/daily-nudge";
import { DailyDropTemplate } from "@/lib/email-templates/daily-drop";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { serverEnv } from "@/lib/env";

const resend = new Resend(serverEnv.RESEND_API_KEY);

export type EmailTemplate = "daily-nudge" | "daily-drop";

export interface EmailTemplateData {
  "daily-nudge": {
    userName?: string;
    gameUrl: string;
  };
  "daily-drop": {
    userName?: string;
    gameUrl: string;
    baseUrl?: string;
    date?: string;
    previewColors?: [string, string, string];
  };
}

export interface SendEmailOptions<T extends EmailTemplate> {
  to: string | string[];
  template: T;
  data: EmailTemplateData[T];
  subject?: string;
  /**
   * Optional Clerk/Prisma user id to attach to the persisted log row.
   * When omitted (e.g. transactional emails to non-users), the row is
   * still written but `userId` is left null.
   */
  userId?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  html?: string;
  text?: string;
  subject?: string;
  fromEmail?: string;
  fromName?: string;
  /** Number of email rows written to the DB log (one per recipient). */
  loggedCount?: number;
}

const TEMPLATE_SUBJECTS: Record<EmailTemplate, string> = {
  "daily-nudge": "🎮 Don't forget today's Pokémon Palette challenge!",
  "daily-drop": "🎨 Today's Pokémon Palette is up!",
};

export class EmailService {
  private static fromEmail =
    serverEnv.RESEND_FROM_EMAIL || "noreply@pokemonpalette.com";
  private static fromName = serverEnv.RESEND_FROM_NAME || "Yasssen Shopov";

  /**
   * Send an email using a template.
   *
   * Every send (success OR failure) is persisted to the `emails` table so
   * we have an authoritative record of every message dispatched from the
   * platform — admin sends, scheduled jobs, transactional, etc. Callers
   * never need to write to the table themselves.
   */
  static async sendEmail<T extends EmailTemplate>(
    options: SendEmailOptions<T>,
  ): Promise<SendEmailResult> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const subject = options.subject || TEMPLATE_SUBJECTS[options.template];
    let html: string | undefined;
    let text: string | undefined;

    try {
      if (!serverEnv.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not configured");
      }

      const rendered = this.renderTemplate(options.template, options.data);
      html = rendered.html;
      text = rendered.text;

      const result = await resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: recipients,
        subject,
        html,
        text,
      });

      if (result.error) {
        const errorMessage = result.error.message || "Failed to send email";
        const loggedCount = await this.persistLogs({
          recipients,
          userId: options.userId,
          subject,
          template: options.template,
          html,
          text,
          status: "failed",
          errorMessage,
          messageId: null,
        });

        return {
          success: false,
          error: errorMessage,
          html,
          text,
          subject,
          fromEmail: this.fromEmail,
          fromName: this.fromName,
          loggedCount,
        };
      }

      const loggedCount = await this.persistLogs({
        recipients,
        userId: options.userId,
        subject,
        template: options.template,
        html,
        text,
        status: "sent",
        errorMessage: null,
        messageId: result.data?.id ?? null,
      });

      return {
        success: true,
        messageId: result.data?.id,
        html,
        text,
        subject,
        fromEmail: this.fromEmail,
        fromName: this.fromName,
        loggedCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error("email_service.send_failed", {
        template: options.template,
        recipients: recipients.length,
        error: errorMessage,
      });

      const loggedCount = await this.persistLogs({
        recipients,
        userId: options.userId,
        subject,
        template: options.template,
        html,
        text,
        status: "failed",
        errorMessage,
        messageId: null,
      });

      return {
        success: false,
        error: errorMessage,
        html,
        text,
        subject,
        fromEmail: this.fromEmail,
        fromName: this.fromName,
        loggedCount,
      };
    }
  }

  /**
   * Persist one row per recipient to the `emails` table.
   *
   * - Resend gives us a single message id for an entire send, even when
   *   there are multiple recipients. Since `resend_id` is UNIQUE in the
   *   schema, we attach the id to the first recipient only and leave it
   *   null for the rest. In practice every caller in this codebase sends
   *   to a single recipient at a time, so this is just defensive code.
   * - Failures here are logged but never thrown — we don't want a DB
   *   blip to mask a successful Resend delivery from the caller.
   */
  private static async persistLogs(input: {
    recipients: string[];
    userId?: string;
    subject: string;
    template: EmailTemplate;
    html?: string;
    text?: string;
    status: "sent" | "failed";
    errorMessage: string | null;
    messageId: string | null;
  }): Promise<number> {
    let logged = 0;
    for (const [index, recipient] of input.recipients.entries()) {
      try {
        await prisma.email.create({
          data: {
            resendId: index === 0 ? input.messageId : null,
            userId: input.userId ?? null,
            recipientEmail: recipient,
            senderEmail: this.fromEmail,
            senderName: this.fromName,
            subject: input.subject,
            templateType: input.template,
            htmlContent: input.html ?? null,
            textContent: input.text ?? null,
            status: input.status,
            errorMessage: input.errorMessage,
          },
        });
        logged += 1;
      } catch (err) {
        logger.error("email_service.log_persist_failed", {
          recipient,
          template: input.template,
          status: input.status,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return logged;
  }

  /**
   * Preview an email template (returns HTML and text)
   */
  static previewTemplate<T extends EmailTemplate>(
    template: T,
    data: EmailTemplateData[T],
  ): { html: string; text: string; subject: string } {
    const { html, text } = this.renderTemplate(template, data);
    const subject = TEMPLATE_SUBJECTS[template];

    return { html, text, subject };
  }

  /**
   * Render a template based on the template type
   */
  private static renderTemplate<T extends EmailTemplate>(
    template: T,
    data: EmailTemplateData[T],
  ): { html: string; text: string } {
    switch (template) {
      case "daily-nudge":
        return DailyNudgeTemplate.render(
          data as EmailTemplateData["daily-nudge"],
        );
      case "daily-drop":
        return DailyDropTemplate.render(
          data as EmailTemplateData["daily-drop"],
        );
      default:
        throw new Error(`Unknown template: ${template}`);
    }
  }

  /**
   * Validate email address format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
