# Test Raporu

**Tarih:** 2026-11-21 · **Ortam:** Windows 10, Node 24.16.0, npm 11.13.0 · Docker / Supabase CLI **yok**.

## Özet

| Kontrol | Komut | Sonuç |
|---|---|---|
| Lint | `npm run lint` | ✅ 0 hata, 0 uyarı |
| Tip kontrolü | `npm run typecheck` | ✅ 0 hata (TS strict + `noUncheckedIndexedAccess`) |
| Birim + DB testleri | `npm test` | ✅ 10 dosya, **82/82** geçti |
| Migration doğrulama | `npm run db:verify` | ✅ 8 migration + seed (seed iki kez — idempotent): 10 ürün, 80 varyant, 8 sayfa |
| Üretim derlemesi | `npm run build` | ✅ başarılı (Turbopack), tüm rotalar derlendi |
| E2E smoke | `E2E_CHANNEL=chrome npm run test:e2e` | ✅ **27/27** geçti (9 test × 3 viewport: 1440 / 768 / 375) |
| E2E full | `E2E_FULL=1 … npm run test:e2e` | ⏸️ **çalıştırılmadı** — 21 test atlandı (test Supabase projesi gerekli, aşağıya bakın) |

## Neyin GERÇEKTEN doğrulandığı

### Veritabanı (PGlite = gerçek Postgres 18, WASM)
Migration'lar Supabase'i taklit eden bir ortama uygulanır: `anon`/`authenticated`/`service_role` rolleri, `auth.uid()` (JWT claim), `auth.users`, `storage.objects` ve Supabase'in **varsayılan ALL yetkileri** (deny-by-default'un bunları geri aldığını kanıtlamak için). Testler `SET ROLE` + JWT claim ile gerçek RLS altında çalışır.

| Dosya | Test | Kapsam |
|---|---|---|
| `tests/db/rls.test.ts` | 11 | Her public tabloda RLS açık; anon'da hiçbir yazma yetkisi yok; anon sepet/sipariş/ödeme/kupon/audit/profil okuyamaz; yalnızca yayınlanmış ürünler görünür (tablo + `catalog_search`); müşteri ürün ekleyemez, staff ekleyebilir; maliyet gizli; filtre/sıralama/arama + SQL enjeksiyon denemesi; kullanıcılar yalnızca kendi sipariş/adres/favorilerini görür ve başkası adına yazamaz; yeni kullanıcıya profil oluşur ama **rol verilmez**; kullanıcı kendine rol veremez (3 yol); admin işlemleri actor ile audit'e yazılır |
| `tests/db/orders-payments.test.ts` | 17 | Sipariş stok rezerve eder + idempotency anahtarı; oynanmış fiyat/kargo reddi; **overselling engeli**; `create_order` anon/authenticated için kapalı; **webhook tekrarı stoğu bir kez düşer** (aynı event → `duplicate_event`, farklı event → `already_paid`, tek `sale` hareketi); tutar uyuşmazlığında onay yok (`on_hold`); başarısız ödeme tekrar denenebilir + idempotent; ödeme durumu ve stok **doğrudan UPDATE ile değiştirilemez** (tablo sahibi dahil); rezervasyon süresi dolumu stoğu serbest bırakır, geç ödeme stok varsa onaylanır; ödenmiş sipariş iptali stoğu iade eder + iade kaydı + iade tamamlama idempotent; staff ödenmiş siparişi iptal edemez, geçersiz geçişler reddedilir; müşteri admin fonksiyonlarını çağıramaz; stok düzeltme hareket kaydı yazar; ürün kopyalama taslak + sıfır stok; kupon kullanım limiti ve indirim tutarı doğrulaması |
| `tests/db/permissions.test.ts` | 2 | SQL ve TypeScript yetki matrisi birebir aynı |
| `tests/db/admin-helpers.test.ts` | 2 | `admin_user_emails` yalnızca admin; `admin_low_stock_variants` staff'a açık, müşteriye kapalı |

### Birim testleri
| Dosya | Test | Kapsam |
|---|---|---|
| `tests/unit/pricing-money.test.ts` | 9 | Kuruş biçimlendirme/parse (TR/EN, belirsiz giriş reddi), float kullanmadan ondalık dize; yüzde/sabit kupon, tavan, alt limit; ücretsiz kargo eşiği (indirimli ara toplam); dahil KDV yuvarlama |
| `tests/unit/payments.test.ts` | 7 | Mock webhook HMAC imzası: geçerli/oynanmış/yanlış anahtar/eski zaman damgası; imzasız/sahte olay DB'ye dokunmadan 400; aynı event id `confirm_payment`'a iletilir (idempotency); başarısız → `fail_payment`; şema dışı yük ve bilinmeyen sağlayıcı reddi; DB hatasında 500 (sağlayıcı tekrar dener); iyzico sepet dağıtımı tam sayı ve toplam = genel toplam |
| `tests/unit/catalog-checkout.test.ts` | 13 | Katalog URL parametreleri temizleme/geri düşme/korunma; checkout şeması (misafir, sözleşme onayı zorunlu, kurumsal fatura alanları, posta kodu/telefon DB ile aynı kurallar); EN/TR sözlük anahtar eşitliği; dil yolları; **açık yönlendirme engeli**; Türkçe slug; sipariş geçişi UI aynası |
| `tests/unit/auth-schemas.test.ts` | 6 | Giriş/kayıt/şifre doğrulama şemaları |
| `tests/unit/account-schemas.test.ts` | 7 | Profil/adres şemaları, misafir token karşılaştırması |
| `tests/unit/admin-helpers.test.ts` | 8 | Admin yardımcıları (para girişi, tarih/İstanbul saati, CSV stok içe aktarma ayrıştırma vb.) |

### E2E smoke (Supabase bilgisi olmadan, `next start` üzerinde, gerçek Chrome)
9 senaryo × 3 viewport (1440, 768, 375): `/` → `/tr` yönlendirme ve `lang`; `/en` `lang=en`; **oturumsuz `/admin` ve `/admin/products` giriş sayfasına yönlendirilir**; güvenlik başlıkları (CSP, X-Frame-Options, nosniff, `x-powered-by` yok); imzasız webhook reddedilir; cron gizli anahtarsız 401; robots.txt; 4 sayfada **yatay taşma yok**; bilinmeyen sayfa 404.

Not: bu ortamda Playwright'ın kendi Chromium indirmesi ağ hatasıyla başarısız oldu; yüklü Google Chrome `E2E_CHANNEL=chrome` ile kullanıldı.

## Neyin DOĞRULANMADIĞI (dürüst liste)

| Alan | Neden | Nasıl doğrulanır |
|---|---|---|
| Gerçek Supabase'e karşı tüm sayfalar ve admin paneli tarayıcıda | Test Supabase projesi/anahtarı bu oturumda kullanılabilir değildi | Ayrı TEST projesi → migration + seed → `.env.local` → `npm run build` → `E2E_FULL=1 npm run test:e2e` |
| E2E full suite (`tests/e2e/full-flow.spec.ts`, 7 senaryo × 3 viewport = 21): ana sayfa→kategori→ürün→varyant→sepet→checkout→sandbox ödeme→**sunucu doğrulamalı onay**, **stok düşümü**, **webhook tekrarı no-op**, başarısız ödeme + tekrar dene, filtre/sıralama URL'si, kayıt, müşteri girişi + favori ekle/çıkar + **admin 404**, misafir favori → giriş, admin dashboard | Aynı | Aynı. Gerekli env: `E2E_FULL=1`, `SUPABASE_SERVICE_ROLE_KEY`, `MOCK_PAYMENT_WEBHOOK_SECRET`, `E2E_CUSTOMER_*`, `E2E_ADMIN_*` |
| Admin ürün oluştur/güncelle e2e, görsel yükleme (imzalı URL → Storage) | Gerçek Storage gerekli | Full suite'e senaryo eklenmeli; şu an elle test: Admin → Ürünler → Yeni |
| Supabase Auth e-postaları (doğrulama, şifre sıfırlama), SMTP | Gerçek proje + SMTP | Staging'de kayıt/şifre sıfırlama |
| Resend ile sipariş/bülten e-postası | API anahtarı yok | `RESEND_API_KEY` ile staging |
| iyzico adapter'ı | Üye işyeri sandbox anahtarı yok | DEPLOYMENT.md §5 |
| Lighthouse skorları | Gerçek içerik/görsel olmadan anlamsız; ölçülmedi | Canlıya çıkış listesinde |
| Ekran okuyucu ile manuel erişilebilirlik testi | Yapılmadı | NVDA/VoiceOver ile checkout akışı |
| Eşzamanlı (gerçek paralel) sipariş yarışı | PGlite tek bağlantılı; kilit sırası ve kontrol mantığı sıralı testlerle doğrulandı | Gerçek Postgres'e karşı paralel `create_order` yük testi (ör. k6) |

## Çalıştırılan komutlar ve sonuçları (son çalıştırma)

```text
$ npm run lint          → eslint .            (exit 0)
$ npm run typecheck     → tsc --noEmit        (exit 0)
$ npm test              → Test Files 10 passed (10) · Tests 82 passed (82)
$ npm run db:verify     → Migrations + seed applied OK: { products: 10, variants: 80, pages: 8 }
$ npx next build        → ✓ Compiled successfully (exit 0)
$ E2E_CHANNEL=chrome npx playwright test tests/e2e
                        → 27 passed, 21 skipped (full suite requires E2E_FULL=1)
$ NEXT_PUBLIC_GUARD_TEST=sb_secret_… npx next typegen
                        → Error: NEXT_PUBLIC_GUARD_TEST contains a Supabase SECRET/service_role key …  (guard works)
```

## Geliştirme sırasında testlerin yakaladığı hatalar
1. `create_order`: kupon kullanılmadığında atanmamış `record` değişkenine erişim (`record "v_coupon" is not assigned yet`) — skaler değişkenlerle düzeltildi; tüm sipariş akışını kırıyordu.
2. Test yardımcısı mevcut stok yerine eldeki stoku kontrol ediyordu — düzeltildi.
3. `react-hooks/purity`: render sırasında `Date.now()` — yardımcı fonksiyona taşındı.
4. Supabase yapılandırılmamışken sayfaların arka planda sorgu denemesi — okuma yardımcılarına koruma eklendi.
