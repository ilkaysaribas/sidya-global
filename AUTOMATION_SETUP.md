# Ticari Otomasyon Kurulumu

Bu panel mevcut Supabase projesine bağlı çalışır:

- Cari hesap kartları
- Siteye kayıt olan firmaların otomatik cari kaydı
- Web sitesindeki proforma siparişlerinin `Gelen Siparişler` kutusuna aktarılması
- Tedarikçi kartları ve alış faturaları
- Ürün ve stok giriş/çıkışları
- Alış faturasında otomatik stok girişi, satış faturasında atomik stok düşümü
- Satır bazında üç kademeli iskonto ve fatura altı iskonto
- Türkiye faturalarında değiştirilebilir KDV, ihracat faturalarında KDV %0
- Tahsilat ve cari bakiye takibi
- Satış, stok ve cari raporları
- KDV takip ekranı
- Yazdırılabilir / PDF olarak kaydedilebilir ticari fatura

## 1. Veritabanını güncelle

Supabase panelinde `SQL Editor` bölümünü açın ve `supabase/schema.sql`
dosyasının tamamını çalıştırın.

Yeni sürüm yayınlandığında aynı dosya tekrar çalıştırılabilir. `if not exists`,
`create or replace` ve kontrollü `alter table` komutları mevcut kayıtları
silmeden yeni alanları ekler.

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

1. `Denetim Masası > Site kataloğunu şimdi aktar` ile mevcut ürün kataloğunu stok kartlarına alın.
2. Ürünlerin alış/satış fiyatlarını ve minimum stoklarını düzenleyin.
3. Normal stok hareketlerini alış ve satış faturalarıyla oluşturun.
4. Yalnızca sayım farklarında `Denetim Masası > Stok düzeltmesi` kullanın.
4. Yeni müşteri kayıtları otomatik olarak `Cari Hesaplar` bölümüne gelir.
5. Site proformaları `Gelen Siparişler` bölümüne gelir ve satış faturasına aktarılır.
6. Alış faturası stokları artırır; satış faturası stokları düşürür.
6. Cari satırındaki `Tahsilat` ile ödemeyi işleyin.

## Fatura kapsamı

Panel düzenlenebilir ihracat fatura taslağı oluşturur ve tarayıcıdan
yazdırma/PDF çıktısı verir. Türkiye'de resmî e-Fatura veya e-Arşiv düzenlemek
için GİB hesabı ya da GİB onaylı özel entegratör API bağlantısı kurulmalıdır.
Entegratör kullanıcı bilgileri, test ortamı ve mali mühür süreci tamamlanmadan
panelden üretilen belge resmî e-belge değildir ve sistem belgeyi GİB'e
gönderilmiş olarak işaretlemez.

KDV oranları ürün kartında ve fatura satırında değiştirilebilir. Hazır öneriler
gıda için `%1`, hasta bezi için `%10`, gıda dışı ürünler için `%20` olarak
sunulur. Ürünün gerçek vergi oranı GTİP, teslim türü ve güncel mevzuata göre mali
müşavir tarafından doğrulanmalıdır.
