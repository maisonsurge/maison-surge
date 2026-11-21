-- =============================================================================
-- MAISON SURGE — 0100 Foundation: enums, helpers, roles & permissions, audit log
-- Rules: deny-by-default (RLS on every table, explicit grants), money = integer
-- minor units (kuruş), security definer functions use an empty search_path.
-- =============================================================================

-- Deny-by-default at the privilege layer: new tables created by this role are
-- NOT automatically readable/writable by the Data API roles. Each table below
-- receives explicit grants plus RLS policies.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'staff');

create type public.order_status as enum (
  'pending_payment', -- created, stock reserved, waiting for verified payment
  'confirmed',       -- payment verified server-to-server
  'processing',      -- being prepared
  'shipped',
  'delivered',
  'cancelled',
  'expired',         -- reservation timed out without payment
  'on_hold',         -- paid but needs manual attention (e.g. stock gone after expiry)
  'refunded'         -- fully refunded
);

create type public.payment_status as enum (
  'unpaid', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
);

create type public.reservation_status as enum ('active', 'consumed', 'released');

create type public.inventory_movement_type as enum (
  'initial', 'adjustment', 'sale', 'cancel_restock', 'return_restock'
);

create type public.coupon_type as enum ('percent', 'fixed');
create type public.redemption_status as enum ('reserved', 'applied', 'released');
create type public.refund_status as enum ('pending', 'completed', 'failed');
create type public.publish_status as enum ('draft', 'published', 'archived');

create type public.homepage_section_type as enum (
  'hero', 'category_grid', 'product_rail', 'editorial', 'newsletter'
);

create type public.message_status as enum ('new', 'read', 'archived');
create type public.newsletter_status as enum ('pending', 'confirmed', 'unsubscribed');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Localized jsonb text must look like {"tr": "...", "en": "..."} with TR required.
create or replace function public.is_localized_text(v jsonb, require_tr boolean default true)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select v is not null
     and jsonb_typeof(v) = 'object'
     and (not require_tr or coalesce(length(trim(v->>'tr')), 0) > 0)
     and (v - 'tr' - 'en') = '{}'::jsonb;
$$;

-- ---------------------------------------------------------------------------
-- Roles. There is NO automatic admin: roles are granted only by the service
-- role / database owner (see scripts/grant-role.mjs and docs/ADMIN_GUIDE.md).
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = p_role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role in ('admin', 'staff')
  );
$$;

-- Permission matrix. MUST stay in sync with src/lib/auth/permissions.ts
-- (tests/db/permissions.test.ts asserts both are identical).
create or replace function public.role_has_permission(p_role public.app_role, p_permission text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'admin' then p_permission in (
      'dashboard.view', 'catalog.manage', 'inventory.manage', 'orders.view', 'orders.manage',
      'orders.refund', 'customers.view', 'coupons.manage', 'content.manage', 'settings.manage',
      'inbox.manage', 'newsletter.view', 'audit.view', 'roles.manage'
    )
    when 'staff' then p_permission in (
      'dashboard.view', 'catalog.manage', 'inventory.manage', 'orders.view', 'orders.manage',
      'inbox.manage'
    )
    else false
  end;
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and public.role_has_permission(ur.role, p_permission)
  );
$$;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.role_has_permission(public.app_role, text) to authenticated;
grant execute on function public.is_localized_text(jsonb, boolean) to anon, authenticated;

grant select on public.user_roles to authenticated;
create policy "user_roles: users read own roles"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('roles.manage'));
-- No insert/update/delete policies: role changes go through security definer
-- functions (admin_set_role) or the service role.

-- ---------------------------------------------------------------------------
-- Audit log (append-only). Written by triggers and security definer functions.
-- PII tables only record WHICH columns changed, never the values.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
alter table public.audit_logs enable row level security;
grant select on public.audit_logs to authenticated;
create policy "audit_logs: admins read"
  on public.audit_logs for select to authenticated
  using (public.has_permission('audit.view'));

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_mask boolean := coalesce(tg_argv[0], '') = 'mask';
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_entity_id text;
begin
  v_entity_id := coalesce(v_new->>'id', v_old->>'id', v_new->>'product_id', v_old->>'product_id', v_new->>'user_id', v_old->>'user_id');

  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key not in ('updated_at') and (v_new->v_key) is distinct from (v_old->v_key) then
        v_changes := v_changes || jsonb_build_object(v_key,
          case when v_mask then '"***"'::jsonb else v_new->v_key end);
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := case when v_mask then jsonb_build_object('created', true) else v_new end;
  else
    v_changes := case when v_mask then jsonb_build_object('deleted', true) else v_old end;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, changes)
  values ((select auth.uid()), lower(tg_op), tg_table_name, v_entity_id, v_changes);

  return coalesce(new, old);
end;
$$;

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id text, p_changes jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, changes)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_changes, '{}'::jsonb));
$$;
revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

create trigger user_roles_audit
  after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, atomic). Service role only.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as rl (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = rl.hits + 1
  returning hits into v_hits;

  -- opportunistic cleanup of old windows
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
