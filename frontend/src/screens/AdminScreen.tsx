import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenShell } from "../components/ScreenShell";
import { apiRequest } from "../api/client";
import { useThemePalette } from "../theme/useThemePalette";
import type { RootStackParamList } from "../navigation/navigationRef";
import type { User } from "../types/app";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;

export function AdminScreen({ navigation }: Props) {
  const palette = useThemePalette(useColorScheme());
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  const loadUsers = async () => {
    try {
      setError("");
      const response = await apiRequest<User[]>("/api/admin/users");
      setUsers(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    }
  };

  const updateUser = async (userId: string, patch: Partial<Pick<User, "role" | "accessStatus">>) => {
    try {
      await apiRequest<User>(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user.");
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <ScreenShell title="Admin dashboard" subtitle="Approve access, deny access, or promote admins.">
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={[styles.link, { color: palette.primary }]}>Back</Text>
      </Pressable>
      {error ? <Text style={{ color: palette.danger }}>{error}</Text> : null}

      <View style={styles.list}>
        {users.map((member) => (
          <View
            key={member.id}
            style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Text style={[styles.name, { color: palette.text }]}>
              {member.firstName} {member.lastName ?? ""}
            </Text>
            <Text style={{ color: palette.textMuted }}>{member.email}</Text>
            <Text style={{ color: palette.textMuted }}>
              Role: {member.role} | Access: {member.accessStatus} | Verified: {member.emailVerified ? "yes" : "no"}
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={() => void updateUser(member.id, { accessStatus: "approved" })}>
                <Text style={[styles.actionText, { color: palette.success }]}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => void updateUser(member.id, { accessStatus: "denied" })}>
                <Text style={[styles.actionText, { color: palette.danger }]}>Deny</Text>
              </Pressable>
              <Pressable onPress={() => void updateUser(member.id, { role: member.role === "admin" ? "user" : "admin" })}>
                <Text style={[styles.actionText, { color: palette.primary }]}>
                  {member.role === "admin" ? "Make user" : "Make admin"}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 14,
    fontWeight: "700",
  },
  list: {
    gap: 14,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
