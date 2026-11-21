"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { addToCartAction } from "@/features/cart/actions";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/ui/price";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { WishlistButton } from "@/components/product/wishlist-button";
import { useI18n } from "@/i18n/client";
import { format } from "@/i18n";
import { cn } from "@/lib/utils";
import { ProductGallery, type GalleryImage } from "./gallery";

export type VariantOption = {
  id: string;
  sku: string;
  sizeId: string | null;
  colorId: string | null;
  price: number;
  compareAtPrice: number | null;
  available: number;
  lowStockThreshold: number;
};

type Props = {
  productId: string;
  name: string;
  images: GalleryImage[];
  variants: VariantOption[];
  sizes: { id: string; code: string; label: string }[];
  colors: { id: string; code: string; name: string; hex: string }[];
  inWishlist: boolean;
  sizeGuide: ReactNode | null;
  header: ReactNode;
  details: ReactNode;
};

export function ProductExperience(props: Props) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { variants, sizes, colors } = props;

  const firstAvailable = variants.find((v) => v.available > 0) ?? variants[0] ?? null;
  const [colorId, setColorId] = useState<string | null>(colors.length ? (firstAvailable?.colorId ?? colors[0]!.id) : null);
  const [sizeId, setSizeId] = useState<string | null>(sizes.length === 1 ? sizes[0]!.id : null);
  const [qty, setQty] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const variantFor = (c: string | null, s: string | null) =>
    variants.find((v) => (colors.length ? v.colorId === c : true) && (sizes.length ? v.sizeId === s : true)) ?? null;

  const selected = useMemo(() => {
    if (sizes.length && !sizeId) return null;
    if (colors.length && !colorId) return null;
    return variantFor(colorId, sizeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorId, sizeId, variants]);

  const displayPrice = selected ?? variants.reduce<VariantOption | null>((min, v) => (!min || v.price < min.price ? v : min), null);
  const maxQty = selected ? Math.min(selected.available, 20) : 20;

  function add() {
    setError(null);
    if (!selected) {
      setError(t.product.selectVariant);
      return;
    }
    if (selected.available <= 0) {
      setError(t.product.outOfStock);
      return;
    }
    startTransition(async () => {
      const res = await addToCartAction({ variantId: selected.id, quantity: Math.min(qty, maxQty), locale });
      if (res.ok) toast(res.message ?? t.product.added, "success");
      else {
        setError(res.message ?? t.common.error);
        toast(res.message ?? t.common.error, "error");
      }
    });
  }

  const colorName = colors.find((c) => c.id === colorId)?.name;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-16">
      <ProductGallery key={colorId ?? "all"} images={props.images} activeColorId={colorId} />

      <div className="lg:sticky lg:top-28 lg:self-start">
        {props.header}
        {displayPrice ? <Price amount={displayPrice.price} compareAt={displayPrice.compareAtPrice} locale={locale} className="mt-4 text-lg" /> : null}

        {colors.length > 0 ? (
          <fieldset className="mt-8">
            <legend className="eyebrow">
              {t.catalog.color}
              {colorName ? <span className="ml-2 font-normal tracking-normal normal-case text-muted">{colorName}</span> : null}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {colors.map((c) => {
                const anyStock = variants.some((v) => v.colorId === c.id && v.available > 0);
                return (
                  <label key={c.id} className="relative cursor-pointer" title={c.name}>
                    <input
                      type="radio"
                      name="color"
                      value={c.id}
                      checked={colorId === c.id}
                      onChange={() => {
                        setColorId(c.id);
                        setError(null);
                        setQty(1);
                      }}
                      className="peer sr-only"
                      aria-label={`${c.name}${anyStock ? "" : ` — ${t.catalog.soldOut}`}`}
                    />
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border border-line p-1 peer-checked:border-ink peer-focus-visible:outline-2 peer-focus-visible:outline-burgundy",
                        !anyStock && "opacity-40",
                      )}
                    >
                      <span className="h-full w-full rounded-full border border-ink/10" style={{ backgroundColor: c.hex }} />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {sizes.length > 0 ? (
          <fieldset className="mt-6">
            <div className="flex items-center justify-between">
              <legend className="eyebrow">{t.catalog.size}</legend>
              {props.sizeGuide ? (
                <button type="button" onClick={() => setGuideOpen(true)} className="text-xs underline underline-offset-4">
                  {t.product.sizeGuide}
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {sizes.map((s) => {
                const v = variantFor(colorId, s.id);
                const out = !v || v.available <= 0;
                return (
                  <label key={s.id} className={cn("relative", out ? "cursor-not-allowed" : "cursor-pointer")}>
                    <input
                      type="radio"
                      name="size"
                      value={s.id}
                      checked={sizeId === s.id}
                      disabled={out}
                      onChange={() => {
                        setSizeId(s.id);
                        setError(null);
                        setQty(1);
                      }}
                      className="peer sr-only"
                      aria-label={`${s.label}${out ? ` — ${t.catalog.soldOut}` : ""}`}
                      data-testid={`size-${s.code}`}
                    />
                    <span
                      className={cn(
                        "flex h-11 items-center justify-center border text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-burgundy",
                        out ? "border-line text-muted line-through" : "border-line hover:border-ink",
                      )}
                    >
                      {s.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="mt-4 min-h-5 text-sm" aria-live="polite">
          {selected ? (
            selected.available <= 0 ? (
              <span className="text-danger">{t.product.outOfStock}</span>
            ) : selected.available <= selected.lowStockThreshold ? (
              <span className="text-warning">{format(t.product.lowStock, { count: selected.available })}</span>
            ) : (
              <span className="text-olive">{t.product.inStock}</span>
            )
          ) : null}
          {selected ? <span className="ml-3 text-xs text-muted">{t.product.sku}: {selected.sku}</span> : null}
        </div>

        <div className="mt-4 flex gap-3">
          <div className="flex h-12 items-center border border-line" role="group" aria-label={t.product.quantity}>
            <button type="button" className="flex h-full w-10 items-center justify-center disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label={t.cart.decrease}>
              <Minus className="h-4 w-4" aria-hidden />
            </button>
            <output className="w-8 text-center text-sm tabular-nums" aria-live="polite" data-testid="qty">
              {qty}
            </output>
            <button type="button" className="flex h-full w-10 items-center justify-center disabled:opacity-40" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label={t.cart.increase}>
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <Button size="lg" className="h-12 flex-1" onClick={add} disabled={pending || (selected !== null && selected.available <= 0)} aria-busy={pending} data-testid="add-to-cart">
            {pending ? t.product.adding : selected && selected.available <= 0 ? t.catalog.soldOut : t.product.addToCart}
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3">
          <WishlistButton productId={props.productId} initial={props.inWishlist} withLabel className="w-full" />
        </div>

        <div className="mt-10">{props.details}</div>
      </div>

      {props.sizeGuide ? (
        <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} title={t.product.sizeGuide} closeLabel={t.common.close}>
          <div className="prose-ms max-w-none text-sm">{props.sizeGuide}</div>
        </Dialog>
      ) : null}
    </div>
  );
}
