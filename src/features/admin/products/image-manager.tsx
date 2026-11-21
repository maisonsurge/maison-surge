"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Star, Upload } from "lucide-react";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, PRODUCT_BUCKET, imageUrl, isUnoptimizable } from "@/lib/images";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { ActionForm, FormSubmit, SelectField, TextField } from "@/features/admin/ui/action-form";
import { ActionButton } from "@/features/admin/ui/action-button";
import {
  createProductImageUploads,
  deleteProductImage,
  moveProductImage,
  registerProductImages,
  setCoverImage,
  updateProductImage,
} from "@/server/admin/products";

export type ImageRow = {
  id: string;
  path: string;
  alt: { tr?: string; en?: string };
  color_id: string | null;
  is_cover: boolean;
  position: number;
  width: number | null;
  height: number | null;
};

function readDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || null, height: img.naturalHeight || null });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function ImageManager({ productId, images, colors }: { productId: string; images: ImageRow[]; colors: { id: string; label: string }[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const bad = list.find((f) => !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type) || f.size > MAX_IMAGE_BYTES);
    if (bad) {
      toast(`${bad.name}: yalnızca JPEG/PNG/WebP/AVIF, en fazla 8 MB.`, "error");
      return;
    }
    try {
      setBusy("Yükleme hazırlanıyor…");
      const res = await createProductImageUploads(
        productId,
        list.map((f) => ({ name: f.name, type: f.type, size: f.size })),
      );
      if (!res.ok || !res.data) {
        toast(res.message ?? "Yükleme başlatılamadı.", "error");
        return;
      }
      const storage = getBrowserSupabase().storage.from(PRODUCT_BUCKET);
      const uploaded: { path: string; width: number | null; height: number | null }[] = [];
      for (let i = 0; i < list.length; i++) {
        const file = list[i]!;
        const target = res.data.uploads[i]!;
        setBusy(`Yükleniyor ${i + 1}/${list.length}…`);
        const { error } = await storage.uploadToSignedUrl(target.path, target.token, file, { contentType: file.type, cacheControl: "31536000" });
        if (error) {
          toast(`${file.name} yüklenemedi.`, "error");
          continue;
        }
        uploaded.push({ path: target.path, ...(await readDimensions(file)) });
      }
      if (uploaded.length) {
        const reg = await registerProductImages(productId, uploaded);
        toast(reg.message ?? (reg.ok ? "Görseller eklendi." : "Kayıt başarısız."), reg.ok ? "success" : "error");
        router.refresh();
      }
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-4">
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-line bg-sand-50 p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(e.dataTransfer.files);
        }}
      >
        <Upload className="h-5 w-5 text-muted" aria-hidden />
        <p className="text-sm">Görselleri sürükleyip bırakın veya seçin</p>
        <p className="text-xs text-muted">JPEG, PNG, WebP, AVIF · en fazla 8 MB · tek seferde 12 dosya. Gerçek ürün fotoğrafı kullanın.</p>
        <input
          ref={inputRef}
          id="product-image-input"
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          multiple
          className="sr-only"
          onChange={(e) => void upload(e.currentTarget.files)}
        />
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
          {busy ?? "Dosya seç"}
        </Button>
        <p aria-live="polite" className="sr-only">
          {busy ?? ""}
        </p>
      </div>

      {images.length === 0 ? <p className="text-sm text-muted">Henüz görsel yok. Mağazada yer tutucu gösterilir.</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((img, idx) => {
          const src = imageUrl(img.path);
          return (
            <li key={img.id} className="rounded-sm border border-line bg-paper">
              <div className="relative aspect-[4/5] bg-sand-100">
                {src ? <Image src={src} alt={img.alt.tr ?? ""} fill sizes="(min-width:1280px) 25vw, 50vw" className="object-cover" unoptimized={isUnoptimizable(src)} /> : null}
                <div className="absolute top-2 left-2 flex gap-1">
                  {img.is_cover ? <Badge tone="info">Kapak</Badge> : null}
                  <Badge>#{idx + 1}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 border-b border-line p-2">
                <ActionButton action={moveProductImage.bind(null, productId, img.id, -1)} variant="ghost" size="icon" ariaLabel="Öne taşı" disabled={idx === 0}>
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </ActionButton>
                <ActionButton action={moveProductImage.bind(null, productId, img.id, 1)} variant="ghost" size="icon" ariaLabel="Arkaya taşı" disabled={idx === images.length - 1}>
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </ActionButton>
                {!img.is_cover ? (
                  <ActionButton action={setCoverImage.bind(null, productId, img.id)} variant="ghost" size="sm">
                    <Star className="h-4 w-4" aria-hidden /> Kapak yap
                  </ActionButton>
                ) : null}
                <ActionButton
                  action={deleteProductImage.bind(null, productId, img.id)}
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  confirm={{ title: "Görsel silinsin mi?", body: "Başka bir ürün kullanmıyorsa dosya depolamadan da silinir.", confirmLabel: "Sil" }}
                >
                  Sil
                </ActionButton>
              </div>
              <ActionForm action={updateProductImage.bind(null, productId, img.id)} className="grid gap-3 p-3" successMessage="Görsel bilgileri kaydedildi.">
                <TextField name="alt_tr" label="Alternatif metin (TR)" defaultValue={img.alt.tr ?? ""} maxLength={200} hint="Görseli görmeyenler için kısa açıklama." />
                <TextField name="alt_en" label="Alt text (EN)" defaultValue={img.alt.en ?? ""} maxLength={200} />
                <SelectField name="color_id" label="Renk ilişkisi" defaultValue={img.color_id ?? ""} placeholder="— Tüm renkler —" options={colors.map((c) => ({ value: c.id, label: c.label }))} />
                <FormSubmit size="sm" variant="outline">
                  Kaydet
                </FormSubmit>
              </ActionForm>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
