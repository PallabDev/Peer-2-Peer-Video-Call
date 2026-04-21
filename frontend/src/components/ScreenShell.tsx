import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemePalette } from "../theme/useThemePalette";

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  scrollable?: boolean;
}>;

export function ScreenShell({ title, subtitle, scrollable = true, children }: Props) {
  const palette = useThemePalette(useColorScheme());
  const body = (
    <View style={styles.content}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: palette.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      {scrollable ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 18,
  },
  hero: {
    paddingTop: 16,
    gap: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
});
