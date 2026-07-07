import type { Request, Response, NextFunction } from "express";
import { getBillingRow } from "../lib/billing/service";
import { canUseCoreProduct } from "../lib/billing/plans";
import { tenantOf } from "./auth";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Billing gate for core product write actions.
 * - trialing / active / past_due (grace): allowed
 * - none / canceled / unpaid / incomplete_expired / paused: reads allowed,
 *   writes blocked with 402 so the tenant can still log in, browse, and
 *   reach the billing page to subscribe.
 */
export async function enforceBillingForWrites(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (READ_METHODS.has(req.method)) {
    next();
    return;
  }
  try {
    const row = await getBillingRow(tenantOf(req));
    const status = row?.status ?? "none";
    if (canUseCoreProduct(status)) {
      next();
      return;
    }
    res.status(402).json({
      message:
        status === "none"
          ? "Start your free trial to use this feature. Visit the Billing page to begin."
          : "Your subscription is not active. Visit the Billing page to reactivate your plan.",
    });
  } catch (err) {
    req.log.error({ err }, "Billing gate check failed");
    res.status(500).json({ message: "Internal server error" });
  }
}
