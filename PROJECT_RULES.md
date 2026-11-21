# MAISON SURGE — PROJECT RULES / SINGLE SOURCE OF TRUTH

> **ZORUNLU OKUMA:** Bu dosya Maison Surge reposunun kökünde kalmalıdır. Her yeni özellik, hata düzeltmesi, refactor, tasarım değişikliği ve yayına alma öncesi yeniden okunmalıdır. İçindeki bir kuralı değiştirmek gerekirse gerekçeyi `docs/DECISIONS.md` içine kaydet ve marka kimliği değiştiren kararlar için proje sahibinin onayını al.

## 0. Proje tanımı ve değişmezler
- **İsim:** MAISON SURGE.
- **Ürün:** Kendi markalı giyim e-ticaret sitesi; tişört, polo, sweatshirt, hoodie, kazak vb.
- **İmaj:** `Natural Sophistication` — sessiz, çağdaş, kaliteli, mimari, zamansız, premium.
- **Mimari:** Tek repo/tek proje kökü, Next.js + TypeScript + Tailwind + Supabase + Vercel.
- **Frontend ve backend:** Aynı Next.js projesinde. API/route handlers/server functions ve DB migrations aynı repoda. Ayrı Express sunucusu açma.
- **Yayın:** Frontend/Next.js Vercel, auth/database/storage Supabase.
- **Admin:** `/admin` içinde gerçek, server-side yetki denetimli panel.
- **Varsayılan para birimi:** TRY; finansal hesaplamalarda float kullanma.
- **Dil:** TR varsayılan, EN destekli. URL/çeviri ve locale kararı tutarlı olsun.

## 1. Marka referanslarının öncelik sırası
1. Kullanıcının sağladığı **onaylı** logo dosyaları/marka kimliği görselleri.
2. Bu belgedeki kesin hex ve tipografi değerleri.
3. Onaylı tasarım sistemi ve proje içinde kayda alınmış kararlar.
4. Geliştiricinin teknik uygulama kararları.

Görsel referanslardan okunamayan veya elde olmayan bir asset'i uydurma. Gereken asset'i `docs/ASSET_GAPS.md` içinde adlandır. Siteyi işlevsiz bırakmadan, **açıkça geçici** ve markaya uyumlu placeholder kullan.

## 2. Renk token'ları
| Token | Hex | Kullanım |
| --- | --- | --- |
| `brand.sand` | `#E5DECF` | Ana açık zemin, kumaş/ürün bağlamları |
| `brand.olive` | `#5A6248` | Vurgu butonları, ikincil bloklar |
| `brand.forest` | `#3A3F32` | Koyu zeytin zemin, hover, editorial |
| `brand.burgundy` | `#7B2E36` | Ölçülü premium vurgu, seçili alanlar |
| `brand.black` | `#1A1A1A` | Tipografi, ana koyu arka plan |

### Renk kuralları
- Genel sistem Sand + Black temellidir; Olive/Forest yön verir, Burgundy **az ve dikkatli** vurgudur.
- UI durum renkleri (error/success/warning), erişilebilirlik gereksinimleri ve nötr beyaz dışında alakasız palet yaratma.
- Text/background kontrastı WCAG AA hedeflemeli; özellikle zeytin ve bordo üzerindeki küçük metinleri kontrol et.
- CSS custom properties/Tailwind tokens ile merkezileştir; komponentlerin içine dağınık sabit hex gömme.

## 3. Logo ve marka işareti
- Seçilmiş yön: **Heritage Raven (01)**; gerçek kuzgun karakterini koruyan kaliteli, sade siluet.
- **01A Signature** büyük dijital/print ana kullanım; **01B Minimal** küçük nakış, etiket ve favicon adayı.
- Logonun kendisi soldan sağa bakan kuzgunu, belirgin gagayı ve karakteristik gövde duruşunu taşımalı; çizgi süslemeleri aşırı kalabalık olmamalı.
- Rastgele Lucide/Font Awesome kuş ikonu, emoji, stok logo veya bambaşka hayvan kullanma.
- Onaylı SVG mevcut değilse raster referansı geçici olarak kullan ve vektör ihtiyacını kaydet. Otomatik tracing'in kusursuz vektör ya da nakış makinesi dosyası olduğunu iddia etme.
- Nakışa uygun nihai simge için küçük ölçekte okunabilir siluet, tek renk uygulanabilirlik, düşük detay sayısı gereklidir. Üretici tarafından minimum çizgi/boşluk ve DST/PES dönüşümü ayrıca kontrol edilmelidir.
- Marka adı her zaman **MAISON SURGE** şeklinde doğru yazılmalı.

## 4. Tipografi
- **Editorial / branding / H1-H3:** Playfair Display (gerekirse belirlenmiş italic varyantı).
- **UI / body / forms / buttons / fiyat:** Montserrat.
- Fontları `next/font` aracılığıyla yükle; CLS/performance ve Türkçe karakter desteğini doğrula.
- Hiyerarşi: zarif serif vitrin başlığı + sade sans-serif UI; zor okunur aşırı letter-spacing veya çok ince küçük metinlerden kaçın.

## 5. Görsel dil ve UI
- Mimari ışık/gölge, taş/beton, doku, örgü, pamuk, dokuma, doğal pozlar.
- Bol boşluk, ince ayırıcılar, dengeli ızgara, ölçülü animasyon.
- Köşe yuvarlamaları ölçülü; neon/glassmorphism/oyuncak görünümü istemiyoruz.
- Görsellerde logo veya işlemeli kuzgun kullanılıyorsa **onaylı asset** üzerinden çalış; yapay görüntüyü gerçek ürün fotoğrafı diye sunma.
- En az 375px / 768px / 1440px'te sorunsuz; tap hedefleri, klavye, odak stilleri ve reduced motion destekli.
- Ana sayfa temel bölümler: Announcement/header, hero, kategoriler, best sellers/new arrivals, brand story, newsletter, footer. Home içerikleri admin üzerinden yönetilebilir.

## 6. Bileşen davranış ilkeleri
- Görseli tıklanan kart doğru ürüne, kategori kartı doğru kategoriye yönlendirir.
- Favori butonu gerçekten favoriye ekler/siler; girişsiz kullanıcı davranışı açık ve testlidir.
- Sepet varyant bazlıdır; fiyatlar sunucudan gelir, stok doğrulanır.
- Checkout gerçek sipariş akışına bağlıdır; test modları açık etiketlidir.
- Loading, error, empty ve success durumları kapsanır. Sadece dekoratif, çalışmayan buton bırakma.
- Toast, alert, modal, form ve klavye gezinimi erişilebilir olur.

## 7. Veri, yetki ve güvenlik
- Supabase Auth kullan; parola saklama veya kendi auth sistemi yazma.
- Her tablo için RLS. Public okuma: yalnızca yayınlanmış, görünür katalog. Özel veriler kişiye/role sınırlı.
- Admin mutasyonları API/server tarafında role kontrolünden geçer; browser'da gizlenmiş sayfa yeterli güvenlik değildir.
- Supabase service role key, ödeme anahtarları ve webhook secret **yalnızca server env** içinde.
- Kullanıcı ve admin inputları Zod ile doğrulanır, çıkışlar güvenle render edilir.
- Admin role bootstrap için sırları repoya yazma; varsayılan `admin/admin` hesabı asla oluşturma.
- Kullanıcı verisi yalnızca ihtiyaç kadar toplanır. Audit log PII maskelemeyi ve en az yetki ilkesini izler.
- Finansal değerleri minor unit veya kesin decimal ile tut; toplamı ve kargoyu server yeniden hesaplar.
- Stok değişikliği/rezervasyonu ve ödemeler transaction-safe, yarış koşullarına dayanıklı, webhook idempotent olmalı.

## 8. Ürün ve katalog kuralları
- Ürün ile varyantı ayır: ürün bilgisi ayrı, SKU/renk/beden/stok/fiyat farklılaşabiliyorsa varyantta.
- Birden fazla fotoğraf, alt-text, sıra, kapak; görseller Supabase Storage.
- Kategori, koleksiyon, yayın durumu, satış fiyatı/indirim, SEO, materyal/bakım bilgisi alanları.
- Admin paneli veri modeline uygun gerçek CRUD üretmeli.
- Ürün ayrıntıları bilinmiyorsa sahte malzeme/sertifika/kalite iddiası yazma.

## 9. Sipariş ve ödeme doğruluğu
- Sipariş ve ödeme durumları ayrı takip edilir.
- Kullanıcının “ödeme başarılı” ekranına gelmesi tek başına ödeme kanıtı değildir; imzalı doğrulanmış webhook/server-to-server kontrol gerekir.
- Yeniden gelen webhook çift stok azaltma/çift ödeme kaydı üretmemeli.
- Ödeme sağlayıcısı seçilmediği sürece çalışan test adapter'ı ve canlı entegrasyon için net checklist olabilir; **canlı ödeme varmış gibi gösterme**.
- İptal, refund, kargo ve stok geri iade süreçlerini iş kurallarıyla modeller.

## 10. Admin paneli zorunlu modülleri
1. Dashboard (gerçek özet veriler)
2. Ürün, varyant, beden/renk, görsel, stok yönetimi
3. Kategori ve koleksiyon yönetimi
4. Sipariş, kargo ve iade/iptal kayıtları
5. Müşteri/üyelik görüntüleme (asgari kişisel veri)
6. Kupon ve kampanya yönetimi
7. Ana sayfa banner, sıralama, öne çıkanlar ve içerik alanları
8. Site ayarları, politikalar, iletişim formları, bülten izinleri
9. Audit log ve yetki yönetimi

## 11. Repo ve geliştirme disiplini
- Tek repo; bir kök `package.json`; tercihen `src/` alt klasörleri düzenli.
- `supabase/migrations/` veritabanının doğrulanabilir kaynağıdır. Dashboard'da yapılan kritik manuel değişiklikleri migration'a geri yaz.
- TS `strict`, tutarlı linter/formatter, testler.
- `.env.example` var; `.env.local` ve anahtarlar git dışında.
- Her feature öncesi ve sonrasında `PROJECT_RULES.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/PROGRESS.md` oku/güncelle.
- Hatalı özelliği sadece gizleme; kök nedeni bul ve test yaz.
- Değişiklik sonrasında `npm run lint`, `npm run typecheck`, `npm run build` ve ilgili testleri çalıştır. Sonuçları `docs/TEST_REPORT.md` içine gerçek çıktıyla yaz.
- Yarım/harici bağımlı işi tamamlandı diye işaretleme.

## 12. Test için olmazsa olmaz senaryolar
- Misafir katalog ve ürün gezebilir.
- Filtre/arama/sıralama doğru ve URL ile tutarlı çalışır.
- Varyant (beden/renk) ve stok doğru seçilir.
- Sepet artırma/azaltma ve checkout öncesi yeniden doğrulama çalışır.
- Auth, profil, favoriler ve sipariş geçmişi çalışır.
- Yetkisiz kullanıcı `/admin` içeriğine ve admin API'lerine erişemez.
- Admin ürün/varyant/fotoğraf/stok oluşturur/günceller/siler.
- Ödeme sandbox ve imzalı webhook tekrarı test edilir.
- Telefon, tablet, masaüstü ve klavye erişilebilirliği kontrol edilir.

## 13. Deploy ve operasyon
- Vercel proje bağlama, root ayarları, environment variables, Supabase URL/anahtarlar, redirect URLs, storage ve callback/webhook URL'leri belgeli.
- SQL migrations ve seed komutları tekrar edilebilir.
- Başlatma: `npm install` + env + migration + `npm run dev` (gerçek script isimlerini README'de doğrula).
- Vercel build'i geçmeli, server-only sırlar istemciye çıkmamalı.
- Domain, gerçek ödeme ve resmi hukuki sayfa içerikleri işletme girdisi gerektirir; canlıya çıkış checklist'inde bloklayıcılar olarak göster.

## 14. İlerleme ve karar defteri
Her oturum ve problemde şu sıra izlenecek:
1. Bu dosyayı oku.
2. `docs/PROGRESS.md` ve `docs/DECISIONS.md` oku.
3. İlgili özelliğin mevcut kod/testlerini incele.
4. Gereken en küçük güvenli değişiklikleri uygula.
5. Test et, dokümanları güncelle.

**Sonuç standardı:** “Eksiksiz teslim” = çalışan kod + migration + güvenlik + admin + mobil uyum + test + deploy dokümantasyonu. Eksik üçüncü taraf hesap/anahtarlar yalnızca açıkça listelenmiş entegrasyon engeli olabilir; bunun dışında sahte bir tamamlanmışlık beyanı kabul edilmez.
