import Image from "next/image";
import Link from "next/link";

export function Brand({ href = "/book", compact = false }: { href?: string; compact?: boolean }) {
  return <Link className={`pc-brand ${compact ? "compact" : ""}`} href={href} aria-label="Piercing Corner home">
    <Image src="/logo.png" alt="" width={compact ? 42 : 54} height={compact ? 42 : 54} priority />
    <span><strong>Piercing Corner</strong><small>PARAÑAQUE</small></span>
  </Link>;
}
