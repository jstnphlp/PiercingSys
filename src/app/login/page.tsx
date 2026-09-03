import type { Metadata } from "next";
import { MoonStar, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { eyebrow } from "@/components/ui/studio-styles";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";
import { loginBrandCopy, loginBrandSide, loginFormSide, loginPage } from "./login-styles";

export const metadata: Metadata = { title: "Staff sign in" };

export default function LoginPage() {
  return <main className={loginPage}>
    <section className={loginBrandSide}><Brand href="/book" /><div className={loginBrandCopy}><span className="mb-7 grid size-[58px] place-items-center rounded-full bg-white/25 max-[820px]:hidden"><MoonStar /></span><p className={`${eyebrow} eyebrow`}>PIERCING CORNER OPERATIONS</p><h2>Calm tools for a busy studio.</h2><p>Appointments, consent, clients, and daily studio work—all in one private space.</p></div><Sparkles className="absolute top-1/5 right-[17%] size-[46px] text-marigold" /></section>
    <section className={loginFormSide}><LoginForm googleEnabled={env.googleOAuthEnabled} appUrl={env.appUrl} /><a href="/book">← Back to public booking</a></section>
  </main>;
}
