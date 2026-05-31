# Sidya Global Mail Setup

Hazirlanan site mail adresi:

```text
info@sidyaglobal.com
```

## Mevcut durum

31.05.2026 tarihinde yapilan DNS kontrolunde `sidyaglobal.com` alan adinin Cloudflare ad sunucularina bagli oldugu goruldu. Ancak ana site icin `A` kaydi, `www` kaydi ve mail icin `MX` kaydi henuz aktif gorunmuyor. Bu nedenle site henuz cevrimici acilmaz ve `info@sidyaglobal.com` adresine disaridan mail gelmez.

Disaridan mail alimi ve web yayini icin Cloudflare DNS panelinde hosting firmasinin verdigi web kayitlari ve mail kayitlari olusturulmalidir.

## Posta kutusu kurulumu

1. Domaini satin alin veya domain paneline girin.
2. Hosting/mail panelinde `info@sidyaglobal.com` posta kutusunu olusturun.
3. Guclu bir sifre belirleyin.
4. Mail panelinin verdigi SMTP, IMAP, MX, SPF, DKIM ve DMARC bilgilerini not alin.
5. Site dosyalarini PHP destekli hosting'e yukleyin.

## DNS kayitlari

Mail hizmeti hosting panelinden alinacaksa tipik kurulum asagidaki gibidir. `SERVER_IP` degerini hosting sunucusunun IP adresiyle degistirin.

```text
Type  Name    Value                         Priority
A     @       SERVER_IP
A     mail    SERVER_IP
MX    @       mail.sidyaglobal.com  10
TXT   @       v=spf1 a mx ~all
TXT   _dmarc  v=DMARC1; p=quarantine; rua=mailto:info@sidyaglobal.com
```

DKIM kaydi her mail servisinde farklidir. Bu kaydi hosting/mail panelindeki "Email Deliverability", "DKIM" veya "DNS records" ekranindan alip DNS'e aynen ekleyin.

Google Workspace, Microsoft 365, Zoho, Yandex veya baska bir mail servisi kullanilacaksa yukaridaki MX yerine o servisin verdigi MX/SPF/DKIM/DMARC kayitlari girilmelidir.

## Site formu SMTP kurulumu

`contact.php` artik iki sekilde calisir:

- `mail-config.php` yoksa PHP `mail()` fonksiyonuyla gondermeyi dener.
- `mail-config.php` varsa ve SMTP aktifse, form taleplerini dogrudan SMTP hesabiyla `info@sidyaglobal.com` adresine gonderir.

Kurulum:

1. `mail-config.example.php` dosyasini hosting uzerinde `mail-config.php` olarak kopyalayin.
2. `MAILBOX_PASSWORD_HERE` yerine `info@sidyaglobal.com` posta kutusu sifresini yazin.
3. SMTP host/port bilgisini mail servisinizin verdigi degerle guncelleyin.
4. Dosya izinlerini mumkunse sadece site kullanicisinin okuyabilecegi sekilde sinirlandirin.
5. Site uzerindeki teklif formundan test mesaji gonderin.

## Test

DNS yayilimi genelde birkac dakika ile 24 saat arasinda tamamlanir.

Kontrol komutlari:

```powershell
Resolve-DnsName sidyaglobal.com -Type MX
Resolve-DnsName sidyaglobal.com -Type TXT
Resolve-DnsName mail.sidyaglobal.com -Type A
```

Son test icin Gmail/Outlook gibi harici bir hesaptan `info@sidyaglobal.com` adresine mail gonderin. Gelen kutusuna ulasiyorsa disaridan mail alimi calisiyor demektir.
