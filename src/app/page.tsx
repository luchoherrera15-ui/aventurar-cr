import Link from "next/link";

type ExperienceCard = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  // Reemplazar por: "url(/images/puntaleona.jpg)" / "url(/images/rancho.jpg)"
  // cuando tengamos las fotos reales.
  background: string;
};

const cards: ExperienceCard[] = [
  {
    href: "/puntaleona-web",
    eyebrow: "Casa · Mar · Montaña",
    title: "Paquetes Vacacionales",
    description:
      "Casa privada en Puntaleona, tours en bote, jet ski, CANAM y más.",
    background:
      "linear-gradient(160deg, #101c22 0%, #16302d 45%, #2a2c22 100%)",
  },
  {
    href: "/ranchos-eventos",
    eyebrow: "Directorio nacional",
    title: "Salón para Eventos",
    description:
      "Explorá salones y ranchos para bodas, cumpleaños y eventos corporativos en toda Costa Rica.",
    background:
      "linear-gradient(160deg, #201512 0%, #2e1f14 45%, #1c1712 100%)",
  },
];

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-zinc-950 px-6 py-24 sm:py-32">
      {/* Vignette neutra */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(255,255,255,0.06),transparent)]" />
      {/* Grano sutil */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center sm:mb-20">
          <span className="text-xs font-semibold uppercase tracking-[0.4em] text-zinc-500">
            Costa Rica
          </span>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Aventurea CR
          </h1>
          <p className="mx-auto mt-4 max-w-md text-balance text-lg text-zinc-400">
            Turismo y eventos, en un solo lugar
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative isolate block h-96 overflow-hidden rounded-3xl bg-zinc-900 shadow-xl ring-1 ring-white/10 transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-2xl hover:ring-white/20"
            >
              {/* Glow ambiental sutil, propio del color de cada card */}
              <div
                aria-hidden
                className="absolute -inset-10 -z-10 rounded-[3rem] opacity-15 blur-3xl transition-opacity duration-500 group-hover:opacity-30"
                style={{ backgroundImage: card.background }}
              />

              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: card.background }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/10" />

              <div className="relative z-10 flex h-full flex-col justify-end p-8">
                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">
                  {card.eyebrow}
                </span>
                <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                  {card.title}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
                  {card.description}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white">
                  Explorar
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  >
                    <path
                      d="M4 10h12m0 0-5-5m5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
