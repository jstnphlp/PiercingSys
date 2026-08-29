"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Clock3, MapPin, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { useState } from "react";

const services = [
  { name: "Lobe piercing", detail: "Single or double", price: "from ₱900", time: "30–45 min" },
  { name: "Ear cartilage", detail: "Helix, flat, conch, rook", price: "from ₱1,400", time: "45 min" },
  { name: "Facial piercing", detail: "Nostril, septum, eyebrow", price: "from ₱1,500", time: "45 min" },
  { name: "Body piercing", detail: "Navel and other placements", price: "from ₱2,200", time: "60 min" },
];

export function BookingForm() {
  const [step, setStep] = useState(1);
  const [service, setService] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/public/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, service }) });
    setBusy(false); if (response.ok) setSubmitted(true);
  }

  if (submitted) return <div className="booking-site"><BookingHeader /><main className="success-card"><span className="success-icon"><Check /></span><p className="eyebrow">REQUEST RECEIVED</p><h1>You’re all set for now.</h1><p>We sent a confirmation to your email. The Aura team will review your preferred schedule and get back to you shortly.</p><div className="reference"><span>Booking reference</span><strong>AUR-0828-1042</strong></div><Link href="/shop/aura-collective/book">Make another request</Link></main></div>;

  return <div className="booking-site">
    <BookingHeader />
    <main className="booking-main">
      <section className="booking-intro"><p className="eyebrow">BOOK AN APPOINTMENT</p><h1>Let’s plan your<br /><em>next piercing.</em></h1><p>Tell us what you have in mind. This is a booking request—our team will confirm your exact schedule by email.</p><div className="studio-facts"><span><MapPin size={16} /> Poblacion, Makati</span><span><Clock3 size={16} /> Tue–Sun, 10 AM–7 PM</span><span><ShieldCheck size={16} /> Safe, private & professional</span></div></section>
      <section className="booking-card">
        <div className="steps"><Step number={1} label="Service" active={step >= 1} current={step === 1} /><i /><Step number={2} label="Schedule" active={step >= 2} current={step === 2} /><i /><Step number={3} label="Your details" active={step >= 3} current={step === 3} /></div>
        {step === 1 && <div className="booking-step"><p className="eyebrow">STEP 1 OF 3</p><h2>What would you like?</h2><p>Choose the option closest to what you have in mind.</p><div className="service-options">{services.map((item) => <button key={item.name} className={service === item.name ? "selected" : ""} onClick={() => setService(item.name)}><span className="radio">{service === item.name && <i />}</span><span><strong>{item.name}</strong><small>{item.detail}</small></span><span><strong>{item.price}</strong><small>{item.time}</small></span></button>)}</div><button className="booking-next" disabled={!service} onClick={() => setStep(2)}>Choose a schedule <ArrowRight size={17} /></button></div>}
        {step === 2 && <div className="booking-step"><p className="eyebrow">STEP 2 OF 3</p><h2>When works for you?</h2><p>Share your preferred window. We’ll confirm the exact time.</p><div className="booking-fields"><label>Preferred date<span><CalendarDays size={17} /><input type="date" defaultValue="2026-09-01" min="2026-08-29" /></span></label><label>Preferred time window<span><Clock3 size={17} /><select defaultValue=""><option value="" disabled>Select a time</option><option>10:00 AM – 12:00 PM</option><option>12:00 PM – 2:00 PM</option><option>2:00 PM – 4:00 PM</option><option>4:00 PM – 6:00 PM</option></select><ChevronDown size={15} /></span></label><label>Preferred piercer (optional)<span><Sparkles size={17} /><select><option>No preference</option><option>Mika</option><option>Aya</option><option>Jules</option></select><ChevronDown size={15} /></span></label></div><div className="booking-buttons"><button className="back" onClick={() => setStep(1)}><ArrowLeft size={16} /> Back</button><button className="booking-next" onClick={() => setStep(3)}>Your details <ArrowRight size={17} /></button></div></div>}
        {step === 3 && <form className="booking-step" onSubmit={submit}><p className="eyebrow">STEP 3 OF 3</p><h2>A little about you</h2><p>We’ll only use these details to manage your booking.</p><div className="booking-fields two-col"><label>First name<input name="firstName" required placeholder="Juan" /></label><label>Last name<input name="lastName" required placeholder="Dela Cruz" /></label><label>Email<input name="email" required type="email" placeholder="juan@email.com" /></label><label>Mobile number<input name="phone" required type="tel" placeholder="09XX XXX XXXX" /></label></div><label className="check-label"><input name="ageConfirmed" type="checkbox" required /><span><Check size={12} /></span>I confirm that I am at least 18 years old. Minors must contact the studio with a parent or legal guardian.</label><label className="notes-label">Anything we should know?<textarea name="notes" placeholder="Placement ideas, allergies, accessibility needs, or questions..." /></label><label className="upload-label"><Upload size={18} /><span><strong>Add a reference photo</strong><small>Optional · JPG or PNG, up to 5 MB</small></span><input name="photo" type="file" accept="image/png,image/jpeg" /></label><div className="booking-buttons"><button type="button" className="back" onClick={() => setStep(2)}><ArrowLeft size={16} /> Back</button><button className="booking-next" disabled={busy}>{busy ? "Sending..." : "Send booking request"} <ArrowRight size={17} /></button></div><small className="privacy-note"><ShieldCheck size={13} /> Your information is private and only visible to the Aura team.</small></form>}
      </section>
    </main>
    <footer className="booking-footer"><span>© 2026 Aura Collective</span><span>Booking powered by <strong>Lobe</strong></span><span><a href="#">Privacy</a><a href="#">Studio policy</a></span></footer>
  </div>;
}

function BookingHeader() { return <header className="booking-header"><Link className="booking-brand" href="/shop/aura-collective/book"><span><Sparkles size={18} /></span><strong>AURA</strong><small>PIERCING COLLECTIVE</small></Link><a href="mailto:hello@aura.ph">Questions? <strong>Talk to us</strong></a></header>; }
function Step({ number, label, active, current }: { number: number; label: string; active: boolean; current: boolean }) { return <div className={`${active ? "active" : ""} ${current ? "current" : ""}`}><span>{active && !current ? <Check size={13} /> : number}</span><small>{label}</small></div>; }
