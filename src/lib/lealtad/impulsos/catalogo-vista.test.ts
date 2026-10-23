import { describe, expect, it } from "vitest";
import { ACTIVADORES, CANALES, CONDICIONES, ETIQUETA_OP, MAX_IMPULSOS_POR_TARJETA, TOPE_DIARIO_POR_CLIENTE } from "./catalogo";
import { construirCatalogo, TOPES } from "./catalogo-vista";
import { contextoDeEjemplo, VARIABLES } from "./mensaje";
import { normalizarEntrada, validarImpulso } from "./validacion";

/**
 * El catálogo serializable: lo que el panel de Foorkie recibe ya resuelto para UNA tarjeta.
 * Tiene que ser JSON puro, completo (todos los activadores, también los apagados), filtrado por el tipo de tarjeta y
 * decir lo mismo que la validación (los topes).
 */

const NOMBRES = { nombreNegocio: "Donde George", nombrePrograma: "Tarjeta de sellos" };

/** Recorre el valor buscando lo que JSON no puede llevar: funciones, undefined, símbolos, fechas, clases. */
function cosasNoSerializables(valor: unknown, ruta = "catalogo"): string[] {
  if (valor === null) return [];
  if (typeof valor === "function" || typeof valor === "undefined" || typeof valor === "symbol" || typeof valor === "bigint") {
    return [`${ruta}: ${typeof valor}`];
  }
  if (Array.isArray(valor)) return valor.flatMap((v, i) => cosasNoSerializables(v, `${ruta}[${i}]`));
  if (typeof valor === "object") {
    if (Object.getPrototypeOf(valor) !== Object.prototype) return [`${ruta}: no es un objeto plano`];
    return Object.entries(valor).flatMap(([k, v]) => cosasNoSerializables(v, `${ruta}.${k}`));
  }
  return [];
}

describe("construirCatalogo", () => {
  it("es JSON puro: sin funciones ni undefined, y sobrevive a ida y vuelta", () => {
    for (const modo of ["sellos", "puntos", "cashback"]) {
      const c = construirCatalogo(modo, NOMBRES, "foorkie");
      expect(cosasNoSerializables(c)).toEqual([]);
      expect(JSON.parse(JSON.stringify(c))).toEqual(c);
    }
  });

  it("trae TODOS los activadores, también los apagados, con su porqué", () => {
    const c = construirCatalogo("sellos", NOMBRES, "foorkie");
    expect(c.activadores.map((a) => a.id)).toEqual(ACTIVADORES.map((a) => a.id));
    for (const a of c.activadores) {
      const original = ACTIVADORES.find((x) => x.id === a.id)!;
      expect(a.disponible).toBe(original.disponible);
      expect(a.grupo).toBe(original.grupo);
      if (a.disponible) expect(a).not.toHaveProperty("noDisponible");
      else expect(a.noDisponible).toBeTruthy();
    }
    const apagados = c.activadores.filter((a) => !a.disponible).map((a) => a.id);
    expect(apagados).toEqual(["pase_google", "cumpleanos", "vencimiento_proximo", "nivel_alcanzado"]);
  });

  it("marca qué activadores aplican al tipo de tarjeta", () => {
    const sellos = construirCatalogo("sellos", NOMBRES, "foorkie").activadores;
    const puntos = construirCatalogo("puntos", NOMBRES, "foorkie").activadores;
    const aplica = (lista: typeof sellos, id: string) => lista.find((a) => a.id === id)!.aplica;
    expect(aplica(sellos, "sello_registrado")).toBe(true);
    expect(aplica(puntos, "sello_registrado")).toBe(false);
    expect(aplica(puntos, "puntos_acumulados")).toBe(true);
    expect(aplica(sellos, "puntos_acumulados")).toBe(false);
    expect(aplica(sellos, "inscripcion")).toBe(true);
  });

  it("lleva los parámetros y las marcas de cada activador", () => {
    const c = construirCatalogo("sellos", NOMBRES, "foorkie");
    const inactividad = c.activadores.find((a) => a.id === "inactividad")!;
    expect(inactividad.parametros?.map((p) => p.campo)).toEqual(["dias", "ventana_dias"]);
    expect(inactividad.parametros?.[0]).toEqual({
      campo: "dias",
      etiqueta: "Días sin venir",
      ayuda: "Se le escribe cuando cumple estos días sin actividad.",
      min: 1,
      max: 365,
      defecto: 30,
      unidad: "días",
    });
    expect(c.activadores.find((a) => a.id === "meta_proxima")).toMatchObject({ requiereRecompensa: true, parametros: [{ campo: "faltan" }] });
    expect(c.activadores.find((a) => a.id === "inscripcion")).not.toHaveProperty("requiereRecompensa");
    expect(c.activadores.find((a) => a.id === "inscripcion")).not.toHaveProperty("parametros");
  });

  it("los canales: el Wallet disponible; correo, SMS, WhatsApp y notificaciones web apagados con su porqué", () => {
    const { canales } = construirCatalogo("sellos", NOMBRES, "foorkie");
    expect(canales.map((c) => c.id)).toEqual(CANALES.map((c) => c.id));
    const por = (id: string) => canales.find((c) => c.id === id)!;
    expect(por("wallet")).toMatchObject({ disponible: true, tituloMax: 40, cuerpoMax: 120, unaLinea: true });
    expect(por("wallet")).not.toHaveProperty("falta");
    expect(por("wallet").limites).toHaveLength(4);
    expect(por("correo")).toMatchObject({ disponible: false, tituloMax: 80, cuerpoMax: 600, unaLinea: false });
    expect(por("correo").falta).toMatch(/todavía no salen desde Foorkie Lealtad/);
    for (const id of ["sms", "whatsapp", "push_web"]) {
      expect(por(id).disponible).toBe(false);
      expect(por(id).falta).toBeTruthy();
    }
  });

  it("las condiciones: solo las del tipo de tarjeta, con la etiqueta ya resuelta", () => {
    const etiqueta = (modo: string) => construirCatalogo(modo, NOMBRES, "foorkie").condiciones.find((c) => c.id === "saldo")?.etiqueta;
    expect(etiqueta("sellos")).toBe("Sellos actuales");
    expect(etiqueta("puntos")).toBe("Puntos disponibles");
    expect(etiqueta("cashback")).toBe("Saldo de cashback");
    // Una tarjeta que no cuenta saldo (un cupón, por ejemplo) solo admite las condiciones "para todos".
    const otras = construirCatalogo("cupon", NOMBRES, "foorkie").condiciones.map((c) => c.id);
    expect(otras).toEqual(CONDICIONES.filter((c) => c.modos === "todos").map((c) => c.id));
    expect(otras).not.toContain("saldo");
    const sellos = construirCatalogo("sellos", NOMBRES, "foorkie").condiciones;
    expect(sellos.find((c) => c.id === "cliente")).toMatchObject({
      tipo: "opciones",
      ops: ["es"],
      opciones: [
        { valor: "nuevo", etiqueta: "Cliente nuevo" },
        { valor: "recurrente", etiqueta: "Cliente recurrente" },
      ],
    });
    expect(sellos.find((c) => c.id === "visitas")).toMatchObject({ tipo: "numero", ops: ["gte", "lte", "eq"], min: 0, max: 100000 });
    expect(sellos.find((c) => c.id === "tiene_pase")).toMatchObject({ tipo: "booleano" });
    expect(sellos.find((c) => c.id === "tiene_pase")).not.toHaveProperty("min");
  });

  it("las etiquetas de las comparaciones", () => {
    expect(construirCatalogo("sellos", NOMBRES).etiquetasOp).toEqual(ETIQUETA_OP);
    expect(construirCatalogo("sellos", NOMBRES).etiquetasOp).toEqual({ gte: "es al menos", lte: "es como máximo", eq: "es exactamente", es: "es" });
  });

  it("las variables: las del tipo de tarjeta, con el ejemplo que da la vista previa", () => {
    const sellos = construirCatalogo("sellos", NOMBRES, "foorkie").variables;
    const ids = sellos.map((v) => v.id);
    expect(ids).toContain("sellos_actuales");
    expect(ids).not.toContain("puntos_disponibles");
    const puntos = construirCatalogo("puntos", NOMBRES, "foorkie").variables.map((v) => v.id);
    expect(puntos).toContain("puntos_disponibles");
    expect(puntos).not.toContain("sellos_actuales");

    for (const v of sellos) {
      const def = VARIABLES.find((x) => x.id === v.id)!;
      expect(v.ejemplo).toBe(def.valor(contextoDeEjemplo("sellos", NOMBRES.nombreNegocio, NOMBRES.nombrePrograma)));
      expect(v.etiqueta).toBe(def.etiqueta);
    }
    expect(sellos.find((v) => v.id === "nombre_negocio")?.ejemplo).toBe("Donde George");
    expect(sellos.find((v) => v.id === "nombre_programa")?.ejemplo).toBe("Tarjeta de sellos");
    expect(sellos.find((v) => v.id === "nombre_cliente")?.ejemplo).toBe("María");
    expect(sellos.find((v) => v.id === "meta_sellos")).toMatchObject({ requiereRecompensa: true, ejemplo: "5" });
    expect(sellos.find((v) => v.id === "nombre_cliente")).not.toHaveProperty("requiereRecompensa");
  });

  it("un negocio sin nombre usa el de ejemplo de siempre", () => {
    const v = construirCatalogo("sellos", { nombreNegocio: "  ", nombrePrograma: "" }, "foorkie").variables;
    expect(v.find((x) => x.id === "nombre_negocio")?.ejemplo).toBe("Tu negocio");
    expect(v.find((x) => x.id === "nombre_programa")?.ejemplo).toBe("Tu tarjeta");
  });

  it("en la voz de Foorkie no nombra a Bookea; en la de Bookea sí (la prueba no es vacía)", () => {
    for (const modo of ["sellos", "puntos", "cashback"]) {
      expect(JSON.stringify(construirCatalogo(modo, NOMBRES, "foorkie"))).not.toMatch(/bookea/i);
    }
    expect(JSON.stringify(construirCatalogo("sellos", NOMBRES))).toMatch(/bookea/i);
  });

  it("no cambia el catálogo de código (cada llamada devuelve copias)", () => {
    const a = construirCatalogo("sellos", NOMBRES, "foorkie");
    a.activadores[0].etiqueta = "otra cosa";
    a.canales[0].limites.push("de más");
    a.etiquetasOp.gte = "x";
    a.topes.maxCondiciones = 99;
    const b = construirCatalogo("sellos", NOMBRES, "foorkie");
    expect(b.activadores[0].etiqueta).toBe(ACTIVADORES[0].etiqueta);
    expect(b.canales[0].limites).toHaveLength(4);
    expect(b.etiquetasOp.gte).toBe("es al menos");
    expect(b.topes.maxCondiciones).toBe(12);
    expect(CANALES[0].limites).toHaveLength(4);
  });
});

describe("los topes del catálogo dicen lo mismo que la validación", () => {
  const base = normalizarEntrada({ nombre: "Mi impulso", activador: "inscripcion", canal: "wallet", titulo: "Hola", cuerpo: "Gracias por venir" });
  const ctx = { modo: "sellos", esFoorkie: true, tieneRecompensa: true, hoy: "2026-10-21", voz: "foorkie" as const };
  /** Los problemas que BLOQUEAN GUARDAR de ese campo, con el impulso base cambiado. */
  const problemasDe = (cambio: Partial<typeof base>, campo: string) =>
    validarImpulso({ ...base, ...cambio }, ctx).problemas.filter((p) => p.campo === campo && p.bloquea === "guardar");
  const letras = (n: number) => "a".repeat(n);

  it("los topes publicados", () => {
    expect(construirCatalogo("sellos", NOMBRES).topes).toEqual({
      maxImpulsosPorTarjeta: 40,
      topeDiarioPorCliente: 3,
      maxCondiciones: 12,
      nombreMax: 80,
      descripcionMax: 240,
      tituloMax: 60,
      cuerpoMax: 600,
    });
    expect(TOPES.maxImpulsosPorTarjeta).toBe(MAX_IMPULSOS_POR_TARJETA);
    expect(TOPES.topeDiarioPorCliente).toBe(TOPE_DIARIO_POR_CLIENTE);
  });

  it("el nombre, la descripción, el título y el cuerpo: el tope entra y uno más no", () => {
    expect(problemasDe({ nombre: letras(TOPES.nombreMax) }, "nombre")).toEqual([]);
    expect(problemasDe({ nombre: letras(TOPES.nombreMax + 1) }, "nombre")).toHaveLength(1);
    expect(problemasDe({ descripcion: letras(TOPES.descripcionMax) }, "descripcion")).toEqual([]);
    expect(problemasDe({ descripcion: letras(TOPES.descripcionMax + 1) }, "descripcion")).toHaveLength(1);
    expect(problemasDe({ titulo: letras(TOPES.tituloMax) }, "titulo")).toEqual([]);
    expect(problemasDe({ titulo: letras(TOPES.tituloMax + 1) }, "titulo")).toHaveLength(1);
    expect(problemasDe({ cuerpo: letras(TOPES.cuerpoMax) }, "cuerpo")).toEqual([]);
    expect(problemasDe({ cuerpo: letras(TOPES.cuerpoMax + 1) }, "cuerpo")).toHaveLength(1);
  });

  it("y el normalizador recorta a esos mismos topes (lo que sobra nunca llega a la base)", () => {
    expect(normalizarEntrada({ nombre: letras(TOPES.nombreMax + 20) }).nombre).toHaveLength(TOPES.nombreMax);
    expect(normalizarEntrada({ descripcion: letras(TOPES.descripcionMax + 20) }).descripcion).toHaveLength(TOPES.descripcionMax);
  });

  it("las condiciones: 12 entran, 13 no (y el normalizador nunca deja más de 12)", () => {
    const cond = { campo: "visitas" as const, op: "gte" as const, valor: 1 };
    const con = (n: number) => Array.from({ length: n }, () => ({ ...cond }));
    expect(problemasDe({ condiciones: con(TOPES.maxCondiciones) }, "condiciones")).toEqual([]);
    expect(problemasDe({ condiciones: con(TOPES.maxCondiciones + 1) }, "condiciones")).toEqual([
      { campo: "condiciones", bloquea: "guardar", mensaje: `Podés poner hasta ${TOPES.maxCondiciones} condiciones.` },
    ]);
    expect(normalizarEntrada({ condiciones: con(TOPES.maxCondiciones + 5) }).condiciones).toHaveLength(TOPES.maxCondiciones);
  });
});
