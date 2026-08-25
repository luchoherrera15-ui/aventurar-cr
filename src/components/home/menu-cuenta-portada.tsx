"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { iniciales } from "@/lib/iniciales";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL MENÚ DE CUENTA DE LA PORTADA
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (ago 2026): «si el usuario está logueado, mostrarle
 * SU CUENTA y un tab para abajo tipo cerrar sesión, ver mi perfil».
 *
 * Antes el header de la portada tenía un «Iniciar sesión» fijo que
 * decía lo mismo con sesión y sin ella: quien ya había entrado veía una
 * invitación a entrar otra vez, y no tenía por dónde salir.
 *
 * ── POR QUÉ NO SE REUSÓ `MenuCuenta` ────────────────────────────────
 *
 * `src/components/menu-cuenta.tsx` existe y hace algo parecido, pero no
 * encaja acá por dos razones concretas, no por gusto:
 *
 *   1. Es una píldora de HAMBURGUESA + avatar. La portada ya tiene su
 *      hamburguesa al lado (`CajonNavMovil`), así que quedarían dos
 *      botones de menú pegados, con dos contenidos distintos.
 *   2. Su desplegable lleva a `/eventos`, que es justo el directorio
 *      que se está desmontando.
 *
 *   3. Y lo que el dueño pidió es que se vea EL NOMBRE, no un avatar
 *      mudo — el mismo trato que ya da el nav de /lealtad.
 *
 * `MenuCuenta` se queda como está: lo montan `site-header` y
 * `food-header`, y cambiarlo para que sirva acá lo rompería allá.
 *
 * ── LOS ENLACES SON RUTAS QUE EXISTEN ───────────────────────────────
 * Verificadas una por una contra `src/app/cuenta/`: perfil, reservas,
 * favoritos y lealtad. Un menú que promete una pantalla que no está es
 * peor que un menú corto.
 */

type ItemCuenta = { href: string; label: string };

const ITEMS: ItemCuenta[] = [
  { href: "/cuenta", label: "Ver mi perfil" },
  { href: "/cuenta/reservas", label: "Mis reservas" },
  { href: "/cuenta/favoritos", label: "Mis favoritos" },
];

const ITEM_CLS =
  "block w-full whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold text-aventurea-ink transition-colors hover:bg-[#f4f6fb]";

export default function MenuCuentaPortada({
  nombre,
  fotoUrl,
  /** Ya tiene un negocio publicado: se le ofrece su panel. */
  yaPublica = false,
  cerrarSesion,
}: {
  nombre: string | null;
  fotoUrl: string | null;
  yaPublica?: boolean;
  cerrarSesion: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  /**
   * ESCAPE CIERRA EL MENÚ.
   *
   * Los otros desplegables del repo se cierran solo con un clic afuera
   * (el `<button>` que tapa la pantalla). Con el teclado eso deja
   * atrapada a la persona: tabula hasta el último ítem y no tiene forma
   * de salir sin activar alguno. Acá Escape cierra y devuelve el foco al
   * botón que lo abrió, que es lo que espera cualquiera que navegue así.
   */
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbierto(false);
      cajaRef.current?.querySelector("button")?.focus();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  // «Mi cuenta» cuando hay sesión pero el perfil todavía no tiene
  // nombre cargado — mismo criterio que el nav de /lealtad.
  const etiqueta = nombre?.trim() || "Mi cuenta";

  return (
    <div ref={cajaRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-[13.5px] font-bold text-aventurea-ink transition-colors hover:bg-white/70"
      >
        {fotoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- avatar de
             Google: dominio externo variable, next/image obligaría a
             registrar cada host. Mismo criterio que menu-cuenta.tsx. */
          <img
            src={fotoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-aventurea-navy text-[10px] font-extrabold text-white"
          >
            {nombre ? iniciales(nombre) : "✓"}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate sm:block">{etiqueta}</span>
        <span
          aria-hidden
          className={`text-[9px] transition-transform ${abierto ? "rotate-180" : ""}`}
        >
          ▼
        </span>
      </button>

      {abierto && (
        <>
          {/* La tapa que cierra al tocar afuera. Va ANTES del panel en el
              DOM y con z-index menor: si fuera al revés, se comería los
              clics de los propios ítems del menú. */}
          <button
            type="button"
            aria-label="Cerrar el menú de cuenta"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-2xl border border-aventurea-line bg-white p-1.5 shadow-[0_24px_60px_-24px_rgba(16,38,88,0.35)]">
            {ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
                className={ITEM_CLS}
              >
                {item.label}
              </Link>
            ))}

            {/* Solo si de verdad tiene un negocio: ofrecerle «Mi negocio»
                a quien no publicó nada lo manda a un panel vacío. */}
            {yaPublica && (
              <Link href="/mi-negocio" onClick={() => setAbierto(false)} className={ITEM_CLS}>
                Mi negocio
              </Link>
            )}

            <div className="my-1 border-t border-aventurea-line" />

            {/* Un <form> con server action y no un onClick: cerrar sesión
                tiene que borrar la cookie EN EL SERVIDOR. Hecho desde el
                cliente, la sesión sigue viva en cada render de servidor. */}
            <form action={cerrarSesion}>
              <button type="submit" className={ITEM_CLS}>
                Cerrar sesión
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
