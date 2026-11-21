-- =============================================================================
-- MAISON SURGE — 0600 Functions
-- * catalog_search: public, security invoker (RLS applies)
-- * order / payment / reservation functions: service_role only
-- * admin_* functions: authenticated, permission checked inside
-- Lock order to avoid deadlocks: orders row first, then variants sorted by id.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Catalog search with filters, sorting and pagination
-- ---------------------------------------------------------------------------
create or replace function public.catalog_search(
  p_locale text default 'tr',
  p_category text default null,
  p_collection text default null,
  p_q text default null,
  p_sizes text[] default null,
  p_colors text[] default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_in_stock boolean default false,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0,
  p_featured boolean default false,
  p_ids uuid[] default null
)
returns table (
  id uuid,
  slug text,
  name text,
  price integer,
  compare_at_price integer,
  cover_path text,
  cover_alt jsonb,
  hover_path text,
  in_stock boolean,
  color_hexes text[],
  is_featured boolean,
  published_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with recursive cat as (
    select c.id from public.categories c
    where p_category is not null and c.slug = p_category and c.is_active
    union all
    select c.id from public.categories c join cat on c.parent_id = cat.id where c.is_active
  ),
  q as (
    select nullif(trim(coalesce(p_q, '')), '') as text
  ),
  base as (
    select p.id, p.slug, p.is_featured, p.published_at, p.base_price, p.compare_at_price,
           coalesce(t.name, tr.name, p.slug) as name
    from public.products p
    left join public.product_translations t on t.product_id = p.id and t.locale = p_locale
    left join public.product_translations tr on tr.product_id = p.id and tr.locale = 'tr'
    cross join q
    where p.status = 'published'
      and (p_ids is null or p.id = any (p_ids))
      and (p_category is null or p.category_id in (select cat.id from cat))
      and (p_collection is null or exists (
            select 1 from public.collection_products cp
            join public.collections co on co.id = cp.collection_id
            where cp.product_id = p.id and co.slug = p_collection and co.is_active))
      and (not coalesce(p_featured, false) or p.is_featured)
      and (q.text is null or exists (
            select 1 from public.product_translations st
            where st.product_id = p.id
              and (st.search_vector @@ plainto_tsquery('simple', q.text)
                   or st.name ilike '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%')))
      and exists (
            select 1 from public.product_variants v
            left join public.sizes s on s.id = v.size_id
            left join public.colors c on c.id = v.color_id
            where v.product_id = p.id and v.is_active
              and (p_sizes is null or cardinality(p_sizes) = 0 or s.code = any (p_sizes))
              and (p_colors is null or cardinality(p_colors) = 0 or c.code = any (p_colors))
              and (not coalesce(p_in_stock, false) or v.stock_on_hand - v.stock_reserved > 0))
  ),
  priced as (
    select b.*,
      (select min(coalesce(v.price, b.base_price)) from public.product_variants v
        where v.product_id = b.id and v.is_active) as min_price,
      exists (select 1 from public.product_variants v
        where v.product_id = b.id and v.is_active and v.stock_on_hand - v.stock_reserved > 0) as has_stock
    from base b
  ),
  filtered as (
    select pr.* from priced pr
    where pr.min_price is not null
      and (p_min_price is null or pr.min_price >= p_min_price)
      and (p_max_price is null or pr.min_price <= p_max_price)
  )
  select f.id, f.slug, f.name, f.min_price,
    case when f.compare_at_price is not null and f.compare_at_price > f.min_price then f.compare_at_price end,
    (select i.path from public.product_images i where i.product_id = f.id order by i.is_cover desc, i.position, i.created_at limit 1),
    (select i.alt from public.product_images i where i.product_id = f.id order by i.is_cover desc, i.position, i.created_at limit 1),
    (select i.path from public.product_images i where i.product_id = f.id order by i.is_cover desc, i.position, i.created_at offset 1 limit 1),
    f.has_stock,
    coalesce((select array_agg(x.hex order by x.position) from (
      select distinct c.hex, c.position from public.product_variants v
      join public.colors c on c.id = v.color_id
      where v.product_id = f.id and v.is_active) x), '{}'::text[]),
    f.is_featured, f.published_at,
    count(*) over ()
  from filtered f
  order by
    case when p_sort = 'price_asc' then f.min_price end asc nulls last,
    case when p_sort = 'price_desc' then f.min_price end desc nulls last,
    case when p_sort = 'name' then f.name end asc,
    case when p_sort = 'featured' then f.is_featured end desc,
    f.published_at desc nulls last,
    f.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.catalog_search(text, text, text, text, text[], text[], integer, integer, boolean, text, integer, integer, boolean, uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Discount formula (shared by create_order; mirrored in src/lib/pricing.ts)
-- percent: floor(base * value / 100) capped by max_discount; fixed: value.
-- Never exceeds the subtotal.
-- ---------------------------------------------------------------------------
create or replace function public.compute_coupon_discount(p_type public.coupon_type, p_value integer, p_max integer, p_subtotal integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(0, least(p_subtotal,
    case p_type
      when 'percent' then least(floor(p_subtotal::numeric * p_value / 100)::integer, coalesce(p_max, 2147483647))
      else least(p_value, coalesce(p_max, 2147483647))
    end));
$$;

-- ---------------------------------------------------------------------------
-- Internal: history + reservation release (not exposed)
-- ---------------------------------------------------------------------------
create or replace function public.internal_order_history(p_order_id uuid, p_from public.order_status, p_note text, p_internal boolean, p_actor uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.order_status_history (order_id, from_status, to_status, payment_status, note, is_internal, actor_id)
  select o.id, p_from, o.status, o.payment_status, p_note, p_internal, p_actor
  from public.orders o where o.id = p_order_id;
$$;
revoke execute on function public.internal_order_history(uuid, public.order_status, text, boolean, uuid) from public, anon, authenticated;

create or replace function public.internal_release_reservations(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  perform set_config('app.stock_ctx', 'on', true);
  -- lock affected variants in a stable order
  perform 1 from public.product_variants v
    where v.id in (select sr.variant_id from public.stock_reservations sr where sr.order_id = p_order_id and sr.status = 'active')
    order by v.id for update;

  for r in select sr.id, sr.variant_id, sr.quantity from public.stock_reservations sr
           where sr.order_id = p_order_id and sr.status = 'active' loop
    update public.product_variants set stock_reserved = stock_reserved - r.quantity where id = r.variant_id;
    update public.stock_reservations set status = 'released', resolved_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  update public.coupon_redemptions set status = 'released' where order_id = p_order_id and status = 'reserved';
  perform set_config('app.stock_ctx', 'off', true);
  return v_count;
end;
$$;
revoke execute on function public.internal_release_reservations(uuid) from public, anon, authenticated;

-- Restock every item of an order (cancel after payment / returns).
create or replace function public.internal_restock_order(p_order_id uuid, p_type public.inventory_movement_type, p_reason text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_after integer;
begin
  perform set_config('app.stock_ctx', 'on', true);
  perform 1 from public.product_variants v
    where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
    order by v.id for update;
  for r in select oi.variant_id, oi.quantity, oi.sku from public.order_items oi
           where oi.order_id = p_order_id and oi.variant_id is not null loop
    update public.product_variants set stock_on_hand = stock_on_hand + r.quantity
      where id = r.variant_id returning stock_on_hand into v_after;
    insert into public.inventory_movements (variant_id, sku, type, quantity_delta, on_hand_after, order_id, reason, actor_id)
    values (r.variant_id, r.sku, p_type, r.quantity, v_after, p_order_id, p_reason, p_actor);
  end loop;
  perform set_config('app.stock_ctx', 'off', true);
end;
$$;
revoke execute on function public.internal_restock_order(uuid, public.inventory_movement_type, text, uuid) from public, anon, authenticated;

-- Take stock directly from available quantity (used when a payment arrives for
-- an order whose reservation already expired). Returns false if impossible.
create or replace function public.internal_take_stock_without_reservation(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_after integer;
begin
  perform set_config('app.stock_ctx', 'on', true);
  perform 1 from public.product_variants v
    where v.id in (select oi.variant_id from public.order_items oi where oi.order_id = p_order_id)
    order by v.id for update;

  if exists (
    select 1 from public.order_items oi
    left join public.product_variants v on v.id = oi.variant_id
    where oi.order_id = p_order_id
      and (v.id is null or v.stock_on_hand - v.stock_reserved < oi.quantity)
  ) then
    perform set_config('app.stock_ctx', 'off', true);
    return false;
  end if;

  for r in select oi.variant_id, oi.quantity, oi.sku from public.order_items oi where oi.order_id = p_order_id loop
    update public.product_variants set stock_on_hand = stock_on_hand - r.quantity
      where id = r.variant_id returning stock_on_hand into v_after;
    insert into public.inventory_movements (variant_id, sku, type, quantity_delta, on_hand_after, order_id, reason)
    values (r.variant_id, r.sku, 'sale', -r.quantity, v_after, p_order_id, 'payment after reservation expiry');
  end loop;
  perform set_config('app.stock_ctx', 'off', true);
  return true;
end;
$$;
revoke execute on function public.internal_take_stock_without_reservation(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Expire unpaid orders whose reservation timed out. Safe to run concurrently
-- (skip locked). Called by cron route and opportunistically at checkout.
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_reservations(p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select o.id from public.orders o
    where o.status = 'pending_payment'
      and o.payment_status <> 'paid'
      and o.reservation_expires_at < now()
    order by o.reservation_expires_at
    limit p_limit
    for update skip locked
  loop
    perform public.internal_release_reservations(v_order.id);
    update public.orders set status = 'expired' where id = v_order.id;
    perform public.internal_order_history(v_order.id, 'pending_payment', 'reservation expired', false, null);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.release_expired_reservations(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_order: validates prices/stock/coupon/shipping against the database
-- inside one transaction, reserves stock, and is idempotent per key.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := p->>'idempotency_key';
  v_existing record;
  v_item jsonb;
  v_variant record;
  v_items_count integer;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_shipping integer := 0;
  v_coupon record;
  v_coupon_id uuid := null;
  v_coupon_code text := null;
  v_coupon_uses integer;
  v_customer_uses integer;
  v_method record;
  v_order_id uuid;
  v_order_number text;
  v_minutes integer;
  v_expires timestamptz;
  v_user uuid := nullif(p->>'user_id', '')::uuid;
  v_email text := lower(trim(p->>'email'));
  v_locale text := coalesce(p->>'locale', 'tr');
  v_ids uuid[];
begin
  if v_key is null or length(v_key) < 16 then
    raise exception 'idempotency_key_required' using errcode = 'P0001';
  end if;

  select o.id, o.order_number into v_existing from public.orders o where o.idempotency_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'existing', true);
  end if;

  v_items_count := jsonb_array_length(coalesce(p->'items', '[]'::jsonb));
  if v_items_count = 0 then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;
  if v_items_count > 50 then
    raise exception 'too_many_items' using errcode = 'P0001';
  end if;

  -- free stock held by abandoned orders before checking availability
  perform public.release_expired_reservations(100);

  select array_agg(distinct (x->>'variant_id')::uuid) into v_ids from jsonb_array_elements(p->'items') x;
  if cardinality(v_ids) <> v_items_count then
    raise exception 'duplicate_items' using errcode = 'P0001';
  end if;

  perform set_config('app.stock_ctx', 'on', true);
  perform 1 from public.product_variants v where v.id = any (v_ids) order by v.id for update;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    select v.id, v.sku, v.stock_on_hand, v.stock_reserved, v.is_active,
           coalesce(v.price, pr.base_price) as unit_price, pr.status
      into v_variant
      from public.product_variants v
      join public.products pr on pr.id = v.product_id
     where v.id = (v_item->>'variant_id')::uuid;

    if not found or not v_variant.is_active or v_variant.status <> 'published' then
      raise exception 'variant_unavailable' using errcode = 'P0001', detail = v_item->>'variant_id';
    end if;
    if (v_item->>'quantity')::integer not between 1 and 20 then
      raise exception 'invalid_quantity' using errcode = 'P0001', detail = v_item->>'variant_id';
    end if;
    if v_variant.unit_price <> (v_item->>'unit_price')::integer then
      raise exception 'price_changed' using errcode = 'P0001', detail = v_item->>'variant_id';
    end if;
    if v_variant.stock_on_hand - v_variant.stock_reserved < (v_item->>'quantity')::integer then
      raise exception 'insufficient_stock' using errcode = 'P0001', detail = v_item->>'variant_id';
    end if;
    v_subtotal := v_subtotal + v_variant.unit_price * (v_item->>'quantity')::integer;
  end loop;

  if v_subtotal <> (p->>'subtotal')::integer then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  -- coupon
  if nullif(p->>'coupon_code', '') is not null then
    select * into v_coupon from public.coupons c where c.code = upper(p->>'coupon_code') for update;
    if not found or not v_coupon.is_active
       or (v_coupon.starts_at is not null and v_coupon.starts_at > now())
       or (v_coupon.ends_at is not null and v_coupon.ends_at <= now())
       or v_subtotal < v_coupon.min_subtotal then
      raise exception 'coupon_invalid' using errcode = 'P0001';
    end if;
    select count(*) into v_coupon_uses from public.coupon_redemptions r
      where r.coupon_id = v_coupon.id and r.status in ('reserved', 'applied');
    if v_coupon.usage_limit is not null and v_coupon_uses >= v_coupon.usage_limit then
      raise exception 'coupon_limit_reached' using errcode = 'P0001';
    end if;
    if v_coupon.per_customer_limit is not null then
      select count(*) into v_customer_uses from public.coupon_redemptions r
        where r.coupon_id = v_coupon.id and r.status in ('reserved', 'applied')
          and (lower(r.email) = v_email or (v_user is not null and r.user_id = v_user));
      if v_customer_uses >= v_coupon.per_customer_limit then
        raise exception 'coupon_limit_reached' using errcode = 'P0001';
      end if;
    end if;
    v_discount := public.compute_coupon_discount(v_coupon.type, v_coupon.value, v_coupon.max_discount, v_subtotal);
    v_coupon_id := v_coupon.id;
    v_coupon_code := v_coupon.code;
  end if;

  if v_discount <> coalesce((p->>'discount_total')::integer, 0) then
    raise exception 'discount_mismatch' using errcode = 'P0001';
  end if;

  -- shipping
  select * into v_method from public.shipping_methods m where m.id = (p->>'shipping_method_id')::uuid and m.is_active;
  if not found then
    raise exception 'shipping_method_invalid' using errcode = 'P0001';
  end if;
  v_shipping := case when v_method.free_over is not null and (v_subtotal - v_discount) >= v_method.free_over
                     then 0 else v_method.price end;
  if v_shipping <> (p->>'shipping_total')::integer then
    raise exception 'shipping_total_mismatch' using errcode = 'P0001';
  end if;
  if (v_subtotal - v_discount + v_shipping) <> (p->>'grand_total')::integer then
    raise exception 'grand_total_mismatch' using errcode = 'P0001';
  end if;

  select s.reservation_minutes into v_minutes from public.site_settings s where s.id;
  v_expires := now() + make_interval(mins => coalesce(v_minutes, 30));

  v_order_number := 'MS-' || to_char(now() at time zone 'Europe/Istanbul', 'YYMMDD') || '-' ||
                    lpad(nextval('public.order_number_seq')::text, 5, '0');

  insert into public.orders (
    order_number, user_id, email, phone, locale, status, payment_status, subtotal, discount_total,
    shipping_total, vat_total, grand_total, coupon_id, coupon_code, shipping_method_id, shipping_method_name,
    shipping_address, billing_address, billing_info, customer_note, cart_id, idempotency_key,
    guest_token_hash, payment_provider, reservation_expires_at, terms_accepted_at, terms_version
  ) values (
    v_order_number, v_user, v_email, p->>'phone', v_locale, 'pending_payment', 'unpaid', v_subtotal, v_discount,
    v_shipping, greatest(0, coalesce((p->>'vat_total')::integer, 0)), v_subtotal - v_discount + v_shipping,
    v_coupon_id, v_coupon_code, v_method.id, v_method.name,
    p->'shipping_address', p->'billing_address', coalesce(p->'billing_info', '{"type":"individual"}'::jsonb),
    nullif(p->>'customer_note', ''), nullif(p->>'cart_id', '')::uuid, v_key,
    nullif(p->>'guest_token_hash', ''), p->>'payment_provider', v_expires, now(), coalesce(p->>'terms_version', 'unknown')
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, variant_id, sku, product_name, variant_label, image_path, unit_price, quantity, line_total)
  select v_order_id, pr.id, v.id, v.sku,
         coalesce(t.name, tr.name, pr.slug),
         concat_ws(' / ', nullif(coalesce(c.name->>v_locale, c.name->>'tr'), ''), nullif(coalesce(s.label->>v_locale, s.label->>'tr'), '')),
         (select i.path from public.product_images i where i.product_id = pr.id
            order by (i.color_id is not distinct from v.color_id) desc, i.is_cover desc, i.position limit 1),
         coalesce(v.price, pr.base_price),
         (x->>'quantity')::integer,
         coalesce(v.price, pr.base_price) * (x->>'quantity')::integer
  from jsonb_array_elements(p->'items') x
  join public.product_variants v on v.id = (x->>'variant_id')::uuid
  join public.products pr on pr.id = v.product_id
  left join public.product_translations t on t.product_id = pr.id and t.locale = v_locale
  left join public.product_translations tr on tr.product_id = pr.id and tr.locale = 'tr'
  left join public.sizes s on s.id = v.size_id
  left join public.colors c on c.id = v.color_id;

  for v_item in select * from jsonb_array_elements(p->'items') loop
    update public.product_variants
       set stock_reserved = stock_reserved + (v_item->>'quantity')::integer
     where id = (v_item->>'variant_id')::uuid;
    insert into public.stock_reservations (order_id, variant_id, quantity, expires_at)
    values (v_order_id, (v_item->>'variant_id')::uuid, (v_item->>'quantity')::integer, v_expires);
  end loop;
  perform set_config('app.stock_ctx', 'off', true);

  if v_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, user_id, email, amount, status)
    values (v_coupon_id, v_order_id, v_user, v_email, v_discount, 'reserved');
  end if;

  perform public.internal_order_history(v_order_id, null, 'order created', false, v_user);

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number, 'existing', false,
                            'expires_at', v_expires, 'grand_total', v_subtotal - v_discount + v_shipping);
end;
$$;
revoke execute on function public.create_order(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create or replace function public.start_payment(p_order_id uuid, p_provider text, p_session_id text, p_is_test boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_payment_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status <> 'pending_payment' or v_order.payment_status in ('paid', 'refunded', 'partially_refunded') then
    raise exception 'order_not_payable' using errcode = 'P0001';
  end if;
  if v_order.reservation_expires_at < now() then
    raise exception 'order_expired' using errcode = 'P0001';
  end if;

  perform set_config('app.payment_ctx', 'on', true);
  update public.payments set status = 'failed', failure_reason = 'superseded by new attempt'
   where order_id = p_order_id and status = 'pending';
  insert into public.payments (order_id, provider, provider_session_id, status, amount, currency, is_test)
  values (p_order_id, p_provider, p_session_id, 'pending', v_order.grand_total, v_order.currency, p_is_test)
  returning id into v_payment_id;
  update public.orders set payment_status = 'pending', payment_provider = p_provider where id = p_order_id;
  perform set_config('app.payment_ctx', 'off', true);
  return v_payment_id;
end;
$$;
revoke execute on function public.start_payment(uuid, text, text, boolean) from public, anon, authenticated;

-- Idempotent: the (provider, event_id) unique key turns redeliveries into no-ops.
create or replace function public.confirm_payment(
  p_provider text, p_event_id text, p_event_type text, p_order_id uuid,
  p_provider_payment_id text, p_amount integer, p_currency text, p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_order record;
  v_result text;
  v_prev public.order_status;
  r record;
  v_after integer;
begin
  insert into public.payment_events (provider, event_id, event_type, order_id, payload)
  values (p_provider, p_event_id, p_event_type, p_order_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    return 'duplicate_event';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    update public.payment_events set result = 'order_not_found', processed_at = now() where id = v_event_id;
    return 'order_not_found';
  end if;
  v_prev := v_order.status;

  perform set_config('app.payment_ctx', 'on', true);

  if v_order.payment_status in ('paid', 'refunded', 'partially_refunded') then
    v_result := 'already_paid';
  elsif p_amount <> v_order.grand_total or upper(p_currency) <> v_order.currency then
    update public.orders set status = case when status = 'pending_payment' then 'on_hold'::public.order_status else status end,
      internal_note = left(concat_ws(E'\n', internal_note, 'Payment amount/currency mismatch: ' || p_amount || ' ' || p_currency), 2000)
     where id = p_order_id;
    perform public.internal_order_history(p_order_id, v_prev, 'payment amount mismatch — manual review required', true, null);
    v_result := 'amount_mismatch';
  else
    if v_order.status = 'pending_payment' then
      -- consume active reservations
      perform set_config('app.stock_ctx', 'on', true);
      perform 1 from public.product_variants v
        where v.id in (select sr.variant_id from public.stock_reservations sr where sr.order_id = p_order_id and sr.status = 'active')
        order by v.id for update;
      for r in select sr.id, sr.variant_id, sr.quantity, v.sku from public.stock_reservations sr
               join public.product_variants v on v.id = sr.variant_id
               where sr.order_id = p_order_id and sr.status = 'active' loop
        update public.product_variants
           set stock_on_hand = stock_on_hand - r.quantity, stock_reserved = stock_reserved - r.quantity
         where id = r.variant_id returning stock_on_hand into v_after;
        update public.stock_reservations set status = 'consumed', resolved_at = now() where id = r.id;
        insert into public.inventory_movements (variant_id, sku, type, quantity_delta, on_hand_after, order_id, reason)
        values (r.variant_id, r.sku, 'sale', -r.quantity, v_after, p_order_id, 'payment confirmed');
      end loop;
      perform set_config('app.stock_ctx', 'off', true);
      update public.orders set status = 'confirmed', payment_status = 'paid', paid_at = now() where id = p_order_id;
      v_result := 'confirmed';
    elsif v_order.status = 'expired' and public.internal_take_stock_without_reservation(p_order_id) then
      update public.orders set status = 'confirmed', payment_status = 'paid', paid_at = now() where id = p_order_id;
      v_result := 'confirmed_after_expiry';
    else
      update public.orders set status = 'on_hold', payment_status = 'paid', paid_at = now(),
        internal_note = left(concat_ws(E'\n', internal_note, 'Paid after expiry/cancel and stock unavailable: refund or restock required.'), 2000)
       where id = p_order_id;
      v_result := 'paid_on_hold';
    end if;

    update public.payments set status = 'succeeded', provider_payment_id = p_provider_payment_id
     where id = (select id from public.payments where order_id = p_order_id and provider = p_provider
                 order by (status = 'pending') desc, created_at desc limit 1);
    if not found then
      insert into public.payments (order_id, provider, provider_payment_id, status, amount, currency)
      values (p_order_id, p_provider, p_provider_payment_id, 'succeeded', p_amount, upper(p_currency));
    end if;

    update public.coupon_redemptions set status = 'applied' where order_id = p_order_id and status in ('reserved', 'released');
    if v_order.cart_id is not null then
      delete from public.cart_items where cart_id = v_order.cart_id;
      update public.carts set coupon_code = null where id = v_order.cart_id;
    end if;
    perform public.internal_order_history(p_order_id, v_prev, 'payment verified (' || p_provider || ')', false, null);
  end if;

  perform set_config('app.payment_ctx', 'off', true);
  update public.payment_events set result = v_result, processed_at = now() where id = v_event_id;
  return v_result;
end;
$$;
revoke execute on function public.confirm_payment(text, text, text, uuid, text, integer, text, jsonb) from public, anon, authenticated;

create or replace function public.fail_payment(
  p_provider text, p_event_id text, p_event_type text, p_order_id uuid, p_reason text, p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_order record;
  v_result text;
begin
  insert into public.payment_events (provider, event_id, event_type, order_id, payload)
  values (p_provider, p_event_id, p_event_type, p_order_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then
    return 'duplicate_event';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    v_result := 'order_not_found';
  elsif v_order.payment_status in ('paid', 'refunded', 'partially_refunded') then
    v_result := 'ignored_already_paid';
  else
    perform set_config('app.payment_ctx', 'on', true);
    update public.payments set status = 'failed', failure_reason = left(p_reason, 300)
     where order_id = p_order_id and provider = p_provider and status = 'pending';
    update public.orders set payment_status = 'failed' where id = p_order_id;
    perform set_config('app.payment_ctx', 'off', true);
    perform public.internal_order_history(p_order_id, v_order.status, 'payment failed', false, null);
    v_result := 'failed';
  end if;

  update public.payment_events set result = v_result, processed_at = now() where id = v_event_id;
  return v_result;
end;
$$;
revoke execute on function public.fail_payment(text, text, text, uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: order transitions. Payment status is never set here.
-- Allowed (mirrored in src/lib/orders/transitions.ts):
--   confirmed  -> processing
--   shipped    -> delivered
--   on_hold    -> confirmed (paid + stock now allocatable)
-- shipped is set by admin_mark_shipped; cancelled by admin_cancel_order;
-- refunded by refund completion.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_order_status(p_order_id uuid, p_to public.order_status, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_actor uuid := (select auth.uid());
begin
  if not public.has_permission('orders.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if (v_order.status, p_to) = ('confirmed', 'processing') then
    null;
  elsif (v_order.status, p_to) = ('shipped', 'delivered') then
    update public.shipments set delivered_at = coalesce(delivered_at, now()) where order_id = p_order_id;
  elsif (v_order.status, p_to) = ('on_hold', 'confirmed') then
    if v_order.payment_status <> 'paid' then
      raise exception 'order_not_paid' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.inventory_movements m where m.order_id = p_order_id and m.type = 'sale') then
      if not public.internal_take_stock_without_reservation(p_order_id) then
        raise exception 'insufficient_stock' using errcode = 'P0001';
      end if;
    end if;
  else
    raise exception 'invalid_transition' using errcode = 'P0001', detail = v_order.status || '->' || p_to;
  end if;

  update public.orders set status = p_to where id = p_order_id;
  perform public.internal_order_history(p_order_id, v_order.status, nullif(trim(coalesce(p_note, '')), ''), false, v_actor);
end;
$$;
revoke execute on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;

create or replace function public.admin_mark_shipped(p_order_id uuid, p_carrier text, p_tracking_number text, p_tracking_url text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_shipment uuid;
  v_actor uuid := (select auth.uid());
begin
  if not public.has_permission('orders.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status not in ('confirmed', 'processing') or v_order.payment_status <> 'paid' then
    raise exception 'invalid_transition' using errcode = 'P0001', detail = v_order.status || '->shipped';
  end if;
  insert into public.shipments (order_id, carrier, tracking_number, tracking_url, created_by)
  values (p_order_id, trim(p_carrier), trim(p_tracking_number), nullif(trim(coalesce(p_tracking_url, '')), ''), v_actor)
  returning id into v_shipment;
  update public.orders set status = 'shipped' where id = p_order_id;
  perform public.internal_order_history(p_order_id, v_order.status, 'shipped: ' || trim(p_carrier) || ' ' || trim(p_tracking_number), false, v_actor);
  return v_shipment;
end;
$$;
revoke execute on function public.admin_mark_shipped(uuid, text, text, text) from public, anon;
grant execute on function public.admin_mark_shipped(uuid, text, text, text) to authenticated;

-- Cancel. Unpaid: release reservations. Paid (not shipped): restock + pending
-- refund for the remaining amount. Returns the refund id (or null).
create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text, p_restock boolean default true)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_actor uuid := (select auth.uid());
  v_refund uuid;
  v_payment uuid;
  v_outstanding integer;
begin
  if not public.has_permission('orders.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.status not in ('pending_payment', 'confirmed', 'processing', 'on_hold') then
    raise exception 'invalid_transition' using errcode = 'P0001', detail = v_order.status || '->cancelled';
  end if;

  if v_order.payment_status = 'paid' then
    if not public.has_permission('orders.refund') then
      raise exception 'forbidden_refund' using errcode = '42501';
    end if;
    -- stock was consumed (sale movement exists) -> restock if requested
    if p_restock and exists (select 1 from public.inventory_movements m where m.order_id = p_order_id and m.type = 'sale') then
      perform public.internal_restock_order(p_order_id, 'cancel_restock', 'order cancelled: ' || p_reason, v_actor);
    end if;
    v_outstanding := v_order.grand_total - v_order.refunded_total
      - coalesce((select sum(amount) from public.refunds where order_id = p_order_id and status = 'pending'), 0);
    if v_outstanding > 0 then
      select id into v_payment from public.payments where order_id = p_order_id and status = 'succeeded' order by created_at desc limit 1;
      insert into public.refunds (order_id, payment_id, amount, reason, restock, created_by)
      values (p_order_id, v_payment, v_outstanding, trim(p_reason), p_restock, v_actor)
      returning id into v_refund;
    end if;
  else
    perform public.internal_release_reservations(p_order_id);
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now() where id = p_order_id;
  perform public.internal_order_history(p_order_id, v_order.status, 'cancelled: ' || trim(p_reason), false, v_actor);
  return v_refund;
end;
$$;
revoke execute on function public.admin_cancel_order(uuid, text, boolean) from public, anon;
grant execute on function public.admin_cancel_order(uuid, text, boolean) to authenticated;

-- Refund for shipped/delivered orders (returns). Full or partial amount.
create or replace function public.admin_create_refund(p_order_id uuid, p_amount integer, p_reason text, p_restock boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_actor uuid := (select auth.uid());
  v_refund uuid;
  v_payment uuid;
  v_outstanding integer;
begin
  if not public.has_permission('orders.refund') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'order_not_paid' using errcode = 'P0001';
  end if;
  if v_order.status not in ('confirmed', 'processing', 'shipped', 'delivered', 'on_hold') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  v_outstanding := v_order.grand_total - v_order.refunded_total
    - coalesce((select sum(amount) from public.refunds where order_id = p_order_id and status = 'pending'), 0);
  if p_amount is null or p_amount <= 0 or p_amount > v_outstanding then
    raise exception 'refund_amount_invalid' using errcode = 'P0001';
  end if;
  if p_restock then
    perform public.internal_restock_order(p_order_id, 'return_restock', 'return: ' || p_reason, v_actor);
  end if;
  select id into v_payment from public.payments where order_id = p_order_id and status in ('succeeded', 'partially_refunded') order by created_at desc limit 1;
  insert into public.refunds (order_id, payment_id, amount, reason, restock, created_by)
  values (p_order_id, v_payment, p_amount, trim(p_reason), p_restock, v_actor)
  returning id into v_refund;
  perform public.internal_order_history(p_order_id, v_order.status, 'refund requested: ' || p_amount, true, v_actor);
  return v_refund;
end;
$$;
revoke execute on function public.admin_create_refund(uuid, integer, text, boolean) from public, anon;
grant execute on function public.admin_create_refund(uuid, integer, text, boolean) to authenticated;

create or replace function public.internal_complete_refund(
  p_refund_id uuid, p_success boolean, p_provider_refund_id text, p_manual_reference text, p_failure text, p_actor uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund record;
  v_order record;
  v_new_total integer;
begin
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then
    raise exception 'refund_not_found' using errcode = 'P0001';
  end if;
  if v_refund.status <> 'pending' then
    return 'already_' || v_refund.status;
  end if;
  select * into v_order from public.orders where id = v_refund.order_id for update;

  if not p_success then
    update public.refunds set status = 'failed', failure_reason = left(p_failure, 300), completed_at = now(), completed_by = p_actor
     where id = p_refund_id;
    perform public.internal_order_history(v_order.id, v_order.status, 'refund failed', true, p_actor);
    return 'failed';
  end if;

  v_new_total := v_order.refunded_total + v_refund.amount;
  perform set_config('app.payment_ctx', 'on', true);
  update public.refunds set status = 'completed', provider_refund_id = p_provider_refund_id,
    manual_reference = p_manual_reference, completed_at = now(), completed_by = p_actor
   where id = p_refund_id;
  update public.orders set
    refunded_total = v_new_total,
    payment_status = case when v_new_total >= grand_total then 'refunded'::public.payment_status else 'partially_refunded'::public.payment_status end,
    status = case when v_new_total >= grand_total and status <> 'cancelled' then 'refunded'::public.order_status else status end
   where id = v_order.id;
  if v_refund.payment_id is not null then
    update public.payments set status = case when v_new_total >= v_order.grand_total then 'refunded' else 'partially_refunded' end
     where id = v_refund.payment_id;
  end if;
  perform set_config('app.payment_ctx', 'off', true);
  perform public.internal_order_history(v_order.id, v_order.status, 'refund completed: ' || v_refund.amount, false, p_actor);
  return 'completed';
end;
$$;
revoke execute on function public.internal_complete_refund(uuid, boolean, text, text, text, uuid) from public, anon, authenticated;

-- Called by trusted server code after the payment provider confirmed a refund.
create or replace function public.complete_refund(p_refund_id uuid, p_success boolean, p_provider_refund_id text, p_failure text, p_actor uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.internal_complete_refund(p_refund_id, p_success, p_provider_refund_id, null, p_failure, p_actor);
$$;
revoke execute on function public.complete_refund(uuid, boolean, text, text, uuid) from public, anon, authenticated;

-- Admin confirms that a refund was executed in the provider's own panel
-- (needed while the live provider's refund API is not integrated). Audited.
create or replace function public.admin_mark_refund_manual(p_refund_id uuid, p_reference text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('orders.refund') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reference, ''))) < 3 then
    raise exception 'reference_required' using errcode = 'P0001';
  end if;
  return public.internal_complete_refund(p_refund_id, true, null, trim(p_reference), null, (select auth.uid()));
end;
$$;
revoke execute on function public.admin_mark_refund_manual(uuid, text) from public, anon;
grant execute on function public.admin_mark_refund_manual(uuid, text) to authenticated;

create or replace function public.admin_set_internal_note(p_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('orders.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.orders set internal_note = left(nullif(trim(coalesce(p_note, '')), ''), 2000) where id = p_order_id;
  perform public.write_audit('update', 'orders', p_order_id::text, jsonb_build_object('internal_note', '***'));
end;
$$;
revoke execute on function public.admin_set_internal_note(uuid, text) from public, anon;
grant execute on function public.admin_set_internal_note(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: inventory
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_variant_stock(p_variant_id uuid, p_on_hand integer, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  v_actor uuid := (select auth.uid());
begin
  if not public.has_permission('inventory.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_on_hand is null or p_on_hand < 0 or p_on_hand > 1000000 then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;
  select * into v from public.product_variants where id = p_variant_id for update;
  if not found then
    raise exception 'variant_not_found' using errcode = 'P0001';
  end if;
  if p_on_hand < v.stock_reserved then
    raise exception 'below_reserved' using errcode = 'P0001', detail = v.stock_reserved::text;
  end if;
  if p_on_hand = v.stock_on_hand then
    return p_on_hand;
  end if;
  perform set_config('app.stock_ctx', 'on', true);
  update public.product_variants set stock_on_hand = p_on_hand where id = p_variant_id;
  perform set_config('app.stock_ctx', 'off', true);
  insert into public.inventory_movements (variant_id, sku, type, quantity_delta, on_hand_after, reason, actor_id)
  values (p_variant_id, v.sku, 'adjustment', p_on_hand - v.stock_on_hand, p_on_hand,
          left(coalesce(nullif(trim(p_reason), ''), 'manual adjustment'), 500), v_actor);
  return p_on_hand;
end;
$$;
revoke execute on function public.admin_set_variant_stock(uuid, integer, text) from public, anon;
grant execute on function public.admin_set_variant_stock(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: duplicate a product as a draft (variants copied with zero stock)
-- ---------------------------------------------------------------------------
create or replace function public.admin_duplicate_product(p_product_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src record;
  v_new uuid;
  v_slug text;
  v_n integer := 1;
  v record;
  v_sku text;
begin
  if not public.has_permission('catalog.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_src from public.products where id = p_product_id;
  if not found then
    raise exception 'product_not_found' using errcode = 'P0001';
  end if;
  loop
    v_slug := left(v_src.slug, 70) || '-kopya' || case when v_n > 1 then '-' || v_n else '' end;
    exit when not exists (select 1 from public.products where slug = v_slug);
    v_n := v_n + 1;
  end loop;

  insert into public.products (slug, category_id, status, base_price, compare_at_price, is_featured, size_guide)
  values (v_slug, v_src.category_id, 'draft', v_src.base_price, v_src.compare_at_price, false, v_src.size_guide)
  returning id into v_new;

  insert into public.product_translations (product_id, locale, name, description, material, care, seo_title, seo_description)
  select v_new, t.locale, left(t.name || case when t.locale = 'en' then ' (Copy)' else ' (Kopya)' end, 160),
         t.description, t.material, t.care, t.seo_title, t.seo_description
  from public.product_translations t where t.product_id = p_product_id;

  insert into public.product_costs (product_id, cost_price)
  select v_new, c.cost_price from public.product_costs c where c.product_id = p_product_id;

  for v in select * from public.product_variants where product_id = p_product_id order by position loop
    v_n := 1;
    loop
      v_sku := left(v.sku, 40) || '-C' || v_n;
      exit when not exists (select 1 from public.product_variants where sku = v_sku);
      v_n := v_n + 1;
    end loop;
    insert into public.product_variants (product_id, sku, size_id, color_id, price, compare_at_price, stock_on_hand, low_stock_threshold, is_active, position)
    values (v_new, v_sku, v.size_id, v.color_id, v.price, v.compare_at_price, 0, v.low_stock_threshold, v.is_active, v.position);
  end loop;

  insert into public.product_images (product_id, color_id, path, alt, width, height, position, is_cover)
  select v_new, i.color_id, i.path, i.alt, i.width, i.height, i.position, i.is_cover
  from public.product_images i where i.product_id = p_product_id;

  insert into public.collection_products (collection_id, product_id, position)
  select cp.collection_id, v_new, cp.position from public.collection_products cp where cp.product_id = p_product_id;

  return v_new;
end;
$$;
revoke execute on function public.admin_duplicate_product(uuid) from public, anon;
grant execute on function public.admin_duplicate_product(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not public.has_permission('roles.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = v_actor and p_role = 'admin' and not p_enabled then
    raise exception 'cannot_revoke_own_admin' using errcode = 'P0001';
  end if;
  if p_enabled then
    insert into public.user_roles (user_id, role, granted_by) values (p_user_id, p_role, v_actor)
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles where user_id = p_user_id and role = p_role;
  end if;
end;
$$;
revoke execute on function public.admin_set_role(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_set_role(uuid, public.app_role, boolean) to authenticated;

-- Bootstrap: only callable with the service role key or from the SQL editor.
create or replace function public.grant_role_by_email(p_email text, p_role public.app_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;
  insert into public.user_roles (user_id, role) values (v_user, p_role) on conflict do nothing;
  return v_user;
end;
$$;
revoke execute on function public.grant_role_by_email(text, public.app_role) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: customers (minimal PII) and staff list
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_customers(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, email text, full_name text, created_at timestamptz, order_count bigint, total_spent bigint, roles text[], total_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('customers.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, p.full_name, u.created_at,
      (select count(*) from public.orders o where o.user_id = u.id and o.payment_status in ('paid', 'partially_refunded', 'refunded')),
      coalesce((select sum(o.grand_total - o.refunded_total) from public.orders o where o.user_id = u.id and o.payment_status in ('paid', 'partially_refunded', 'refunded')), 0)::bigint,
      coalesce((select array_agg(ur.role::text) from public.user_roles ur where ur.user_id = u.id), '{}'::text[]),
      count(*) over ()
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p_search is null or length(trim(p_search)) = 0
       or u.email ilike '%' || replace(replace(trim(p_search), '%', '\%'), '_', '\_') || '%'
       or p.full_name ilike '%' || replace(replace(trim(p_search), '%', '\%'), '_', '\_') || '%'
    order by u.created_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_list_customers(text, integer, integer) from public, anon;
grant execute on function public.admin_list_customers(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: dashboard metrics from real data
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := date_trunc('day', now()) - make_interval(days => greatest(p_days, 1) - 1);
  v jsonb;
begin
  if not public.has_permission('dashboard.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'since', v_since,
    'net_revenue', coalesce((select sum(o.grand_total - o.refunded_total) from public.orders o
                              where o.paid_at >= v_since and o.payment_status in ('paid', 'partially_refunded', 'refunded')), 0),
    'paid_orders', (select count(*) from public.orders o where o.paid_at >= v_since and o.payment_status in ('paid', 'partially_refunded', 'refunded')),
    'pending_payment', (select count(*) from public.orders o where o.status = 'pending_payment'),
    'to_fulfil', (select count(*) from public.orders o where o.status in ('confirmed', 'processing')),
    'on_hold', (select count(*) from public.orders o where o.status = 'on_hold'),
    'pending_refunds', (select count(*) from public.refunds r where r.status = 'pending'),
    'low_stock', (select count(*) from public.product_variants pv join public.products p on p.id = pv.product_id
                   where pv.is_active and p.status = 'published' and pv.stock_on_hand - pv.stock_reserved <= pv.low_stock_threshold),
    'new_customers', (select count(*) from public.profiles pr where pr.created_at >= v_since),
    'new_messages', (select count(*) from public.contact_messages m where m.status = 'new'),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'revenue', d.revenue, 'orders', d.orders) order by d.day)
      from (
        select g.day::date as day,
          coalesce(sum(o.grand_total - o.refunded_total), 0) as revenue,
          count(o.id) as orders
        from generate_series(v_since, date_trunc('day', now()), interval '1 day') g(day)
        left join public.orders o on date_trunc('day', o.paid_at) = g.day
          and o.payment_status in ('paid', 'partially_refunded', 'refunded')
        group by g.day
      ) d), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.admin_dashboard_stats(integer) from public, anon;
grant execute on function public.admin_dashboard_stats(integer) to authenticated;
