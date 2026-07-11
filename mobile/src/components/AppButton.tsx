import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, spacing } from "@/theme/colors";

export function AppButton({ title, onPress, loading, variant = "primary", style }: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={variant === "secondary" ? colors.charcoal : colors.surface} /> : <Text style={[styles.text, variant === "secondary" && styles.secondaryText]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  primary: { backgroundColor: colors.charcoal },
  secondary: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.82 },
  text: { color: colors.surface, fontWeight: "800" },
  secondaryText: { color: colors.charcoal }
});
