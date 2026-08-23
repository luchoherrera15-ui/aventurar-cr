import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PaseWallet } from "@/app/lealtad/pase-wallet";

/**
 * LA HOJA DE DEMO POR CATEGORÍA: el dueño de una barbería (o lavacar, o
 * spa…) toca su chip en la landing y se ve — SU tipo de negocio, con
 * una tarjeta de ejemplo, las reglas típicas y la regalía que sus
 * clientes perseguirían. Vender con el producto puesto, no con
 * promesas genéricas.
 *
 * Cada demo declara su MODO, que son los tres que el motor soporta de
 * verdad (0121): sellos, cashback (% de vuelta) y puntos. Así el dueño
 * de un restaurante ve plata devuelta y el de una cafetería ve sellos —
 * no la misma maqueta con otro nombre.
 */

const NAVY_PROFUNDO = "#0a1226";

/* Toda la hoja va sobre navy profundo, así que el azul de acción es el
   de fondo OSCURO (relleno claro, letra navy). El naranja se queda en
   las dos piezas donde marca un logro o el punto del recorrido: el
   disco del paso y los sellos ya conseguidos de la tarjeta. */
const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";
const ACENTO = "var(--orange)";

type Demo = {
  categoria: string;
  negocio: string;
  modo: "sellos" | "cashback" | "puntos";
  etiquetaCampo: string;
  valor: string;
  /** Solo en modo sellos. */
  total?: number;
  logrados?: number;
  /** Solo en cashback/puntos: la línea grande de la tarjeta. */
  detalle?: string;
  regla: string;
  regalia: string;
  pasos: [string, string, string];
  /**
   * La banda del negocio en el pase (el `strip` de Apple).
   * Que un barbero vea una barbería y no un degradado hace la
   * diferencia entre «qué lindo» y «así se me vería a mí».
   */
  foto: string;
  /**
   * Un negocio REAL de esa categoría, ya publicado en Bookea, para
   * quien no se conforma con la maqueta. Solo lo declaran las
   * categorías que tienen uno de verdad: el resto no muestra el
   * enlace en vez de mandar a una página de mentira.
   */
  ejemplo?: { href: string; texto: string };
};

const DEMOS: Record<string, Demo> = {
  restaurantes: {
    categoria: "Restaurantes",
    foto: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=640&q=70",
    negocio: "Restaurante Doña Flor",
    // El caso de % de vuelto: la cuenta varía mucho de mesa a mesa, así
    // que premiar por MONTO es más justo que por visita.
    modo: "cashback",
    etiquetaCampo: "Tu saldo",
    valor: "₡4.250",
    detalle: "5% de cada cuenta vuelve a tu tarjeta",
    regla: "5% de vuelta sobre lo que gastan (vos elegís el porcentaje)",
    regalia: "El saldo se usa como plata en su próxima visita",
    pasos: [
      "El comensal escanea el QR de la mesa una sola vez.",
      "Al pagar, el 5% de la cuenta entra a su tarjeta al instante.",
      "Vuelve a gastarlo con vos: la plata solo vale en tu restaurante.",
    ],
  },
  cafeterias: {
    categoria: "Cafeterías",
    foto: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=640&q=70",
    negocio: "Café La Esquina",
    modo: "sellos",
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
    ejemplo: {
      href: "/restaurantes/cafeoscuro",
      texto: "Ver una cafetería de verdad",
    },
  },
  barberias: {
    categoria: "Barberías",
    foto: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=640&q=70",
    negocio: "Barbería El Patio",
    modo: "sellos",
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
    foto: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=640&q=70",
    negocio: "Salón Karla",
    modo: "sellos",
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
    foto: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=640&q=70",
    negocio: "Spa Serena",
    modo: "puntos",
    etiquetaCampo: "Puntos",
    valor: "3.400",
    detalle: "1 punto por cada ₡100 · masaje a los 5.000",
    regla: "1 punto por cada ₡100 en tratamientos",
    regalia: "Masaje de 30 min al llegar a 5.000 puntos",
    pasos: [
      "Acá conviene puntos por monto: los tratamientos varían de precio.",
      "Cada visita suma según lo que gastó — la tarjeta lleva la cuenta.",
      "El masaje de regalo convierte la visita ocasional en ritual.",
    ],
  },
  gimnasios: {
    categoria: "Gimnasios",
    foto: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=640&q=70",
    negocio: "Gimnasio Fuerza",
    modo: "sellos",
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
    foto: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=640&q=70",
    negocio: "Lavacar El Rayo",
    modo: "sellos",
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
  courier: {
    categoria: "Courier",
    // Autohosteada (banco de franjas de hoy), no un hotlink nuevo — ya
    // verificada a mano sin ninguna marca de otro courier visible.
    foto: "/lealtad/plantillas/franjas/courier-2.jpg",
    negocio: "Envíos Rápido CR",
    modo: "sellos",
    etiquetaCampo: "Envíos",
    valor: "5/8",
    total: 8,
    logrados: 5,
    regla: "1 sello por cada envío",
    regalia: "El octavo envío va gratis",
    pasos: [
      "El cliente escanea el QR al dejar el paquete en el mostrador.",
      "Cada envío suma su sello — sin cartilla de papel que se pierda.",
      "El envío gratis lo hace elegirte a vos antes que a otro courier.",
    ],
  },
};

/** Lo que además puede vivir en la misma tarjeta del cliente. */
const TAMBIEN = [
  {
    titulo: "Gift cards digitales",
    texto:
      "Tu cliente compra una tarjeta de regalo y le llega al Wallet a quien la recibe, lista para usarse.",
  },
  {
    titulo: "Paquetes prepagados",
    texto: "«5 lavados», «10 clases»: cobrás por adelantado y el pase descuenta solo.",
  },
  {
    titulo: "Cupones con vencimiento",
    texto: "«Hace 30 días no venís, tenés 15% off» — con fecha límite, no perdido en un chat.",
  },
];

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

  const total = demo.total ?? 0;
  const columnas = total > 10 ? 6 : 5;

  return (
    <main className="min-h-svh px-5 py-10" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between">
          <Link href="/lealtad" className="text-[12.5px] font-bold text-white/50 hover:text-white">
            ← Volver
          </Link>
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v4.png"
              alt="Bookea"
              width={110}
              height={34}
              className="h-[24px] w-auto"
            />
          </Link>
        </header>

        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
          {/* ── El pitch ── */}
          <div>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
              style={{ background: "rgba(157,180,255,.14)", color: ACCION }}
            >
              Demo · {demo.categoria}
            </span>
            <h1 className="titulo mt-4 text-[clamp(28px,4.5vw,44px)] leading-[1.08] text-white">
              {demo.modo === "cashback"
                ? "Devolveles un % de lo que gastan"
                : `Así podría funcionar en tu ${demo.categoria.toLowerCase().replace(/s$/, "")}`}
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
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-white/45">
                  {demo.modo === "cashback" ? "Qué gana tu cliente" : "La regalía"}
                </p>
                <p className="mt-0.5 text-[13.5px] font-bold text-white">{demo.regalia}</p>
              </div>
            </div>

            <ol className="mt-6 grid gap-3">
              {demo.pasos.map((p, i) => (
                <li key={p} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-white/70">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                    style={{ background: ACENTO, color: "#0a1226" }}
                  >
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/lealtad/crear"
                className="rounded-full px-6 py-3 text-[14px] font-bold transition-transform hover:scale-[1.02]"
                style={{ background: ACCION, color: ACCION_TINTA }}
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

            {/* La prueba de que esto no es una maqueta: un local de la
                misma categoría, publicado y con su carta puesta. Va
                DEBAJO y en texto, no en botón — el llamado comercial
                sigue siendo «Quiero esto en mi negocio». */}
            {demo.ejemplo && (
              <p className="mt-4 text-[13px] text-white/45">
                <Link
                  href={demo.ejemplo.href}
                  className="font-bold text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  {demo.ejemplo.texto} →
                </Link>{" "}
                — ese sí existe, con su carta y sus precios.
              </p>
            )}
          </div>

          {/* ── La tarjeta de ejemplo ── */}
          <div className="mx-auto w-full max-w-[340px]">
            <PaseWallet
              marca="apple"
              negocio={demo.negocio}
              foto={demo.foto}
              etiquetaCampo={demo.etiquetaCampo}
              valorCampo={demo.valor}
              colorFondo={NAVY_PROFUNDO}
              serial="BK · DEMO 0000"
            >
              {demo.modo === "sellos" ? (
                <div
                  className="grid gap-2 pb-1"
                  style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: total }, (_, i) => (
                    /* El sello LOGRADO se queda naranja: acá el color
                       hace trabajo funcional —distingue lleno de
                       vacío— y es, literalmente, lo que el cliente
                       ganó. La palomita va en navy: blanca sobre el
                       naranja da 2,35:1. */
                    <span
                      key={i}
                      className="flex aspect-square items-center justify-center rounded-full"
                      style={
                        i < (demo.logrados ?? 0)
                          ? { background: ACENTO, color: "#0a1226" }
                          : { border: "2px dashed rgba(255,255,255,.3)" }
                      }
                    >
                      {i < (demo.logrados ?? 0) && <Check className="h-3 w-3" />}
                    </span>
                  ))}
                </div>
              ) : (
                /* Cashback y puntos no tienen sellos que dibujar: lo que
                   importa es el saldo y qué se hace con él. */
                <div className="pb-1">
                  <p className="text-[26px] font-extrabold leading-none text-white">{demo.valor}</p>
                  <p className="mt-1.5 text-[11.5px] leading-snug text-white/70">{demo.detalle}</p>
                </div>
              )}
            </PaseWallet>
            <p className="mt-3 text-center text-[11.5px] text-white/40">
              Apple Wallet y Google Wallet — se actualiza sola en cada visita.
            </p>
          </div>
        </div>

        {/* ── Lo que además cabe en la misma tarjeta ── */}
        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
            Y en la misma tarjeta también podés dar
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {TAMBIEN.map((t) => (
              <div
                key={t.titulo}
                className="rounded-2xl border border-white/12 p-4"
                style={{ background: "rgba(255,255,255,.04)" }}
              >
                <p className="text-[13.5px] font-extrabold text-white">{t.titulo}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/55">{t.texto}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Los otros demos ── */}
        <div className="mt-10 border-t border-white/10 pt-8 text-center">
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
                  className="rounded-xl border border-white/15 px-3.5 py-2 text-[12.5px] font-bold text-white/75 transition-colors hover:border-[color:var(--accion-claro)] hover:text-white"
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
