// Resend integration (Replit connector) — sends via the connector proxy,
// which handles identity, token refresh, and auth headers automatically.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";

const FROM = "VacancyMatch <onboarding@resend.dev>";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Send an email through the Resend connector. Never throws — email is a
 * side-channel and must not break the request that triggered it.
 * Returns true when Resend accepted the message.
 */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.warn(
        { status: response.status, detail: detail.slice(0, 300), subject: input.subject },
        "Resend rejected email",
      );
      return false;
    }
    logger.info({ subject: input.subject }, "Email sent via Resend");
    return true;
  } catch (err) {
    logger.warn({ err, subject: input.subject }, "Failed to send email");
    return false;
  }
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function alertMatchEmailHtml(params: {
  candidateName: string;
  bestScore: number;
  matchCount: number;
  minScore: number;
}): { subject: string; html: string } {
  const { candidateName, bestScore, matchCount, minScore } = params;
  return {
    subject: `VacancyMatch alert: new matches for ${candidateName} (best ${Math.round(bestScore)})`,
    html: `
      <div style="font-family:sans-serif;max-width:560px">
        <h2 style="color:#4f46e5">New job matches</h2>
        <p>A match run for <strong>${esc(candidateName)}</strong> found
        <strong>${matchCount}</strong> match${matchCount === 1 ? "" : "es"},
        with a best score of <strong>${Math.round(bestScore)}</strong> —
        above your alert threshold of ${Math.round(minScore)}.</p>
        <p>Open VacancyMatch to review the ranked matches and explanations.</p>
      </div>`,
  };
}

export function checkoutStartedEmailHtml(params: {
  planName: string;
  trialDays: number;
}): { subject: string; html: string } {
  const { planName, trialDays } = params;
  return {
    subject: `VacancyMatch: ${planName} checkout started`,
    html: `
      <div style="font-family:sans-serif;max-width:560px">
        <h2 style="color:#4f46e5">Checkout started</h2>
        <p>You started a checkout for the <strong>${esc(planName)}</strong> plan${
          trialDays > 0 ? ` with a ${trialDays}-day free trial` : ""
        }.</p>
        <p>If you completed the checkout, your subscription is now active and
        you can manage it any time from the Billing page.</p>
      </div>`,
  };
}
