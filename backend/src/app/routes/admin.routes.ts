import { Router } from "express";
import { getUsers, updateUser } from "../controllers/admin.controller";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAuth, requireAdmin);
router.get("/users", asyncHandler(getUsers));
router.patch("/users/:userId", asyncHandler(updateUser));

export default router;
