import { getAvailableSlots } from "@/lib/data/public";
import { availabilityQuerySchema, validationError } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: url.searchParams.get("serviceId"),
    date: url.searchParams.get("date"),
    piercerId: url.searchParams.get("piercerId") || undefined,
  });
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  try {
    const slots = await getAvailableSlots(parsed.data.serviceId, parsed.data.date, parsed.data.piercerId);
    return Response.json({ data: slots, meta: { timezone: "Asia/Manila" } });
  } catch {
    return Response.json({ error: { code: "AVAILABILITY_FAILED", message: "We could not load openings right now." } }, { status: 503 });
  }
}
