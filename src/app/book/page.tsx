import type { Metadata } from "next";
import { AtSign, Clock3, MapPin, MoonStar, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { getPublicCatalog } from "@/lib/data/public";
import { BookingForm } from "./booking-form";
import "./booking.css";

export const metadata: Metadata = { title: "Book an appointment" };
const instagramUrl = "https://www.instagram.com/piercing.corner/";

export default async function BookingPage() {
  const catalog = await getPublicCatalog();
  return (
    <div className="booking-page">
      <header className="booking-header">
        <Brand />
        <div className="booking-header-actions">
          <span>Online appointment booking</span>
          <a
            className="instagram-link"
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open Piercing Corner on Instagram"
            title="@piercing.corner"
          >
            <AtSign size={16} />
          </a>
        </div>
      </header>
      <main className="booking-layout">
        <section className="booking-story" aria-labelledby="booking-heading">
          <div className="motif motif-one">
            <Sparkles />
          </div>
          <div className="motif motif-two">
            <MoonStar />
          </div>
          <p className="eyebrow">APPOINTMENTS AT PIERCING CORNER</p>
          <h1 id="booking-heading">
            A little corner
            <br />
            for your <em>spark.</em>
          </h1>
          <p>
            Choose your piercing, find a real opening, and leave with an
            appointment already confirmed.
          </p>
        </section>
        <section className="booking-panel">
          {catalog.ready || catalog.reason === "connection" ? (
            <BookingForm
              services={catalog.services}
              piercers={catalog.piercers}
              assignments={catalog.assignments}
              minimumAge={catalog.studio.minimumAge}
              bookingHorizonDays={catalog.studio.bookingHorizonDays}
              preview={catalog.reason === "connection"}
            />
          ) : (
            <SetupState instagramUrl={instagramUrl} />
          )}
        </section>
        <aside className="booking-support" aria-label="Studio details">
          <div className="studio-facts">
            <span>
              <MapPin size={17} />{" "}
              {catalog.studio.address ?? catalog.studio.location}
            </span>
            <span>
              <Clock3 size={17} /> Asia/Manila appointments
            </span>
          </div>
        </aside>
      </main>
    </div>
  );
}

function SetupState({ instagramUrl }: { instagramUrl: string }) {
  return (
    <div className="setup-state" role="status">
      <span className="setup-icon">
        <MoonStar />
      </span>
      <p className="eyebrow">COMING SOON</p>
      <h2>Online booking is being set up.</h2>
      <p>We’re adding studio hours, services, and our piercing team before opening the live calendar.</p>
      <a
        className="btn btn-primary"
        href={instagramUrl}
        target="_blank"
        rel="noreferrer"
      >
        <AtSign size={16} /> Visit us on Instagram
      </a>
    </div>
  );
}
