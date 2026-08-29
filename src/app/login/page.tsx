import type { Metadata } from "next";
import { MoonStar, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { env } from "@/lib/env";
import { LoginForm } from "./login-form";
import "./login.css";

export const metadata: Metadata = { title: "Staff sign in" };

export default function LoginPage() {
  return <main className="login-page">
    <section className="login-brand-side"><Brand href="/book" /><div><span className="login-moon"><MoonStar /></span><p className="eyebrow">PIERCING CORNER OPERATIONS</p><h2>Calm tools for a busy studio.</h2><p>Appointments, consent, clients, and daily studio work—all in one private space.</p></div><Sparkles className="login-spark" /></section>
    <section className="login-form-side"><LoginForm googleEnabled={env.googleOAuthEnabled} appUrl={env.appUrl} /><a href="/book">← Back to public booking</a></section>
  </main>;
}
