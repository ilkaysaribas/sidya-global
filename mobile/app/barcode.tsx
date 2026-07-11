import { CameraView, useCameraPermissions } from "expo-camera";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { findProductByBarcode } from "@/services/commerce";
import { colors, spacing } from "@/theme/colors";

export default function BarcodeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const router = useRouter();

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Barkod okut" }} />
        <Text style={styles.title}>Kamera izni gerekiyor</Text>
        <Text style={styles.meta}>Barkodla ürün bulmak ve stok işlemi yapmak için kamera izni verin.</Text>
        <AppButton title="İzin ver" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: "Barkod okut" }} />
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e", "qr"] }}
        onBarcodeScanned={scanned ? undefined : async ({ data }) => {
          setScanned(true);
          try {
            const product = await findProductByBarcode(data);
            if (product) {
              Alert.alert("Ürün bulundu", `${product.name}\n${product.barcode || data}`, [
                { text: "Stokta aç", onPress: () => router.replace("/(tabs)/stock") },
                { text: "Tekrar okut", onPress: () => setScanned(false) }
              ]);
            } else {
              Alert.alert("Ürün bulunamadı", "Bu barkoda bağlı ürün bulunamadı. Yeni ürün oluşturmak ister misiniz?", [
                { text: "Vazgeç", style: "cancel", onPress: () => setScanned(false) },
                { text: "Ürün ekranına git", onPress: () => router.replace("/(tabs)/stock") }
              ]);
            }
          } catch (error: any) {
            Alert.alert("Barkod okunamadı", error?.message || "Ürün sorgusu başarısız oldu.", [{ text: "Tekrar dene", onPress: () => setScanned(false) }]);
          }
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.scanText}>Barkodu çerçeveye hizalayın</Text>
        {scanned ? <AppButton title="Tekrar okut" onPress={() => setScanned(false)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  title: { color: colors.black, fontSize: 24, fontWeight: "900" },
  meta: { color: colors.muted, textAlign: "center" },
  overlay: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl, gap: spacing.md },
  scanText: { color: colors.surface, textAlign: "center", fontWeight: "900", fontSize: 18, textShadowColor: colors.black, textShadowRadius: 8 }
});
