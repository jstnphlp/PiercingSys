import Image from "next/image";
import { Clock3, MapPin, MoonStar, Sparkles } from "lucide-react";
import { LoadingStatus, Skeleton } from "@/components/skeleton";

export function BookPageSkeleton() {
  return <div className="booking-page booking-page-skeleton" aria-busy="true">
    <LoadingStatus label="Loading booking options"/>
    <main className="booking-layout">
      <section className="booking-story">
        <div className="motif motif-one"><Sparkles/></div><div className="motif motif-two"><MoonStar/></div>
        <p className="eyebrow">PIERCING CORNER · PARAÑAQUE</p>
        <h1>A little corner<br/>for your <em>spark.</em></h1>
        <p>Choose your piercing, find a real opening, and leave with an appointment already confirmed.</p>
        <div className="studio-facts"><span><MapPin size={17}/> Piercing Corner, Parañaque</span><span><Clock3 size={17}/> Asia/Manila appointments</span></div>
        <Image className="story-logo" src="/logo.png" alt="Piercing Corner ear illustration" width={220} height={220} priority/>
      </section>
      <section className="booking-panel">
        <div className="booking-form-wrap booking-form-skeleton">
          <ol className="booking-steps" aria-hidden="true">{[1,2,3].map((step) => <li className={step === 1 ? "active" : ""} key={step}><span>{step}</span>{step === 1 ? "Services" : step === 2 ? "Schedule" : "Details"}</li>)}</ol>
          <Skeleton width={74} height={9}/><Skeleton width="62%" height={34}/><Skeleton width="78%" height={10}/>
          <div className="booking-service-skeleton">
            <div className="booking-tools-skeleton"><Skeleton width="100%" height={39}/><div><Skeleton width={78} height={28}/><Skeleton width={106} height={28}/><Skeleton width={86} height={28}/></div></div>
            <div className="booking-service-grid-skeleton">{Array.from({ length: 8 }, (_, index) => <div key={index}><Skeleton width={17} height={17} radius="50%"/><span><Skeleton width="72%" height={10}/><Skeleton width="88%" height={8}/></span><Skeleton width={48} height={9}/></div>)}</div>
          </div>
          <Skeleton className="booking-next-skeleton" width={118} height={43}/>
        </div>
      </section>
    </main>
  </div>;
}
