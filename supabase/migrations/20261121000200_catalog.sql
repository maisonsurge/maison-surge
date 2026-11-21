-- =============================================================================
-- MAISON SURGE — 0200 Catalog
-- Public (anon) can read ONLY published/active catalog rows. Staff with
-- 'catalog.manage' can write. Stock columns are changed only through
-- inventory functions (see 0400) — direct updates are rejected by trigger.
-- =============================================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name jsonb not null check (public.is_localized_text(name)),
  description jsonb not null default '{}'::jsonb check (public.is_localized_text(description, false)),
  image_path text,
  position integer not null default 0,
  is_active boolean not null default true,
  seo_title jsonb not null default '{}'::jsonb check (public.is_localized_text(seo_title, false)),
  seo_description jsonb not null default '{}'::jsonb check (public.is_localized_text(seo_description, false)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index categories_parent_idx on public.categories (parent_id);
create index categories_position_idx on public.categories (position);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name jsonb not null check (public.is_localized_text(name)),
  description jsonb not null default '{}'::jsonb check (public.is_localized_text(description, false)),
  image_path text,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sizes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{1,12}$'),
  label jsonb not null check (public.is_localized_text(label)),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name jsonb not null check (public.is_localized_text(name)),
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_id uuid references public.categories (id) on delete set null,
  status public.publish_status not null default 'draft',
  base_price integer not null check (base_price >= 0),          -- kuruş, VAT inclusive
  compare_at_price integer check (compare_at_price is null or compare_at_price > 0),
  currency char(3) not null default 'TRY' check (currency = 'TRY'),
  is_featured boolean not null default false,
  is_demo boolean not null default false,                        -- seeded demo data marker
  size_guide jsonb not null default '{}'::jsonb check (public.is_localized_text(size_guide, false)),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_status_idx on public.products (status, published_at desc);
create index products_featured_idx on public.products (is_featured) where is_featured;

-- Translatable product content (TR required by app validation, EN optional).
create table public.product_translations (
  product_id uuid not null references public.products (id) on delete cascade,
  locale text not null check (locale in ('tr', 'en')),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '' check (length(description) <= 10000),
  material text not null default '' check (length(material) <= 2000),
  care text not null default '' check (length(care) <= 2000),
  seo_title text check (seo_title is null or length(seo_title) <= 70),
  seo_description text check (seo_description is null or length(seo_description) <= 170),
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(material, ''))
  ) stored,
  updated_at timestamptz not null default now(),
  primary key (product_id, locale)
);
create index product_translations_search_idx on public.product_translations using gin (search_vector);

-- Cost is confidential; kept out of the publicly readable products table.
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_price integer not null check (cost_price >= 0),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,47}$'),
  size_id uuid references public.sizes (id) on delete restrict,
  color_id uuid references public.colors (id) on delete restrict,
  price integer check (price is null or price >= 0),               -- null = product.base_price
  compare_at_price integer check (compare_at_price is null or compare_at_price > 0),
  stock_on_hand integer not null default 0 check (stock_on_hand >= 0),
  stock_reserved integer not null default 0 check (stock_reserved >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stock_reserved <= stock_on_hand)
);
create unique index product_variants_combo_uidx
  on public.product_variants (product_id, coalesce(size_id, '00000000-0000-0000-0000-000000000000'::uuid),
                              coalesce(color_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index product_variants_product_idx on public.product_variants (product_id);
create index product_variants_size_idx on public.product_variants (size_id);
create index product_variants_color_idx on public.product_variants (color_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  color_id uuid references public.colors (id) on delete set null,
  -- Storage object path inside the 'product-images' bucket, or a site-relative
  -- path starting with '/' for bundled demo assets.
  path text not null check (length(path) between 1 and 500),
  alt jsonb not null default '{}'::jsonb check (public.is_localized_text(alt, false)),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  position integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, position);
create unique index product_images_one_cover_uidx on public.product_images (product_id) where is_cover;

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, product_id)
);
create index collection_products_product_idx on public.collection_products (product_id);

-- updated_at triggers
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger collections_updated_at before update on public.collections for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger product_translations_updated_at before update on public.product_translations for each row execute function public.set_updated_at();
create trigger product_costs_updated_at before update on public.product_costs for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();

-- published_at maintenance
create or replace function public.products_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger products_published_at before insert or update of status on public.products
  for each row execute function public.products_set_published_at();

-- ---------------------------------------------------------------------------
-- Stock guard: stock columns may only change inside inventory functions which
-- set the transaction-local flag app.stock_ctx = 'on'. New variants may start
-- with stock (logged as an 'initial' movement by trigger in 0400).
-- ---------------------------------------------------------------------------
create or replace function public.guard_variant_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.stock_on_hand is distinct from old.stock_on_hand
      or new.stock_reserved is distinct from old.stock_reserved)
     and coalesce(current_setting('app.stock_ctx', true), '') <> 'on' then
    raise exception 'stock_direct_update_forbidden'
      using errcode = 'P0001', hint = 'Use admin_set_variant_stock() or order functions.';
  end if;
  return new;
end;
$$;
create trigger product_variants_stock_guard before update on public.product_variants
  for each row execute function public.guard_variant_stock();

create or replace function public.guard_variant_initial_reserved()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stock_reserved <> 0 and coalesce(current_setting('app.stock_ctx', true), '') <> 'on' then
    raise exception 'stock_direct_update_forbidden' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger product_variants_reserved_guard before insert on public.product_variants
  for each row execute function public.guard_variant_initial_reserved();

-- Audit triggers
create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_row_change();
create trigger collections_audit after insert or update or delete on public.collections for each row execute function public.audit_row_change();
create trigger sizes_audit after insert or update or delete on public.sizes for each row execute function public.audit_row_change();
create trigger colors_audit after insert or update or delete on public.colors for each row execute function public.audit_row_change();
create trigger products_audit after insert or update or delete on public.products for each row execute function public.audit_row_change();
create trigger product_translations_audit after insert or update or delete on public.product_translations for each row execute function public.audit_row_change();
create trigger product_costs_audit after insert or update or delete on public.product_costs for each row execute function public.audit_row_change();
create trigger product_variants_audit after insert or update or delete on public.product_variants for each row execute function public.audit_row_change();
create trigger product_images_audit after insert or update or delete on public.product_images for each row execute function public.audit_row_change();
create trigger collection_products_audit after insert or update or delete on public.collection_products for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.sizes enable row level security;
alter table public.colors enable row level security;
alter table public.products enable row level security;
alter table public.product_translations enable row level security;
alter table public.product_costs enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.collection_products enable row level security;

grant select on public.categories, public.collections, public.sizes, public.colors, public.products,
  public.product_translations, public.product_variants, public.product_images, public.collection_products
  to anon, authenticated;
grant insert, update, delete on public.categories, public.collections, public.sizes, public.colors,
  public.products, public.product_translations, public.product_variants, public.product_images,
  public.collection_products, public.product_costs
  to authenticated;
grant select on public.product_costs to authenticated;

-- Helper: is a product publicly visible?
create or replace function public.product_is_public(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.products p where p.id = p_product_id and p.status = 'published');
$$;
grant execute on function public.product_is_public(uuid) to anon, authenticated;

-- Public read policies
create policy "categories: public read active" on public.categories for select to anon, authenticated
  using (is_active or public.has_permission('catalog.manage'));
create policy "collections: public read active" on public.collections for select to anon, authenticated
  using (is_active or public.has_permission('catalog.manage'));
create policy "sizes: public read" on public.sizes for select to anon, authenticated using (true);
create policy "colors: public read" on public.colors for select to anon, authenticated using (true);
create policy "products: public read published" on public.products for select to anon, authenticated
  using (status = 'published' or public.has_permission('catalog.manage'));
create policy "product_translations: public read published" on public.product_translations for select to anon, authenticated
  using (public.product_is_public(product_id) or public.has_permission('catalog.manage'));
create policy "product_variants: public read active" on public.product_variants for select to anon, authenticated
  using ((is_active and public.product_is_public(product_id)) or public.has_permission('catalog.manage'));
create policy "product_images: public read published" on public.product_images for select to anon, authenticated
  using (public.product_is_public(product_id) or public.has_permission('catalog.manage'));
create policy "collection_products: public read" on public.collection_products for select to anon, authenticated
  using (public.product_is_public(product_id) or public.has_permission('catalog.manage'));
create policy "product_costs: staff read" on public.product_costs for select to authenticated
  using (public.has_permission('catalog.manage'));

-- Staff write policies (one per table/command to keep intent explicit)
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'collections', 'sizes', 'colors', 'products', 'product_translations',
                           'product_variants', 'product_images', 'collection_products', 'product_costs']
  loop
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_permission(''catalog.manage''))', t || ': staff insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_permission(''catalog.manage'')) with check (public.has_permission(''catalog.manage''))', t || ': staff update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_permission(''catalog.manage''))', t || ': staff delete', t);
  end loop;
end;
$$;
