/**
 * Human-friendly descriptions for the dashboard Recent Activity feed.
 *
 * Audit-log `metadata` is raw JSON meant for the compliance/audit views —
 * never surface it verbatim to end users. This module turns an audit row
 * (action + optional metadata) into a short readable sentence, with a safe
 * prettified fallback for unknown actions.
 */

const MAX_LENGTH = 160;

interface IngestionTotals {
  fetched?: number;
  insertedCanonical?: number;
  insertedDuplicates?: number;
  refreshedExisting?: number;
}

function parseMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function prettifyToken(token: string): string {
  const words = token.replace(/[._-]+/g, " ").trim();
  if (!words) return "";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function ingestionSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const totals = (meta.totals ?? null) as IngestionTotals | null;
  if (!totals || typeof totals !== "object") return "";
  const fetched = typeof totals.fetched === "number" ? totals.fetched : null;
  if (fetched === null) return "";
  const inserted =
    (typeof totals.insertedCanonical === "number" ? totals.insertedCanonical : 0) +
    (typeof totals.insertedDuplicates === "number" ? totals.insertedDuplicates : 0);
  const refreshed =
    typeof totals.refreshedExisting === "number" ? totals.refreshedExisting : 0;
  return `: ${fetched} fetched, ${inserted} new, ${refreshed} refreshed`;
}

const STATIC_ACTIONS: Record<string, string> = {
  "workspace.seeded": "Workspace set up with demo data",
  "auth.signup": "Workspace created",
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.invite_accepted": "Team invite accepted",
  "team.invite_created": "Team invite sent",
  "team.invite_revoked": "Team invite revoked",
  "team.member_updated": "Team member updated",
  "candidate.created": "Candidate added",
  "candidate.cv_parsed": "CV parsed into a candidate profile",
  "candidate.updated": "Candidate updated",
  "candidate.deleted": "Candidate deleted",
  "match_run.executed": "Match run completed",
  "match.pushed_to_crm": "Match pushed to CRM",
  "match.shortlisted": "Match shortlisted",
  "match.dismissed": "Match dismissed",
  "match.new": "Match reset to new",
  "job_source.created": "Job source added",
  "job_source.activated": "Job source activated",
  "job_source.deactivated": "Job source paused",
  "alert_rule.created": "Alert rule created",
  "alert_rule.deleted": "Alert rule deleted",
  "billing.checkout_created": "Checkout started",
  "billing.portal_created": "Billing portal opened",
  "billing.status_changed": "Subscription status changed",
  "research.scrape_url": "Researched a company page",
  "research.extract_job": "Extracted a job from a URL",
  "research.company_search": "Searched Companies House",
  "research.company_profile": "Viewed a Companies House profile",
  "ingestion.expire_stale": "Stale jobs expired",
};

export function describeActivity(action: string, metadata: string | null): string {
  const meta = parseMetadata(metadata);

  let description: string | null = STATIC_ACTIONS[action] ?? null;

  if (!description && action.startsWith("ingestion.")) {
    const target = action.slice("ingestion.".length);
    const directory = asString(meta?.directory);
    const label = directory ?? target;
    description = `Job ingestion — ${prettifyToken(label)}${ingestionSummary(meta)}`;
  }

  if (!description && action.startsWith("job_search.")) {
    const verb =
      action === "job_search.saved"
        ? "saved"
        : action === "job_search.updated"
          ? "updated"
          : "deleted";
    const name = asString(meta?.name);
    description = name ? `Search "${name}" ${verb}` : `Saved search ${verb}`;
  }

  if (!description) {
    description = prettifyToken(action);
  }

  return description.length > MAX_LENGTH
    ? `${description.slice(0, MAX_LENGTH - 1)}…`
    : description;
}
