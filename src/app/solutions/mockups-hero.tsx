"use client";

import { useState } from "react";
import Telefono from "@/components/solutions/telefono";
import VistaPagina from "@/components/solutions/vista-pagina";
import { MockupCarta, MockupPase, MUESTRA_PAGINA as MUESTRA } from "@/components/solutions/mockup-pantallas";
import {
  EFECTO,
  EFECTOS,
  ESTILOS_LINKS,
  FUENTE,
  FUENTES,
  PRESETS,
  REDONDEOS,
  TEMAS,
  paletaDelTema,
  pilaFuente,
  type Efecto,
  type EstiloLinks,
  type Fuente,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";

/**
 * EL TELÉFONO DEL HÉROE — uno solo, y el configurador al lado.
 *
 * Pedido del dueño (5 sep 2026): «prefiero que salga un solo mockup y
 * que se pueda cambiar el contenido y el tipo de diseño: ver muestras
 * en tiempo real de todos los tipos de diseño, en link hubs, en menús
 * digitales».
 *
 * ── POR QUÉ UNO Y NO TRES ──────────────────────────────────────────
 * Tres teléfonos en abanico muestran tres cosas de lejos; uno grande
 * con controles muestra UNA cosa de cerca y deja tocarla. Lo que se
 * vende acá no es «hay tres productos» (eso lo cuentan las cards de
 * abajo): es «vos lo diseñás». Y eso se demuestra dejando diseñar.
 *
 * ── ES EL EDITOR DE VERDAD, EN CHICO ───────────────────────────────
 * Los controles son los mismos que tiene el panel («Mi página»):
 * tema, fuente, puertas, bordes, efecto. Y el teléfono monta
 * `VistaPagina`, el MISMO componente que sirve /s/<slug>. Quien toca
 * acá está usando el producto, no mirando una captura de él. El menú
 * y el pase son maquetas (ver mockup-pantallas.tsx) pero se visten con
 * el mismo sistema, así que responden a los mismos controles.
 *
 * Los controles que no aplican a la pieza elegida se van, no se
 * apagan: un chip de «Efecto» sobre el pase de Wallet no cambiaría
 * nada, y un control que no hace nada enseña que los demás tampoco.
 */

type Pieza = "links" | "menu" | "pase";
const PIEZAS: { id: Pieza; nombre: string }[] = [
  { id: "links", nombre: "Link hub" },
  { id: "menu", nombre: "Menú digital" },
  { id: "pase", nombre: "Pase de lealtad" },
];
const ETIQUETA_ESTILO: Record<EstiloLinks, string> = { lista: "Lista", grilla: "Cuadrícula" };
const ETIQUETA_REDONDEO: Record<Redondeo, string> = { recto: "Recto", suave: "Suave", redondo: "Redondo" };

/** Un chip del configurador. En el módulo, no en el render (ver `Ancla` en vista-pagina.tsx). */
function Chip({
  activo,
  onClick,
  children,
  style,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={style}
      className={`presionable inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${
        activo
          ? "border-aventurea-navy bg-white text-aventurea-navy shadow-plano"
          : "border-aventurea-line bg-white/70 text-aventurea-ink-soft hover:border-aventurea-navy/40"
      }`}
    >
      {children}
    </button>
  );
}

/** Un grupo de chips con su rótulo chico arriba. */
function Grupo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">{rotulo}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function MockupsHero() {
  const [pieza, setPieza] = useState<Pieza>("links");
  const [tema, setTema] = useState<Tema>("noche");
  const [fuente, setFuente] = useState<Fuente>("redonda");
  const [estiloLinks, setEstiloLinks] = useState<EstiloLinks>("grilla");
  const [redondeo, setRedondeo] = useState<Redondeo>("redondo");
  const [efecto, setEfecto] = useState<Efecto>("vidrio");

  const acento = PRESETS[tema].acentoSugerido;
  /* La barra de estado del teléfono toma la tinta del tema: sobre
     «claro» o «crema» los glifos blancos desaparecen. */
  const paleta = paletaDelTema(tema, MUESTRA.colorFondo, acento);

  return (
    <div className="flex flex-col items-center gap-6 xl:flex-row xl:items-start xl:justify-center xl:gap-8">
      <Telefono ancho={300} tinta={paleta.tinta} className="shrink-0">
        {pieza === "links" && (
          <VistaPagina
            inerte
            className="min-h-full"
            datos={{
              ...MUESTRA,
              colorAcento: acento,
              tema,
              estiloLinks,
              redondeo,
              fuente,
              efecto,
              estiloPortada: "card",
            }}
          />
        )}
        {pieza === "menu" && (
          <MockupCarta tema={tema} redondeo={redondeo} acento={acento} fuente={fuente} nombre={MUESTRA.nombre} />
        )}
        {pieza === "pase" && <MockupPase tema={tema} acento={acento} fuente={fuente} nombre={MUESTRA.nombre} />}
      </Telefono>

      {/* ── El configurador ─────────────────────────────────────── */}
      <div className="flex w-full max-w-[360px] flex-col gap-4">
        <Grupo rotulo="Qué querés ver">
          {PIEZAS.map((p) => (
            <Chip key={p.id} activo={pieza === p.id} onClick={() => setPieza(p.id)}>
              {p.nombre}
            </Chip>
          ))}
        </Grupo>

        <Grupo rotulo="Tema">
          {TEMAS.filter((t) => t !== "marca").map((t) => (
            <Chip key={t} activo={tema === t} onClick={() => setTema(t)}>
              <span
                aria-hidden
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ background: PRESETS[t].fondo ?? MUESTRA.colorFondo }}
              />
              {PRESETS[t].nombre}
            </Chip>
          ))}
        </Grupo>

        {/* Cada chip, escrito con su propia letra: verla dice más que su nombre. */}
        <Grupo rotulo="Fuente">
          {FUENTES.map((x) => (
            <Chip key={x} activo={fuente === x} onClick={() => setFuente(x)} style={{ fontFamily: pilaFuente(x) }}>
              {FUENTE[x].nombre}
            </Chip>
          ))}
        </Grupo>

        {pieza !== "pase" && (
          <Grupo rotulo="Bordes">
            {REDONDEOS.map((r) => (
              <Chip key={r} activo={redondeo === r} onClick={() => setRedondeo(r)}>
                {ETIQUETA_REDONDEO[r]}
              </Chip>
            ))}
          </Grupo>
        )}

        {pieza === "links" && (
          <>
            <Grupo rotulo="Tus puertas">
              {ESTILOS_LINKS.map((e) => (
                <Chip key={e} activo={estiloLinks === e} onClick={() => setEstiloLinks(e)}>
                  {ETIQUETA_ESTILO[e]}
                </Chip>
              ))}
            </Grupo>
            <Grupo rotulo="Efecto de las tarjetas">
              {EFECTOS.map((x) => (
                <Chip key={x} activo={efecto === x} onClick={() => setEfecto(x)}>
                  {EFECTO[x].nombre}
                </Chip>
              ))}
            </Grupo>
          </>
        )}

        <p className="text-[12px] leading-snug text-aventurea-ink-soft">
          Todo esto lo elegís desde tu panel, mirando cómo queda al lado — y también la portada, tus
          colores y una foto de fondo por botón.
        </p>
      </div>
    </div>
  );
}
