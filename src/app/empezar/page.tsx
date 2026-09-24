import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/site-footer";
import HeaderPlataforma from "@/components/home/plataforma/header-plataforma";
import { TITULO_GRANDE } from "@/components/home/plataforma/piezas";
import ElegirServicios from "@/components/business/elegir-servicios";

/**
 * ════════════════════════════════════════════════════════════════════
 *  /empezar — «¿qué querés activar?»
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (24 sep 2026): «la gente se registra, ingresa, y ahí
 * va a tener por cards qué servicios quiere agregar».
 *
 * Este es ese paso. Cuatro tarjetas, una por producto, y cada una lleva
 * a su alta de verdad.
 *
 * ── POR QUÉ ES PÚBLICA Y NO PIDE SESIÓN ─────────────────────────────
 *
 * Porque cada alta ya pide la suya. `/solutions/crear`, `/lealtad/nuevo`
 * y `/publicar` mandan a `/cuenta` si no hay sesión y vuelven. Poner
 * una segunda puerta acá no agregaría seguridad —las tres de abajo
 * siguen estando— y sí le pediría la cuenta a alguien antes de dejarle
 * ver qué le estamos ofreciendo.
 *
 * El orden queda: **ver qué hay → elegir → registrarse**, en vez de
 * registrarse a ciegas. Es también el orden que pidió el dueño para el
 * botón «Empezá gratis» del home, que ahora cae acá.
 *
 * ── LO QUE FALTA, ANOTADO ───────────────────────────────────────────
 *
 * `ElegirServicios` acepta `activos` para marcar lo que el negocio ya
 * tiene prendido. Hoy va vacío porque el estado está repartido: la
 * página lo guarda en `solutions_addons`, Lealtad en sus propias
 * tablas y el marketplace en `ranchos`. Unificar esa lectura es trabajo
 * de la federación por identidad (§6 de `docs/arquitectura.md`), no de
 * esta pantalla. Mientras tanto muestra las cuatro puertas abiertas.
 */

export const metadata: Metadata = {
  title: "Empezá gratis",
  description:
    "Elegí qué querés activar para tu negocio: tu página, pases de lealtad, automatizaciones o reservas.",
};

export default function Empezar() {
  return (
    <div className="home-plataforma flex min-h-screen flex-col overflow-x-clip bg-[color:var(--papel)]">
      <HeaderPlataforma />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-[1200px] px-5 pb-20 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--linea)] bg-white px-4 py-2 text-[12.5px] font-extrabold text-[color:var(--tinta)] shadow-[0_2px_10px_-4px_rgba(20,22,26,0.18)]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-[color:var(--acento)]"
              />
              Todo gratis para arrancar
            </span>

            <h1 className={`mx-auto mt-5 max-w-[16ch] ${TITULO_GRANDE}`}>
              ¿Qué querés activar?
            </h1>

            <p className="mx-auto mt-6 max-w-[600px] text-pretty text-[17px] leading-relaxed text-[color:var(--tinta-suave)] sm:text-[20px]">
              Elegí uno, elegí los cuatro. Se prenden por separado y podés
              agregar el resto cuando quieras.
            </p>
          </div>

          <div className="mt-14 sm:mt-16">
            <ElegirServicios />
          </div>

          <p className="mt-10 text-center text-[14px] text-[color:var(--tinta-suave)]">
            ¿No sabés por cuál empezar?{" "}
            <Link
              href="/ayuda"
              className="font-extrabold text-[color:var(--acento)] underline underline-offset-2"
            >
              Escribinos y lo vemos juntos
            </Link>
            .
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
