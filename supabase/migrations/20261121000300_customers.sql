-- =============================================================================
-- MAISON SURGE — 0300 Customers: profiles, addresses, wishlists, carts
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  preferred_locale text not null default 'tr' check (preferred_locale in ('tr', 'en')),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user. Never assigns roles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120), ''),
    case when new.raw_user_meta_data->>'locale' = 'en' then 'en' else 'tr' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text check (label is null or length(label) <= 40),
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  line1 text not null check (length(trim(line1)) between 3 and 200),
  line2 text check (line2 is null or length(line2) <= 200),
  district text not null check (length(trim(district)) between 2 and 80),
  city text not null check (length(trim(city)) between 2 and 80),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  country char(2) not null default 'TR' check (country = 'TR'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default_uidx on public.addresses (user_id) where is_default;
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();

create table public.wishlists (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
create index wishlists_product_idx on public.wishlists (product_id);

-- Carts: a guest cart is identified by a random token stored in an httpOnly
-- cookie; only its SHA-256 hash is stored. Carts are accessed exclusively by
-- trusted server code (service role) scoped by token hash or user id.
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  token_hash text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  coupon_code text check (coupon_code is null or length(coupon_code) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or token_hash is not null)
);
create unique index carts_user_uidx on public.carts (user_id) where user_id is not null;
create trigger carts_updated_at before update on public.carts for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.wishlists enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, delete on public.wishlists to authenticated;
-- carts/cart_items: no grants to anon/authenticated (server-only via service role)

create policy "profiles: read own or customers.view" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_permission('customers.view'));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "addresses: own select" on public.addresses for select to authenticated
  using (user_id = (select auth.uid()));
create policy "addresses: own insert" on public.addresses for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "addresses: own update" on public.addresses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "addresses: own delete" on public.addresses for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "wishlists: own select" on public.wishlists for select to authenticated
  using (user_id = (select auth.uid()));
create policy "wishlists: own insert" on public.wishlists for insert to authenticated
  with check (user_id = (select auth.uid()) and public.product_is_public(product_id));
create policy "wishlists: own delete" on public.wishlists for delete to authenticated
  using (user_id = (select auth.uid()));
