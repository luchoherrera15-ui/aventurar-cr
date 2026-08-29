"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapaLeaflet, TileLayer } from "leaflet";

/**
 * EL MAPA DE LECTURA: un punto en el mundo, para mirar.
 *
 * Es el hermano de solo-vista de `selector-ubicacion.tsx` (ese pone el
 * pin, este lo muestra) y hereda sus dos decisiones de fondo:
 *
 * · LEAFLET + OPENSTREETMAP, SIN LLAVE. Google Maps cobra por carga y
 *   exige una llave que habría que guardar, rotar y limitar por
 *   dominio; OSM es gratis y para mostrar UN punto sobra. La pregunta
 *   del dueño («¿Google Maps o mapas normales?») se respondió así el
 *   28 ago 2026: mapas normales — el día que hagan falta rutas o
 *   Street View, ahí se evalúa pagar.
 *
 * · SATÉLITE DE ESRI con el mismo botón: para reconocer un local, la
 *   foto aérea del barrio dice más que el plano.
 *
 * `scrollWheelZoom` apagado a propósito: este mapa vive DENTRO de una
 * ficha que scrollea, y un mapa que se roba la rueda del mouse a mitad
 * de página es la trampa clásica de los embeds. Zoom con los botones.
 *
 * Leaflet entra por `import()` dinámico porque toca `window` al
 * importarse — con un import normal el build se cae al prerenderizar.
 */
export default function MapaPunto({
  latitud,
  longitud,
  zoom = 16,
  altoClase = "h-[200px]",
}: {
  latitud: number;
  longitud: number;
  zoom?: number;
  /** El alto lo decide quien lo aloja (clases de Tailwind). */
  altoClase?: string;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<MapaLeaflet | null>(null);
  const capasRef = useRef<{ calles: TileLayer; satelite: TileLayer } | null>(null);
  const [vistaSatelite, setVistaSatelite] = useState(false);

  /**
   * El mapa vive al FONDO de la ficha, pero antes se importaba Leaflet
   * (~145 KB de JS + su CSS) y se pedían los tiles de OSM al hidratar,
   * para algo que la mayoría nunca llega a ver. Ahora todo eso espera a
   * que el contenedor se ACERQUE al viewport: 400px de colchón para que
   * el import y los tiles lleguen antes que el scroll y nadie vea el
   * mapa armarse. Si el navegador no trae IntersectionObserver (viejo o
   * de prueba), se arranca en `true` desde el estado inicial — cargar
   * de más es el fallo bueno, y así no hay setState síncrono en el
   * efecto.
   */
  const [cerca, setCerca] = useState<boolean>(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    if (cerca) return;
    const el = contenedor.current;
    if (!el) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setCerca(true);
      },
      { rootMargin: "400px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [cerca]);

  useEffect(() => {
    // Sin acercarse, ni el import ni los tiles: ese es todo el ahorro.
    if (!cerca) return;

    let vivo = true;
    let limpiar: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      // El CSS de Leaflet también dinámico: sin él los tiles salen
      // apilados en una columna, que es el síntoma clásico.
      await import("leaflet/dist/leaflet.css");
      if (!vivo || !contenedor.current || mapaRef.current) return;

      // Quien pidió menos movimiento no tiene por qué ver los tiles
      // aparecer en fundido ni el zoom animado.
      const menosMovimiento = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      const mapa = L.map(contenedor.current, {
        scrollWheelZoom: false,
        fadeAnimation: !menosMovimiento,
        zoomAnimation: !menosMovimiento,
        markerZoomAnimation: !menosMovimiento,
      }).setView([latitud, longitud], zoom);
      const calles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      });
      const satelite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri — World Imagery", maxZoom: 19 },
      );
      calles.addTo(mapa);
      capasRef.current = { calles, satelite };

      // El mismo pin dibujado del selector: el ícono por defecto de
      // Leaflet apunta a imágenes que el bundler no copia.
      const icono = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:#0f4c9e;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([latitud, longitud], { icon: icono }).addTo(mapa);

      mapaRef.current = mapa;
      limpiar = () => {
        mapa.remove();
        mapaRef.current = null;
        capasRef.current = null;
      };
    })();

    return () => {
      vivo = false;
      limpiar?.();
    };
    // Solo `cerca`: el punto no cambia en vivo en una ficha pública,
    // así que latitud/longitud/zoom quedan fuera a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerca]);

  function alternarVista() {
    const mapa = mapaRef.current;
    const capas = capasRef.current;
    if (!mapa || !capas) return;
    if (vistaSatelite) {
      mapa.removeLayer(capas.satelite);
      capas.calles.addTo(mapa);
    } else {
      mapa.removeLayer(capas.calles);
      capas.satelite.addTo(mapa);
    }
    setVistaSatelite(!vistaSatelite);
  }

  return (
    <div className="relative">
      <div ref={contenedor} className={`${altoClase} w-full`} style={{ background: "#e8ecf6" }} />
      <button
        type="button"
        onClick={alternarVista}
        className="absolute right-2 top-2 z-[500] rounded-lg border border-aventurea-line bg-white/95 px-2.5 py-1 text-[11.5px] font-bold text-aventurea-navy shadow-sm"
      >
        {vistaSatelite ? "Mapa" : "Satélite"}
      </button>
    </div>
  );
}
