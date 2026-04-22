import * as Linking from "expo-linking";
import { authApi } from "../services/auth";
import { navigationRef } from "../navigation/navigationRef";
import { useAuthStore } from "../store/auth-store";

let pendingResetToken: string | null = null;

function openResetPassword(token: string) {
  if (!navigationRef.isReady()) {
    pendingResetToken = token;
    return;
  }

  navigationRef.navigate("ResetPassword", { token });
  pendingResetToken = null;
}

export async function handleIncomingLink(url: string) {
  const parsed = Linking.parse(url);
  const rawPath = parsed.path ?? parsed.hostname ?? "";
  const path = rawPath.replace(/^\/+/, "");
  const token = typeof parsed.queryParams?.token === "string" ? parsed.queryParams.token : "";

  if (path === "verify-email" && token) {
    await authApi.verifyEmail(token);
    if (useAuthStore.getState().token) {
      await useAuthStore.getState().refreshUser();
    }
    return;
  }

  if (path === "reset-password" && token) {
    openResetPassword(token);
  }
}

export function flushPendingLink() {
  if (pendingResetToken) {
    openResetPassword(pendingResetToken);
  }
}
