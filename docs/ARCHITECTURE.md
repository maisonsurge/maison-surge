# Mimari

## Genel bakış

```
Tarayıcı ──HTTPS──► Vercel (Next.js 16, Node runtime)
                     ├─ src/proxy.ts            dil yönlendirme, Supabase oturum yenileme (güvenlik katmanı DEĞİL)
                     ├─ Server Components        katalog/ürün/sepet sayfaları (RLS altında anon/kullanıcı istemcisi)
                     ├─ Server Actions           sepet, checkout, hesap, admin mutasyonları (her biri yetki + Zod)
                     └─ Route Handlers           /api/webhooks/payments/[provider], /api/payments/iyzico/callback,
                                                 /api/cron/release-reservations, /api/health, /auth/confirm|callback
                              │
                              ▼
                     Supabase
                     ├─ Postgres  RLS (deny-by-default) + security definer fonksiyonları (sipariş, ödeme, stok, admin)
                     ├─ Auth      e-posta/şifre, doğrulama, şifre sıfırlama (parolalar uygulamada saklanmaz)
                     └─ Storage   product-images, site-assets (public okuma, yetkili yazma, imzalı upload URL)
```

Tek repo, tek `package.json`. Ayrı backend/Express yoktur.

## Güven sınırları ve istemciler

| İstemci | Dosya | Anahtar | Ne zaman |
|---|---|---|---|
| Kullanıcı istemcisi | `src/server/supabase/server.ts` | anon + kullanıcı çerezi | Varsayılan. Tüm sorgular RLS altında çalışır. Admin CRUD da bu istemciyle yapılır → RLS + SQL izin kontrolü ikinci kapıdır. |
| Service istemcisi | `src/server/supabase/admin.ts` (`server-only`) | service_role | Yalnızca kendi yetkilendirmesini yapmış sunucu kodu: sepet (çerez token hash / user id ile kapsamlı), checkout (`create_order`), webhook (`confirm_payment`), imzalı upload, cron, misafir sipariş erişimi. |
| Tarayıcı istemcisi | `src/lib/supabase-browser.ts` | anon | Yalnızca sunucudan alınmış imzalı URL'ye dosya yüklemek için. |

`service_role` anahtarı ve tüm sırlar yalnızca `src/server/env.ts` üzerinden okunur; bu modül `server-only` ile istemci paketine girmesi engellenir.

## Yetkilendirme katmanları

1. **Proxy** (`src/proxy.ts`): oturumsuz kullanıcıyı `/admin` ve `/account`'tan giriş sayfasına yönlendirir — yalnızca UX.
2. **Sayfa/aksiyon**: `requireStaff(permission)` / `assertPermission(permission)` (`src/server/auth.ts`) — `getUser()` ile JWT Supabase Auth'ta doğrulanır, roller `user_roles`'tan okunur. Rolü olmayan kullanıcı `/admin`'de 404 alır.
3. **Veritabanı**: RLS politikaları `public.has_permission()` kullanır; admin fonksiyonları içeride izin kontrol eder; ödeme/stok kolonları trigger ile korunur.

Yetki matrisi hem SQL'de (`role_has_permission`) hem TS'de (`src/lib/auth/permissions.ts`) — `tests/db/permissions.test.ts` eşitliği doğrular.

## Kritik akışlar

### Sepet
- Misafir: httpOnly `ms_cart` çerezinde 32 baytlık rastgele token; DB'de yalnızca SHA-256 hash.
- Giriş: misafir sepeti kullanıcı sepetine birleştirilir (D-007).
- Fiyat sepette saklanmaz; her görüntülemede katalogdan okunur.

### Checkout → ödeme → onay
```
placeOrderAction (Server Action)
  ├─ rate limit, Zod doğrulama
  ├─ sepet + kupon + kargo → src/lib/pricing.ts ile toplamlar
  ├─ rpc create_order(p)      ── tek transaction:
  │     • idempotency_key varsa mevcut siparişi döndür
  │     • süresi dolmuş rezervasyonları serbest bırak
  │     • varyant satırlarını id sırasıyla FOR UPDATE kilitle
  │     • her satırın fiyatını, stoğunu, kuponu (limit dahil), kargoyu, genel toplamı DOĞRULA
  │     • order + order_items (snapshot) + stock_reservations + coupon_redemption ekle
  ├─ provider.createSession() → rpc start_payment()
  └─ redirect → sağlayıcı ödeme sayfası (mock: /checkout/sandbox/<session>)

Sağlayıcı ──imzalı webhook──► /api/webhooks/payments/[provider]
  └─ handlePaymentWebhook: imza doğrula → rpc confirm_payment / fail_payment
        • payment_events (provider,event_id) UNIQUE → tekrar = no-op
        • order FOR UPDATE; tutar/para birimi eşleşmesi zorunlu
        • rezervasyonları tüket: stock_on_hand -= q, stock_reserved -= q, inventory_movements 'sale'
        • order: confirmed / paid; sepet temizlenir

/order/<no> sayfası durumu yalnızca veritabanından okur — tarayıcının
dönüş yönlendirmesi asla ödeme kanıtı sayılmaz.
```

### Rezervasyon süresi
`release_expired_reservations()` — checkout sırasında fırsatçı olarak, Vercel Cron ile günlük ve (önerilen) Supabase `pg_cron` ile 5 dakikada bir çalışır. `FOR UPDATE SKIP LOCKED` ile eşzamanlı çalışmaya güvenlidir. Süresi dolmuş siparişe sonradan ödeme gelirse stok hâlâ varsa alınır (`confirmed_after_expiry`), yoksa sipariş `on_hold` olur ve admin iade eder.

### İptal / iade
`admin_cancel_order` (ödenmemiş: rezervasyonu bırakır; ödenmiş: `orders.refund` izni ister, stoğu iade eder, bekleyen `refunds` kaydı oluşturur) → `processRefund()` sağlayıcının iade API'si varsa çağırır, yoksa "manuel iade" ister → `complete_refund` / `admin_mark_refund_manual` ödeme durumunu günceller. Ödeme durumu başka hiçbir yoldan değişemez.

## Ödeme adapter'ı

`src/server/payments/types.ts` → `PaymentProvider { createSession, verifyWebhook, refund? }`.

| Sağlayıcı | Durum |
|---|---|
| `mock` | Çalışıyor ve test edildi. HMAC-SHA256 imzalı webhook (`x-ms-signature: t=…,v1=…`, 5 dk tolerans). Vercel production'da varsayılan kapalı. |
| `iyzico` | Checkout Form başlatma + sunucudan sunucuya sonuç doğrulama yazıldı; **gerçek sandbox anahtarıyla doğrulanmadı**. İade API'si entegre değil (manuel iade). |

Yeni sağlayıcı eklemek: `PaymentProvider` uygulayın, `src/server/payments/index.ts`'e kaydedin, `PAYMENT_PROVIDER` enum'una ekleyin.

## Çoklu dil
`/tr/...` ve `/en/...` (D-002). UI metinleri `src/i18n/dictionaries/*.ts` (EN, TR tipini karşılamak zorunda — test ile anahtar eşitliği doğrulanır). Ürün içerikleri `product_translations`, kısa alanlar `{tr,en}` jsonb. Her sayfa `buildMetadata()` ile canonical + hreflang (`x-default` = tr) üretir.

## Güvenlik önlemleri (özet)
- RLS her tabloda; anon/authenticated için tablo yetkileri de açıkça verilir (Supabase'in varsayılan ALL yetkisi geri alınır — testle doğrulanır).
- Zod ile her girdi; SQL CHECK kısıtları ikinci katman.
- CSRF: Server Actions Origin kontrolü (Next.js); state değiştiren Route Handler'lar imza (webhook) veya Bearer (cron) ile korunur.
- Rate limit: Postgres tabanlı (login, kayıt, şifre sıfırlama, iletişim, bülten, kupon, sepet, checkout, ödeme tekrar).
- Bot: honeypot + minimum doldurma süresi.
- Başlıklar: CSP, X-Frame-Options DENY, nosniff, HSTS, Referrer-Policy, Permissions-Policy; admin `noindex` + `no-store`.
- Açık yönlendirme koruması (`isSafeRelativePath`), Markdown'da ham HTML kapalı, JSON-LD kaçışlı.
- Loglarda kişisel veri yok/maskeli (`maskEmail`), IP'ler tuzlanmış hash.

## Performans
- `next/font` ile kendinden barındırılan fontlar (CLS yok), `next/image` (AVIF/WebP, Supabase host'u `remotePatterns`'ta).
- Katalog filtreleme tek SQL fonksiyonunda (`catalog_search`) — GIN tam metin indeksi, varyant/kategori indeksleri.
- Sayfalar oturum/sepet çerezine bağlı olduğundan dinamik render edilir; sitemap 1 saat önbelleklenir.
