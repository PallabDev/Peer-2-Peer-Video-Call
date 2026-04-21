import { useState } from "react";
import { StyleSheet, Text, useColorScheme } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { FormInput } from "../components/FormInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { authApi } from "../services/auth";
import { useThemePalette } from "../theme/useThemePalette";
import type { RootStackParamList } from "../navigation/navigationRef";

type Props = NativeStackScreenProps<RootStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ route, navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const [token, setToken] = useState(route.params?.token ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <ScreenShell title="Choose a new password" subtitle="Use the reset token from your email link.">
      <FormInput label="Token" value={token} onChangeText={setToken} placeholder="Reset token" />
      <FormInput label="New password" value={password} onChangeText={setPassword} placeholder="Strong password" secureTextEntry />
      {message ? <Text style={[styles.message, { color: palette.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      <PrimaryButton
        label="Update password"
        onPress={async () => {
          try {
            setError("");
            const response = await authApi.resetPassword(token, password);
            setMessage(response.message);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update password.");
          }
        }}
      />
      <PrimaryButton label="Back to sign in" variant="secondary" onPress={() => navigation.navigate("SignIn")} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
  },
});
