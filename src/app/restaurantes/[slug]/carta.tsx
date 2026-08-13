import Image from "next/image";
import Link from "next/link";
import { Cormorant_Garamond } from "next/font/google";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import VisitasPagina from "@/components/visitas-pagina";
import { IconCafe, IconPin, IconStar } from "@/components/icons";
import { DIAS_SEMANA_LABEL, horaBonita } from "@/app/citas/tipos";
import AccionesLocal from "./acciones-local";
import {
  CATEGORIA_RESTAURANTE_LABEL,
  RANGO_PRECIO_LABEL,
  anclaDeSeccion,
  horarioDeDetalles,
  type CategoriaRestaurante,
  type ItemMenu,
  type OpcionesRestaurante,
} from "../tipos";

/**
 * EL TEMA "CARTA": la ficha de un local que vive de que su menú se vea
 * caro — una cafetería de especialidad, una cocina de autor.
 *
 * No es el tema de siempre con otro color. Lo que hace que una carta
 * se lea cara son cuatro decisiones, y todas van en contra de lo que
 * pide un directorio:
 *
 *   1. UNA COLUMNA angosta (max-w 720px). El tema estándar pone el
 *      menú en dos columnas porque su trabajo es que quepa; una carta
 *      de verdad se lee en una sola línea de lectura, aunque haya que
 *      bajar más.
 *   2. SIN CAJAS. Cada plato del tema estándar es una tarjeta con
 *      borde: veinte bordes seguidos se ven como una lista de precios
 *      de ferretería. Acá los platos son texto sobre papel, separados
 *      por aire.
 *   3. SERIF PARA LOS NOMBRES. Cormorant en los nombres de los platos
 *      y sans para las descripciones: el contraste de familias es lo
 *      que da el aire editorial. Es la MISMA serif de las invitaciones
 *      y del álbum, así que no entra una tipografía nueva al sitio.
 *   4. PRECIOS PEGADOS AL BORDE DERECHO, sin puntitos de relleno. El
 *      borde común los alinea solo; los puntitos son de menú de soda.
 *
 * La paleta es de café, no la de marca: papel tostado (#f7f2ea), tinta
 * casi negra (#1c1512) y latón (#8a5a2b / #d9a86a sobre oscuro). El
 * navy de Bookea se queda en el header y el pie — el local manda en su
 * propia página, la plataforma no.
 *
 * Se llega acá por DATOS (`detalles.tema_ficha = "carta"`), nunca por
 * slug: cualquier otro local puede pedirlo sin tocar código.
 */

// Solo 400 y 600: los nombres de los platos van en regular y los
// títulos grandes en semibold. Pedir la familia entera serían ~4
// archivos de fuente que ningún texto de esta página usa.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
});

/** El local, con lo que la carta necesita mostrar. */
type LocalCarta = {
  id: string;
  nombre: string;
  descripcion: string | null;
  descripcion_larga: string | null;
  foto_url: string | null;
  direccion_exacta: string | null;
  contacto_whatsapp: string | null;
  detalles: unknown;
};

export default function FichaCarta({
  local,
  categoria,
  opciones,
  secciones,
  calificacion,
  ubicacion,
  hrefMaps,
  hrefWaze,
  conBurbujaChat,
}: {
  local: LocalCarta;
  categoria: CategoriaRestaurante;
  opciones: OpcionesRestaurante;
  secciones: [string, ItemMenu[]][];
  calificacion: { promedio: number; total: number } | null;
  ubicacion: string;
  hrefMaps: string | null;
  hrefWaze: string | null;
  /** La burbuja de chat, ya decidida por la página (no mira sesión acá). */
  conBurbujaChat: React.ReactNode;
}) {
  const horario = horarioDeDetalles(local.detalles);
  // La barra de secciones solo se gana su lugar si hay a dónde saltar.
  const conIndice = secciones.length > 1;

  return (
    <div className="min-h-screen bg-[#f7f2ea]">
      {conBurbujaChat}
      <SiteHeader breadcrumb="Restaurantes" />

      {/* ── La portada ────────────────────────────────────────────
          A sangre y oscura. Es lo único grande de la página: si la
          foto del local es buena, vende sola; si no hay foto, queda
          el papel tostado con la taza, que es mejor que una foto
          mala estirada. */}
      <header className="relative isolate overflow-hidden bg-[#1c1512]">
        {local.foto_url ? (
          <>
            <Image
              src={local.foto_url}
              alt=""
              fill
              priority
              // A sangre en cualquier pantalla: sin esto Next serviría
              // el candidato de 640px en un monitor de 1440.
              sizes="100vw"
              // 60 porque va debajo de un velo al 70%: la diferencia
              // con 75 no se ve y pesa ~30% menos.
              quality={60}
              className="object-cover"
            />
            {/* El velo. Es lo que garantiza el contraste del nombre
                sin depender de cómo sea la foto que suba el local. */}
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#1c1512]/72 via-[#1c1512]/62 to-[#1c1512]/92"
              aria-hidden="true"
            />
          </>
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center text-[#d9a86a]/20"
            aria-hidden="true"
          >
            <IconCafe className="h-40 w-40" />
          </span>
        )}

        <div className="relative mx-auto flex min-h-[62svh] max-w-[860px] flex-col items-center justify-end px-5 pb-14 pt-20 text-center sm:min-h-[70svh] sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d9a86a]">
            {CATEGORIA_RESTAURANTE_LABEL[categoria]}
            {opciones.rangoPrecio ? ` · ${RANGO_PRECIO_LABEL[opciones.rangoPrecio]}` : ""}
          </p>

          <h1
            className={`${cormorant.className} mt-4 text-[clamp(42px,11vw,86px)] font-normal leading-[0.95] tracking-[-0.01em] text-[#f7f2ea]`}
          >
            {local.nombre}
          </h1>

          {local.descripcion && (
            <p className="mt-5 max-w-[52ch] text-[14.5px] leading-relaxed text-[#e4d8ca]">
              {local.descripcion}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-[#c9bcb1]">
            {ubicacion && (
              <span className="flex items-center gap-1.5">
                <IconPin className="h-4 w-4 text-[#d9a86a]" />
                {ubicacion}
              </span>
            )}
            {calificacion && (
              <span className="flex items-center gap-1.5">
                <IconStar className="h-4 w-4 text-[#d9a86a]" />
                <strong className="font-semibold text-[#f7f2ea]">
                  {Number(calificacion.promedio).toFixed(1)}
                </strong>
                ({calificacion.total})
              </span>
            )}
          </div>

          <AccionesLocal
            ranchoId={local.id}
            nombre={local.nombre}
            whatsapp={local.contacto_whatsapp}
            opciones={opciones}
            tema="carta"
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          />
        </div>
      </header>

      {/* ── El índice de la carta ─────────────────────────────────
          Pegajoso bajo el header (que mide 64px fijos, h-16). En el
          teléfono es la diferencia entre encontrar la repostería y
          hacer scroll a ciegas parado en la puerta. Son anclas: cero
          JavaScript, funciona con la página a medio cargar. */}
      {conIndice && (
        <nav
          aria-label="Secciones de la carta"
          className="sticky top-16 z-30 border-b border-[#1c1512]/12 bg-[#f7f2ea]/95 backdrop-blur"
        >
          <ul className="mx-auto flex max-w-[880px] gap-6 overflow-x-auto px-5 py-3.5 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#6b5b4e] [-ms-overflow-style:none] [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden">
            {secciones.map(([seccion]) => (
              <li key={seccion} className="shrink-0">
                <a
                  href={`#${anclaDeSeccion(seccion)}`}
                  className="rounded-sm transition-colors hover:text-[#1c1512] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a5a2b]"
                >
                  {seccion}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main className="mx-auto max-w-[720px] px-5 sm:px-8">
        <VisitasPagina ranchoId={local.id} className="mt-8 flex justify-center" />

        {/* ── La historia del local ───────────────────────────────
            El texto largo del negocio, que el tema estándar ni lee.
            Acá es media página: es lo que separa "una cafetería" de
            "esta cafetería". */}
        {local.descripcion_larga && (
          <section className="border-b border-[#1c1512]/10 py-14 text-center">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8a5a2b]">
              La casa
            </h2>
            <p
              className={`${cormorant.className} mx-auto mt-5 max-w-[46ch] text-[clamp(19px,2.6vw,23px)] leading-[1.55] text-[#1c1512]`}
            >
              {local.descripcion_larga}
            </p>
          </section>
        )}

        {/* ── La carta ────────────────────────────────────────────── */}
        <section className="py-14">
          <h2
            className={`${cormorant.className} text-center text-[clamp(34px,7vw,52px)] font-normal leading-none text-[#1c1512]`}
          >
            La carta
          </h2>

          {secciones.length === 0 ? (
            <p className="mx-auto mt-8 max-w-[44ch] text-center text-[14px] leading-relaxed text-[#6b5b4e]">
              Todavía no está publicada. Escribinos y te contamos qué hay hoy.
            </p>
          ) : (
            <div className="mt-12 space-y-14">
              {secciones.map(([seccion, platos]) => (
                <section
                  key={seccion}
                  id={anclaDeSeccion(seccion)}
                  // Los 128px son el header (64) + la barra de
                  // secciones: sin esto el ancla deja el título justo
                  // debajo de las dos barras pegajosas.
                  className={conIndice ? "scroll-mt-32" : "scroll-mt-20"}
                >
                  <h3 className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8a5a2b]">
                    <span className="shrink-0">{seccion}</span>
                    <span className="h-px flex-1 bg-[#1c1512]/15" aria-hidden="true" />
                  </h3>

                  <ul className="mt-7 space-y-7">
                    {platos.map((p) => (
                      <li key={p.id} className="flex items-start gap-4">
                        {p.foto_url && (
                          <Image
                            src={p.foto_url}
                            alt=""
                            width={56}
                            height={56}
                            className="h-14 w-14 shrink-0 rounded-sm object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          {/* `justify-between` es lo que alinea los
                              precios: quedan todos pegados al mismo
                              borde derecho sin una sola guía de
                              puntitos. */}
                          <div className="flex items-baseline justify-between gap-5">
                            <h4
                              className={`${cormorant.className} text-[21px] font-normal leading-tight text-[#1c1512]`}
                            >
                              {p.nombre}
                            </h4>
                            {p.precio != null && (
                              <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[#1c1512]">
                                ₡{Number(p.precio).toLocaleString("es-CR")}
                                {p.unidad && (
                                  <span className="ml-1.5 text-[11px] font-normal normal-case text-[#6b5b4e]">
                                    {p.unidad}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          {p.descripcion && (
                            <p className="mt-1.5 max-w-[56ch] text-[13px] leading-relaxed text-[#6b5b4e]">
                              {p.descripcion}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Cómo llegar y a qué hora ──────────────────────────────
          El cierre en oscuro: cierra la página con el mismo peso con
          que abrió y deja la información práctica donde uno la busca
          — al final, después de decidir. */}
      <section className="bg-[#1c1512] px-5 py-16 text-[#e4d8ca] sm:px-8">
        <div className="mx-auto grid max-w-[720px] gap-10 sm:grid-cols-2">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d9a86a]">
              Dónde estamos
            </h2>
            {(local.direccion_exacta || ubicacion) && (
              <p className="mt-4 max-w-[38ch] text-[14px] leading-relaxed">
                {local.direccion_exacta}
                {local.direccion_exacta && ubicacion ? <br /> : null}
                {ubicacion}
              </p>
            )}
            {(hrefMaps || hrefWaze) && (
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] font-semibold uppercase tracking-[0.14em]">
                {hrefMaps && (
                  <a
                    href={hrefMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#d9a86a] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a86a]"
                  >
                    Google Maps →
                  </a>
                )}
                {hrefWaze && (
                  <a
                    href={hrefWaze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#d9a86a] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a86a]"
                  >
                    Waze →
                  </a>
                )}
              </div>
            )}
          </div>

          {horario && (
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d9a86a]">
                Horario
              </h2>
              <dl className="mt-4 space-y-1.5 text-[13.5px]">
                {DIAS_SEMANA_LABEL.map((dia, dow) => {
                  const d = horario[String(dow)];
                  return (
                    <div key={dia} className="flex items-baseline justify-between gap-5">
                      <dt>{dia}</dt>
                      <dd className="tabular-nums text-[#c9bcb1]">
                        {d ? `${horaBonita(d.abre)} – ${horaBonita(d.cierra)}` : "Cerrado"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}
        </div>

        <p className="mx-auto mt-12 max-w-[720px] text-[12px] text-[#8d7f74]">
          <Link
            href="/restaurantes"
            className="underline-offset-4 hover:text-[#e4d8ca] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a86a]"
          >
            ← Todos los restaurantes en Bookea
          </Link>
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}
