# Veritabanı

Kaynak: `supabase/migrations/*.sql` (sıralı). Tipler: `npm run db:types` → `src/types/database.types.ts`.
Doğrulama: `npm run db:verify` ve `npm run test:db` (PGlite, Postgres 18 — Supabase rolleri/auth/storage taklit edilerek).

## Migration'lar

| Dosya | İçerik |
|---|---|
| `0100_foundation` | Varsayılan yetkilerin geri alınması (deny-by-default), enum'lar, `set_updated_at`, `is_localized_text`, `user_roles`, `has_role/is_staff/has_permission/role_has_permission`, `audit_logs` + `audit_row_change` trigger'ı, `rate_limits` + `check_rate_limit` |
| `0200_catalog` | `categories`, `collections`, `sizes`, `colors`, `products`, `product_translations` (tam metin vektörü), `product_costs`, `product_variants` (stok kolonları trigger korumalı), `product_images`, `collection_products`, RLS |
| `0300_customers` | `profiles` (+ auth.users trigger'ı; rol ATAMAZ), `addresses`, `wishlists`, `carts`, `cart_items`, RLS |
| `0400_commerce` | `shipping_methods`, `coupons`, `orders` (ödeme durumu ve toplamlar trigger korumalı), `order_items`, `order_status_history`, `stock_reservations`, `inventory_movements`, `payments` (yalnızca ödeme fonksiyonları yazabilir), `payment_events` (UNIQUE provider+event_id), `refunds`, `shipments`, `coupon_redemptions`, RLS |
| `0500_content` | `site_settings` (tek satır), `homepage_sections`, `content_pages`, `newsletter_subscriptions`, `contact_messages`, RLS |
| `0600_functions` | `catalog_search`, `compute_coupon_discount`, `create_order`, `start_payment`, `confirm_payment`, `fail_payment`, `release_expired_reservations`, admin fonksiyonları (durum, kargo, iptal, iade, stok, kopyalama, roller, müşteri listesi, dashboard) |
| `0700_storage_and_grants` | Storage bucket'ları + politikaları, service_role yetkileri |

## Para ve stok kuralları
- Tüm tutarlar `integer` **kuruş**; para birimi `TRY` (CHECK).
- `orders`: `grand_total = subtotal - discount_total + shipping_total` (CHECK), `discount_total ≤ subtotal`, `refunded_total ≤ grand_total`. Toplamlar oluşturulduktan sonra değiştirilemez (trigger).
- `product_variants`: `0 ≤ stock_reserved ≤ stock_on_hand` (CHECK). Stok kolonları yalnızca `app.stock_ctx` bayrağını açan fonksiyonlar içinde değişebilir.
- Her stok değişimi `inventory_movements`'a yazılır (`initial`, `adjustment`, `sale`, `cancel_restock`, `return_restock`).

## Sipariş durum makinesi

```
pending_payment ──(doğrulanmış ödeme)──► confirmed ──► processing ──► shipped ──► delivered
      │  └─(süre doldu)──► expired ──(geç ödeme, stok var)──► confirmed
      │                          └──(geç ödeme, stok yok)──► on_hold
      └─(admin iptal)──► cancelled
confirmed/processing/on_hold ──(admin iptal; ödenmişse iade kaydı)──► cancelled
on_hold ──(admin, ödenmiş + stok)──► confirmed
tam iade tamamlandı ──► refunded
```

`payment_status`: `unpaid → pending → paid | failed`, `paid → partially_refunded → refunded`. Yalnızca `start_payment`, `confirm_payment`, `fail_payment`, `internal_complete_refund` değiştirir.

## Fonksiyon erişimi

| Fonksiyon | Çağırabilen | Not |
|---|---|---|
| `catalog_search` | anon, authenticated | security invoker — RLS uygulanır |
| `has_permission`, `is_staff`, `product_is_public` | anon, authenticated | yalnızca çağıranın kendi rolü hakkında bilgi verir |
| `create_order`, `start_payment`, `confirm_payment`, `fail_payment`, `release_expired_reservations`, `complete_refund`, `check_rate_limit`, `grant_role_by_email` | **yalnızca service_role** | `revoke … from public, anon, authenticated` |
| `admin_*` | authenticated | içeride `has_permission(...)` kontrolü; aksi halde `forbidden` (42501) |
| `internal_*` | hiçbiri (yalnızca diğer fonksiyonlar) | |

## RLS özeti

| Tablo | anon | müşteri | staff | admin |
|---|---|---|---|---|
| Katalog (yayınlanmış/aktif) | okur | okur | tümünü okur/yazar | tümünü okur/yazar |
| `product_costs` | — | — | okur/yazar | okur/yazar |
| `profiles` | — | kendi satırı | — | okur (customers.view) |
| `addresses`, `wishlists` | — | kendi satırları | — | — |
| `carts`, `cart_items`, `rate_limits` | — | — | — | — (yalnızca service role) |
| `orders`, `order_items`, `shipments` | — | kendi siparişleri | okur | okur |
| `order_status_history` | — | kendi, iç notlar hariç | okur | okur |
| `payments`, `refunds` | — | — | okur | okur |
| `payment_events` | — | — | — | okur (orders.refund) |
| `coupons`, `coupon_redemptions` | — | — | — | okur/yazar |
| `homepage_sections`, `content_pages` | aktif/yayınlanmış | aynı | — | okur/yazar |
| `site_settings`, `shipping_methods` | okur | okur | — | yazar |
| `contact_messages` | — | — | okur/günceller/siler | aynı |
| `newsletter_subscriptions` | — | — | — | okur/siler |
| `audit_logs` | — | — | — | okur |

## Yedekleme ve geri yükleme
- **Supabase Pro**: günlük otomatik yedek (7 gün), opsiyonel Point-in-Time Recovery. Ücretsiz planda otomatik yedek yoktur → düzenli `pg_dump` alın:
  ```bash
  # Dashboard → Project Settings → Database → Connection string (Session pooler)
  pg_dump "postgresql://postgres.<ref>:<şifre>@<host>:5432/postgres" --schema=public --format=custom -f backup-$(date +%F).dump
  pg_restore --no-owner --dbname "<hedef bağlantı>" backup-YYYY-MM-DD.dump
  ```
- Storage nesneleri veritabanı yedeğine dahil değildir; kritik görselleri ayrıca yedekleyin (Supabase CLI `storage` komutları veya S3 uyumlu araçlar).
- Geri yükleme provası: yeni bir projeye migration'ları uygulayın, ardından `pg_restore --data-only`.

## Bakım
- `rate_limits` eski pencereleri fonksiyon içinde fırsatçı temizlenir.
- `audit_logs` ve `payment_events` büyür; 2 yıldan eski kayıtları KVKK saklama politikasına göre arşivleyin/silin (işletme kararı).
