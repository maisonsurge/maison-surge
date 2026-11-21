"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { toggleWishlist, type WishlistToggleResult } from "@/server/wishlist";

const schema = z.object({ productId: z.uuid() });

export async function toggleWishlistAction(productId: string): Promise<WishlistToggleResult> {
  const parsed = schema.safeParse({ productId });
  if (!parsed.success) return { ok: false, reason: "error" };
  const result = await toggleWishlist(parsed.data.productId);
  if (result.ok) refresh();
  return result;
}
