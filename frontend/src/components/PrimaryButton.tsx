import { Pressable, StyleSheet, Text } from "react-native";
import { useColorScheme } from "react-native";
import { useThemePalette } from "../theme/useThemePalette";

type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, variant = "primary", disabled = false }: Props) {
  const palette = useThemePalette(useColorScheme());
  const backgroundColor =
    variant === "primary" ? palette.primary :
    variant === "danger" ? palette.danger :
    palette.surfaceAlt;

  const textColor = variant === "secondary" ? palette.text : "#ffffff";

  return (
    <Pressable
      onPress={() => void onPress()}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
});
