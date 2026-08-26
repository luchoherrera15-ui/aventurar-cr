"use client";

import Image from "next/image";
import { IconStar } from "@/components/icons";
import type { ProfesionalPerfil } from "./perfil-tipos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL PROFESIONAL EN CHIQUITO — SOLO MÓVIL
 * ════════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño (26 ago 2026): «en la versión móvil, las fotos de
 * los miembros deben salir en un card circular pequeño y al darle click
 * que salga tipo INFORMACIÓN, RESEÑAS».
 *
 * En una pantalla de teléfono la tarjeta grande (`professional-card`)
 * ocupa media pantalla por persona: con tres del equipo hay que hacer
 * scroll para saber CUÁNTA gente hay. El círculo invierte eso — se ve
 * el equipo entero de un vistazo y el detalle se pide tocando.
 *
 * Es un BOTÓN, no una tarjeta con un botón adentro: toda la superficie
 * abre la ficha. En un dedo, un blanco de 72 px que responde entero es
 * la diferencia entre tocar y apuntar.
 *
 * No decide qué mostrar: avisa con `onAbrir` y la sección decide. Mismo
 * criterio que el resto del rediseño (ver `perfil-tipos.ts`).
 */
export default function ProfessionalAvatar({
  profesional,
  onAbrir,
}: {
  profesional: ProfesionalPerfil;
  onAbrir: () => void;
}) {
  const { nombre, rol, foto_url, promedio, totalResenas } = profesional;

  /**
   * ⚠️ EL ROTULO SE ARMA CON LO QUE SE VE, Y NO ES REDUNDANCIA.
   *
   * Un `aria-label` en un botón GANA sobre su contenido: el lector de
   * pantalla lee la etiqueta y nada más — un botón es una hoja, no
   * entra a mirar adentro. Con «Ver información y reseñas de Ana» a
   * secas, la estrella con «4,8» y el rol que están dibujados dos
   * líneas abajo NO SE ANUNCIAN NUNCA.
   *
   * Y eso es justo lo que sirve para elegir: quien ve la pantalla
   * compara notas de un vistazo; quien la escucha recibía cinco botones
   * idénticos salvo por el nombre, y tenía que abrir uno por uno para
   * enterarse de algo que a los demás se les da gratis.
   */
  const notaEnPalabras =
    promedio != null && totalResenas > 0
      ? `, ${promedio.toFixed(1).replace(".", ",")} de 5 en ${totalResenas} reseña${totalResenas === 1 ? "" : "s"}`
      : ", sin reseñas todavía";
  const rotulo = `${nombre}${rol ? `, ${rol}` : ""}${notaEnPalabras}. Ver información y reseñas`;

  return (
    <button
      type="button"
      onClick={onAbrir}
      // `w-[84px]` fijo y no flexible: en una fila que scrollea, dejar
      // que el ancho lo decida el contenido hace que los círculos
      // queden a distancias distintas según lo largo del nombre.
      className="presionable flex w-[84px] shrink-0 flex-col items-center gap-1.5 text-center"
      aria-label={rotulo}
    >
      <span className="relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full border border-aventurea-line bg-aventurea-blue-light shadow-[0_6px_18px_-8px_rgba(22,41,94,0.45)]">
        {foto_url ? (
          <Image
            src={foto_url}
            alt=""
            fill
            // El círculo mide 72 px de CSS; en pantallas de 3× el
            // archivo que hace falta es de 216. Pedir el ancho de la
            // ventana acá bajaría una foto enorme para recortarla a un
            // pulgar.
            sizes="72px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-aventurea-navy text-[26px] font-extrabold text-white">
            {nombre.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      {/* `line-clamp-1` y no un corte a mano: un nombre largo debe
          quedar cortado por el navegador, con puntos suspensivos, sin
          empujar al círculo de al lado. */}
      <span className="line-clamp-1 w-full text-[12px] font-extrabold leading-tight text-aventurea-ink">
        {nombre}
      </span>

      {/* Debajo del nombre va UNA sola línea. Si tiene nota, gana la
          nota: es lo que ayuda a elegir. El rol se lee en la ficha. */}
      {promedio != null && totalResenas > 0 ? (
        <span className="flex items-center gap-0.5 text-[11px] font-bold text-aventurea-ink-soft">
          <IconStar className="h-3 w-3 text-aventurea-orange" />
          {promedio.toFixed(1).replace(".", ",")}
        </span>
      ) : rol ? (
        <span className="line-clamp-1 w-full text-[11px] font-semibold text-aventurea-ink-soft">
          {rol}
        </span>
      ) : null}
    </button>
  );
}
