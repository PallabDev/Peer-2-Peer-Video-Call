import { Router } from "express";
import { getCallHistory, getContacts, registerPushToken } from "../controllers/user.controller";
import { requireAuth, requireCallAccess } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAuth);
router.get("/contacts", requireCallAccess, asyncHandler(getContacts));
router.post("/push-token", requireCallAccess, asyncHandler(registerPushToken));
router.get("/call-history", requireCallAccess, asyncHandler(getCallHistory));

export default router;
