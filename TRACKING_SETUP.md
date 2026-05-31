# Tracking ve Webmaster Kurulumu

Siteye Google Search Console, Google Analytics 4, Meta Pixel, Yandex Metrica ve Yandex Webmaster altyapisi eklendi.

## Gerekli bilgiler

Platform panellerinden su degerleri alinmali:

```text
Google Search Console verification token
Google Analytics 4 Measurement ID: G-XXXXXXXXXX
Meta Pixel ID
Yandex Metrica Counter ID
Yandex Webmaster verification token
```

## Nereye yazilacak?

`index.html` dosyasinin alt kismindaki `window.SIDYA_TRACKING` alanina degerler yazilacak:

```html
<script>
  window.SIDYA_TRACKING = {
    googleAnalyticsId: "G-XXXXXXXXXX",
    googleSearchConsoleToken: "GOOGLE_TOKEN",
    metaPixelId: "META_PIXEL_ID",
    yandexMetricaId: "YANDEX_METRICA_ID",
    yandexWebmasterToken: "YANDEX_TOKEN",
  };
</script>
```

Bos kalan alanlar calismaz ama siteyi bozmaz.

## Google Search Console

1. `https://search.google.com/search-console` adresinden `sidyaglobal.com` eklenir.
2. HTML meta tag dogrulama yontemi secilir.
3. Google'in verdigi `content` token'i `googleSearchConsoleToken` alanina yazilir.
4. Site GitHub'a push edilir ve Vercel deploy bittikten sonra Search Console'da dogrulama yapilir.

## Google Analytics 4

1. GA4 property olusturulur.
2. Web data stream icinden Measurement ID alinir.
3. `googleAnalyticsId` alanina `G-...` degeri yazilir.

## Meta Pixel

1. Meta Events Manager'da Pixel olusturulur.
2. Pixel ID alinir.
3. `metaPixelId` alanina yazilir.

## Yandex Metrica

1. Yandex Metrica'da counter olusturulur.
2. Counter ID alinir.
3. `yandexMetricaId` alanina yazilir.

## Yandex Webmaster

1. Yandex Webmaster'da `sidyaglobal.com` eklenir.
2. Meta tag dogrulama yontemi secilir.
3. Yandex'in verdigi token `yandexWebmasterToken` alanina yazilir.
