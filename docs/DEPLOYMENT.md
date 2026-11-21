# Yayınlama (Vercel + Supabase)

## 1. Ortamlar
| Ortam | Supabase | Vercel | Ödeme |
|---|---|---|---|
| Geliştirme | ayrı dev projesi | `npm run dev` | `mock` |
| Staging / Preview | ayrı staging projesi | Preview deployments | `mock` (`ALLOW_MOCK_PAYMENTS_IN_PRODUCTION` yalnızca staging'in production ortamında) veya `iyzico` sandbox |
| Canlı | canlı proje | Production | `iyzico` (veya seçilen sağlayıcı) canlı anahtar |

E2E full suite'i asla canlı projeye karşı çalıştırmayın.

## 2. Supabase (canlı)
1. Projeyi oluşturun (AB bölgesi), migration'ları uygulayın (`npx supabase link` + `npx supabase db push`). **Canlıda `seed.sql` çalıştırmayın** (demo içerik ister misiniz? Yalnızca staging'de).
2. Kategori, beden, renk sözlüklerini ve kargo yöntemlerini admin panelinden girin (veya seed'in yalnızca sözlük kısımlarını çalıştırın).
3. Auth → URL Configuration: Site URL + Redirect URLs (README §3.2). Email şablonlarını güncelleyin. SMTP tanımlayın.
4. Auth → Rate limits ve "Leaked password protection" (Pro) ayarlarını gözden geçirin.
5. Database → **pg_cron** uzantısını etkinleştirip rezervasyon temizliğini 5 dakikada bir çalıştırın:
   ```sql
   create extension if not exists pg_cron;
   select cron.schedule('ms-release-reservations', '*/5 * * * *', $$select public.release_expired_reservations(500)$$);
   ```
6. Security Advisor ve Performance Advisor uyarılarını kontrol edin.

## 3. Vercel
1. **New Project** → GitHub reposu. Framework preset *Next.js*; Root Directory: `./`; Install: `npm ci`; Build: `npm run build`; Node.js 24.x.
2. **Environment Variables** (Production ve Preview ayrı değerlerle):

| Değişken | Production | Not |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<alan-adı>` | sonda `/` yok |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | canlı proje | |
| `SUPABASE_SERVICE_ROLE_KEY` | canlı proje | **Sensitive** olarak işaretleyin |
| `PAYMENT_PROVIDER` | `iyzico` | sözleşme + anahtar gelene kadar canlı satış açmayın |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` / `IYZICO_BASE_URL` | canlı değerler | `https://api.iyzipay.com` |
| `MOCK_PAYMENT_WEBHOOK_SECRET` | rastgele | mock kapalı olsa da tanımlı olabilir |
| `ALLOW_MOCK_PAYMENTS_IN_PRODUCTION` | `false` | |
| `CRON_SECRET` | rastgele ≥16 karakter | Vercel Cron bunu `Authorization: Bearer` ile gönderir |
| `IP_HASH_SALT` | rastgele | |
| `RESEND_API_KEY` / `EMAIL_FROM` | opsiyonel | gönderici alan adı Resend'de doğrulanmalı |

3. Deploy → `/api/health` `{"ok":true}` dönmeli.
4. `vercel.json`: bölge `fra1`, günlük cron (Hobby planı günde bir cron'a izin verir; Pro'da sıklığı artırabilirsiniz — pg_cron zaten 5 dk'da bir çalışıyor).

## 4. Alan adı
1. Vercel → Settings → Domains → `alan-adi.com` ve `www.alan-adi.com` ekleyin; birini diğerine yönlendirin.
2. DNS: apex için `A 76.76.21.21`, `www` için `CNAME cname.vercel-dns.com` (Vercel'in gösterdiği güncel değerleri kullanın).
3. SSL otomatik. `NEXT_PUBLIC_SITE_URL`'ı güncelleyip yeniden deploy edin; Supabase Auth URL'lerini güncelleyin.

## 5. Ödeme sağlayıcısı yapılandırması (iyzico)
1. iyzico üye işyeri başvurusu ve sözleşme (işletme).
2. Sandbox anahtarlarıyla staging'de uçtan uca test: başarılı, başarısız, 3DS, iptal, tutar uyuşmazlığı.
3. Merchant panelinde bildirim (webhook) URL'si: `https://<alan-adı>/api/webhooks/payments/iyzico` (gelen bildirim yalnızca tetikleyicidir; sonuç her zaman retrieve API'si ile sunucudan sunucuya doğrulanır).
4. Checkout Form geri dönüş URL'si kod tarafından `https://<alan-adı>/api/payments/iyzico/callback` olarak gönderilir.
5. `identityNumber` (TCKN) politikası iyzico ile netleştirilmeli (D-020; kodda sandbox varsayılanı).
6. İade API'si entegre edilene kadar iadeler iyzico panelinden yapılır ve admin'de "manuel iade onayı" ile kaydedilir.

## 6. Görseller ve depolama maliyeti
- Supabase Storage: ücretsiz planda 1 GB, Pro'da 100 GB dahil. Ürün başına ~6 görsel × ~400 KB (WebP önerilir) ≈ 2.4 MB.
- Görseller Vercel Image Optimization ile yeniden boyutlandırılır (plan kotası: kaynak görsel sayısı). Kota aşımı beklenirse `next.config.ts`'te `images.unoptimized` yerine Supabase Image Transformations (Pro) değerlendirilebilir.
- Yükleme limiti 8 MB/dosya, türler: JPEG, PNG, WebP, AVIF.

## 7. İzleme ve loglar
- Vercel → Logs / Observability: sunucu hataları (`[payments]`, `[checkout]`, `[rate-limit]` önekleri). Loglarda e-posta/IP yazılmaz.
- Hata izleme (Sentry vb.) için `instrumentation.ts` eklenebilir; açık rıza gerektirmeyen sunucu tarafı hata izleme önerilir. İstemci tarafı oturum kaydı/analitik **çerez rızası** olmadan yüklenmemelidir (`useConsent()`).
- Supabase → Logs: Auth, Postgres, API.
- Uptime: `/api/health` için harici bir izleyici (ör. Better Stack, UptimeRobot).

## 8. Sırların yönetimi
- Sırlar yalnızca Vercel env ve yerel `.env.local` (git'e girmez). `service_role` anahtarı sızarsa Supabase → API → *Roll* ile yenileyin ve Vercel'i güncelleyin.
- Personel ayrıldığında: admin panelinden rolünü kaldırın; gerekirse Supabase Auth'tan kullanıcıyı devre dışı bırakın.
