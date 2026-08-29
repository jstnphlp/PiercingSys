import { notFound } from "next/navigation";
import { BookingForm } from "./booking-form";
import "./booking.css";
import "./theme.css";

export function generateStaticParams() { return [{ slug: "aura-collective" }]; }

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug !== "aura-collective") notFound();
  return <BookingForm />;
}
