"use client";

import { useState } from "react";
import { slugify } from "@/lib/utils";
import { ActionForm, CheckboxField, FormSection, FormSubmit, LocalizedFields, SelectField, TextField, type FormAction } from "@/features/admin/ui/action-form";
import { SiteImageField } from "@/features/admin/ui/site-image-field";

type L = { tr?: string; en?: string };

export type TaxonomyValues = {
  slug: string;
  parent_id?: string | null;
  name: L;
  description: L;
  seo_title?: L;
  seo_description?: L;
  image_path: string | null;
  position: number;
  is_active: boolean;
};

export function TaxonomyForm({
  kind,
  action,
  values,
  parents,
}: {
  kind: "category" | "collection";
  action: FormAction;
  values: TaxonomyValues | null;
  parents?: { id: string; label: string }[];
}) {
  const isNew = values === null;
  const [slug, setSlug] = useState(values?.slug ?? "");
  const [touched, setTouched] = useState(!isNew);
  return (
    <ActionForm action={action} className="grid gap-6">
      <FormSection title="Genel">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="name_tr"
            label="Ad (TR) *"
            defaultValue={values?.name.tr ?? ""}
            maxLength={200}
            required
            onChange={(e) => {
              if (!touched) setSlug(slugify(e.currentTarget.value));
            }}
          />
          <TextField name="name_en" label="Ad (EN)" defaultValue={values?.name.en ?? ""} maxLength={200} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            name="slug"
            label="URL (slug) *"
            value={slug}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.currentTarget.value.toLowerCase());
            }}
            maxLength={80}
            required
          />
          {kind === "category" ? (
            <SelectField name="parent_id" label="Üst kategori" defaultValue={values?.parent_id ?? ""} placeholder="— Ana kategori —" options={(parents ?? []).map((p) => ({ value: p.id, label: p.label }))} />
          ) : null}
          <TextField name="position" label="Sıra" type="number" min={0} defaultValue={String(values?.position ?? 0)} />
        </div>
        <LocalizedFields base="description" label="Açıklama" values={values?.description} multiline rows={3} maxLength={2000} />
        <CheckboxField name="is_active" label="Aktif (mağazada görünür)" defaultChecked={values?.is_active ?? true} />
      </FormSection>

      <FormSection title="Görsel">
        <SiteImageField name="image_path" label="Kapak görseli" folder={kind === "category" ? "categories" : "collections"} defaultValue={values?.image_path ?? null} />
      </FormSection>

      {kind === "category" ? (
        <FormSection title="SEO" description="Boş bırakılırsa kategori adı ve açıklaması kullanılır.">
          <LocalizedFields base="seo_title" label="SEO başlığı" values={values?.seo_title} maxLength={70} />
          <LocalizedFields base="seo_description" label="SEO açıklaması" values={values?.seo_description} maxLength={170} />
        </FormSection>
      ) : null}

      <div className="flex justify-end">
        <FormSubmit>{isNew ? "Oluştur" : "Kaydet"}</FormSubmit>
      </div>
    </ActionForm>
  );
}
