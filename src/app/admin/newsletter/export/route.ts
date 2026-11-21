import { NextResponse, type NextRequest } from "next/server";
import { hasPermission } from "@/server/auth";
import { createClient } from "@/server/supabase/server";
import { toCsv } from "@/features/admin/lib/helpers";

export const dynamic = "force-dynamic";

/** CSV export of newsletter subscribers. Permission is checked server-side; RLS applies again in the query. */
export async function GET(request: NextRequest) {
  if (!(await hasPermission("newsletter.view"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const status = request.nextUrl.searchParams.get("status");
  const supabase = await createClient();
  const rows: unknown[][] = [["email", "status", "locale", "source", "consent_text_version", "consent_at", "confirmed_at", "unsubscribed_at"]];
  const PAGE = 1000;
  for (let from = 0; from < 100_000; from += PAGE) {
    let query = supabase
      .from("newsletter_subscriptions")
      .select("email, status, locale, source, consent_text_version, consent_at, confirmed_at, unsubscribed_at")
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (status === "pending" || status === "confirmed" || status === "unsubscribed") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "export_failed" }, { status: 500 });
    for (const r of data ?? []) rows.push([r.email, r.status, r.locale, r.source, r.consent_text_version, r.consent_at, r.confirmed_at, r.unsubscribed_at]);
    if (!data || data.length < PAGE) break;
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${toCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bulten-aboneleri-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
