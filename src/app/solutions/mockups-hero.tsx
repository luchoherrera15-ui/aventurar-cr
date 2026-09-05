"use client";

import { useEffect, useState } from "react";
import Telefono from "@/components/solutions/telefono";
import VistaPagina from "@/components/solutions/vista-pagina";
import { MockupCarta, MUESTRA_PAGINA as MUESTRA } from "@/components/solutions/mockup-pantallas";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import {
  PRESETS,
  paletaDelTema,
  type Efecto,
  type EstiloLinks,
  type EstiloPortada,
  type Fuente,
  type Redondeo,
  type Tema,
} from "@/lib/solutions/temas";

/**
 * EL TELÉFONO DEL HÉROE — uno solo, con diseños que pasan como slides.
 *
 * Pedido del dueño (5 sep 2026): «quitá las opciones configurables y
 * generá uno con algún fondo de comidas o de portada, que sean como
 * slides, con diferentes diseños: uno con todo el fondo, otro solo una
 * parte, y así».
 *
 * ── POR QUÉ SLIDES Y NO CONTROLES ──────────────────────────────────
 * El configurador con chips era el editor en chico: exacto, pero
 * pedía trabajo al visitante. Un slide muestra un diseño TERMINADO,
 * con foto, sin que nadie toque nada — que es lo que el negocio se
 * imagina cuando piensa «mi página». Los controles siguen existiendo
 * donde importan: en el panel.
 *
 * Cada «look» es una combinación real del sistema (tema, cara, forma,
 * acabado, qué hace la portada) más una foto. El teléfono monta
 * `VistaPagina`, el MISMO componente que sirve /s/<slug>: lo que
 * pasa por acá es lo que el negocio puede tener, no una ilustración.
 *
 * ── LAS FOTOS ──────────────────────────────────────────────────────
 * Vienen de Unsplash, como las de los seeds de demo del sitio (el host
 * ya está en next.config). Son de muestra: el negocio sube las suyas.
 *
 * ── EL MOVIMIENTO ──────────────────────────────────────────────────
 * Fundido de 420 ms con la curva del sistema (solo `opacity`, que es
 * de lo que globals.css permite animar). Avanza solo cada 4,5 s, se
 * frena al pasar el mouse o al tocar un punto, y con
 * `prefers-reduced-motion` NO avanza solo: quien pidió menos
 * movimiento pasa los slides a mano con las flechas o los puntos.
 */

type Look = {
  id: string;
  nombre: string;
  pie: string;
  pieza: "links" | "menu";
  tema: Tema;
  fuente: Fuente;
  estiloLinks: EstiloLinks;
  redondeo: Redondeo;
  efecto: Efecto;
  estiloPortada: EstiloPortada;
  foto: string | null;
};

const FOTO = {
  pasta: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=70",
  mesa: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=70",
  bowl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&q=70",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=70",
};

const LOOKS: Look[] = [
  {
    id: "completa",
    nombre: "Portada completa",
    pie: "La foto de borde a borde · Noche · Elegante",
    pieza: "links",
    tema: "noche",
    fuente: "elegante",
    estiloLinks: "grilla",
    redondeo: "redondo",
    efecto: "vidrio",
    estiloPortada: "completa",
    foto: FOTO.pasta,
  },
  {
    id: "fondo",
    nombre: "Foto de fondo",
    pie: "La foto viste la página entera · Vino · Condensada",
    pieza: "links",
    tema: "vino",
    fuente: "condensada",
    estiloLinks: "lista",
    redondeo: "suave",
    efecto: "elevado",
    estiloPortada: "fondo",
    foto: FOTO.mesa,
  },
  {
    id: "tarjeta",
    nombre: "Foto en la tarjeta",
    pie: "Solo en el encabezado · Crema · Editorial",
    pieza: "links",
    tema: "crema",
    fuente: "editorial",
    estiloLinks: "lista",
    redondeo: "suave",
    efecto: "plano",
    estiloPortada: "card",
    foto: FOTO.bowl,
  },
  {
    id: "menu",
    nombre: "Menú digital",
    pie: "Con su portada · Claro · Del sitio",
    pieza: "menu",
    tema: "claro",
    fuente: "sistema",
    estiloLinks: "lista",
    redondeo: "suave",
    efecto: "plano",
    estiloPortada: "card",
    foto: FOTO.pizza,
  },
  {
    id: "marca",
    nombre: "Solo tu marca",
    pie: "Sin foto: colores y degradado · Bosque · Redonda",
    pieza: "links",
    tema: "bosque",
    fuente: "redonda",
    estiloLinks: "grilla",
    redondeo: "redondo",
    efecto: "degradado",
    estiloPortada: "sin",
    foto: null,
  },
];

const INTERVALO_MS = 4500;

/** La pantalla de un look. En el módulo, no en el render (ver `Ancla` en vista-pagina.tsx). */
function Pantalla({ look }: { look: Look }) {
  const acento = PRESETS[look.tema].acentoSugerido;
  if (look.pieza === "menu") {
    return (
      <MockupCarta
        tema={look.tema}
        redondeo={look.redondeo}
        acento={acento}
        fuente={look.fuente}
        nombre={MUESTRA.nombre}
        portadaUrl={look.foto}
      />
    );
  }
  return (
    <VistaPagina
      inerte
      className="min-h-full"
      datos={{
        ...MUESTRA,
        fotoPortadaUrl: look.foto,
        colorAcento: acento,
        tema: look.tema,
        estiloLinks: look.estiloLinks,
        redondeo: look.redondeo,
        fuente: look.fuente,
        efecto: look.efecto,
        estiloPortada: look.estiloPortada,
      }}
    />
  );
}

export default function MockupsHero() {
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActivo((v) => (v + 1) % LOOKS.length), INTERVALO_MS);
    return () => clearInterval(t);
  }, [pausado]);

  const look = LOOKS[activo];
  /* La barra de estado del teléfono toma la tinta del tema del slide
     activo: sobre «claro» o «crema» los glifos blancos desaparecen. */
  const paleta = paletaDelTema(look.tema, MUESTRA.colorFondo, PRESETS[look.tema].acentoSugerido);
  const ir = (n: number) => setActivo((n + LOOKS.length) % LOOKS.length);

  return (
    <div
      className="flex flex-col items-center gap-4"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <Telefono ancho={300} tinta={paleta.tinta}>
        {/* Todos los slides montados y apilados; solo el activo se ve.
            Montarlos todos es lo que hace que el fundido sea un fundido
            y no un parpadeo: el siguiente ya está pintado (y su foto ya
            cargada) cuando le toca aparecer. */}
        <div className="relative h-full">
          {LOOKS.map((l, k) => {
            const visible = k === activo;
            return (
              <div
                key={l.id}
                aria-hidden={!visible}
                className="absolute inset-0 overflow-y-auto transition-opacity duration-[420ms] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? "auto" : "none",
                  transitionTimingFunction: "var(--ease-bookea)",
                }}
              >
                <Pantalla look={l} />
              </div>
            );
          })}
        </div>
      </Telefono>

      {/* ── Qué diseño es, y los puntos para pasar ───────────────── */}
      <div className="flex w-full max-w-[360px] flex-col items-center gap-2 text-center">
        <p className="text-[14px] font-extrabold text-aventurea-navy" aria-live="polite">
          {look.nombre}
          <span className="block text-[12px] font-medium text-aventurea-ink-soft">{look.pie}</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => ir(activo - 1)}
            aria-label="Diseño anterior"
            className="presionable grid h-9 w-9 place-items-center rounded-full border border-aventurea-line bg-white text-aventurea-navy"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Diseños de muestra">
            {LOOKS.map((l, k) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={k === activo}
                aria-label={l.nombre}
                onClick={() => ir(k)}
                className={`h-2.5 rounded-full transition-[width,background-color] duration-[200ms] ${
                  k === activo ? "w-6 bg-aventurea-navy" : "w-2.5 bg-aventurea-line hover:bg-aventurea-navy/40"
                }`}
                style={{ transitionTimingFunction: "var(--ease-bookea)" }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => ir(activo + 1)}
            aria-label="Diseño siguiente"
            className="presionable grid h-9 w-9 place-items-center rounded-full border border-aventurea-line bg-white text-aventurea-navy"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
