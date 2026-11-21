# MAISON SURGE — CLAUDE MASTER BUILD PROMPT

Sen kıdemli bir full-stack yazılım mimarı, e-ticaret geliştiricisi, UI/UX tasarımcısı, QA mühendisi ve DevOps uzmanısın. Görevin bana **Maison Surge** için üretime alınabilir, eksiksiz bir giyim e-ticaret sitesi ve gerçek bir admin paneli teslim etmektir. Bir tasarım taslağı, demo, statik mockup, placeholder checkout veya yarım proje istemiyorum.

## Önce oku: bağlayıcı kaynaklar
1. Bu talimatla beraber verdiğim **Maison Surge marka kimliği görsellerini ve logo referanslarını** incele. Marka renkleri, logo yönü, tipografi, ürün görsel dili ve sayfa hissi için bunlar birincil kaynaktır.
2. Proje kökündeki `PROJECT_RULES.md` dosyasını **ilk iş olarak tamamen oku**. Tasarım ve teknik kararlarını buna göre ver.
3. Her yeni görevde, hata ayıklamada, refactor öncesinde ve özellik eklemeden önce `PROJECT_RULES.md` dosyasına tekrar bak. Çelişki varsa önce karar kaydına yaz; kimliği izinsiz değiştirme.
4. Bu prompt, `PROJECT_RULES.md` ve marka görselleri birlikte proje sözleşmesidir. Talimatlar belirsizse güvenli bir varsayım seç, `docs/DECISIONS.md` içinde kaydet; gereksiz sorularla işi durdurma. Ancak **ödeme sağlayıcısı canlı kimlik bilgileri, alan adı ve yasal işletme bilgileri** gibi gerçekten hesap sahibi tarafından sağlanması gereken alanlar için açıkça gerekli bilgileri belirt. Bu bilgiler olmadan canlı entegrasyonu tamamlanmış gibi gösterme.

## Nihai hedef
Tek Git deposu / tek proje kökü / tek `package.json` ile, **Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres/Auth/Storage) + Vercel** üzerinde çalışan tam bir mağaza oluştur. **Ayrı bir Express sunucusu, ayrı backend klasörü ya da ayrı hosting zorunluluğu yaratma.** Backend ihtiyaçları Next.js server-side kodu, Route Handlers, Server Actions (uygun olduğunda), Supabase SQL/RLS, gerekiyorsa Supabase Edge Functions ve güvenli webhook uçlarıyla çözülmeli. Her şey tek repo içinde versiyonlanmalı. Vercel'e yayınlama yolu belgelenmeli.

**Tam teslim:** Müşteriye açık mağaza + güvenli admin paneli + veritabanı şeması ve migration'lar + depolama + gerçek sipariş ve stok akışı + ödeme sağlayıcı entegrasyon katmanı + kurulum ve yayınlama belgeleri + otomatik testler + örnek veri + kullanılabilir arayüz. Eksik özellikleri çalışanmış gibi anlatma.

## Marka kimliği — değiştirilemez tasarım kuralları
- Marka: **MAISON SURGE**. Konsept: premium, modern, zamansız, sakin, rafine, minimalist giyim. Kategoriler: tişört, polo, sweatshirt, hoodie, kazak ve ileride eklenebilir ürün aileleri.
- Referans palet **Natural Sophistication**:
  - Sand `#E5DECF`
  - Olive `#5A6248`
  - Forest `#3A3F32`
  - Burgundy `#7B2E36`
  - Black `#1A1A1A`
- Bu beş tonu tasarım token'larına çevir. Diğer renkler yalnızca bu tonların işlevsel tonlamaları, nötr beyaz ve erişilebilir durum renkleri için sınırlı türevler olabilir. Rastgele mavi, neon, mor, turuncu, hazır şablon renkleri kullanma.
- Son logo yönü: **01 Heritage Raven**; kuzgun karakteri korunacak. Marka işareti olarak **01A Signature**, küçük nakış kullanımı için **01B Minimal** yaklaşımı referanstır. **Logo görsellerinden birebir SVG üretilebilir olduğu varsayılmamalı:** kullanılabilir bir vektör kaynağı varsa aynen kullan; yalnızca raster referans varsa onu gerçeğe uygun geçici asset olarak entegre et, `docs/ASSET_GAPS.md` içine “onaylı vektör logo gerekli” notu düş. Rastgele ikon paketinden kuş kullanma ve logoyu uydurma.
- Tipografi yönü: marka / editorial başlıklarında **Playfair Display**, UI / metinlerde **Montserrat**. Web fontları performanslı, lisanslarına uygun biçimde `next/font` ile sun. Tipografiyi orantılı ve mobil uyumlu ölçekle.
- Art direction: mimari dokular, doğal ışık, dokulu kumaş yakın planları, minimal stil fotoğrafları; sade editorial kompozisyon. Ürün görselleri gerçek ürünlere ait olmalı; sağlanan ürün fotoğraflarını kullan. Sadece demo için açıkça etiketli örnek görseller kullan.
- Navbar, hero, koleksiyonlar, ürün kartları, editorial marka alanları, footer; minimal çizgiler, zarif geçişler, okunabilir aralıklar. **Tam responsive** desktop/tablet/mobile.
- Marka dili: Türkçe birincil, İngilizce ikinci dil; ürün alanlarında çoklu dil için sürdürülebilir yapı kur. Fiyat birimi başlangıçta **TRY**. Sitedeki politika, kargo, vergi ve iade iddialarını işletmeden doğrulanmadan kesinmiş gibi yazma.

## Teknoloji ve mimari
- Next.js App Router, TypeScript `strict`, Tailwind CSS, erişilebilir ve tutarlı komponent sistemi. `src/` tercihen: `app`, `components`, `features`, `lib`, `server`, `types`, `styles`.
- Supabase: Postgres, Auth, Storage; SQL migration dosyaları, generated DB types, veri doğrulama için Zod, güçlü server-side auth/authorization.
- Server-side kritik operasyonlarda sadece güvenilir server erişimi. `service_role` anahtarı ve webhook sırları **asla client bundle'da** bulunmayacak. `.env.example` hazırlanacak; gerçek sırlar repoya girmeyecek.
- Kullanıcı-facing kritik yollar server-side korunacak; middleware tek güvenlik katmanı sayılmayacak. Admin yetkisi yalnızca client'da gizlenen butonlardan ibaret olmayacak.
- Supabase RLS her tablo için **deny-by-default** yaklaşımıyla açıkça kurulmalı; public catalog erişimi ve kullanıcıların kendi verileri dar politikalarla sağlanmalı. Admin API'leri için yetki kontrolü yapılmalı. Storage bucket kuralları da aynı yaklaşımda.
- Para değerleri integer minor unit (kuruş) veya kesin `numeric` ve net kurala göre; **float ile finansal hesaplama yok**. Tüm fiyatlar, indirimler, kargo ve vergi sunucuda yeniden hesaplanır.
- Sipariş oluşturma + stok rezervasyonu/azaltımı + ödeme onayı akışını yarış koşullarına dayanıklı, idempotent ve transaction/RPC temelli tasarla. Ürün varyant stokları birbirinden ayrılmalı; iptal/iade için gerekliyse güvenli stok geri yüklemesi olmalı.
- Görseller Supabase Storage'a admin üzerinden yüklenir; thumbnail/alt text/sıra düzeni desteklenir. Next/Image ve uygun cache mekanizmaları kullanılır.
- SEO: metadata, canonical, sitemap, robots, OG, JSON-LD ürün yapılandırılmış veri, temiz slug; çoklu dil için hreflang ve doğru URL stratejisi.
- Uygun hata sınırları, loading/skeleton durumları, empty state, toast ve erişilebilir form doğrulaması. WCAG odaklı kontrast, klavye gezinimi, focus ve reduced-motion.

## Müşteriye açık mağaza — zorunlu sayfalar ve davranışlar
1. **Ana sayfa:** üst bar, responsive navigasyon, Hero/collection, kategori girişleri, öne çıkan / yeni ürünler, editoryal marka hikâyesi, e-posta bülteni (izinli), footer. Veriler admin'den yönetilebilir; sabit kodlanmış sahte ürünler olmasın.
2. **Katalog ve kategori:** kategori alt yapısı, ürün listeleme, filtreler (kategori, beden, renk, fiyat, stok), sıralama, arama, pagination/infinite-load tercihini belgeli uygula, URL query parametrelerine yansıma.
3. **Ürün detay:** çok görsel, zoom, varyant renk/beden seçimi, varyant bazlı stok, fiyat/indirim, SKU, beden rehberi, materyal ve bakım, açıklama, teslimat/iade bilgi bağlantıları, ilgili ürünler, favori ve sepete ekleme; stok yoksa seçenek engelle.
4. **Sepet:** misafir sepeti + giriş sonrası birleştirme politikasını belgele; adet/güncelleme/silme, fiyat özetleri, kupon (varsa), stok ve fiyatın checkout öncesi sunucuda doğrulanması.
5. **Üyelik:** kaydol, giriş, şifre sıfırla, e-posta doğrulama, çıkış, hesap/profil, adres defteri, sipariş geçmişi, favoriler. OAuth opsiyonel; yapı sağlam olsun.
6. **Checkout:** adres, teslimat yöntemi, fatura bilgisi, sipariş özeti, ödeme başlatma, sonuç, başarı/başarısızlık, iptal / tekrar deneme. Misafir checkout isteniyorsa buna göre güvenli model kur; seçim ve gerekçesini kaydet.
7. **Ödeme:** Türkiye'ye uygun gerçek sağlayıcı entegrasyonu için **adapter/interface** tasarla (ör. iyzico/PayTR alternatifleri değerlendirilebilir). Sağlayıcı tercihi ve gerekli hesap/anahtar bilgisi henüz verilmediği için birini sahte şekilde “canlı ve tamamlandı” ilan etme. Güvenli test/sandbox implementasyonu, webhook imza doğrulaması, idempotency, server-side ödeme durum eşlemesi, loglama; canlıya geçiş checklist'i oluştur. Ödeme onayı asla yalnızca tarayıcı yönlendirmesiyle yapılmasın.
8. **Bilgi sayfaları:** Hakkımızda, iletişim, SSS, gizlilik, çerez politikası/tercihleri, mesafeli satış sözleşmesi, ön bilgilendirme, teslimat ve iade, KVKK aydınlatma. İçerikler hukukçu/işletme tarafından onaylanacak düzenlenebilir taslaklar olarak sunulsun; uydurma şirket/adres/telefon yazma.
9. **UX:** arama, favoriler, düzgün mobil menü, erişilebilir modal/drawer, gerçek boş ve hata durumları, 404, loading states.

## Admin panel — sadece tasarım değil, çalışır uygulama
- `/admin` içinde güvenli role-based admin; `admin` ve gerekirse `staff` yetki matrisi, sunucu tarafı kontrol.
- Dashboard: sipariş ve satış özetleri, son siparişler, az stok, temel KPI'lar; ölçümler veritabanına dayalı olsun.
- Ürün CRUD: isim/slug/açıklama/TR-EN, fiyat, karşılaştırma fiyatı, maliyet opsiyonel, kategori, koleksiyon, yayın durumu, öne çıkarma, SEO alanları, materyal/bakım, SKU, beden-renk varyantları, varyant bazlı stok.
- Görsel yönetimi: çoklu upload, sıralama, kapak görseli, silme, alt text; storage izinleri.
- Kategori/koleksiyon CRUD; ana sayfa banner ve vitrin blokları yönetimi; kupon/indirim (kurallı, tarihli, kullanım limitli); beden ve renk sözlükleri.
- Sipariş yönetimi: liste, detay, durum geçişleri, ödeme durumu, kargo takip numarası / taşıyıcı, iptal/iade kayıtları; geçiş kurallarını güvenli uygula. Ödeme onayını admin'in keyfi değiştirmesine izin verme.
- Müşteri listesi: gerekli olan minimum kişisel bilgi, rol bazlı erişim; sipariş geçmişi.
- İletişim formları/bülten izinleri, site ayarları, kargo ücretleri / ücretsiz kargo eşiği gibi iş kuralları, temel içerik/politika editörü.
- Admin aksiyonlarında audit log (kim, neyi, ne zaman değiştirdi). Tehlikeli eylemlerde onay diyaloğu.
- Formlarda validasyon ve anlaşılır hata mesajları; bulk edit/import (CSV) mümkünse; ilk sürümde en azından çalışır ürün kopyalama özelliği.

## Veri modeli — en azından düşün ve migration ile uygula
`profiles`, `roles`/`user_roles`, `addresses`, `categories`, `collections`, `products`, `product_translations`, `product_variants`, `product_images`, `collection_products`, `carts`, `cart_items`, `wishlists`, `orders`, `order_items`, `inventory_movements`/`stock_reservations`, `payments`, `payment_events`, `shipments`, `coupons`, `coupon_redemptions`, `site_settings`, `homepage_sections`, `newsletter_subscriptions`, `contact_messages`, `audit_logs` ve gereken diğer tablolar. İsimler gereksinime göre değişebilir ama **özellikler veritabanında gerçekten karşılanmalı**. Referential integrity, unique constraints, foreign keys, indexes, timestamp ve bütünlük kontrolleri olmalı.

## Güvenlik, gizlilik, iş sürekliliği
- XSS/CSRF riskleri, rate limiting, bot/spam koruması, güvenli input validation, minimum privilege ve brute-force koruması; Next.js/Supabase'in güncel ve desteklenen önerilerine uygun uygula.
- Şifreleri kendin saklama; Supabase Auth kullan. E-posta/SMS servis bilgisi olmayan akışlarda gerçek gönderimi taklit etme; kurulum gereksinimlerini belgeleyerek test et.
- Webhook olayları tekrar gelse bile iki kez sipariş ödeme/stok işlemi olmamalı.
- Satış analitiği ve çerez tercihleri için açık rıza gerektiren davranışları varsayılan açık yapma.
- Secrets yönetimi, loglarda kişisel veri maskeleme, hata izleme, DB backup/restore ve depolama maliyetleri için uygulanabilir belgeler oluştur.

## Test ve kabul kriterleri
- Lint, typecheck, build ve unit/integration testlerini çalıştır; varsa hataları gider.
- Playwright e2e en az: ana sayfa -> kategori -> ürün -> varyant -> sepet -> checkout sandbox, giriş/kayıt, favori, admin login guard, admin ürün oluştur/güncelle, varyant stok düşme, yetkisiz admin erişiminin reddi, ödeme webhook tekrarının güvenle işlenmesi.
- Mümkünse gerçek Supabase test projesi veya local Supabase ile entegrasyon testleri; bağlanamadığın bağımlılıkları “test edildi” diye işaretleme.
- Mobil 375px, tablet 768px, desktop 1440px'te kırılmayan yerleşim; Lighthouse ve erişilebilirlik kontrolü.
- **Sahte başarı yok:** demo dışındaki ürünler, kullanıcılar, işlemler ve istatistikler gerçek veriden gelmeli; işlem tamamlanmadıysa hata/hazır değil durumu göstermeli.

## Teslim dosyaları ve belgeler
Proje **tek kök klasörde** olmalı. En az aşağıdakileri içermeli:
- Tam çalışan kaynak kod ve gerekli konfigürasyon (`package.json`, lockfile, `next.config`, TS, Tailwind, lint vb.)
- `supabase/migrations/` altında sıralı, tekrar edilebilir SQL migration dosyaları
- `supabase/seed.sql` veya eşdeğer güvenli demo veri yükleme yöntemi
- `.env.example` (değer ve hangi servisten alınacağı açıklamaları)
- `README.md` — Windows/macOS yerel kurulum, Supabase projesi oluşturma, migration'ları çalıştırma, admin hesabı kurma, geliştirme, test, Vercel deployment, domain, Storage bucket ve webhook yapılandırma
- `PROJECT_RULES.md` — bu ekteki belgenin kökte korunmuş hâli
- `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/ADMIN_GUIDE.md`, `docs/TEST_REPORT.md`, `docs/DECISIONS.md`, `docs/ASSET_GAPS.md`, `docs/RELEASE_CHECKLIST.md`
- Admin erişimi için **güvenli** bootstrap yöntemi; herkese açık sabit admin parolası veya kayıt olan ilk kullanıcının otomatik admin olması yasak.

## Çalışma düzeni (uygula)
1. Referans görselleri ve `PROJECT_RULES.md` oku; marka token'larını çıkar.
2. `docs/IMPLEMENTATION_PLAN.md` içinde net iş paketlerini ve kabul koşullarını oluştur.
3. Önce kurulum/mimari + Supabase şema/RLS + auth, ardından mağaza sayfaları, checkout, admin ve testleri **çalışır dikey dilimler** olarak kodla.
4. Her iş paketinden sonra `npm run lint`, `npm run typecheck`, `npm run build` ve ilgili testleri çalıştır; bulduğun problemleri çöz.
5. Bir iş yarım kaldıysa `docs/IMPLEMENTATION_PLAN.md` ve `docs/TEST_REPORT.md` içinde açıkça işaretle. Eksik dosyaların yerine “TODO” veya çalışmayan buton bırakıp tamamlandı deme.
6. Uzun görevlerde ilerleme durumunu repo içinde `docs/PROGRESS.md` ile sürdür; bağlam değişirse öncelikle bu dosyaları tekrar oku.
7. Son yanıtta şu tabloyu ver: **Özellik | Durum (çalışıyor/test edildi/harici hesap bekliyor/eksik) | Dosya yolu | Doğrulama**. Çalıştırdığın gerçek komutlar ve sonuçlarını listele.

## Kritik son talimat
Ben senden yalnızca plan veya örnek komponent değil, **çalışan e-ticaret uygulamasının kodunu** bekliyorum. Uygulamayı tek repo içinde gerçekten inşa et. Marka kimliğinden sapma. İzin / API anahtarı / gerçek görsel / ödeme sözleşmesi olmadan tamamlanamayacak harici adımları dürüstçe ayrı işaretle; buna rağmen geri kalan tüm altyapıyı, yönetim panelini, sayfaları ve testleri eksiksiz uygula. Bilmediğin gizli anahtarları, fiyatları, kargo vaatlerini veya şirket bilgilerini uydurma.

**Başla:** Önce görsel referansları ve `PROJECT_RULES.md` dosyasını oku, sonra dosyaları oluşturarak uygulamayı geliştir.
