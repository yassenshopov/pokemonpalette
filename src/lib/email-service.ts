import { Resend } from "resend";
import { DailyNudgeTemplate } from "@/lib/email-templates/daily-nudge";

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailTemplate = "daily-nudge";

export interface EmailTemplateData {
  "daily-nudge": {
    userName?: string;
    gameUrl: string;
  };
}

export interface SendEmailOptions<T extends EmailTemplate> {
  to: string | string[];
  template: T;
  data: EmailTemplateData[T];
  subject?: string;
}

const TEMPLATE_SUBJECTS: Record<EmailTemplate, string> = {
  "daily-nudge": "🎮 Don't forget today's Pokémon Palette challenge!",
};

export class EmailService {
  private static fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@pokemonpalette.com";
  private static fromName = process.env.RESEND_FROM_NAME || "Yasssen Shopov";

  /**
   * Send an email using a template
   */
  static async sendEmail<T extends EmailTemplate>(
    options: SendEmailOptions<T>
  ): Promise<{ 
    success: boolean; 
    messageId?: string; 
    error?: string;
    html?: string;
    text?: string;
    subject?: string;
    fromEmail?: string;
    fromName?: string;
  }> {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not configured");
      }

      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      const subject = options.subject || TEMPLATE_SUBJECTS[options.template];

      // Render the template
      const { html, text } = this.renderTemplate(options.template, options.data);

      const result = await resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: recipients,
        subject,
        html,
        text,
      });

      if (result.error) {
        return {
          success: false,
          error: result.error.message || "Failed to send email",
          html,
          text,
          subject,
          fromEmail: this.fromEmail,
          fromName: this.fromName,
        };
      }

      return {
        success: true,
        messageId: result.data?.id,
        html,
        text,
        subject,
        fromEmail: this.fromEmail,
        fromName: this.fromName,
      };
    } catch (error) {
      console.error("Email service error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Preview an email template (returns HTML and text)
   */
  static previewTemplate<T extends EmailTemplate>(
    template: T,
    data: EmailTemplateData[T]
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
    data: EmailTemplateData[T]
  ): { html: string; text: string } {
    switch (template) {
      case "daily-nudge":
        return DailyNudgeTemplate.render(data as EmailTemplateData["daily-nudge"]);
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

