"use client";

import { useState } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import { Dialog } from "@/components/ui/overlay";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n";
import { cn } from "@/lib/utils";

export type GalleryImage = { id: string; src: string; alt: string; unoptimized: boolean; colorId: string | null };

export function ProductGallery({ images, activeColorId }: { images: GalleryImage[]; activeColorId: string | null }) {
  const { t } = useI18n();
  // Prefer images tagged with the selected colour, keep the rest after them.
  const ordered = activeColorId
    ? [...images.filter((i) => i.colorId === activeColorId), ...images.filter((i) => i.colorId !== activeColorId)]
    : images;
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = ordered[Math.min(index, ordered.length - 1)];

  if (!current) return <div className="aspect-[4/5] bg-sand-100" />;

  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row" data-testid="gallery">
      {ordered.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto md:w-20 md:flex-col" aria-label={t.product.image.replace("{n}", "")}>
          {ordered.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={format(t.product.image, { n: i + 1 })}
                aria-current={i === index ? "true" : undefined}
                className={cn("relative block h-24 w-20 overflow-hidden bg-sand-100", i === index ? "outline outline-1 outline-ink" : "opacity-70 hover:opacity-100")}
              >
                <Image src={img.src} alt="" fill sizes="80px" unoptimized={img.unoptimized} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative flex-1">
        <button type="button" onClick={() => setZoom(true)} className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-sand-100" aria-label={t.product.zoom}>
          <Image src={current.src} alt={current.alt} fill priority sizes="(min-width: 1024px) 55vw, 100vw" unoptimized={current.unoptimized} className="object-cover" />
          <span className="absolute right-3 bottom-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-paper/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <ZoomIn className="h-4 w-4" aria-hidden />
          </span>
        </button>
      </div>
      <Dialog open={zoom} onClose={() => setZoom(false)} title={current.alt} className="max-w-5xl" closeLabel={t.common.close}>
        <div className="relative aspect-[4/5] max-h-[80dvh] w-full overflow-auto bg-sand-100">
          <Image src={current.src} alt={current.alt} fill sizes="100vw" quality={85} unoptimized={current.unoptimized} className="object-contain" />
        </div>
      </Dialog>
    </div>
  );
}
