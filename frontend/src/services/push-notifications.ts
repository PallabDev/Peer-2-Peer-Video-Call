import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiRequest } from "../api/client";
import type { CallMode, CallSession } from "../types/app";

export const INCOMING_CALL_CATEGORY = "incoming_call";
export const INCOMING_CALL_CHANNEL = "calls";
export const MISSED_CALL_CHANNEL = "missed_calls";
export const ANSWER_CALL_ACTION = "answer";
export const DECLINE_CALL_ACTION = "decline";

type IncomingCallNotificationData = {
  type?: unknown;
  callId?: unknown;
  callerId?: unknown;
  callerName?: unknown;
  mode?: unknown;
};

export async function registerDeviceForPushNotifications() {
  if (!Device.isDevice) {
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    return;
  }

  const projectId =
    (Constants as typeof Constants & { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);

  if (!projectId) {
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  await apiRequest("/api/users/push-token", {
    method: "POST",
    body: JSON.stringify({
      expoPushToken: token.data,
    }),
  });
}

export async function initializeNotificationCategories() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(INCOMING_CALL_CHANNEL, {
      name: "Incoming calls",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 700, 350, 700],
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    });

    await Notifications.setNotificationChannelAsync(MISSED_CALL_CHANNEL, {
      name: "Missed calls",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  await Notifications.setNotificationCategoryAsync(INCOMING_CALL_CATEGORY, [
    {
      identifier: ANSWER_CALL_ACTION,
      buttonTitle: "Answer",
      options: { opensAppToForeground: true },
    },
    {
      identifier: DECLINE_CALL_ACTION,
      buttonTitle: "Decline",
      options: { isDestructive: true, opensAppToForeground: true },
    },
  ]);
}

export function getIncomingCallNotificationId(callId: string) {
  return `incoming-call-${callId}`;
}

export function getMissedCallNotificationId(callId: string) {
  return `missed-call-${callId}`;
}

export function parseIncomingCallNotification(data?: IncomingCallNotificationData): CallSession | null {
  if (!data) {
    return null;
  }

  const mode = data.mode === "audio" || data.mode === "video" ? data.mode : null;

  if (
    data.type !== "incoming-call" ||
    typeof data.callId !== "string" ||
    typeof data.callerId !== "string" ||
    !mode
  ) {
    return null;
  }

  return {
    callId: data.callId,
    remoteUserId: data.callerId,
    remoteUserName: typeof data.callerName === "string" && data.callerName.trim()
      ? data.callerName.trim()
      : "Unknown caller",
    mode: mode as CallMode,
    direction: "incoming",
  };
}

export async function cancelIncomingCallNotification(callId: string) {
  const ids = new Set([getIncomingCallNotificationId(callId)]);
  const presentedNotifications = await Notifications.getPresentedNotificationsAsync().catch(() => []);

  presentedNotifications.forEach((notification) => {
    if (notification.request.content.data?.callId === callId) {
      ids.add(notification.request.identifier);
    }
  });

  await Promise.all(
    [...ids].map((id) => Notifications.dismissNotificationAsync(id).catch(() => undefined)),
  );
  await Notifications.cancelScheduledNotificationAsync(getIncomingCallNotificationId(callId)).catch(() => undefined);
}

export async function playMissedCallNotification(call: CallSession) {
  await cancelIncomingCallNotification(call.callId);
  await Notifications.scheduleNotificationAsync({
    identifier: getMissedCallNotificationId(call.callId),
    content: {
      title: call.mode === "video" ? "Missed video call" : "Missed audio call",
      body: `${call.remoteUserName} called you`,
      sound: "default",
      data: {
        type: "missed-call",
        callId: call.callId,
        callerId: call.remoteUserId,
        callerName: call.remoteUserName,
        mode: call.mode,
      },
      priority: Notifications.AndroidNotificationPriority.HIGH,
      autoDismiss: true,
      interruptionLevel: "active",
    },
    trigger: Platform.OS === "android" ? { channelId: MISSED_CALL_CHANNEL } : null,
  });
}

export async function playIncomingCallNotification(call: CallSession) {
  await Notifications.scheduleNotificationAsync({
    identifier: getIncomingCallNotificationId(call.callId),
    content: {
      title: call.mode === "video" ? "Incoming video call" : "Incoming audio call",
      body: `${call.remoteUserName} is calling you`,
      sound: "default",
      categoryIdentifier: INCOMING_CALL_CATEGORY,
      data: {
        type: "incoming-call",
        callId: call.callId,
        callerId: call.remoteUserId,
        callerName: call.remoteUserName,
        mode: call.mode,
      },
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: true,
      autoDismiss: false,
      interruptionLevel: "timeSensitive",
    },
    trigger: Platform.OS === "android" ? { channelId: INCOMING_CALL_CHANNEL } : null,
  });
}
