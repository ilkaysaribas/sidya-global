import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SearchInput } from "@/components/SearchInput";
import { listCustomers } from "@/services/commerce";
import { colors, spacing } from "@/theme/colors";

export default function CustomersScreen() {
  const [search, setSearch] = useState("");
  const { data = [], isFetching, refetch } = useQuery({ queryKey: ["customers", search], queryFn: () => listCustomers(search) });

  return (
    <View style={styles.screen}>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Firma, ülke, e-posta veya telefon ara" />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.company_name || item.name || "İsimsiz cari"}</Text>
            <Text style={styles.meta}>{[item.contact_name, item.country, item.email, item.phone].filter(Boolean).join(" • ") || "Cari kartı"}</Text>
            {item.next_follow_up_at ? <Text style={styles.follow}>Takip: {new Date(item.next_follow_up_at).toLocaleDateString("tr-TR")}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Cari kaydı bulunamadı.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  row: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md },
  name: { color: colors.black, fontWeight: "900", fontSize: 16 },
  meta: { color: colors.muted, marginTop: 5 },
  follow: { color: colors.goldDark, fontWeight: "800", marginTop: 8 },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xl }
});
