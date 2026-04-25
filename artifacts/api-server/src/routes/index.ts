import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth.js";
import healthRouter from "./health";
import businessesRouter from "./businesses";
import customersRouter from "./customers";
import dashboardRouter from "./dashboard";
import remindersRouter from "./reminders";
import profilesRouter from "./profiles";
import serviceLogsRouter from "./service-logs";
import authRouter from "./auth";
import storageRouter from "./storage";
import seoRouter from "./seo";

const router: IRouter = Router();

// Public routes — no auth required
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/profiles", profilesRouter);
router.use(seoRouter);

// Protected routes — require valid JWT for all sub-routes
router.use("/businesses", requireAuth, businessesRouter);
router.use("/customers", requireAuth, customersRouter);
router.use("/dashboard", requireAuth, dashboardRouter);
router.use("/service-logs", requireAuth, serviceLogsRouter);
router.use(storageRouter);
router.use(requireAuth, remindersRouter);

export default router;
