import type { CategoriaCita } from "../tipos";

/**
 * EL CONTRATO DEL NUEVO PERFIL DE CITAS.
 *
 * Todos los componentes del rediseño de /citas/[slug] son "tontos": reciben
 * datos por props, sin consultar Supabase por su cuenta. La página
 * (page.tsx) sigue siendo la única que arma las consultas — igual que ya
 * hacían AgendaNegocio, EquipoNegocio y TarjetaReservaSticky — para no
 * repetir una lectura protegida por RLS en cinco lugares distintos ni
 * duplicar lógica que ya existe.
 *
 * Ningún componente de este rediseño abre su propia reserva: todos avisan
 * con `onReservar(servicioId, miembroId)` y la página decide qué hacer
 * (hoy: abrir el ReservarCitaModal que ya existe, sin tocarlo).
 */

export type FotoGaleria = { url: string; alt: string };

export type ServicioPerfil = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number | null;
  duracion_minutos: number | null;
  /** El descanso después del servicio (ReservarCita lo necesita para no ofrecer un espacio que se pisa con el siguiente). */
  buffer_min: number | null;
  grupo: string | null;
};

export type ProfesionalPerfil = {
  id: string;
  nombre: string;
  rol: string | null;
  foto_url: string | null;
  /** null = sin reseñas propias todavía. */
  promedio: number | null;
  totalResenas: number;
  /** Nombres de servicio, no ids — ya resueltos por la página. */
  serviciosPrincipales: string[];
  citasAtendidas: number;
};

export type ResenaPerfil = {
  id: string;
  calificacion: number;
  comentario: string | null;
  fecha: string;
  clienteNombre: string;
  /** null = la reseña es de antes de que se guardara esa relación, o el servicio ya no existe. */
  servicioNombre: string | null;
  profesionalNombre: string | null;
  /**
   * SIEMPRE true en este esquema: `resenas.reserva_id` es NOT NULL y
   * único — no existe una reseña que no cuelgue de una reserva
   * confirmada. No es un campo cosmético, es un hecho de la base.
   */
  reservaVerificada: true;
};

/** Cuántas reseñas hay de cada nota, para las barras de distribución. */
export type DistribucionResenas = Record<1 | 2 | 3 | 4 | 5, number>;

export type ResumenResenas = {
  promedio: number | null;
  total: number;
  distribucion: DistribucionResenas;
};

/**
 * Fotos de trabajos. HOY salen de `ranchos.fotos` (las mismas de la
 * galería del negocio) porque no existe una tabla de portafolio propia
 * — no se inventa una para este rediseño (ver CLAUDE.md: no backend
 * innecesario). `servicioNombre`/`profesionalNombre` quedan `null`
 * siempre por ahora: no hay forma de saber qué foto es de qué trabajo
 * hasta que exista esa tabla. El componente debe funcionar bien con
 * esos dos campos en null (no asumir que siempre vienen).
 */
export type FotoPortfolio = {
  url: string;
  alt: string;
  servicioNombre: string | null;
  profesionalNombre: string | null;
};

export type BadgeNegocio = { id: string; label: string; icono: "check" | "parqueo" | "wifi" | "tarjeta" | "silla" | "espera" };

export type EstadoApertura = { abierto: boolean; texto: string } | null;

export type SeccionPerfil = "servicios" | "equipo" | "portfolio" | "resenas" | "informacion";

/**
 * Lo que ya carga `page.tsx` hoy y no cambia de forma con este
 * rediseño — se reexporta acá para que los componentes nuevos no
 * tengan que importar de media docena de archivos distintos.
 */
export type { CategoriaCita };
