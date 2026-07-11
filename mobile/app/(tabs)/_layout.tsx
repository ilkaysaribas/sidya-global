import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors } from "@/theme/colors";

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  orders: "receipt",
  customers: "people",
  stock: "cube",
  more: "menu"
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.black, fontWeight: "900" },
        tabBarActiveTintColor: colors.goldDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { minHeight: 62, paddingBottom: 8, paddingTop: 6 },
        tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name] || "ellipse"} size={size} color={color} />
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa" }} />
      <Tabs.Screen name="orders" options={{ title: "Siparişler" }} />
      <Tabs.Screen name="customers" options={{ title: "Müşteriler" }} />
      <Tabs.Screen name="stock" options={{ title: "Stok" }} />
      <Tabs.Screen name="more" options={{ title: "Daha Fazla" }} />
    </Tabs>
  );
}
