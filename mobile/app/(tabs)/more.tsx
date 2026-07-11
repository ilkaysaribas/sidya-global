import { useAuth } from "@/providers/AuthProvider";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { colors, spacing } from "@/theme/colors";

const items = ["Teklifler", "Tahsilatlar", "Ürünler", "Bildirimler", "Raporlar", "Kullanıcılar", "Ayarlar"];

export default function MoreScreen() {
  const { signOut, user } = useAuth();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.profile}>
        <Text style={styles.title}>Daha Fazla</Text>
        <Text style={styles.meta}>{user?.email}</Text>
      </View>
      {items.map((item) => (
        <View key={item} style={styles.item}>
          <Text style={styles.itemText}>{item}</Text>
          <Text style={styles.itemHint}>Modül hazır, detay ekranı genişletilebilir.</Text>
        </View>
      ))}
      <AppButton title="Çıkış yap" variant="danger" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  profile: { backgroundColor: colors.charcoal, borderRadius: 14, padding: spacing.xl },
  title: { color: colors.surface, fontSize: 24, fontWeight: "900" },
  meta: { color: colors.gold, marginTop: 6 },
  item: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: spacing.lg },
  itemText: { color: colors.black, fontWeight: "900" },
  itemHint: { color: colors.muted, marginTop: 4 }
});
