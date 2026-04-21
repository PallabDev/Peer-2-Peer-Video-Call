import { Modal, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useCallStore } from "../store/call-store";
import { useThemePalette } from "../theme/useThemePalette";
import { PrimaryButton } from "./PrimaryButton";
import { callManager } from "../services/call-manager";
import { navigationRef } from "../navigation/navigationRef";

export function IncomingCallModal() {
  const palette = useThemePalette(useColorScheme());
  const incomingCall = useCallStore((state) => state.incomingCall);

  if (!incomingCall) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.badge, { color: palette.primary }]}>
            {incomingCall.mode === "video" ? "Incoming video call" : "Incoming audio call"}
          </Text>
          <Text style={[styles.name, { color: palette.text }]}>{incomingCall.remoteUserName}</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>Secure peer-to-peer connection</Text>
          <View style={styles.actions}>
            <PrimaryButton
              label="Decline"
              variant="secondary"
              onPress={() => void callManager.declineIncomingCall()}
            />
            <PrimaryButton
              label="Answer"
              onPress={async () => {
                await callManager.acceptIncomingCall();
                if (navigationRef.isReady()) {
                  navigationRef.navigate("Call");
                }
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(6, 12, 20, 0.72)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 24,
    gap: 10,
  },
  badge: {
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  name: {
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 12,
  },
  actions: {
    gap: 12,
  },
});
