# iOS App Store Kontrol Listesi

- [ ] Apple Developer hesabı hazır
- [ ] Bundle ID: `com.sidyaglobal.ticariotomasyon`
- [ ] App adı: Sidya Global Ticari Otomasyon
- [ ] Kısa ad: Sidya CRM
- [ ] App icon ve splash görselleri tamamlandı
- [ ] Privacy manifest kontrol edildi
- [ ] Kamera kullanım açıklaması eklendi
- [ ] Fotoğraf galerisi açıklaması eklendi
- [ ] Face ID açıklaması eklendi
- [ ] Push notification izni eklendi
- [ ] TestFlight internal build alındı
- [ ] Giriş, sipariş, barkod ve offline taslak akışı test edildi
- [ ] Store ekran görüntüleri hazırlandı
- [ ] Gizlilik politikası URL'si eklendi
- [ ] Sentry DSN public env olarak tanımlandıysa kişisel veri maskeleme kontrol edildi

Build:

```bash
eas build --platform ios --profile production
```

Submit:

```bash
eas submit --platform ios --profile production
```
