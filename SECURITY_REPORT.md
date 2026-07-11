# Sidya Global Security Report

Date: 2026-07-11
Repository: ilkaysaribas/sidya-global
Branch: main

## Bulunan Aciklar

- Kaynak kod icinde hardcoded Supabase publishable key fallback'i vardi.
- Mail Center migration icin hardcoded calistirma token'i vardi.
- Commercial migration endpoint icin hardcoded calistirma token'i vardi.
- Migration endpoint diagnostikleri secret prefix/uzunluk gibi gereksiz bilgi donduruyordu.
- SMTP sifresi Mail Center kaydinda plaintext tutulabilecek sekilde tasarlanmisti.
- SMTP ayarlari frontend'e sifre olmadan donse bile backend plaintext degeri kullanabiliyordu.
- `.env` dosyalari `.gitignore` icinde yoktu.
- Guvenlik header seti eksikti: frame korumasi ve ek cross-origin izolasyon header'lari yoktu.
- Public contact/mail endpointlerinde temel rate limit ve request-size siniri ihtiyaci vardi.
- B2B mail endpointi dis mail servisinden donen ham hata metnini kullaniciya dondurebiliyordu.
- Bilgi Gonder endpointi `Access-Control-Allow-Origin: *` ile gereginden genis CORS yapiyordu.
- Supabase service role key backend tarafinda kullaniliyor; browser'a verilmemeli. Kodda buna uygun ayrim guclendirildi.

## Duzeltilen Aciklar

- `api/backend-config.js` icindeki hardcoded Mail Center migration token'i kaldirildi.
- `api/backend-config.js` icindeki hardcoded Supabase publishable key fallback'i kaldirildi; public key artik sadece Vercel env uzerinden uretilen runtime config ile veriliyor.
- Mail Center backend'e IP bazli temel rate limit eklendi.
- SMTP sifresi icin AES-256-GCM tabanli encryption/decryption eklendi.
- `SMTP_ENCRYPTION_KEY` yoksa panelden SMTP sifresi kaydi reddedilecek sekilde guvenli hale getirildi.
- Legacy plaintext SMTP sifresi backend tarafinda yok sayilacak sekilde ayarlandi.
- Mail gonderimlerinde gonderen ad/e-posta sabitlendi: `Sidya Global Export Department <export@sidyaglobal.com>`.
- `api/commercial-migration.js` icindeki hardcoded token kaldirildi.
- Commercial migration artik `MIGRATION_ADMIN_KEY` ister; token'li URL listesi dondurmez.
- Commercial migration env diagnostigi secret prefix/uzunluk gostermeyecek sekilde sadelestirildi.
- Kök `backend-config.js` icindeki hardcoded Supabase publishable key kaldirildi; dosya yalnizca `/api/backend-config.js` runtime loader'i oldu.
- `api/information-message.js` icin request body limiti, IP bazli rate limit ve origin allowlist eklendi.
- `api/information-message.js` artik backend/Supabase detaylarini public response icinde acik dondurmuyor.
- `api/b2b-request.js` icin rate limit, dosya boyutu/sayisi siniri, input temizleme ve generic provider error mesaji eklendi.
- `.gitignore` icine `.env`, `.env.local`, `.env.production`, `.env.development`, `.env.*.local` eklendi.
- `.env.example` eklendi; secret degeri yok, sadece gerekli env isimleri var.
- Vercel header setine `X-Frame-Options`, `Cross-Origin-Opener-Policy`, `X-DNS-Prefetch-Control` eklendi.

## Supabase Durumu

- Mail Center / CRM SQL dosyasinda `mail_settings`, `mail_logs`, `crm_customers`, `crm_interactions` tablolarinda RLS aktif.
- Admin islemleri `public.is_admin()` kontroluyle sinirlanmis durumda.
- Public form insert politikalari sadece gerekli insert akisi icin acik.
- Service role key yalnizca backend API tarafinda kullaniliyor; browser config tarafindan dondurulmuyor.
- Storage icin mevcut `supabase/schema.sql` dosyasinda bucket politikalari private/kimlikli akis icin tanimli.

## API Durumu

- Admin Mail Center, CRM ve mail gonderim endpointleri Supabase session token + `admin_users` kontroluyle korunuyor.
- Migration endpointleri artik `MIGRATION_ADMIN_KEY` olmadan calismiyor.
- Contact form endpointi public kalmak zorunda; backend rate limit, body limit ve input kisitlariyla sertlestirildi.
- B2B onboarding endpointi public kalmak zorunda; rate limit, file limit ve safe error response ile sertlestirildi.
- Server hatalarinda secret degerleri loglanmiyor veya response icinde acik donmuyor.

## SMTP Durumu

- SMTP password frontend'e geri gosterilmiyor.
- Yeni kayitlarda SMTP password encrypted olarak saklanacak.
- Eski plaintext SMTP kaydi varsa backend bunu kullanmayacak; tekrar kaydedilmesi gerekir.
- Env `SMTP_PASSWORD` varsa once env kullanilir; yoksa encrypted DB kaydi kullanilir.

## Canli Dogrulama

- Production deploy READY oldu.
- `/api/commercial-migration` token'li action URL dondurmuyor ve migration icin `MIGRATION_ADMIN_KEY` istiyor.
- `/api/information-message` GET istegine 405 donuyor; sadece POST/OPTIONS kabul ediyor.
- `/api/b2b-request` GET istegine 405 donuyor; sadece POST kabul ediyor.
- Canli cevaplarda `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` header'lari gorundu.

## Manuel Yapilmasi Gerekenler

- Vercel Production ve Preview ortamlarina `SMTP_ENCRYPTION_KEY` eklenmeli.
- Mail Center icinden SMTP password bir kez tekrar kaydedilmeli; boylece encrypted formata gecsin.
- Canli migration endpointi `MIGRATION_ADMIN_KEY` icin `configured=false` donuyor; migration endpointini kullanacaksaniz bu env Production/Preview kapsaminda baglanmali.
- Daha once kaynakta gorunmus hardcoded token/key degerleri hassas kabul ediliyorsa Supabase/Vercel tarafinda rotate edilmeli.
- GitHub secret scanning / push protection aktif edilmeli.
- Supabase dashboard'da tum tablolar icin RLS durumlari periyodik kontrol edilmeli.
- Vercel env'lerinde Production/Preview/Development kapsamlarinin ayni guvenlik seviyesinde oldugu kontrol edilmeli.

## Yapilan Degisiklikler

- `api/backend-config.js`
  - Hardcoded token/key kaldirildi.
  - SMTP encryption eklendi.
  - Rate limit eklendi.
  - Migration token kontrolu env'e baglandi.
- `api/commercial-migration.js`
  - Hardcoded token kaldirildi.
  - Safe env diagnostics eklendi.
  - Token'li action URL'leri kaldirildi.
- `api/information-message.js`
  - Body limit, rate limit, origin allowlist ve safe error response eklendi.
- `api/b2b-request.js`
  - Rate limit, dosya limitleri, input temizleme ve safe provider error response eklendi.
- `backend-config.js`
  - Hardcoded Supabase key kaldirildi.
  - Dynamic backend config loader'a cevrildi.
- `.gitignore`
  - Env dosyalari ignore edildi.
- `.env.example`
  - Secretsiz env sablonu eklendi.
- `vercel.json`
  - Ek guvenlik header'lari eklendi.
- `SECURITY_REPORT.md`
  - Bu rapor eklendi ve canli dogrulama notlariyla guncellendi.

## Risk Seviyesi

Orta.

Uygulama kritik secret'lari kaynak koddan temizleme yoluna girdi. Kalan risklerin ana kaynagi eski commit history, Vercel/Supabase tarafinda rotate edilmesi gereken degerler ve canli env kapsamlarinin son kontroludur.

## Guvenlik Puani

84 / 100

Bu puan kod tarafindaki mevcut sertlestirme sonrasi durum icindir. `SMTP_ENCRYPTION_KEY` eklenip SMTP sifresi yeniden kaydedildikten, `MIGRATION_ADMIN_KEY` production/preview kapsamina baglandiktan ve eski degerler rotate edildikten sonra hedef puan 90+ olur.
