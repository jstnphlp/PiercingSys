const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const required = ["firstName", "lastName", "email", "phone", "service"];
  if (required.some((key) => typeof body[key] !== "string" || !String(body[key]).trim())) {
    return Response.json({ error: "Please complete all required fields." }, { status: 422 });
  }
  if (!emailPattern.test(String(body.email)) || body.ageConfirmed !== "on") {
    return Response.json({ error: "A valid email and age confirmation are required." }, { status: 422 });
  }
  return Response.json({ id: crypto.randomUUID(), status: "requested", message: "Booking request received" }, { status: 201 });
}
