# Sidya Global B2B Kayıt Sistemi

Bu bölüm gerçek müşteri hesabı oluşturma, firma kaydı alma ve evrak yükleme sistemini aktif etmek içindir.

## 1. Supabase SQL Kurulumu

Supabase panelinde:

1. `SQL Editor` bölümüne gir.
2. Bu projedeki `supabase/schema.sql` dosyasının içeriğini kopyala.
3. SQL Editor ekranına yapıştır ve `Run` butonuna bas.

Bu işlem şunları oluşturur:

- B2B müşteri kayıt tablosu
- Evrak yükleme bucket'ı: `b2b-documents`
- Dosya güvenlik kuralları

## 2. Vercel Environment Variables

Vercel panelinde Sidya Global projesine gir:

`Settings > Environment Variables`

Aşağıdaki değişkenleri ekle:

```txt
SIDYA_SUPABASE_URL=https://jhjforyykkxklfarjtjl.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://jhjforyykkxklfarjtjl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_obANQZIOM1xpMIBsJPZcoA__6TGFYBc
SIDYA_SUPABASE_STORAGE_BUCKET=b2b-documents
```

Gerçek kayıt oluşturmak için ayrıca Supabase `service_role key` gerekir:

```txt
SIDYA_SUPABASE_SERVICE_ROLE_KEY=Supabase panelindeki service_role key
```

Önemli:

- `service_role key` kesinlikle frontend dosyalarına yazılmaz.
- Sadece Vercel Environment Variables içine eklenir.
- Bu anahtar olmadan backend müşteri hesabını doğrulanmış şekilde oluşturamaz.

## 3. Service Role Key Nereden Alınır?

Supabase panelinde:

1. `Project Settings`
2. `API`
3. `Project API keys`
4. `service_role` anahtarını kopyala.
5. Vercel'e `SIDYA_SUPABASE_SERVICE_ROLE_KEY` olarak ekle.

Sonra Vercel'de yeniden deploy et.

## 4. Kontrol

Canlı sitede:

1. `B2B Portal Giriş` ekranını aç.
2. Üstte e-posta ve şifre gir.
3. Alttaki `Yeni alıcı kaydı` formunu doldur.
4. `Alıcı hesabı oluştur` butonuna bas.
5. Kayıt başarılıysa Supabase Auth içinde kullanıcı, `b2b_onboarding_requests` tablosunda firma kaydı ve storage içinde evraklar oluşur.

Bu yapı e-posta doğrulamasına takılmadan hesap oluşturur; `Email not confirmed` hatasını bu yüzden çözer.
