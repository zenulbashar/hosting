import Link from "next/link";

export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 1.5L22.5 12L12 22.5L1.5 12L12 1.5Z" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-fg">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">Nimbus</span>
    </Link>
  );
}
