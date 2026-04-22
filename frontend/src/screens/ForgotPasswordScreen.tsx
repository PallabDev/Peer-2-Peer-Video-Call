import { useState } from "react";
import { StyleSheet, Text, useColorScheme } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { FormInput } from "../components/FormInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { authApi } from "../services/auth";
import { useThemePalette } from "../theme/useThemePalette";
import type { RootStackParamList } from "../navigation/navigationRef";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export function ForgotPasswordScreen({ navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <ScreenShell
      title="Forgot your password?"
      subtitle="Enter your email and we will send a reset link that opens the app directly."
    >
      <FormInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      {message ? <Text style={[styles.message, { color: palette.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      <PrimaryButton
        label={submitting ? "Sending..." : "Send reset link"}
        disabled={submitting || !email.trim()}
        onPress={async () => {
          try {
            setSubmitting(true);
            setError("");
            setMessage("");
            const response = await authApi.forgotPassword(email);
            setMessage(response.message);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send reset link.");
          } finally {
            setSubmitting(false);
          }
        }}
      />
      <PrimaryButton label="Back" variant="secondary" onPress={() => navigation.goBack()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
  },
});
