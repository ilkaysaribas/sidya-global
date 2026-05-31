# Telefon uygulamasi kurulumu

Bu site Android ve iPhone icin PWA olarak hazirlandi. PWA, web sitesinin telefonda ayri uygulama gibi acilmasini saglar.

## Yayina alma

1. Dosyalari HTTPS destekli bir hosting alanina yukleyin.
2. Ana adres `index.html` dosyasini acmali.
3. `manifest.webmanifest`, `sw.js`, `offline.html` ve `assets` klasoru ayni yapida kalmali.

Not: `file://` ile bilgisayardan acildiginda servis calisani ve uygulama kurulumu aktif olmaz. Telefon kurulumu icin site HTTPS adresinden acilmalidir.

## Android

1. Siteyi Chrome ile acin.
2. Tarayici menusu veya sitedeki `Uygulama` dugmesi ile yukleme ekranini acin.
3. `Yukle` secenegiyle ana ekrana ekleyin.

## iPhone

1. Siteyi Safari ile acin.
2. Paylas dugmesine basin.
3. `Ana Ekrana Ekle` secenegini kullanin.

## Magaza uygulamasi

Google Play veya Apple App Store'a yuklenecek APK/IPA icin ayni site daha sonra Capacitor ya da benzeri bir kabukla native uygulamaya donusturulebilir. Bunun icin Android Studio, Xcode ve ilgili developer hesaplari gerekir.
