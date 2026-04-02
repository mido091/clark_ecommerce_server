import { Router } from "express";
import {
  getSettings,
  updateSettings,
  updateShippingSettings,
} from "../controllers/settings.controllers.js";
import {
  verifyToken,
  verifyOwner,
  verifyAdminOrOwner,
} from "../middlewares/auth.js";
import { logoUpload } from "../middlewares/upload.js";

const router = Router();

router.get("/", getSettings);

router.put(
  "/shipping",
  verifyToken,
  verifyAdminOrOwner,
  updateShippingSettings,
);

router.put(
  "/",
  verifyToken,
  verifyOwner,
  logoUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "footer_logo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  updateSettings,
);

export default router;
