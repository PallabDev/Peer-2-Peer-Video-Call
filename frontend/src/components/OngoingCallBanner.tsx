import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/navigationRef";
import { navigationRef } from "../navigation/navigationRef";
import { useCallStore } from "../store/call-store";
import { useThemePalette } from "../theme/useThemePalette";

type Props = {
  currentRoute: keyof RootStackParamList | null;
};

function getFirstName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Call";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function getStatusLabel(status: string) {
  switch (status) {
    case "ringing":
      return "Calling...";
    case "connecting":
      return "Rejoin call";
    case "connected":
      return "Tap to return to the call";
    default:
      return "Return to the call";
  }
}

export function OngoingCallBanner({ currentRoute }: Props) {
  const palette = useThemePalette(useColorScheme());
  const insets = useSafeAreaInsets();
  const activeCall = useCallStore((state) => state.activeCall);
  const status = useCallStore((state) => state.status);

  if (!activeCall || currentRoute === "Call") {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <Pressable
        onPress={() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate("Call");
          }
        }}
        style={[
          styles.banner,
          {
            top: Math.max(insets.top, 12),
            backgroundColor: palette.surface,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: palette.primaryMuted }]}>
          <Feather name="phone-call" size={18} color={palette.primary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {getFirstName(activeCall.remoteUserName)}
          </Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]} numberOfLines={1}>
            {getStatusLabel(status)}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={palette.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  banner: {
    position: "absolute",
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
  },
});
