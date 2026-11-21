# İlerleme Defteri

Son güncelleme: 2026-11-21. Bağlam değişirse önce `PROJECT_RULES.md`, bu dosya, `docs/DECISIONS.md`, `docs/IMPLEMENTATION_PLAN.md` okunmalı.

## Durum
Kod tarafı tamamlandı; `lint`, `typecheck`, `build`, 82 birim/DB testi ve 27 e2e smoke testi geçiyor (`docs/TEST_REPORT.md`).
**Gerçek bir Supabase projesine karşı uçtan uca çalıştırma henüz yapılmadı** — bir sonraki adım budur.

## Bir sonraki adımlar (sırayla)
1. Ayrı bir **TEST** Supabase projesi oluştur → migration'ları (`supabase/migrations/`) ve `seed.sql`'i uygula → `.env.local` doldur → `npm run build` → `E2E_FULL=1 npm run test:e2e`. Çıkan hataları düzelt, TEST_REPORT'u güncelle.
2. Admin panelini tarayıcıda elle gez (ürün oluştur, görsel yükle, sipariş akışı); full e2e'ye admin ürün oluşturma senaryosunu ekle.
3. Onaylı logo, gerçek ürünler/görseller, yasal metinler, işletme bilgileri (`docs/ASSET_GAPS.md`, `docs/RELEASE_CHECKLIST.md`).
4. Ödeme sağlayıcısı kararı → iyzico sandbox doğrulaması veya yeni adapter.

## Bilinçli olarak yapılmayanlar
Fatura kesimi, kargo API entegrasyonu, iyzico iade API'si, OAuth sağlayıcıları, toplu ürün CSV içe aktarma (yalnızca CSV stok içe aktarma var). Bkz. IMPLEMENTATION_PLAN "Bilinen sınırlamalar".

## Çalışma notları
- DB değişikliği = yeni migration dosyası (mevcutleri düzenleme) → `node scripts/verify-migrations.mjs` → `npm run db:types` → `npm run test:db`.
- Next.js 16: `middleware` yerine `src/proxy.ts`; `params`/`searchParams` async; `revalidateTag` ikinci argüman ister; `next typegen` route tiplerini üretir.
- Tüm yazma yolları yetki kontrollü; ödeme durumu yalnızca `confirm_payment`/`fail_payment`/refund fonksiyonlarıyla değişir (trigger korumalı).
