import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../../db/db-connect";
import { callLogsTable, usersTable } from "../../db/schema";
import { CALL_STATUS } from "../constants/user";
import { ApiError } from "../utils/ApiErrors";

const terminalCallStatuses = new Set<string>([
    CALL_STATUS.ENDED,
    CALL_STATUS.DECLINED,
    CALL_STATUS.CANCELLED,
    CALL_STATUS.MISSED,
    CALL_STATUS.FAILED,
]);

export const createCallLog = async (callerId: string, calleeId: string, mode: "audio" | "video") => {
    const [callLog] = await db.insert(callLogsTable).values({
        callerId,
        calleeId,
        mode,
        status: CALL_STATUS.INITIATED,
    }).returning();

    if (!callLog) {
        throw new ApiError(500, "Could not create call session.");
    }

    return callLog;
};

export const updateCallStatus = async (
    callId: string,
    status: "initiated" | "ringing" | "answered" | "declined" | "missed" | "ended" | "failed" | "cancelled",
    metadata?: Record<string, unknown>,
) => {
    const patch: Record<string, unknown> = {
        status,
        metadata: metadata ?? null,
    };

    if (status === CALL_STATUS.ANSWERED) {
        patch.answeredAt = new Date();
    }

    if (terminalCallStatuses.has(status)) {
        patch.endedAt = new Date();
    }

    const [callLog] = await db.update(callLogsTable).set(patch).where(eq(callLogsTable.id, callId)).returning();
    return callLog;
};

export const getRecentCallsForUser = async (userId: string) => {
    return db.select({
        id: callLogsTable.id,
        callerId: callLogsTable.callerId,
        calleeId: callLogsTable.calleeId,
        mode: callLogsTable.mode,
        status: callLogsTable.status,
        startedAt: callLogsTable.startedAt,
        answeredAt: callLogsTable.answeredAt,
        endedAt: callLogsTable.endedAt,
    }).from(callLogsTable).where(
        or(eq(callLogsTable.callerId, userId), eq(callLogsTable.calleeId, userId)),
    ).orderBy(desc(callLogsTable.startedAt));
};

export const assertCallableUser = async (userId: string) => {
    const [user] = await db.select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        role: usersTable.role,
        accessStatus: usersTable.accessStatus,
        emailVerified: usersTable.emailVerified,
        expoPushToken: usersTable.expoPushToken,
    }).from(usersTable).where(eq(usersTable.id, userId));

    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    if (!user.emailVerified) {
        throw new ApiError(403, "Email verification is required before calling.");
    }

    if (user.role !== "admin" && user.accessStatus !== "approved") {
        throw new ApiError(403, "This account is not approved for calling.");
    }

    return user;
};
