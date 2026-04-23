import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { FormInput } from "../components/FormInput";
import { PrimaryButton } from "../components/PrimaryButton";
import { useThemePalette } from "../theme/useThemePalette";
import { useAuthStore } from "../store/auth-store";
import { useAppLockStore } from "../store/app-lock-store";
import type { RootStackParamList } from "../navigation/navigationRef";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

function ToggleRow({
  label,
  description,
  checked,
  disabled = false,
  onPress,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const palette = useThemePalette(useColorScheme());

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.toggleRow,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={styles.toggleCopy}>
        <Text style={[styles.toggleLabel, { color: palette.text }]}>{label}</Text>
        <Text style={[styles.toggleDescription, { color: palette.textMuted }]}>{description}</Text>
      </View>
      <View
        style={[
          styles.toggleIndicator,
          {
            backgroundColor: checked ? palette.primary : palette.surfaceAlt,
            borderColor: checked ? palette.primary : palette.border,
          },
        ]}
      >
        {checked ? <Feather name="check" size={16} color="#ffffff" /> : null}
      </View>
    </Pressable>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const user = useAuthStore((state) => state.user);
  const {
    enabled,
    biometricAvailable,
    biometricLabel,
    biometricRequired,
    saveSettings,
    disable,
  } = useAppLockStore();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [requireBiometric, setRequireBiometric] = useState(biometricRequired);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setRequireBiometric(biometricRequired);
  }, [biometricRequired]);

  const saveLabel = enabled ? "Update app lock" : "Enable app lock";

  const handleSave = async () => {
    if (!user) {
      return;
    }

    const normalizedPin = pin.trim();
    const normalizedConfirmPin = confirmPin.trim();
    const isPinProvided = normalizedPin.length > 0 || normalizedConfirmPin.length > 0;

    if (!enabled && !/^\d{4}$/.test(normalizedPin)) {
      setError("Create a 4-digit PIN before enabling the app lock.");
      setMessage("");
      return;
    }

    if (isPinProvided) {
      if (!/^\d{4}$/.test(normalizedPin)) {
        setError("PIN must be exactly 4 digits.");
        setMessage("");
        return;
      }

      if (normalizedPin !== normalizedConfirmPin) {
        setError("PIN and confirmation PIN must match.");
        setMessage("");
        return;
      }
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await saveSettings(user.id, {
        pin: isPinProvided ? normalizedPin : undefined,
        biometricRequired: requireBiometric,
      });
      setPin("");
      setConfirmPin("");
      setMessage("App lock saved. The app will require your biometric check and PIN next time it locks.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save app lock settings.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!user) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await disable(user.id);
      setPin("");
      setConfirmPin("");
      setRequireBiometric(false);
      setMessage("App lock disabled for this signed-in user on this device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable app lock.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      title="Security Settings"
      subtitle="Add an app PIN and a biometric unlock step for this signed-in account on this device."
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Feather name="arrow-left" size={18} color={palette.textMuted} />
        <Text style={[styles.backText, { color: palette.textMuted }]}>Back</Text>
      </Pressable>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>App lock</Text>
        <Text style={[styles.sectionBody, { color: palette.textMuted }]}>
          {enabled
            ? "App lock is enabled. Leaving the PIN boxes blank keeps your current PIN."
            : "When enabled, this app will lock after backgrounding and require your secret PIN before it opens."}
        </Text>

        <FormInput
          label={enabled ? "New PIN (optional)" : "4-digit PIN"}
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

        <FormInput
          label={enabled ? "Confirm new PIN" : "Confirm PIN"}
          value={confirmPin}
          onChangeText={(value) => {
            setConfirmPin(value.replace(/\D/g, "").slice(0, 4));
            setError("");
          }}
          placeholder="0000"
          secureTextEntry
          keyboardType="number-pad"
          maxLength={4}
        />

        <ToggleRow
          label={`Require ${biometricLabel}`}
          description={
            biometricAvailable
              ? `Unlock will ask for ${biometricLabel} before the app PIN.`
              : "Biometric unlock is not available on this device right now."
          }
          checked={requireBiometric && biometricAvailable}
          disabled={!biometricAvailable}
          onPress={() => setRequireBiometric((current) => !current)}
        />

        {error ? <Text style={[styles.feedback, { color: palette.danger }]}>{error}</Text> : null}
        {message ? <Text style={[styles.feedback, { color: palette.success }]}>{message}</Text> : null}

        <PrimaryButton
          label={submitting ? "Saving..." : saveLabel}
          onPress={handleSave}
          disabled={submitting}
        />

        {enabled ? (
          <PrimaryButton
            label={submitting ? "Please wait..." : "Disable app lock"}
            onPress={handleDisable}
            variant="danger"
            disabled={submitting}
          />
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Important note</Text>
        <Text style={[styles.sectionBody, { color: palette.textMuted }]}>
          This protects access to Callie on this device. It does not replace call encryption, and it cannot stop the person you call from seeing the video you intentionally send them.
        </Text>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  toggleIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  feedback: {
    fontSize: 14,
    fontWeight: "600",
  },
});
