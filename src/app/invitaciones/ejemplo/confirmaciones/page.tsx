import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import { IconCamera, IconUsers } from "@/components/icons";

export const metadata: Metadata = {
  title: "Ejemplo: el panel de confirmaciones",
  description:
    "Así ves quién confirmó a tu evento: el total con acompañantes, quién sí va, quién no puede y el álbum con su código QR.",
};

/**
 * El ejemplo PÚBLICO del panel de confirmaciones.
 *
 * El panel de verdad vive en /cuenta/evento/[id] y es privado (pide
 * sesión y ser dueño del evento), así que desde la landing no se
 * puede enseñar: por eso esta copia con datos de mentira. Es estática
 * a propósito — cero consultas, cero sesión, se puede compartir.
 *
 * Si el panel real cambia de forma, esta página queda desactualizada:
 * es el costo de poder mostrarlo sin cuenta. Está marcada como ejemplo
 * en pantalla para que nadie la confunda con su evento.
 */

const CONFIRMADOS = [
  {
    nombre: "Jose Pablo Herrera",
    acompanantes: 2,
    fecha: "30 jul",
    nota: "¡Gracias por la invitación!",
  },
  { nombre: "Daniela Chaves", acompanantes: 1, fecha: "29 jul", nota: null },
  { nombre: "Marcela Vindas", acompanantes: 0, fecha: "28 jul", nota: "Ahí estaré con todo." },
];

const NO_VAN = [{ nombre: "Andrés Mora", fecha: "29 jul", nota: "Ese finde estoy fuera del país." }];

const TOTAL = CONFIRMADOS.reduce((s, c) => s + 1 + c.acompanantes, 0);
const ACOMPANANTES = CONFIRMADOS.reduce((s, c) => s + c.acompanantes, 0);

function Dato({ n, label, fuerte = false }: { n: number; label: string; fuerte?: boolean }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 text-center ${
        fuerte
          ? "border-aventurea-navy bg-aventurea-navy text-white"
          : "border-aventurea-line bg-white text-aventurea-ink"
      }`}
    >
      <p className="text-[26px] font-extrabold leading-none">{n}</p>
      <p
        className={`mt-1.5 text-[11.5px] leading-snug ${
          fuerte ? "text-white/70" : "text-aventurea-ink-soft"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

export default function EjemploConfirmacionesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-aventurea-cream-2">
      <SiteHeader breadcrumb="Ejemplo" />

      <main className="mx-auto w-full max-w-[860px] flex-1 px-5 py-8">
        <Link
          href="/invitaciones#ejemplos"
          className="text-[13px] font-bold text-aventurea-ink-soft hover:text-aventurea-ink"
        >
          ← Volver a los ejemplos
        </Link>

        <div className="mt-3 rounded-2xl border border-aventurea-sky/40 bg-aventurea-sky/10 px-5 py-3.5">
          <p className="text-[13px] leading-relaxed text-aventurea-ink">
            <strong>Esto es un ejemplo</strong> con invitados inventados, para que veas
            cómo se ve tu panel. Con tu invitación, esta pantalla se llena sola cada vez
            que alguien confirma.
          </p>
        </div>

        {/* La ficha del evento */}
        <section className="mt-4 rounded-2xl border border-aventurea-line bg-white p-6">
          <p className="flex items-center gap-2 text-[11px] font-light uppercase tracking-[0.16em] text-aventurea-orange before:block before:h-[1.5px] before:w-[18px] before:bg-aventurea-sky">
            Tu espacio de fiesta
          </p>
          <h1 className="titulo mt-2 text-[26px] text-aventurea-ink sm:text-[30px]">
            Boda de María Jesús &amp; Luis
          </h1>
          <p className="mt-1.5 text-[13px] text-aventurea-ink-soft">
            Sábado 1 de agosto de 2026 · 1:00 p. m. · Hacienda Los Reyes
          </p>
        </section>

        {/* Confirmaciones */}
        <section className="mt-4 rounded-2xl border border-aventurea-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-aventurea-ink">
            <IconUsers className="h-4.5 w-4.5 text-aventurea-orange" /> Confirmaciones
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Dato n={TOTAL} label="personas en total" fuerte />
            <Dato n={CONFIRMADOS.length} label="sí asistirán" />
            <Dato n={ACOMPANANTES} label="acompañantes" />
            <Dato n={NO_VAN.length} label="no podrán ir" />
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-aventurea-ink-soft">
            El total cuenta a cada confirmado con sus acompañantes — es el número que le
            podés dar al catering y al lugar.
          </p>

          <h3 className="mt-6 text-[13px] font-bold text-aventurea-ink">
            Sí asistirán ({CONFIRMADOS.length})
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {CONFIRMADOS.map((c) => (
              <div
                key={c.nombre}
                className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-[13.5px] font-bold text-aventurea-ink">
                    {c.nombre}
                  </span>
                  {c.acompanantes > 0 && (
                    <span className="text-[12px] text-aventurea-ink-soft">
                      +{c.acompanantes} acompañante{c.acompanantes === 1 ? "" : "s"}
                    </span>
                  )}
                  <span className="ml-auto rounded-lg bg-aventurea-green-light px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-aventurea-green">
                    Sí asistirá
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">{c.fecha}</p>
                {c.nota && (
                  <p className="mt-1 text-[12.5px] italic text-aventurea-ink-soft">
                    “{c.nota}”
                  </p>
                )}
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-[13px] font-bold text-aventurea-ink">
            No podrán ir ({NO_VAN.length})
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {NO_VAN.map((c) => (
              <div
                key={c.nombre}
                className="rounded-xl border border-aventurea-line bg-aventurea-cream-2 px-4 py-3"
              >
                <span className="text-[13.5px] font-bold text-aventurea-ink">{c.nombre}</span>
                <p className="mt-0.5 text-[12px] text-aventurea-ink-soft">{c.fecha}</p>
                {c.nota && (
                  <p className="mt-1 text-[12.5px] italic text-aventurea-ink-soft">
                    “{c.nota}”
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* El álbum */}
        <section className="mt-4 rounded-2xl border border-aventurea-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-aventurea-ink">
            <IconCamera className="h-4.5 w-4.5 text-aventurea-orange" /> El álbum del evento
          </h2>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-aventurea-ink-soft">
            Imprimís un código QR y lo ponés en las mesas: tus invitados escanean, ven las
            fotos del evento y suben las suyas sin instalar nada.
          </p>
          <Link
            href="/a/fotos-ejemplo-cumpleanos-star-wars-de-luis-herrera"
            className="mt-4 inline-flex rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
          >
            Ver un álbum de ejemplo →
          </Link>
        </section>

        <div className="mt-8 text-center">
          <Link href="/invitaciones#paquetes" className="btn-naranja">
            Quiero la mía
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
