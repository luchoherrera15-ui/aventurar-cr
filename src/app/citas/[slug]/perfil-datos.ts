import { diaDeSemana, instanteEnZona } from "@/lib/agenda/disponibilidad";
import { COMODIDADES_CITA, COMODIDAD_CITA_LABEL } from "../comodidades";
import { DIAS_SEMANA_LABEL, horaAMinutos, horaBonita, type HorarioSemana } from "../tipos";
import type {
  BadgeNegocio,
  DistribucionResenas,
  EstadoApertura,
  FotoGaleria,
} from "./perfil-tipos";

/**
 * FUNCIONES PURAS DE INTEGRACIÓN del rediseño de /citas/[slug].
 *
 * page.tsx (servidor) las usa para convertir lo que ya trae la base en
 * la forma que piden los componentes nuevos. Nada de esto pega contra
 * Supabase — reciben datos ya leídos y devuelven datos listos.
 */

const ICONO_POR_COMODIDAD: Record<string, BadgeNegocio["icono"]> = {
  parqueo: "parqueo",
  wifi_clientes: "wifi",
  aire_acondicionado: "check",
  acceso_silla_ruedas: "silla",
  pago_tarjeta: "tarjeta",
  espacio_espera: "espera",
};

/**
 * Las comodidades activas del negocio, como insignias — más la de
 * "Reserva instantánea", que no es una comodidad guardada en la base
 * sino un hecho real de cómo funciona Bookea Citas: no hay aprobación
 * manual, el RPC confirma al toque (ver CLAUDE.md).
 */
export function armarBadges(amenidades: string[]): BadgeNegocio[] {
  const fijas: BadgeNegocio[] = [
    { id: "reserva-instantanea", label: "Reserva instantánea", icono: "check" },
  ];
  const delNegocio = COMODIDADES_CITA.filter((c) => amenidades.includes(c.id)).map(
    (c): BadgeNegocio => ({
      id: c.id,
      label: COMODIDAD_CITA_LABEL[c.id] ?? c.label,
      icono: ICONO_POR_COMODIDAD[c.id] ?? "check",
    }),
  );
  return [...fijas, ...delNegocio];
}

/** Cuántas reseñas hay de cada nota, para las barras de ReviewsSummary. */
export function distribucionDeResenas(calificaciones: number[]): DistribucionResenas {
  const distribucion: DistribucionResenas = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const c of calificaciones) {
    if (c >= 1 && c <= 5) distribucion[c as 1 | 2 | 3 | 4 | 5] += 1;
  }
  return distribucion;
}

/**
 * `ranchos.foto_url` + `ranchos.fotos` combinadas y sin repetir, para
 * BusinessGallery y (hasta que exista una tabla de portafolio propia)
 * también para PortfolioGallery.
 */
export function armarFotosGaleria(
  fotoUrl: string | null,
  fotos: string[] | null,
  nombreNegocio: string,
): FotoGaleria[] {
  const urls = [fotoUrl, ...(fotos ?? [])].filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const unicas = [...new Set(urls)];
  return unicas.map((url, i) => ({
    url,
    alt: i === 0 ? nombreNegocio : `${nombreNegocio} — foto ${i + 1}`,
  }));
}

/**
 * Abierto/cerrado ahora mismo, con el texto ya armado ("cierra a las
 * 7:00 p. m.", "abre mañana a las 9:00 a. m."...).
 *
 * Es una copia intencional de la misma cuenta que ya hace
 * TarjetaReservaSticky (client component, fuera de los archivos que se
 * tocan en este rediseño): ese componente no expone la lógica para
 * importarla desde un server component, y duplicar ~20 líneas puras es
 * más seguro que forzar ese límite. Si algún día diverge, es porque
 * alguien cambió una de las dos sin mirar la otra — vale la pena
 * dejarlo dicho acá.
 */
export function estadoAperturaDe(
  horario: HorarioSemana | null,
  zonaHoraria: string,
): EstadoApertura {
  if (!horario) return null;

  const local = instanteEnZona(new Date().toISOString(), zonaHoraria);
  const dow = diaDeSemana(local.fecha);
  const minutosAhora = local.minutos;
  const hoy = horario[String(dow)] ?? null;

  if (hoy && minutosAhora >= horaAMinutos(hoy.abre) && minutosAhora < horaAMinutos(hoy.cierra)) {
    const faltan = horaAMinutos(hoy.cierra) - minutosAhora;
    return {
      abierto: true,
      texto:
        faltan <= 90 ? `cierra pronto, a las ${horaBonita(hoy.cierra)}` : `cierra a las ${horaBonita(hoy.cierra)}`,
    };
  }

  if (hoy && minutosAhora < horaAMinutos(hoy.abre)) {
    return { abierto: false, texto: `abre hoy a las ${horaBonita(hoy.abre)}` };
  }

  for (let i = 1; i <= 7; i++) {
    const d = horario[String((dow + i) % 7)];
    if (d) {
      return {
        abierto: false,
        texto: `abre ${i === 1 ? "mañana" : `el ${DIAS_SEMANA_LABEL[(dow + i) % 7].toLowerCase()}`} a las ${horaBonita(d.abre)}`,
      };
    }
  }
  return { abierto: false, texto: "consultá el horario" };
}
