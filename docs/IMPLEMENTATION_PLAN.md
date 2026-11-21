# Uygulama Planı ve İş Paketleri

Durum anahtarı: ✅ tamamlandı ve doğrulandı · 🟡 tamamlandı, harici hesap/ortam olmadan uçtan uca doğrulanamadı · ⛔ harici girdi bekliyor · ❌ yapılmadı

| # | İş paketi | Kabul koşulları | Durum |
|---|---|---|---|
| WP-01 | Kurulum & mimari | Tek repo/`package.json`, Next 16 App Router, TS strict, Tailwind 4, ESLint, Vitest, Playwright; `lint`, `typecheck`, `build` geçer | ✅ |
| WP-02 | Marka token'ları & UI kiti | 5 renk + türevleri tek yerde (`globals.css @theme`), Playfair/Montserrat `next/font`, erişilebilir buton/form/dialog/drawer/toast/badge/alert/skeleton/empty state | ✅ (logo ⛔ ASSET_GAPS) |
| WP-03 | Veritabanı şeması + RLS | Tüm tablolar migration'da, RLS her tabloda, deny-by-default yetkiler, FK/UNIQUE/CHECK/index; PGlite'ta uygulanır | ✅ `tests/db/rls.test.ts` |
| WP-04 | Sipariş/stok/ödeme fonksiyonları | Transaction + satır kilidi, fiyat/kupon/kargo yeniden doğrulama, rezervasyon/süre dolumu, idempotent webhook, iptal/iade/stok iadesi, ödeme durumu koruması | ✅ `tests/db/orders-payments.test.ts` |
| WP-05 | Auth & roller | Supabase Auth; kayıt/giriş/çıkış/şifre sıfırlama/e-posta doğrulama; admin bootstrap; otomatik admin yok | ✅ kod + DB testi · 🟡 gerçek e-posta akışı |
| WP-06 | i18n & SEO | `/tr` `/en`, sözlük anahtar eşitliği testi, canonical/hreflang/OG/JSON-LD/sitemap/robots | ✅ |
| WP-07 | Ana sayfa | Admin yönetimli bloklar (hero, kategori, ürün rafları, editoryal, bülten), duyuru çubuğu | ✅ · 🟡 gerçek Supabase e2e |
| WP-08 | Katalog | Kategori/koleksiyon/arama, filtre (beden, renk, fiyat, stok), sıralama, sayfalama, URL senkronu | ✅ SQL testi · 🟡 e2e |
| WP-09 | Ürün detay | Çoklu görsel + zoom, renk/beden, varyant stoğu, tükenen seçenek engeli, SKU, beden rehberi, materyal/bakım, ilgili ürünler, favori | ✅ · 🟡 e2e |
| WP-10 | Sepet | Misafir + giriş sonrası birleştirme, adet/silme, kupon, sunucu fiyatlandırma, stok uyarıları | ✅ · 🟡 e2e |
| WP-11 | Checkout | Adres (kayıtlı adresler), fatura (bireysel/kurumsal), teslimat yöntemi, sözleşme onayı, misafir checkout, idempotency | ✅ · 🟡 e2e |
| WP-12 | Ödeme adapter'ı | Arayüz, mock sandbox (imzalı webhook), iyzico Checkout Form, sonuç/başarısız/tekrar dene sayfaları, iade işleme | ✅ mock · ⛔ iyzico canlı doğrulama |
| WP-13 | Hesap alanı | Profil, adres defteri, sipariş geçmişi/detay, favoriler | ✅ · 🟡 e2e |
| WP-14 | Bilgi & yasal sayfalar | Düzenlenebilir Markdown taslaklar, hukuki onay uyarısı, iletişim formu, bülten (izinli), çerez tercihleri | ✅ · ⛔ hukuki içerik |
| WP-15 | Admin paneli | Dashboard, ürün/varyant/görsel/stok, kategori/koleksiyon/sözlükler, envanter, sipariş/kargo/iptal/iade, müşteriler/roller, kupon, ana sayfa, sayfalar, ayarlar/kargo, gelen kutusu/bülten, audit | bkz. PROGRESS.md |
| WP-16 | Güvenlik | Rate limit, honeypot, CSP & başlıklar, açık yönlendirme koruması, PII maskeleme | ✅ |
| WP-17 | Testler | Birim + DB entegrasyon + e2e smoke + e2e full | ✅ birim/DB/smoke · 🟡 full e2e (test Supabase projesi gerekli) |
| WP-18 | Belgeler | README, ARCHITECTURE, DATABASE, DEPLOYMENT, ADMIN_GUIDE, TEST_REPORT, DECISIONS, ASSET_GAPS, RELEASE_CHECKLIST, PROGRESS | ✅ |

## Bilinen sınırlamalar (bilinçli kapsam dışı)
- Fatura (e-arşiv/e-fatura) kesimi ve muhasebe entegrasyonu yok.
- Kargo firması API entegrasyonu yok (takip numarası/URL elle girilir).
- iyzico iade API'si yok (manuel iade onayı akışı var).
- OAuth (Google/Apple) sağlayıcıları yapılandırılmadı; `/auth/callback` PKCE rotası hazır.
- Kısmi iade için satır bazında stok iadesi yok (tam iadede tüm satırlar; kısmi iadede stok elle düzeltilir).
- Bülten çift onayı e-posta sağlayıcısı olmadan `pending` kalır.
