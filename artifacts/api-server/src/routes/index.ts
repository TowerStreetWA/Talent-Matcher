import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import candidatesRouter from "./candidates";
import matchesRouter from "./matches";
import jobsRouter from "./jobs";
import jobSourcesRouter from "./jobSources";
import alertRulesRouter from "./alertRules";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import billingRouter from "./billing";
import storageRouter from "./storage";
import { requireAuth, blockViewerWrites, requireRole } from "../middlewares/auth";
import { enforceBillingForWrites } from "../middlewares/billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth, blockViewerWrites);
router.use(billingRouter);
router.use(enforceBillingForWrites);
router.use(storageRouter);
router.use(candidatesRouter);
router.use(matchesRouter);
router.use(jobsRouter);
router.use(jobSourcesRouter);
router.use(alertRulesRouter);
router.use(dashboardRouter);
router.use(["/crm-sync-events", "/audit-logs"], requireRole("admin"));
router.use(adminRouter);

export default router;
