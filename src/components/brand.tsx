import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ href = "/book", compact = false }: { href?: string; compact?: boolean }) {
  return <Link className="inline-flex min-w-0 items-center gap-3" href={href} aria-label="Piercing Corner home">
    <Image className="rounded-full object-cover shadow-[0_0_0_2px_#ffffff55,0_3px_12px_#3a241429]" src="/logo.png" alt="" width={compact ? 42 : 54} height={compact ? 42 : 54} priority />
    <span className="flex min-w-0 flex-col"><strong className={cn("font-display text-[21px]/none font-[650] tracking-[-.5px] whitespace-nowrap max-[640px]:text-lg", compact && "text-[17px]")}>Piercing Corner</strong><small className={cn("mt-[5px] text-[8px] font-extrabold tracking-[2.2px] text-seafoam-dark", compact && "text-[7px]")}>PARAÑAQUE</small></span>
  </Link>;
}
