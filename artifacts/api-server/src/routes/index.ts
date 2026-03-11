import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import platformsRouter from "./platforms";
import videosRouter from "./videos";
import schedulerRouter from "./scheduler";
import optimalTimesRouter from "./optimal-times";
import analyticsRouter from "./analytics";
import publishLogsRouter from "./publish-logs";
import clipperRouter from "./clipper";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/platforms", platformsRouter);
router.use("/videos", videosRouter);
router.use("/scheduled-posts", schedulerRouter);
router.use("/scheduler", optimalTimesRouter);
router.use("/analytics", analyticsRouter);
router.use("/publish-logs", publishLogsRouter);
router.use("/clipper", clipperRouter);

export default router;
