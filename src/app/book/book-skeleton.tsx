import Image from "next/image";
import { Clock3, MapPin, MoonStar, Sparkles } from "lucide-react";
import { LoadingStatus, Skeleton } from "@/components/skeleton";
import { eyebrow } from "@/components/ui/studio-styles";
import { bookingFormWrap, bookingLayout, bookingPage, bookingPanel, bookingStepBubble, bookingStepItem, bookingSteps, bookingStory, serviceButton, storyTitle } from "./booking-styles";

export function BookPageSkeleton() {
  return <div className={bookingPage} aria-busy="true">
    <LoadingStatus label="Loading booking options"/>
    <main className={bookingLayout}>
      <section className={bookingStory}>
        <div className="absolute top-[8%] right-[10%] z-3 grid rotate-[13deg] place-items-center text-hippy-gold drop-shadow-[2px_2px_0_#3b2923] max-[980px]:right-[8%] [&>svg]:size-[34px]"><Sparkles/></div><div className="absolute bottom-[5%] left-0 z-3 grid -rotate-[18deg] place-items-center text-hippy-lilac drop-shadow-[2px_2px_0_#3b2923] max-[980px]:bottom-[4%] max-[980px]:left-[5%] [&>svg]:size-[34px]"><MoonStar/></div>
        <p className={`${eyebrow} relative z-2 text-hippy-rust`}>PIERCING CORNER · PARAÑAQUE</p>
        <h1 className={storyTitle}>A little corner<br/>for your <em>spark.</em></h1>
        <p className="relative z-2 my-6 max-w-[440px] text-sm/[1.75] font-[560] text-[#6e5045]">Choose your piercing, find a real opening, and leave with an appointment already confirmed.</p>
        <div className="relative z-2 flex flex-col gap-[11px] text-[11px] font-[750] max-[980px]:items-center [&_span]:flex [&_span]:items-center [&_span]:gap-[9px] [&_svg]:text-hippy-rust"><span><MapPin size={17}/> Piercing Corner, Parañaque</span><span><Clock3 size={17}/> Asia/Manila appointments</span></div>
        <Image className="absolute right-[-30px] bottom-[-40px] z-1 size-[235px] -rotate-[9deg] rounded-[47%_53%_44%_56%] border-[3px] border-hippy-ink shadow-[9px_9px_0_#3b2923] max-[980px]:right-[-12px] max-[980px]:bottom-[-35px] max-[630px]:right-[2%] max-[630px]:size-[180px]" src="/logo.png" alt="Piercing Corner ear illustration" width={220} height={220} priority/>
      </section>
      <section className={bookingPanel}>
        <div className={`${bookingFormWrap} flex flex-col gap-2.5`}>
          <ol className={bookingSteps} aria-hidden="true">{[1,2,3].map((step) => <li className={`${bookingStepItem} ${step === 1 ? "font-[850] text-hippy-rust" : ""}`} key={step}><span className={`${bookingStepBubble} ${step === 1 ? "bg-hippy-orange text-white" : ""}`}>{step}</span>{step === 1 ? "Services" : step === 2 ? "Schedule" : "Details"}</li>)}</ol>
          <Skeleton className="bg-[#e5c99e]" width={74} height={9}/><Skeleton className="bg-[#e5c99e]" width="62%" height={34}/><Skeleton className="bg-[#e5c99e]" width="78%" height={10}/>
          <div className="mt-3 overflow-hidden rounded-[18px_13px_20px_15px] border-2 border-hippy-ink bg-[#f7dfae] shadow-[3px_3px_0_#3b2923]">
            <div className="border-b border-dashed border-[#ad6b4c] p-[11px]"><Skeleton className="bg-[#e5c99e]" width="100%" height={39}/><div className="mt-[9px] flex gap-1.5"><Skeleton className="bg-[#e5c99e]" width={78} height={28}/><Skeleton className="bg-[#e5c99e]" width={106} height={28}/><Skeleton className="bg-[#e5c99e]" width={86} height={28}/></div></div>
            <div className="grid max-h-[345px] grid-cols-2 gap-2 overflow-hidden p-2.5 max-[630px]:max-h-[390px] max-[630px]:grid-cols-1">{Array.from({ length: 8 }, (_, index) => <div className={`${serviceButton} cursor-default nth-[2n]:bg-[#f6d6c0] nth-[3n]:bg-[#e9dded]`} key={index}><Skeleton className="bg-[#e5c99e]" width={17} height={17} radius="50%"/><span><Skeleton className="bg-[#e5c99e]" width="72%" height={10}/><Skeleton className="bg-[#e5c99e]" width="88%" height={8}/></span><Skeleton className="bg-[#e5c99e]" width={48} height={9}/></div>)}</div>
          </div>
          <Skeleton className="mt-3 ml-auto bg-[#e5c99e]" width={118} height={43}/>
        </div>
      </section>
    </main>
  </div>;
}
