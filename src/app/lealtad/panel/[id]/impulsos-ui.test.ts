import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PLANTILLAS } from "@/lib/lealtad/impulsos/preconfigurados";
import type { ContextoDeImpulsos, ImpulsoVista } from "./impulsos-vista";

/**
 * Humo de la pantalla: que cada vista se DIBUJE sin reventar y diga lo que tiene que decir.
 *
 * No reemplaza mirarla en un navegador (no se puede probar el clic ni el estilo desde acá), pero atrapa lo que
 * más se rompe al armar una pantalla grande: un dato que no existe, una función del catálogo usada mal, un
 * texto de estado que falta. Se renderiza en el servidor, así que los efectos no corren: el historial se ve en
 * su estado inicial («Cargando…»).
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("./impulsos-actions", () => {
  const ok = async () => ({ ok: true, datos: null });
  return {
    cambiarEstadoImpulso: ok,
    crearDesdePlantilla: ok,
    duplicarImpulso: ok,
    eliminarImpulso: ok,
    guardarImpulso: ok,
    historialDeImpulsos: async () => ({ ok: true, datos: { filas: [], total: 0, pagina: 0, porPagina: 25 } }),
    reintentarMensaje: ok,
  };
});

const { default: ImpulsosPanel } = await import("./impulsos-panel");
const { default: ImpulsosEditor } = await import("./impulsos-editor");
const { default: ImpulsosHistorial } = await import("./impulsos-historial");

const contexto = (extra: Partial<ContextoDeImpulsos> = {}): ContextoDeImpulsos => ({
  programaId: "prog-1",
  nombrePrograma: "Tarjeta de sellos",
  nombreNegocio: "Café del Parque",
  modo: "sellos",
  zona: "America/Costa_Rica",
  hoy: "2026-10-21",
  esFoorkie: false,
  tieneRecompensa: true,
  recompensa: "Café gratis",
  meta: 5,
  correoConfigurado: true,
  tarjetaOpera: true,
  ...extra,
});

const conteo = { programada: 0, pendiente: 0, procesando: 0, enviada: 0, entregada: 0, omitida: 0, fallida: 0, cancelada: 0 };
const bienvenida = PLANTILLAS.find((p) => p.id === "bienvenida")!.entrada("sellos");

const impulso = (extra: Partial<ImpulsoVista> = {}): ImpulsoVista => ({
  id: "imp-1",
  rancho_id: "rancho-1",
  programa_id: "prog-1",
  ...bienvenida,
  estado: "activo",
  version: 2,
  activado_en: "2026-10-20T15:00:00Z",
  ultimo_escaneo_en: null,
  creado_por: "u1",
  created_at: "2026-10-19T15:00:00Z",
  updated_at: "2026-10-20T15:00:00Z",
  conteo: { ...conteo, enviada: 7, programada: 2, fallida: 1, omitida: 3 },
  ultimoEnvio: "2026-10-21T14:00:00Z",
  ...extra,
});

const plantillas = PLANTILLAS.map((p) => ({ id: p.id, nombre: p.nombre, resumen: p.resumen, disponible: p.disponible, ...(p.motivo ? { motivo: p.motivo } : {}) }));

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("la lista de impulsos", () => {
  it("sin impulsos invita a empezar y muestra las ideas, con las que no se pueden cumplir apagadas y explicadas", () => {
    const h = html(createElement(ImpulsosPanel, { ranchoId: "rancho-1", contexto: contexto(), impulsos: [], plantillas }));
    expect(h).toContain("Todavía no armaste ningún impulso");
    expect(h).toContain("+ Nuevo impulso");
    for (const p of PLANTILLAS) expect(h).toContain(p.nombre);
    expect(h).toMatch(/Cumpleaños[\s\S]*No disponible/);
    expect(h).toContain("Qué se puede y qué no");
  });

  it("con impulsos muestra estado, cuenta de mensajes y las acciones que corresponden a cada estado", () => {
    const h = html(
      createElement(ImpulsosPanel, {
        ranchoId: "rancho-1",
        contexto: contexto(),
        impulsos: [impulso(), impulso({ id: "imp-2", nombre: "Otro en pausa", estado: "pausado", conteo })],
        plantillas,
      }),
    );
    expect(h).toContain("Bienvenida");
    expect(h).toContain("Activo");
    expect(h).toContain("Pausado");
    expect(h).toContain("7 enviados");
    expect(h).toContain("1 con problema");
    expect(h).toContain("Pausar"); // el activo se puede pausar
    expect(h).toContain("Activar"); // el pausado se puede activar
    expect(h).toContain("Historial");
  });

  it("avisa cuando la tarjeta no está operando", () => {
    const h = html(createElement(ImpulsosPanel, { ranchoId: "rancho-1", contexto: contexto({ tarjetaOpera: false }), impulsos: [impulso()], plantillas }));
    expect(h).toContain("La tarjeta no está activa");
  });

  it("explica que «enviado» es lo que aceptó el proveedor y la demora real de los envíos", () => {
    const h = html(createElement(ImpulsosPanel, { ranchoId: "rancho-1", contexto: contexto(), impulsos: [], plantillas }));
    expect(h).toContain("atraso de unos minutos");
  });
});

describe("el constructor", () => {
  const props = { ranchoId: "rancho-1", onCerrar: () => undefined, onGuardado: () => undefined };

  it("uno nuevo: todos los pasos, la vista previa y el botón de guardar como borrador", () => {
    const h = html(createElement(ImpulsosEditor, { ...props, contexto: contexto(), inicial: null }));
    for (const paso of ["Paso 1", "Paso 2", "Paso 3", "Paso 4", "Paso 5"]) expect(h).toContain(paso);
    expect(h).toContain("Nuevo impulso");
    expect(h).toContain("Vista previa");
    expect(h).toContain("Guardar borrador");
    expect(h).toContain("Guardar y activar");
    // Los activadores que no se pueden cumplir hoy aparecen, pero apagados.
    expect(h).toMatch(/disabled=""[^>]*>[^<]*cumpleaños|Todavía no disponibles/i);
  });

  it("uno existente y activo: avisa que los cambios valen para lo que no salió y no ofrece «guardar y activar»", () => {
    const h = html(createElement(ImpulsosEditor, { ...props, contexto: contexto(), inicial: impulso() }));
    expect(h).toContain("Editar impulso");
    expect(h).toContain("Este impulso está activo");
    expect(h).toContain("Guardar cambios");
    expect(h).not.toContain("Guardar y activar");
    expect(h).toContain("Bienvenida");
  });

  it("muestra el mensaje con los datos de ejemplo ya puestos", () => {
    const h = html(createElement(ImpulsosEditor, { ...props, contexto: contexto(), inicial: impulso() }));
    // Solo la vista previa: el formulario sí muestra el texto con sus {{variables}} para poder editarlo.
    const previa = h.slice(h.indexOf("Vista previa"), h.indexOf("Revisión"));
    expect(previa).toContain("Café del Parque");
    expect(previa).toContain("Hola María");
    expect(previa).not.toContain("{{");
  });

  it("en una tarjeta de Foorkie el correo se ofrece apagado, con el motivo", () => {
    const h = html(createElement(ImpulsosEditor, { ...props, contexto: contexto({ esFoorkie: true }), inicial: null }));
    expect(h).toContain("los manda Foorkie");
  });

  it("advierte si el correo no está configurado en el servidor", () => {
    const entrada = impulso({ canal: "correo" });
    const h = html(createElement(ImpulsosEditor, { ...props, contexto: contexto({ correoConfigurado: false }), inicial: entrada }));
    expect(h).toContain("proveedor de correo todavía no está configurado");
  });

  it("cada tipo de tarjeta dibuja su editor sin reventar", () => {
    for (const modo of ["sellos", "puntos", "cashback"]) {
      const h = html(createElement(ImpulsosEditor, { ...props, contexto: contexto({ modo }), inicial: null }));
      expect(h).toContain("Paso 5");
    }
  });
});

describe("el historial", () => {
  it("arranca en «Cargando…» y ofrece los filtros por impulso y por estado", () => {
    const h = html(
      createElement(ImpulsosHistorial, {
        ranchoId: "rancho-1",
        programaId: "prog-1",
        zona: "America/Costa_Rica",
        impulsos: [{ id: "imp-1", nombre: "Bienvenida" }],
        impulsoInicial: null,
        refrescarClave: 0,
      }),
    );
    expect(h).toContain("Historial de mensajes");
    expect(h).toContain("Cargando…");
    expect(h).toContain("Todos los impulsos");
    expect(h).toContain("Bienvenida");
    expect(h).toContain("No se mandó");
    expect(h).toContain("Ninguno confirma que el cliente lo haya visto");
  });
});
