# MAISON SURGE — Yönetim Paneli Kılavuzu

Yönetim paneli `/admin` adresindedir ve yalnızca Türkçedir (D-010). Bu belge işletme ekibi içindir.

> **Güvenlik özeti:** Her sayfa ve her işlem sunucu tarafında oturum + rol + yetki kontrolünden geçer; veritabanı da (RLS ve SQL fonksiyonları) aynı yetkiyi ikinci kez denetler. Menüde görünmeyen bir modülün adresini yazmak erişim sağlamaz. Rolü olmayan bir kullanıcı `/admin` adresinde 404 görür.

---

## 1. Giriş ve ilk yönetici

1. Önce mağazada normal bir hesap açın: `/tr/auth/register` → e-postadaki doğrulama bağlantısına tıklayın.
2. İlk yönetici rolü **yalnızca sunucu anahtarı (service role) ile** verilebilir (D-012). İki yol:
   - Proje klasöründe (`.env.local` içinde `SUPABASE_SERVICE_ROLE_KEY` tanımlı iken):
     ```bash
     npm run admin:grant -- ornek@firma.com admin
     ```
   - veya Supabase Dashboard → SQL Editor:
     ```sql
     select public.grant_role_by_email('ornek@firma.com', 'admin');
     ```
3. `/tr/auth/login?next=/admin` adresinden giriş yapın.
4. Diğer ekip üyelerine rolü panelden verin: **Müşteriler → kişi → Yetkiler**.

Varsayılan admin hesabı/parolası **yoktur**; kayıt olan ilk kullanıcı otomatik admin **olmaz**.

## 2. Roller ve yetki matrisi

| Modül / işlem | staff | admin |
|---|:-:|:-:|
| Gösterge paneli | ✓ | ✓ |
| Ürün, kategori, koleksiyon, beden/renk, görsel | ✓ | ✓ |
| Stok güncelleme, CSV stok içe aktarma, stok hareketleri | ✓ | ✓ |
| Sipariş görüntüleme, hazırlama, kargoya verme, teslim edildi | ✓ | ✓ |
| Ödenmemiş siparişi iptal | ✓ | ✓ |
| **Ödenmiş siparişi iptal / iade / manuel iade onayı / ödeme olayları** | — | ✓ |
| İletişim mesajları | ✓ | ✓ |
| Müşteri listesi, kuponlar, ana sayfa, sayfalar, ayarlar, bülten, denetim kaydı | — | ✓ |
| Rol verme / alma | — | ✓ |

Matris veritabanında (`role_has_permission`) ve uygulamada (`src/lib/auth/permissions.ts`) aynıdır; otomatik test ikisinin eşit olduğunu doğrular. Admin kendi admin rolünü kaldıramaz (kilitlenmeyi önler).

## 3. Gösterge paneli

Son 30 günün **gerçek** verileri: net ciro (iadeler düşülmüş), ödenmiş sipariş sayısı, ortalama sepet, hazırlanacak / ödeme bekleyen / inceleme bekleyen siparişler, bekleyen iadeler, az stoklu varyantlar, yeni müşteri ve yeni mesaj sayıları. Kartlara tıklayarak ilgili filtreli listeye gidebilirsiniz. Günlük ciro grafiğinin tablo hâli “Tablo olarak göster” altında bulunur.

## 4. Ürünler

**Yeni ürün:** Ürünler → Yeni ürün. Türkçe ad yazıldıkça URL (slug) otomatik oluşur; değiştirilebilir. Kaydettikten sonra düzenleme sayfasına yönlendirilirsiniz.

- **Durum:** Taslak (mağazada görünmez) · Yayında · Arşiv (satıştan kalkar, geçmiş korunur). Silmek yerine **Arşiv** önerilir.
- **Fiyat:** KDV dahil TRY. Karşılaştırma (eski) fiyat satış fiyatından yüksekse mağazada indirim olarak görünür. Maliyet yalnızca panelde görünür.
- **İçerik:** TR zorunlu, EN isteğe bağlı (boşsa İngilizce sitede TR gösterilir). **Doğrulanmamış materyal, sertifika veya kalite iddiası yazmayın.** SEO başlığı ≤70, açıklaması ≤170 karakter.
- **Beden rehberi:** Markdown tablo. Ölçüler gerçek ölçümlerle doldurulmalıdır.
- **Koleksiyonlar:** Ürünün dahil olduğu koleksiyonları işaretleyin.

**Varyantlar (beden/renk/stok):** Her satılabilir seçenek bir varyanttır ve kendi SKU'su (büyük harf, rakam, tire) ve stoğu vardır. Fiyat boş bırakılırsa ürün fiyatı geçerlidir. Bir üründe aynı beden+renk ikinci kez eklenemez. Yayındaki ürünün **en az bir aktif varyantı** olmalıdır; yoksa mağazada listelenmez.

**Kopyala:** Ürünü taslak olarak çoğaltır (slug `-kopya`, SKU'lar `-C1`, stoklar 0, görseller paylaşılır).

**Sil:** Aktif stok rezervasyonu olan ürün/varyant silinemez; bu durumda arşivleyin. Geçmiş siparişlerdeki satırlar her zaman korunur.

## 5. Görseller

- Ürün düzenleme → **Görseller**: sürükle-bırak veya “Dosya seç”. JPEG/PNG/WebP/AVIF, dosya başına en fazla 8 MB, tek seferde 12 dosya.
- Dosyalar tarayıcıdan doğrudan Supabase Storage'a, sunucunun verdiği kısa ömürlü imzalı bağlantıyla yüklenir (`product-images` bucket'ı).
- İlk görsel otomatik kapak olur; “Kapak yap” ile değiştirin, ok tuşlarıyla sıralayın.
- **Alternatif metin** (TR/EN) erişilebilirlik ve SEO için doldurulmalıdır.
- Görseli bir renge bağlarsanız, müşteri o rengi seçtiğinde öncelikli gösterilir.
- **Yalnızca gerçek ürün fotoğrafı kullanın.** Yapay üretilmiş görseli gerçek ürün fotoğrafı gibi sunmayın. Öneri: 4:5 dikey, en az 1600 px kısa kenar, nötr/mimari arka plan, doğal ışık.
- Silinen görselin dosyası, başka bir ürün (ör. kopya) kullanmıyorsa depolamadan da silinir.
- Kategori, koleksiyon ve ana sayfa görselleri `site-assets` bucket'ına yüklenir.

## 6. Kategoriler, koleksiyonlar, beden & renk

- **Kategoriler** ağaç yapısındadır (üst kategori seçilebilir; döngü engellenir). Silinen kategorinin ürünleri kategorisiz, alt kategorileri ana kategori olur.
- **Koleksiyonlar**: ürün ekleme/çıkarma ve sıralama koleksiyon sayfasından yapılır.
- **Beden & Renk**: varyantlarda kullanılan sözlükler. Kullanımdaki bir beden/renk silinemez.

## 7. Stok kuralları

- **Eldeki** = depodaki fiziksel adet. **Rezerve** = ödeme bekleyen siparişler için ayrılan adet. **Kullanılabilir** = eldeki − rezerve (mağazada satılabilir).
- Sipariş oluşturulunca stok **rezerve** edilir (varsayılan 30 dk — Ayarlar). Ödeme doğrulanınca eldeki stoktan düşülür; süre dolarsa rezervasyon serbest kalır.
- Stok yalnızca **Stok gir / Stoğu güncelle** veya **CSV içe aktarma** ile değişir; her değişiklik gerekçesiyle **Stok hareketleri**ne yazılır. Rezerve adetin altına inilemez.
- CSV biçimi: `sku,stok` (her satıra bir varyant; değer yeni toplamdır). Hatalı satırlar ayrı ayrı raporlanır.

## 8. Siparişler

**Durumlar:** Ödeme bekleniyor → Onaylandı (ödeme doğrulandı) → Hazırlanıyor → Kargoya verildi → Teslim edildi. Ayrıca: Süresi doldu, İptal edildi, İnceleniyor (on hold), İade edildi.

- **Ödeme durumu elle değiştirilemez.** Sipariş yalnızca ödeme sağlayıcısından gelen, imzası doğrulanmış olayla “Ödendi” olur. Panelde böyle bir düğme yoktur ve veritabanı doğrudan değişikliği reddeder.
- **Hazırlanıyor:** Onaylı siparişte “Hazırlanıyor yap”.
- **Kargoya ver:** Kargo firması, takip numarası ve (isteğe bağlı) https takip bağlantısı girin. Yalnızca ödenmiş siparişlerde mümkündür.
- **Teslim edildi:** Kargodaki sipariş için.
- **İnceleniyor (on hold):** Ödeme tutarı uyuşmazlığı veya rezervasyon süresi dolduktan sonra gelen ödeme ve stok yetersizliği durumunda oluşur. İç notu okuyun; stok uygunsa “Onaylandı yap”, değilse iptal edip iade edin.
- **İç not:** Müşteri görmez.

### İptal ve iade süreci

1. **Ödenmemiş sipariş iptali** (staff/admin): gerekçe girin → rezerve stok serbest kalır.
2. **Ödenmiş sipariş iptali** (yalnızca admin): gerekçe + “Ürünleri stoğa geri ekle” → sipariş iptal edilir, kalan tutar için **iade kaydı** oluşur ve sistem ödeme sağlayıcısı üzerinden iadeyi dener.
3. **Kargolanmış/teslim edilmiş siparişte iade** (ürün iadesi, kısmi iade): İade kartından tutar ve gerekçe girin; ürünler depoya döndüyse “stoğa geri ekle”yi işaretleyin.
4. Sağlayıcı sonucu:
   - **Tamamlandı:** ödeme durumu “İade edildi / Kısmi iade” olur.
   - **Manuel gerekli:** Canlı sağlayıcının iade API'si entegre değilse iade kaydı “Beklemede” kalır. İadeyi **sağlayıcının kendi panelinden** yapın, ardından siparişte **Manuel iade onayı** formuna sağlayıcının iade referansını girip onay kutusunu işaretleyin. Bu işlem kimin yaptığıyla birlikte denetim kaydına yazılır.
   - **Başarısız:** Hata mesajını kontrol edin; “İadeyi sağlayıcı üzerinden tekrar dene” veya manuel onay kullanın.
5. Test sağlayıcısıyla (mock) ödenmiş siparişlerde iade anında tamamlanır; gerçek para hareketi yoktur.

## 9. Müşteriler

Yalnızca asgari bilgiler gösterilir (ad, e-posta, telefon, kayıt tarihi, pazarlama izni, sipariş özeti). Adresler müşterinin hesabında kalır; sipariş adresleri sipariş detayında görünür. Rol verme/alma bu sayfadadır ve onay ister.

## 10. Kuponlar

Yüzde (1–100) veya sabit tutar; asgari sepet tutarı, azami indirim, başlangıç/bitiş (İstanbul saati), toplam ve müşteri başına kullanım limiti. Kurallar sepette ve sipariş anında veritabanında kilit altında yeniden doğrulanır, limit aşılamaz. Kullanılmış kupon silinemez — pasif yapın. Ödenmeyen/süresi dolan siparişlerin kupon kullanımı otomatik serbest kalır.

## 11. Ana sayfa ve sayfalar

- **Ana sayfa blokları:** Hero, kategori ızgarası, ürün vitrini (yeni / öne çıkan / koleksiyon, 4–12 ürün), editoryal, bülten. Sıralama ok tuşlarıyla; “Gizle” ile geçici kaldırma. Bağlantılar dil öneki olmadan yazılır (`/shop`, `/collections/yeni-sezon`).
- **Duyuru çubuğu:** Ayarlar sayfasında.
- **Sayfalar:** Hakkımızda, SSS, gizlilik, çerez, KVKK, mesafeli satış, ön bilgilendirme, teslimat/iade. Markdown ile düzenlenir, önizleme sekmesi vardır (HTML çalıştırılmaz). Kurulumla gelen yasal metinler **taslaktır** ve `[YER TUTUCU]` alanları içerir: hukukçu/işletme onayı olmadan “Hukuki onay bekliyor” işaretini kaldırmayın.

## 12. Ayarlar

- Mağaza adı, destek e-postası/telefonu, duyuru.
- **KDV oranı** (%, örn. 10): boşsa KDV satırı gösterilmez. Oranı mali müşavirinizle doğrulayın.
- **Rezervasyon süresi** (5–240 dk), varsayılan az stok eşiği, **sözleşme sürümü** (yasal metinler değişince artırın; her siparişe kaydedilir).
- **Yasal işletme bilgileri** (unvan, adres, MERSİS, vergi dairesi/no, KEP, sicil no): yalnızca resmi bilgileri girin.
- **Teslimat yöntemleri:** ücret ve ücretsiz kargo eşiği (indirim sonrası ara toplam). Teslim süresi gibi vaatleri yalnızca doğrulanmışsa yazın. En az bir aktif yöntem olmadan ödeme yapılamaz.
- **Demo verilerini sil:** Kurulumla gelen `is_demo` ürünleri siler (siparişe bağlı olanlar arşivlenir). Canlıya çıkmadan önce yapın.

## 13. İletişim ve bülten

- **İletişim mesajları:** Yeni / Okundu / Arşiv. “E-posta ile yanıtla” e-posta istemcinizi açar. Kişisel veri içerdiğinden saklama süresi dolan mesajları silin.
- **Bülten:** Rıza tarihi ve metin sürümüyle birlikte listelenir, CSV olarak indirilebilir. Ticari ileti için yalnızca **Onaylı** aboneleri kullanın; İYS (İleti Yönetim Sistemi) kaydı işletmenin sorumluluğundadır. E-posta sağlayıcısı yapılandırılmadıysa çift onay e-postası gitmez ve kayıtlar “Onay bekliyor” kalır.

## 14. Denetim kaydı

Ürün, varyant, stok, fiyat, kupon, içerik, ayar, rol, kargo ve iade değişiklikleri veritabanı tetikleyicileriyle **otomatik** ve değiştirilemez şekilde kaydedilir: kim, ne zaman, hangi kayıt, hangi alanlar. Kişisel veri içeren tablolarda yalnızca değişen alan adları tutulur (değerler `***`). Kullanıcıya tıklayarak o kişinin işlemlerini filtreleyebilirsiniz. “Sistem” = otomatik işlemler (ödeme webhook'u, rezervasyon süresi dolması).

## 15. Sık karşılaşılan durumlar

| Durum | Çözüm |
|---|---|
| Ürün mağazada görünmüyor | Durum “Yayında” mı? En az bir aktif varyant var mı? |
| “Bu SKU zaten var” | SKU'lar tüm mağazada benzersizdir. |
| Stok düşürülemiyor | Rezerve adet var; ödeme bekleyen siparişler tamamlanana/süresi dolana kadar bekleyin. |
| Görsel yüklenmiyor | Dosya türü/boyutu; Supabase `product-images` / `site-assets` bucket'larının migration ile oluşturulduğunu kontrol edin. |
| Sipariş “İnceleniyor” | İç notu okuyun → onaylayın veya iptal + iade. |
| İade “Beklemede” | Sağlayıcı panelinden iade edip “Manuel iade onayı” ile kapatın. |
