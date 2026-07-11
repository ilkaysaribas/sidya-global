import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { listIncomingOrders } from "@/services/commerce";
import { colors, spacing } from "@/theme/colors";

export default function OrdersScreen() {
  const { data = [], isFetching, refetch } = useQuery({ queryKey: ["orders"], queryFn: () => listIncomingOrders() });

  return (
    <View style={styles.screen}>
      <Link href="/order/new" asChild><AppButton title="Yeni sipariş oluştur" /></Link>
      <FlatList
        data={data}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }: any) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.company_name || item.customer_name || item.email || "Site siparişi"}</Text>
            <Text style={styles.meta}>{[item.status, item.country, item.created_at ? new Date(item.created_at).toLocaleString("tr-TR") : null].filter(Boolean).join(" • ")}</Text>
            <Text style={styles.total}>{Number(item.total || 0).toLocaleString("tr-TR", { style: "currency", currency: item.currency || "USD" })}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sipariş bulunamadı.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  name: { color: colors.black, fontWeight: "900", fontSize: 16 },
  meta: { color: colors.muted, marginTop: 5 },
  total: { color: colors.goldDark, fontWeight: "900", marginTop: spacing.md },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xl }
});
