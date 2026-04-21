import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { FormInput } from "../components/FormInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuthStore } from "../store/auth-store";
import { useThemePalette } from "../theme/useThemePalette";
import type { RootStackParamList } from "../navigation/navigationRef";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <ScreenShell
      title="Secure calls"
      subtitle="Email-password sign in, admin approval, and direct audio-video calling."
    >
      <FormInput label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
      <FormInput label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry />
      {error ? <Text style={[styles.error, { color: palette.danger }]}>{error}</Text> : null}
      <PrimaryButton
        label="Sign in"
        onPress={async () => {
          try {
            setError("");
            await login({ email, password });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not sign in.");
          }
        }}
      />
      <View style={styles.links}>
        <Pressable onPress={() => navigation.navigate("SignUp")}>
          <Text style={[styles.link, { color: palette.primary }]}>Create account</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
          <Text style={[styles.link, { color: palette.primary }]}>Forgot password</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    fontSize: 14,
  },
  links: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  link: {
    fontSize: 14,
    fontWeight: "700",
  },
});
