import { useMutation, useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { ProductPicker } from "@/components/ProductPicker";
import { createInvoiceOrder, listCustomers } from "@/services/commerce";
import { saveDraft } from "@/services/offline";
import { colors, spacing } from "@/theme/colors";
import type { OrderLine, Product } from "@/types/models";

function lineFromProduct(product: Product): OrderLine {
  return {
    local_id: `${Date.now()}-${product.id}`,
    product_id: product.id,
    barcode: product.barcode || undefined,
    product_name: product.name,
    grammage: product.grammage,
    units_per_carton: Number(product.units_per_carton || 1),
    quantity: 1,
    cartons: 0,
    unit_price: Number(product.sale_price || 0),
    discount_rate: 0,
    vat_rate: Number(product.vat_rate || 0)
  };
}

export default function NewOrderScreen() {
  const router = useRouter();
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [notes, setNotes] = useState("");
  const { data: customers = [] } = useQuery({ queryKey: ["customers", customerSearch], queryFn: () => listCustomers(customerSearch) });
  const saveOrder = useMutation({ mutationFn: createInvoiceOrder });

  const totals = useMemo(() => {
    const subtotal = lines.reduce((total, line) => total + line.quantity * line.unit_price * (1 - line.discount_rate / 100), 0);
    const vat = lines.reduce((total, line) => total + line.quantity * line.unit_price * (1 - line.discount_rate / 100) * (line.vat_rate / 100), 0);
    return { subtotal, vat, total: subtotal + vat };
  }, [lines]);

  function updateLine(id: string, patch: Partial<OrderLine>) {
    setLines((current) => current.map((line) => line.local_id === id ? { ...line, ...patch } : line));
  }

  async function onSave() {
    if (!customerId) return Alert.alert("Eksik bilgi", "Müşteri seçin.");
    if (!lines.length) return Alert.alert("Eksik bilgi", "En az bir ürün ekleyin.");
    try {
      await saveOrder.mutateAsync({ customer_id: customerId, currency: "USD", exchange_rate: 1, notes, lines });
      Alert.alert("Kaydedildi", "Sipariş taslak olarak oluşturuldu.", [{ text: "Tamam", onPress: () => router.back() }]);
    } catch (error: any) {
      await saveDraft({ id: `${Date.now()}`, type: "order_draft", payload: { customerId, notes, lines }, created_at: new Date().toISOString() });
      Alert.alert("Çevrimdışı taslak", error?.message || "Sipariş kaydedilemedi, yerel taslak olarak saklandı.");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: "Yeni sipariş" }} />
      <Text style={styles.title}>Yeni sipariş</Text>
      <Text style={styles.label}>Müşteri ara</Text>
      <TextInput value={customerSearch} onChangeText={setCustomerSearch} style={styles.input} placeholder="Firma adı, telefon veya e-posta" />
      <View style={styles.customerList}>
        {customers.slice(0, 5).map((customer) => (
          <AppButton key={customer.id} title={customer.company_name || customer.name || "Cari"} variant={customerId === customer.id ? "primary" : "secondary"} onPress={() => setCustomerId(customer.id)} />
        ))}
      </View>
      <Text style={styles.label}>Ürün ekle</Text>
      <ProductPicker onSelect={(product) => setLines((current) => [lineFromProduct(product), ...current])} />
      <Text style={styles.sectionTitle}>Ürün satırları</Text>
      {lines.map((line) => (
        <View key={line.local_id} style={styles.lineCard}>
          <Text style={styles.lineName}>{line.product_name}</Text>
          <Text style={styles.lineMeta}>{[line.barcode, line.grammage, `Koli içi ${line.units_per_carton || 1}`].filter(Boolean).join(" • ")}</Text>
          <View style={styles.fieldRow}>
            <TextInput keyboardType="numeric" value={String(line.quantity)} onChangeText={(value) => updateLine(line.local_id, { quantity: Number(value.replace(",", ".")) || 0 })} style={styles.smallInput} placeholder="Adet" />
            <TextInput keyboardType="numeric" value={String(line.unit_price)} onChangeText={(value) => updateLine(line.local_id, { unit_price: Number(value.replace(",", ".")) || 0 })} style={styles.smallInput} placeholder="Fiyat" />
            <TextInput keyboardType="numeric" value={String(line.discount_rate)} onChangeText={(value) => updateLine(line.local_id, { discount_rate: Number(value.replace(",", ".")) || 0 })} style={styles.smallInput} placeholder="İsk.%" />
          </View>
          <Text style={styles.lineTotal}>Satır: {(line.quantity * line.unit_price * (1 - line.discount_rate / 100)).toLocaleString("tr-TR", { style: "currency", currency: "USD" })}</Text>
          <AppButton title="Satırı sil" variant="secondary" onPress={() => setLines((current) => current.filter((item) => item.local_id !== line.local_id))} />
        </View>
      ))}
      <Text style={styles.label}>Açıklama</Text>
      <TextInput value={notes} onChangeText={setNotes} style={[styles.input, styles.note]} multiline />
      <View style={styles.summary}>
        <Text style={styles.summaryText}>Ara toplam: ${totals.subtotal.toFixed(2)}</Text>
        <Text style={styles.summaryText}>KDV: ${totals.vat.toFixed(2)}</Text>
        <Text style={styles.summaryTotal}>Genel toplam: ${totals.total.toFixed(2)}</Text>
      </View>
      <AppButton title="Siparişi kaydet" loading={saveOrder.isPending} onPress={onSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { color: colors.black, fontSize: 26, fontWeight: "900" },
  label: { color: colors.charcoal, fontWeight: "900" },
  input: { minHeight: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: spacing.md },
  note: { minHeight: 90, paddingTop: spacing.md },
  customerList: { gap: spacing.sm },
  sectionTitle: { color: colors.black, fontSize: 18, fontWeight: "900" },
  lineCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.lg, gap: spacing.sm },
  lineName: { color: colors.black, fontWeight: "900" },
  lineMeta: { color: colors.muted },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  smallInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: spacing.sm },
  lineTotal: { color: colors.goldDark, fontWeight: "900" },
  summary: { backgroundColor: colors.charcoal, borderRadius: 14, padding: spacing.lg, gap: spacing.sm },
  summaryText: { color: colors.surface, fontWeight: "700" },
  summaryTotal: { color: colors.gold, fontWeight: "900", fontSize: 18 }
});
