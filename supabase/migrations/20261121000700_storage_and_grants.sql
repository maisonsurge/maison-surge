-- =============================================================================
-- MAISON SURGE — 0700 Storage buckets/policies and final grants
-- Uploads normally use short-lived signed upload URLs created by server code
-- after a permission check; the policies below are a second line of defense
-- for direct authenticated uploads. Buckets are public-read (CDN URLs) but
-- listing objects is not allowed for anon.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site-assets', 'site-assets', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "product-images: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.has_permission('catalog.manage'));
create policy "product-images: staff insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_permission('catalog.manage'));
create policy "product-images: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_permission('catalog.manage'));
create policy "product-images: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_permission('catalog.manage'));

create policy "site-assets: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'site-assets' and (public.has_permission('content.manage') or public.has_permission('catalog.manage')));
create policy "site-assets: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-assets' and (public.has_permission('content.manage') or public.has_permission('catalog.manage')));
create policy "site-assets: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'site-assets' and (public.has_permission('content.manage') or public.has_permission('catalog.manage')));
create policy "site-assets: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'site-assets' and (public.has_permission('content.manage') or public.has_permission('catalog.manage')));

-- Trusted server code (service role) needs full table access; it bypasses RLS
-- by design and is only ever used server-side (src/server/supabase/admin.ts).
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
