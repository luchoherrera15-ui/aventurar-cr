"use client";

import { useState } from "react";
import Telefono from "@/components/solutions/telefono";
import VistaPagina, { type DatosPagina } from "@/components/solutions/vista-pagina";
import { MockupCarta, MockupPase } from "@/components/solutions/mockup-pantallas";
import {
  PRESETS,
  paletaDelTema,
  TEMAS,
  type EstiloLinks,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";

/**
 * LOS TELÉFONOS DEL HÉROE — y el selector que los repinta.
 *
 * Pedido del dueño (4 sep 2026): que la landing sea «más interactiva,
 * más funcional, más informativa», y que «cada card tenga algo
 * distinto: la carta, el linktree, el pase de lealtad».
 *
 * ── CADA TELÉFONO CUENTA UNA COSA ──────────────────────────────────
 * Tres veces la misma pantalla con distinto color no vende tres
 * productos: vende un selector de temas. Así que cada aparato muestra
 * una pieza distinta de lo que trae Solutions —la carta, el linktree,
 * el pase— y el tema los repinta a los tres a la vez. Eso sí demuestra
 * las dos promesas juntas: son varias cosas, y son tuyas.
 *
 * ── POR QUÉ SE PUEDE TOCAR ─────────────────────────────────────────
 * La promesa de la página es «diseñados por vos». Escribirlo no
 * convence a nadie; dejar que el visitante toque un tema y vea los tres
 * teléfonos cambiar en el acto lo demuestra. Es el producto haciendo
 * la demostración, no una captura de él.
 *
 * El del medio no es una maqueta: monta `VistaPagina`, el MISMO
 * componente que sirve /s/<slug>. Los de los lados sí son maquetas, y
 * el porqué de cada una está en `mockup-pantallas.tsx`.
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

/**
 * Los tres del abanico: el del medio manda, los de los lados acompañan.
 * `pieza` decide QUÉ pantalla va adentro; el resto es su vestido.
 */
const ABANICO: {
  pieza: "carta" | "links" | "pase";
  rotulo: string;
  estiloLinks: EstiloLinks;
  redondeo: Redondeo;
}[] = [
  { pieza: "carta", rotulo: "Tu carta", estiloLinks: "lista", redondeo: "suave" },
  { pieza: "links", rotulo: "Tu página", estiloLinks: "grilla", redondeo: "redondo" },
  { pieza: "pase", rotulo: "Tu lealtad", estiloLinks: "lista", redondeo: "recto" },
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
          const acento = PRESETS[t].acentoSugerido;
          /* La barra de estado tiene que leerse sobre la pantalla que
             tiene debajo: en «claro» o «crema» los glifos blancos
             desaparecen. La tinta sale de la misma paleta que pinta el
             contenido, así que nunca se despareja. */
          const paleta = paletaDelTema(t, MUESTRA.colorFondo, acento);
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
              <Telefono ancho={central ? 268 : 236} tinta={paleta.tinta}>
                {v.pieza === "carta" && (
                  <MockupCarta
                    tema={t}
                    redondeo={v.redondeo}
                    acento={acento}
                    nombre={MUESTRA.nombre}
                  />
                )}
                {v.pieza === "pase" && (
                  <MockupPase tema={t} acento={acento} nombre={MUESTRA.nombre} />
                )}
                {v.pieza === "links" && (
                  <VistaPagina
                    inerte
                    className="min-h-full"
                    datos={{
                      ...MUESTRA,
                      colorAcento: acento,
                      tema: t,
                      estiloLinks: v.estiloLinks,
                      redondeo: v.redondeo,
                    }}
                  />
                )}
              </Telefono>
            </div>
          );
        })}
      </div>

      {/* ── Qué es cada uno ───────────────────────────────────────────
          Van en una fila aparte y no bajo cada teléfono: el abanico se
          solapa 58 px, así que un rótulo por aparato quedaría pisado por
          el de al lado. En el mismo orden que los teléfonos. */}
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
        {ABANICO.map((v, i) => (
          <li key={v.pieza} className="flex items-center gap-1.5 text-[12.5px] font-bold text-aventurea-ink-soft">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: PRESETS[trio[i]].acentoSugerido }}
            />
            {v.rotulo}
          </li>
        ))}
      </ul>

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
