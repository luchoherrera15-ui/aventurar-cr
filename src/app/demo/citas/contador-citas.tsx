"use client";

import { useEffect, useState } from "react";

/**
 * ════════════════════════════════════════════════════════════════════
 *  «HOY SE HAN RESERVADO N CITAS EN BOOKEA» — el contador que sube
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (27 ago 2026): «en el demo un contador que vaya
 * sumando: hoy se han reservado 150 citas en Bookea, y ahí que vaya
 * aumentando».
 *
 * ── ESTE NÚMERO ES DE UTILERÍA, Y HAY QUE DECIRLO ───────────────────
 *
 * No sale de `reservas`: es una animación. Vive SOLO dentro de
 * `/demo/citas`, que es la pieza que se le muestra a un negocio para
 * que vea cómo se sentiría la plataforma llena.
 *
 * ⚠️ NO SE PUEDE MUDAR A LA PORTADA NI A NINGUNA PÁGINA PÚBLICA. Un
 * número inventado que dice «150 citas hoy» donde alguien puede
 * creerlo es una cifra falsa sobre el tamaño del negocio — el tipo de
 * dato que un cliente repite y que después no se sostiene. Acá se
 * sostiene porque toda la página está rotulada como demostración.
 *
 * ── ARRANCA EN 150 Y SUBE DESPACIO ──────────────────────────────────
 *
 * Cada 4-9 segundos suma 1 o 2. No sube más rápido a propósito: un
 * contador que corre se lee como un marcador de casino y delata que es
 * de mentira. Uno que se mueve cada tanto se lee como actividad.
 *
 * ── EL PRIMER PINTADO ES SIEMPRE 150 ────────────────────────────────
 *
 * El azar arranca DESPUÉS del montaje, en un efecto. Si el número
 * inicial fuera aleatorio, el servidor pintaría uno y el navegador
 * otro, y React tiraría un error de hidratación en consola.
 */
const ARRANQUE = 150;

export default function ContadorCitas() {
  const [n, setN] = useState(ARRANQUE);

  useEffect(() => {
    let vivo = true;
    let id: ReturnType<typeof setTimeout>;

    function siguiente() {
      // Entre 4 y 9 segundos: irregular, porque un intervalo exacto se
      // nota tanto como una velocidad exagerada.
      const espera = 4000 + Math.random() * 5000;
      id = setTimeout(() => {
        if (!vivo) return;
        setN((v) => v + (Math.random() < 0.75 ? 1 : 2));
        siguiente();
      }, espera);
    }
    siguiente();

    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, []);

  return (
    <p className="flex items-center justify-center gap-2 text-[14px] text-aventurea-ink-soft">
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
      />
      Hoy se han reservado{" "}
      <strong
        className="text-[17px] font-extrabold text-aventurea-navy tabular-nums"
        // `aria-live="polite"`: quien usa lector de pantalla se entera
        // de que el número cambió, pero sin que se le interrumpa lo que
        // esté leyendo. Con `assertive` sería un grito cada 6 segundos.
        aria-live="polite"
      >
        {n.toLocaleString("es-CR")}
      </strong>{" "}
      citas en Bookea
    </p>
  );
}
