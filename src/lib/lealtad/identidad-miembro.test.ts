import { describe, expect, it } from "vitest";
import {
  fichaVisible,
  numeroCorto,
  resolverIdentidad,
  SIN_DATOS,
  type IdentidadCliente,
} from "./identidad-miembro";

/**
 * LAS CUATRO PERSONAS QUE HAY EN PRODUCCIÓN, Y UNA QUINTA QUE INCOMODA.
 *
 * Estas pruebas no cubren «una función devuelve un string»: cubren la
 * decisión que rompió la pantalla. El panel resolvía la identidad por
 * `perfiles` ← `cliente_id`, que desde la 0138 está en null para casi
 * toda la gente, y todas las fichas decían «Cliente». Lo que hay que
 * dejar clavado es QUIÉN GANA cuando hay dos fuentes, y qué se muestra
 * cuando no hay ninguna.
 *
 * Los casos salen de mirar la base de producción, no de imaginar:
 *   · Melissa — nombre, correo y WhatsApp en `personas`, CERO filas en
 *     `perfiles`. Es la ficha que el dueño veía como «Cliente».
 *   · el dueño — en las dos tablas, con el mismo nombre.
 *   · dos personas con los tres campos en null: las del camino roto que
 *     documenta `personas.ts` (sesión anónima del chat tomada por
 *     cuenta). Legítimo como resultado, aunque su causa fuera un bug.
 */

const VACIA: IdentidadCliente = { nombre: null, correo: null, telefono: null };

describe("resolverIdentidad — de dónde sale cada dato", () => {
  it("la persona de `personas` se muestra aunque no tenga fila en `perfiles`", () => {
    // El caso exacto que reportó el dueño.
    expect(
      resolverIdentidad({
        persona: {
          nombre: "Melissa",
          correo: "melissa.chi87@gmail.com",
          telefono: "70119911",
        },
        perfil: null,
      }),
    ).toEqual({
      nombre: "Melissa",
      correo: "melissa.chi87@gmail.com",
      telefono: "70119911",
    });
  });

  it("con solo `perfiles` (membresía anterior a la 0138) el respaldo contesta", () => {
    expect(resolverIdentidad({ persona: null, perfil: { nombre: "Ana Vargas" } })).toEqual({
      nombre: "Ana Vargas",
      correo: null,
      telefono: null,
    });
  });

  it("cuando están las dos gana `personas`: es la raíz que la 0138 declaró", () => {
    // `perfiles` es el perfil de la CUENTA y puede quedar viejo; la
    // persona es la que el alta y el pase escriben.
    const r = resolverIdentidad({
      persona: { nombre: "Melissa Chinchilla", correo: "melissa@x.com" },
      perfil: { nombre: "melissa" },
    });
    expect(r.nombre).toBe("Melissa Chinchilla");
  });

  it("la ficha del negocio APORTA lo que `personas` no tiene, y no pisa lo que sí", () => {
    // Por qué importa: `resolver_persona` «enriquece pero no pisa»
    // (0138:905). Si la señora dejó solo el teléfono en el alta y el
    // dueño le escribió el nombre en su CRM, ese nombre NUNCA sube a
    // `personas` — sin este escalón no se vería en ningún lado.
    const r = resolverIdentidad({
      persona: { nombre: null, correo: null, telefono: "88880001" },
      ficha: { nombre: "Doña Marta", correo: "marta@x.com", telefono: "70000000" },
    });
    expect(r).toEqual({
      nombre: "Doña Marta",
      correo: "marta@x.com",
      // el teléfono de `personas` manda: es el que sostiene el índice
      // único de deduplicación.
      telefono: "88880001",
    });
  });

  it("se resuelve CAMPO POR CAMPO, no eligiendo una tabla entera", () => {
    const r = resolverIdentidad({
      persona: { nombre: "Luis", correo: null, telefono: null },
      ficha: { nombre: null, correo: "luis@x.com", telefono: null },
      perfil: { nombre: "Luis Herrera", telefono: "87103739" },
    });
    expect(r).toEqual({ nombre: "Luis", correo: "luis@x.com", telefono: "87103739" });
  });

  it("un string vacío no tapa el dato bueno de la fuente siguiente", () => {
    // `??` no alcanza acá: `"" ?? x` devuelve `""`. Una importación vieja
    // con `nombre: ''` habría dejado la ficha muda otra vez.
    expect(
      resolverIdentidad({ persona: { nombre: "   " }, perfil: { nombre: "Ana" } }).nombre,
    ).toBe("Ana");
  });

  it("sin ninguna fuente, todo queda en null (y NO en el string «Cliente»)", () => {
    // Que el hueco viaje como null y no como texto es lo que le permite
    // a la pantalla decir POR QUÉ está vacío en vez de inventar un
    // nombre que nadie dio.
    expect(resolverIdentidad({})).toEqual(VACIA);
  });
});

describe("fichaVisible — qué se lee en la ficha", () => {
  it("el nombre manda, y el contacto lo acompaña", () => {
    const v = fichaVisible({
      nombre: "Melissa",
      correo: "melissa.chi87@gmail.com",
      telefono: "70119911",
    });
    expect(v.titulo).toBe("Melissa");
    expect(v.sinNombre).toBe(false);
    expect(v.contacto).toEqual(["melissa.chi87@gmail.com", "70119911"]);
  });

  it("sin nombre sube el correo al título, y no se repite abajo", () => {
    const v = fichaVisible({ nombre: null, correo: "ana@x.com", telefono: "88887777" });
    expect(v.titulo).toBe("ana@x.com");
    expect(v.sinNombre).toBe(true);
    expect(v.contacto).toEqual(["88887777"]);
  });

  it("con solo teléfono, el teléfono identifica", () => {
    const v = fichaVisible({ nombre: null, correo: null, telefono: "88880001" });
    expect(v.titulo).toBe("88880001");
    expect(v.contacto).toEqual([]);
  });

  it("sin NADA dice que la persona no dio sus datos, y usa lo que sí existe", () => {
    // Lo que el dueño necesita saber es que no falló el sistema: falta
    // el dato. Y con la fecha, el Wallet y el número corto puede
    // distinguir dos fichas vacías, que es lo que «Cliente» no permitía.
    const v = fichaVisible(VACIA, {
      alta: "2026-08-17T21:09:05.691771+00:00",
      pase: "apple",
      miembroId: "00e2438b-685a-462e-a5b1-bfad957638f1",
    });
    expect(v.titulo).toBe(SIN_DATOS);
    expect(v.sinNombre).toBe(true);
    expect(v.contacto).toHaveLength(1);
    expect(v.contacto[0]).toContain("Todavía no dejó su nombre ni su contacto");
    expect(v.contacto[0]).toContain("17 ago");
    expect(v.contacto[0]).toContain("Apple Wallet");
    expect(v.contacto[0]).toContain("38F1");
  });

  it("sin fecha ni pase sigue explicándose: la frase no depende de los extras", () => {
    const v = fichaVisible(VACIA);
    expect(v.contacto[0]).toBe("Todavía no dejó su nombre ni su contacto");
  });

  it("una fecha rota no rompe la ficha", () => {
    const v = fichaVisible(VACIA, { alta: "no-es-una-fecha" });
    expect(v.contacto[0]).toBe("Todavía no dejó su nombre ni su contacto");
  });
});

describe("numeroCorto", () => {
  it("son los últimos cuatro del id, sin guiones y en mayúscula", () => {
    expect(numeroCorto("f65220b7-8618-4926-8248-7820d15aa2b3")).toBe("A2B3");
  });

  it("sin id no inventa nada", () => {
    expect(numeroCorto(null)).toBeNull();
    expect(numeroCorto("abc")).toBeNull();
  });
});
