import { z } from "zod";
import type { EmailTemplate, EmailTemplateData } from "@/lib/email-service";

/**
 * Zod schemas for inbound email payloads.
 *
 * Both `/api/admin/emails/preview` and `/api/admin/emails/send`
 * previously cast `body.template` and `body.data` straight through to
 * the rendering layer with only an `if (!template)` truthy check.
 * That accepted any `template` string (a bogus name silently fell
 * through to the `default` arm of `renderTemplate` and 500'd) and
 * accepted any `data` shape — the templates themselves only crash on
 * missing fields at render time.
 *
 * The schemas here enforce shape AND constrain string lengths so an
 * admin can't accidentally (or maliciously, in an
 * admin-takeover scenario) ship a 10 MB `userName` to Resend.
 * `gameUrl` / `baseUrl` are validated as URLs at the boundary; the
 * templates additionally pass them through `escapeUrl` before
 * inlining into `href` attributes — defense in depth.
 */

const MAX_NAME_LENGTH = 256;
const MAX_URL_LENGTH = 2048;

const dailyNudgeDataSchema = z.object({
  userName: z.string().max(MAX_NAME_LENGTH).optional(),
  gameUrl: z.string().url().max(MAX_URL_LENGTH).optional(),
});

const dailyDropDataSchema = z.object({
  userName: z.string().max(MAX_NAME_LENGTH).optional(),
  gameUrl: z.string().url().max(MAX_URL_LENGTH).optional(),
  baseUrl: z.string().url().max(MAX_URL_LENGTH).optional(),
  date: z.string().max(64).optional(),
  // Three brand hex colours. We deliberately accept the loose
  // `#xxx` / `#xxxxxx` form rather than parsing — the template
  // inlines the value as a CSS `background-color`, and CSS already
  // rejects malformed colours. The length cap blocks a payload
  // injecting CSS-escape-then-XSS via a 100 KB value.
  previewColors: z
    .tuple([z.string().max(32), z.string().max(32), z.string().max(32)])
    .optional(),
});

export const emailRequestSchema = z.discriminatedUnion("template", [
  z.object({
    template: z.literal("daily-nudge"),
    data: dailyNudgeDataSchema,
  }),
  z.object({
    template: z.literal("daily-drop"),
    data: dailyDropDataSchema,
  }),
]);

/** Send-specific extension: optional `to` / `userIds` recipient lists. */
export const emailSendRequestSchema = z.intersection(
  emailRequestSchema,
  z.object({
    to: z
      .union([z.string().email(), z.array(z.string().email()).max(1000)])
      .optional(),
    userIds: z.array(z.string().min(1).max(64)).max(10_000).optional(),
  }),
);

export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type EmailSendRequest = z.infer<typeof emailSendRequestSchema>;

/** Narrowing helper: given a parsed `EmailRequest`, return the typed
 *  payload pair that the renderer / EmailService expect. */
export function asTemplateData<T extends EmailTemplate>(
  parsed: EmailRequest,
): { template: T; data: EmailTemplateData[T] } {
  return parsed as unknown as { template: T; data: EmailTemplateData[T] };
}
