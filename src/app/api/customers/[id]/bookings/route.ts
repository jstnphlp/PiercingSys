import { getStaffSession } from "@/lib/auth";
import { bookingDetailSelect, mapBookingRow } from "@/lib/data/staff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in is required." } }, { status: 401 });
  }
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!
    .from("bookings")
    .select(bookingDetailSelect)
    .eq("customer_id", id)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) {
    return Response.json({ error: { code: "LOOKUP_FAILED", message: error.message } }, { status: 400 });
  }
  return Response.json({
    data: (data ?? []).map((row) => mapBookingRow(row as Record<string, unknown>)),
  });
}
