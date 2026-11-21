# MAISON SURGE — E-ticaret mağazası ve yönetim paneli

Premium giyim markası **MAISON SURGE** için tek repo, tek `package.json` ile çalışan mağaza + gerçek admin paneli.

**Stack:** Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · Vercel.
Ayrı backend sunucusu yoktur: sunucu mantığı Server Actions, Route Handlers ve Postgres fonksiyonlarındadır.

> **Önce okuyun:** [`PROJECT_RULES.md`](PROJECT_RULES.md) (bağlayıcı kurallar) · [`docs/DECISIONS.md`](docs/DECISIONS.md) · [`docs/PROGRESS.md`](docs/PROGRESS.md) · [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md)

---

## 1. Gereksinimler

| Araç | Sürüm | Not |
|---|---|---|
| Node.js | ≥ 20.9 (24 LTS önerilir) | `node -v` |
| npm | ≥ 10 | Node ile gelir |
| Git | herhangi | |
| Supabase hesabı | — | https://supabase.com (ücretsiz plan geliştirme için yeterli) |
| Vercel hesabı | — | yayın için |
| Supabase CLI | opsiyonel | `npx supabase …` ile kurulmadan kullanılabilir |

Windows'ta komutları **PowerShell** veya **Git Bash** ile, macOS'ta Terminal ile çalıştırın. Aşağıdaki komutlar iki sistemde de aynıdır; farklı olanlar ayrıca belirtilmiştir.

## 2. Yerel kurulum

```bash
git clone <repo-url> maison-surge
cd maison-surge
npm install
```

Ortam dosyasını oluşturun:

```bash
# macOS / Git Bash
cp .env.example .env.local
# Windows PowerShell
Copy-Item .env.example .env.local
```

`.env.local` içindeki her değişkenin açıklaması ve hangi servisten alınacağı [`.env.example`](.env.example) dosyasında yazılıdır. Rastgele bir gizli anahtar üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`MOCK_PAYMENT_WEBHOOK_SECRET`, `CRON_SECRET`, `IP_HASH_SALT` için ayrı ayrı üretin.

## 3. Supabase projesini oluşturma

1. Supabase Dashboard → **New project**. Bölge olarak Türkiye'ye yakın bir AB bölgesi seçin (ör. *Frankfurt — eu-central-1*). Veritabanı şifresini parola yöneticisine kaydedin.
2. **Project Settings → API** sayfasından:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**yalnızca sunucu**; asla istemciye, repoya veya sohbete koymayın)

### 3.1 Migration'ları uygulama

`supabase/migrations/` veritabanının tek doğruluk kaynağıdır (sıralı, tekrar uygulanabilir değil — her dosya bir kez uygulanır).

**Seçenek A — Supabase CLI (önerilen):**

```bash
npx supabase login
npx supabase link --project-ref <project-ref>      # Dashboard URL'indeki kimlik
npx supabase db push                                # migration'ları uygular
```

**Seçenek B — SQL Editor:** Dashboard → SQL Editor'de `supabase/migrations/` içindeki dosyaları **dosya adı sırasıyla** tek tek çalıştırın.

**Demo verisi (opsiyonel):** `supabase/seed.sql` içeriğini SQL Editor'de çalıştırın. Tekrar çalıştırmak güvenlidir. Demo ürünler `is_demo = true` olarak işaretlidir, görselleri "DEMO GÖRSEL" yazılı yer tutuculardır ve admin → Ayarlar → *Demo verilerini sil* ile kaldırılır.

> Migration'ları yerelde, gerçek bir projeye dokunmadan doğrulamak için: `npm run db:verify` (Postgres'i PGlite ile bellek içinde çalıştırır).

### 3.2 Auth ayarları

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (yerel) / `https://<alan-adınız>` (canlı)
- **Redirect URLs:** `http://localhost:3000/auth/confirm**`, `http://localhost:3000/auth/callback**`, `https://<alan-adınız>/auth/confirm**`, `https://<alan-adınız>/auth/callback**`

**Authentication → Email Templates** — bağlantıları sunucu tarafı doğrulama rotasına (`/auth/confirm`) yönlendirin. Uygulama her istekte `redirectTo = <site>/auth/confirm?next=/<dil>/…` gönderdiği için `{{ .RedirectTo }}` kullanmak kullanıcının dilini korur:

| Şablon | Bağlantı (`href`) |
|---|---|
| Confirm signup | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email` |
| Reset password | `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery` |
| Change email | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/tr/account` |

`next` parametresi yalnızca site içi göreli yollar için kabul edilir (açık yönlendirme koruması).

**Authentication → Providers → Email:** "Confirm email" açık kalmalı. Canlıda **Authentication → SMTP Settings** ile kendi SMTP sağlayıcınızı tanımlayın (Supabase'in varsayılan SMTP'si saatlik çok düşük limitlidir ve canlı kullanım için uygun değildir).

### 3.3 Storage

Migration `0700` iki bucket'ı oluşturur: `product-images` ve `site-assets` (public okuma, listeleme kapalı, yazma yalnızca yetkili personel). Dashboard → Storage'da göründüklerini kontrol edin. Yüklemeler admin panelinden kısa ömürlü imzalı URL'lerle yapılır.

### 3.4 İlk admin hesabı (güvenli bootstrap)

Kayıt olan hiç kimse otomatik olarak admin olmaz ve sabit bir admin parolası yoktur.

1. Sitede normal şekilde kayıt olun ve e-postanızı doğrulayın (`/tr/auth/register`).
2. Rolü atayın — iki yoldan biri:
   ```bash
   npm run admin:grant -- siz@ornek.com admin
   ```
   veya Supabase SQL Editor'de:
   ```sql
   select public.grant_role_by_email('siz@ornek.com', 'admin');
   ```
3. `/admin` adresine gidin. Sonraki personeli admin panelinden (Müşteriler → kullanıcı → Roller) yönetebilirsiniz.

Ayrıntılar: [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md).

## 4. Geliştirme

```bash
npm run dev          # http://localhost:3000  → /tr
```

| Komut | İş |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi / sunucu |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest: birim testleri + PGlite üzerinde veritabanı entegrasyon testleri |
| `npm run test:db` | Yalnızca DB testleri (RLS, stok, ödeme idempotency, yetki) |
| `npm run test:e2e` | Playwright (bkz. §5) |
| `npm run db:verify` | Migration + seed'i bellek içi Postgres'te uygular |
| `npm run db:types` | `src/types/database.types.ts` dosyasını migration'lardan üretir |
| `npm run admin:grant -- <email> [admin\|staff]` | Rol atama (service role ile) |
| `npm run check` | lint + typecheck + test + build |

Supabase bilgileri girilmemişse site çökmez; "Kurulum gerekli" ekranı gösterilir.

**Ödeme (geliştirme):** `PAYMENT_PROVIDER=mock` ile ödeme adımı açıkça **TEST** etiketli bir sandbox sayfasına gider; "başarılı/başarısız" seçimi imzalı bir webhook üretir ve gerçek webhook ile aynı doğrulama + idempotent işleme yolundan geçer. Gerçek para çekilmez.

## 5. Testler

```bash
npm test                         # birim + DB entegrasyon (Supabase gerekmez)
npm run build
npx playwright install chromium  # bir kez (indirilemiyorsa: E2E_CHANNEL=chrome veya msedge)
npm run test:e2e                 # smoke suite her zaman; full suite yalnızca E2E_FULL=1 ile
```

**Full e2e** (satın alma, sandbox ödeme, stok düşümü, webhook tekrarı, auth, favori, admin) yalnızca **ayrı bir TEST Supabase projesine** karşı çalıştırılmalıdır: migration + seed uygulanmış, `.env.local` o projeyi gösteriyor, `E2E_FULL=1`, `E2E_CUSTOMER_*` (doğrulanmış müşteri) ve `E2E_ADMIN_*` (admin rolü verilmiş kullanıcı) tanımlı. Sonuçlar ve neyin hangi ortamda doğrulandığı: [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md).

## 6. Vercel'e yayınlama

Ayrıntılı adımlar, alan adı, cron ve webhook yapılandırması: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Özet:

1. Repoyu GitHub'a gönderin → Vercel → **Add New Project** → repoyu seçin. Framework: *Next.js*, Root Directory: repo kökü, Build: `npm run build`.
2. **Environment Variables:** `.env.example` içindeki tüm değişkenleri Production / Preview için girin. `NEXT_PUBLIC_SITE_URL` = canlı alan adı.
3. Deploy edin. Supabase Auth → URL Configuration'a canlı alan adını ekleyin.
4. **Domain:** Vercel → Settings → Domains → alan adını ekleyin, DNS kayıtlarını sağlayıcınıza girin.
5. **Cron:** `vercel.json` günlük rezervasyon temizliği tanımlar; daha sık temizlik için Supabase `pg_cron` önerilir (DEPLOYMENT.md).
6. **Webhook:** ödeme sağlayıcısında bildirim URL'si `https://<alan-adı>/api/webhooks/payments/<provider>`; iyzico Checkout Form geri dönüşü `https://<alan-adı>/api/payments/iyzico/callback`.

## 7. Proje yapısı

```
src/
  app/                 Rotalar: [locale]/ (mağaza), admin/, api/, auth/ (e-posta/OAuth dönüşleri)
  components/          UI kiti (ui/), marka (brand/), yerleşim (layout/), ürün kartları (product/)
  features/            Özellik bazlı modüller (catalog, cart, checkout, account, admin, …)
  server/              Sunucuya özel kod ("server-only"): auth, cart, catalog, checkout, payments, security
  lib/                 Saf yardımcılar: money (kuruş), pricing, seo, images, permissions
  i18n/                TR/EN sözlükleri, dil yönlendirme yardımcıları
  types/               Migration'lardan üretilmiş veritabanı tipleri
supabase/migrations/   Sıralı SQL migration'ları (şema, RLS, fonksiyonlar, storage)
supabase/seed.sql      Demo veri (açıkça işaretli)
tests/unit|db|e2e/     Vitest birim, PGlite DB entegrasyon, Playwright e2e
docs/                  Mimari, veritabanı, yayın, admin rehberi, test raporu, kararlar, eksik varlıklar
```

Mimari: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Veritabanı: [`docs/DATABASE.md`](docs/DATABASE.md)

## 8. Harici bilgi bekleyen alanlar

Aşağıdakiler olmadan canlıya çıkılmamalıdır (ayrıntı: `docs/RELEASE_CHECKLIST.md`): onaylı vektör logo, gerçek ürün fotoğrafları ve ürün bilgileri, ödeme sağlayıcısı sözleşmesi ve canlı anahtarlar, işletme yasal bilgileri ve hukukçu onaylı politika metinleri, kargo ücretleri/taşıyıcı, KDV oranı, alan adı, SMTP / e-posta sağlayıcısı.
