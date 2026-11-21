import type { z } from "zod";

/** Uniform return shape for Server Actions used with useActionState. */
export type ActionState<T = unknown> = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  data?: T;
};

export const initialActionState: ActionState = { ok: false };

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Maps Postgres/RPC error messages raised by our SQL functions to stable codes. */
export function dbErrorCode(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "unknown";
  const msg = error.message ?? "";
  const m = /^([a-z_]+)$/.exec(msg.trim());
  if (m?.[1]) return m[1];
  if (error.code === "42501") return "forbidden";
  if (error.code === "23505") return "duplicate";
  if (error.code === "23503") return "in_use";
  if (error.code === "23514") return "check_violation";
  return "unknown";
}
