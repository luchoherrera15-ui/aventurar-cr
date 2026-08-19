"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapaLeaflet, Marker as MarcadorLeaflet } from "leaflet";

/**
 * EL SELECTOR DE UBICACIÓN: un mapa donde el negocio pone su pin.
 *
 * ------------------------------------------------------------------
 * POR QUÉ UN MAPA Y NO SEGUIR PIDIENDO EL LINK DE GOOGLE MAPS
 * ------------------------------------------------------------------
 * Antes la única forma de tener ubicación era pegar el link de Google
 * Maps, y eso pedía tres pasos fuera de Bookea (abrir Maps, buscarse,
 * tocar Compartir) que casi nadie completaba: al día de hoy CERO
 * negocios del directorio tienen coordenadas. Sin coordenadas no hay
 * mapa, no hay "cerca de vos" y no hay forma de ordenar por distancia.
 *
 * Acá se toca el mapa y listo. El link de Google Maps se queda como
 * atajo alternativo —quien ya lo tiene lo pega y se acabó— pero deja
 * de ser el único camino.
 *
 * ------------------------------------------------------------------
 * LEAFLET + OPENSTREETMAP, SIN LLAVE DE API
 * ------------------------------------------------------------------
 * Google Maps cobra por carga de mapa y exige una llave que habría que
 * guardar, rotar y limitar por dominio. OpenStreetMap con Leaflet es
 * gratis, sin llave y suficiente para lo único que se necesita:
 * apuntar un punto. Si algún día hace falta Street View o rutas, ahí
 * se evalúa pagar.
 *
 * Leaflet se carga con `import()` dinámico dentro de un efecto porque
 * toca `window` al importarse — con un import normal, el build de
 * Next se cae al prerenderizar esta página en el servidor.
 */

/** Centro del Valle Central: dónde abre el mapa si no hay nada guardado. */
const CENTRO_CR: [number, number] = [9.9333, -84.0833];

export default function SelectorUbicacion({
  latitudInicial,
  longitudInicial,
}: {
  latitudInicial: number | null;
  longitudInicial: number | null;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<MapaLeaflet | null>(null);
  const marcadorRef = useRef<MarcadorLeaflet | null>(null);

  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    latitudInicial !== null && longitudInicial !== null
      ? { lat: latitudInicial, lng: longitudInicial }
      : null,
  );
  const [buscandome, setBuscandome] = useState(false);

  useEffect(() => {
    let vivo = true;
    let limpiar: (() => void) | undefined;

    (async () => {
      const L = (await import("leaflet")).default;
      // El CSS de Leaflet también dinámico: sin él los tiles salen
      // apilados en una columna, que es el síntoma clásico.
      await import("leaflet/dist/leaflet.css");
      if (!vivo || !contenedor.current || mapaRef.current) return;

      const inicio = punto ? ([punto.lat, punto.lng] as [number, number]) : CENTRO_CR;
      const mapa = L.map(contenedor.current).setView(inicio, punto ? 16 : 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(mapa);

      // El ícono por defecto de Leaflet apunta a imágenes que el bundler
      // no copia; se dibuja uno propio para no depender de eso.
      const icono = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:#0f4c9e;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      function poner(lat: number, lng: number) {
        if (marcadorRef.current) {
          marcadorRef.current.setLatLng([lat, lng]);
        } else {
          marcadorRef.current = L.marker([lat, lng], { icon: icono, draggable: true }).addTo(mapa);
          marcadorRef.current.on("dragend", () => {
            const p = marcadorRef.current!.getLatLng();
            setPunto({ lat: p.lat, lng: p.lng });
          });
        }
        setPunto({ lat, lng });
      }

      if (punto) poner(punto.lat, punto.lng);
      mapa.on("click", (e) => poner(e.latlng.lat, e.latlng.lng));

      mapaRef.current = mapa;
      limpiar = () => {
        mapa.remove();
        mapaRef.current = null;
        marcadorRef.current = null;
      };
    })();

    return () => {
      vivo = false;
      limpiar?.();
    };
    // Solo al montar: el mapa se maneja solo desde acá en adelante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** "Usar mi ubicación": el navegador la da con permiso. */
  function ubicarme() {
    if (!navigator.geolocation) return;
    setBuscandome(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandome(false);
        const { latitude, longitude } = pos.coords;
        mapaRef.current?.setView([latitude, longitude], 16);
        // Si el pin ya existe se mueve; si no, el efecto de arriba lo
        // crea la próxima vez que se toque el mapa. Se guarda el punto
        // igual: el dato es el punto, no el marcador.
        marcadorRef.current?.setLatLng([latitude, longitude]);
        setPunto({ lat: latitude, lng: longitude });
      },
      () => setBuscandome(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div>
      {/* Los dos campos que de verdad se guardan. Van ocultos porque el
          dato lo pone el mapa, no el teclado — pero son inputs de
          verdad, así que el form los manda como cualquier otro campo y
          la action del servidor no necesita nada especial. */}
      <input type="hidden" name="latitud" value={punto?.lat ?? ""} />
      <input type="hidden" name="longitud" value={punto?.lng ?? ""} />

      <div
        ref={contenedor}
        className="h-[260px] w-full overflow-hidden rounded-xl border border-aventurea-line"
        style={{ background: "#e8ecf6" }}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={ubicarme}
          disabled={buscandome}
          className="rounded-lg border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-navy disabled:opacity-50"
        >
          {buscandome ? "Buscándote…" : "Usar mi ubicación"}
        </button>
        {punto ? (
          <>
            <span className="text-[12px] font-bold text-aventurea-green">
              ✓ Pin puesto ({punto.lat.toFixed(5)}, {punto.lng.toFixed(5)})
            </span>
            <button
              type="button"
              onClick={() => {
                if (marcadorRef.current) {
                  marcadorRef.current.remove();
                  marcadorRef.current = null;
                }
                setPunto(null);
              }}
              className="text-[12px] font-bold text-red-700 underline"
            >
              Quitar
            </button>
          </>
        ) : (
          <span className="text-[12px] text-aventurea-ink-soft">
            Tocá el mapa donde queda tu negocio.
          </span>
        )}
      </div>
    </div>
  );
}
