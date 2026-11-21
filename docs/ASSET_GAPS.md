# Eksik Varlıklar (Asset Gaps)

Brief'te "marka kimliği görselleri ve logo referansları" anılıyor, ancak **proje klasörüne hiçbir görsel/logo dosyası teslim edilmedi** (yalnızca `CLAUDE_MASTER_PROMPT.md`, `PROJECT_RULES.md`, `README_FIRST.md` mevcuttu). PROJECT_RULES §1/§3 gereği hiçbir marka varlığı uydurulmadı.

| # | Gerekli varlık | Durum | Geçici çözüm | Nereye konacak |
|---|---|---|---|---|
| A-01 | **01A Signature** — Heritage Raven ana logo, onaylı **vektör (SVG)** | 🟡 Yalnızca raster (PNG, 1254×1254) teslim edildi | `public/brand/maison-surge-logo-source.png` kaynağından kırpılan kuzgun işareti + tipografik wordmark kullanılıyor (`scripts/gen-brand-assets.mjs`). Otomatik vektörleme yapılmadı; nakış/baskı için onaylı SVG hâlâ gerekli. | `public/brand/maison-surge-01a-signature.svg` → `src/config/brand.ts` içinde `signatureSrc` |
| A-02 | **01B Minimal** — küçük kullanım / nakış / favicon simgesi, onaylı vektör | ❌ Teslim edilmedi | Favicon: siyah zemin üzerine serif "M" (`src/app/icon.svg`, dosyada GEÇİCİ notu var). | `public/brand/maison-surge-01b-minimal.svg` → `minimalSrc`; `src/app/icon.svg` ve `apple-icon.png` değiştirilmeli |
| A-03 | Logo kullanım kılavuzu (min. boyut, boşluk, tek renk/negatif) | ❌ | — | `docs/` |
| A-04 | Nakış dosyası (DST/PES) | ❌ | — | Üretici; otomatik dönüşüm yeterli kabul edilmemeli (PROJECT_RULES §3) |
| A-05 | **Gerçek ürün fotoğrafları** | ❌ | `public/demo/*.svg` — üzerinde "DEMO GÖRSEL · DEMO IMAGE" yazan, marka paletiyle çizilmiş basit siluetler. Fotoğraf olarak sunulmaz. Demo ürünler `noindex` ve sitemap dışı. | Admin → Ürünler → Görseller (Supabase Storage) |
| A-06 | Kampanya / hero ve editoryal görseller (mimari doku, doğal ışık, kumaş yakın plan) | ❌ | `public/demo/hero.svg`, `editorial.svg` (DEMO etiketli soyut kompozisyon) | Admin → Ana sayfa blokları |
| A-07 | Kategori görselleri | ❌ | `public/demo/category-*.svg` (DEMO etiketli) | Admin → Kategoriler |
| A-08 | Open Graph paylaşım görseli (1200×630) | ❌ | Yok (ürün sayfalarında ürün görseli kullanılır) | `src/app/opengraph-image.png` |
| A-09 | Ürün bilgileri: materyal, bakım, beden tablosu ölçüleri | ❌ | Demo ürünlerde boş; sayfada "Bilgi henüz eklenmedi". Beden rehberi tablosunda `[ölçü]` yer tutucuları. | Admin → Ürün düzenle |
| A-10 | İşletme bilgileri (unvan, adres, MERSİS, vergi no, KEP, telefon, e-posta) | ❌ | Yasal taslaklarda `[ŞİRKET UNVANI]` vb. yer tutucular; iletişim sayfası "işletme tarafından eklenecektir" der. | Admin → Ayarlar, Admin → Sayfalar |
| A-11 | Hukukçu onaylı metinler (KVKK, gizlilik, çerez, mesafeli satış, ön bilgilendirme, iade) | ❌ | Taslak + "hukuki onay gerekli" uyarısı | Admin → Sayfalar (`needs_legal_review` kapatılınca uyarı kalkar) |

## Onaylı logo geldiğinde
1. SVG'leri `public/brand/` altına koyun (dosya adlarında Türkçe karakter kullanmayın).
2. `src/config/brand.ts` → `signatureSrc` / `minimalSrc` yollarını girin. `<Logo>` bileşeni otomatik kullanır (header, footer, kurulum ekranı).
3. `src/app/icon.svg`'yi 01B Minimal'in favicon uyarlamasıyla değiştirin; 180×180 `apple-icon.png` ekleyin.
4. Kontrast: koyu zeminde (footer, `bg-ink`) logonun açık (Sand/Paper) varyantı gerekir — `variant` desteği `Logo` bileşenine eklenebilir.
5. Bu tabloyu güncelleyin ve `docs/DECISIONS.md` D-001'i kapatın.
