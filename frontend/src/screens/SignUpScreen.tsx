import { useState } from "react";
import { StyleSheet, Text, useColorScheme } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { FormInput } from "../components/FormInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuthStore } from "../store/auth-store";
import { useThemePalette } from "../theme/useThemePalette";
import type { RootStackParamList } from "../navigation/navigationRef";

type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

export function SignUpScreen({ navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const register = useAuthStore((state) => state.register);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <ScreenShell
      title="Create account"
      subtitle="You sign up first. The backend decides role and the admin decides access."
    >
      <FormInput label="First name" value={firstName} onChangeText={setFirstName} placeholder="Aarav" autoCapitalize="words" />
      <FormInput label="Last name" value={lastName} onChangeText={setLastName} placeholder="Sharma" autoCapitalize="words" />
      <FormInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      <FormInput label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 chars, upper, lower, number" secureTextEntry />
      {message ? <Text style={[styles.message, { color: palette.success }]}>{message}</Text> : null}
      {error ? <Text style={[styles.message, { color: palette.danger }]}>{error}</Text> : null}
      <PrimaryButton
        label="Create account"
        onPress={async () => {
          try {
            setError("");
            const responseMessage = await register({ firstName, lastName, email, password });
            setMessage(responseMessage);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create account.");
          }
        }}
      />
      <PrimaryButton label="Back to sign in" variant="secondary" onPress={() => navigation.goBack()} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
  },
});
