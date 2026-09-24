import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { TITULO_GRANDE, VerMas } from "@/components/home/plataforma/piezas";
import CuatroProductos from "@/components/home/plataforma/cuatro-productos";
import VariantePestanas from "@/components/home/plataforma/variante-pestanas";
import {
  VarianteB,
  VarianteD,
} from "@/components/home/plataforma/variantes-mockup";
import { PRODUCTOS } from "@/lib/productos";
import { CarruselVivo, PorRubro } from "./carrusel-vivo";
import Home21 from "./home-21";
import {
  Acciones,
  Ancho,
  CUATRO,
  HeroeCentrado,
  HeroeIzquierda,
  Rotulo,
  Shell,
  TarjetaProducto,
} from "./piezas-vivo";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LAS VEINTE PORTADAS, A TAMAÑO REAL
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «mostrame los ejemplos pero 100 %
 * funcionales, o sea cómo se verían exactamente».
 *
 * Cada entrada de `HOMES` es una portada completa: header, héroe,
 * cuerpo y pie. Los mockups son los de producción —el pase lo monta
 * `VistaPase`, las dos demos corren solas— y el texto sale de
 * `productos.ts`. Lo único que cambia entre una y otra es la
 * composición.
 *
 * ── LAS TRES QUE YA EXISTÍAN NO SE VOLVIERON A ESCRIBIR ─────────────
 *
 * 01 monta `CuatroProductos` (lo que hay hoy en el home), 02 monta
 * `VarianteB` y 06 `VarianteD`. Reescribirlas habría creado una
 * segunda versión de cada una destinada a despegarse de la primera.
 *
 * ⚠️ Carpeta desechable: cuando el dueño elija, esa portada se muda al
 * home de verdad y `src/app/prueba-home/` se borra entera.
 */

export type HomeVivo = {
  n: string;
  nombre: string;
  /** Una línea para el rótulo flotante de la vista a tamaño real. */
  idea: string;
  vista: ReactNode;
};

/** El bloque de sección estándar de las portadas. */
function Bloque({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`py-14 sm:py-20 ${className}`}>{children}</div>;
}

export const HOMES: HomeVivo[] = [
  // ══ 01 ═════════════════════════════════════════════════════════
  {
    n: "01",
    nombre: "Centrado clásico",
    idea: "Titular al medio, cuatro teléfonos iguales debajo.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado />
          <div className="mt-16 sm:mt-20">
            <CuatroProductos />
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 02 ═════════════════════════════════════════════════════════
  {
    n: "02",
    nombre: "Bento asimétrico",
    idea: "Cuatro cajas de distinto tamaño: el pase manda, el menú se estira.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado />
          <div className="mt-16 sm:mt-20">
            <VarianteB />
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 03 ═════════════════════════════════════════════════════════
  {
    n: "03",
    nombre: "Partido en dos",
    idea: "Texto a la izquierda, un mockup grande a la derecha; el resto abajo.",
    vista: (
      <Shell>
        <Ancho className="pt-12 sm:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] [&>*]:min-w-0">
            <HeroeIzquierda />
            <div
              aria-hidden
              className="mx-auto flex h-[470px] w-full max-w-[360px] select-none items-center justify-center"
            >
              <div className="w-full">{CUATRO[1].visual}</div>
            </div>
          </div>
        </Ancho>
        <Ancho>
          <Bloque>
            <div className="grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
              {CUATRO.filter((p) => p.id !== "lealtad").map((p) => (
                <TarjetaProducto key={p.id} p={p} alto={250} />
              ))}
            </div>
          </Bloque>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 04 ═════════════════════════════════════════════════════════
  {
    n: "04",
    nombre: "Uno manda, tres acompañan",
    idea: "Un producto se lleva el ancho entero; los otros tres van chicos.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado />

          <div className="mt-14 rounded-[24px] border border-[color:var(--linea)] bg-[color:var(--superficie)] p-6 sm:p-10">
            <div className="grid items-center gap-10 lg:grid-cols-2 [&>*]:min-w-0">
              <div aria-hidden className="mx-auto w-full max-w-[380px] select-none">
                {CUATRO[3].visual}
              </div>
              <div className="text-left">
                <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
                  Lo que más te va a mover la aguja
                </p>
                <h2 className="titulo mt-3 text-[clamp(26px,3.4vw,38px)] text-[color:var(--tinta)]">
                  {CUATRO[3].nombre}
                </h2>
                <p className="mt-3 max-w-[42ch] text-[17px] leading-relaxed text-[color:var(--tinta-suave)]">
                  {CUATRO[3].promesa}
                </p>
                <ul className="mt-5 space-y-2">
                  {CUATRO[3].incluye.map((l) => (
                    <li key={l} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[11px] font-extrabold text-[color:var(--ok)]"
                      >
                        ✓
                      </span>
                      <span className="text-[14.5px] leading-snug text-[color:var(--tinta-suave)]">
                        {l}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href={CUATRO[3].verMas} className="group mt-6 inline-block">
                  <VerMas />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
            {CUATRO.filter((p) => p.id !== "marketplace").map((p) => (
              <TarjetaProducto key={p.id} p={p} alto={230} compacta />
            ))}
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 05 ═════════════════════════════════════════════════════════
  {
    n: "05",
    nombre: "Conmutador de pestañas",
    idea: "Un escenario grande y cuatro pestañas que lo cambian.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado />
          <div className="mt-14">
            <VariantePestanas
              paneles={CUATRO.map((p) => ({
                titulo: p.nombre,
                resumen: p.promesa,
                pieza: p.visual,
              }))}
            />
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 06 ═════════════════════════════════════════════════════════
  {
    n: "06",
    nombre: "Filas alternadas",
    idea: "Cada producto se lleva una banda entera, cambiando de lado.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado />
          <div className="mt-16">
            <VarianteD />
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 07 ═════════════════════════════════════════════════════════
  {
    n: "07",
    nombre: "Collage de pantallas",
    idea: "Las cuatro piezas superpuestas en abanico, como Linear o Framer.",
    vista: (
      <Shell>
        <Ancho className="pb-24 pt-12 sm:pt-16">
          <HeroeCentrado />
          {/* El abanico: rotaciones chicas y solapamiento negativo. La
              del medio va al frente y derecha — es la que se lee. */}
          <div
            aria-hidden
            className="mt-16 hidden select-none items-center justify-center lg:flex"
          >
            <div className="w-[300px] -rotate-6 opacity-70 blur-[0.4px]">
              {CUATRO[0].visual}
            </div>
            <div className="z-20 -mx-12 w-[340px] drop-shadow-[0_24px_60px_rgba(20,22,26,0.18)]">
              {CUATRO[1].visual}
            </div>
            <div className="z-10 w-[320px] rotate-3">{CUATRO[3].visual}</div>
          </div>
          {/* En pantalla chica el abanico no cabe: se apila. */}
          <div aria-hidden className="mt-12 space-y-6 select-none lg:hidden">
            <div className="mx-auto w-full max-w-[340px]">{CUATRO[1].visual}</div>
            <div className="mx-auto w-full max-w-[340px]">{CUATRO[0].visual}</div>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PRODUCTOS.map((p) => (
              <Link
                key={p.id}
                href={p.verMas}
                className="text-[15px] font-extrabold text-[color:var(--tinta)] underline decoration-[color:var(--linea)] decoration-2 underline-offset-4 hover:decoration-[color:var(--acento)]"
              >
                {p.nombre}
              </Link>
            ))}
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 08 ═════════════════════════════════════════════════════════
  {
    n: "08",
    nombre: "Pantalla de escritorio",
    idea: "Un navegador grande en vez de teléfonos: esto es una herramienta de trabajo.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado bajada="Tu panel, abierto en la compu del negocio. Todo lo que pasa, en una pantalla." />

          <div
            aria-hidden
            className="mt-14 select-none overflow-hidden rounded-[16px] border border-[color:var(--linea)] bg-[color:var(--superficie)] shadow-[0_28px_70px_-30px_rgba(20,22,26,0.35)]"
          >
            {/* La barra del navegador: tres puntos y la dirección. */}
            <div className="flex items-center gap-3 border-b border-[color:var(--linea)] bg-[color:var(--superficie-2)] px-4 py-2.5">
              <span className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2.5 w-2.5 rounded-full bg-[color:var(--linea)]"
                  />
                ))}
              </span>
              <span className="mx-auto rounded-full bg-[color:var(--papel)] px-4 py-1 text-[11.5px] text-[color:var(--tinta-suave)]">
                bookea.lat/solutions/panel
              </span>
            </div>

            <div className="grid gap-0 bg-[color:var(--papel)] sm:grid-cols-[180px_minmax(0,1fr)]">
              {/* El menú lateral */}
              <div className="hidden border-r border-[color:var(--linea)] p-4 sm:block">
                {["Inicio", "Mi página", "Menú", "Pedidos", "Lealtad", "Instagram"].map(
                  (s, i) => (
                    <p
                      key={s}
                      className={`mb-1 rounded-[8px] px-3 py-2 text-[13px] font-extrabold ${
                        i === 4
                          ? "bg-[color:var(--acento-suave)] text-[color:var(--acento)]"
                          : "text-[color:var(--tinta-suave)]"
                      }`}
                    >
                      {s}
                    </p>
                  ),
                )}
              </div>

              <div className="grid gap-5 p-6 lg:grid-cols-2 [&>*]:min-w-0">
                <div>{CUATRO[3].visual}</div>
                <div>{CUATRO[2].visual}</div>
              </div>
            </div>
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 09 ═════════════════════════════════════════════════════════
  {
    n: "09",
    nombre: "Carrusel automático",
    idea: "Los cuatro se turnan solos en un mismo marco.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado />
          <div className="mt-16">
            <CarruselVivo />
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 10 ═════════════════════════════════════════════════════════
  {
    n: "10",
    nombre: "Índice editorial",
    idea: "Los cuatro como una lista numerada 01–04. Pura tipografía.",
    vista: (
      <Shell>
        <Ancho className="pb-24 pt-16 sm:pt-24">
          <h1 className={`max-w-[16ch] ${TITULO_GRANDE}`}>
            Aumentá tus ventas con Bookea.
          </h1>
          <p className="mt-6 max-w-[54ch] text-[19px] leading-relaxed text-[color:var(--tinta-suave)]">
            Cuatro cosas. Prendés la que te sirve y dejás el resto apagado.
          </p>
          <Acciones centrado={false} />

          <ul className="mt-16">
            {PRODUCTOS.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={p.verMas}
                  className="group flex items-baseline gap-5 border-t border-[color:var(--linea)] py-7 transition-colors hover:border-[color:var(--tinta)] sm:gap-8"
                >
                  <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-[color:var(--tinta-tenue)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="titulo block text-[clamp(24px,3.6vw,40px)] leading-[1.1] text-[color:var(--tinta)]">
                      {p.nombre}
                    </span>
                    <span className="mt-2 block max-w-[52ch] text-[15.5px] leading-snug text-[color:var(--tinta-suave)]">
                      {p.promesa}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-[22px] text-[color:var(--tinta-tenue)] transition-transform group-hover:translate-x-1 group-hover:text-[color:var(--acento)]"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-[color:var(--linea)]" />
        </Ancho>
      </Shell>
    ),
  },

  // ══ 11 ═════════════════════════════════════════════════════════
  {
    n: "11",
    nombre: "La demo es la portada",
    idea: "Titular chico y, debajo, una demostración corriendo sola a lo grande.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <div className="text-center">
            <Rotulo>Mirá cómo entra una reserva</Rotulo>
            <h1 className="titulo mx-auto mt-5 max-w-[18ch] text-balance text-[clamp(26px,3.8vw,40px)] leading-[1.1] text-[color:var(--tinta)]">
              Tu cliente reserva solo. A vos te entra a la agenda.
            </h1>
          </div>

          {/* La demo, cuatro veces más grande que en una tarjeta. */}
          <div className="mx-auto mt-10 w-full max-w-[560px]">
            <div className="rounded-[24px] border border-[color:var(--linea)] bg-[color:var(--superficie)] p-6 sm:p-8">
              {CUATRO[3].visual}
            </div>
          </div>

          <Acciones />

          <div className="mt-20 grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
            {CUATRO.filter((p) => p.id !== "marketplace").map((p) => (
              <TarjetaProducto key={p.id} p={p} alto={230} compacta />
            ))}
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 12 ═════════════════════════════════════════════════════════
  {
    n: "12",
    nombre: "El precio de titular",
    idea: "«Gratis» como el texto más grande de la página.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-16 sm:pt-24">
          <div className="text-center">
            <Rotulo>Sin tarjeta, sin contrato</Rotulo>
            <p className="titulo mt-6 text-[clamp(64px,13vw,150px)] leading-[0.92] text-[color:var(--tinta)]">
              Gratis.
            </p>
            <p className="mx-auto mt-6 max-w-[34ch] text-pretty text-[19px] leading-relaxed text-[color:var(--tinta-suave)] sm:text-[22px]">
              Las cuatro herramientas de Bookea, sin costo mientras estamos
              arrancando.
            </p>
            <Acciones secundario="" />
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--linea)] sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            {PRODUCTOS.map((p) => (
              <div key={p.id} className="bg-[color:var(--papel)] p-6">
                <p className="text-[16px] font-extrabold text-[color:var(--tinta)]">
                  {p.nombre}
                </p>
                <p className="mt-1.5 text-[13.5px] leading-snug text-[color:var(--tinta-suave)]">
                  {p.promesa}
                </p>
                <ul className="mt-4 space-y-2">
                  {p.incluye.map((l) => (
                    <li key={l} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[9px] font-extrabold text-[color:var(--ok)]"
                      >
                        ✓
                      </span>
                      <span className="text-[12.5px] leading-snug text-[color:var(--tinta-suave)]">
                        {l}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 13 ═════════════════════════════════════════════════════════
  {
    n: "13",
    nombre: "«¿Qué negocio tenés?»",
    idea: "Elegís tu rubro y la portada se arma para vos.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <PorRubro />
        </Ancho>
      </Shell>
    ),
  },

  // ══ 14 ═════════════════════════════════════════════════════════
  {
    n: "14",
    nombre: "Antes / después",
    idea: "A la izquierda el desorden de hoy; a la derecha, con Bookea.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado
            rotulo="El cambio"
            titulo="Dejá de atender tu negocio desde seis lados."
            bajada={null}
          />

          <div className="mt-14 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            {/* ANTES */}
            <div className="rounded-[20px] border border-dashed border-[color:var(--linea)] p-6 sm:p-8">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--tinta-tenue)]">
                Hoy
              </p>
              <p className="mt-2 text-[19px] font-extrabold text-[color:var(--tinta-suave)]">
                Todo suelto, y vos en el medio.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  "El menú en una foto de WhatsApp que ya tiene precios viejos",
                  "Las reservas en un cuaderno y en mensajes sin contestar",
                  "Los sellos en cartoncitos que el cliente pierde",
                  "Los comentarios de Instagram que respondés de noche",
                  "Los pedidos anotados en papelitos",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--tinta-tenue)]"
                    />
                    <span className="text-[14.5px] leading-snug text-[color:var(--tinta-suave)]">
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* DESPUÉS */}
            <div className="rounded-[20px] border-2 border-[color:var(--acento)] bg-[color:var(--superficie)] p-6 sm:p-8">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
                Con Bookea
              </p>
              <p className="mt-2 text-[19px] font-extrabold text-[color:var(--tinta)]">
                Un solo lugar, y el negocio contestando solo.
              </p>
              <ul className="mt-6 space-y-3">
                {PRODUCTOS.map((p) => (
                  <li key={p.id} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[11px] font-extrabold text-[color:var(--ok)]"
                    >
                      ✓
                    </span>
                    <span>
                      <span className="block text-[14.5px] font-extrabold text-[color:var(--tinta)]">
                        {p.nombre}
                      </span>
                      <span className="block text-[13.5px] leading-snug text-[color:var(--tinta-suave)]">
                        {p.promesa}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div aria-hidden className="mt-7">
                {CUATRO[2].visual}
              </div>
            </div>
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 15 ═════════════════════════════════════════════════════════
  {
    n: "15",
    nombre: "Tira que se sale",
    idea: "Los cuatro en una fila que se corta en el borde: arrastrá para ver.",
    vista: (
      <Shell>
        <Ancho className="pt-12 sm:pt-16">
          <HeroeCentrado />
        </Ancho>
        {/* Sin `Ancho`: la tira TIENE que tocar el borde para que se
            entienda que sigue. Con margen a los lados parece cortada. */}
        <div className="mt-16 overflow-x-auto pb-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-5 px-5 sm:px-8">
            {CUATRO.map((p) => (
              <div key={p.id} className="w-[300px] shrink-0 sm:w-[340px]">
                <TarjetaProducto p={p} alto={330} />
              </div>
            ))}
            <div className="flex w-[240px] shrink-0 items-center">
              <Link
                href="/empezar"
                className="group flex h-full w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-[color:var(--linea)] px-6 text-center transition-colors hover:border-[color:var(--acento)]"
              >
                <p className="text-[17px] font-extrabold text-[color:var(--tinta)]">
                  Los cuatro, gratis
                </p>
                <VerMas className="mt-4">Empezar</VerMas>
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    ),
  },

  // ══ 16 ═════════════════════════════════════════════════════════
  {
    n: "16",
    nombre: "Teléfono fijo, texto que corre",
    idea: "El mockup se queda pegado mientras el texto de al lado va cambiando.",
    vista: (
      <Shell>
        <Ancho className="pt-12 sm:pt-16">
          <HeroeCentrado />
          <div className="mt-20 grid gap-12 lg:grid-cols-2 [&>*]:min-w-0">
            {/* `sticky`: se queda a 96px del techo mientras la columna
                de al lado sigue bajando. Sin JavaScript. */}
            <div className="hidden lg:block">
              <div
                aria-hidden
                className="sticky top-24 flex h-[480px] select-none items-center justify-center"
              >
                <div className="w-full max-w-[360px]">{CUATRO[0].visual}</div>
              </div>
            </div>

            <div className="space-y-20 pb-24">
              {CUATRO.map((p) => (
                <div key={p.id}>
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--acento)]">
                    {p.nombre}
                  </p>
                  <h2 className="titulo mt-3 text-[clamp(24px,3vw,32px)] leading-[1.12] text-[color:var(--tinta)]">
                    {p.promesa}
                  </h2>
                  <ul className="mt-5 space-y-2">
                    {p.incluye.map((l) => (
                      <li key={l} className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--ok-suave)] text-[11px] font-extrabold text-[color:var(--ok)]"
                        >
                          ✓
                        </span>
                        <span className="text-[14.5px] leading-snug text-[color:var(--tinta-suave)]">
                          {l}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/* En teléfono el mockup no puede quedarse fijo:
                      acompaña a su propio bloque. */}
                  <div aria-hidden className="mt-6 lg:hidden">
                    {p.visual}
                  </div>
                  <Link href={p.verMas} className="group mt-6 inline-block">
                    <VerMas />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 17 ═════════════════════════════════════════════════════════
  {
    n: "17",
    nombre: "Fondo oscuro",
    idea: "La misma portada en carbón, con los mockups iluminados encima.",
    vista: (
      <Shell oscuro>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado />
          <div className="mt-16 sm:mt-20">
            <CuatroProductos />
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 18 ═════════════════════════════════════════════════════════
  {
    n: "18",
    nombre: "Cuadrícula de todo",
    idea: "Doce cuadros: todo lo que Bookea hace, de un golpe.",
    vista: (
      <Shell>
        <Ancho className="pb-20 pt-12 sm:pt-16">
          <HeroeCentrado bajada="Doce cosas que tu negocio necesita. Todas adentro." />

          <div className="mt-14 grid gap-px overflow-hidden rounded-[20px] border border-[color:var(--linea)] bg-[color:var(--linea)] sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {PRODUCTOS.flatMap((p) =>
              p.incluye.map((linea) => ({ id: `${p.id}-${linea}`, p, linea })),
            ).map(({ id, p, linea }) => (
              <div key={id} className="bg-[color:var(--papel)] p-6">
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[color:var(--acento-suave)] text-[13px] font-extrabold text-[color:var(--acento)]"
                >
                  ✓
                </span>
                <p className="mt-3.5 text-[15px] font-extrabold leading-snug text-[color:var(--tinta)]">
                  {linea}
                </p>
                <p className="mt-1 text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--tinta-tenue)]">
                  {p.nombre}
                </p>
              </div>
            ))}
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 19 ═════════════════════════════════════════════════════════
  {
    n: "19",
    nombre: "Todo en una pantalla",
    idea: "Titular, los cuatro productos y el pie, sin bajar ni una vez.",
    vista: (
      <Shell>
        <Ancho className="pb-10 pt-8 sm:pt-10">
          <div className="text-center">
            <h1 className="titulo mx-auto max-w-[17ch] text-balance text-[clamp(26px,3.6vw,40px)] leading-[1.08] text-[color:var(--tinta)]">
              Aumentá tus ventas con Bookea.
            </h1>
            <p className="mx-auto mt-3 max-w-[54ch] text-[15.5px] leading-snug text-[color:var(--tinta-suave)]">
              Cuatro herramientas. Prendés la que te sirve, gratis.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            {CUATRO.map((p) => (
              <TarjetaProducto key={p.id} p={p} alto={190} compacta />
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/empezar" className="btn-tinta">
              Empezá gratis
            </Link>
            <Link href="/solutions" className="btn-tinta-contorno">
              Ver cómo funciona
            </Link>
          </div>
        </Ancho>
      </Shell>
    ),
  },

  // ══ 20 ═════════════════════════════════════════════════════════
  {
    n: "20",
    nombre: "Foto real con el teléfono encima",
    idea: "Un negocio de verdad ocupando la portada, y su página flotando encima.",
    vista: (
      <Shell>
        <div className="relative">
          {/* La foto es una de las tres escenas reales del producto, las
              mismas que usa la página de «Tu página». No es foto de banco. */}
          <div className="relative h-[520px] w-full overflow-hidden sm:h-[600px]">
            <Image
              src="https://imagedelivery.net/X6xhTJPyvf9Jhtws4_jH8g/linksy-hero-restaurante/gallery"
              alt="Un restaurante con su página de Bookea abierta en el teléfono"
              fill
              priority
              unoptimized
              className="object-cover"
            />
            {/* El velo: sin él, el texto blanco se pierde en la parte
                clara de la foto. Va de abajo hacia arriba porque el
                titular se apoya abajo a la izquierda. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,16,19,0.88)_0%,rgba(14,16,19,0.62)_45%,rgba(14,16,19,0.15)_100%)]"
            />

            <div className="absolute inset-0">
              <div className="mx-auto flex h-full w-full max-w-[1200px] items-center px-5 sm:px-8">
                <div className="max-w-[30ch]">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-[12.5px] font-extrabold text-white">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
                    Casa Matcha · Escazú
                  </span>
                  <h1 className="titulo mt-5 text-balance text-[clamp(32px,5.4vw,52px)] leading-[1.06] text-white">
                    Aumentá tus ventas con Bookea.
                  </h1>
                  <p className="mt-5 max-w-[40ch] text-[17px] leading-relaxed text-white/80">
                    Tu menú, tus reservas, tus clientes y tus automatizaciones.
                    Todo en un solo lugar.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      href="/empezar"
                      className="inline-flex items-center rounded-[12px] bg-white px-6 py-3 text-[15px] font-extrabold text-[#14161a]"
                    >
                      Empezá gratis
                    </Link>
                    <Link
                      href="/solutions"
                      className="inline-flex items-center rounded-[12px] border border-white/40 px-6 py-3 text-[15px] font-extrabold text-white"
                    >
                      Ver cómo funciona
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* El teléfono montado sobre el borde de la foto. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 right-[6%] hidden w-[300px] select-none drop-shadow-[0_30px_60px_rgba(20,22,26,0.4)] lg:block"
          >
            {CUATRO[0].visual}
          </div>
        </div>

        <Ancho className="pb-20 pt-20 lg:pt-28">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            {CUATRO.map((p) => (
              <TarjetaProducto key={p.id} p={p} alto={230} compacta />
            ))}
          </div>
        </Ancho>
      </Shell>
    ),
  },
];

/**
 * La 21 llegó después de las veinte, con `/celebrar` como referencia
 * («textos más grandes que llenan más»). Vive en su propio archivo
 * porque no es una variación de las otras: es el único héroe a sangre.
 */
HOMES.push({
  n: "21",
  nombre: "Héroe marino, tipografía grande",
  idea: "La anatomía de Celebrar con la identidad de Bookea: fondo a sangre, titular de 72 px y el producto rotando al lado.",
  vista: <Home21 />,
});
