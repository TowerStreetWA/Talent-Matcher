import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import candidatesRouter from "./candidates";
import matchesRouter from "./matches";
import jobsRouter from "./jobs";
import searchRouter from "./search";
import jobSourcesRouter from "./jobSources";
import alertRulesRouter from "./alertRules";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import billingRouter from "./billing";
import storageRouter from "./storage";
import teamRouter from "./team";
import { requireAuth, blockViewerWrites, requireRole } from "../middlewares/auth";
import { sentryContextMiddleware } from "../lib/sentry";
import { enforceBillingForWrites } from "../middlewares/billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth, sentryContextMiddleware, blockViewerWrites);

// Dev-only route to verify Sentry captures unhandled route errors.
if (process.env["NODE_ENV"] !== "production") {
  router.get("/debug-sentry", () => {
    throw new Error("Sentry verification error (dev-only route)");
  });
}

router.use(billingRouter);
router.use(enforceBillingForWrites);
router.use(storageRouter);
router.use(candidatesRouter);
router.use(matchesRouter);
router.use(jobsRouter);
router.use(searchRouter);
router.use(jobSourcesRouter);
router.use(alertRulesRouter);
router.use(dashboardRouter);
router.use(["/crm-sync-events", "/audit-logs"], requireRole("admin"));
router.use(adminRouter);
router.use("/team", requireRole("admin"));
router.use(teamRouter);

export default router;
