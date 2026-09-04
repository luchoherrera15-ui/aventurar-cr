"use client";

import { useState } from "react";
import Telefono from "@/components/solutions/telefono";
import VistaPagina, { type DatosPagina } from "@/components/solutions/vista-pagina";
import { PRESETS, TEMAS, type EstiloLinks, type Redondeo, type Tema } from "@/lib/solutions/temas";

/**
 * LOS TELÉFONOS DEL HÉROE — y el selector que los repinta.
 *
 * Pedido del dueño (4 sep 2026): que la landing sea «más interactiva,
 * más funcional, más informativa».
 *
 * ── POR QUÉ SE PUEDE TOCAR ─────────────────────────────────────────
 * La promesa de la página es «diseñados por vos». Escribirlo convence
 * a nadie; dejar que el visitante toque un tema y vea los tres
 * teléfonos cambiar en el acto lo demuestra. Es el producto haciendo
 * la demostración, no una captura de él.
 *
 * Y no es una maqueta aparte: cada teléfono monta `VistaPagina`, el
 * MISMO componente que sirve /s/<slug>. Lo que se ve acá es
 * literalmente lo que le queda al negocio.
 */

const MUESTRA: Omit<DatosPagina, "tema" | "estiloLinks" | "redondeo" | "colorAcento"> = {
  nombre: "Casa Nostra",
  bajada: "Pastas caseras, horno de leña y vinos de la casa.",
  logoUrl: null,
  fotoPortadaUrl: null,
  whatsapp: "88887777",
  direccion: "Av. Principal 123",
  colorFondo: "#0a1226",
  links: [
    { id: "1", etiqueta: "Reservar con descuento", url: "#", icono: "reservar" },
    { id: "2", etiqueta: "Pedir para recoger", url: "#", icono: "tienda" },
    { id: "3", etiqueta: "Cómo llegar", url: "#", icono: "mapa" },
    { id: "4", etiqueta: "Escribinos", url: "#", icono: "whatsapp" },
  ],
  seccionesMenu: ["Entradas", "Pastas", "Postres"],
  hayMenu: true,
  aceptaPedidos: true,
  mesa: null,
};

/** Los tres del abanico: el del medio manda, los de los lados acompañan. */
const ABANICO: { estiloLinks: EstiloLinks; redondeo: Redondeo }[] = [
  { estiloLinks: "lista", redondeo: "suave" },
  { estiloLinks: "grilla", redondeo: "redondo" },
  { estiloLinks: "lista", redondeo: "recto" },
];

/** Qué tema usa cada teléfono según el que el visitante elija. */
function trioDe(elegido: Tema): Tema[] {
  const otros = TEMAS.filter((t) => t !== elegido && t !== "marca");
  return [otros[0] ?? "claro", elegido, otros[1] ?? "crema"];
}

export default function MockupsHero() {
  const [tema, setTema] = useState<Tema>("noche");
  const trio = trioDe(tema);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* El alto acompaña al teléfono del medio (268 × 2.05 ≈ 549) más
          aire. Si se cambia el ancho de abajo, esto también. */}
      <div className="relative flex h-[430px] w-full items-center justify-center sm:h-[575px]">
        {ABANICO.map((v, i) => {
          const central = i === 1;
          const t = trio[i];
          return (
            <div
              key={i}
              className="absolute transition-all duration-500 ease-out"
              style={{
                zIndex: central ? 3 : 1,
                /* Offset en PÍXELES y no en % del propio ancho: en % el
                   corrimiento cambia con el tamaño del teléfono y los
                   laterales terminaban tapados por el del medio.
                   Con 190 px: el central ocupa −134..134 y cada lateral
                   arranca en 76, o sea 58 px de solape — se ve entero el
                   contenido de los tres. */
                transform: `translateX(${(i - 1) * 190}px) scale(${central ? 1 : 0.9}) rotate(${(i - 1) * 5}deg)`,
                opacity: central ? 1 : 0.95,
              }}
            >
              <Telefono ancho={central ? 268 : 236}>
                <VistaPagina
                  inerte
                  className="min-h-full"
                  datos={{
                    ...MUESTRA,
                    colorAcento: PRESETS[t].acentoSugerido,
                    tema: t,
                    estiloLinks: v.estiloLinks,
                    redondeo: v.redondeo,
                  }}
                />
              </Telefono>
            </div>
          );
        })}
      </div>

      {/* ── El selector: la prueba de que es configurable ──────────── */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
          Probá un tema
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {TEMAS.filter((t) => t !== "marca").map((t) => {
            const activo = tema === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTema(t)}
                aria-pressed={activo}
                className={`presionable flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-bold transition-colors ${
                  activo
                    ? "border-aventurea-navy bg-white text-aventurea-navy shadow-plano"
                    : "border-aventurea-line bg-white/70 text-aventurea-ink-soft hover:border-aventurea-navy/40"
                }`}
              >
                <span
                  aria-hidden
                  className="h-5 w-5 rounded-full border border-black/10"
                  style={{ background: PRESETS[t].fondo ?? "#0a1226" }}
                />
                {PRESETS[t].nombre}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
