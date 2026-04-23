import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={[styles.headerBar, { borderBottomColor: palette.border }]}>
        <View style={styles.headerTitleWrap}>
          <Feather name="shield" size={24} color={palette.primary} />
          <Text style={[styles.headerTitle, { color: palette.text }]}>Callie</Text>
        </View>

        <View style={styles.headerActions}>
          {user?.role === "admin" ? (
            <Pressable onPress={() => navigation.navigate("Admin")} style={styles.actionIcon}>
              <Feather name="settings" size={20} color={palette.textMuted} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => void loadContacts()} style={styles.actionIcon}>
            <Feather name="refresh-cw" size={20} color={palette.textMuted} />
          </Pressable>
          <Pressable onPress={() => void logout()} style={styles.actionIcon}>
            <Feather name="log-out" size={20} color={palette.danger} />
          </Pressable>
        </View>
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
          <Text style={[styles.emptyState, { color: palette.textMuted }]}>
            No online contacts found.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  actionIcon: {
    padding: 4,
  },
  list: {
    gap: 14,
    paddingHorizontal: 20,
  },
  emptyState: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 15,
  },
});
