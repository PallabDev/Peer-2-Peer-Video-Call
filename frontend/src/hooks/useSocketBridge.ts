import { useEffect } from "react";
import { socketService } from "../services/socket";
import { useAuthStore } from "../store/auth-store";
import { registerDeviceForPushNotifications } from "../services/push-notifications";
import { callManager } from "../services/call-manager";

export function useSocketBridge() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const canConnect = Boolean(
      token &&
      user &&
      user.emailVerified &&
      (user.role === "admin" || user.accessStatus === "approved"),
    );

    if (!canConnect || !token) {
      socketService.disconnect();
      callManager.detachSocket();
      return;
    }

    socketService.connect(token);
    callManager.attachSocket();
    void registerDeviceForPushNotifications();

    return () => {
      callManager.detachSocket();
      socketService.disconnect();
    };
  }, [token, user?.id, user?.emailVerified, user?.role, user?.accessStatus]);
}
