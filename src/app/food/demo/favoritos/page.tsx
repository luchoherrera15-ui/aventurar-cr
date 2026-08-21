"use client";

import Link from "next/link";
import { RESTAURANTES_DEMO } from "@/lib/food/demo/datos";
import { useFavoritosDemo } from "@/lib/food/demo/estado";
import CardDemo from "@/components/food/demo/card-demo";

/**
 * Los favoritos de la sesión de DEMO — el corazón de cada card guarda
 * acá (localStorage). Quitar el corazón desde la card también los saca
 * de esta lista al instante.
 */
export default function FavoritosDemoPage() {
  const favoritos = useFavoritosDemo();
  const restaurantes = RESTAURANTES_DEMO.filter((r) => favoritos.includes(r.slug));

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="titulo text-[26px] uppercase tracking-tight text-aventurea-navy sm:text-[30px]">
        Favoritos
      </h1>
      <p className="mt-1 text-[13.5px] text-aventurea-ink-soft">
        Los restaurantes que guardaste con el corazón durante esta sesión.
      </p>

      {restaurantes.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-aventurea-line bg-white p-10 text-center shadow-plano">
          <p className="text-[15px] font-extrabold text-aventurea-ink">
            Todavía no guardaste favoritos
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
            Tocá el corazón de cualquier restaurante para guardarlo acá.
          </p>
          <Link href="/food/demo" className="btn-naranja presionable mt-6 inline-flex">
            Explorar restaurantes
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {restaurantes.map((r, i) => (
            <CardDemo key={r.slug} r={r} prioridad={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
