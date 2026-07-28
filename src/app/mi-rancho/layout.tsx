import Link from "next/link";

export default function MiRanchoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-aventurea-cream">
      <header className="sticky top-0 z-50 border-b border-aventurea-line bg-aventurea-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-5 px-7 py-3.5">
          <Link href="/ranchos-eventos" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- el
                logo oficial es un PNG estático: next/image no aporta
                nada acá. */}
            <img src="/logo-bookea.png" alt="Bookear" className="h-7 w-auto shrink-0" />
            <span className="text-zinc-300">/</span>
            <span className="text-[13px] font-light text-aventurea-ink-soft">
              Publicá tu negocio
            </span>
          </Link>
          <Link
            href="/ranchos-eventos"
            className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-orange"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
