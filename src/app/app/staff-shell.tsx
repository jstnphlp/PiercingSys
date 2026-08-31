"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { signOut } from "@/app/login/actions";
import type { StaffSession } from "@/lib/auth";
import { allowedViews, resolveStaffView, staffViewIcon, staffViewTitle } from "./view-config";

export function StaffShell({ session, children }: { session: StaffSession; children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const view = resolveStaffView(searchParams.get("view") ?? undefined, session.role);
  return <div className="staff-shell">
    <aside className="staff-sidebar">
      <Link href="/app" className="staff-brand">
        <Image src="/logo.png" alt="" width={48} height={48} priority />
        <span><strong>Piercing Corner</strong><small>STUDIO DESK</small></span>
      </Link>
      <p className="nav-label">Workspace</p>
      <nav>{allowedViews(session.role).map((item) => <Link key={item} href={item === "overview" ? "/app" : `/app?view=${item}`} className={view === item ? "active" : ""}>{staffViewIcon(item)}<span>{item[0].toUpperCase() + item.slice(1)}</span></Link>)}</nav>
      <div className="staff-account">
        <span className="avatar">{initials(session.displayName)}</span>
        <span><strong>{session.displayName}</strong><small>{session.role}</small></span>
        <form action={signOut}><button>Sign out</button></form>
      </div>
    </aside>
    <main className="staff-main">
      <header className="staff-topbar">
        <div><p className="eyebrow">PIERCING CORNER · {session.role.toUpperCase()}</p><h1>{staffViewTitle(view)}</h1></div>
        <div className="top-actions"><Link href="/book" target="_blank" className="btn btn-secondary"><ExternalLink size={15}/> Public booking</Link></div>
      </header>
      <div className="staff-content"><div className="dashboard-content">{children}</div></div>
    </main>
  </div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PC";
}
