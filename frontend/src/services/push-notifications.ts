import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { apiRequest } from "../api/client";

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

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
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

export async function playIncomingCallNotification(name: string, mode: "audio" | "video") {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: mode === "video" ? "Incoming video call" : "Incoming audio call",
      body: `${name} is calling you`,
      sound: "default",
    },
    trigger: null,
  });
}
