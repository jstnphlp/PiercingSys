"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { eyebrow } from "@/components/ui/studio-styles";
import type { StaffSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { dashButton } from "./dashboard-styles";
import { allowedViews, resolveStaffView, staffViewIcon, staffViewTitle } from "./view-config";

export function StaffShell({ session, children }: { session: StaffSession; children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const view = resolveStaffView(searchParams.get("view") ?? undefined, session.role);
  return <div className="relative flex h-screen min-h-[620px] gap-[15px] overflow-hidden bg-hippy-sand bg-[radial-gradient(circle_at_1%_90%,#df682c_0_72px,transparent_74px),radial-gradient(circle_at_99%_5%,#785b8e_0_54px,transparent_56px),repeating-radial-gradient(circle_at_11%_8%,transparent_0_19px,#b94d2823_20px_22px,transparent_23px_37px)] p-3.5 text-hippy-ink after:absolute after:bottom-1 after:left-[188px] after:text-[11px] after:tracking-[9px] after:text-[#693e30] after:opacity-72 after:content-['✦__☾__✷'] before:absolute before:right-[31%] before:bottom-[-22px] before:rotate-12 before:text-[104px]/none before:text-[#e46a31] before:opacity-16 before:content-['☼'] max-[760px]:block max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:overflow-visible max-[760px]:p-2.5 max-[760px]:after:hidden max-[450px]:p-[7px]">
    <aside className="relative z-1 flex h-full w-[230px] shrink-0 basis-[230px] flex-col overflow-hidden rounded-[24px_14px_20px_17px] border-2 border-hippy-ink bg-[#f9ecd1] px-3.5 pt-[21px] pb-4 shadow-[6px_6px_0_#3b2923] before:absolute before:bottom-[89px] before:left-[-95px] before:size-[175px] before:rounded-full before:border-20 before:border-hippy-orange before:opacity-13 before:content-[''] after:absolute after:top-[18px] after:right-[21px] after:rotate-[14deg] after:text-[17px] after:text-hippy-rust after:content-['✦'] max-[1100px]:w-[214px] max-[1100px]:basis-[214px] max-[760px]:relative max-[760px]:mb-3 max-[760px]:h-auto max-[760px]:w-full max-[760px]:p-[13px] max-[760px]:shadow-[4px_4px_0_#3b2923] max-[760px]:before:hidden">
      <Link href="/app" className="relative z-1 flex items-center gap-2.5 px-2 pb-[27px]">
        <Image className="size-[42px] -rotate-6 rounded-[50%_43%_55%_46%] border-2 border-hippy-ink bg-hippy-orange shadow-[3px_3px_0_#3b2923] max-[450px]:size-[38px]" src="/logo.png" alt="" width={48} height={48} priority />
        <span className="flex flex-col"><strong className="font-display text-lg/none font-[750] text-hippy-ink">Piercing Corner</strong><small className="mt-[3px] text-[7px] font-black tracking-[1.8px] text-hippy-rust">STUDIO DESK</small></span>
      </Link>
      <p className="relative z-1 mx-3 my-[9px] text-[8px] font-extrabold tracking-[1.4px] text-[#9a5a40] uppercase max-[760px]:hidden">Workspace</p>
      <nav className="relative z-1 flex flex-col gap-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[760px]:flex-row max-[760px]:overflow-x-auto max-[760px]:px-px max-[760px]:pt-0.5 max-[760px]:pb-[5px]">{allowedViews(session.role).map((item) => <Link key={item} href={item === "overview" ? "/app" : `/app?view=${item}`} className={cn("flex min-h-[42px] items-center gap-3 rounded-[12px_9px_13px_10px] border border-transparent px-3 text-[11px] font-[750] text-[#6f5148] transition motion-reduce:transition-none hover:translate-x-0.5 hover:border-[#d9a17d] hover:bg-[#fff6df] hover:text-hippy-ink max-[760px]:min-w-max max-[760px]:min-h-[37px] max-[450px]:px-2.5 [&_svg]:w-[17px]", view === item && "-rotate-[.25deg] border-2 border-hippy-ink bg-hippy-orange text-[#fff8e6] shadow-[3px_3px_0_#3b2923] max-[760px]:shadow-[2px_2px_0_#3b2923]")}>{staffViewIcon(item)}<span>{item[0].toUpperCase() + item.slice(1)}</span></Link>)}</nav>
      <div className="relative z-1 mt-auto grid grid-cols-[38px_1fr] items-center gap-[9px] rounded-[15px_11px_14px_12px] border-[1.5px] border-hippy-ink bg-[#fff7e7] p-3 shadow-[3px_3px_0_#d59a72] before:absolute before:top-[5px] before:right-[9px] before:text-[11px] before:text-[#9a5f39] before:content-['☾'] max-[760px]:hidden">
        <span className="grid size-[38px] place-items-center rounded-[50%_42%_50%_45%] border-2 border-hippy-ink bg-hippy-lilac text-[10px] font-extrabold text-hippy-ink shadow-[2px_2px_0_#3b2923]">{initials(session.displayName)}</span>
        <span className="flex min-w-0 flex-col"><strong className="overflow-hidden text-[11px] text-ellipsis whitespace-nowrap text-hippy-ink">{session.displayName}</strong><small className="mt-0.5 text-[9px] text-[#866456] capitalize">{session.role}</small></span>
        <form className="col-span-2" action={signOut}><button className="w-full rounded-lg border border-[#cb8d68] bg-[#f8d8b2] p-2 text-[9px] font-extrabold text-[#773e2b] hover:bg-[#f2c590]">Sign out</button></form>
      </div>
    </aside>
    <main className="relative z-1 m-0 h-full min-w-0 flex-1 overflow-auto rounded-[18px_26px_17px_23px] border-2 border-hippy-ink bg-hippy-cream bg-[radial-gradient(circle_at_96%_0,#df682c3d_0_122px,transparent_124px),radial-gradient(circle_at_91%_1%,#785b8e35_0_92px,transparent_94px),linear-gradient(120deg,transparent_0_73%,#efb9a128_73%_75%,transparent_75%)] shadow-[7px_7px_0_#3b2923] [scrollbar-width:none] before:pointer-events-none before:absolute before:top-[73px] before:right-[37px] before:text-[13px] before:tracking-[8px] before:text-[#cc5834] before:opacity-76 before:content-['✷__✦__☼'] [&::-webkit-scrollbar]:hidden max-[1100px]:before:right-[25px] max-[760px]:h-auto max-[760px]:min-h-[calc(100vh-110px)] max-[760px]:w-full max-[760px]:overflow-visible max-[760px]:rounded-[16px_21px_15px_19px] max-[760px]:shadow-[4px_4px_0_#3b2923] max-[760px]:before:hidden">
      <header className="relative flex min-h-[92px] items-center justify-between bg-transparent px-[clamp(24px,4vw,52px)] py-[17px] after:absolute after:right-[clamp(24px,4vw,52px)] after:bottom-0 after:left-[clamp(24px,4vw,52px)] after:h-0.5 after:bg-[repeating-linear-gradient(90deg,#c9825a_0_8px,transparent_8px_14px)] after:opacity-72 after:content-[''] max-[760px]:min-h-[78px] max-[760px]:px-[17px] max-[760px]:after:right-[17px] max-[760px]:after:left-[17px]">
        <div><p className={`${eyebrow} mb-[3px] text-[8px] text-hippy-rust`}>PIERCING CORNER · {session.role.toUpperCase()}</p><h1 className="m-0 font-display text-[28px] font-[760] tracking-[-.7px] text-hippy-ink max-[760px]:text-[21px]">{staffViewTitle(view)}</h1></div>
        <div className="flex gap-2.5"><Link href="/book" target="_blank" className={`${dashButton({ variant: "secondary" })} min-h-[38px] text-[10px] max-[760px]:w-9 max-[760px]:p-0 max-[760px]:text-[0px]`}><ExternalLink size={15}/> Public booking</Link></div>
      </header>
      <div className="mx-auto max-w-[1450px] px-[clamp(22px,4vw,52px)] pt-[30px] pb-[72px] max-[1100px]:px-[25px] max-[760px]:px-[15px] max-[760px]:pt-[25px] max-[760px]:pb-[58px]"><div>{children}</div></div>
    </main>
  </div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "PC";
}
