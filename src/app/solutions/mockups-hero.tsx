"use client";

import { useEffect, useState } from "react";
import { AJUSTES_MENU_BASE } from "@/lib/solutions/menu-estilos";
import Telefono from "@/components/solutions/telefono";
import VistaPagina, { type DatosPagina } from "@/components/solutions/vista-pagina";
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
  /**
   * Otro negocio de muestra (0236): el link hub ya no es solo de
   * restaurantes. Un look puede traer su propio nombre, sus enlaces
   * (con íconos de redes), su rubro, su vitrina y su diseño fino.
   */
  muestra?: Partial<DatosPagina>;
};

const FOTO = {
  pasta: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=70",
  mesa: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=70",
  bowl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&q=70",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=70",
  lavacar: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=900&q=70",
  tenis: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=70",
  reloj: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=70",
  bolso: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=70",
  lentes: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=70",
};

/** Una boutique: la vitrina adentro del link hub, como la tienda de Linktree. */
const TIENDA: Partial<DatosPagina> = {
  nombre: "Nova Studio",
  bajada: "Moda y accesorios · envíos a todo el país",
  whatsapp: "5512345678",
  direccion: null,
  rubro: "boutique",
  moneda: "MXN",
  pais: "MX",
  links: [
    { id: "ig", etiqueta: "Instagram", url: "#", icono: "instagram", formato: "icono" },
    { id: "tk", etiqueta: "TikTok", url: "#", icono: "tiktok", formato: "icono" },
    { id: "wa", etiqueta: "WhatsApp", url: "#", icono: "whatsapp", formato: "icono" },
    { id: "t1", etiqueta: "Nueva colección", url: "#", icono: "link", formato: "titulo" },
    { id: "l1", etiqueta: "Ver todo el catálogo", url: "#", icono: "tienda", formato: "boton", descripcion: "Envío gratis desde $999" },
  ],
  seccionesMenu: ["Novedades", "Accesorios"],
  hayMenu: true,
  aceptaPedidos: false,
  diseno: { animacion: "subir", hover: "elevar", fondo: "liso", boton: "solido", logoForma: "circulo", logoTamano: "medio", alineacion: "centro", densidad: "compacta", vitrina: "destacados", redes: "arriba", titulo: "normal", encabezado: "tarjeta", piezas: "tarjeta", menu: "clasico", menuFuente: "auto", menuPortada: "tarjeta", menuAjustes: AJUSTES_MENU_BASE },
};

/** Un lavacar: servicios con precio y reserva por WhatsApp. */
const LAVACAR: Partial<DatosPagina> = {
  nombre: "AutoBrillo",
  bajada: "Lavado a mano, encerado y detailing · Bogotá",
  whatsapp: "3001234567",
  direccion: "Calle 85 #12-30",
  rubro: "lavacar",
  moneda: "COP",
  pais: "CO",
  links: [
    { id: "ig", etiqueta: "Instagram", url: "#", icono: "instagram", formato: "icono" },
    { id: "fb", etiqueta: "Facebook", url: "#", icono: "facebook", formato: "icono" },
    { id: "l1", etiqueta: "Reservar un turno", url: "#", icono: "reservar", formato: "boton", descripcion: "Lunes a sábado, 8 a 18" },
    { id: "l2", etiqueta: "Cómo llegar", url: "#", icono: "mapa", formato: "boton" },
    { id: "l3", etiqueta: "Escribinos", url: "#", icono: "whatsapp", formato: "boton" },
  ],
  seccionesMenu: ["Lavado", "Detailing"],
  hayMenu: true,
  aceptaPedidos: false,
  diseno: { animacion: "aparecer", hover: "brillo", fondo: "puntos", boton: "acabado", logoForma: "redondeado", logoTamano: "grande", alineacion: "izquierda", densidad: "normal", vitrina: "boton", redes: "arriba", titulo: "normal", encabezado: "tarjeta", piezas: "tarjeta", menu: "clasico", menuFuente: "auto", menuPortada: "tarjeta", menuAjustes: AJUSTES_MENU_BASE },
};

const LOOKS: Look[] = [
  {
    id: "tienda",
    nombre: "Tienda con vitrina",
    pie: "Productos con foto y precio adentro de la página · Neón · Técnica",
    pieza: "links",
    tema: "neon",
    fuente: "tecnica",
    estiloLinks: "lista",
    redondeo: "redondo",
    efecto: "plano",
    estiloPortada: "sin",
    foto: null,
    muestra: TIENDA,
  },
  {
    id: "lavacar",
    nombre: "Servicios y reservas",
    pie: "Un lavacar: servicios, redes y WhatsApp · Cielo · Redonda",
    pieza: "links",
    tema: "cielo",
    fuente: "redonda",
    estiloLinks: "lista",
    redondeo: "suave",
    efecto: "elevado",
    estiloPortada: "card",
    foto: FOTO.lavacar,
    muestra: LAVACAR,
  },
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
        ...(look.muestra ?? {}),
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

type TextoLook = { nombre: string; pie: string };

export default function MockupsHero({
  textos,
  carrusel,
}: {
  /** El nombre y la línea de cada diseño, en el idioma de la landing. */
  textos?: Partial<Record<Look["id"], TextoLook>>;
  carrusel?: { anterior: string; siguiente: string; lista: string };
} = {}) {
  const [activo, setActivo] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActivo((v) => (v + 1) % LOOKS.length), INTERVALO_MS);
    return () => clearInterval(t);
  }, [pausado]);

  const look = LOOKS[activo];
  const rotulo = (l: Look): TextoLook => textos?.[l.id] ?? { nombre: l.nombre, pie: l.pie };
  const c = carrusel ?? { anterior: "Diseño anterior", siguiente: "Diseño siguiente", lista: "Diseños de muestra" };
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
          {rotulo(look).nombre}
          <span className="block text-[12px] font-medium text-aventurea-ink-soft">{rotulo(look).pie}</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => ir(activo - 1)}
            aria-label={c.anterior}
            className="presionable grid h-9 w-9 place-items-center rounded-full border border-aventurea-line bg-white text-aventurea-navy"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label={c.lista}>
            {LOOKS.map((l, k) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={k === activo}
                aria-label={rotulo(l).nombre}
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
            aria-label={c.siguiente}
            className="presionable grid h-9 w-9 place-items-center rounded-full border border-aventurea-line bg-white text-aventurea-navy"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
