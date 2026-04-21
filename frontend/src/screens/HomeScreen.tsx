import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { useThemePalette } from "../theme/useThemePalette";
import { useAuthStore } from "../store/auth-store";
import { apiRequest } from "../api/client";
import type { Contact } from "../types/app";
import { ContactCard } from "../components/ContactCard";
import { callManager } from "../services/call-manager";
import type { RootStackParamList } from "../navigation/navigationRef";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const { user, logout } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState("");

  const loadContacts = async () => {
    try {
      setError("");
      const response = await apiRequest<Contact[]>("/api/users/contacts");
      setContacts(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load contacts.");
    }
  };

  useEffect(() => {
    void loadContacts();
  }, []);

  return (
    <ScreenShell
      title={`Hello, ${user?.firstName ?? "there"}`}
      subtitle="Approved members can place direct secure audio or video calls."
    >
      <View style={styles.headerBar}>
        <Pressable onPress={() => void loadContacts()}>
          <Text style={[styles.link, { color: palette.primary }]}>Refresh</Text>
        </Pressable>
        {user?.role === "admin" ? (
          <Pressable onPress={() => navigation.navigate("Admin")}>
            <Text style={[styles.link, { color: palette.primary }]}>Admin</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => void logout()}>
          <Text style={[styles.link, { color: palette.danger }]}>Logout</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}

      <View style={styles.list}>
        {contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            contact={contact}
            onAudioPress={async () => {
              try {
                setError("");
                await callManager.startOutgoingCall(contact, "audio");
                navigation.navigate("Call");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not start audio call.");
              }
            }}
            onVideoPress={async () => {
              try {
                setError("");
                await callManager.startOutgoingCall(contact, "video");
                navigation.navigate("Call");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not start video call.");
              }
            }}
          />
        ))}
        {!contacts.length ? (
          <Text style={{ color: palette.textMuted }}>
            No approved contacts yet. Ask the admin to approve users from the dashboard.
          </Text>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  link: {
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    gap: 14,
  },
});
