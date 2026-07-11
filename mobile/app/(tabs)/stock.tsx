import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { SearchInput } from "@/components/SearchInput";
import { listProducts } from "@/services/commerce";
import { colors, spacing } from "@/theme/colors";

export default function StockScreen() {
  const [search, setSearch] = useState("");
  const { data = [], isFetching, refetch } = useQuery({ queryKey: ["stock", search], queryFn: () => listProducts(search) });

  return (
    <View style={styles.screen}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Barkod, ürün, marka veya SKU ara" />
      <Link href="/barcode" asChild><AppButton title="Kamera ile barkod okut" variant="secondary" /></Link>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => {
          const low = Number(item.stock_quantity || 0) <= Number(item.minimum_stock || 0);
          return (
            <View style={[styles.row, low && styles.low]}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{[item.brand, item.grammage, item.barcode].filter(Boolean).join(" • ")}</Text>
              <View style={styles.stockLine}>
                <Text style={styles.stock}>Stok: {Number(item.stock_quantity || 0)}</Text>
                <Text style={styles.price}>${Number(item.sale_price || 0).toFixed(2)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Ürün bulunamadı.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  low: { borderColor: "#fecaca", backgroundColor: "#fff7f7" },
  name: { color: colors.black, fontWeight: "900", fontSize: 16 },
  meta: { color: colors.muted, marginTop: 5 },
  stockLine: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  stock: { color: colors.charcoal, fontWeight: "800" },
  price: { color: colors.goldDark, fontWeight: "900" },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xl }
});
