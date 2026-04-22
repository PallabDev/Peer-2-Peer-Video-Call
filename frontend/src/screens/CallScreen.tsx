import { useEffect, useState, useRef, useCallback } from "react";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RTCView } from "react-native-webrtc";
import { useCallStore } from "../store/call-store";
import { callManager } from "../services/call-manager";
import { useThemePalette } from "../theme/useThemePalette";
import { navigationRef } from "../navigation/navigationRef";

type ControlButtonProps = {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
};

function ControlButton({ icon, onPress, active = false, danger = false }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.iconButton,
        active ? styles.iconButtonActive : null,
        danger ? styles.iconButtonDanger : null,
      ]}
    >
      <Feather
        name={icon}
        size={24}
        color={active || danger ? "#ffffff" : "#111827"}
      />
    </Pressable>
  );
}

export function CallScreen() {
  const palette = useThemePalette(useColorScheme());
  const {
    activeCall,
    localStreamUrl,
    remoteStreamUrl,
    status,
    isMuted,
    isVideoEnabled,
    isSpeakerOn,
    errorMessage,
  } = useCallStore();

  const [showControls, setShowControls] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    setShowMoreMenu(false);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowMoreMenu(false);
    }, 5000);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  useEffect(() => {
    if (activeCall || !navigationRef.isReady() || navigationRef.getCurrentRoute()?.name !== "Call") {
      return;
    }

    if (navigationRef.canGoBack()) {
      navigationRef.goBack();
      return;
    }

    navigationRef.navigate("Home");
  }, [activeCall]);

  if (!activeCall) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: "#040811" }]} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: "#040811" }]}>
      <View style={styles.fill}>
        {remoteStreamUrl && activeCall.mode === "video" ? (
          <RTCView streamURL={remoteStreamUrl} style={StyleSheet.absoluteFillObject} objectFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.name}>{activeCall.remoteUserName}</Text>
            <Text style={styles.status}>{errorMessage ?? status}</Text>
            <Text style={styles.securityNote}>Padlock \uD83D\uDD12 End-to-End Encrypted</Text>
          </View>
        )}

        {localStreamUrl && activeCall.mode === "video" ? (
          <RTCView streamURL={localStreamUrl} style={styles.localPreview} objectFit="cover" />
        ) : null}

        <Pressable style={StyleSheet.absoluteFillObject} onPress={resetControlsTimeout} />

        {showControls ? (
          <>
            <View style={styles.header} pointerEvents="none">
              <Text style={styles.remoteName}>{activeCall.remoteUserName}</Text>
              <Text style={styles.subtle}>
                {activeCall.mode === "video" ? "Video call" : "Audio call"} - {status}
              </Text>
              <Text style={styles.securityNote}>Padlock \uD83D\uDD12 End-to-End Encrypted</Text>
            </View>

            {showMoreMenu ? (
              <View style={[styles.moreMenu, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                {activeCall.mode === "video" ? (
                  <Pressable style={styles.menuItem} onPress={() => { callManager.switchCamera(); setShowMoreMenu(false); }}>
                    <Feather name="refresh-cw" size={20} color={palette.text} />
                    <Text style={[styles.menuText, { color: palette.text }]}>Swap Camera</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.menuItem} onPress={() => { void callManager.toggleSpeaker(); setShowMoreMenu(false); }}>
                  <Feather name={isSpeakerOn ? "volume-x" : "volume-2"} size={20} color={palette.text} />
                  <Text style={[styles.menuText, { color: palette.text }]}>{isSpeakerOn ? "Speaker Off" : "Speaker On"}</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={[styles.toolbar, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <ControlButton
                icon={isMuted ? "mic-off" : "mic"}
                onPress={() => void callManager.toggleMute()}
                active={isMuted}
              />
              {activeCall.mode === "video" ? (
                <ControlButton
                  icon={!isVideoEnabled ? "video-off" : "video"}
                  onPress={() => void callManager.toggleVideo()}
                  active={!isVideoEnabled}
                />
              ) : null}
              <ControlButton
                icon="more-vertical"
                onPress={() => setShowMoreMenu(!showMoreMenu)}
                active={showMoreMenu}
              />
              <ControlButton
                icon="phone-off"
                onPress={() => void callManager.endCurrentCall()}
                danger
              />
            </View>
          </>
        ) : null}
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
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
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
  securityNote: {
    color: "#d8e7ff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
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
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 40,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  iconButton: {
    minHeight: 54,
    minWidth: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e8eef7",
  },
  iconButtonActive: {
    backgroundColor: "#1d8bff",
  },
  iconButtonDanger: {
    backgroundColor: "#ff5a5f",
  },
  moreMenu: {
    position: "absolute",
    bottom: 90,
    right: 28,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    width: 200,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
