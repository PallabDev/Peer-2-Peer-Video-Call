import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useThemePalette } from "../theme/useThemePalette";
import type { Contact } from "../types/app";

type Props = {
  contact: Contact;
  onAudioPress: () => void | Promise<void>;
  onVideoPress: () => void | Promise<void>;
};

export function ContactCard({ contact, onAudioPress, onVideoPress }: Props) {
  const palette = useThemePalette(useColorScheme());
  const initials = `${contact.firstName[0] ?? ""}${contact.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          shadowColor: palette.shadow,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: palette.primaryMuted }]}>
        <Text style={[styles.avatarText, { color: palette.primary }]}>{initials || "C"}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: palette.text }]}>
          {contact.firstName} {contact.lastName ?? ""}
        </Text>
        <Text style={[styles.email, { color: palette.textMuted }]}>{contact.email}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => void onAudioPress()} style={[styles.iconButton, { backgroundColor: palette.surfaceAlt }]}>
          <Text style={{ color: palette.text }}>A</Text>
        </Pressable>
        <Pressable onPress={() => void onVideoPress()} style={[styles.iconButton, { backgroundColor: palette.primary }]}>
          <Text style={{ color: "#ffffff" }}>V</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  email: {
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
