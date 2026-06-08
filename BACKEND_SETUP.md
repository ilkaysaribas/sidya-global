# Sidya Global B2B Giriş Sistemi

Bu bölüm müşteri kayıt/giriş sistemini aktif etmek içindir.

Kısa açıklama:

- Supabase, müşterilerin e-posta/şifre ile giriş yapacağı veritabanı ve hesap sistemidir.
- SQL, Supabase içinde tablo ve dosya alanlarını oluşturan kurulum komutudur.
- Bu kodlar GitHub/Vercel tarafında hazırdır; canlı girişin çalışması için Supabase hesabı bağlanmalıdır.

## 1. Supabase Projesi Oluştur

1. https://supabase.com adresine gir.
2. Yeni proje oluştur.
3. Proje açılınca sol menüden `SQL Editor` bölümüne gir.
4. Bu projedeki [supabase/schema.sql](/C:/Users/ilkaysaribas/Documents/İhracat%20Sitesi/supabase/schema.sql) dosyasının içeriğini kopyala.
5. Supabase `SQL Editor` ekranına yapıştır ve `Run` butonuna bas.

Bu işlem şunları oluşturur:

- Müşteri kayıt tablosu
- Evrak yükleme alanı
- Müşterinin sadece kendi evraklarını görebileceği güvenlik kuralları

## 2. Supabase Bilgilerini Al

Supabase projesinde:

1. Sol menüden `Project Settings` aç.
2. `API` bölümüne gir.
3. Şu iki bilgiyi al:

```txt
Project URL
anon public key
```

Önemli:

- `anon public key` kullanılacak.
- `service_role key` kullanılmayacak.

## 3. Vercel'e Bağla

Vercel panelinde Sidya Global projesine gir:

1. `Settings`
2. `Environment Variables`
3. Aşağıdaki 3 değişkeni ekle:

```txt
SIDYA_SUPABASE_URL=Supabase Project URL
SIDYA_SUPABASE_ANON_KEY=Supabase anon public key
SIDYA_SUPABASE_STORAGE_BUCKET=b2b-documents
```

Sonra Vercel'de projeyi yeniden deploy et.

## 4. Aktif Olduğunu Kontrol Et

Canlı sitede:

1. `B2B Portal Giriş` ekranını aç.
2. Alıcı kayıt formundan bir müşteri oluştur.
3. Aynı e-posta ve şifreyle giriş yap.
4. Giriş başarılı olursa proforma sipariş ekranı açılır.

## Not

Benim kod tarafında yaptığım hazırlık tamamdır. Supabase paneli senin hesabında olduğu için SQL çalıştırma ve Vercel'e Supabase anahtarlarını girme adımları dış panelden yapılmalıdır.
