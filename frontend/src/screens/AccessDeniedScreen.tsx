import { Text, useColorScheme } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuthStore } from "../store/auth-store";
import { useThemePalette } from "../theme/useThemePalette";

export function AccessDeniedScreen() {
  const palette = useThemePalette(useColorScheme());
  const { user, logout, refreshUser } = useAuthStore();

  return (
    <ScreenShell
      title="Access denied"
      subtitle="Your account exists, but the admin has not approved app access yet."
    >
      <Text style={{ color: palette.text }}>
        Status: {user?.accessStatus ?? "pending"}
      </Text>
      <PrimaryButton label="Refresh status" onPress={refreshUser} />
      <PrimaryButton label="Sign out" variant="secondary" onPress={logout} />
    </ScreenShell>
  );
}
