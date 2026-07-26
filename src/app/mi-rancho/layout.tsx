import Link from "next/link";

export default function MiRanchoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aventurea-orange text-[14.5px] font-bold text-zinc-950">
              A
            </span>
            <span className="text-base font-bold text-white">AVENTUREA CR</span>
            <span className="text-zinc-600">/</span>
            <span className="text-[13px] font-light text-zinc-400">
              Publicá tu rancho
            </span>
          </Link>
          <Link
            href="/"
            className="text-[13px] font-bold text-zinc-400 hover:text-aventurea-orange"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
