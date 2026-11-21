"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionForm, FormSubmit, TextField } from "@/features/admin/ui/action-form";
import { setVariantStock } from "@/server/admin/products";

/** Inline "set stock" control for the inventory table. */
export function StockCell({ variantId, onHand, reserved }: { variantId: string; onHand: number; reserved: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Stok gir
      </Button>
    );
  }
  return (
    <ActionForm action={setVariantStock.bind(null, variantId)} className="flex flex-wrap items-end gap-2" showErrorSummary={false} successMessage="Stok güncellendi.">
      <TextField name="on_hand" label="Eldeki" type="number" min={reserved} defaultValue={String(onHand)} className="w-24" autoFocus />
      <TextField name="reason" label="Gerekçe" placeholder="sayım" maxLength={500} className="w-36" />
      <FormSubmit size="sm" variant="secondary">
        Kaydet
      </FormSubmit>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Kapat
      </Button>
    </ActionForm>
  );
}
