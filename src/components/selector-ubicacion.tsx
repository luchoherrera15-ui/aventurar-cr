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

/** Un resultado del geocodificador, ya masticado. */
type LugarEncontrado = { label: string; lat: number; lng: number };

export default function SelectorUbicacion({
  latitudInicial,
  longitudInicial,
  alCambiar,
  claseCampo,
  claseBoton,
}: {
  latitudInicial: number | null;
  longitudInicial: number | null;
  /**
   * Aviso hacia afuera cada vez que el pin cambia (o se quita). Existe
   * porque no todos los formularios leen los inputs ocultos: el de
   * Lealtad guarda con una action que lee SU estado, así que necesita
   * enterarse en vivo. Opcional — el editar de mi-negocio sigue igual.
   */
  alCambiar?: (punto: { lat: number; lng: number } | null) => void;
  /** Clases del campo y el botón del buscador, para que el selector se
   *  vista como la pantalla que lo aloja (el panel de Lealtad es
   *  oscuro; el editar de mi-negocio, claro). */
  claseCampo?: string;
  claseBoton?: string;
}) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<MapaLeaflet | null>(null);
  const marcadorRef = useRef<MarcadorLeaflet | null>(null);
  /** `poner` nace dentro del efecto del mapa; el buscador vive afuera
   *  y le llega por acá. */
  const ponerRef = useRef<((lat: number, lng: number) => void) | null>(null);
  // En ref y no en el closure: el efecto del mapa corre una vez y el
  // callback puede cambiar por render. Se sincroniza en un efecto sin
  // deps (cada render) porque escribir un ref DURANTE el render es lo
  // que la regla del compilador de React prohibe.
  const alCambiarRef = useRef(alCambiar);
  useEffect(() => {
    alCambiarRef.current = alCambiar;
  });

  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    latitudInicial !== null && longitudInicial !== null
      ? { lat: latitudInicial, lng: longitudInicial }
      : null,
  );
  const [buscandome, setBuscandome] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<LugarEncontrado[] | null>(null);

  /** El único camino del punto hacia afuera: estado + aviso. */
  function fijar(p: { lat: number; lng: number } | null) {
    setPunto(p);
    alCambiarRef.current?.(p);
  }

  /**
   * ── EL BUSCADOR (pedido del dueño, 28 ago 2026: «que haya un mapa y
   * uno pueda buscar y colocar un PIN») ────────────────────────────────
   *
   * Nominatim, el geocodificador de OpenStreetMap: gratis y sin llave,
   * igual que los tiles — mismo criterio de la cabecera. Su política de
   * uso pide volumen bajo, y esto es una búsqueda por clic de un dueño
   * registrando su local, no un autocompletar por tecla (por eso NO se
   * dispara en `onChange`). `accept-language=es` para que «San José»
   * no vuelva como «Saint Joseph». Sin `countrycodes`: se busca en
   * cualquier país, que es adonde vamos.
   */
  async function buscarLugar() {
    const q = busqueda.trim();
    if (!q || buscando) return;
    setBuscando(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=es&q=${encodeURIComponent(q)}`,
      );
      const crudos = (await r.json()) as { display_name: string; lat: string; lon: string }[];
      setResultados(
        crudos.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) })),
      );
    } catch {
      // Sin red o Nominatim caído: la lista vacía muestra su aviso y el
      // mapa sigue ahí — tocar el pin a mano nunca dependió de esto.
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  function elegirLugar(r: LugarEncontrado) {
    mapaRef.current?.setView([r.lat, r.lng], 17);
    ponerRef.current?.(r.lat, r.lng);
    setResultados(null);
    // Se deja lo esencial en el campo (los display_name de Nominatim
    // son kilométricos): las dos primeras piezas alcanzan para saber
    // qué se eligió.
    setBusqueda(r.label.split(",").slice(0, 2).join(","));
  }

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
            fijar({ lat: p.lat, lng: p.lng });
          });
        }
        fijar({ lat, lng });
      }

      if (punto) poner(punto.lat, punto.lng);
      mapa.on("click", (e) => poner(e.latlng.lat, e.latlng.lng));

      mapaRef.current = mapa;
      ponerRef.current = poner;
      limpiar = () => {
        mapa.remove();
        mapaRef.current = null;
        marcadorRef.current = null;
        ponerRef.current = null;
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
        fijar({ lat: latitude, lng: longitude });
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

      {/* El buscador. Botón `type="button"` y Enter interceptado: este
          componente vive DENTRO de formularios ajenos (el editar de
          mi-negocio, el alta de Lealtad) y buscar no puede enviarlos.
          La lista va por encima de los panes de Leaflet (z-index 400). */}
      <div className="relative z-[500] mb-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void buscarLugar();
              }
            }}
            placeholder="Buscá tu dirección o un punto conocido"
            aria-label="Buscar un lugar en el mapa"
            className={
              claseCampo ??
              "w-full rounded-lg border border-aventurea-line bg-white px-3 py-2 text-[13px] text-aventurea-ink outline-none placeholder:text-aventurea-ink-soft"
            }
          />
          <button
            type="button"
            onClick={() => void buscarLugar()}
            disabled={buscando || !busqueda.trim()}
            className={
              claseBoton ??
              "shrink-0 rounded-lg border border-aventurea-line bg-white px-3 py-1.5 text-[12.5px] font-bold text-aventurea-navy disabled:opacity-50"
            }
          >
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {resultados && (
          <ul className="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-xl border border-aventurea-line bg-white shadow-lg">
            {resultados.length === 0 && (
              <li className="px-3 py-2.5 text-[12.5px] text-aventurea-ink-soft">
                No encontramos ese lugar. Probá con el barrio o el cantón — o
                tocá el mapa directamente.
              </li>
            )}
            {resultados.map((r, i) => (
              <li key={i} className={i > 0 ? "border-t border-aventurea-line" : ""}>
                <button
                  type="button"
                  onClick={() => elegirLugar(r)}
                  className="block w-full px-3 py-2.5 text-left text-[12.5px] leading-snug text-aventurea-ink hover:bg-aventurea-cream-2"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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
                fijar(null);
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
