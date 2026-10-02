import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MARCA_DE_CAMBIO } from "@/lib/wallet/mensaje-del-miembro";
import {
  aplicarCambios,
  configuracionConMensajes,
  guardarMensajesDeLaTarjeta,
  leerCambiosDeMensajes,
  limpiarTexto,
  MENSAJES_POR_DEFECTO,
  mensajeParaElPase,
  mensajesDeLaFila,
  mensajesDeLaTarjeta,
  mismosMensajes,
  prepararMensajeDelEvento,
  renglonDelMensaje,
  SIN_MENSAJES_TODAVIA,
  type MensajesAutomaticos,
} from "./foorkie-mensajes";

/**
 * LOS MENSAJES AUTOMÁTICOS DE UNA TARJETA DE FOORKIE.
 *
 * Tres cosas se fijan acá: la forma de lo que manda Foorkie (lo que no
 * cumple rebota con su motivo), dónde y cómo se guarda (sin pisar el
 * resto de la configuración), y LA GUARDIA: con la marca
 * `lealtad_por_foorkie` sí, vinculada sin la marca —como Pura Matcha—
 * nunca, y si no se puede saber, tampoco.
 */

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const MIEMBRO = "33333333-3333-4333-8333-333333333333";
const GRACIAS = MENSAJES_POR_DEFECTO.sumar.texto;

// ── Lo que manda Foorkie ────────────────────────────────────────────

describe("leerCambiosDeMensajes — la forma de `mensajes`", () => {
  it("de fábrica: los tres activos, con los textos del pedido del dueño", () => {
    expect(MENSAJES_POR_DEFECTO).toEqual({
      sumar: { activo: true, texto: "¡Gracias por preferirnos!" },
      quitar: { activo: true, texto: "Tu tarjeta se modificó." },
      canjear: { activo: true, texto: "¡Gracias! Disfrutá tu premio." },
    });
  });

  it("lo que no viene no se toca: un evento, o un solo campo de un evento", () => {
    expect(leerCambiosDeMensajes({ sumar: { texto: "Gracias, volvé pronto" } })).toEqual({
      ok: true,
      valor: { sumar: { texto: "Gracias, volvé pronto" } },
    });
    expect(leerCambiosDeMensajes({ quitar: { activo: false } })).toEqual({ ok: true, valor: { quitar: { activo: false } } });
    expect(
      leerCambiosDeMensajes({
        sumar: { activo: true, texto: "Uno" },
        quitar: { activo: false, texto: "Dos" },
        canjear: { activo: true, texto: "Tres" },
      }),
    ).toMatchObject({ ok: true, valor: { sumar: { texto: "Uno" }, quitar: { activo: false }, canjear: { texto: "Tres" } } });
  });

  it("el texto queda en una línea: saltos y espacios de más se juntan", () => {
    expect(leerCambiosDeMensajes({ sumar: { texto: "  ¡Gracias,\n\tvolvé   pronto!  " } })).toEqual({
      ok: true,
      valor: { sumar: { texto: "¡Gracias, volvé pronto!" } },
    });
  });

  it("los marcadores de ancho cero se van; el unidor de los emojis compuestos se queda", () => {
    expect(limpiarTexto("Gra\u200Bcias\u2060 por\uFEFF venir")).toBe("Gracias por venir");
    expect(limpiarTexto("👩‍🍳 ¡Gracias!")).toBe("👩‍🍳 ¡Gracias!");
  });

  it("de 3 a 120 caracteres, contados después de limpiar", () => {
    expect(leerCambiosDeMensajes({ canjear: { texto: "x".repeat(120) } })).toMatchObject({ ok: true });
    expect(leerCambiosDeMensajes({ canjear: { texto: "x".repeat(121) } })).toEqual({
      ok: false,
      motivo: "El mensaje al canjear puede tener hasta 120 caracteres: en la tarjeta no entra más.",
    });
    expect(leerCambiosDeMensajes({ sumar: { texto: "ok" } })).toEqual({
      ok: false,
      motivo: "Escribí el mensaje al sumar (de 3 a 120 caracteres).",
    });
    expect(leerCambiosDeMensajes({ sumar: { texto: " \n  \u200B " } })).toMatchObject({ ok: false });
  });

  it("rechaza lo que no tiene la forma, con su motivo", () => {
    for (const malo of [null, undefined, "hola", 42, [], {}]) {
      expect(leerCambiosDeMensajes(malo)).toMatchObject({ ok: false });
    }
    expect(leerCambiosDeMensajes({ acreditar: { texto: "Gracias" } })).toEqual({
      ok: false,
      motivo: "«acreditar» no es un mensaje: los mensajes son sumar, quitar y canjear.",
    });
    expect(leerCambiosDeMensajes({ sumar: "Gracias" })).toMatchObject({ ok: false });
    expect(leerCambiosDeMensajes({ sumar: {} })).toMatchObject({ ok: false });
    expect(leerCambiosDeMensajes({ sumar: { activo: "true" } })).toMatchObject({ ok: false });
    expect(leerCambiosDeMensajes({ sumar: { texto: 123 } })).toMatchObject({ ok: false });
    // Uno malo tumba el pedido entero: no se guarda la mitad.
    expect(leerCambiosDeMensajes({ sumar: { activo: true }, quitar: { texto: "no" } })).toMatchObject({ ok: false });
  });
});

// ── Lo guardado ─────────────────────────────────────────────────────

describe("mensajesDeLaFila — lo que hay guardado, o lo de fábrica", () => {
  it("sin la columna (0251 sin correr), vacía o sin la clave: lo de fábrica", () => {
    expect(mensajesDeLaFila({ id: PROGRAMA })).toEqual(MENSAJES_POR_DEFECTO);
    expect(mensajesDeLaFila({ configuracion: null })).toEqual(MENSAJES_POR_DEFECTO);
    expect(mensajesDeLaFila({ configuracion: {} })).toEqual(MENSAJES_POR_DEFECTO);
    expect(mensajesDeLaFila({ configuracion: { ritmo_clientes: "semanal" } })).toEqual(MENSAJES_POR_DEFECTO);
  });

  it("lo guardado manda, evento por evento y campo por campo", () => {
    const fila = {
      configuracion: { mensajes_automaticos: { sumar: { activo: false, texto: "Gracias, Ana" }, canjear: { texto: "¡Que lo disfrutes!" } } },
    };
    expect(mensajesDeLaFila(fila)).toEqual({
      sumar: { activo: false, texto: "Gracias, Ana" },
      quitar: MENSAJES_POR_DEFECTO.quitar,
      canjear: { activo: true, texto: "¡Que lo disfrutes!" },
    });
  });

  it("lo roto no llega a un pase: cae a lo de fábrica", () => {
    const fila = {
      configuracion: {
        mensajes_automaticos: { sumar: { activo: "sí", texto: "x".repeat(300) }, quitar: "Tu tarjeta cambió", canjear: { texto: 7 } },
      },
    };
    expect(mensajesDeLaFila(fila)).toEqual(MENSAJES_POR_DEFECTO);
    expect(mensajesDeLaFila({ configuracion: "{no es json" })).toEqual(MENSAJES_POR_DEFECTO);
    expect(mensajesDeLaFila({ configuracion: [1, 2] })).toEqual(MENSAJES_POR_DEFECTO);
  });

  it("también si la bolsa llega como texto JSON", () => {
    const fila = { configuracion: JSON.stringify({ mensajes_automaticos: { quitar: { activo: false } } }) };
    expect(mensajesDeLaFila(fila).quitar).toEqual({ activo: false, texto: "Tu tarjeta se modificó." });
  });
});

describe("aplicarCambios / configuracionConMensajes — guardar sin pisar lo demás", () => {
  it("lo que no vino queda como estaba", () => {
    const nuevos = aplicarCambios(MENSAJES_POR_DEFECTO, { quitar: { activo: false }, canjear: { texto: "¡Que lo disfrutes!" } });
    expect(nuevos).toEqual({
      sumar: MENSAJES_POR_DEFECTO.sumar,
      quitar: { activo: false, texto: "Tu tarjeta se modificó." },
      canjear: { activo: true, texto: "¡Que lo disfrutes!" },
    });
    expect(mismosMensajes(nuevos, MENSAJES_POR_DEFECTO)).toBe(false);
    expect(mismosMensajes(aplicarCambios(MENSAJES_POR_DEFECTO, { sumar: { activo: true } }), MENSAJES_POR_DEFECTO)).toBe(true);
  });

  it("el ritmo de los clientes (y cualquier otra perilla) se conserva", () => {
    expect(configuracionConMensajes({ ritmo_clientes: "diario", mensajes_automaticos: { viejo: 1 } }, MENSAJES_POR_DEFECTO)).toEqual({
      ritmo_clientes: "diario",
      mensajes_automaticos: MENSAJES_POR_DEFECTO,
    });
    expect(configuracionConMensajes(null, MENSAJES_POR_DEFECTO)).toEqual({ mensajes_automaticos: MENSAJES_POR_DEFECTO });
  });
});

describe("mensajeParaElPase — el renglón «Último mensaje» de Apple", () => {
  const apagados: MensajesAutomaticos = {
    sumar: { ...MENSAJES_POR_DEFECTO.sumar, activo: false },
    quitar: { ...MENSAJES_POR_DEFECTO.quitar, activo: false },
    canjear: { ...MENSAJES_POR_DEFECTO.canjear, activo: false },
  };

  it("con un mensaje guardado, ese (con su marcador)", () => {
    expect(mensajeParaElPase(`${GRACIAS}${MARCA_DE_CAMBIO}`, MENSAJES_POR_DEFECTO)).toBe(`${GRACIAS}${MARCA_DE_CAMBIO}`);
    // Apagar los mensajes no borra el último que le llegó.
    expect(mensajeParaElPase(GRACIAS, apagados)).toBe(GRACIAS);
  });

  it("sin mensajes todavía: un valor de partida, para que el PRIMERO también avise", () => {
    expect(mensajeParaElPase(null, MENSAJES_POR_DEFECTO)).toBe(SIN_MENSAJES_TODAVIA);
  });

  it("sin nada guardado y todo apagado, el renglón no va", () => {
    expect(mensajeParaElPase(null, apagados)).toBeNull();
    expect(mensajeParaElPase(MARCA_DE_CAMBIO, apagados)).toBeNull();
  });
});

// ── Con una base de mentira ─────────────────────────────────────────

type Fila = Record<string, unknown>;
type Consulta = {
  tabla: string;
  op: "select" | "update";
  valores: Fila | null;
  filtros: [string, unknown][];
  unico: boolean;
  limite: number | null;
};
type ErrorDeBase = { message: string; code?: string };

/**
 * Una base que APLICA los `eq` de cada consulta a sus filas: si la
 * guardia se olvidara de pedir la marca, el local sin marca (Pura
 * Matcha) llegaría y la prueba se pondría roja. Los `update` se aplican
 * a las filas, así se puede mirar cómo quedó todo.
 */
function baseFalsa(tablas: Record<string, Fila[]>, errores: Record<string, ErrorDeBase> = {}) {
  const consultas: Consulta[] = [];
  const resolver = (c: Consulta) => {
    const error = errores[`${c.tabla}:${c.op}`] ?? errores[c.tabla];
    if (error) return { data: null, error };
    const filas = (tablas[c.tabla] ?? []).filter((f) => c.filtros.every(([col, val]) => f[col] === val));
    if (c.op === "update") {
      for (const f of filas) Object.assign(f, c.valores);
      return { data: null, error: null };
    }
    const vistas = (c.limite === null ? filas : filas.slice(0, c.limite)).map((f) => ({ ...f }));
    return { data: c.unico ? (vistas[0] ?? null) : vistas, error: null };
  };
  const db = {
    from(tabla: string) {
      const c: Consulta = { tabla, op: "select", valores: null, filtros: [], unico: false, limite: null };
      consultas.push(c);
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.update = (valores: Fila) => {
        c.op = "update";
        c.valores = valores;
        return b;
      };
      b.eq = (col: string, val: unknown) => {
        c.filtros.push([col, val]);
        return b;
      };
      b.limit = (n: number) => {
        c.limite = n;
        return b;
      };
      b.maybeSingle = () => {
        c.unico = true;
        return b;
      };
      b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
        Promise.resolve()
          .then(() => resolver(c))
          .then(ok, mal);
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, consultas, tablas };
}

/** Un local de Foorkie con esta tarjeta; `marca` = `lealtad_por_foorkie`. */
const local = (slug: string, marca: boolean): Fila => ({
  id: `local-${slug}`,
  slug,
  activo: true,
  estado_publicacion: "aprobado",
  created_at: "2026-09-01T10:00:00Z",
  bookea_rancho_id: RANCHO,
  bookea_programa_id: PROGRAMA,
  lealtad_por_foorkie: marca,
});

function escenario(
  opciones: {
    marca?: boolean | null;
    configuracion?: unknown;
    sinColumna?: boolean;
    guardado?: string | null;
    errores?: Record<string, ErrorDeBase>;
  } = {},
) {
  const { marca = true, configuracion = {}, sinColumna = false, guardado = null, errores = {} } = opciones;
  const programa: Fila = { id: PROGRAMA, rancho_id: RANCHO, nombre: "Tarjeta", modo: "cashback", estado: "activo", activo: true };
  if (!sinColumna) programa.configuracion = configuracion;
  return baseFalsa(
    {
      programa_lealtad: [programa],
      foorkie_restaurantes: marca === null ? [] : [local(marca ? "donde-george" : "pura-matcha", marca)],
      miembros: [{ id: MIEMBRO, programa_id: PROGRAMA, estado: "activa", ultimo_hito_mensaje: guardado }],
      pases_wallet: [{ miembro_id: MIEMBRO, plataforma: "apple", activo: true, actualizado_en: "2026-09-30T00:00:00Z" }],
    },
    errores,
  );
}

const escrituras = (consultas: Consulta[]) => consultas.filter((c) => c.op === "update");

describe("prepararMensajeDelEvento — el motor, SOLO en tarjetas de Foorkie", () => {
  afterEach(() => vi.restoreAllMocks());

  it("CON la marca: le deja el texto a ESE cliente para su pase y lo devuelve para Google", async () => {
    const { db, consultas, tablas } = escenario();
    const r = await prepararMensajeDelEvento(db, MIEMBRO, "sumar", { apple: true });
    expect(r).toEqual({ evento: "sumar", texto: GRACIAS, encabezado: "Foorkie" });
    expect(tablas.miembros[0].ultimo_hito_mensaje).toBe(GRACIAS);
    // Y su pase de Apple quedó marcado como cambiado (lo pregunta el iPhone tras el push).
    expect(tablas.pases_wallet[0].actualizado_en).not.toBe("2026-09-30T00:00:00Z");
    // La guardia preguntó por la tarjeta Y por la marca.
    const guardia = consultas.find((c) => c.tabla === "foorkie_restaurantes");
    expect(guardia?.filtros).toEqual([
      ["bookea_programa_id", PROGRAMA],
      ["lealtad_por_foorkie", true],
    ]);
  });

  it("el mismo «gracias» dos veces: el segundo es otro valor, para que Apple vuelva a avisar", async () => {
    const { db, tablas } = escenario({ guardado: GRACIAS });
    await prepararMensajeDelEvento(db, MIEMBRO, "sumar", { apple: true });
    expect(tablas.miembros[0].ultimo_hito_mensaje).toBe(`${GRACIAS}${MARCA_DE_CAMBIO}`);
  });

  it("cada evento con su texto, y el que guardó el restaurante manda", async () => {
    const { db } = escenario({
      configuracion: { ritmo_clientes: "semanal", mensajes_automaticos: { canjear: { texto: "¡Buen provecho, que lo disfrutes!" } } },
    });
    expect(await prepararMensajeDelEvento(db, MIEMBRO, "canjear", { apple: false })).toMatchObject({
      texto: "¡Buen provecho, que lo disfrutes!",
    });
    expect(await prepararMensajeDelEvento(db, MIEMBRO, "quitar", { apple: false })).toMatchObject({
      texto: "Tu tarjeta se modificó.",
    });
  });

  it("sin pase de Apple no escribe nada: el mensaje es solo para Google", async () => {
    const { db, consultas } = escenario();
    expect(await prepararMensajeDelEvento(db, MIEMBRO, "sumar", { apple: false })).toMatchObject({ texto: GRACIAS });
    expect(escrituras(consultas)).toHaveLength(0);
  });

  it("un evento apagado no manda nada ni escribe nada", async () => {
    const { db, consultas } = escenario({ configuracion: { mensajes_automaticos: { quitar: { activo: false } } } });
    expect(await prepararMensajeDelEvento(db, MIEMBRO, "quitar", { apple: true })).toBeNull();
    expect(escrituras(consultas)).toHaveLength(0);
  });

  it("vinculada SIN la marca (como Pura Matcha): nunca, y no se toca ni una fila", async () => {
    const { db, consultas, tablas } = escenario({ marca: false });
    for (const evento of ["sumar", "quitar", "canjear"] as const) {
      expect(await prepararMensajeDelEvento(db, MIEMBRO, evento, { apple: true })).toBeNull();
    }
    expect(escrituras(consultas)).toHaveLength(0);
    expect(tablas.miembros[0].ultimo_hito_mensaje).toBeNull();
  });

  it("una tarjeta de Bookea que ningún local de Foorkie tiene: nada", async () => {
    const { db, consultas } = escenario({ marca: null });
    expect(await prepararMensajeDelEvento(db, MIEMBRO, "sumar", { apple: true })).toBeNull();
    expect(escrituras(consultas)).toHaveLength(0);
  });

  it("si la marca no se puede leer (la columna no existe, la base no contesta): como Bookea, nada", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db, consultas } = escenario({
      errores: { foorkie_restaurantes: { message: "column foorkie_restaurantes.lealtad_por_foorkie does not exist" } },
    });
    expect(await prepararMensajeDelEvento(db, MIEMBRO, "sumar", { apple: true })).toBeNull();
    expect(escrituras(consultas)).toHaveLength(0);
  });

  it("nunca lanza: ni con la base caída ni con una que revienta", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const caida = escenario({ errores: { miembros: { message: "caída" } } });
    expect(await prepararMensajeDelEvento(caida.db, MIEMBRO, "sumar", { apple: true })).toBeNull();
    const sinPrograma = escenario({ errores: { programa_lealtad: { message: "caída" } } });
    expect(await prepararMensajeDelEvento(sinPrograma.db, MIEMBRO, "sumar", { apple: true })).toBeNull();
    const revienta = {
      from() {
        throw new Error("se cortó la red");
      },
    } as unknown as SupabaseClient;
    await expect(prepararMensajeDelEvento(revienta, MIEMBRO, "sumar", { apple: true })).resolves.toBeNull();
  });

  it("si el texto no se puede guardar para Apple, igual sale para Google", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { db } = escenario({ errores: { "miembros:update": { message: "column miembros.ultimo_hito_mensaje does not exist" } } });
    expect(await prepararMensajeDelEvento(db, MIEMBRO, "sumar", { apple: true })).toMatchObject({ texto: GRACIAS });
  });
});

describe("renglonDelMensaje — lo que lee generar.ts para el pase de Foorkie", () => {
  it("lo guardado para ese cliente, o el valor de partida", async () => {
    const con = escenario({ guardado: `${GRACIAS}${MARCA_DE_CAMBIO}` });
    const fila = con.tablas.programa_lealtad[0];
    expect(await renglonDelMensaje(con.db, MIEMBRO, fila)).toBe(`${GRACIAS}${MARCA_DE_CAMBIO}`);
    const sin = escenario();
    expect(await renglonDelMensaje(sin.db, MIEMBRO, sin.tablas.programa_lealtad[0])).toBe(SIN_MENSAJES_TODAVIA);
  });
});

// ── Las rutas del panel ─────────────────────────────────────────────

const vinculo = { ranchoId: RANCHO, programaId: PROGRAMA };

describe("mensajesDeLaTarjeta — `programa/mensajes`", () => {
  it("los de fábrica mientras el restaurante no guarde nada", async () => {
    expect(await mensajesDeLaTarjeta(escenario().db, vinculo)).toEqual({ ok: true, mensajes: MENSAJES_POR_DEFECTO });
    // Sin la columna, igual: la 0251 no es requisito para leer.
    expect(await mensajesDeLaTarjeta(escenario({ sinColumna: true }).db, vinculo)).toEqual({
      ok: true,
      mensajes: MENSAJES_POR_DEFECTO,
    });
  });

  it("vinculada sin la marca: 403 no_es_de_foorkie", async () => {
    expect(await mensajesDeLaTarjeta(escenario({ marca: false }).db, vinculo)).toMatchObject({
      ok: false,
      codigo: "no_es_de_foorkie",
      status: 403,
    });
  });

  it("una tarjeta que no existe (o de otro negocio) y la base caída", async () => {
    expect(await mensajesDeLaTarjeta(escenario().db, { ranchoId: RANCHO, programaId: MIEMBRO })).toMatchObject({
      ok: false,
      codigo: "sin_programa",
      status: 404,
    });
    expect(
      await mensajesDeLaTarjeta(escenario({ errores: { programa_lealtad: { message: "caída" } } }).db, vinculo),
    ).toMatchObject({ ok: false, codigo: "error_base", status: 500 });
  });
});

describe("guardarMensajesDeLaTarjeta — `programa/mensajes/guardar`", () => {
  it("guarda los tres completos, adentro de la bolsa, sin pisar el ritmo de los clientes", async () => {
    const { db, tablas } = escenario({ configuracion: { ritmo_clientes: "quincenal" } });
    const r = await guardarMensajesDeLaTarjeta(db, {
      ...vinculo,
      cambios: { sumar: { texto: "¡Gracias, volvé pronto!" }, quitar: { activo: false } },
    });
    const esperados = {
      sumar: { activo: true, texto: "¡Gracias, volvé pronto!" },
      quitar: { activo: false, texto: "Tu tarjeta se modificó." },
      canjear: MENSAJES_POR_DEFECTO.canjear,
    };
    expect(r).toEqual({ ok: true, mensajes: esperados, cambio: true });
    expect(tablas.programa_lealtad[0].configuracion).toEqual({ ritmo_clientes: "quincenal", mensajes_automaticos: esperados });
    // Y lo que se guardó es lo que se lee después.
    expect(await mensajesDeLaTarjeta(db, vinculo)).toEqual({ ok: true, mensajes: esperados });
  });

  it("sin cambios de verdad no escribe", async () => {
    const { db, consultas } = escenario();
    expect(await guardarMensajesDeLaTarjeta(db, { ...vinculo, cambios: { sumar: { activo: true, texto: GRACIAS } } })).toEqual({
      ok: true,
      mensajes: MENSAJES_POR_DEFECTO,
      cambio: false,
    });
    expect(escrituras(consultas)).toHaveLength(0);
  });

  it("vinculada SIN la marca (Pura Matcha): 403 y la tarjeta de Bookea no se toca", async () => {
    const { db, consultas, tablas } = escenario({ marca: false, configuracion: { ritmo_clientes: "diario" } });
    const r = await guardarMensajesDeLaTarjeta(db, { ...vinculo, cambios: { sumar: { activo: false } } });
    expect(r).toMatchObject({ ok: false, codigo: "no_es_de_foorkie", status: 403 });
    expect(escrituras(consultas)).toHaveLength(0);
    expect(tablas.programa_lealtad[0].configuracion).toEqual({ ritmo_clientes: "diario" });
  });

  it("sin la 0251 (la columna no existe): 503 sin_migracion, sin intentar escribir", async () => {
    const { db, consultas } = escenario({ sinColumna: true });
    const r = await guardarMensajesDeLaTarjeta(db, { ...vinculo, cambios: { sumar: { activo: false } } });
    expect(r).toMatchObject({ ok: false, codigo: "sin_migracion", status: 503 });
    expect(escrituras(consultas)).toHaveLength(0);
  });

  it("si la base rechaza: la columna que falta es sin_migracion; lo demás, el motivo traducido", async () => {
    const sinColumna = escenario({
      errores: { "programa_lealtad:update": { code: "42703", message: 'column "configuracion" of relation "programa_lealtad" does not exist' } },
    });
    expect(await guardarMensajesDeLaTarjeta(sinColumna.db, { ...vinculo, cambios: { canjear: { activo: false } } })).toMatchObject({
      ok: false,
      codigo: "sin_migracion",
      status: 503,
    });
    const otro = escenario({ errores: { "programa_lealtad:update": { code: "57014", message: "canceling statement" } } });
    expect(await guardarMensajesDeLaTarjeta(otro.db, { ...vinculo, cambios: { canjear: { activo: false } } })).toEqual({
      ok: false,
      codigo: "rechazado",
      motivo: "No se pudo guardar los mensajes: canceling statement",
      status: 400,
    });
  });
});
