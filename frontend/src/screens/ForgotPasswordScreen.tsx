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

  return (
    <ScreenShell title="Reset password" subtitle="We will send a reset link to your email.">
      <FormInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      {message ? <Text style={[styles.message, { color: palette.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      <PrimaryButton
        label="Send reset link"
        onPress={async () => {
          try {
            setError("");
            const response = await authApi.forgotPassword(email);
            setMessage(response.message);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not send reset link.");
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
