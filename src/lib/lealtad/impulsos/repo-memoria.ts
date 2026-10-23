import type {
  CambiosTarea,
  ClienteCargado,
  NuevaTarea,
  RepoImpulsos,
} from "./motor";
import type { EventoImpulso, Impulso, InfoPrograma, Tarea } from "./tipos";

/**
 * Un `RepoImpulsos` que vive en memoria, SOLO PARA LAS PRUEBAS.
 *
 * Imita las dos reglas de la base que el motor da por ciertas:
 *   · una tarea es única por (impulso, clave): crearla dos veces devuelve «duplicada»;
 *   · reclamar es atómico: lo que una llamada toma, la siguiente ya no lo ve.
 * Nada de producción importa este archivo.
 */
export class RepoEnMemoria implements RepoImpulsos {
  eventos: (EventoImpulso & { procesado?: boolean; error?: string })[] = [];
  impulsos = new Map<string, Impulso>();
  infos = new Map<string, InfoPrograma>();
  /** miembroId → de qué tarjeta es y qué se sabe de él. */
  clientes = new Map<string, { programaId: string; cargado: ClienteCargado }>();
  visitas = new Map<string, number>();
  inactivosDe = new Map<string, { miembroId: string; ultima: string }[]>();
  tareas: Tarea[] = [];
  escaneos = new Map<string, Date>();
  /** Para forzar fallos del repositorio en una prueba. */
  fallar: { eventosPendientes?: boolean } = {};
  private n = 0;

  private id(prefijo: string): string {
    this.n += 1;
    return `${prefijo}-${this.n}`;
  }

  async eventosPendientes(limite: number) {
    if (this.fallar.eventosPendientes) throw new Error("la base no contesta");
    return this.eventos.filter((e) => !e.procesado).slice(0, limite);
  }

  async cerrarEvento(id: string, resultado?: { error?: string }) {
    const ev = this.eventos.find((e) => e.id === id);
    if (!ev) return;
    if (resultado?.error) {
      ev.intentos += 1;
      ev.error = resultado.error;
      if (ev.intentos >= 5) ev.procesado = true;
    } else {
      ev.procesado = true;
    }
  }

  async impulsosActivos(programaId: string) {
    return [...this.impulsos.values()].filter((i) => i.programa_id === programaId && i.estado === "activo");
  }

  async impulsoPorId(id: string) {
    return this.impulsos.get(id) ?? null;
  }

  async impulsosParaEscanear(ahora: Date) {
    return [...this.impulsos.values()].filter((i) => {
      if (i.estado !== "activo") return false;
      const ultimo = this.escaneos.get(i.id);
      return !ultimo || ahora.getTime() - ultimo.getTime() >= 55 * 60_000;
    });
  }

  async marcarEscaneo(id: string, ahora: Date) {
    this.escaneos.set(id, ahora);
  }

  async infoPrograma(programaId: string) {
    return this.infos.get(programaId) ?? null;
  }

  async contextoCliente(miembroId: string, info: InfoPrograma) {
    const c = this.clientes.get(miembroId);
    // Igual que producción: un miembro de OTRA tarjeta no se puede cargar con esta.
    if (!c || c.programaId !== info.programaId) return null;
    return c.cargado;
  }

  async visitasHasta(miembroId: string) {
    return this.visitas.get(miembroId) ?? 0;
  }

  async inactivos(programaId: string) {
    return this.inactivosDe.get(programaId) ?? [];
  }

  async crearTarea(t: NuevaTarea) {
    if (this.tareas.some((x) => x.impulso_id === t.impulso_id && x.clave === t.clave)) return "duplicada" as const;
    const ahora = new Date().toISOString();
    this.tareas.push({
      id: this.id("tarea"),
      impulso_id: t.impulso_id,
      rancho_id: t.rancho_id,
      programa_id: t.programa_id,
      miembro_id: t.miembro_id,
      evento_id: t.evento_id,
      clave: t.clave,
      canal: t.canal,
      ejecutar_en: t.ejecutar_en,
      estado: t.estado,
      intentos: 0,
      proximo_intento_en: null,
      reclamada_en: null,
      envio_iniciado_en: null,
      enviada_en: null,
      entregada_en: null,
      motivo: t.motivo ?? null,
      detalle: t.detalle ?? null,
      mensaje_titulo: null,
      mensaje_cuerpo: null,
      version_impulso: t.version_impulso,
      created_at: ahora,
      updated_at: ahora,
    });
    return "creada" as const;
  }

  async reclamarTareas(limite: number, ahora: Date) {
    const tomadas = this.tareas
      .filter(
        (t) =>
          (t.estado === "programada" || t.estado === "pendiente") &&
          Date.parse(t.ejecutar_en) <= ahora.getTime() &&
          (!t.proximo_intento_en || Date.parse(t.proximo_intento_en) <= ahora.getTime()),
      )
      .sort((a, b) => Date.parse(a.ejecutar_en) - Date.parse(b.ejecutar_en))
      .slice(0, limite);
    for (const t of tomadas) {
      t.estado = "procesando";
      t.reclamada_en = ahora.toISOString();
      t.intentos += 1;
    }
    // Se devuelven copias: el motor no tiene que ver cambios posteriores del almacén.
    return tomadas.map((t) => ({ ...t }));
  }

  async actualizarTarea(id: string, cambios: CambiosTarea) {
    const t = this.tareas.find((x) => x.id === id);
    if (t) Object.assign(t, cambios);
  }

  async enviosDelCliente(miembroId: string, desde: Date) {
    return this.tareas
      .filter((t) => t.miembro_id === miembroId && t.estado === "enviada" && t.enviada_en && Date.parse(t.enviada_en) > desde.getTime())
      .map((t) => ({ impulso_id: t.impulso_id, enviada_en: t.enviada_en as string }));
  }
}
