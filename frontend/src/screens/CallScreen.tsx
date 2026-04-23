import { useEffect, useState, useRef, useCallback } from "react";
import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, useColorScheme, Animated, PanResponder } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RTCView } from "react-native-webrtc";
import { useCallStore } from "../store/call-store";
import { callManager } from "../services/call-manager";
import { useThemePalette } from "../theme/useThemePalette";
import { navigationRef } from "../navigation/navigationRef";
import type { AudioRoute } from "../types/app";

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

function getAudioRouteLabel(route: AudioRoute, bluetoothDeviceName: string | null) {
  switch (route) {
    case "BLUETOOTH":
      return bluetoothDeviceName || "Bluetooth audio";
    case "WIRED_HEADSET":
      return "Headset audio";
    case "SPEAKER_PHONE":
      return "Speaker audio";
    case "EARPIECE":
      return "Phone audio";
    default:
      return "Connecting audio";
  }
}

function getAudioButtonIcon(route: AudioRoute): keyof typeof Feather.glyphMap {
  switch (route) {
    case "BLUETOOTH":
      return "bluetooth";
    case "WIRED_HEADSET":
      return "headphones";
    default:
      return "volume-2";
  }
}

function getAudioRouteOptions(availableRoutes: AudioRoute[], bluetoothDeviceName: string | null) {
  const options: Array<{ route: AudioRoute; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { route: "EARPIECE", label: "Phone", icon: "smartphone" },
    { route: "SPEAKER_PHONE", label: "Speaker", icon: "volume-2" },
  ];

  if (availableRoutes.includes("WIRED_HEADSET")) {
    options.push({ route: "WIRED_HEADSET", label: "Wired headset", icon: "headphones" });
  }

  if (availableRoutes.includes("BLUETOOTH")) {
    options.push({ route: "BLUETOOTH", label: bluetoothDeviceName || "Bluetooth device", icon: "bluetooth" });
  }

  return options;
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
    activeAudioRoute,
    availableAudioRoutes,
    bluetoothDeviceName,
    cameraFacing,
    errorMessage,
  } = useCallStore();

  const insets = useSafeAreaInsets();

  const [showControls, setShowControls] = useState(true);
  const [showAudioRouteMenu, setShowAudioRouteMenu] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const pipPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    setShowAudioRouteMenu(false);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowAudioRouteMenu(false);
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

  const hasAudioRoutePicker = availableAudioRoutes.includes("BLUETOOTH") || availableAudioRoutes.includes("WIRED_HEADSET");
  const audioRouteOptions = getAudioRouteOptions(availableAudioRoutes, bluetoothDeviceName);

  const handleAudioButtonPress = () => {
    resetControlsTimeout();
    if (hasAudioRoutePicker) {
      setShowAudioRouteMenu((current) => !current);
      return;
    }

    void callManager.toggleSpeaker();
  };

  if (!activeCall) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: "#040811" }]} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: "#040811" }]}>
      <View style={styles.fill}>
        {remoteStreamUrl && activeCall.mode === "video" ? (
          <RTCView
            key={`remote-${remoteStreamUrl}`}
            streamURL={remoteStreamUrl}
            style={StyleSheet.absoluteFillObject}
            objectFit="cover"
            zOrder={0}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.name}>{activeCall.remoteUserName}</Text>
            <Text style={styles.status}>{errorMessage ?? status}</Text>
            <Text style={styles.securityNote}>Padlock \uD83D\uDD12 End-to-End Encrypted</Text>
          </View>
        )}

        <Pressable style={StyleSheet.absoluteFillObject} onPress={resetControlsTimeout} />

        {localStreamUrl && activeCall.mode === "video" ? (
          <Animated.View
            {...pipPanResponder.panHandlers}
            style={[styles.localPreview, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
          >
            <RTCView
              key={`local-${localStreamUrl}-${cameraFacing}`}
              streamURL={localStreamUrl}
              style={StyleSheet.absoluteFillObject}
              objectFit="cover"
              mirror={cameraFacing === "front"}
              zOrder={2}
            />
            <Pressable 
              style={styles.pipSwapButton}
              onPress={() => callManager.switchCamera()}
            >
              <Feather name="refresh-cw" size={18} color="#ffffff" />
            </Pressable>
          </Animated.View>
        ) : null}

        {showControls ? (
          <>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]} pointerEvents="none">
              <Text style={styles.remoteName}>{activeCall.remoteUserName}</Text>
              <Text style={styles.subtle}>
                {activeCall.mode === "video" ? "Video call" : "Audio call"} - {status}
              </Text>
              <Text style={styles.routeLabel}>{getAudioRouteLabel(activeAudioRoute, bluetoothDeviceName)}</Text>
              <Text style={styles.securityNote}>Padlock \uD83D\uDD12 End-to-End Encrypted</Text>
            </View>

            {showAudioRouteMenu ? (
              <View style={[styles.audioRouteMenu, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                {audioRouteOptions.map((option) => (
                  <Pressable
                    key={option.route}
                    style={styles.menuItem}
                    onPress={() => {
                      void callManager.selectAudioRoute(option.route);
                      setShowAudioRouteMenu(false);
                    }}
                  >
                    <Feather name={option.icon} size={20} color={palette.text} />
                    <Text style={[styles.menuText, { color: palette.text }]}>{option.label}</Text>
                    {activeAudioRoute === option.route ? (
                      <Feather name="check" size={18} color={palette.primary} style={styles.menuCheck} />
                    ) : null}
                  </Pressable>
                ))}
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
                icon={getAudioButtonIcon(activeAudioRoute)}
                onPress={handleAudioButtonPress}
                active={activeAudioRoute === "SPEAKER_PHONE" || showAudioRouteMenu}
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
  routeLabel: {
    color: "#d8e7ff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  localPreview: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 110,
    height: 160,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    backgroundColor: "#1e293b",
    zIndex: 4,
  },
  pipSwapButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 16,
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
  audioRouteMenu: {
    position: "absolute",
    bottom: 90,
    left: 28,
    right: 28,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
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
    flex: 1,
  },
  menuCheck: {
    marginLeft: "auto",
  },
});
