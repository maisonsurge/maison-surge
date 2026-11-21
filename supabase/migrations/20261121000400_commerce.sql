-- =============================================================================
-- MAISON SURGE — 0400 Commerce: shipping, coupons, orders, inventory, payments
-- Orders/payments are never written directly by browser roles. All state
-- changes go through security definer functions in 0500.
-- =============================================================================

create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name jsonb not null check (public.is_localized_text(name)),
  description jsonb not null default '{}'::jsonb check (public.is_localized_text(description, false)),
  price integer not null check (price >= 0),
  free_over integer check (free_over is null or free_over > 0), -- free shipping threshold (subtotal after discount)
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger shipping_methods_updated_at before update on public.shipping_methods for each row execute function public.set_updated_at();

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,40}$'),
  description text check (description is null or length(description) <= 300),
  type public.coupon_type not null,
  value integer not null check (value > 0),          -- percent: 1..100, fixed: kuruş
  min_subtotal integer not null default 0 check (min_subtotal >= 0),
  max_discount integer check (max_discount is null or max_discount > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (type <> 'percent' or value <= 100),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'unpaid',
  currency char(3) not null default 'TRY' check (currency = 'TRY'),
  subtotal integer not null check (subtotal >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  shipping_total integer not null default 0 check (shipping_total >= 0),
  vat_total integer not null default 0 check (vat_total >= 0), -- VAT included in prices (informational)
  grand_total integer not null check (grand_total >= 0),
  refunded_total integer not null default 0 check (refunded_total >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  shipping_method_id uuid references public.shipping_methods (id) on delete set null,
  shipping_method_name jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null,
  billing_address jsonb not null,
  billing_info jsonb not null default '{"type":"individual"}'::jsonb,
  customer_note text check (customer_note is null or length(customer_note) <= 500),
  internal_note text check (internal_note is null or length(internal_note) <= 2000),
  cart_id uuid references public.carts (id) on delete set null,
  idempotency_key text not null unique check (length(idempotency_key) between 16 and 100),
  guest_token_hash text check (guest_token_hash is null or guest_token_hash ~ '^[0-9a-f]{64}$'),
  payment_provider text,
  reservation_expires_at timestamptz,
  terms_accepted_at timestamptz not null,
  terms_version text not null,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_total <= subtotal),
  check (grand_total = subtotal - discount_total + shipping_total),
  check (refunded_total <= grand_total)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_created_idx on public.orders (created_at desc);
create index orders_email_idx on public.orders (lower(email));
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  sku text not null,
  product_name text not null,
  variant_label text not null default '',
  image_path text,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 20),
  line_total integer not null,
  created_at timestamptz not null default now(),
  check (line_total = unit_price * quantity)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  payment_status public.payment_status not null,
  note text check (note is null or length(note) <= 1000),
  is_internal boolean not null default false,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index stock_reservations_active_idx on public.stock_reservations (expires_at) where status = 'active';
create index stock_reservations_order_idx on public.stock_reservations (order_id);
create index stock_reservations_variant_idx on public.stock_reservations (variant_id);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid references public.product_variants (id) on delete set null,
  sku text not null,
  type public.inventory_movement_type not null,
  quantity_delta integer not null,
  on_hand_after integer not null,
  order_id uuid references public.orders (id) on delete set null,
  reason text check (reason is null or length(reason) <= 500),
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_order_idx on public.inventory_movements (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null check (provider ~ '^[a-z0-9_]{2,30}$'),
  provider_session_id text,  -- id/token issued when the payment is initialised
  provider_payment_id text,  -- id of the captured payment (after verification)
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  amount integer not null check (amount >= 0),
  currency char(3) not null default 'TRY',
  failure_reason text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create unique index payments_provider_session_uidx on public.payments (provider, provider_session_id) where provider_session_id is not null;
create unique index payments_provider_payment_uidx on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();

-- Every inbound provider event (webhook / callback verification) is recorded
-- once. The unique key makes re-deliveries no-ops.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null check (length(event_id) between 1 and 200),
  event_type text not null,
  order_id uuid references public.orders (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index payment_events_order_idx on public.payment_events (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete set null,
  amount integer not null check (amount > 0),
  reason text not null check (length(trim(reason)) between 3 and 500),
  status public.refund_status not null default 'pending',
  restock boolean not null default false,
  provider_refund_id text,
  manual_reference text check (manual_reference is null or length(manual_reference) <= 200),
  failure_reason text,
  created_by uuid references auth.users (id) on delete set null,
  completed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index refunds_order_idx on public.refunds (order_id);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  carrier text not null check (length(trim(carrier)) between 2 and 60),
  tracking_number text not null check (length(trim(tracking_number)) between 3 and 80),
  tracking_url text check (tracking_url is null or tracking_url ~ '^https://'),
  shipped_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  amount integer not null check (amount >= 0),
  status public.redemption_status not null default 'reserved',
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id, status);
create index coupon_redemptions_email_idx on public.coupon_redemptions (coupon_id, lower(email));

-- ---------------------------------------------------------------------------
-- Guards: payment status may change only inside payment functions which set
-- app.payment_ctx = 'on'. Admins can never flip an order to "paid".
-- ---------------------------------------------------------------------------
create or replace function public.guard_order_payment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_status is distinct from old.payment_status
     and coalesce(current_setting('app.payment_ctx', true), '') <> 'on' then
    raise exception 'payment_status_direct_update_forbidden' using errcode = 'P0001';
  end if;
  if (new.grand_total, new.subtotal, new.discount_total, new.shipping_total)
     is distinct from (old.grand_total, old.subtotal, old.discount_total, old.shipping_total) then
    raise exception 'order_totals_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger orders_payment_guard before update on public.orders
  for each row execute function public.guard_order_payment_status();

create or replace function public.guard_payment_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.payment_ctx', true), '') <> 'on' then
    raise exception 'payments_write_forbidden' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger payments_guard before insert or update or delete on public.payments
  for each row execute function public.guard_payment_rows();

-- Log initial stock of newly created variants.
create or replace function public.log_initial_variant_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory_movements (variant_id, sku, type, quantity_delta, on_hand_after, reason, actor_id)
  values (new.id, new.sku, 'initial', new.stock_on_hand, new.stock_on_hand, 'variant created', (select auth.uid()));
  return new;
end;
$$;
create trigger product_variants_initial_stock after insert on public.product_variants
  for each row execute function public.log_initial_variant_stock();

-- Audit
create trigger shipping_methods_audit after insert or update or delete on public.shipping_methods for each row execute function public.audit_row_change();
create trigger coupons_audit after insert or update or delete on public.coupons for each row execute function public.audit_row_change();
create trigger shipments_audit after insert or update or delete on public.shipments for each row execute function public.audit_row_change();
create trigger refunds_audit after insert or update on public.refunds for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.shipping_methods enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.stock_reservations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.shipments enable row level security;
alter table public.coupon_redemptions enable row level security;

grant select on public.shipping_methods to anon, authenticated;
grant insert, update, delete on public.shipping_methods to authenticated;
grant select, insert, update, delete on public.coupons to authenticated;
grant select on public.orders, public.order_items, public.order_status_history, public.stock_reservations,
  public.inventory_movements, public.payments, public.payment_events, public.refunds, public.shipments,
  public.coupon_redemptions to authenticated;

create policy "shipping_methods: public read active" on public.shipping_methods for select to anon, authenticated
  using (is_active or public.has_permission('settings.manage'));
create policy "shipping_methods: admin insert" on public.shipping_methods for insert to authenticated
  with check (public.has_permission('settings.manage'));
create policy "shipping_methods: admin update" on public.shipping_methods for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy "shipping_methods: admin delete" on public.shipping_methods for delete to authenticated
  using (public.has_permission('settings.manage'));

create policy "coupons: admin select" on public.coupons for select to authenticated using (public.has_permission('coupons.manage'));
create policy "coupons: admin insert" on public.coupons for insert to authenticated with check (public.has_permission('coupons.manage'));
create policy "coupons: admin update" on public.coupons for update to authenticated
  using (public.has_permission('coupons.manage')) with check (public.has_permission('coupons.manage'));
create policy "coupons: admin delete" on public.coupons for delete to authenticated using (public.has_permission('coupons.manage'));

create policy "orders: own or staff read" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('orders.view'));
create policy "order_items: visible with order" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "order_status_history: own public or staff" on public.order_status_history for select to authenticated
  using (public.has_permission('orders.view')
         or (not is_internal and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))));
create policy "shipments: visible with order" on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "stock_reservations: inventory read" on public.stock_reservations for select to authenticated
  using (public.has_permission('inventory.manage'));
create policy "inventory_movements: inventory read" on public.inventory_movements for select to authenticated
  using (public.has_permission('inventory.manage'));
create policy "payments: staff read" on public.payments for select to authenticated
  using (public.has_permission('orders.view'));
create policy "payment_events: refund-capable admins read" on public.payment_events for select to authenticated
  using (public.has_permission('orders.refund'));
create policy "refunds: staff read" on public.refunds for select to authenticated
  using (public.has_permission('orders.view'));
create policy "coupon_redemptions: admin read" on public.coupon_redemptions for select to authenticated
  using (public.has_permission('coupons.manage'));
