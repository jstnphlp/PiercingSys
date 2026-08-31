import { MoonStar, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoadingStatus, Skeleton } from "@/components/skeleton";

export function LoginPageSkeleton() {
  return <main className="login-page login-page-skeleton" aria-busy="true">
    <LoadingStatus label="Loading staff sign in"/>
    <section className="login-brand-side"><Brand href="/book"/><div><span className="login-moon"><MoonStar/></span><p className="eyebrow">PIERCING CORNER OPERATIONS</p><h2>Calm tools for a busy studio.</h2><p>Appointments, consent, clients, and daily studio work—all in one private space.</p></div><Sparkles className="login-spark"/></section>
    <section className="login-form-side"><div className="login-card login-card-skeleton"><Skeleton width={92} height={9}/><Skeleton width="72%" height={43}/><Skeleton width="94%" height={10}/><Skeleton width="76%" height={10}/><div className="login-fields-skeleton"><Skeleton width="100%" height={45}/><Skeleton width="100%" height={45}/><Skeleton width="100%" height={43} radius={999}/></div><div className="login-divider"><span>or</span></div><Skeleton width="100%" height={45} radius={999}/></div><span className="login-back-skeleton"><Skeleton width={126} height={10}/></span></section>
  </main>;
}
