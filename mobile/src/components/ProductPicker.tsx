import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { listProducts } from "@/services/commerce";
import { colors, spacing } from "@/theme/colors";
import type { Product } from "@/types/models";
import { SearchInput } from "./SearchInput";

export function ProductPicker({ onSelect, initialSearch = "" }: { onSelect: (product: Product) => void; initialSearch?: string }) {
  const [search, setSearch] = useState(initialSearch);
  const { data = [], isFetching } = useQuery({
    queryKey: ["products", search],
    queryFn: () => listProducts(search),
    enabled: search.trim().length >= 2,
    placeholderData: (previous) => previous
  });

  return (
    <View style={styles.wrap}>
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Ürün, barkod, marka veya gramaj ara"
        autoCapitalize="none"
      />
      <Text style={styles.hint}>{isFetching ? "Aranıyor..." : search.length < 2 ? "Arama için en az 2 karakter yazın." : `${data.length} sonuç`}</Text>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={data.slice(0, 50)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelect(item)}>
            <View style={styles.nameBlock}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>{[item.brand, item.grammage, item.barcode].filter(Boolean).join(" • ") || "Ürün kartı"}</Text>
            </View>
            <Text style={styles.price}>${Number(item.sale_price || 0).toFixed(2)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={search.length >= 2 ? <Text style={styles.empty}>Eşleşen ürün bulunamadı.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hint: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  nameBlock: { flex: 1 },
  name: { color: colors.black, fontWeight: "800" },
  meta: { color: colors.muted, marginTop: 3, fontSize: 12 },
  price: { color: colors.goldDark, fontWeight: "900" },
  empty: { color: colors.muted, paddingVertical: spacing.lg, textAlign: "center" }
});
