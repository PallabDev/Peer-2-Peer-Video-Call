import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, useColorScheme } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { FormInput } from "../components/FormInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { authApi } from "../services/auth";
import { useThemePalette } from "../theme/useThemePalette";
import type { RootStackParamList } from "../navigation/navigationRef";
import { useAuthStore } from "../store/auth-store";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ route, navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const logout = useAuthStore((state) => state.logout);
  const [token, setToken] = useState(route.params?.token ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const hasLinkedToken = Boolean(route.params?.token);

  useEffect(() => {
    if (route.params?.token) {
      setToken(route.params.token);
    }
  }, [route.params?.token]);

  const passwordHint = useMemo(
    () => "Use at least 8 characters with an uppercase letter, lowercase letter, and number.",
    []
  );

  return (
    <ScreenShell
      title="Create a new password"
      subtitle={hasLinkedToken ? "You opened the reset link from your email. Set a new password below." : "Paste your reset token from the email, then choose a new password."}
    >
      {!hasLinkedToken ? (
        <FormInput label="Reset token" value={token} onChangeText={setToken} placeholder="Paste the token from your email" />
      ) : null}
      <FormInput label="New password" value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry />
      <FormInput label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry />
      <Text style={[styles.helper, { color: palette.textMuted }]}>{passwordHint}</Text>
      {message ? <Text style={[styles.message, { color: palette.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      <PrimaryButton
        label={submitting ? "Updating..." : "Update password"}
        disabled={submitting || !token.trim() || !password || !confirmPassword}
        onPress={async () => {
          try {
            if (password !== confirmPassword) {
              setError("Passwords do not match.");
              return;
            }

            setSubmitting(true);
            setError("");
            setMessage("");
            const response = await authApi.resetPassword(token, password);
            setMessage(response.message);
            setPassword("");
            setConfirmPassword("");
            await logout();
            navigation.navigate("SignIn");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update password.");
          } finally {
            setSubmitting(false);
          }
        }}
      />
      <PrimaryButton label="Back to sign in" variant="secondary" onPress={() => navigation.navigate("SignIn")} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  helper: {
    fontSize: 13,
    lineHeight: 19,
  },
  message: {
    fontSize: 14,
  },
});
