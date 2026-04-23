import { useEffect, useMemo, useState } from "react";
import * as LocalAuthentication from "expo-local-authentication";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { PrimaryButton } from "./PrimaryButton";
import { FormInput } from "./FormInput";
import { useThemePalette } from "../theme/useThemePalette";
import { useAppLockStore } from "../store/app-lock-store";
import { useAuthStore } from "../store/auth-store";

type Props = {
  visible: boolean;
};

export function AppLockOverlay({ visible }: Props) {
  const palette = useThemePalette(useColorScheme());
  const user = useAuthStore((state) => state.user);
  const verifyPin = useAppLockStore((state) => state.verifyPin);
  const unlock = useAppLockStore((state) => state.unlock);
  const biometricRequired = useAppLockStore((state) => state.biometricRequired);
  const biometricLabel = useAppLockStore((state) => state.biometricLabel);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [biometricVerified, setBiometricVerified] = useState(!biometricRequired);

  const unlockReady = useMemo(
    () => !biometricRequired || biometricVerified,
    [biometricRequired, biometricVerified],
  );

  useEffect(() => {
    if (!visible) {
      setPin("");
      setError("");
      setSubmitting(false);
      setBiometricVerified(!biometricRequired);
      return;
    }

    setPin("");
    setError("");
    setSubmitting(false);
    setBiometricVerified(!biometricRequired);
  }, [biometricRequired, visible]);

  useEffect(() => {
    if (!visible || !biometricRequired) {
      return;
    }

    void handleBiometricCheck();
  }, [biometricRequired, visible]);

  if (!visible || !user) {
    return null;
  }

  async function handleBiometricCheck() {
    setError("");

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Verify your identity",
      cancelLabel: "Use app PIN",
      disableDeviceFallback: true,
      biometricsSecurityLevel: "strong",
    });

    if (result.success) {
      setBiometricVerified(true);
      return;
    }

    setBiometricVerified(false);
    if (result.error !== "user_cancel" && result.error !== "system_cancel") {
      setError(`Could not verify ${biometricLabel}. Use your app PIN after retrying biometrics.`);
    }
  }

async function handleUnlock() {
    if (!user) {
      return;
    }

    if (!unlockReady) {
      setError(`Verify ${biometricLabel} before entering the app PIN.`);
      return;
    }

    const normalizedPin = pin.trim();
    if (!/^\d{4}$/.test(normalizedPin)) {
      setError("Enter your 4-digit app PIN.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const isValid = await verifyPin(user.id, normalizedPin);
      if (!isValid) {
        setError("That PIN is incorrect.");
        return;
      }

      unlock();
      setPin("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.overlay, { backgroundColor: palette.background }]}>
      <View style={styles.shell}>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.primaryMuted }]}>
            <Feather name="lock" size={28} color={palette.primary} />
          </View>

          <Text style={[styles.title, { color: palette.text }]}>Unlock Callie</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            This app is locked for {user.firstName}. Complete the checks below to continue.
          </Text>

          {biometricRequired ? (
            <View style={[styles.stepCard, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
              <Text style={[styles.stepTitle, { color: palette.text }]}>Step 1</Text>
              <Text style={[styles.stepBody, { color: palette.textMuted }]}>
                Verify your {biometricLabel} before the PIN unlock step.
              </Text>
              <PrimaryButton
                label={biometricVerified ? "Biometric verified" : `Verify ${biometricLabel}`}
                onPress={handleBiometricCheck}
                variant={biometricVerified ? "secondary" : "primary"}
              />
            </View>
          ) : null}

          <View style={[styles.stepCard, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
            <Text style={[styles.stepTitle, { color: palette.text }]}>
              {biometricRequired ? "Step 2" : "Unlock"}
            </Text>
            <Text style={[styles.stepBody, { color: palette.textMuted }]}>
              Enter the 4-digit app PIN for this account.
            </Text>
            <FormInput
              label="App PIN"
              value={pin}
              onChangeText={(value) => {
                setPin(value.replace(/\D/g, "").slice(0, 4));
                setError("");
              }}
              placeholder="0000"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          {error ? <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text> : null}

          <PrimaryButton
            label={submitting ? "Unlocking..." : "Unlock app"}
            onPress={handleUnlock}
            disabled={submitting}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  shell: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    gap: 16,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  stepCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  stepBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
