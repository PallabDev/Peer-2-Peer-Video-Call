export const USER_ROLES = {
    ADMIN: "admin",
    USER: "user",
} as const;

export const ACCESS_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    DENIED: "denied",
} as const;

export const CALL_MODE = {
    AUDIO: "audio",
    VIDEO: "video",
} as const;

export const CALL_STATUS = {
    INITIATED: "initiated",
    RINGING: "ringing",
    ANSWERED: "answered",
    DECLINED: "declined",
    MISSED: "missed",
    ENDED: "ended",
    FAILED: "failed",
    CANCELLED: "cancelled",
} as const;
