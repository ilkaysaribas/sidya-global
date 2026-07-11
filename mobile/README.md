# Sidya Global Ticari Otomasyon Mobil Uygulama

Bu klasör, Sidya Global web/ticari otomasyon sistemine bağlı React Native + Expo mobil uygulamasıdır. Uygulama iOS ve Android için aynı kod tabanını kullanır.

## Teknoloji

- Expo + React Native + TypeScript
- Expo Router
- Supabase Auth ve mevcut Supabase tabloları
- TanStack Query
- React Hook Form + Zod
- Expo Secure Store
- Expo Camera ve Notifications

## Kurulum

```bash
cd mobile
npm install
cp .env.example .env
npm run start
```

`.env` içine yalnızca public mobil değerleri girilir:

```bash
EXPO_PUBLIC_API_URL=https://sidyaglobal.com
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SENTRY_DSN=
```

Mobil uygulamaya kesinlikle service role key, SMTP şifresi, database password veya private token yazılmaz.

## Veritabanı

Mobil bildirim, offline taslak ve audit log tabloları için:

```sql
mobile/supabase/mobile-app.sql
```

Supabase SQL Editor içinde çalıştırılır. Mevcut `customers`, `products`, `site_orders`, `invoices`, `invoice_items`, `stock_movements` tabloları yeniden oluşturulmaz.

## Çalışan ana akışlar

- Supabase Auth ile giriş/çıkış
- Secure Store üzerinde oturum saklama
- Ana ekran canlı özetleri
- Müşteri listesi ve arama
- Ürün/stok listesi ve arama
- Kamera ile barkod okutma
- Ürün adı, marka, SKU ve barkod ile ürün seçme
- Yeni sipariş taslağı oluşturma
- Bağlantı hatasında yerel taslak kaydı
- Push notification token kaydı için servis katmanı

## Test ve kalite

```bash
npm run typecheck
npm test
npm run lint
```

## EAS Build

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

## Store gönderimi

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Apple Developer ve Google Play Console hesapları, imzalama bilgileri ve store metadata değerleri EAS hesabında tanımlanmalıdır.

## Güvenlik

- Service role key mobil uygulamada yoktur.
- Supabase RLS politikaları korunur.
- Tokenlar Secure Store içindedir.
- Şifre düz metin saklanmaz.
- Hassas ekranlar uygulama arka plana alınınca gizlenir.
- Kamera izni sadece barkod veya belge akışında istenir.

## Geliştirme notu

Bu mobil uygulama web yönetim panelini bozmayacak şekilde `mobile/` altında izole edilmiştir. Yeni modüller mevcut backend ve Supabase yapısına bağlanacak şekilde genişletilebilir.
