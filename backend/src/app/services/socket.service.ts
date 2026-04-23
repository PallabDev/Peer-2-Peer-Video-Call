import { type Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { ACCESS_STATUS, CALL_MODE, CALL_STATUS, USER_ROLES } from "../constants/user";
import { ApiError } from "../utils/ApiErrors";
import { verifyAccessToken } from "../utils/jwt";
import { getUserById } from "./auth.service";
import { assertCallableUser, createCallLog, updateCallStatus } from "./call.service";
import { sendExpoPushNotification } from "./notification.service";

type ActiveCall = {
    id: string;
    callerId: string;
    callerName: string;
    calleeId: string;
    mode: "audio" | "video";
    createdAt: number;
    state: "ringing" | "answered";
    timeout: NodeJS.Timeout | null;
};

const userSockets = new Map<string, Set<string>>();
const activeCalls = new Map<string, ActiveCall>();

let io: Server | null = null;

const addSocket = (userId: string, socketId: string) => {
    const sockets = userSockets.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    userSockets.set(userId, sockets);
};

const removeSocket = (userId: string, socketId: string) => {
    const sockets = userSockets.get(userId);
    if (!sockets) {
        return;
    }

    sockets.delete(socketId);
    if (sockets.size === 0) {
        userSockets.delete(userId);
    }
};

const isOnline = (userId: string) => Boolean(userSockets.get(userId)?.size);

const emitToUser = (userId: string, event: string, payload: Record<string, unknown>) => {
    io?.to(`user:${userId}`).emit(event, payload);
};

const findActiveCallForUser = (userId: string) => {
    for (const call of activeCalls.values()) {
        if (call.callerId === userId || call.calleeId === userId) {
            return call;
        }
    }

    return null;
};

const isCallParticipant = (call: ActiveCall, userId: string) => (
    call.callerId === userId || call.calleeId === userId
);

const getOtherParticipantId = (call: ActiveCall, userId: string) => {
    if (call.callerId === userId) {
        return call.calleeId;
    }

    if (call.calleeId === userId) {
        return call.callerId;
    }

    return null;
};

const clearCall = (callId: string) => {
    const call = activeCalls.get(callId);
    if (call?.timeout) {
        clearTimeout(call.timeout);
    }
    activeCalls.delete(callId);
};

const ensureSocketUser = async (socket: Socket) => {
    const rawToken = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
    if (!rawToken || typeof rawToken !== "string") {
        throw new ApiError(401, "Missing socket auth token.");
    }

    const payload = verifyAccessToken(rawToken);
    if (!payload.sub) {
        throw new ApiError(401, "Invalid socket token.");
    }
    const user = await getUserById(payload.sub);

    if (!user.emailVerified) {
        throw new ApiError(403, "Verify your email before using calling.");
    }

    if (user.role !== USER_ROLES.ADMIN && user.accessStatus !== ACCESS_STATUS.APPROVED) {
        throw new ApiError(403, "Access denied. Wait for admin approval.");
    }

    return user;
};

const relayWebRtcMessage = (
    socket: Socket,
    eventName: "webrtc:offer" | "webrtc:answer" | "webrtc:ice-candidate",
) => {
    socket.on(eventName, async (payload: { callId: string; toUserId: string; sdp?: unknown; candidate?: unknown; }) => {
        const call = activeCalls.get(payload.callId);
        const senderId = (socket.data.user as { id: string; }).id;
        if (!call) {
            return;
        }

        const expectedRecipientId = getOtherParticipantId(call, senderId);
        if (!expectedRecipientId || payload.toUserId !== expectedRecipientId) {
            return;
        }

        if (eventName !== "webrtc:ice-candidate" && call.state !== "answered") {
            return;
        }

        emitToUser(payload.toUserId, eventName, {
            ...payload,
            fromUserId: senderId,
        });
    });
};

export const configureSocketServer = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: "*",
        },
    });

    io.use(async (socket, next) => {
        try {
            const user = await ensureSocketUser(socket);
            socket.data.user = user;
            next();
        } catch (error) {
            next(error as Error);
        }
    });

    io.on("connection", async (socket) => {
        const user = socket.data.user as { id: string; firstName: string; };
        addSocket(user.id, socket.id);
        socket.join(`user:${user.id}`);

        for (const call of activeCalls.values()) {
            if (call.calleeId === user.id && call.state === "ringing") {
                emitToUser(user.id, "call:incoming", {
                    callId: call.id,
                    callerId: call.callerId,
                    callerName: call.callerName,
                    mode: call.mode,
                });
            }
        }

        socket.on("call:initiate", async (
            payload: { toUserId: string; mode: "audio" | "video"; },
            callback?: (response: Record<string, unknown>) => void,
        ) => {
            try {
                if (![CALL_MODE.AUDIO, CALL_MODE.VIDEO].includes(payload.mode)) {
                    throw new ApiError(400, "Invalid call mode.");
                }

                if (payload.toUserId === user.id) {
                    throw new ApiError(400, "You cannot call yourself.");
                }

                const caller = await assertCallableUser(user.id);
                const callee = await assertCallableUser(payload.toUserId);
                const callerActiveCall = findActiveCallForUser(caller.id);
                const calleeActiveCall = findActiveCallForUser(callee.id);

                if (callerActiveCall) {
                    callback?.({
                        success: false,
                        code: "CALLER_BUSY",
                        message: "You are already in a call.",
                    });
                    return;
                }

                if (calleeActiveCall) {
                    emitToUser(caller.id, "call:busy", {
                        calleeId: callee.id,
                    });
                    callback?.({
                        success: false,
                        code: "USER_BUSY",
                        message: `${callee.firstName} is busy on another call.`,
                    });
                    return;
                }

                const callLog = await createCallLog(caller.id, callee.id, payload.mode);
                activeCalls.set(callLog.id, {
                    id: callLog.id,
                    callerId: caller.id,
                    callerName: `${caller.firstName}${caller.lastName ? ` ${caller.lastName}` : ""}`.trim(),
                    calleeId: callee.id,
                    mode: payload.mode,
                    createdAt: Date.now(),
                    state: "ringing",
                    timeout: null,
                });

                await updateCallStatus(callLog.id, CALL_STATUS.RINGING);

                emitToUser(callee.id, "call:incoming", {
                    callId: callLog.id,
                    callerId: caller.id,
                    callerName: `${caller.firstName}${caller.lastName ? ` ${caller.lastName}` : ""}`.trim(),
                    mode: payload.mode,
                });

                if (!isOnline(callee.id) && callee.expoPushToken) {
                    await sendExpoPushNotification({
                        to: callee.expoPushToken,
                        title: payload.mode === "video" ? "Incoming video call" : "Incoming audio call",
                        body: `${caller.firstName} is calling you on Callie`,
                        data: {
                            type: "incoming-call",
                            callId: callLog.id,
                            callerId: caller.id,
                            callerName: `${caller.firstName}${caller.lastName ? ` ${caller.lastName}` : ""}`.trim(),
                            mode: payload.mode,
                        },
                        categoryId: "incoming_call",
                        channelId: "calls",
                    });
                }

                callback?.({
                    success: true,
                    callId: callLog.id,
                    ringing: true,
                });

                const call = activeCalls.get(callLog.id);
                if (call) {
                    call.timeout = setTimeout(async () => {
                        const activeCall = activeCalls.get(callLog.id);
                        if (!activeCall || activeCall.state !== "ringing") {
                            return;
                        }

                        await updateCallStatus(callLog.id, CALL_STATUS.MISSED);
                        emitToUser(caller.id, "call:missed", { callId: callLog.id, calleeId: callee.id });
                        emitToUser(callee.id, "call:missed", { callId: callLog.id, callerId: caller.id });
                        clearCall(callLog.id);
                    }, 45_000);
                }
            } catch (error) {
                callback?.({
                    success: false,
                    message: error instanceof Error ? error.message : "Could not initiate call.",
                });
            }
        });

        socket.on("call:accept", async (payload: { callId: string; }) => {
            const call = activeCalls.get(payload.callId);
            if (!call || call.calleeId !== user.id) {
                return;
            }

            if (call.timeout) {
                clearTimeout(call.timeout);
                call.timeout = null;
            }
            call.state = "answered";
            await updateCallStatus(call.id, CALL_STATUS.ANSWERED);
            emitToUser(call.callerId, "call:accepted", {
                callId: call.id,
                byUserId: user.id,
            });
        });

        socket.on("call:decline", async (payload: { callId: string; }) => {
            const call = activeCalls.get(payload.callId);
            if (!call || !isCallParticipant(call, user.id)) {
                return;
            }

            await updateCallStatus(call.id, CALL_STATUS.DECLINED);
            emitToUser(call.callerId, "call:declined", { callId: call.id, byUserId: user.id });
            emitToUser(call.calleeId, "call:declined", { callId: call.id, byUserId: user.id });
            clearCall(call.id);
        });

        socket.on("call:cancel", async (payload: { callId: string; }) => {
            const call = activeCalls.get(payload.callId);
            if (!call || call.callerId !== user.id) {
                return;
            }

            await updateCallStatus(call.id, CALL_STATUS.CANCELLED);
            emitToUser(call.calleeId, "call:cancelled", { callId: call.id, byUserId: user.id });
            clearCall(call.id);
        });

        socket.on("call:end", async (payload: { callId: string; }) => {
            const call = activeCalls.get(payload.callId);
            if (!call || !isCallParticipant(call, user.id)) {
                return;
            }

            await updateCallStatus(call.id, CALL_STATUS.ENDED);
            emitToUser(call.callerId, "call:ended", { callId: call.id, byUserId: user.id });
            emitToUser(call.calleeId, "call:ended", { callId: call.id, byUserId: user.id });
            clearCall(call.id);
        });

        relayWebRtcMessage(socket, "webrtc:offer");
        relayWebRtcMessage(socket, "webrtc:answer");
        relayWebRtcMessage(socket, "webrtc:ice-candidate");

        socket.on("disconnect", () => {
            removeSocket(user.id, socket.id);
        });
    });

    return io;
};
