"use client";

import { useState } from "react";
import { ActionForm, CheckboxField, FormSection, FormSubmit, LocalizedFields, SelectField, TextField, type FormAction } from "@/features/admin/ui/action-form";
import { SiteImageField } from "@/features/admin/ui/site-image-field";

import { SECTION_LABELS, type SectionType } from "./section-types";

type L = { tr?: string; en?: string };
export type { SectionType };

export type SectionValues = {
  type: SectionType;
  title: L;
  subtitle: L;
  body: L;
  cta_label: L;
  cta_href: string | null;
  image_path: string | null;
  image_alt: L;
  config: { source?: string; limit?: number; collection_id?: string; category_ids?: string[] };
  is_active: boolean;
};

export function SectionForm({
  action,
  values,
  categories,
  collections,
}: {
  action: FormAction;
  values: SectionValues | null;
  categories: { id: string; label: string }[];
  collections: { id: string; label: string }[];
}) {
  const [type, setType] = useState<SectionType>(values?.type ?? "hero");
  const [source, setSource] = useState(values?.config.source ?? "new");
  const hasImage = type === "hero" || type === "editorial";
  const hasCta = type !== "newsletter" && type !== "category_grid";

  return (
    <ActionForm action={action} className="grid gap-6">
      <FormSection title="Blok türü">
        {values ? (
          <>
            <input type="hidden" name="type" value={type} />
            <p className="text-sm">{SECTION_LABELS[type]}</p>
          </>
        ) : (
          <SelectField
            name="type"
            label="Tür"
            value={type}
            onChange={(e) => setType(e.currentTarget.value as SectionType)}
            options={Object.entries(SECTION_LABELS).map(([value, label]) => ({ value, label }))}
          />
        )}
        <CheckboxField name="is_active" label="Ana sayfada göster" defaultChecked={values?.is_active ?? true} />
      </FormSection>

      <FormSection title="Metinler" description="Boş bırakılan İngilizce alanlarda Türkçe metin gösterilir.">
        <LocalizedFields base="title" label="Başlık" values={values?.title} maxLength={160} />
        {type === "hero" || type === "editorial" ? <LocalizedFields base="subtitle" label="Üst başlık" values={values?.subtitle} maxLength={160} /> : null}
        {type !== "category_grid" && type !== "product_rail" ? <LocalizedFields base="body" label="Metin" values={values?.body} multiline rows={3} maxLength={2000} /> : null}
        {hasCta ? (
          <>
            <LocalizedFields base="cta_label" label="Buton / bağlantı metni" values={values?.cta_label} maxLength={60} />
            <TextField name="cta_href" label="Bağlantı (site içi yol)" defaultValue={values?.cta_href ?? ""} placeholder="/shop" hint="Dil öneki olmadan yazın: /shop, /shop/tisort, /collections/yeni-sezon, /pages/hakkimizda" maxLength={300} />
          </>
        ) : null}
      </FormSection>

      {hasImage ? (
        <FormSection title="Görsel" description="Gerçek kampanya/ürün fotoğrafı kullanın. Önerilen: yatay, en az 2000px genişlik.">
          <SiteImageField name="image_path" label="Görsel" folder="homepage" defaultValue={values?.image_path ?? null} />
          <LocalizedFields base="image_alt" label="Alternatif metin" values={values?.image_alt} maxLength={200} />
        </FormSection>
      ) : null}

      {type === "product_rail" ? (
        <FormSection title="Ürün kaynağı">
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              name="config_source"
              label="Kaynak"
              value={source}
              onChange={(e) => setSource(e.currentTarget.value)}
              options={[
                { value: "new", label: "Yeni gelenler" },
                { value: "featured", label: "Öne çıkanlar" },
                { value: "collection", label: "Koleksiyon" },
              ]}
            />
            {source === "collection" ? (
              <SelectField name="config_collection_id" label="Koleksiyon" defaultValue={values?.config.collection_id ?? ""} placeholder="— Seçin —" options={collections.map((c) => ({ value: c.id, label: c.label }))} />
            ) : null}
            <TextField name="config_limit" label="Ürün sayısı (4–12)" type="number" min={4} max={12} defaultValue={String(values?.config.limit ?? 8)} />
          </div>
        </FormSection>
      ) : null}

      {type === "category_grid" ? (
        <FormSection title="Kategoriler" description="Hiçbiri seçilmezse tüm aktif ana kategoriler gösterilir.">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <CheckboxField key={c.id} name="config_category_ids" value={c.id} label={c.label} defaultChecked={values?.config.category_ids?.includes(c.id) ?? false} />
            ))}
          </div>
        </FormSection>
      ) : null}

      <div className="flex justify-end">
        <FormSubmit>{values ? "Kaydet" : "Blok oluştur"}</FormSubmit>
      </div>
    </ActionForm>
  );
}
