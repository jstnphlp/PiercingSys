import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { AtSign, Clock3, MapPin, MoonStar, Sparkles } from "lucide-react";
import { getPublicCatalog } from "@/lib/data/public";
import { manilaDate } from "@/lib/domain";
import { BookingForm } from "./booking-form";
import "./booking.css";

export const metadata: Metadata = { title: "Book an appointment" };
const instagramUrl = "https://www.instagram.com/piercing.corner/";

export default async function BookingPage() {
  await connection();
  const catalog = await getPublicCatalog();
  return (
    <div className="booking-page">
      <main className="booking-layout">
        <section className="booking-story">
          <div className="motif motif-one">
            <Sparkles />
          </div>
          <div className="motif motif-two">
            <MoonStar />
          </div>
          <p className="eyebrow">PIERCING CORNER · PARAÑAQUE</p>
          <h1>
            A little corner
            <br />
            for your <em>spark.</em>
          </h1>
          <p>
            Choose your piercing, find a real opening, and leave with an
            appointment already confirmed.
          </p>
          <div className="studio-facts">
            <span>
              <MapPin size={17} />{" "}
              {catalog.studio.address ?? catalog.studio.location}
            </span>
            <span>
              <Clock3 size={17} /> Asia/Manila appointments
            </span>
          </div>
          <Image
            className="story-logo"
            src="/logo.png"
            alt="Piercing Corner ear illustration"
            width={220}
            height={220}
            priority
          />
        </section>
        <section className="booking-panel">
          {catalog.ready || catalog.reason === "connection" ? (
            <BookingForm
              services={catalog.services}
              piercers={catalog.piercers}
              minimumAge={catalog.studio.minimumAge}
              minDate={manilaDate(new Date())}
              preview={catalog.reason === "connection"}
            />
          ) : (
            <SetupState instagramUrl={instagramUrl} />
          )}
          <a
            className="instagram-link instagram-inline"
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open Piercing Corner on Instagram"
            title="@piercing.corner"
          >
            <AtSign size={15} />
          </a>
        </section>
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
