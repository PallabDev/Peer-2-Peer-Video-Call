import "expo-dev-client";
import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AppState, useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { navigationRef, type RootStackParamList } from "./src/navigation/navigationRef";
import { useAuthStore } from "./src/store/auth-store";
import { useSocketBridge } from "./src/hooks/useSocketBridge";
import { useThemePalette } from "./src/theme/useThemePalette";
import { flushPendingLink, handleIncomingLink } from "./src/utils/linking";
import { IncomingCallModal } from "./src/components/IncomingCallModal";
import { OngoingCallBanner } from "./src/components/OngoingCallBanner";
import { AppLockOverlay } from "./src/components/AppLockOverlay";
import { LoadingScreen } from "./src/screens/LoadingScreen";
import { useAppLockStore } from "./src/store/app-lock-store";
import {
  ANSWER_CALL_ACTION,
  DECLINE_CALL_ACTION,
  initializeNotificationCategories,
  parseIncomingCallNotification,
} from "./src/services/push-notifications";
import { callManager } from "./src/services/call-manager";

let currentAppState = AppState.currentState;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isIncomingCall = notification.request.content.data?.type === "incoming-call";
    const shouldSuppressForegroundIncoming = isIncomingCall && currentAppState === "active";

    return ({
      shouldShowBanner: !shouldSuppressForegroundIncoming,
      shouldShowList: !shouldSuppressForegroundIncoming,
      shouldPlaySound: !shouldSuppressForegroundIncoming,
      shouldSetBadge: false,
    });
  },
});

export default function App() {
  const colorScheme = useColorScheme();
  const palette = useThemePalette(colorScheme);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const authLoading = useAuthStore((state) => state.loading);
  const user = useAuthStore((state) => state.user);
  const bootstrapAppLock = useAppLockStore((state) => state.bootstrap);
  const lockApp = useAppLockStore((state) => state.lock);
  const appLockLoading = useAppLockStore((state) => state.loading);
  const appLockEnabled = useAppLockStore((state) => state.enabled);
  const appLocked = useAppLockStore((state) => state.isLocked);
  const [currentRoute, setCurrentRoute] = useState<keyof RootStackParamList | null>(null);
  useSocketBridge();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    void bootstrapAppLock(user?.id ?? null);
  }, [bootstrapAppLock, user?.id]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.background);
  }, [palette.background]);

  useEffect(() => {
    const processUrl = async (url: string | null) => {
      if (!url) {
        return;
      }
      await handleIncomingLink(url);
    };

    void Linking.getInitialURL().then(processUrl);
    const subscription = Linking.addEventListener("url", (event) => {
      void processUrl(event.url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void initializeNotificationCategories();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = currentAppState;
      currentAppState = nextState;

      if (previousState === "active" && (nextState === "inactive" || nextState === "background")) {
        lockApp();
      }
    });

    return () => subscription.remove();
  }, [lockApp]);

  useEffect(() => {
    const handleNotificationResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const actionId = response.actionIdentifier;
      const incomingCall = parseIncomingCallNotification(response.notification.request.content.data);
      if (incomingCall) {
        callManager.hydrateIncomingCallFromNotification(incomingCall);
      }

      if (actionId === ANSWER_CALL_ACTION) {
        void callManager.acceptIncomingCall().then(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate("Call");
          }
        });
      } else if (actionId === DECLINE_CALL_ACTION) {
        void callManager.declineIncomingCall();
      } else if (incomingCall && navigationRef.isReady()) {
        navigationRef.navigate("Home");
      }
    };

    handleNotificationResponse(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
      Notifications.clearLastNotificationResponse();
    });

    return () => subscription.remove();
  }, []);

  if (authLoading || (user && appLockLoading)) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        onReady={() => {
          setCurrentRoute(navigationRef.getCurrentRoute()?.name ?? null);
          flushPendingLink();
        }}
        onStateChange={() => {
          setCurrentRoute(navigationRef.getCurrentRoute()?.name ?? null);
        }}
      >
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <AppNavigator />
        <IncomingCallModal />
        <OngoingCallBanner currentRoute={currentRoute} />
        <AppLockOverlay visible={Boolean(user && appLockEnabled && appLocked)} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
