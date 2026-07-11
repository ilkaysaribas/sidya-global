import { Redirect, Stack, useSegments } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AppQueryProvider } from "@/providers/QueryProvider";
import { colors } from "@/theme/colors";

function RootNavigator() {
  const { session, loading, hiddenForPrivacy } = useAuth();
  const segments = useSegments();
  const inAuth = segments[0] === "login";

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.loading}>Yükleniyor...</Text></View>;
  }

  if (!session && !inAuth) return <Redirect href="/login" />;
  if (session && inAuth) return <Redirect href="/(tabs)" />;

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }} />
      {hiddenForPrivacy ? <View style={styles.privacy}><Text style={styles.privacyText}>Sidya CRM</Text></View> : null}
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppQueryProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </AppQueryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  loading: { marginTop: 12, color: colors.muted, fontWeight: "700" },
  privacy: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" },
  privacyText: { color: colors.gold, fontSize: 24, fontWeight: "900" }
});
