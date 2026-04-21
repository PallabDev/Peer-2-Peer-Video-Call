import { Router } from "express";
import { getCalls } from "../controllers/call.controller";
import { requireAuth, requireCallAccess } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAuth, requireCallAccess);
router.get("/", asyncHandler(getCalls));

export default router;
