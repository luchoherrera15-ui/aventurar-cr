/**
 * ══════════════════════════════════════════════════════════════════
 *  LAS RUTAS DE CELEBRAR, SIN EL PREFIJO
 * ══════════════════════════════════════════════════════════════════
 *
 * CELEBRAR vive hoy bajo `bookea.lat/celebrar/…` y mañana bajo
 * `celebrar.lat/…`. Para que el mismo código sirva en los dos mundos,
 * TODA ruta interna se escribe acá SIN el prefijo `/celebrar` y se
 * completa en el momento de usarla (ver `dominios.ts` →
 * `conPrefijo()` y el `<EnlaceCelebrar>` del sitio).
 *
 * Regla: ningún componente de CELEBRAR escribe "/celebrar/..." a mano.
 * Si aparece un literal así en JSX, está mal — el día del estreno
 * mandaría a la gente de `celebrar.lat` de vuelta a Bookea.
 */

export const PREFIJO_CELEBRAR = "/celebrar";

export const RUTA = {
  inicio: "/",
  comoFunciona: "/#como-funciona",
  precios: "/#precios",
  plantillas: "/plantillas",
  entrar: "/entrar",
  recuperar: "/entrar/recuperar",
  nuevaContrasena: "/entrar/nueva-contrasena",
  authCallback: "/auth/callback",
  app: "/app",
  appCelebraciones: "/app/celebraciones",
  appCrear: "/app/crear",
  appPlantillas: "/app/plantillas",
  appCreditos: "/app/creditos",
  /** La vuelta de Stripe al pagar una invitación: acredita, cobra y publica. */
  appPago: "/app/pago",
  appAlbumes: "/app/albumes",
  appVideos: "/app/videos",
  appInvitados: "/app/invitados",
  appRsvp: "/app/rsvp",
  appConfiguracion: "/app/configuracion",
  /** La administración de CELEBRAR (solo el equipo): dentro del mismo panel. */
  appAdmin: "/app/admin",
  appAdminCreditos: "/app/admin/creditos",
  appAdminPartners: "/app/admin/partners",
  appAdminDiseno: "/app/admin/diseno",
  /** Programa de partners (planners, agencias). */
  appPartner: "/app/partner",
  partners: "/partners",
  /** Los demos: invitaciones de muestra, el álbum y el panel. */
  demos: "/demos",
  demoAlbum: "/demos/album",
  demoPanel: "/demos/panel",
  admin: "/admin",
  /** El editor de la invitación: /editor/<id de la celebración>. */
  editor: "/editor",
} as const;

export function rutaEditor(celebracionId: string): string {
  return `${RUTA.editor}/${celebracionId}`;
}

/** La plantilla del catálogo, completa y con datos de muestra. */
export function rutaPreviaPlantilla(slug: string): string {
  return `${RUTA.plantillas}/${slug}`;
}

export function rutaDemo(id: string): string {
  return `${RUTA.demos}/${id}`;
}

export function rutaFicha(celebracionId: string): string {
  return `${RUTA.appCelebraciones}/${celebracionId}`;
}

/**
 * Los primeros segmentos que son del SISTEMA y que, por lo tanto,
 * ninguna celebración puede reclamar como slug. `celebrar.lat/app` es
 * el panel; `celebrar.lat/maria-y-juan` es una invitación. Si María y
 * Juan pudieran llamarse "app", una de las dos páginas moriría.
 *
 * Esta lista se siembra también en la tabla `celebrar_slugs` con
 * `motivo = 'sistema'` (Fase 2) para que la defensa exista en la base
 * y no solo en el código.
 */
export const SEGMENTOS_SISTEMA = new Set([
  "app",
  "admin",
  "api",
  "auth",
  "entrar",
  "salir",
  "editor",
  "registro",
  "plantillas",
  "precios",
  "como-funciona",
  "q",
  "e",
  "i",
  "a",
  "s",
  "celebrar",
  "cuenta",
  "ayuda",
  "partners",
  "partner",
  "demos",
  "demo",
  "terminos",
  "privacidad",
  "sitemap.xml",
  "robots.txt",
  "opengraph-image",
  "favicon.ico",
]);

/** Un slug de celebración: minúsculas, dígitos y guiones, 3 a 60. */
export const SLUG_CELEBRACION = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/;

export function esSlugDeCelebracionValido(slug: string): boolean {
  return SLUG_CELEBRACION.test(slug) && !SEGMENTOS_SISTEMA.has(slug);
}
