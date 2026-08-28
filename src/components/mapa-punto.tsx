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

  useEffect(() => {
    let vivo = true;
    let limpiar: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      // El CSS de Leaflet también dinámico: sin él los tiles salen
      // apilados en una columna, que es el síntoma clásico.
      await import("leaflet/dist/leaflet.css");
      if (!vivo || !contenedor.current || mapaRef.current) return;

      const mapa = L.map(contenedor.current, { scrollWheelZoom: false }).setView(
        [latitud, longitud],
        zoom,
      );
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
    // Solo al montar: el punto no cambia en vivo en una ficha pública.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
