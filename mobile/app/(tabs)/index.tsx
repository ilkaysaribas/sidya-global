import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { MetricCard } from "@/components/MetricCard";
import { getDashboardSummary } from "@/services/commerce";
import { colors, spacing } from "@/theme/colors";

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value || 0);
}

export default function DashboardScreen() {
  const { data, isFetching, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboardSummary });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}>
      <Text style={styles.eyebrow}>YÖNETİM PANELİ</Text>
      <Text style={styles.title}>Mobil özet</Text>
      <View style={styles.grid}>
        <MetricCard label="Bugünkü sipariş" value={data?.todaysOrders ?? 0} />
        <MetricCard label="Bekleyen sipariş" value={data?.pendingOrders ?? 0} tone="warning" />
        <MetricCard label="Faturalandırılan" value={data?.invoicedOrders ?? 0} tone="success" />
        <MetricCard label="Günlük satış" value={money(data?.dailySales || 0)} />
        <MetricCard label="Aylık satış" value={money(data?.monthlySales || 0)} />
        <MetricCard label="Stok uyarısı" value={data?.lowStockCount ?? 0} tone="danger" />
        <MetricCard label="Takip bekleyen" value={data?.followUpsDue ?? 0} />
      </View>
      <Text style={styles.sectionTitle}>Hızlı işlemler</Text>
      <View style={styles.actions}>
        <Link href="/order/new" asChild><AppButton title="Yeni sipariş" /></Link>
        <Link href="/(tabs)/customers" asChild><AppButton title="Yeni müşteri" variant="secondary" /></Link>
        <Link href="/(tabs)/stock" asChild><AppButton title="Barkod okut" variant="secondary" /></Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  eyebrow: { color: colors.goldDark, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.black, fontSize: 28, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  sectionTitle: { color: colors.black, fontSize: 18, fontWeight: "900" },
  actions: { gap: spacing.md }
});
