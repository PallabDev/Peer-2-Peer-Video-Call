import { ActivityIndicator, StyleSheet, View, useColorScheme } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { useThemePalette } from "../theme/useThemePalette";

export function LoadingScreen() {
  const palette = useThemePalette(useColorScheme());

  return (
    <ScreenShell title="Callie" subtitle="Preparing secure calling" scrollable={false}>
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
