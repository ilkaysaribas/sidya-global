import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/theme/colors";

export function MetricCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "danger" | "warning" }) {
  return (
    <View style={[styles.card, tone !== "default" && styles[tone]]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  value: { marginTop: spacing.sm, color: colors.black, fontSize: 22, fontWeight: "900" },
  success: { borderColor: "#a7f3d0" },
  danger: { borderColor: "#fecaca" },
  warning: { borderColor: "#fde68a" }
});
