import { Router, type IRouter } from "express";
import healthRouter from "./health";
import candidatesRouter from "./candidates";
import matchesRouter from "./matches";
import jobsRouter from "./jobs";
import jobSourcesRouter from "./jobSources";
import alertRulesRouter from "./alertRules";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(candidatesRouter);
router.use(matchesRouter);
router.use(jobsRouter);
router.use(jobSourcesRouter);
router.use(alertRulesRouter);
router.use(dashboardRouter);
router.use(adminRouter);

export default router;
