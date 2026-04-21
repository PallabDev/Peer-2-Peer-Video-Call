import { z } from "zod";

export const updateUserSchema = z.object({
    role: z.enum(["admin", "user"]).optional(),
    accessStatus: z.enum(["pending", "approved", "denied"]).optional(),
}).refine((value) => value.role || value.accessStatus, {
    message: "At least one field is required.",
});
