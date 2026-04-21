import * as Linking from "expo-linking";
import { authApi } from "../services/auth";
import { navigationRef } from "../navigation/navigationRef";
import { useAuthStore } from "../store/auth-store";

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

  if (path === "reset-password" && token && navigationRef.isReady()) {
    navigationRef.navigate("ResetPassword", { token });
  }
}
