-- =============================================================================
-- MAISON SURGE — 0500 Content: settings, homepage, pages, newsletter, contact
-- =============================================================================

-- Single-row settings table. Business facts (company, address, VAT rate…) are
-- NULL until the business provides them; the UI shows "not configured".
create table public.site_settings (
  id boolean primary key default true check (id),
  store_name text not null default 'MAISON SURGE',
  support_email text check (support_email is null or support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  support_phone text check (support_phone is null or support_phone ~ '^\+?[0-9 ()-]{7,20}$'),
  announcement jsonb not null default '{}'::jsonb check (public.is_localized_text(announcement, false)),
  announcement_enabled boolean not null default false,
  vat_rate_bps integer check (vat_rate_bps is null or vat_rate_bps between 0 and 10000), -- e.g. 1000 = %10
  prices_include_vat boolean not null default true,
  reservation_minutes integer not null default 30 check (reservation_minutes between 5 and 240),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  company_info jsonb not null default '{}'::jsonb,   -- legal name, MERSIS, address… provided by business
  social_links jsonb not null default '{}'::jsonb,
  terms_version text not null default 'draft-2026-11',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true);
create trigger site_settings_updated_at before update on public.site_settings for each row execute function public.set_updated_at();

create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  type public.homepage_section_type not null,
  title jsonb not null default '{}'::jsonb check (public.is_localized_text(title, false)),
  subtitle jsonb not null default '{}'::jsonb check (public.is_localized_text(subtitle, false)),
  body jsonb not null default '{}'::jsonb check (public.is_localized_text(body, false)),
  cta_label jsonb not null default '{}'::jsonb check (public.is_localized_text(cta_label, false)),
  cta_href text check (cta_href is null or cta_href ~ '^/[A-Za-z0-9/_?=&%.-]*$'),
  image_path text,
  image_alt jsonb not null default '{}'::jsonb check (public.is_localized_text(image_alt, false)),
  -- product_rail: {"source":"new"|"featured"|"collection","collection_id":uuid,"limit":8}
  -- category_grid: {"category_ids":[uuid,…]}
  config jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index homepage_sections_position_idx on public.homepage_sections (position);
create trigger homepage_sections_updated_at before update on public.homepage_sections for each row execute function public.set_updated_at();

-- Editable information/legal pages (Markdown). Seeded as DRAFTS requiring
-- business/legal approval.
create table public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title jsonb not null check (public.is_localized_text(title)),
  body jsonb not null default '{}'::jsonb check (public.is_localized_text(body, false)),
  is_published boolean not null default true,
  needs_legal_review boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger content_pages_updated_at before update on public.content_pages for each row execute function public.set_updated_at();

create table public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  status public.newsletter_status not null default 'pending',
  locale text not null default 'tr' check (locale in ('tr', 'en')),
  consent_text_version text not null,
  consent_at timestamptz not null default now(),
  confirm_token_hash text check (confirm_token_hash is null or confirm_token_hash ~ '^[0-9a-f]{64}$'),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  source text not null default 'footer' check (length(source) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index newsletter_email_uidx on public.newsletter_subscriptions (lower(email));
create trigger newsletter_subscriptions_updated_at before update on public.newsletter_subscriptions for each row execute function public.set_updated_at();

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  subject text not null check (length(trim(subject)) between 2 and 160),
  message text not null check (length(trim(message)) between 10 and 5000),
  order_number text check (order_number is null or length(order_number) <= 40),
  status public.message_status not null default 'new',
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create trigger contact_messages_updated_at before update on public.contact_messages for each row execute function public.set_updated_at();

-- Audit
create trigger site_settings_audit after update on public.site_settings for each row execute function public.audit_row_change();
create trigger homepage_sections_audit after insert or update or delete on public.homepage_sections for each row execute function public.audit_row_change();
create trigger content_pages_audit after insert or update or delete on public.content_pages for each row execute function public.audit_row_change();
create trigger contact_messages_audit after update or delete on public.contact_messages for each row execute function public.audit_row_change('mask');
create trigger newsletter_audit after delete on public.newsletter_subscriptions for each row execute function public.audit_row_change('mask');

-- RLS
alter table public.site_settings enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.content_pages enable row level security;
alter table public.newsletter_subscriptions enable row level security;
alter table public.contact_messages enable row level security;

grant select on public.site_settings, public.homepage_sections, public.content_pages to anon, authenticated;
grant update on public.site_settings to authenticated;
grant insert, update, delete on public.homepage_sections, public.content_pages to authenticated;
grant select, delete on public.newsletter_subscriptions to authenticated;
grant select, update, delete on public.contact_messages to authenticated;
-- Inserts into newsletter/contact are performed by server code (service role)
-- after validation, honeypot and rate limiting.

create policy "site_settings: public read" on public.site_settings for select to anon, authenticated using (true);
create policy "site_settings: admin update" on public.site_settings for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy "homepage_sections: public read active" on public.homepage_sections for select to anon, authenticated
  using (is_active or public.has_permission('content.manage'));
create policy "homepage_sections: admin insert" on public.homepage_sections for insert to authenticated
  with check (public.has_permission('content.manage'));
create policy "homepage_sections: admin update" on public.homepage_sections for update to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));
create policy "homepage_sections: admin delete" on public.homepage_sections for delete to authenticated
  using (public.has_permission('content.manage'));

create policy "content_pages: public read published" on public.content_pages for select to anon, authenticated
  using (is_published or public.has_permission('content.manage'));
create policy "content_pages: admin insert" on public.content_pages for insert to authenticated
  with check (public.has_permission('content.manage'));
create policy "content_pages: admin update" on public.content_pages for update to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));
create policy "content_pages: admin delete" on public.content_pages for delete to authenticated
  using (public.has_permission('content.manage'));

create policy "newsletter: admin read" on public.newsletter_subscriptions for select to authenticated
  using (public.has_permission('newsletter.view'));
create policy "newsletter: admin delete" on public.newsletter_subscriptions for delete to authenticated
  using (public.has_permission('newsletter.view'));

create policy "contact_messages: inbox read" on public.contact_messages for select to authenticated
  using (public.has_permission('inbox.manage'));
create policy "contact_messages: inbox update" on public.contact_messages for update to authenticated
  using (public.has_permission('inbox.manage')) with check (public.has_permission('inbox.manage'));
create policy "contact_messages: inbox delete" on public.contact_messages for delete to authenticated
  using (public.has_permission('inbox.manage'));
