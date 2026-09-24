import type { Celebracion } from "@/lib/celebrar/tipos";
import { rellenarConCelebracion, type DatosCelebracionParaDocumento } from "./esquema";

/** Lo que un documento necesita saber de la celebración para rellenarse (nombre, fecha, lugar). */
export function datosParaDocumento(c: Celebracion): DatosCelebracionParaDocumento {
  return {
    tipo: c.tipo,
    nombre: c.nombre,
    fecha: c.fecha,
    hora: c.hora,
    lugarNombre: c.lugar_nombre,
    direccion: c.direccion,
    mapsUrl: c.maps_url,
  };
}

export { rellenarConCelebracion };
