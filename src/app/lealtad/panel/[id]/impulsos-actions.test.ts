import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLANTILLAS } from "@/lib/lealtad/impulsos/preconfigurados";
import type { InfoPrograma } from "@/lib/lealtad/impulsos/tipos";

/**
 * Las acciones del panel de impulsos: quién puede, sobre qué, y qué escriben.
 *
 * Se prueban con la base y el acceso de mentira. Lo que importa acá no es SQL (eso está probado aparte) sino
 * las defensas: que un colaborador no maneje impulsos, que una tarjeta de OTRO negocio no se toque aunque el
 * id llegue del navegador, que lo que el navegador mande de más se ignore, que pausar cancele lo que espera
 * y que borrar un impulso con historial lo archive en vez de destruirlo.
 */

const RANCHO = "rancho-1";
const PROGRAMA = "prog-1";

const INFO: InfoPrograma = {
  programaId: PROGRAMA,
  ranchoId: RANCHO,
  nombrePrograma: "Sellos",
  nombreNegocio: "Café",
  modo: "sellos",
  zona: "America/Costa_Rica",
  opera: true,
  esFoorkie: false,
  meta: 5,
  recompensa: "Café gratis",
  cuentaId: null,
};

type Respuesta = { data: unknown; error: { code?: string; message: string } | null; count?: number | null };
type Llamada = { tabla: string; ops: [string, unknown[]][] };

const estado = {
  acceso: { user: { id: "u1" } as { id: string } | null, esDueno: true, esAdmin: false } as {
    user: { id: string } | null;
    esDueno: boolean;
    esAdmin: boolean;
  },
  info: INFO as InfoPrograma | null,
  respuestas: {} as Record<string, Respuesta>,
  llamadas: [] as Llamada[],
};

function claveDe(l: Llamada): string {
  const op = l.ops.find(([n]) => ["update", "insert", "delete"].includes(n))?.[0] ?? "select";
  return `${l.tabla}:${op}`;
}

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/auth", () => ({ verificarAccesoLealtad: async () => estado.acceso }));
vi.mock("@/lib/lealtad/impulsos/repositorio", () => ({ leerInfoPrograma: async () => estado.info }));
vi.mock("@/lib/lealtad/identidades-db", () => ({ identidadesDeMiembros: async () => new Map() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(tabla: string) {
      const llamada: Llamada = { tabla, ops: [] };
      estado.llamadas.push(llamada);
      const b: unknown = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (resolver: (r: Respuesta) => unknown) =>
                resolver(estado.respuestas[claveDe(llamada)] ?? estado.respuestas[tabla] ?? { data: null, error: null, count: 0 });
            }
            return (...args: unknown[]) => {
              llamada.ops.push([String(prop), args]);
              return b;
            };
          },
        },
      );
      return b;
    },
  }),
}));

const {
  cambiarEstadoImpulso,
  crearDesdePlantilla,
  datosDeImpulsos,
  duplicarImpulso,
  eliminarImpulso,
  guardarImpulso,
  reintentarMensaje,
} = await import("./impulsos-actions");

const op = (l: Llamada, nombre: string) => l.ops.filter(([n]) => n === nombre).map(([, a]) => a);
const llamadasA = (clave: string) => estado.llamadas.filter((l) => claveDe(l) === clave);

const bienvenida = PLANTILLAS.find((p) => p.id === "bienvenida")!.entrada("sellos");
const impulsoGuardado = (extra: Record<string, unknown> = {}) => ({
  id: "imp-1",
  rancho_id: RANCHO,
  programa_id: PROGRAMA,
  ...bienvenida,
  estado: "borrador",
  version: 1,
  activado_en: null,
  ...extra,
});

beforeEach(() => {
  estado.acceso = { user: { id: "u1" }, esDueno: true, esAdmin: false };
  estado.info = INFO;
  estado.respuestas = {};
  estado.llamadas = [];
});

describe("quién puede", () => {
  it("sin sesión no se toca nada", async () => {
    estado.acceso = { user: null, esDueno: false, esAdmin: false };
    const r = await guardarImpulso(RANCHO, PROGRAMA, null, bienvenida);
    expect(r).toMatchObject({ ok: false });
    expect(estado.llamadas).toHaveLength(0);
  });

  it("un colaborador de mostrador no maneja los mensajes automáticos", async () => {
    estado.acceso = { user: { id: "u2" }, esDueno: false, esAdmin: false };
    const r = await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "activo");
    expect(r).toMatchObject({ ok: false, motivo: expect.stringMatching(/dueño/) });
    expect(estado.llamadas).toHaveLength(0);
  });

  it("un admin de Bookea sí puede", async () => {
    estado.acceso = { user: { id: "adm" }, esDueno: false, esAdmin: true };
    estado.respuestas["impulsos_lealtad:insert"] = { data: { id: "nuevo" }, error: null };
    estado.respuestas["impulsos_lealtad"] = { data: null, error: null, count: 0 };
    expect(await guardarImpulso(RANCHO, PROGRAMA, null, bienvenida)).toMatchObject({ ok: true });
  });
});

describe("aislamiento entre negocios", () => {
  it("una tarjeta de otro negocio no se toca, aunque el id llegue del navegador", async () => {
    estado.info = { ...INFO, ranchoId: "rancho-AJENO" };
    for (const accion of [
      () => guardarImpulso(RANCHO, PROGRAMA, null, bienvenida),
      () => cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "activo"),
      () => duplicarImpulso(RANCHO, PROGRAMA, "imp-1"),
      () => eliminarImpulso(RANCHO, PROGRAMA, "imp-1"),
      () => crearDesdePlantilla(RANCHO, PROGRAMA, "bienvenida"),
      () => reintentarMensaje(RANCHO, PROGRAMA, "t1"),
    ]) {
      const r = await accion();
      expect(r).toMatchObject({ ok: false, motivo: expect.stringMatching(/no es de este negocio/) });
    }
    const datos = await datosDeImpulsos(RANCHO, PROGRAMA);
    expect(datos).toMatchObject({ disponible: false });
    expect(estado.llamadas.filter((l) => claveDe(l) !== "x")).toHaveLength(0);
  });

  it("un impulso que no es de esa tarjeta se trata como inexistente", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: null, error: null };
    expect(await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-de-otra-tarjeta", "activo")).toMatchObject({
      ok: false,
      motivo: expect.stringMatching(/no existe/),
    });
    const lectura = estado.llamadas[0];
    expect(op(lectura, "eq")).toEqual([
      ["id", "imp-de-otra-tarjeta"],
      ["rancho_id", RANCHO],
      ["programa_id", PROGRAMA],
    ]);
  });
});

describe("guardarImpulso", () => {
  it("un impulso inválido no se guarda y dice por qué", async () => {
    const r = await guardarImpulso(RANCHO, PROGRAMA, null, { ...bienvenida, nombre: "x", titulo: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas?.length).toBeGreaterThan(0);
    expect(llamadasA("impulsos_lealtad:insert")).toHaveLength(0);
  });

  it("nace como borrador, con el negocio y la tarjeta del SERVIDOR (no los que mande el navegador)", async () => {
    estado.respuestas["impulsos_lealtad:insert"] = { data: { id: "nuevo" }, error: null };
    estado.respuestas["impulsos_lealtad"] = { data: null, error: null, count: 0 };
    const r = await guardarImpulso(RANCHO, PROGRAMA, null, {
      ...bienvenida,
      rancho_id: "rancho-AJENO",
      programa_id: "prog-AJENO",
      estado: "activo",
      activado_en: "2020-01-01",
      version: 99,
    });
    expect(r).toMatchObject({ ok: true, datos: { id: "nuevo" } });
    const fila = op(llamadasA("impulsos_lealtad:insert")[0], "insert")[0][0] as Record<string, unknown>;
    expect(fila).toMatchObject({ rancho_id: RANCHO, programa_id: PROGRAMA, estado: "borrador", creado_por: "u1" });
    expect(fila).not.toHaveProperty("activado_en");
    expect(fila).not.toHaveProperty("version");
  });

  it("un impulso ACTIVO no puede quedar inválido al editarlo", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo", activado_en: "2026-10-01T00:00:00Z" }), error: null };
    const r = await guardarImpulso(RANCHO, PROGRAMA, "imp-1", { ...bienvenida, cuerpo: "Hola {{variable_inexistente}}" });
    expect(r).toMatchObject({ ok: false, motivo: expect.stringMatching(/activo/) });
    expect(llamadasA("impulsos_lealtad:update")).toHaveLength(0);
  });

  it("un impulso archivado no se edita", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "archivado" }), error: null };
    expect(await guardarImpulso(RANCHO, PROGRAMA, "imp-1", bienvenida)).toMatchObject({ ok: false, motivo: expect.stringMatching(/archivado/) });
  });

  it("al editar sube la versión; si cambia lo que lo dispara, cancela lo que esperaba", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado(), error: null };
    const r = await guardarImpulso(RANCHO, PROGRAMA, "imp-1", { ...bienvenida, activador: "inscripcion", titulo: "Nuevo título" });
    expect(r).toMatchObject({ ok: true });
    const u = op(llamadasA("impulsos_lealtad:update")[0], "update")[0][0] as Record<string, unknown>;
    expect(u.version).toBe(2);
    // El disparador no cambió (era inscripcion): no se cancela nada.
    expect(llamadasA("impulsos_tareas:update")).toHaveLength(0);

    estado.llamadas = [];
    await guardarImpulso(RANCHO, PROGRAMA, "imp-1", { ...bienvenida, activador: "primera_visita" });
    const cancel = llamadasA("impulsos_tareas:update")[0];
    expect(op(cancel, "update")[0][0]).toMatchObject({ estado: "cancelada", motivo: "impulso_editado" });
  });

  it("no pasa del tope de impulsos por tarjeta", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: null, error: null, count: 40 };
    expect(await guardarImpulso(RANCHO, PROGRAMA, null, bienvenida)).toMatchObject({ ok: false, motivo: expect.stringMatching(/hasta 40/) });
  });

  it("si falta la migración lo dice con claridad", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: null, error: { code: "42P01", message: 'relation "impulsos_lealtad" does not exist' }, count: null };
    expect(await guardarImpulso(RANCHO, PROGRAMA, null, bienvenida)).toMatchObject({ ok: false, motivo: expect.stringMatching(/0254/) });
  });
});

describe("cambiarEstadoImpulso", () => {
  it("activar sella el momento (nada retroactivo) y devuelve los avisos", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado(), error: null };
    const antes = Date.now();
    const r = await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "activo");
    expect(r).toMatchObject({ ok: true, datos: { estado: "activo" } });
    const u = op(llamadasA("impulsos_lealtad:update")[0], "update")[0][0] as { estado: string; activado_en: string };
    expect(u.estado).toBe("activo");
    expect(new Date(u.activado_en).getTime()).toBeGreaterThanOrEqual(antes - 1000);
  });

  it("no se activa un impulso que no pasa la validación", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ cuerpo: "Hola {{inventada}}" }), error: null };
    const r = await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "activo");
    expect(r.ok).toBe(false);
    expect(llamadasA("impulsos_lealtad:update")).toHaveLength(0);
  });

  it("no se activa uno cuyo disparador todavía no existe", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ activador: "cumpleanos" }), error: null };
    expect((await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "activo")).ok).toBe(false);
  });

  it("pausar cancela solo lo que todavía no salió", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null };
    await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "pausado");
    const cancel = llamadasA("impulsos_tareas:update")[0];
    expect(op(cancel, "update")[0][0]).toMatchObject({ estado: "cancelada", motivo: "impulso_pausado" });
    expect(op(cancel, "in")).toEqual([["estado", ["programada", "pendiente"]]]);
    expect(op(cancel, "eq")).toEqual([["impulso_id", "imp-1"]]);
  });

  it("un impulso archivado no se reactiva", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "archivado" }), error: null };
    expect(await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "activo")).toMatchObject({ ok: false });
  });

  it("pedir el estado que ya tiene no hace nada", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null };
    expect(await cambiarEstadoImpulso(RANCHO, PROGRAMA, "imp-1", "activo")).toMatchObject({ ok: true });
    expect(llamadasA("impulsos_lealtad:update")).toHaveLength(0);
  });
});

describe("eliminarImpulso", () => {
  it("con mensajes ya enviados NO se borra: se archiva y el historial queda", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null };
    estado.respuestas["impulsos_tareas"] = { data: null, error: null, count: 3 };
    const r = await eliminarImpulso(RANCHO, PROGRAMA, "imp-1");
    expect(r).toMatchObject({ ok: true, datos: { resultado: "archivado" } });
    expect(llamadasA("impulsos_lealtad:delete")).toHaveLength(0);
    const ultimo = llamadasA("impulsos_lealtad:update").at(-1)!;
    expect(op(ultimo, "update")[0][0]).toMatchObject({ estado: "archivado" });
  });

  it("sin historial se borra del todo", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado(), error: null };
    estado.respuestas["impulsos_tareas"] = { data: null, error: null, count: 0 };
    const r = await eliminarImpulso(RANCHO, PROGRAMA, "imp-1");
    expect(r).toMatchObject({ ok: true, datos: { resultado: "eliminado" } });
    const borrado = llamadasA("impulsos_lealtad:delete")[0];
    expect(op(borrado, "eq")).toEqual([
      ["id", "imp-1"],
      ["rancho_id", RANCHO],
      ["programa_id", PROGRAMA],
    ]);
  });

  it("antes de decidir frena lo que esperaba salir", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null };
    estado.respuestas["impulsos_tareas"] = { data: null, error: null, count: 0 };
    await eliminarImpulso(RANCHO, PROGRAMA, "imp-1");
    const cancel = llamadasA("impulsos_tareas:update")[0];
    expect(op(cancel, "update")[0][0]).toMatchObject({ estado: "cancelada", motivo: "impulso_eliminado" });
  });
});

describe("plantillas y copias", () => {
  it("una plantilla nace como BORRADOR, nunca activa", async () => {
    estado.respuestas["impulsos_lealtad:insert"] = { data: { id: "nuevo" }, error: null };
    estado.respuestas["impulsos_lealtad"] = { data: null, error: null, count: 0 };
    expect(await crearDesdePlantilla(RANCHO, PROGRAMA, "bienvenida")).toMatchObject({ ok: true });
    const fila = op(llamadasA("impulsos_lealtad:insert")[0], "insert")[0][0] as Record<string, unknown>;
    expect(fila).toMatchObject({ estado: "borrador", plantilla: "bienvenida", rancho_id: RANCHO });
  });

  it("una plantilla que hoy no se puede cumplir se rechaza diciendo por qué", async () => {
    const r = await crearDesdePlantilla(RANCHO, PROGRAMA, "cumpleanos");
    expect(r).toMatchObject({ ok: false });
    expect(llamadasA("impulsos_lealtad:insert")).toHaveLength(0);
  });

  it("una plantilla inexistente se rechaza", async () => {
    expect(await crearDesdePlantilla(RANCHO, PROGRAMA, "no_existe")).toMatchObject({ ok: false });
  });

  it("duplicar crea un borrador «Copia de…»", async () => {
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null, count: 1 };
    estado.respuestas["impulsos_lealtad:insert"] = { data: { id: "copia" }, error: null };
    const r = await duplicarImpulso(RANCHO, PROGRAMA, "imp-1");
    expect(r).toMatchObject({ ok: true, datos: { id: "copia" } });
    const fila = op(llamadasA("impulsos_lealtad:insert")[0], "insert")[0][0] as Record<string, unknown>;
    expect(fila).toMatchObject({ estado: "borrador", nombre: "Copia de Bienvenida" });
  });
});

describe("reintentarMensaje", () => {
  const tarea = (extra: Record<string, unknown> = {}) => ({ id: "t1", impulso_id: "imp-1", estado: "fallida", motivo: "error_proveedor", ...extra });

  it("solo se reintentan los que fallaron", async () => {
    estado.respuestas["impulsos_tareas"] = { data: tarea({ estado: "enviada" }), error: null };
    expect(await reintentarMensaje(RANCHO, PROGRAMA, "t1")).toMatchObject({ ok: false, motivo: expect.stringMatching(/fallaron/) });
  });

  it("un resultado incierto exige confirmar que podría llegar dos veces", async () => {
    estado.respuestas["impulsos_tareas"] = { data: tarea({ motivo: "resultado_incierto" }), error: null };
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null };
    const sin = await reintentarMensaje(RANCHO, PROGRAMA, "t1");
    expect(sin).toMatchObject({ ok: false, motivo: expect.stringMatching(/dos veces/) });
    expect(llamadasA("impulsos_tareas:update")).toHaveLength(0);
  });

  it("no se reintenta si el impulso no está activo", async () => {
    estado.respuestas["impulsos_tareas"] = { data: tarea(), error: null };
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "pausado" }), error: null };
    expect(await reintentarMensaje(RANCHO, PROGRAMA, "t1")).toMatchObject({ ok: false, motivo: expect.stringMatching(/activo/) });
  });

  it("vuelve a la cola condicionado a que siga fallida (dos clics no lo encolan dos veces)", async () => {
    estado.respuestas["impulsos_tareas"] = { data: tarea(), error: null };
    estado.respuestas["impulsos_tareas:update"] = { data: [{ id: "t1" }], error: null };
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null };
    expect(await reintentarMensaje(RANCHO, PROGRAMA, "t1")).toMatchObject({ ok: true });
    const u = llamadasA("impulsos_tareas:update")[0];
    expect(op(u, "update")[0][0]).toMatchObject({ estado: "programada", intentos: 0, envio_iniciado_en: null, motivo: null });
    expect(op(u, "eq")).toContainEqual(["estado", "fallida"]);
  });

  it("si otro ya lo cambió, no hace nada y lo dice", async () => {
    estado.respuestas["impulsos_tareas"] = { data: tarea(), error: null };
    estado.respuestas["impulsos_tareas:update"] = { data: [], error: null };
    estado.respuestas["impulsos_lealtad"] = { data: impulsoGuardado({ estado: "activo" }), error: null };
    expect(await reintentarMensaje(RANCHO, PROGRAMA, "t1")).toMatchObject({ ok: false, motivo: expect.stringMatching(/ya cambió/) });
  });
});
