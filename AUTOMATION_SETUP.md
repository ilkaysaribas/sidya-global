# Ticari Otomasyon Kurulumu

Bu panel mevcut Supabase projesine bağlı çalışır:

- Cari hesap kartları
- Siteye kayıt olan firmaların otomatik cari kaydı
- Ürün ve stok giriş/çıkışları
- Fatura kesildiğinde atomik stok düşümü
- Tahsilat ve cari bakiye takibi
- Satış, stok ve cari raporları
- Yazdırılabilir / PDF olarak kaydedilebilir ticari fatura

## 1. Veritabanını güncelle

Supabase panelinde `SQL Editor` bölümünü açın ve `supabase/schema.sql`
dosyasının tamamını çalıştırın.

## 2. Yönetici hesabı oluştur

Supabase `Authentication > Users` ekranında panelde kullanacağınız kullanıcıyı
oluşturun. Ardından SQL Editor'de e-posta adresini değiştirerek şu sorguyu
çalıştırın:

```sql
insert into public.admin_users (user_id, full_name)
select id, 'Sistem Yöneticisi'
from auth.users
where email = 'yonetici@example.com'
on conflict (user_id) do nothing;
```

Yalnızca `admin_users` tablosunda bulunan hesaplar `admin.html` panelini
kullanabilir. Service role anahtarı tarayıcıya gönderilmez.

## 3. Paneli aç

Canlı sitede:

```txt
https://site-adresiniz.com/admin.html
```

Yerel testte statik dosyaları bir web sunucusu üzerinden açın. `file://`
üzerinden Supabase bağlantısı kullanılmamalıdır.

## 4. İlk kullanım

1. `Stoklar > Site kataloğunu aktar` ile mevcut ürün kataloğunu stok kartlarına alın.
2. Ürünlerin alış/satış fiyatlarını ve minimum stoklarını düzenleyin.
3. `Stok hareketi` ile açılış stoklarını girin.
4. Yeni müşteri kayıtları otomatik olarak `Cari Hesaplar` bölümüne gelir.
5. Fatura oluşturduğunuzda stok otomatik düşer ve cari borç oluşur.
6. Cari satırındaki `Tahsilat` ile ödemeyi işleyin.

## Fatura kapsamı

Panel ticari fatura kaydı oluşturur ve tarayıcıdan yazdırma/PDF çıktısı verir.
Türkiye'de resmî e-Fatura veya e-Arşiv düzenlemek için GİB ya da bir özel
entegratörün API bağlantısı ayrıca kurulmalıdır. Bu bağlantı eklenmeden panelden
üretilen belge mali mühürlü resmî e-belge değildir.
