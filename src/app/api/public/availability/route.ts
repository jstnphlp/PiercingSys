import { getAvailableSlots } from "@/lib/data/public";
import { availabilityQuerySchema, validationError } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const legacyServiceId = url.searchParams.get("serviceId");
  const requestedServiceIds = url.searchParams.getAll("serviceIds")
    .flatMap((value) => value.split(","))
    .filter(Boolean);
  const parsed = availabilityQuerySchema.safeParse({
    serviceIds: requestedServiceIds.length ? requestedServiceIds : legacyServiceId ? [legacyServiceId] : [],
    date: url.searchParams.get("date"),
    piercerId: url.searchParams.get("piercerId") || undefined,
  });
  if (!parsed.success) return Response.json(validationError(parsed.error), { status: 422 });
  try {
    const slots = await getAvailableSlots(parsed.data.serviceIds, parsed.data.date, parsed.data.piercerId);
    return Response.json({ data: slots, meta: { timezone: "Asia/Manila" } });
  } catch {
    return Response.json({ error: { code: "AVAILABILITY_FAILED", message: "We could not load openings right now." } }, { status: 503 });
  }
}
