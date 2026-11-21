"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, SITE_BUCKET, imageUrl, isUnoptimizable } from "@/lib/images";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createSiteAssetUpload } from "@/server/admin/catalog";

/**
 * Image picker for category/collection/homepage images. Uploads to the public
 * `site-assets` bucket via a signed URL and stores the public URL in a hidden
 * input (`name`) that is submitted with the surrounding form.
 */
export function SiteImageField({ name, label, folder, defaultValue }: { name: string; label: string; folder: "categories" | "collections" | "homepage"; defaultValue: string | null }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const src = imageUrl(value || null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      toast("Yalnızca JPEG/PNG/WebP/AVIF, en fazla 8 MB.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await createSiteAssetUpload({ folder, type: file.type, size: file.size });
      if (!res.ok || !res.data) {
        toast(res.message ?? "Yükleme başlatılamadı.", "error");
        return;
      }
      const { error } = await getBrowserSupabase().storage.from(SITE_BUCKET).uploadToSignedUrl(res.data.path, res.data.token, file, { contentType: file.type, cacheControl: "31536000" });
      if (error) {
        toast("Görsel yüklenemedi.", "error");
        return;
      }
      setValue(res.data.publicUrl);
      toast("Görsel yüklendi. Kaydetmeyi unutmayın.", "success");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-wide">{label}</p>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-24 w-32 overflow-hidden border border-line bg-sand-100">
          {src ? <Image src={src} alt="" fill sizes="128px" className="object-cover" unoptimized={isUnoptimizable(src)} /> : <span className="flex h-full items-center justify-center text-xs text-muted">Görsel yok</span>}
        </div>
        <div className="flex gap-2">
          <input ref={inputRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} className="sr-only" aria-label={label} onChange={(e) => void onFile(e.currentTarget.files?.[0])} />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Yükleniyor…" : value ? "Değiştir" : "Görsel yükle"}
          </Button>
          {value ? (
            <Button variant="ghost" size="sm" onClick={() => setValue("")}>
              Kaldır
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
