# Canlıya Çıkış Kontrol Listesi

Durum: ⛔ = bloklayıcı (işletme/harici girdi gerekli) · ☐ = yapılacak teknik adım · ✅ = hazır

## ⛔ İşletme / harici girdi gerektiren bloklayıcılar
- ⛔ **Ödeme sağlayıcısı**: sözleşme (iyzico / PayTR / diğer), canlı API anahtarları. iyzico adapter'ı yazıldı ancak sandbox anahtarıyla **doğrulanmadı**; seçilen sağlayıcı farklıysa yeni adapter gerekir.
- ⛔ iyzico kullanılacaksa `identityNumber` (TCKN) politikası (D-020).
- ⛔ **Yasal metinler**: KVKK aydınlatma, gizlilik, çerez, mesafeli satış, ön bilgilendirme, teslimat/iade — hukukçu onayı. Admin → Sayfalar'da `needs_legal_review` kapatılmalı.
- ⛔ **İşletme bilgileri**: unvan, adres, MERSİS, vergi dairesi/no, KEP, destek e-posta/telefon (Admin → Ayarlar).
- ⛔ **KDV oranı** (Admin → Ayarlar; boş bırakılırsa KDV satırı gösterilmez) ve e-fatura/e-arşiv süreci (bu projede fatura kesimi YOK — muhasebe entegrasyonu ayrıca planlanmalı).
- ⛔ **Kargo**: taşıyıcı, ücretler, ücretsiz kargo eşiği (seed'deki değerler örnektir), teslim süresi metinleri.
- ⛔ **Onaylı vektör logo** ve favicon (ASSET_GAPS A-01/A-02).
- ⛔ **Gerçek ürünler**: fotoğraflar, açıklama, materyal/bakım, beden tabloları, fiyat, stok.
- ⛔ **Alan adı** ve DNS erişimi.
- ⛔ **E-posta**: Supabase Auth için özel SMTP; sipariş e-postaları için Resend (veya eşdeğeri) + gönderici alan adı doğrulaması (SPF/DKIM).
- ⛔ İYS (İleti Yönetim Sistemi) kaydı — ticari elektronik ileti (bülten) gönderilecekse.

## ☐ Teknik adımlar
- ☐ Canlı Supabase projesi, migration'lar uygulandı; seed **uygulanmadı** (veya demo veriler silindi: Admin → Ayarlar → Demo verilerini sil).
- ☐ İlk admin `npm run admin:grant` ile atandı; test hesapları silindi.
- ☐ Supabase Auth URL'leri, e-posta şablonları (`/auth/confirm`), SMTP.
- ☐ `pg_cron` ile rezervasyon temizliği (DEPLOYMENT §2.5).
- ☐ Vercel env değişkenleri (DEPLOYMENT §3), `ALLOW_MOCK_PAYMENTS_IN_PRODUCTION=false`, `PAYMENT_PROVIDER=<canlı>`.
- ☐ Staging'de sağlayıcı sandbox'ı ile uçtan uca: başarılı, başarısız, iptal, tekrar deneme, webhook tekrarı, iade.
- ☐ `E2E_FULL=1 npm run test:e2e` staging projesine karşı yeşil.
- ☐ Webhook URL'si sağlayıcı panelinde; geri dönüş URL'si canlı alan adı.
- ☐ Supabase Security Advisor: uyarı yok.
- ☐ Lighthouse (mobil) ana sayfa / kategori / ürün: Performans ≥ 85, Erişilebilirlik ≥ 95, SEO ≥ 95 — gerçek görsellerle ölçülmeli.
- ☐ Gerçek cihazlarda 375 / 768 / 1440 kontrolü ve klavyeyle tam satın alma akışı.
- ☐ Yedekleme: Supabase Pro günlük yedek veya planlı `pg_dump` (DATABASE.md).
- ☐ Uptime izleme `/api/health`.
- ☐ Analitik eklenecekse yalnızca `useConsent()` ile açık rıza sonrası yüklenmeli; çerez politikası güncellenmeli.
- ☐ Google Search Console: alan adı doğrulama + `sitemap.xml`.

## ✅ Hazır olanlar (bu repoda)
- ✅ Şema, RLS (deny-by-default), yetki matrisi, audit log — DB testleriyle doğrulandı.
- ✅ Sipariş/stok/ödeme transaction'ları, idempotent webhook — DB ve birim testleriyle doğrulandı.
- ✅ Mock (sandbox) ödeme sağlayıcısı uçtan uca (gerçek Supabase'e karşı e2e çalıştırılmalı — TEST_REPORT).
- ✅ Güvenlik başlıkları, rate limit, honeypot, açık yönlendirme koruması.
- ✅ SEO: metadata, canonical, hreflang, sitemap, robots, JSON-LD.
