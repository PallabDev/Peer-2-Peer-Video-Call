import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RTCView } from "react-native-webrtc";
import { useCallStore } from "../store/call-store";
import { callManager } from "../services/call-manager";
import { useThemePalette } from "../theme/useThemePalette";
import { navigationRef } from "../navigation/navigationRef";
import type { AudioRoute } from "../types/app";

const PREVIEW_WIDTH = 120;
const PREVIEW_HEIGHT = 170;
const PREVIEW_MARGIN = 16;
const BOTTOM_SAFE_ZONE = 136;

type ControlButtonProps = {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
};

type Point = {
  x: number;
  y: number;
};

type Bounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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

function getFirstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Call";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function getStatusLabel(status: string, direction: "incoming" | "outgoing") {
  switch (status) {
    case "ringing":
      return direction === "outgoing" ? "Calling..." : "Ringing...";
    case "incoming":
      return "Incoming call";
    case "connecting":
      return "Connecting...";
    case "connected":
      return "Connected";
    case "ended":
      return "Call ended";
    case "error":
      return "Connection issue";
    default:
      return "Preparing call";
  }
}

function clampPoint(point: Point, bounds: Bounds, fallback: Point) {
  const safeX = Number.isFinite(point.x) ? point.x : fallback.x;
  const safeY = Number.isFinite(point.y) ? point.y : fallback.y;

  return {
    x: Math.min(Math.max(safeX, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(safeY, bounds.minY), bounds.maxY),
  };
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
    encryptionStatus,
  } = useCallStore();

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [showControls, setShowControls] = useState(true);
  const [showAudioRouteMenu, setShowAudioRouteMenu] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewBounds = useMemo<Bounds>(() => {
    const minX = PREVIEW_MARGIN;
    const minY = Math.max(insets.top + 12, PREVIEW_MARGIN);
    const maxX = Math.max(minX, width - PREVIEW_WIDTH - PREVIEW_MARGIN);
    const maxY = Math.max(
      minY,
      height - PREVIEW_HEIGHT - Math.max(insets.bottom + BOTTOM_SAFE_ZONE, 110),
    );

    return { minX, maxX, minY, maxY };
  }, [height, insets.bottom, insets.top, width]);

  const defaultPreviewPosition = useMemo<Point>(() => ({
    x: previewBounds.maxX,
    y: previewBounds.maxY,
  }), [previewBounds.maxX, previewBounds.maxY]);

  const pan = useRef(new Animated.ValueXY(defaultPreviewPosition)).current;
  const previewPositionRef = useRef<Point>(defaultPreviewPosition);
  const previewStartRef = useRef<Point>(defaultPreviewPosition);
  const previewBoundsRef = useRef<Bounds>(previewBounds);
  const defaultPreviewPositionRef = useRef<Point>(defaultPreviewPosition);

  useEffect(() => {
    previewBoundsRef.current = previewBounds;
    defaultPreviewPositionRef.current = defaultPreviewPosition;
    const next = clampPoint(previewPositionRef.current, previewBounds, defaultPreviewPosition);
    previewPositionRef.current = next;
    pan.setValue(next);
  }, [defaultPreviewPosition, pan, previewBounds]);

  const pipPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,
    onPanResponderGrant: () => {
      previewStartRef.current = previewPositionRef.current;
    },
    onPanResponderMove: (_, gesture) => {
      const next = clampPoint({
        x: previewStartRef.current.x + gesture.dx,
        y: previewStartRef.current.y + gesture.dy,
      }, previewBoundsRef.current, defaultPreviewPositionRef.current);

      pan.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const next = clampPoint({
        x: previewStartRef.current.x + gesture.dx,
        y: previewStartRef.current.y + gesture.dy,
      }, previewBoundsRef.current, defaultPreviewPositionRef.current);

      previewPositionRef.current = next;
      Animated.spring(pan, {
        toValue: next,
        useNativeDriver: false,
        bounciness: 5,
      }).start();
    },
  }), [pan]);

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

  const firstName = getFirstName(activeCall.remoteUserName);
  const statusLabel = errorMessage ?? getStatusLabel(status, activeCall.direction);

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
            <Text style={styles.name}>{firstName}</Text>
            <Text style={styles.status}>{statusLabel}</Text>
          </View>
        )}

        <Pressable style={StyleSheet.absoluteFillObject} onPress={resetControlsTimeout} />

        {localStreamUrl && activeCall.mode === "video" ? (
          <Animated.View
            {...pipPanResponder.panHandlers}
            style={[styles.localPreview, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
          >
            <View style={styles.localPreviewFrame}>
              <RTCView
                key={`local-${localStreamUrl}-${cameraFacing}`}
                streamURL={localStreamUrl}
                style={StyleSheet.absoluteFillObject}
                objectFit="cover"
                mirror={cameraFacing === "front"}
                zOrder={2}
              />
            </View>
            <View style={styles.pipBadge}>
              <Text style={styles.pipBadgeText}>{cameraFacing === "front" ? "Front" : "Back"}</Text>
            </View>
            <Pressable
              style={styles.pipSwapButton}
              onPress={() => {
                resetControlsTimeout();
                callManager.switchCamera();
              }}
            >
              <Feather name="refresh-cw" size={18} color="#ffffff" />
            </Pressable>
          </Animated.View>
        ) : null}

        {showControls ? (
          <>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]} pointerEvents="none">
              <Text style={styles.remoteName}>{firstName}</Text>
              <Text style={styles.subtle}>{statusLabel}</Text>
              <Text
                style={[
                  styles.encryptionBadge,
                  encryptionStatus === "verified"
                    ? styles.encryptionBadgeVerified
                    : encryptionStatus === "unverified"
                      ? styles.encryptionBadgeUnverified
                      : styles.encryptionBadgeUnknown,
                ]}
              >
                {encryptionStatus === "verified"
                  ? "Encrypted call verified"
                  : encryptionStatus === "unverified"
                    ? "Encryption check failed"
                    : "Verifying encryption..."}
              </Text>
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
    fontSize: 32,
    fontWeight: "800",
  },
  status: {
    color: "#b8c7de",
    fontSize: 15,
    fontWeight: "600",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  remoteName: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },
  subtle: {
    color: "#b8c7de",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  encryptionBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  encryptionBadgeVerified: {
    color: "#052e16",
    backgroundColor: "#86efac",
  },
  encryptionBadgeUnverified: {
    color: "#7f1d1d",
    backgroundColor: "#fecaca",
  },
  encryptionBadgeUnknown: {
    color: "#dbeafe",
    backgroundColor: "rgba(30, 64, 175, 0.7)",
  },
  localPreview: {
    position: "absolute",
    top: 0,
    left: 0,
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    borderRadius: 24,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 4,
  },
  localPreviewFrame: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  pipBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  pipBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  pipSwapButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.52)",
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
