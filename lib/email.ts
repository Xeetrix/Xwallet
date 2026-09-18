import { Resend } from "resend";

const FROM_ADDRESS = "XWallet Asia <support@xwallet.asia>";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

/**
 * Resolves the app's own public base URL for building links inside emails
 * (verification links, etc). Prefers an explicit override, then Vercel's
 * own production-URL env var, then whatever the current deployment's host
 * is, then falls back to localhost for local dev.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Sends an email via Resend. Never throws — if RESEND_API_KEY isn't
 * configured, or the send itself fails (bad domain verification, rate
 * limit, etc), this logs and returns rather than taking down whatever
 * balance-changing action triggered it. Email is a notification, never a
 * precondition for a transaction to succeed.
 */
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const client = getClient();
  if (!client) {
    console.warn(`[email] RESEND_API_KEY not configured — skipping "${subject}" to ${to}`);
    return;
  }
  try {
    const result = await client.emails.send({ from: FROM_ADDRESS, to, subject, html });
    if (result.error) {
      console.error(`[email] Resend rejected "${subject}" to ${to}:`, result.error);
    }
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
  }
}

const ACCENT_HEX: Record<"gold" | "emerald" | "red", string> = {
  gold: "#D4AF37",
  emerald: "#10B981",
  red: "#F87171",
};

function renderShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
  <body style="margin:0;padding:0;background-color:#08090E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08090E;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background-color:#0F1117;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#D4AF37;">Private Wealth &amp; Digital Asset Custody</p>
                <p style="margin:4px 0 0 0;font-size:18px;color:#F5F5F5;font-weight:600;">XWallet Asia</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#E4E4E7;font-size:14px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0 0 10px 0;font-size:12px;color:#71717A;">
                  If you didn't request this action or notice suspicious activity, contact our support team
                  immediately at <a href="mailto:support@xwallet.asia" style="color:#D4AF37;">support@xwallet.asia</a>.
                </p>
                <p style="margin:0 0 4px 0;font-size:11px;color:#52525B;">
                  This is an automated transactional email. Please do not reply to this message.
                </p>
                <p style="margin:0;font-size:11px;color:#3F3F46;">
                  XWallet Asia HQ &nbsp;·&nbsp; support@xwallet.asia &nbsp;·&nbsp; © ${new Date().getFullYear()} XWallet Asia. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface EmailDetailRow {
  label: string;
  value: string;
}

function renderDetailsTable(rows: EmailDetailRow[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">
    ${rows
      .map(
        (r, i) => `<tr style="${i > 0 ? "border-top:1px solid rgba(255,255,255,0.06);" : ""}">
        <td style="padding:10px 14px;font-size:12px;color:#71717A;white-space:nowrap;">${r.label}</td>
        <td style="padding:10px 14px;font-size:13px;color:#E4E4E7;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${r.value}</td>
      </tr>`
      )
      .join("")}
  </table>`;
}

/**
 * The one notification email every money-movement action sends: a headline,
 * a short line of context, and a table of details. Used for deposits,
 * withdrawals, transfers, conversions, and manual adjustments alike so the
 * visual language stays consistent across every transaction type.
 */
export async function sendTransactionEmail(params: {
  to: string;
  fullName: string;
  subject: string;
  headline: string;
  intro: string;
  rows: EmailDetailRow[];
  accent?: "gold" | "emerald" | "red";
}): Promise<void> {
  const accentHex = ACCENT_HEX[params.accent ?? "gold"];
  const body = `
    <p style="margin:0 0 4px 0;color:#A1A1AA;">Hello ${params.fullName.split(" ")[0]},</p>
    <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:${accentHex};">${params.headline}</p>
    <p style="margin:12px 0 0 0;color:#A1A1AA;">${params.intro}</p>
    ${renderDetailsTable(params.rows)}
  `;
  await sendEmail({ to: params.to, subject: params.subject, html: renderShell(body) });
}

export async function sendVerificationEmail(params: {
  to: string;
  fullName: string;
  token: string;
}): Promise<void> {
  const confirmUrl = `${getAppUrl()}/api/verify-email?token=${params.token}`;
  const body = `
    <p style="margin:0 0 2px 0;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#52525B;">Secure Custody Starts Here</p>
    <p style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#F5F5F5;">Account Created Successfully</p>
    <p style="margin:0 0 4px 0;color:#A1A1AA;">Dear ${params.fullName},</p>
    <p style="margin:12px 0 0 0;color:#A1A1AA;">
      Welcome to XWallet Asia! Thank you for creating your account with us. We're excited to help you manage
      your digital assets securely and efficiently.
    </p>
    ${renderDetailsTable([
      { label: "Full Name", value: params.fullName },
      { label: "Email", value: params.to },
    ])}
    <p style="margin:22px 0 8px 0;font-size:13px;font-weight:600;color:#E4E4E7;">Next Steps</p>
    <ol style="margin:0;padding-left:18px;color:#A1A1AA;font-size:13px;line-height:1.9;">
      <li>Confirm your email address using the button below</li>
      <li>Log in with your email and password</li>
      <li>Explore your portfolio and submit your first deposit</li>
    </ol>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="border-radius:8px;background-color:#D4AF37;">
          <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#090A10;text-decoration:none;">
            Confirm Email Address
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:12px;color:#52525B;">
      Or paste this link into your browser: <br />
      <a href="${confirmUrl}" style="color:#D4AF37;word-break:break-all;">${confirmUrl}</a>
    </p>
    <p style="margin:20px 0 0 0;color:#A1A1AA;font-size:13px;">
      This link expires in 48 hours. Once confirmed, you can sign in right away without waiting on manual
      review. Need assistance? Our support team is available 24/7 at
      <a href="mailto:support@xwallet.asia" style="color:#D4AF37;">support@xwallet.asia</a>.
    </p>
  `;
  await sendEmail({
    to: params.to,
    subject: "Account Created Successfully — XWallet Asia",
    html: renderShell(body),
  });
}

export async function sendAccountActivatedEmail(params: { to: string; fullName: string }): Promise<void> {
  const body = `
    <p style="margin:0 0 4px 0;color:#A1A1AA;">Hello ${params.fullName.split(" ")[0]},</p>
    <p style="margin:0 0 4px 0;font-size:16px;font-weight:600;color:#10B981;">Your account is now active</p>
    <p style="margin:12px 0 0 0;color:#A1A1AA;">
      Your XWallet Asia membership has been approved. You can now sign in and access your portfolio.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
      <tr>
        <td style="border-radius:8px;background-color:#D4AF37;">
          <a href="${getAppUrl()}/login" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#090A10;text-decoration:none;">
            Sign In
          </a>
        </td>
      </tr>
    </table>
  `;
  await sendEmail({ to: params.to, subject: "Your account is active — XWallet Asia", html: renderShell(body) });
}
