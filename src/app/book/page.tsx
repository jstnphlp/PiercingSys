import type { Metadata } from "next";
import Image from "next/image";
import { AtSign, Clock3, MapPin, MoonStar, Sparkles } from "lucide-react";
import { getPublicCatalog } from "@/lib/data/public";
import { eyebrow, hippyButton } from "@/components/ui/studio-styles";
import { BookingForm } from "./booking-form";
import { bookingHeading, bookingLayout, bookingPage, bookingPanel, bookingStory, storyTitle } from "./booking-styles";

export const metadata: Metadata = { title: "Book an appointment" };
const instagramUrl = "https://www.instagram.com/piercing.corner/";

export default async function BookingPage() {
  const catalog = await getPublicCatalog();
  return (
    <div className={bookingPage}>
      <main className={bookingLayout}>
        <section className={bookingStory}>
          <div className="absolute top-[8%] right-[10%] z-3 grid rotate-[13deg] place-items-center text-hippy-gold drop-shadow-[2px_2px_0_#3b2923] max-[980px]:right-[8%] [&>svg]:size-[34px] [&>svg]:stroke-[2.5]">
            <Sparkles />
          </div>
          <div className="absolute bottom-[5%] left-0 z-3 grid -rotate-[18deg] place-items-center text-hippy-lilac drop-shadow-[2px_2px_0_#3b2923] max-[980px]:bottom-[4%] max-[980px]:left-[5%] [&>svg]:size-[34px] [&>svg]:stroke-[2.5]">
            <MoonStar />
          </div>
          <p className={`${eyebrow} relative z-2 text-hippy-rust`}>PIERCING CORNER · PARAÑAQUE</p>
          <h1 className={storyTitle}>
            A little corner
            <br />
            for your <em>spark.</em>
          </h1>
          <p className="relative z-2 my-6 max-w-[440px] text-sm/[1.75] font-[560] text-[#6e5045]">
            Choose your piercing, find a real opening, and leave with an
            appointment already confirmed.
          </p>
          <div className="relative z-2 flex flex-col gap-[11px] text-[11px] font-[750] max-[980px]:items-center [&_span]:flex [&_span]:items-center [&_span]:gap-[9px] [&_svg]:text-hippy-rust">
            <span>
              <MapPin size={17} />{" "}
              {catalog.studio.address ?? catalog.studio.location}
            </span>
            <span>
              <Clock3 size={17} /> Asia/Manila appointments
            </span>
          </div>
          <Image
            className="absolute right-[-30px] bottom-[-40px] z-1 size-[235px] -rotate-[9deg] rounded-[47%_53%_44%_56%] border-[3px] border-hippy-ink shadow-[9px_9px_0_#3b2923] max-[980px]:right-[-12px] max-[980px]:bottom-[-35px] max-[630px]:right-[2%] max-[630px]:size-[180px]"
            src="/logo.png"
            alt="Piercing Corner ear illustration"
            width={220}
            height={220}
            priority
          />
        </section>
        <section className={bookingPanel}>
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
          <a
            className="absolute top-[15px] right-[17px] z-6 inline-flex size-[34px] items-center justify-center rounded-[50%_43%_54%_46%] border-2 border-hippy-ink bg-[#e7cfeb] p-0 text-hippy-ink shadow-[3px_3px_0_#3b2923] hover:translate-[1px] hover:shadow-[2px_2px_0_#3b2923] max-[630px]:top-3 max-[630px]:right-[13px]"
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
    <div className="m-auto w-[min(430px,88%)] text-center [&>p:not(:first-of-type)]:text-xs/[1.65] [&>p:not(:first-of-type)]:text-[#71594f]" role="status">
      <span className="mx-auto mb-[18px] grid size-[61px] place-items-center rounded-[50%_43%_54%_46%] border-2 border-hippy-ink bg-hippy-orange text-white shadow-[4px_4px_0_#3b2923]">
        <MoonStar />
      </span>
      <p className={`${eyebrow} text-hippy-rust`}>COMING SOON</p>
      <h2 className={bookingHeading}>Online booking is being set up.</h2>
      <p>We’re adding studio hours, services, and our piercing team before opening the live calendar.</p>
      <a
        className={hippyButton({ variant: "primary" })}
        href={instagramUrl}
        target="_blank"
        rel="noreferrer"
      >
        <AtSign size={16} /> Visit us on Instagram
      </a>
    </div>
  );
}
