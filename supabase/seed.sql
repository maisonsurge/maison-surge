-- =============================================================================
-- MAISON SURGE — Demo seed (idempotent).
-- Everything here is DEMO data: products are flagged is_demo = true, images are
-- bundled placeholder SVGs under /public/demo, prices are examples, and legal
-- pages are drafts with [PLACEHOLDER] fields that the business must complete.
-- Remove demo products from Admin → Ayarlar → "Demo verilerini sil".
-- =============================================================================

-- Sizes
insert into public.sizes (code, label, position) values
  ('XS', '{"tr":"XS","en":"XS"}', 10),
  ('S', '{"tr":"S","en":"S"}', 20),
  ('M', '{"tr":"M","en":"M"}', 30),
  ('L', '{"tr":"L","en":"L"}', 40),
  ('XL', '{"tr":"XL","en":"XL"}', 50),
  ('XXL', '{"tr":"XXL","en":"XXL"}', 60)
on conflict (code) do nothing;

-- Colors (product colours, not UI palette)
insert into public.colors (code, name, hex, position) values
  ('kum', '{"tr":"Kum","en":"Sand"}', '#E5DECF', 10),
  ('zeytin', '{"tr":"Zeytin","en":"Olive"}', '#5A6248', 20),
  ('orman', '{"tr":"Orman","en":"Forest"}', '#3A3F32', 30),
  ('bordo', '{"tr":"Bordo","en":"Burgundy"}', '#7B2E36', 40),
  ('siyah', '{"tr":"Siyah","en":"Black"}', '#1A1A1A', 50),
  ('kirik-beyaz', '{"tr":"Kırık Beyaz","en":"Off White"}', '#F4F1EA', 60)
on conflict (code) do nothing;

-- Categories
insert into public.categories (slug, name, description, image_path, position) values
  ('tisort', '{"tr":"Tişört","en":"T-Shirts"}', '{"tr":"Günlük gardırobun temeli.","en":"The foundation of an everyday wardrobe."}', '/demo/category-tisort.svg', 10),
  ('polo', '{"tr":"Polo","en":"Polos"}', '{"tr":"Rafine yaka, rahat duruş.","en":"A refined collar, an easy posture."}', '/demo/category-polo.svg', 20),
  ('sweatshirt', '{"tr":"Sweatshirt","en":"Sweatshirts"}', '{"tr":"Katmanlı günler için.","en":"For layered days."}', '/demo/category-sweatshirt.svg', 30),
  ('hoodie', '{"tr":"Hoodie","en":"Hoodies"}', '{"tr":"Sakin ve modern.","en":"Calm and modern."}', '/demo/category-hoodie.svg', 40),
  ('kazak', '{"tr":"Kazak","en":"Knitwear"}', '{"tr":"Örgü dokusu, zamansız form.","en":"Knit texture, timeless form."}', '/demo/category-kazak.svg', 50)
on conflict (slug) do nothing;

-- Collections
insert into public.collections (slug, name, description, position) values
  ('yeni-sezon', '{"tr":"Yeni Sezon","en":"New Season"}', '{"tr":"Sezonun yeni parçaları.","en":"New pieces of the season."}', 10),
  ('essentials', '{"tr":"Essentials","en":"Essentials"}', '{"tr":"Her gün giyilecek temel parçalar.","en":"Core pieces for every day."}', 20)
on conflict (slug) do nothing;

-- Shipping method (EXAMPLE fee — business must confirm in Admin → Ayarlar)
insert into public.shipping_methods (code, name, description, price, free_over, position) values
  ('standart', '{"tr":"Standart Kargo","en":"Standard Shipping"}',
   '{"tr":"Örnek ücret — işletme tarafından onaylanmalıdır.","en":"Example fee — must be confirmed by the business."}',
   9900, 150000, 10)
on conflict (code) do nothing;

-- Demo products --------------------------------------------------------------
with src (slug, cat, price, compare_price, featured, name_tr, name_en, img) as (
  values
    ('demo-essential-tisort', 'tisort', 79900, null::integer, true, 'Essential Tişört (Demo)', 'Essential T-Shirt (Demo)', 'tisort'),
    ('demo-oversize-tisort', 'tisort', 89900, 109900, false, 'Oversize Tişört (Demo)', 'Oversize T-Shirt (Demo)', 'tisort'),
    ('demo-pike-polo', 'polo', 119900, null, true, 'Pike Polo (Demo)', 'Piqué Polo (Demo)', 'polo'),
    ('demo-triko-polo', 'polo', 149900, null, false, 'Triko Polo (Demo)', 'Knit Polo (Demo)', 'polo'),
    ('demo-bisiklet-yaka-sweatshirt', 'sweatshirt', 169900, null, true, 'Bisiklet Yaka Sweatshirt (Demo)', 'Crewneck Sweatshirt (Demo)', 'sweatshirt'),
    ('demo-yarim-fermuarli-sweatshirt', 'sweatshirt', 189900, 219900, false, 'Yarım Fermuarlı Sweatshirt (Demo)', 'Half-Zip Sweatshirt (Demo)', 'sweatshirt'),
    ('demo-kapusonlu-hoodie', 'hoodie', 199900, null, true, 'Kapüşonlu Hoodie (Demo)', 'Hooded Sweatshirt (Demo)', 'hoodie'),
    ('demo-fermuarli-hoodie', 'hoodie', 219900, null, false, 'Fermuarlı Hoodie (Demo)', 'Zip Hoodie (Demo)', 'hoodie'),
    ('demo-bisiklet-yaka-kazak', 'kazak', 249900, null, true, 'Bisiklet Yaka Kazak (Demo)', 'Crewneck Knit (Demo)', 'kazak'),
    ('demo-balikci-yaka-kazak', 'kazak', 279900, 319900, false, 'Balıkçı Yaka Kazak (Demo)', 'Turtleneck Knit (Demo)', 'kazak')
),
ins as (
  insert into public.products (slug, category_id, status, base_price, compare_at_price, is_featured, is_demo, size_guide)
  select s.slug, c.id, 'published', s.price, s.compare_price, s.featured, true,
    '{"tr":"| Beden | Göğüs (cm) | Boy (cm) |\n|---|---|---|\n| S | [ölçü] | [ölçü] |\n| M | [ölçü] | [ölçü] |\n| L | [ölçü] | [ölçü] |\n| XL | [ölçü] | [ölçü] |\n\n_Ölçüler işletme tarafından girilecektir._","en":"| Size | Chest (cm) | Length (cm) |\n|---|---|---|\n| S | [tbd] | [tbd] |\n| M | [tbd] | [tbd] |\n| L | [tbd] | [tbd] |\n| XL | [tbd] | [tbd] |\n\n_Measurements to be provided by the business._"}'::jsonb
  from src s join public.categories c on c.slug = s.cat
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.product_translations (product_id, locale, name, description, material, care)
select i.id, l.locale,
  case l.locale when 'tr' then s.name_tr else s.name_en end,
  case l.locale
    when 'tr' then 'Bu bir DEMO üründür. Gerçek ürün açıklaması, kumaş ve üretim bilgileri işletme tarafından admin panelinden girilecektir.'
    else 'This is a DEMO product. Real description, fabric and production details will be entered by the business from the admin panel.' end,
  '', ''
from ins i
join src s on s.slug = i.slug
cross join (values ('tr'), ('en')) l(locale)
on conflict (product_id, locale) do nothing;

-- Demo images (bundled placeholders, clearly marked "DEMO" in the artwork)
insert into public.product_images (product_id, path, alt, position, is_cover)
select p.id, '/demo/product-' || c.slug || '-' || n.idx || '.svg',
  jsonb_build_object('tr', 'Demo görsel — ' || t.name, 'en', 'Demo image — ' || coalesce(te.name, t.name)),
  n.idx, n.idx = 1
from public.products p
join public.categories c on c.id = p.category_id
join public.product_translations t on t.product_id = p.id and t.locale = 'tr'
left join public.product_translations te on te.product_id = p.id and te.locale = 'en'
cross join (values (1), (2)) n(idx)
where p.is_demo and not exists (select 1 from public.product_images pi where pi.product_id = p.id);

-- Demo variants: 4 sizes × 2 colours, varied stock (some sold out to exercise UI)
insert into public.product_variants (product_id, sku, size_id, color_id, stock_on_hand, position)
select p.id,
  upper('D' || substr(md5(p.slug), 1, 6) || '-' || co.code || '-' || sz.code),
  sz.id, co.id,
  case when sz.code = 'XL' and co.position = 20 then 0 else ((abs(hashtext(p.slug || sz.code || co.code)) % 12) + 2) end,
  sz.position + co.position
from public.products p
cross join public.sizes sz
join public.colors co on co.code in (
  case when (abs(hashtext(p.slug)) % 2) = 0 then 'kum' else 'siyah' end,
  case when (abs(hashtext(p.slug)) % 3) = 0 then 'bordo' else 'zeytin' end)
where p.is_demo and sz.code in ('S', 'M', 'L', 'XL')
on conflict do nothing;

insert into public.collection_products (collection_id, product_id, position)
select co.id, p.id, row_number() over (partition by co.id order by p.slug)
from public.products p
join public.collections co on (co.slug = 'yeni-sezon' and p.is_featured) or (co.slug = 'essentials' and not p.is_featured)
where p.is_demo
on conflict do nothing;

-- Homepage --------------------------------------------------------------------
insert into public.homepage_sections (type, title, subtitle, body, cta_label, cta_href, image_path, image_alt, config, position)
select * from (values
  ('hero'::public.homepage_section_type,
   '{"tr":"Zamansız parçalar, sakin bir duruş.","en":"Timeless pieces, a calm presence."}'::jsonb,
   '{"tr":"Yeni Sezon","en":"New Season"}'::jsonb,
   '{"tr":"Modern kesimler ve sade bir renk dili.","en":"Modern cuts and a quiet colour language."}'::jsonb,
   '{"tr":"Koleksiyonu keşfet","en":"Explore the collection"}'::jsonb,
   '/shop', '/demo/hero.svg',
   '{"tr":"Demo kampanya görseli","en":"Demo campaign image"}'::jsonb, '{}'::jsonb, 10),
  ('category_grid', '{"tr":"Kategoriler","en":"Categories"}', '{}', '{}', '{}', null, null, '{}', '{}', 20),
  ('product_rail', '{"tr":"Yeni Gelenler","en":"New Arrivals"}', '{}', '{}',
   '{"tr":"Tümünü gör","en":"View all"}', '/shop?sort=newest', null, '{}', '{"source":"new","limit":8}', 30),
  ('editorial', '{"tr":"Maison Surge","en":"Maison Surge"}', '{"tr":"Marka hikâyesi","en":"Our story"}',
   '{"tr":"[TASLAK] Marka hikâyesi metni işletme tarafından yazılacaktır. Bu alan admin panelinden düzenlenir.","en":"[DRAFT] The brand story will be written by the business. Edit this block from the admin panel."}',
   '{"tr":"Hakkımızda","en":"About us"}', '/pages/hakkimizda', '/demo/editorial.svg',
   '{"tr":"Demo editoryal görsel","en":"Demo editorial image"}', '{}', 40),
  ('product_rail', '{"tr":"Öne Çıkanlar","en":"Featured"}', '{}', '{}', '{}', null, null, '{}', '{"source":"featured","limit":8}', 50),
  ('newsletter', '{"tr":"Bültene katılın","en":"Join the newsletter"}', '{}',
   '{"tr":"Yeni koleksiyonlardan ilk siz haberdar olun.","en":"Be the first to hear about new collections."}', '{}', null, null, '{}', '{}', 60)
) v
where not exists (select 1 from public.homepage_sections);

update public.site_settings set
  announcement = '{"tr":"Demo mağaza — ödemeler test modundadır.","en":"Demo store — payments are in test mode."}',
  announcement_enabled = true
where id and announcement = '{}'::jsonb;

-- Information & legal pages (DRAFTS — need legal/business approval) ----------
insert into public.content_pages (slug, title, body, position, needs_legal_review) values
('hakkimizda', '{"tr":"Hakkımızda","en":"About Us"}',
 '{"tr":"## Maison Surge\n\n[TASLAK] Marka hikâyesi, kuruluş bilgileri ve değerler işletme tarafından yazılacaktır.","en":"## Maison Surge\n\n[DRAFT] Brand story, founding details and values will be provided by the business."}', 10, false),
('sss', '{"tr":"Sıkça Sorulan Sorular","en":"FAQ"}',
 '{"tr":"### Siparişim ne zaman kargoya verilir?\n[İŞLETME TARAFINDAN DOLDURULACAK — hazırlık süresi]\n\n### Hangi kargo firmasıyla gönderim yapılıyor?\n[KARGO FİRMASI]\n\n### İade nasıl yapılır?\nAyrıntılar için [Teslimat ve İade](/tr/pages/teslimat-ve-iade) sayfasına bakın.\n\n### Hangi ödeme yöntemleri kabul ediliyor?\n[ÖDEME SAĞLAYICISI SEÇİLDİĞİNDE GÜNCELLENECEK]","en":"### When will my order ship?\n[TO BE COMPLETED BY THE BUSINESS — handling time]\n\n### Which carrier do you use?\n[CARRIER]\n\n### How do returns work?\nSee [Delivery & Returns](/en/pages/teslimat-ve-iade).\n\n### Which payment methods are accepted?\n[TO BE UPDATED ONCE A PAYMENT PROVIDER IS SELECTED]"}', 20, true),
('teslimat-ve-iade', '{"tr":"Teslimat ve İade","en":"Delivery & Returns"}',
 '{"tr":"> **TASLAK — hukuki ve işletme onayı gereklidir.**\n\n## Teslimat\n- Kargo firması: [KARGO FİRMASI]\n- Hazırlık süresi: [SÜRE]\n- Kargo ücreti ve ücretsiz kargo eşiği: ödeme adımında gösterilen tutarlar geçerlidir.\n\n## Cayma hakkı ve iade\nMesafeli Sözleşmeler Yönetmeliği kapsamındaki cayma hakkı süresi ve koşulları: [HUKUKİ METİN]\n\nİade adresi: [İADE ADRESİ]","en":"> **DRAFT — requires legal and business approval.**\n\n## Delivery\n- Carrier: [CARRIER]\n- Handling time: [TIME]\n- Shipping fee and free-shipping threshold: the amounts shown at checkout apply.\n\n## Right of withdrawal and returns\n[LEGAL TEXT]\n\nReturn address: [RETURN ADDRESS]"}', 30, true),
('gizlilik-politikasi', '{"tr":"Gizlilik Politikası","en":"Privacy Policy"}',
 '{"tr":"> **TASLAK — hukuki onay gereklidir.**\n\nVeri sorumlusu: [ŞİRKET UNVANI], [ADRES], [MERSİS NO]\n\n## Toplanan veriler\nHesap bilgileri (e-posta, ad), teslimat adresleri, sipariş kayıtları, iletişim formu mesajları.\n\n## Amaçlar\nSipariş ifası, müşteri hizmetleri, yasal yükümlülükler.\n\n## Saklama süreleri\n[HUKUKİ METİN]\n\n## Haklarınız\n[HUKUKİ METİN]","en":"> **DRAFT — requires legal approval.**\n\nData controller: [COMPANY NAME], [ADDRESS]\n\n## Data we collect\nAccount details (email, name), delivery addresses, order records, contact form messages.\n\n## Purposes\nOrder fulfilment, customer service, legal obligations.\n\n## Retention\n[LEGAL TEXT]\n\n## Your rights\n[LEGAL TEXT]"}', 40, true),
('cerez-politikasi', '{"tr":"Çerez Politikası","en":"Cookie Policy"}',
 '{"tr":"> **TASLAK — hukuki onay gereklidir.**\n\n## Zorunlu çerezler\nOturum (giriş), sepet ve çerez tercihinizi saklayan çerezler. Bunlar olmadan site çalışmaz.\n\n## Analitik ve pazarlama çerezleri\nYalnızca açık rızanızla etkinleşir. Şu anda sitede analitik/pazarlama aracı **kurulu değildir**.\n\nTercihlerinizi sayfanın altındaki **Çerez tercihleri** bağlantısından değiştirebilirsiniz.","en":"> **DRAFT — requires legal approval.**\n\n## Strictly necessary cookies\nSession (sign-in), cart and the cookie storing your consent choice.\n\n## Analytics and marketing cookies\nOnly enabled with your explicit consent. No analytics/marketing tool is currently **installed**.\n\nChange your choice any time via **Cookie preferences** in the footer."}', 50, true),
('kvkk-aydinlatma-metni', '{"tr":"KVKK Aydınlatma Metni","en":"KVKK Privacy Notice"}',
 '{"tr":"> **TASLAK — hukuki onay gereklidir.**\n\n6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca veri sorumlusu sıfatıyla [ŞİRKET UNVANI] ...\n\n[HUKUKİ METİN]","en":"> **DRAFT — requires legal approval.**\n\nUnder Turkish Law No. 6698 on the Protection of Personal Data, [COMPANY NAME] as data controller ...\n\n[LEGAL TEXT]"}', 60, true),
('mesafeli-satis-sozlesmesi', '{"tr":"Mesafeli Satış Sözleşmesi","en":"Distance Sales Agreement"}',
 '{"tr":"> **TASLAK — hukuki onay gereklidir.**\n\n## Taraflar\n**Satıcı:** [ŞİRKET UNVANI], [ADRES], [VERGİ DAİRESİ / NO], [MERSİS NO], [E-POSTA], [TELEFON]\n\n**Alıcı:** Sipariş sırasında belirtilen bilgiler.\n\n## Konu\n[HUKUKİ METİN]","en":"> **DRAFT — requires legal approval.**\n\n## Parties\n**Seller:** [COMPANY NAME], [ADDRESS], [TAX ID]\n\n**Buyer:** details provided at checkout.\n\n## Subject\n[LEGAL TEXT]"}', 70, true),
('on-bilgilendirme-formu', '{"tr":"Ön Bilgilendirme Formu","en":"Preliminary Information Form"}',
 '{"tr":"> **TASLAK — hukuki onay gereklidir.**\n\nSatıcı bilgileri: [ŞİRKET UNVANI], [ADRES]\n\nÜrünlerin temel nitelikleri, vergiler dahil toplam fiyat, teslimat ve cayma hakkı bilgileri ödeme adımında gösterilir.\n\n[HUKUKİ METİN]","en":"> **DRAFT — requires legal approval.**\n\nSeller: [COMPANY NAME], [ADDRESS]\n\n[LEGAL TEXT]"}', 80, true)
on conflict (slug) do nothing;
