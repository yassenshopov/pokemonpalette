export interface DailyDropData {
  userName?: string;
  gameUrl: string;
  baseUrl?: string;
  /**
   * ISO date or pre-formatted human label. If not provided, we render
   * today's date in en-US long format. Useful so previews + scheduled
   * sends can pin a specific date.
   */
  date?: string;
  /**
   * 3-color teaser strip rendered above the CTA. Defaults to a neutral
   * brand triad so we never accidentally leak the day's answer.
   */
  previewColors?: [string, string, string];
}

const BRAND_COLORS: [string, string, string] = ["#3b82f6", "#8b5cf6", "#ec4899"];
const ACCENT = "#6366f1";
const INK = "#0f172a";
const MUTED_INK = "#475569";
const SOFT_INK = "#94a3b8";
const HAIRLINE = "#e2e8f0";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(input?: string): string {
  if (input && Number.isNaN(Date.parse(input))) {
    return input;
  }
  const date = input ? new Date(input) : new Date();
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export class DailyDropTemplate {
  static render(data: DailyDropData): { html: string; text: string } {
    const greeting = `Hi ${escapeHtml(data.userName?.trim() || "there")},`;
    const dateLabel = formatDate(data.date);
    const baseUrl =
      data.baseUrl ??
      data.gameUrl.replace(/\/game\/?$/, "").replace(/\/$/, "") ??
      "https://www.pokemonpalette.com";
    const logoUrl = `${baseUrl}/logo.png`;
    const colors = data.previewColors ?? BRAND_COLORS;
    const [c1, c2, c3] = colors;

    const swatch = (color: string) => `
      <td align="center" style="padding: 0 6px;">
        <div style="width: 88px; height: 88px; border-radius: 12px; background-color: ${color};"></div>
      </td>
    `;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Today's Pokémon Palette is up!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: ${INK};">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
    Today's Pokémon Palette challenge just dropped — guess the Pokémon from the colors.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid ${HAIRLINE};">
          <!-- Brand bar -->
          <tr>
            <td style="padding: 18px 28px; background-color: ${INK};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <img src="${logoUrl}" alt="Pokémon Palette" width="28" height="28" style="display: inline-block; vertical-align: middle;">
                    <span style="display: inline-block; vertical-align: middle; margin-left: 10px; color: #ffffff; font-size: 15px; font-weight: 700; letter-spacing: -0.01em;">
                      Pokémon Palette
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle; color: ${SOFT_INK}; font-size: 12px; font-weight: 500;">
                    Daily Drop
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="padding: 40px 36px 8px;">
              <p style="margin: 0 0 10px; color: ${ACCENT}; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">
                ${dateLabel}
              </p>
              <h1 style="margin: 0 0 12px; color: ${INK}; font-size: 30px; line-height: 1.2; font-weight: 800; letter-spacing: -0.02em;">
                Today's palette is up.
              </h1>
              <p style="margin: 0; color: ${MUTED_INK}; font-size: 16px; line-height: 1.6;">
                A fresh Pokémon. Three telling colors. One guess at a time.
              </p>
            </td>
          </tr>

          <!-- Palette teaser -->
          <tr>
            <td style="padding: 28px 36px 4px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                <tr>
                  ${swatch(c1)}
                  ${swatch(c2)}
                  ${swatch(c3)}
                </tr>
              </table>
              <p style="margin: 14px 0 0; color: ${SOFT_INK}; font-size: 12px;">
                The real swatches are waiting in-game.
              </p>
            </td>
          </tr>

          <!-- Greeting + body -->
          <tr>
            <td style="padding: 28px 36px 8px;">
              <p style="margin: 0 0 14px; color: ${INK}; font-size: 16px; line-height: 1.6;">
                ${greeting}
              </p>
              <p style="margin: 0 0 14px; color: ${MUTED_INK}; font-size: 16px; line-height: 1.65;">
                A new <strong style="color: ${INK};">Pokémon Palette</strong> just went live for today. You've got until midnight to lock in your guess and keep the streak alive.
              </p>
              <p style="margin: 0; color: ${MUTED_INK}; font-size: 16px; line-height: 1.65;">
                Open the colors. Trust the vibe. Catch 'em all.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 28px 36px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(data.gameUrl)}" style="display: inline-block; padding: 14px 36px; background-color: ${INK}; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; letter-spacing: -0.01em;">
                      Play today's palette &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tip -->
          <tr>
            <td style="padding: 28px 36px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-top: 1px solid ${HAIRLINE};">
                <tr>
                  <td style="padding-top: 18px;">
                    <p style="margin: 0 0 4px; color: ${ACCENT}; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                      Pro tip
                    </p>
                    <p style="margin: 0; color: ${MUTED_INK}; font-size: 14px; line-height: 1.55;">
                      Look for the <em>secondary</em> color first — it usually points at typing before the primary does.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 36px 28px; background-color: ${INK};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <span style="color: #e2e8f0; font-size: 13px; font-weight: 600;">
                      Pokémon Palette
                    </span>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <a href="${baseUrl}" style="color: ${SOFT_INK}; text-decoration: none; font-size: 12px; margin-left: 14px;">Home</a>
                    <a href="${baseUrl}/explore" style="color: ${SOFT_INK}; text-decoration: none; font-size: 12px; margin-left: 14px;">Explore</a>
                    <a href="${baseUrl}/account" style="color: ${SOFT_INK}; text-decoration: none; font-size: 12px; margin-left: 14px;">Account</a>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <p style="margin: 0 0 4px; color: ${SOFT_INK}; font-size: 11px; line-height: 1.55;">
                      You're getting this because you opted into Pokémon Palette daily emails.
                      <a href="${baseUrl}/account" style="color: #cbd5e1; text-decoration: underline;">Manage preferences</a>.
                    </p>
                    <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.55;">
                      Not affiliated with The Pokémon Company or Nintendo.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0; color: ${SOFT_INK}; font-size: 11px;">
          © ${new Date().getFullYear()} Pokémon Palette
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const text = `
${data.userName?.trim() ? `Hi ${data.userName.trim()},` : "Hi there,"}

Today's Pokémon Palette is up — ${dateLabel}.

A fresh Pokémon, three telling colors, one guess at a time. You've got until midnight to lock it in and keep the streak alive.

Play now: ${data.gameUrl}

Pro tip: Look for the secondary color first — it usually points at typing before the primary does.

—
You're getting this because you opted into Pokémon Palette daily emails.
Manage preferences: ${baseUrl}/account
Not affiliated with The Pokémon Company or Nintendo.
    `.trim();

    return { html, text };
  }
}
