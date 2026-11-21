-- =============================================================================
-- MAISON SURGE — 0800 Admin helper functions
-- * admin_user_emails: resolves auth.users emails for audit log / customer
--   detail. auth.users is not readable by the Data API roles, so this is a
--   narrow security definer function gated by permissions.
-- * admin_low_stock_variants: column comparison (available <= threshold) that
--   PostgREST filters cannot express.
-- =============================================================================

create or replace function public.admin_user_emails(p_ids uuid[])
returns table (id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_permission('audit.view') or public.has_permission('customers.view')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text from auth.users u
    where u.id = any (coalesce(p_ids, '{}'::uuid[]))
    limit 500;
end;
$$;
revoke execute on function public.admin_user_emails(uuid[]) from public, anon;
grant execute on function public.admin_user_emails(uuid[]) to authenticated;

create or replace function public.admin_low_stock_variants(p_limit integer default 50)
returns table (
  variant_id uuid,
  product_id uuid,
  product_name text,
  sku text,
  stock_on_hand integer,
  stock_reserved integer,
  available integer,
  low_stock_threshold integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_permission('inventory.manage') or public.has_permission('dashboard.view')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select v.id, p.id, coalesce(t.name, p.slug), v.sku, v.stock_on_hand, v.stock_reserved,
           v.stock_on_hand - v.stock_reserved, v.low_stock_threshold
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.product_translations t on t.product_id = p.id and t.locale = 'tr'
    where v.is_active and p.status <> 'archived'
      and v.stock_on_hand - v.stock_reserved <= v.low_stock_threshold
    order by v.stock_on_hand - v.stock_reserved, v.sku
    limit least(greatest(coalesce(p_limit, 50), 1), 500);
end;
$$;
revoke execute on function public.admin_low_stock_variants(integer) from public, anon;
grant execute on function public.admin_low_stock_variants(integer) to authenticated;

grant execute on function public.admin_user_emails(uuid[]) to service_role;
grant execute on function public.admin_low_stock_variants(integer) to service_role;
