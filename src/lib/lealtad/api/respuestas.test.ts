import { describe, expect, it } from "vitest";
import {
  CAMPOS_PROHIBIDOS,
  camposProhibidos,
  idPublico,
  inicialesPublicas,
  serializarAcreditacion,
  serializarSaldo,
  serializarYo,
} from "./respuestas";

/**
 * ESTE ARCHIVO ES EL CANDADO.
 *
 * La gente cuyos datos están en juego no es usuaria de Bookea: le dio
 * su nombre y su teléfono a la barbería de la esquina. Si un campo
 * personal se cuela en una respuesta, ya se filtró — no hay forma de
 * "des-enviarlo". Por eso cada serializador se prueba contra la lista
 * de campos prohibidos, y no solo contra lo que sí devuelve.
 *
 * Quedan TRES serializadores porque quedan tres endpoints. Los de
 * `/programa` y `/recompensas` se fueron enteros cuando la API se acotó
 * a su único caso de uso —sumar un sello y que el pase se actualice— y
 * con ellos se fue el scope `catalogo`.
 */

describe("camposProhibidos — el detector", () => {
  it("no encuentra nada en un objeto limpio", () => {
    expect(camposProhibidos({ saldo: 7, faltan: 3 })).toEqual([]);
  });

  it("encuentra un campo personal en el primer nivel", () => {
    expect(camposProhibidos({ telefono: "8888-8888" })).toEqual(["telefono"]);
  });

  it("encuentra uno anidado, y dice dónde", () => {
    expect(camposProhibidos({ cliente: { correo: "a@b.cr" } })).toEqual(["cliente.correo"]);
  });

  it("mira dentro de los arreglos", () => {
    expect(camposProhibidos({ lista: [{ ok: 1 }, { notas: "alérgico" }] })).toEqual([
      "lista[1].notas",
    ]);
  });

  it("no se deja engañar por mayúsculas", () => {
    expect(camposProhibidos({ Telefono: "8888" })).toEqual(["Telefono"]);
  });

  it("atrapa los identificadores internos, no solo los datos de contacto", () => {
    // `miembro_id` es el primer parámetro de `acreditar_lealtad` y el
    // mismo uuid que anda por el panel: devolverlo sería regalar una
    // llave maestra seudónima que sobrevive a la revocación.
    expect(camposProhibidos({ miembro_id: "x" })).toEqual(["miembro_id"]);
    expect(camposProhibidos({ pase: { auth_token: "x" } })).toEqual(["pase.auth_token"]);
    expect(camposProhibidos({ secreto_hash: "x" })).toEqual(["secreto_hash"]);
    expect(camposProhibidos({ rancho_id: "x" })).toEqual(["rancho_id"]);
  });

  it("la lista incluye lo que este repo ya filtró antes por un select(*)", () => {
    for (const campo of ["telefono", "correo", "notas", "cedula", "direccion", "auth_token"]) {
      expect(CAMPOS_PROHIBIDOS).toContain(campo);
    }
  });
});

describe("inicialesPublicas — la única excepción, y su límite", () => {
  it("da dos letras con punto", () => {
    expect(inicialesPublicas("María Rodríguez Vargas", true)).toBe("M.R.");
  });

  it("NO devuelve el nombre ni parte de él", () => {
    const salida = inicialesPublicas("María Rodríguez Vargas", true) ?? "";
    expect(salida).not.toContain("María");
    expect(salida).not.toContain("Rodríguez");
    expect(salida.replaceAll(".", "")).toHaveLength(2);
  });

  it("si el dueño lo apagó, no sale nada", () => {
    expect(inicialesPublicas("María Rodríguez", false)).toBeNull();
  });

  it("sin nombre no inventa iniciales", () => {
    expect(inicialesPublicas(null, true)).toBeNull();
    expect(inicialesPublicas("   ", true)).toBeNull();
  });
});

describe("serializarSaldo — la respuesta más delicada de la API", () => {
  const salida = serializarSaldo({
    ref: "mb_7Q2KX9FJ4M8NBVDA",
    nombre: "María Rodríguez Vargas",
    mostrarIniciales: true,
    meta: 10,
    saldo: 7,
    requestId: "3d90aaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });

  it("no filtra ni un campo personal", () => {
    expect(camposProhibidos(salida)).toEqual([]);
  });

  it("no contiene el nombre completo en ninguna parte del JSON", () => {
    const json = JSON.stringify(salida);
    expect(json).not.toContain("María");
    expect(json).not.toContain("Rodríguez");
    expect(json).not.toContain("Vargas");
  });

  it("devuelve el seudónimo, nunca el miembro_id", () => {
    expect(salida.ref).toBe("mb_7Q2KX9FJ4M8NBVDA");
    expect(JSON.stringify(salida)).not.toContain("miembro");
  });

  it("calcula lo que falta y si el premio está listo", () => {
    expect(salida.saldo).toBe(7);
    expect(salida.faltan).toBe(3);
    expect(salida.premio_listo).toBe(false);
  });

  it("con la meta alcanzada, avisa", () => {
    const lleno = serializarSaldo({
      ref: "mb_7Q2KX9FJ4M8NBVDA",
      nombre: null,
      mostrarIniciales: false,
      meta: 10,
      saldo: 12,
      requestId: "r",
    });
    expect(lleno.premio_listo).toBe(true);
    expect(lleno.faltan).toBe(0);
    expect(lleno.iniciales).toBeNull();
  });

  it("sin meta (programa sin recompensas) no inventa un `faltan`", () => {
    const sinMeta = serializarSaldo({
      ref: "mb_7Q2KX9FJ4M8NBVDA",
      nombre: null,
      mostrarIniciales: true,
      meta: null,
      saldo: 4,
      requestId: "r",
    });
    expect(sinMeta.faltan).toBeNull();
    expect(sinMeta.premio_listo).toBe(false);
  });

  /**
   * LA LISTA DE LO QUE NO PUEDE VOLVER SIN VOLVER A PREGUNTAR.
   *
   * Cada uno de estos campos existió y se quitó por su propio motivo:
   *
   * · `estado` de la membresía era un ORÁCULO — con una base de `ref`
   *   robada al integrador se leía quién se dio de baja del programa.
   * · `sellado_hoy` era el único campo derivado del LIBRO MAYOR de una
   *   persona, y no está en lo que el dueño leyó al autorizar.
   * · `programa` y `recompensas_alcanzables` viajaban acá sin pedir el
   *   scope `catalogo` que los protegía en sus propios endpoints; hoy
   *   ni los endpoints ni el scope existen.
   * · la antigüedad y el historial nunca existieron y no van a existir.
   *
   * Volver a agregar cualquiera de ellos cambia lo que el dueño
   * consintió, así que este test falla a propósito: primero se cambia
   * el texto del scope Y se vuelve a pedir autorización.
   */
  it("no devuelve NINGUNO de los campos que se quitaron a propósito", () => {
    const claves = Object.keys(salida);
    for (const fuera of [
      "estado",
      "sellado_hoy",
      "programa",
      "reglas",
      "recompensas",
      "recompensas_alcanzables",
      "antiguedad",
      "creado_en",
      "fecha_alta",
      "ultima_visita",
      "historial",
    ]) {
      expect(claves).not.toContain(fuera);
    }
  });

  it("no devuelve ninguna fecha ni hora: un timestamp con un ref estable es un perfil", () => {
    expect(JSON.stringify(salida)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe("serializarAcreditacion — cero datos personales, ni uno", () => {
  const salida = serializarAcreditacion({
    id: "99999999-8888-7777-6666-555555555555",
    otorgado: true,
    duplicada: false,
    puntosOtorgados: 1,
    saldoAnterior: 7,
    saldoPosterior: 8,
    meta: 10,
    motivo: "Acumulación (API: Fulano POS)",
    creadoEn: "2026-08-17T20:31:00.000Z",
    requestId: "r",
  });

  it("no filtra ni un campo personal", () => {
    expect(camposProhibidos(salida)).toEqual([]);
  });

  it("ni siquiera devuelve el `ref` de vuelta", () => {
    // El POS ya lo tiene; no repetirlo es un lugar menos donde queda
    // escrito en los logs del integrador.
    expect("ref" in salida).toBe(false);
  });

  it("dice el saldo de antes y el de después, que es la pista de auditoría", () => {
    expect(salida.saldo_anterior).toBe(7);
    expect(salida.saldo_posterior).toBe(8);
    expect(salida.faltan).toBe(2);
    expect(salida.alcanzo_meta).toBe(false);
  });

  it("avisa cuando el cliente llegó a la meta", () => {
    const meta = serializarAcreditacion({
      id: "99999999-8888-7777-6666-555555555555",
      otorgado: true,
      duplicada: false,
      puntosOtorgados: 1,
      saldoAnterior: 9,
      saldoPosterior: 10,
      meta: 10,
      motivo: "Acumulación",
      creadoEn: "2026-08-17T20:31:00.000Z",
      requestId: "r",
    });
    expect(meta.alcanzo_meta).toBe(true);
    expect(meta.faltan).toBe(0);
  });
});

describe("serializarYo", () => {
  it("habla solo de la propia credencial, de nadie más", () => {
    const salida = serializarYo({
      desarrollador: "Fulano POS",
      entorno: "live",
      scopes: ["saldo", "acreditar"],
      negocio: "Barbería Silence",
      programa: "Club Silence",
      expiraEn: "2027-08-17T00:00:00.000Z",
      requestId: "r",
    });
    expect(camposProhibidos(salida)).toEqual([]);
    expect(salida.scopes).toEqual(["saldo", "acreditar"]);
  });
});

describe("idPublico", () => {
  it("prefija y saca los guiones, para que se lea de un log", () => {
    expect(idPublico("mv", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBe(
      "mv_aaaaaaaabbbbccccddddeeeeeeeeeeee",
    );
  });
});
