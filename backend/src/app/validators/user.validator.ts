import { z } from "zod";

export const savePushTokenSchema = z.object({
    expoPushToken: z.string().min(10),
});
