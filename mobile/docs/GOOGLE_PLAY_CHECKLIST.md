# Google Play Kontrol Listesi

- [ ] Google Play Console hesabı hazır
- [ ] Package: `com.sidyaglobal.ticariotomasyon`
- [ ] Adaptive icon ve splash görselleri tamamlandı
- [ ] Kamera izni gerekçesi kontrol edildi
- [ ] Android 13+ bildirim izni test edildi
- [ ] Internal testing AAB yüklendi
- [ ] Giriş, sipariş, barkod ve offline taslak akışı test edildi
- [ ] Data safety formu dolduruldu
- [ ] Gizlilik politikası URL'si eklendi
- [ ] Crash/Sentry ayarları hassas veri loglamayacak şekilde kontrol edildi

Build:

```bash
eas build --platform android --profile production
```

Submit:

```bash
eas submit --platform android --profile production
```
