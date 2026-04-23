import { StyleSheet, Text, TextInput, View } from "react-native";
import { useColorScheme } from "react-native";
import { useThemePalette } from "../theme/useThemePalette";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "words" | "sentences" | "characters";
  keyboardType?: "default" | "email-address" | "number-pad";
  maxLength?: number;
};

export function FormInput(props: Props) {
  const palette = useThemePalette(useColorScheme());

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: palette.textMuted }]}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={palette.textMuted}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize ?? "none"}
        keyboardType={props.keyboardType}
        maxLength={props.maxLength}
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            color: palette.text,
            borderColor: palette.border,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    fontSize: 16,
  },
});
