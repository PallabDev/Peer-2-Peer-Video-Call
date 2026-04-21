import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RTCView } from "react-native-webrtc";
import { useCallStore } from "../store/call-store";
import { callManager } from "../services/call-manager";
import { PrimaryButton } from "../components/PrimaryButton";
import { useThemePalette } from "../theme/useThemePalette";

export function CallScreen() {
  const palette = useThemePalette(useColorScheme());
  const {
    activeCall,
    localStreamUrl,
    remoteStreamUrl,
    status,
    isMuted,
    isVideoEnabled,
    errorMessage,
  } = useCallStore();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: "#040811" }]}>
      <View style={styles.fill}>
        {remoteStreamUrl && activeCall?.mode === "video" ? (
          <RTCView streamURL={remoteStreamUrl} style={StyleSheet.absoluteFillObject} objectFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.name}>{activeCall?.remoteUserName ?? "Connecting"}</Text>
            <Text style={styles.status}>{errorMessage ?? status}</Text>
          </View>
        )}

        {localStreamUrl && activeCall?.mode === "video" ? (
          <RTCView streamURL={localStreamUrl} style={styles.localPreview} objectFit="cover" />
        ) : null}

        <View style={styles.header}>
          <Text style={styles.remoteName}>{activeCall?.remoteUserName ?? "Call"}</Text>
          <Text style={styles.subtle}>
            {activeCall?.mode === "video" ? "Video call" : "Audio call"} • {status}
          </Text>
        </View>

        <View style={[styles.toolbar, { backgroundColor: palette.surface }]}>
          <PrimaryButton label={isMuted ? "Unmute" : "Mute"} variant="secondary" onPress={() => void callManager.toggleMute()} />
          {activeCall?.mode === "video" ? (
            <>
              <PrimaryButton label={isVideoEnabled ? "Video off" : "Video on"} variant="secondary" onPress={() => void callManager.toggleVideo()} />
              <PrimaryButton label="Swap" variant="secondary" onPress={() => callManager.switchCamera()} />
            </>
          ) : null}
          <PrimaryButton label="End" variant="danger" onPress={() => void callManager.endCurrentCall()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
    justifyContent: "space-between",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  name: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },
  status: {
    color: "#9fb0c8",
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  remoteName: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  subtle: {
    color: "#9fb0c8",
    fontSize: 14,
    marginTop: 4,
  },
  localPreview: {
    position: "absolute",
    top: 110,
    right: 18,
    width: 110,
    height: 160,
    borderRadius: 22,
    overflow: "hidden",
    zIndex: 2,
  },
  toolbar: {
    margin: 18,
    padding: 14,
    borderRadius: 28,
    gap: 10,
  },
});
