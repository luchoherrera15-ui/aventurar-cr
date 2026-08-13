import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PaseWallet } from "@/app/lealtad/pase-wallet";

/**
 * LA HOJA DE DEMO POR CATEGORÍA: el dueño de una barbería (o soda, o
 * spa…) toca su chip en la landing y se ve — SU tipo de negocio, con
 * una tarjeta de ejemplo, las reglas típicas y la regalía que sus
 * clientes perseguirían. Vender con el producto puesto, no con
 * promesas genéricas.
 *
 * Todo estático: ocho configuraciones y una sola plantilla.
 */

const NAVY_PROFUNDO = "#0a1226";
const NARANJA = "#ee7420";

type Demo = {
  categoria: string;
  negocio: string;
  etiquetaCampo: string;
  valor: string;
  total: number;
  logrados: number;
  regla: string;
  regalia: string;
  pasos: [string, string, string];
};

const DEMOS: Record<string, Demo> = {
  restaurantes: {
    categoria: "Restaurantes",
    negocio: "Restaurante Doña Flor",
    etiquetaCampo: "Sellos",
    valor: "7/10",
    total: 10,
    logrados: 7,
    regla: "1 sello por visita (o por monto, si preferís)",
    regalia: "Postre de la casa gratis al completar 10",
    pasos: [
      "El comensal escanea el QR de la mesa o del mostrador una sola vez.",
      "Cada visita suma su sello sola — el mesero solo escanea la tarjeta.",
      "A la décima, el postre es gratis: y esa mesa vuelve con amigos.",
    ],
  },
  cafeterias: {
    categoria: "Cafeterías",
    negocio: "Café La Esquina",
    etiquetaCampo: "Sellos",
    valor: "8/10",
    total: 10,
    logrados: 8,
    regla: "1 sello por cada bebida",
    regalia: "La bebida N.º 11 va por la casa",
    pasos: [
      "El cliente agrega la tarjeta a su Wallet con el QR de la barra.",
      "Cada café suma un sello al instante, sin cartón que se pierda.",
      "El café gratis lo trae de vuelta mañana — y su tarjeta se lo recuerda.",
    ],
  },
  sodas: {
    categoria: "Sodas",
    negocio: "Soda La Negrita",
    etiquetaCampo: "Sellos",
    valor: "5/8",
    total: 8,
    logrados: 5,
    regla: "1 sello por casado",
    regalia: "El casado N.º 9 gratis",
    pasos: [
      "El cliente de todos los días por fin tiene su premio por serlo.",
      "La caja escanea la tarjeta al cobrar: dos segundos.",
      "Ocho casados después, el gratis — y la costumbre queda sellada.",
    ],
  },
  barberias: {
    categoria: "Barberías",
    negocio: "Barbería El Patio",
    etiquetaCampo: "Cortes",
    valor: "4/6",
    total: 6,
    logrados: 4,
    regla: "1 sello por corte",
    regalia: "El sexto corte va gratis",
    pasos: [
      "El cliente agrega su tarjeta al Wallet en la primera visita.",
      "Cada corte suma solo — vos seguís con la máquina en la mano.",
      "El corte gratis hace que no pruebe la barbería de la esquina.",
    ],
  },
  salones: {
    categoria: "Salones de belleza",
    negocio: "Salón Karla",
    etiquetaCampo: "Visitas",
    valor: "6/8",
    total: 8,
    logrados: 6,
    regla: "1 sello por servicio",
    regalia: "Manicure gratis al completar 8",
    pasos: [
      "La clienta escanea el QR del mostrador mientras espera.",
      "Uñas, tinte o peinado: cada servicio suma su sello.",
      "La regalía la trae de vuelta el próximo mes, con cita y todo.",
    ],
  },
  spas: {
    categoria: "Spas",
    negocio: "Spa Serena",
    etiquetaCampo: "Puntos",
    valor: "3 400",
    total: 10,
    logrados: 6,
    regla: "1 punto por cada ₡100 en tratamientos",
    regalia: "Masaje de 30 min al llegar a 5 000",
    pasos: [
      "Acá conviene puntos por monto: los tratamientos varían de precio.",
      "Cada visita suma según lo que gastó — la tarjeta lleva la cuenta.",
      "El masaje de regalo convierte la visita ocasional en ritual.",
    ],
  },
  gimnasios: {
    categoria: "Gimnasios",
    negocio: "Gimnasio Fuerza",
    etiquetaCampo: "Check-ins",
    valor: "9/12",
    total: 12,
    logrados: 9,
    regla: "1 sello por visita al gym",
    regalia: "Una semana gratis al completar 12",
    pasos: [
      "El socio escanea al entrar: su asistencia queda en la tarjeta.",
      "Ver el progreso en el teléfono empuja a no cortar la racha.",
      "La semana gratis premia la constancia — y renueva la matrícula.",
    ],
  },
  lavacars: {
    categoria: "Lavacars",
    negocio: "Lavacar El Rayo",
    etiquetaCampo: "Lavados",
    valor: "4/6",
    total: 6,
    logrados: 4,
    regla: "1 sello por lavado completo",
    regalia: "El sexto lavado va gratis",
    pasos: [
      "El cliente escanea el QR de la caseta mientras espera su carro.",
      "Cada lavado suma su sello — sin tarjetitas mojadas en la guantera.",
      "El lavado gratis decide a dónde vuelve el próximo sábado.",
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DEMOS).map((tipo) => ({ tipo }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  const demo = DEMOS[tipo];
  return { title: demo ? `Demo · ${demo.categoria} · Lealtad Bookea` : "Demo · Lealtad" };
}

function Check({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default async function DemoCategoriaPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const demo = DEMOS[tipo];
  if (!demo) notFound();

  const columnas = demo.total > 10 ? 6 : 5;

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad" className="text-[12.5px] font-bold text-white/50 hover:text-white">
            ← Volver
          </Link>
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v3.png"
              alt="Bookea"
              width={110}
              height={28}
              className="h-[24px] w-auto"
            />
          </Link>
        </header>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
          {/* ── El pitch ── */}
          <div>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ background: "rgba(238,116,32,.16)", color: NARANJA }}
            >
              Demo · {demo.categoria}
            </span>
            <h1 className="titulo mt-4 text-[clamp(28px,4.5vw,44px)] leading-[1.08] text-white">
              Así podría funcionar en tu {demo.categoria.toLowerCase().replace(/s$/, "")}
            </h1>
            <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-white/60">
              <strong className="text-white">{demo.negocio}</strong> no existe — es el
              ejemplo. Tu tarjeta llevaría tu nombre, tus colores y tu regalía.
            </p>

            <div className="mt-6 grid gap-2.5">
              <div className="rounded-xl border border-white/12 px-4 py-3" style={{ background: "rgba(255,255,255,.04)" }}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/45">La regla</p>
                <p className="mt-0.5 text-[13.5px] font-bold text-white">{demo.regla}</p>
              </div>
              <div className="rounded-xl border border-white/12 px-4 py-3" style={{ background: "rgba(255,255,255,.04)" }}>
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/45">La regalía</p>
                <p className="mt-0.5 text-[13.5px] font-bold text-white">{demo.regalia}</p>
              </div>
            </div>

            <ol className="mt-6 grid gap-3">
              {demo.pasos.map((p, i) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-white/70">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                    style={{ background: NARANJA }}
                  >
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/lealtad/nuevo"
                className="rounded-full px-6 py-3 text-[14px] font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ background: NARANJA }}
              >
                Quiero esto en mi negocio
              </Link>
              <Link
                href="/lealtad/planes"
                className="rounded-full border border-white/25 px-6 py-3 text-[14px] font-bold text-white/85 hover:border-white/50"
              >
                Ver los paquetes
              </Link>
            </div>
          </div>

          {/* ── La tarjeta de ejemplo ── */}
          <div className="mx-auto w-[min(340px,88vw)]">
            <PaseWallet
              marca="apple"
              negocio={demo.negocio}
              etiquetaCampo={demo.etiquetaCampo}
              valorCampo={demo.valor}
              colorFondo={NAVY_PROFUNDO}
              serial="BK · DEMO 0000"
            >
              <div
                className="grid gap-2 pb-1"
                style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: demo.total }, (_, i) => (
                  <span
                    key={i}
                    className="flex aspect-square items-center justify-center rounded-full text-white"
                    style={
                      i < demo.logrados
                        ? { background: NARANJA }
                        : { border: "2px dashed rgba(255,255,255,.3)" }
                    }
                  >
                    {i < demo.logrados && <Check className="h-3 w-3" />}
                  </span>
                ))}
              </div>
            </PaseWallet>
            <p className="mt-3 text-center text-[11.5px] text-white/40">
              Apple Wallet y Google Wallet — se actualiza sola en cada visita.
            </p>
          </div>
        </div>

        {/* ── Los otros demos ── */}
        <div className="mt-14 border-t border-white/10 pt-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Mirá otro tipo de negocio
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {Object.entries(DEMOS)
              .filter(([slug]) => slug !== tipo)
              .map(([slug, d]) => (
                <Link
                  key={slug}
                  href={`/lealtad/demo/${slug}`}
                  className="rounded-xl border border-white/15 px-3.5 py-2 text-[12.5px] font-bold text-white/75 transition-colors hover:border-[#ee7420] hover:text-white"
                >
                  {d.categoria}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
