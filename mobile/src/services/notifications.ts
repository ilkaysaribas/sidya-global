import * as Device from "expo-application";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true
  })
});

export async function registerPushToken(userId: string) {
  const permission = await Notifications.getPermissionsAsync();
  let status = permission.status;
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Sidya CRM",
      importance: Notifications.AndroidImportance.DEFAULT
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await supabase.from("mobile_push_tokens").upsert({
    user_id: userId,
    expo_push_token: token,
    platform: Platform.OS,
    device_id: Device.applicationId || null,
    updated_at: new Date().toISOString()
  });
  return token;
}
