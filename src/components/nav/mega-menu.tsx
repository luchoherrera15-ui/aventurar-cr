"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { hrefDeDestino, type Puerta } from "./taxonomia-navegacion";
import { IconChevronDown } from "@/components/icons";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MEGA MENÚ DE LA PORTADA — cinco puertas, subcategorías agrupadas
 * ════════════════════════════════════════════════════════════════════
 *
 * Reemplaza a la fila de chips con desplegables angostos
 * (`nav-categorias.tsx`). El pedido del dueño fue explícito: cinco
 * puertas arriba, las subcategorías ESCONDIDAS hasta que alguien toque,
 * y al tocar un panel ancho con las subcategorías AGRUPADAS por tema.
 *
 * ── EL PATRÓN, Y LO QUE NO ES ───────────────────────────────────────
 *
 * Es el «Disclosure Navigation Menu with Top-Level Links» de las APG.
 *
 * ⛔ NO lleva `role="menu"` ni `role="menuitem"`, y no es un descuido:
 * esos roles son para menús de APLICACIÓN (acciones tipo Cortar/Pegar).
 * Puestos sobre links de navegación, el lector de pantalla deja de
 * anunciarlos como enlaces y la persona pierde la navegación por links,
 * que es como se recorre un sitio. Mismo contrato que ya cumplía
 * `nav-categorias.tsx`.
 *
 * ── LO QUE HACE QUE SE ENTIENDA EN AUDIO ────────────────────────────
 *
 * `<h3 id>` + `<ul aria-labelledby>` por columna. Eso hace que el lector
 * anuncie «Belleza, lista de 8 elementos» en vez de setenta y nueve
 * enlaces sueltos. EL AGRUPAMIENTO TEMÁTICO ES EL CORAZÓN DEL PEDIDO —
 * sin esta semántica se pierde entero para quien no ve la pantalla.
 *
 * ── POR QUÉ EL PANEL ES HERMANO DE LA FILA ──────────────────────────
 *
 * El panel vive FUERA de la fila de botones, dentro del mismo contenedor
 * `relative` sin overflow. Si fuera hijo de la fila —que puede
 * scrollear en horizontal— el recorte de la fila lo cortaría en seco.
 * Ya pasó dos veces en este repo: en `nav-categorias.tsx` y en el panel
 * del botón «⋯» del héroe.
 *
 * ── ANCLADO AL CONTENEDOR, NO AL BOTÓN ──────────────────────────────
 *
 * Las cinco puertas abren el panel en la MISMA posición. Cambiar de
 * puerta no hace saltar el panel de un lado a otro, y ese detalle es la
 * mitad de la sensación de producto terminado.
 */

/** Cuántos negocios hay detrás de cada destino. Ver `censo-rubros.ts`. */
export type ConteoPorClave = Record<string, number>;

export default function MegaMenu({ puertas }: { puertas: Puerta[] }) {
  // UN solo valor y no cinco booleanos: hace estructuralmente imposible
  // tener dos paneles abiertos a la vez.
  const [abierto, setAbierto] = useState<string | null>(null);

  const filaRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const botonesRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const idBase = useId();

  const cerrar = useCallback((devolverFoco: boolean) => {
    setAbierto((actual) => {
      if (devolverFoco && actual) botonesRef.current[actual]?.focus();
      return null;
    });
  }, []);

  // Los listeners de `document` se montan SOLO con un panel abierto:
  // costo cero en reposo, que es el 99 % del tiempo que alguien pasa en
  // la portada.
  useEffect(() => {
    if (!abierto) return;

    function alTocarFuera(e: PointerEvent) {
      const objetivo = e.target as Node;
      if (filaRef.current?.contains(objetivo)) return;
      if (panelRef.current?.contains(objetivo)) return;
      setAbierto(null);
    }

    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") cerrar(true);
    }

    document.addEventListener("pointerdown", alTocarFuera);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("pointerdown", alTocarFuera);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [abierto, cerrar]);

  const activa = puertas.find((p) => p.id === abierto) ?? null;

  /**
   * El hover CONMUTA, pero no ABRE.
   *
   * Con un panel ya abierto, pasar el mouse por otra puerta cambia al
   * instante — es lo que hace que explorar cinco categorías se sienta
   * fluido en vez de cinco clics. Pero con todo cerrado el hover NO hace
   * nada, y eso es deliberado: un menú que se abre solo al pasar el
   * mouse dispara el criterio 1.4.13 de WCAG (descartable / recorrible /
   * persistente), y además en una pantalla táctil el hover no existe, así
   * que sería una interacción que la mitad de la gente no tiene.
   *
   * `hover: hover` + `pointer: fine` para que no se dispare por el
   * "hover fantasma" que emulan algunos navegadores táctiles.
   */
  function alPasarPorEncima(id: string) {
    if (!abierto || abierto === id) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setAbierto(id);
  }

  function alTecladoDeLaFila(e: React.KeyboardEvent, indice: number) {
    const ids = puertas.map((p) => p.id);

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const paso = e.key === "ArrowRight" ? 1 : -1;
      const siguiente = ids[(indice + paso + ids.length) % ids.length];
      botonesRef.current[siguiente]?.focus();
      // Si ya había uno abierto, la flecha cambia de panel además de
      // mover el foco: el teclado hace lo mismo que el hover.
      if (abierto) setAbierto(siguiente);
      return;
    }

    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const destino = e.key === "Home" ? ids[0] : ids[ids.length - 1];
      botonesRef.current[destino]?.focus();
      return;
    }

    if (e.key === "ArrowDown") {
      // Abre Y baja al primer enlace. Es el gesto que espera quien
      // recorre con teclado: la flecha abajo entra en el panel.
      e.preventDefault();
      setAbierto(puertas[indice].id);
      requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
      });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setAbierto(null);
    }
  }

  return (
    <nav aria-label="Categorías de Bookea" className="relative">
      <ul ref={filaRef} className="flex items-center gap-0.5">
        {puertas.map((puerta, i) => {
          const estaAbierta = abierto === puerta.id;
          return (
            <li key={puerta.id}>
              <button
                ref={(el) => {
                  botonesRef.current[puerta.id] = el;
                }}
                type="button"
                aria-expanded={estaAbierta}
                aria-haspopup="true"
                aria-controls={`${idBase}-${puerta.id}`}
                onClick={() => setAbierto(estaAbierta ? null : puerta.id)}
                onPointerEnter={() => alPasarPorEncima(puerta.id)}
                onKeyDown={(e) => alTecladoDeLaFila(e, i)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[14px] font-bold transition-colors duration-200 ${
                  estaAbierta
                    ? "bg-aventurea-cream-2 text-[color:var(--navy)]"
                    : "text-aventurea-ink hover:bg-aventurea-cream-2 hover:text-[color:var(--navy)]"
                }`}
              >
                {puerta.label}
                <IconChevronDown
                  aria-hidden
                  className={`h-3 w-3 shrink-0 transition-transform duration-200 ${
                    estaAbierta ? "rotate-180" : ""
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/* EL PANEL SE DESMONTA AL CERRAR, y no se esconde con `hidden`.
          Así es imposible que el foco quede atrapado adentro de un
          subárbol invisible — el problema clásico de los menús que se
          ocultan con CSS. Y de paso no hay decenas de enlaces en el DOM
          de una portada que casi nadie despliega. */}
      {activa && (
        <div
          id={`${idBase}-${activa.id}`}
          ref={panelRef}
          onKeyDown={(e) => {
            if (e.key === "Escape") cerrar(true);
          }}
          /* `position: absolute` SIEMPRE: nunca entra en el flujo, así
             que el CLS es cero por construcción y no por suerte. */
          className="anim-mega-panel absolute left-0 top-[calc(100%+10px)] z-50 w-[min(1120px,calc(100vw-3rem))] overflow-hidden rounded-3xl border border-aventurea-line bg-white shadow-[0_28px_70px_-28px_rgba(16,47,82,0.28)]"
        >
          <div className="grid gap-x-8 gap-y-7 p-7 sm:grid-cols-2 lg:grid-cols-4">
            {activa.columnas.map((columna) => {
              const idTitulo = `${idBase}-${activa.id}-${columna.id}`;
              return (
                <div key={columna.id}>
                  {/* 12px con tracking corto y en `--text`, NO el kicker
                      de 11px en versalitas anchas del sistema: acá el
                      encabezado no es decoración, es lo que hace
                      entender la agrupación — debería tener MÁS
                      presencia que sus hojas, no menos. */}
                  <h3
                    id={idTitulo}
                    className="text-[12px] font-bold uppercase tracking-[0.10em] text-[color:var(--text)]"
                  >
                    {columna.titulo}
                  </h3>

                  <ul aria-labelledby={idTitulo} className="mt-2.5 flex flex-col gap-0.5">
                    {columna.entradas.map((entrada) => {
                      const href = hrefDeDestino(entrada.destino);
                      // Sin destino real no se dibuja NADA: un enlace que
                      // lleva a una lista vacía es peor que la ausencia
                      // de la línea. El censo ya filtró las que no tienen
                      // negocios (ver `censo-rubros.ts`), así que acá
                      // esto es la última red.
                      if (!href) return null;
                      return (
                        <li key={entrada.id}>
                          <Link
                            href={href}
                            onClick={() => cerrar(false)}
                            className="group flex items-center rounded-xl px-2.5 py-[7px] text-[13.5px] font-semibold text-aventurea-ink transition-[background-color,transform,color] duration-200 hover:translate-x-[3px] hover:bg-aventurea-cream-2 hover:text-[color:var(--navy)]"
                          >
                            {entrada.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* EL PIE, CON DOS SALIDAS. Mientras el directorio sea chico,
              cada rubro sin negocios es una oportunidad de captar oferta
              y no una decepción — siempre que el destino sea honesto. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-aventurea-line bg-aventurea-cream px-7 py-4">
            <Link
              href={activa.ruta}
              onClick={() => cerrar(false)}
              className="text-[13.5px] font-extrabold text-[color:var(--navy)] hover:underline"
            >
              Explorar todo {activa.label} <span aria-hidden>→</span>
            </Link>
            <Link
              href={activa.ctaOferta.href}
              onClick={() => cerrar(false)}
              className="text-[13px] font-bold text-bookea-naranja-fuerte hover:underline"
            >
              {activa.ctaOferta.texto} <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
