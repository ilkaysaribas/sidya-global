import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { useAuth } from "@/providers/AuthProvider";
import { signInSchema, type SignInValues } from "@/schemas/forms";
import { colors, spacing } from "@/theme/colors";

export default function LoginScreen() {
  const { signIn, resetPassword } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, watch, formState: { errors } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", remember: true }
  });

  async function onSubmit(values: SignInValues) {
    setLoading(true);
    setMessage("");
    try {
      await signIn(values.email, values.password);
    } catch (error: any) {
      setMessage(error?.message || "Giriş yapılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function onReset() {
    const email = watch("email");
    if (!email) return setMessage("Şifre sıfırlama için e-posta girin.");
    try {
      await resetPassword(email);
      setMessage("Şifre sıfırlama bağlantısı gönderildi.");
    } catch (error: any) {
      setMessage(error?.message || "Şifre sıfırlama gönderilemedi.");
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.badge}><Text style={styles.badgeText}>SG</Text></View>
        <Text style={styles.title}>Sidya Global Ticari Otomasyon</Text>
        <Text style={styles.subtitle}>Güvenli mobil yönetim paneli</Text>
        <Text style={styles.label}>E-posta</Text>
        <Controller control={control} name="email" render={({ field }) => <TextInput autoCapitalize="none" keyboardType="email-address" value={field.value} onChangeText={field.onChange} style={styles.input} />} />
        {errors.email ? <Text style={styles.error}>{errors.email.message}</Text> : null}
        <Text style={styles.label}>Şifre</Text>
        <Controller control={control} name="password" render={({ field }) => <TextInput secureTextEntry value={field.value} onChangeText={field.onChange} style={styles.input} />} />
        {errors.password ? <Text style={styles.error}>{errors.password.message}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <AppButton title="Giriş yap" loading={loading} onPress={handleSubmit(onSubmit)} />
        <AppButton title="Şifremi unuttum" variant="secondary" onPress={onReset} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { width: "100%", maxWidth: 420, backgroundColor: colors.surface, borderRadius: 18, padding: spacing.xl, gap: spacing.md },
  badge: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.black, fontWeight: "900" },
  title: { color: colors.black, fontSize: 24, fontWeight: "900" },
  subtitle: { color: colors.muted, marginBottom: spacing.sm },
  label: { color: colors.charcoal, fontWeight: "800", fontSize: 12 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: spacing.md, color: colors.black, backgroundColor: "#f8fafc" },
  error: { color: colors.danger, fontWeight: "700" },
  message: { color: colors.info, fontWeight: "700" }
});
