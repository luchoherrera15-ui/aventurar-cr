import { describe, expect, it } from "vitest";
import {
  elegirDeFilasCrudas,
  elegirPrograma,
  emisoraDeFilasCrudas,
  programaQueEmite,
  resumenDeFila,
  type FilaElegible,
} from "./programa-principal";

/**
 * CUÁL TARJETA GANA CUANDO EL NEGOCIO TIENE DOS.
 *
 * El bug que esto congela: `/tarjeta/[slug]` —la página a la que lleva
 * el QR IMPRESO del mostrador— leía el programa con `.maybeSingle()`.
 * Eso funcionaba mientras la base garantizaba una tarjeta por negocio;
 * desde que la 0134 quitó el `unique(rancho_id)`, con dos tarjetas
 * `maybeSingle` devuelve error y `data` en null, la página responde «no
 * encontrado» y el QR pegado en la caja deja de servir. Le pasaba al
 * negocio MÁS avanzado, el que se animó a armar una segunda tarjeta.
 *
 * Y lo segundo, que sería peor que el bug: que cada pantalla eligiera
 * por su cuenta. El dueño configuraría una tarjeta y el cliente
 * recibiría la otra, sin un solo error a la vista. Por eso el panel, la
 * página pública y los dos generadores de pases preguntan acá.
 */

const AHORA = "2026-08-13T14:30";

function tarjeta(id: string, extra: Partial<FilaElegible> = {}): FilaElegible {
  return { id, estado: "activo", activo: true, ...extra };
}

const ARCHIVADA = { estado: "archivado", activo: false } as const;
const PAUSADA = { estado: "pausado", activo: false } as const;
const BORRADOR = { estado: "borrador", activo: false } as const;

describe("elegirPrograma", () => {
  it("sin tarjetas, no hay ninguna", () => {
    expect(elegirPrograma([], AHORA)).toBeNull();
  });

  it("con una sola, esa", () => {
    expect(elegirPrograma([tarjeta("a")], AHORA)?.id).toBe("a");
  });

  it("gana la que está emitiendo, aunque no sea la primera de la lista", () => {
    const filas = [tarjeta("b", BORRADOR), tarjeta("a", PAUSADA), tarjeta("c")];
    expect(elegirPrograma(filas, AHORA)?.id).toBe("c");
  });

  it("si ninguna emite, la primera viva — hay algo que mostrar y que arreglar", () => {
    const filas = [tarjeta("z", ARCHIVADA), tarjeta("m", PAUSADA)];
    expect(elegirPrograma(filas, AHORA)?.id).toBe("m");
  });

  it("si todas están archivadas, igual devuelve una", () => {
    const filas = [tarjeta("b", ARCHIVADA), tarjeta("a", ARCHIVADA)];
    expect(elegirPrograma(filas, AHORA)?.id).toBe("a");
  });

  it("una vencida no le gana a una vigente", () => {
    const filas = [tarjeta("a", { vigente_hasta: "2026-01-01" }), tarjeta("b")];
    expect(elegirPrograma(filas, AHORA)?.id).toBe("b");
  });

  it("una programada tampoco: todavía no empieza", () => {
    const filas = [tarjeta("a", { vigente_desde: "2026-12-01" }), tarjeta("b")];
    expect(elegirPrograma(filas, AHORA)?.id).toBe("b");
  });

  // ── Lo que hace que dos pantallas no se contradigan ───────────────
  it("con DOS emitiendo gana siempre la misma, venga como venga la consulta", () => {
    // Postgres no promete orden sin `order by`, y las cuatro pantallas
    // consultan con filtros distintos. Sin desempate estable, el panel
    // podría mostrar una y el pase entregar la otra.
    const filas = [tarjeta("bbb"), tarjeta("aaa"), tarjeta("ccc")];
    const alReves = [...filas].reverse();
    const revuelto = [filas[2], filas[0], filas[1]];

    expect(elegirPrograma(filas, AHORA)?.id).toBe("aaa");
    expect(elegirPrograma(alReves, AHORA)?.id).toBe("aaa");
    expect(elegirPrograma(revuelto, AHORA)?.id).toBe("aaa");
  });

  it("no toca la lista que le pasan", () => {
    const filas = [tarjeta("b"), tarjeta("a")];
    elegirPrograma(filas, AHORA);
    expect(filas.map((f) => f.id)).toEqual(["b", "a"]);
  });
});

describe("programaQueEmite: quién puede entregar un pase AHORA", () => {
  it("la que opera", () => {
    expect(programaQueEmite([tarjeta("a")], AHORA)?.id).toBe("a");
  });

  it("ninguna si todas están pausadas, en borrador o archivadas", () => {
    const casos = [PAUSADA, BORRADOR, ARCHIVADA];
    for (const estado of casos) {
      expect(programaQueEmite([tarjeta("a", estado)], AHORA)).toBeNull();
    }
  });

  it("ninguna si la única que hay está vencida o todavía no arranca", () => {
    expect(programaQueEmite([tarjeta("a", { vigente_hasta: "2026-01-01" })], AHORA)).toBeNull();
    expect(programaQueEmite([tarjeta("a", { vigente_desde: "2026-12-01" })], AHORA)).toBeNull();
  });

  it("es SIEMPRE la que el panel muestra como principal", () => {
    // Este es el contrato entero: si un día `programaQueEmite` buscara
    // por su cuenta, el dueño editaría una tarjeta y su cliente
    // recibiría otra.
    const escenas: FilaElegible[][] = [
      [tarjeta("b"), tarjeta("a")],
      [tarjeta("b", ARCHIVADA), tarjeta("a")],
      [tarjeta("b", PAUSADA), tarjeta("a")],
      [tarjeta("b"), tarjeta("a", { vigente_hasta: "2026-01-01" })],
    ];
    for (const escena of escenas) {
      const emite = programaQueEmite(escena, AHORA);
      if (emite) expect(emite.id).toBe(elegirPrograma(escena, AHORA)?.id);
    }
  });

  it("una base anterior a la 0125 (sin `estado`) emite igual si está activa", () => {
    expect(programaQueEmite([tarjeta("a", { estado: null })], AHORA)?.id).toBe("a");
    expect(programaQueEmite([tarjeta("a", { estado: null, activo: false })], AHORA)).toBeNull();
  });
});

describe("filas crudas, como las devuelve `select *`", () => {
  const cruda = (extra: Record<string, unknown>) => ({
    id: "aaa",
    rancho_id: "r-1",
    nombre: "Tarjeta",
    estado: "activo",
    activo: true,
    pase_color_fondo: "#0a1226",
    ...extra,
  });

  it("devuelve LA FILA entera, no un resumen: quien llama necesita los colores", () => {
    const fila = cruda({});
    expect(emisoraDeFilasCrudas([fila], AHORA)).toBe(fila);
    expect(elegirDeFilasCrudas([fila], AHORA)).toBe(fila);
  });

  it("dos tarjetas ya no son un error: se elige y se sigue", () => {
    // El `maybeSingle` de antes devolvía null acá, y el QR impreso
    // respondía «no encontrado».
    const filas = [cruda({ id: "bbb" }), cruda({ id: "aaa" })];
    expect(emisoraDeFilasCrudas(filas, AHORA)?.id).toBe("aaa");
  });

  it("con la tarjeta pausada, la página pública no existe (y no debe existir)", () => {
    expect(emisoraDeFilasCrudas([cruda({ estado: "pausado", activo: false })], AHORA)).toBeNull();
  });

  it("sin ninguna fila, null y no una explosión", () => {
    expect(emisoraDeFilasCrudas([], AHORA)).toBeNull();
    expect(elegirDeFilasCrudas([], AHORA)).toBeNull();
  });

  it("lo que no es texto no se cuela como estado ni como vigencia", () => {
    // Un jsonb mal guardado no puede convertir una tarjeta archivada en
    // una que emite.
    const r = resumenDeFila({ id: 42, estado: {}, activo: "sí", vigente_hasta: 7 });
    expect(r).toEqual({
      id: "",
      estado: null,
      activo: false,
      vigente_desde: null,
      vigente_hasta: null,
    });
  });
});
