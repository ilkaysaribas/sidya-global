# Mobil Güvenlik Kontrol Listesi

- [x] Supabase service role key mobil bundle içine konmadı
- [x] SMTP şifresi mobil uygulamada yok
- [x] Supabase Auth oturumu Secure Store içinde saklanıyor
- [x] Şifre düz metin saklanmıyor
- [x] RLS politikalarıyla mevcut tablolar korunuyor
- [x] Mobil destek tablolarında RLS açık
- [x] Kamera izni sadece barkod/belge akışında isteniyor
- [x] Uygulama arka plana alınca hassas ekran gizleniyor
- [x] Offline taslaklar kritik silme işlemi yapmıyor
- [ ] Apple/Google imzalama anahtarları EAS tarafında korunacak
- [ ] Sentry aktif edilirse PII maskeleme kuralı doğrulanacak
- [ ] Production Supabase anon key RLS ile doğrulanacak
- [ ] Push notification server tokenları backend/env tarafında tutulacak
