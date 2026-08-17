import { planIncluyeTipo, planQueDesbloquea } from "./planes";
import { esIconoSello, iconoDelSello, type IconoSello } from "./iconos-sello";
import {
  esTipoTarjeta,
  validarBeneficio,
  TIPOS_TARJETA,
  type ConfigBeneficio,
  type TipoTarjeta,
} from "./tipos-tarjeta";
import { esUrlDeNuestroStorage } from "@/lib/storage-publico";

/**
 * LA TARJETA QUE VIAJA CON EL ALTA de /lealtad/nuevo.
 *
 * El wizard de la primera tarjeta manda, junto con el nombre del
 * negocio y el paquete, TODO lo que la persona armó en los cinco pasos:
 * el tipo, el beneficio, los colores, el icono del sello y las
 * imágenes. Este archivo es el que decide si eso se puede guardar.
 *
 * ------------------------------------------------------------------
 * MISMOS CHEQUEOS QUE `crearTarjeta`, A PROPÓSITO
 * ------------------------------------------------------------------
 * `crear-actions.ts` (la segunda tarjeta en adelante) ya valida cada
 * uno de estos campos, y con razones escritas al lado de cada regla.
 * Acá se validan IGUAL —mismo regex de color, misma exigencia de que
 * las URLs sean de nuestro storage, mismo mensaje de upsell cuando el
 * paquete no trae el tipo— porque dos puertas al mismo dato con reglas
 * distintas son un agujero: lo que una rechaza entra por la otra.
 *
 * Vive en la lib y es LÓGICA PURA (el único acceso al mundo es la
 * variable de entorno que ya usa `esUrlDeNuestroStorage`): se puede
 * testear entera sin Supabase.
 *
 * El bucket es `comprobantes` y no `ranchos-fotos`: el wizard de alta
 * sube ahí desde siempre (el negocio todavía no existe, así que no hay
 * carpeta de rancho a la cual subir), igual que el logo del flujo
 * viejo en `nuevo/actions.ts`.
 */

const HEX = /^#[0-9A-Fa-f]{6}$/;
const BUCKET_DEL_ALTA = "comprobantes";

/** Lo que manda el navegador. Todo opcional: el servidor no confía. */
export type TarjetaDeAlta = {
  modo?: string | null;
  beneficio?: ConfigBeneficio | null;
  colorFondo?: string | null;
  colorSello?: string | null;
  iconoSello?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
};

/** Lo que sale de la validación: campos limpios, o null si no vino. */
export type TarjetaAltaValidada = {
  modo: TipoTarjeta | null;
  /** Presente exactamente cuando `modo` está presente. */
  beneficio: ConfigBeneficio | null;
  colorFondo: string | null;
  colorSello: string | null;
  /** Ya filtrado: solo sobrevive en tarjetas de sellos (0145). */
  iconoSello: IconoSello | null;
  logoUrl: string | null;
  bannerUrl: string | null;
};

export type ResultadoTarjetaAlta =
  | { ok: true; tarjeta: TarjetaAltaValidada | null }
  | { ok: false; motivo: string };

/** "" y espacios cuentan como «no vino». */
function limpiar(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  return texto || null;
}

export function validarTarjetaDeAlta(
  cruda: TarjetaDeAlta | null | undefined,
  plan: string,
): ResultadoTarjetaAlta {
  if (!cruda) return { ok: true, tarjeta: null };

  // ── El tipo, contra el paquete ELEGIDO ──────────────────────────
  // El mensaje dice CUÁL paquete lo abre — mismo texto que
  // `crearTarjeta`: un «no podés» a secas no se puede ni obedecer.
  const modoCrudo = limpiar(cruda.modo);
  let modo: TipoTarjeta | null = null;
  if (modoCrudo !== null) {
    if (!esTipoTarjeta(modoCrudo)) {
      return { ok: false, motivo: "Ese tipo de tarjeta no existe." };
    }
    modo = modoCrudo;
    if (!planIncluyeTipo(plan, modo)) {
      const abre = planQueDesbloquea(modo);
      const nombreTipo = TIPOS_TARJETA[modo].nombre.toLowerCase();
      return {
        ok: false,
        motivo: abre
          ? `Las tarjetas de ${nombreTipo} vienen con el paquete ${abre.nombre}. Elegí ese paquete para armarla.`
          : `Ese paquete no incluye las tarjetas de ${nombreTipo}.`,
      };
    }
  }

  // ── El beneficio, DEL MISMO TIPO que la tarjeta ─────────────────
  // Sin esto se guardaría una tarjeta de sellos con la config de una
  // gift card: el pase se dibujaría de una forma y el canje se
  // resolvería de otra (misma regla que `crearTarjeta`).
  let beneficio: ConfigBeneficio | null = null;
  if (modo !== null) {
    const esperado: string = modo === "descuento" ? "descuento" : modo;
    if (cruda.beneficio?.tipo !== esperado) {
      return { ok: false, motivo: "La configuración no corresponde a ese tipo de tarjeta." };
    }
    const invalido = validarBeneficio(cruda.beneficio);
    if (invalido) return { ok: false, motivo: invalido };
    beneficio = cruda.beneficio;
  } else if (cruda.beneficio) {
    // Un beneficio sin tipo de tarjeta no tiene contra qué validarse.
    return { ok: false, motivo: "La configuración no corresponde a ese tipo de tarjeta." };
  }

  // ── Los colores (mismo criterio que la 0122) ────────────────────
  const colorFondo = limpiar(cruda.colorFondo);
  if (colorFondo !== null && !HEX.test(colorFondo)) {
    return { ok: false, motivo: "El color de fondo tiene que ser #RRGGBB." };
  }
  const colorSello = limpiar(cruda.colorSello);
  if (colorSello !== null && !HEX.test(colorSello)) {
    return { ok: false, motivo: "El color del acento tiene que ser #RRGGBB." };
  }

  // ── El icono del sello (0145) ───────────────────────────────────
  // Un id fuera del catálogo se RECHAZA; en un tipo que no es sellos
  // no se rechaza —no es culpa de nadie— se descarta: no hay círculos
  // donde dibujarlo. Sin `modo`, el programa del alta nace como
  // 'sellos' (así lo escribe el RPC), y por eso el icono sí aplica.
  const iconoCrudo = limpiar(cruda.iconoSello);
  if (iconoCrudo !== null && !esIconoSello(iconoCrudo)) {
    return { ok: false, motivo: "Ese icono de sello no existe." };
  }
  const iconoSello = iconoDelSello({ tipo: modo ?? "sellos", icono: iconoCrudo });

  // ── Las imágenes tienen que ser NUESTRAS ────────────────────────
  // Una URL ajena en el pase deja a un tercero decidiendo qué imagen
  // ve el cliente en su teléfono — y pudiendo cambiarla o borrarla
  // para siempre, porque el pase ya está instalado.
  const logoUrl = limpiar(cruda.logoUrl);
  if (logoUrl !== null && !esUrlDeNuestroStorage(logoUrl, BUCKET_DEL_ALTA)) {
    return { ok: false, motivo: "El logo no se subió bien — probá de nuevo." };
  }
  const bannerUrl = limpiar(cruda.bannerUrl);
  if (bannerUrl !== null && !esUrlDeNuestroStorage(bannerUrl, BUCKET_DEL_ALTA)) {
    return { ok: false, motivo: "La banda no se subió bien — probá de nuevo." };
  }

  // Un objeto vacío es lo mismo que no mandar nada: el alta sigue el
  // camino de siempre, sin un UPDATE que no cambia ninguna columna.
  if (
    modo === null &&
    colorFondo === null &&
    colorSello === null &&
    iconoSello === null &&
    logoUrl === null &&
    bannerUrl === null
  ) {
    return { ok: true, tarjeta: null };
  }

  return {
    ok: true,
    tarjeta: { modo, beneficio, colorFondo, colorSello, iconoSello, logoUrl, bannerUrl },
  };
}
