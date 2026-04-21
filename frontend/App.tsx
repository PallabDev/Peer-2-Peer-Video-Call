import "expo-dev-client";
import "react-native-gesture-handler";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import * as SystemUI from "expo-system-ui";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { navigationRef } from "./src/navigation/navigationRef";
import { useAuthStore } from "./src/store/auth-store";
import { useSocketBridge } from "./src/hooks/useSocketBridge";
import { useThemePalette } from "./src/theme/useThemePalette";
import { handleIncomingLink } from "./src/utils/linking";
import { IncomingCallModal } from "./src/components/IncomingCallModal";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const colorScheme = useColorScheme();
  const palette = useThemePalette(colorScheme);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  useSocketBridge();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

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

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
        theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}
      >
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <AppNavigator />
        <IncomingCallModal />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
