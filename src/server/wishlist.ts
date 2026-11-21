import "server-only";
import { cache } from "react";
import { createClient } from "@/server/supabase/server";
import { getSessionUser } from "@/server/auth";

/** Wishlist rows are user-owned and protected by RLS (user_id = auth.uid()). */
export const getWishlistProductIds = cache(async (): Promise<Set<string>> => {
  const user = await getSessionUser();
  if (!user) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("wishlists").select("product_id").eq("user_id", user.id);
  return new Set((data ?? []).map((r) => r.product_id));
});

export type WishlistToggleResult = { ok: true; inWishlist: boolean } | { ok: false; reason: "auth" | "error" };

export async function toggleWishlist(productId: string): Promise<WishlistToggleResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: "auth" };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("wishlists").select("product_id").eq("user_id", user.id).eq("product_id", productId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
    return error ? { ok: false, reason: "error" } : { ok: true, inWishlist: false };
  }
  const { error } = await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
  return error ? { ok: false, reason: "error" } : { ok: true, inWishlist: true };
}
