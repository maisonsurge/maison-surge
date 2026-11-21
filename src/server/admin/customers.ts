"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import type { AppRole } from "@/lib/auth/permissions";
import { createClient } from "@/server/supabase/server";
import { authorize, dbFail, isUuid } from "./common";

export async function setUserRole(userId: string, role: AppRole, enabled: boolean): Promise<ActionState> {
  const auth = await authorize("roles.manage");
  if (!auth.ok) return auth.state;
  if (!isUuid(userId) || (role !== "admin" && role !== "staff") || typeof enabled !== "boolean") return { ok: false, message: "Geçersiz istek." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role, p_enabled: enabled });
  if (error) return dbFail(error, "set role");
  revalidatePath(`/admin/customers/${userId}`);
  revalidatePath("/admin/customers");
  return { ok: true, message: enabled ? `${role} rolü verildi.` : `${role} rolü kaldırıldı.` };
}
