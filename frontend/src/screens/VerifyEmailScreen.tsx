import { useState } from "react";
import { StyleSheet, Text, useColorScheme } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuthStore } from "../store/auth-store";
import { authApi } from "../services/auth";
import { useThemePalette } from "../theme/useThemePalette";

export function VerifyEmailScreen() {
  const palette = useThemePalette(useColorScheme());
  const { user, logout, refreshUser } = useAuthStore();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <ScreenShell
      title="Verify your email"
      subtitle="Before the app can request approval or connect for calls, your email must be verified."
    >
      <Text style={[styles.email, { color: palette.text }]}>{user?.email}</Text>
      {message ? <Text style={[styles.message, { color: palette.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      <PrimaryButton
        label="Resend verification email"
        onPress={async () => {
          try {
            setError("");
            if (!user?.email) {
              return;
            }
            const response = await authApi.resendVerification(user.email);
            setMessage(response.message);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not resend verification.");
          }
        }}
      />
      <PrimaryButton
        label="I already verified"
        variant="secondary"
        onPress={async () => {
          try {
            await refreshUser();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not refresh account.");
          }
        }}
      />
      <PrimaryButton label="Sign out" variant="danger" onPress={logout} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  email: {
    fontSize: 18,
    fontWeight: "700",
  },
  message: {
    fontSize: 14,
  },
});
