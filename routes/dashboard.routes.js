import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboard.controllers.js";
import { verifyAdminOrOwner, verifyToken } from "../middlewares/auth.js";

const router = Router();

router.get("/stats", verifyToken, verifyAdminOrOwner, getDashboardStats);

export default router;
