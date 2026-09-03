import { MoonStar, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoadingStatus, Skeleton } from "@/components/skeleton";
import { eyebrow } from "@/components/ui/studio-styles";
import { loginBrandCopy, loginBrandSide, loginCard, loginDivider, loginFormSide, loginPage } from "./login-styles";

export function LoginPageSkeleton() {
  return <main className={loginPage} aria-busy="true">
    <LoadingStatus label="Loading staff sign in"/>
    <section className={loginBrandSide}><Brand href="/book"/><div className={loginBrandCopy}><span className="mb-7 grid size-[58px] place-items-center rounded-full bg-white/25 max-[820px]:hidden"><MoonStar/></span><p className={`${eyebrow} eyebrow`}>PIERCING CORNER OPERATIONS</p><h2>Calm tools for a busy studio.</h2><p>Appointments, consent, clients, and daily studio work—all in one private space.</p></div><Sparkles className="absolute top-1/5 right-[17%] size-[46px] text-marigold"/></section>
    <section className={loginFormSide}><div className={`${loginCard} flex flex-col gap-3`}><Skeleton className="bg-[#e4d8c6]" width={92} height={9}/><Skeleton className="bg-[#e4d8c6]" width="72%" height={43}/><Skeleton className="bg-[#e4d8c6]" width="94%" height={10}/><Skeleton className="bg-[#e4d8c6]" width="76%" height={10}/><div className="mt-3.5 flex flex-col gap-[15px]"><Skeleton className="bg-[#e4d8c6]" width="100%" height={45}/><Skeleton className="bg-[#e4d8c6]" width="100%" height={45}/><Skeleton className="bg-[#e4d8c6]" width="100%" height={43} radius={999}/></div><div className={loginDivider}><span>or</span></div><Skeleton className="bg-[#e4d8c6]" width="100%" height={45} radius={999}/></div><span className="mt-6"><Skeleton className="bg-[#e4d8c6]" width={126} height={10}/></span></section>
  </main>;
}
