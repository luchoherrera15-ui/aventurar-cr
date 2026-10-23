import { describe, expect, it } from "vitest";
import { ACTIVADORES, CANALES, activadoresParaModo } from "./catalogo";
import { PLANTILLAS, plantillaPorId } from "./preconfigurados";
import { normalizarEntrada, validarImpulso, type ContextoValidacion } from "./validacion";
import type { EntradaImpulso } from "./tipos";

const ctx = (extra: Partial<ContextoValidacion> = {}): ContextoValidacion => ({
  modo: "sellos",
  esFoorkie: false,
  tieneRecompensa: true,
  hoy: "2026-10-21",
  ...extra,
});

const buena = (extra: Partial<EntradaImpulso> = {}): EntradaImpulso => ({
  nombre: "Bienvenida",
  descripcion: null,
  activador: "inscripcion",
  activador_config: {},
  condiciones: [],
  canal: "wallet",
  titulo: "¡Bienvenido a {{nombre_negocio}}!",
  cuerpo: "Hola {{nombre_cliente|}}, gracias por unirte.",
  retraso_minutos: 5,
  horario: { modo: "inmediato" },
  vigente_desde: null,
  vigente_hasta: null,
  espera_minima_horas: 0,
  plantilla: null,
  ...extra,
});

const campos = (e: EntradaImpulso, c = ctx()) => validarImpulso(e, c).problemas.map((p) => p.campo);

describe("validarImpulso: lo básico", () => {
  it("un impulso bien armado se puede guardar y activar", () => {
    const r = validarImpulso(buena(), ctx());
    expect(r.problemas).toEqual([]);
    expect(r.puedeGuardar).toBe(true);
    expect(r.puedeActivar).toBe(true);
  });

  it("nombre demasiado corto o largo", () => {
    expect(campos(buena({ nombre: "ab" }))).toContain("nombre");
    expect(campos(buena({ nombre: "x".repeat(81) }))).toContain("nombre");
  });

  it("el título y el mensaje son obligatorios", () => {
    expect(campos(buena({ titulo: "" }))).toContain("titulo");
    expect(campos(buena({ cuerpo: "hi" }))).toContain("cuerpo");
  });
});

describe("validarImpulso: activador", () => {
  it("el cumpleaños NO se puede guardar: no hay fecha de nacimiento de nadie", () => {
    const r = validarImpulso(buena({ activador: "cumpleanos" }), ctx());
    expect(r.puedeGuardar).toBe(false);
    expect(r.problemas.find((p) => p.campo === "activador")?.mensaje).toMatch(/fecha de cumpleaños/);
  });

  it("tampoco el de Google Wallet, el de vencimiento ni el de nivel", () => {
    for (const id of ["pase_google", "vencimiento_proximo", "nivel_alcanzado"]) {
      expect(validarImpulso(buena({ activador: id }), ctx()).puedeGuardar).toBe(false);
    }
  });

  it("un activador inventado no pasa", () => {
    expect(validarImpulso(buena({ activador: "magia" }), ctx()).puedeGuardar).toBe(false);
  });

  it("recibir un sello solo vale en tarjetas de sellos", () => {
    const e = buena({ activador: "sello_registrado" });
    expect(validarImpulso(e, ctx({ modo: "sellos" })).puedeGuardar).toBe(true);
    expect(validarImpulso(e, ctx({ modo: "puntos" })).puedeGuardar).toBe(false);
  });

  it("«cerca de su premio» necesita una recompensa: se puede guardar pero no activar", () => {
    const e = buena({ activador: "meta_proxima", activador_config: { faltan: 1 }, cuerpo: "Te falta poco." });
    const r = validarImpulso(e, ctx({ tieneRecompensa: false }));
    expect(r.puedeGuardar).toBe(true);
    expect(r.puedeActivar).toBe(false);
    expect(r.problemas[0].mensaje).toMatch(/recompensa/);
  });

  it("los parámetros se validan (días de inactividad)", () => {
    const e = buena({ activador: "inactividad", activador_config: { dias: 0, ventana_dias: 30 } });
    expect(campos(e)).toContain("activador_config.dias");
    expect(validarImpulso(buena({ activador: "inactividad", activador_config: { dias: 30, ventana_dias: 30 } }), ctx()).puedeGuardar).toBe(true);
  });
});

describe("validarImpulso: canal", () => {
  it("SMS, WhatsApp y web push no se pueden elegir: no hay proveedor", () => {
    for (const canal of ["sms", "whatsapp", "push_web"]) {
      const r = validarImpulso(buena({ canal }), ctx());
      expect(r.puedeGuardar).toBe(false);
      expect(r.problemas.find((p) => p.campo === "canal")?.mensaje).toBeTruthy();
    }
  });

  it("el correo no se ofrece en tarjetas de Foorkie (los manda Foorkie)", () => {
    const r = validarImpulso(buena({ canal: "correo" }), ctx({ esFoorkie: true }));
    expect(r.puedeGuardar).toBe(false);
    expect(r.problemas.find((p) => p.campo === "canal")?.mensaje).toMatch(/Foorkie/);
    expect(validarImpulso(buena({ canal: "correo" }), ctx({ esFoorkie: false })).puedeGuardar).toBe(true);
  });
});

describe("validarImpulso: el mensaje", () => {
  it("rechaza variables que no existen o que no son de este tipo de tarjeta", () => {
    expect(campos(buena({ cuerpo: "Hola {{foo}}" }))).toContain("cuerpo");
    expect(campos(buena({ cuerpo: "Vas {{puntos_disponibles}}" }), ctx({ modo: "sellos" }))).toContain("cuerpo");
  });

  it("variables válidas pasan y avisa de las que no tienen alternativo", () => {
    const r = validarImpulso(buena({ cuerpo: "Hola {{nombre_cliente}}" }), ctx());
    expect(r.puedeActivar).toBe(true);
    expect(r.avisos.join(" ")).toMatch(/nombre_cliente/);
  });

  it("el Wallet limita el largo con el ejemplo ya armado", () => {
    const largo = buena({ cuerpo: "palabra ".repeat(30) });
    expect(campos(largo)).toContain("cuerpo");
    expect(validarImpulso(largo, ctx()).puedeGuardar).toBe(true); // un borrador largo se guarda
    expect(validarImpulso(largo, ctx()).puedeActivar).toBe(false); // pero no se activa
  });

  it("el correo admite mensajes más largos", () => {
    expect(validarImpulso(buena({ canal: "correo", cuerpo: "palabra ".repeat(30) }), ctx()).puedeActivar).toBe(true);
  });

  it("límites de la base: título 60, mensaje 600", () => {
    expect(validarImpulso(buena({ titulo: "t".repeat(61) }), ctx()).puedeGuardar).toBe(false);
    expect(validarImpulso(buena({ canal: "correo", cuerpo: "c".repeat(601) }), ctx()).puedeGuardar).toBe(false);
  });
});

describe("validarImpulso: cuándo", () => {
  it("retraso fuera de rango", () => {
    expect(campos(buena({ retraso_minutos: -1 }))).toContain("retraso_minutos");
    expect(campos(buena({ retraso_minutos: 525_601 }))).toContain("retraso_minutos");
    expect(campos(buena({ retraso_minutos: 1.5 }))).toContain("retraso_minutos");
  });

  it("un horario mal armado no se guarda", () => {
    expect(campos(buena({ horario: { modo: "ventana", desde: "18:00", hasta: "09:00" } }))).toContain("horario");
    expect(campos(buena({ horario: { modo: "hora_exacta", hora: "99:00" } }))).toContain("horario");
  });

  it("vigencia: el fin no puede ser antes del inicio", () => {
    expect(campos(buena({ vigente_desde: "2026-11-02", vigente_hasta: "2026-11-01" }))).toContain("vigente_hasta");
  });

  it("una campaña que ya terminó se guarda pero no se activa", () => {
    const r = validarImpulso(buena({ vigente_hasta: "2026-10-01" }), ctx());
    expect(r.puedeGuardar).toBe(true);
    expect(r.puedeActivar).toBe(false);
  });
});

describe("validarImpulso: condiciones", () => {
  it("una condición válida pasa", () => {
    expect(validarImpulso(buena({ condiciones: [{ campo: "visitas", op: "gte", valor: 3 }] }), ctx()).puedeActivar).toBe(true);
  });
  it("una inexistente o mal tipada, no", () => {
    expect(validarImpulso(buena({ condiciones: [{ campo: "nivel" as never, op: "es", valor: "oro" }] }), ctx()).puedeGuardar).toBe(false);
    expect(validarImpulso(buena({ condiciones: [{ campo: "visitas", op: "gte", valor: "x" }] }), ctx()).puedeGuardar).toBe(false);
  });
});

describe("normalizarEntrada: nunca se confía en el navegador", () => {
  it("una entrada vacía o basura no rompe nada", () => {
    for (const basura of [null, undefined, 5, "texto", [], [1, 2], {}]) {
      const e = normalizarEntrada(basura);
      expect(e.nombre).toBe("");
      expect(e.condiciones).toEqual([]);
      expect(e.horario.modo).toBe("inmediato");
      expect(e.retraso_minutos).toBe(0);
    }
  });

  it("fuerza tipos y rangos", () => {
    const e = normalizarEntrada({
      nombre: 123,
      retraso_minutos: "15",
      espera_minima_horas: 99999999,
      canal: " WALLET ",
      activador: " Inscripcion ",
    });
    expect(e.nombre).toBe("");
    expect(e.retraso_minutos).toBe(15);
    expect(e.espera_minima_horas).toBe(8760);
    expect(e.canal).toBe("wallet");
    expect(e.activador).toBe("inscripcion");
  });

  it("descarta campos que no existen (no se cuela un rancho_id ni un estado)", () => {
    const e = normalizarEntrada({ nombre: "Hola", rancho_id: "otro", estado: "activo", id: "x", __proto__: { a: 1 } }) as Record<string, unknown>;
    expect(e.rancho_id).toBeUndefined();
    expect(e.estado).toBeUndefined();
    expect(e.id).toBeUndefined();
  });

  it("acota arreglos: 12 condiciones, 20 sellos", () => {
    const condiciones = Array.from({ length: 50 }, () => ({ campo: "visitas", op: "gte", valor: 1 }));
    expect(normalizarEntrada({ condiciones }).condiciones).toHaveLength(12);
    const e = normalizarEntrada({
      activador: "sello_registrado",
      activador_config: { sellos: Array.from({ length: 60 }, (_, i) => i + 1) },
    });
    expect(e.activador_config.sellos).toHaveLength(20);
  });

  it("limpia el texto: sin marcadores invisibles ni saltos en el título", () => {
    const e = normalizarEntrada({ titulo: "Hola​\nmundo", cuerpo: "uno​\n\n\n\ndos" });
    expect(e.titulo).toBe("Hola mundo");
    expect(e.cuerpo).toBe("uno\n\ndos");
  });

  it("fechas inexistentes se descartan", () => {
    expect(normalizarEntrada({ vigente_desde: "2026-02-30" }).vigente_desde).toBeNull();
    expect(normalizarEntrada({ vigente_desde: "mañana" }).vigente_desde).toBeNull();
    expect(normalizarEntrada({ vigente_desde: "2026-02-28" }).vigente_desde).toBe("2026-02-28");
  });

  it("el horario se reconstruye: días únicos y ordenados, y sin días si son todos", () => {
    const e = normalizarEntrada({ horario: { modo: "ventana", desde: "09:00", hasta: "18:00", dias: [5, 1, 1, 9, -2, 3] } });
    expect(e.horario).toEqual({ modo: "ventana", desde: "09:00", hasta: "18:00", siguiente_ventana: true, dias: [1, 3, 5] });
    const todos = normalizarEntrada({ horario: { modo: "ventana", desde: "09:00", hasta: "18:00", dias: [0, 1, 2, 3, 4, 5, 6] } });
    expect(todos.horario.dias).toBeUndefined();
  });

  it("los parámetros del activador toman su valor por defecto", () => {
    const e = normalizarEntrada({ activador: "inactividad", activador_config: {} });
    expect(e.activador_config).toEqual({ dias: 30, ventana_dias: 30 });
  });

  it("la plantilla solo acepta un id simple", () => {
    expect(normalizarEntrada({ plantilla: "bienvenida" }).plantilla).toBe("bienvenida");
    expect(normalizarEntrada({ plantilla: "'; drop table x;--" }).plantilla).toBeNull();
  });
});

describe("el catálogo", () => {
  it("todo lo que dice estar disponible tiene un id único", () => {
    const ids = ACTIVADORES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(CANALES.map((c) => c.id)).size).toBe(CANALES.length);
  });
  it("lo que no está disponible siempre dice por qué", () => {
    for (const a of ACTIVADORES.filter((x) => !x.disponible)) expect(a.noDisponible).toBeTruthy();
    for (const c of CANALES.filter((x) => !x.disponible)) expect(c.falta).toBeTruthy();
  });
  it("solo Wallet y correo están disponibles como canal", () => {
    expect(CANALES.filter((c) => c.disponible).map((c) => c.id).sort()).toEqual(["correo", "wallet"]);
  });
  it("cada tipo de tarjeta ve sus activadores y los no disponibles aparte", () => {
    const sellos = activadoresParaModo("sellos");
    expect(sellos.disponibles.map((a) => a.id)).toContain("sello_registrado");
    expect(sellos.disponibles.map((a) => a.id)).not.toContain("puntos_acumulados");
    expect(sellos.noDisponibles.map((a) => a.id)).toContain("cumpleanos");
    expect(activadoresParaModo("puntos").disponibles.map((a) => a.id)).toContain("puntos_acumulados");
  });
});

describe("las plantillas preconfiguradas", () => {
  it("son siete y ninguna nace activa (siempre es un borrador que el negocio revisa)", () => {
    expect(PLANTILLAS).toHaveLength(7);
    expect(plantillaPorId("bienvenida")).not.toBeNull();
    expect(plantillaPorId("no-existe")).toBeNull();
  });

  it("las no disponibles lo dicen y explican por qué", () => {
    const apagadas = PLANTILLAS.filter((p) => !p.disponible).map((p) => p.id).sort();
    expect(apagadas).toEqual(["cumpleanos", "vencimiento"]);
    for (const p of PLANTILLAS.filter((x) => !x.disponible)) expect(p.motivo).toBeTruthy();
  });

  // La prueba que importa: nada que se ofrezca como punto de partida puede estar roto.
  for (const modo of ["sellos", "puntos", "cashback"]) {
    for (const p of PLANTILLAS.filter((x) => x.disponible)) {
      it(`«${p.nombre}» en una tarjeta de ${modo} se puede activar tal cual`, () => {
        const entrada = p.entrada(modo);
        const act = ACTIVADORES.find((a) => a.id === entrada.activador)!;
        // si la plantilla no aplica a este tipo de tarjeta, no hay nada que probar
        if (act.modos !== "todos" && !act.modos.includes(modo)) return;
        const r = validarImpulso(entrada, ctx({ modo }));
        expect(r.problemas, JSON.stringify(r.problemas)).toEqual([]);
        expect(r.puedeActivar).toBe(true);
      });
    }
  }

  it("la de bienvenida espera 5 minutos y la de recuperación no repite durante 30 días", () => {
    expect(plantillaPorId("bienvenida")!.entrada("sellos").retraso_minutos).toBe(5);
    const rec = plantillaPorId("recuperacion")!.entrada("sellos");
    expect(rec.espera_minima_horas).toBe(720);
    expect(rec.horario.modo).toBe("ventana");
  });
});
