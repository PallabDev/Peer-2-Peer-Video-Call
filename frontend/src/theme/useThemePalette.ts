import { useMemo } from "react";
import type { ColorSchemeName } from "react-native";

const light = {
  background: "#f4f7fb",
  surface: "#ffffff",
  surfaceAlt: "#e9eef5",
  text: "#10141f",
  textMuted: "#5b6577",
  border: "#d5dce8",
  primary: "#1d8bff",
  primaryMuted: "#dcecff",
  danger: "#ff5a5f",
  success: "#18a957",
  shadow: "rgba(16, 20, 31, 0.12)",
};

const dark = {
  background: "#09111f",
  surface: "#111c2d",
  surfaceAlt: "#16243a",
  text: "#f6f8fb",
  textMuted: "#96a4bf",
  border: "#243652",
  primary: "#5cc5ff",
  primaryMuted: "#123b58",
  danger: "#ff6b7c",
  success: "#34d399",
  shadow: "rgba(0, 0, 0, 0.3)",
};

export function useThemePalette(colorScheme?: ColorSchemeName | null) {
  return useMemo(() => (colorScheme === "dark" ? dark : light), [colorScheme]);
}
