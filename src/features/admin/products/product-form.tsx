"use client";

import { useState } from "react";
import { slugify } from "@/lib/utils";
import { toInputValue } from "@/lib/money";
import { ActionForm, CheckboxField, FormSection, FormSubmit, MoneyField, SelectField, TextAreaField, TextField, type FormAction } from "@/features/admin/ui/action-form";

export type ProductFormValues = {
  slug: string;
  category_id: string | null;
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  base_price: number | null;
  compare_at_price: number | null;
  cost_price: number | null;
  size_guide: { tr?: string; en?: string };
  tr: { name: string; description: string; material: string; care: string; seo_title: string | null; seo_description: string | null } | null;
  en: { name: string; description: string; material: string; care: string; seo_title: string | null; seo_description: string | null } | null;
  collection_ids: string[];
};

export function ProductForm({
  action,
  values,
  categories,
  collections,
  isNew,
}: {
  action: FormAction;
  values: ProductFormValues | null;
  categories: { id: string; label: string }[];
  collections: { id: string; label: string }[];
  isNew: boolean;
}) {
  const [slug, setSlug] = useState(values?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);

  return (
    <ActionForm action={action} className="grid gap-6" successMessage="Ürün kaydedildi.">
      <FormSection title="Genel">
        <TextField
          name="tr_name"
          label="Ürün adı (TR) *"
          defaultValue={values?.tr?.name ?? ""}
          maxLength={160}
          required
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.currentTarget.value));
          }}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="slug"
            label="URL (slug) *"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.currentTarget.value.toLowerCase());
            }}
            hint="Yalnızca küçük harf, rakam ve tire. Yayındaki ürünün slug'ını değiştirmek eski bağlantıları bozar."
            maxLength={80}
            required
          />
          <SelectField
            name="category_id"
            label="Kategori"
            defaultValue={values?.category_id ?? ""}
            placeholder="— Kategori yok —"
            options={categories.map((c) => ({ value: c.id, label: c.label }))}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            name="status"
            label="Yayın durumu"
            defaultValue={values?.status ?? "draft"}
            options={[
              { value: "draft", label: "Taslak (mağazada görünmez)" },
              { value: "published", label: "Yayında" },
              { value: "archived", label: "Arşiv (satış dışı)" },
            ]}
          />
          <div className="flex items-end pb-2">
            <CheckboxField name="is_featured" label="Öne çıkan ürün (ana sayfa vitrini)" defaultChecked={values?.is_featured ?? false} />
          </div>
        </div>
      </FormSection>

      <FormSection title="Fiyat" description="Tüm fiyatlar KDV dahil, TRY. Varyant bazında farklı fiyat varyant düzenleyicisinden girilebilir.">
        <div className="grid gap-4 md:grid-cols-3">
          <MoneyField name="base_price" label="Satış fiyatı *" defaultValue={toInputValue(values?.base_price)} required />
          <MoneyField name="compare_at_price" label="Karşılaştırma (eski) fiyat" defaultValue={toInputValue(values?.compare_at_price)} hint="İndirim göstermek için satış fiyatından yüksek olmalı." />
          <MoneyField name="cost_price" label="Maliyet (gizli)" defaultValue={toInputValue(values?.cost_price)} hint="Yalnızca yönetim panelinde görünür." />
        </div>
      </FormSection>

      <FormSection title="Türkçe içerik">
        <TextAreaField name="tr_description" label="Açıklama" rows={6} defaultValue={values?.tr?.description ?? ""} maxLength={10000} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextAreaField name="tr_material" label="Materyal" rows={3} defaultValue={values?.tr?.material ?? ""} maxLength={2000} hint="Doğrulanmamış materyal/sertifika iddiası yazmayın." />
          <TextAreaField name="tr_care" label="Bakım" rows={3} defaultValue={values?.tr?.care ?? ""} maxLength={2000} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="tr_seo_title" label="SEO başlığı" defaultValue={values?.tr?.seo_title ?? ""} maxLength={70} hint="En fazla 70 karakter. Boşsa ürün adı kullanılır." />
          <TextField name="tr_seo_description" label="SEO açıklaması" defaultValue={values?.tr?.seo_description ?? ""} maxLength={170} hint="En fazla 170 karakter." />
        </div>
      </FormSection>

      <FormSection title="İngilizce içerik" description="İsteğe bağlı. Boş bırakılırsa İngilizce sitede Türkçe içerik gösterilir.">
        <TextField name="en_name" label="Product name (EN)" defaultValue={values?.en?.name ?? ""} maxLength={160} />
        <TextAreaField name="en_description" label="Description" rows={6} defaultValue={values?.en?.description ?? ""} maxLength={10000} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextAreaField name="en_material" label="Material" rows={3} defaultValue={values?.en?.material ?? ""} maxLength={2000} />
          <TextAreaField name="en_care" label="Care" rows={3} defaultValue={values?.en?.care ?? ""} maxLength={2000} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="en_seo_title" label="SEO title" defaultValue={values?.en?.seo_title ?? ""} maxLength={70} />
          <TextField name="en_seo_description" label="SEO description" defaultValue={values?.en?.seo_description ?? ""} maxLength={170} />
        </div>
      </FormSection>

      <FormSection title="Beden rehberi" description="Markdown tablo desteklenir. Ölçüler işletme tarafından girilmelidir.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextAreaField name="size_guide_tr" label="Beden rehberi (TR)" rows={7} defaultValue={values?.size_guide.tr ?? ""} className="font-mono" />
          <TextAreaField name="size_guide_en" label="Size guide (EN)" rows={7} defaultValue={values?.size_guide.en ?? ""} className="font-mono" />
        </div>
      </FormSection>

      <FormSection title="Koleksiyonlar">
        {collections.length === 0 ? (
          <p className="text-sm text-muted">Henüz koleksiyon yok.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c) => (
              <CheckboxField key={c.id} name="collection_ids" value={c.id} label={c.label} defaultChecked={values?.collection_ids.includes(c.id) ?? false} />
            ))}
          </div>
        )}
      </FormSection>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-line bg-sand-50/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <FormSubmit>{isNew ? "Ürünü oluştur" : "Değişiklikleri kaydet"}</FormSubmit>
      </div>
    </ActionForm>
  );
}
