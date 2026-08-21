import { describe, expect, it } from "vitest";
import {
  elegirDeFilasCrudas,
  elegirPrograma,
  emisoraDeFilasCrudas,
  filasCrudasPorAntiguedad,
  laDelLinkDelNegocio,
  programaQueEmite,
  resumenDeFila,
  tarjetaDelPase,
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
      // Una fecha de creación que no sea texto tampoco: sin ella el
      // desempate cae al id, que es lo que había antes de la columna.
      created_at: null,
    });
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL QR IMPRESO NO PUEDE CAMBIAR DE DESTINO
 * ═══════════════════════════════════════════════════════════════════
 *
 * Esto es lo que reportó el dueño: «al crear otra tarjeta me parece que
 * el link de la primera desaparece, y no puede ser así ya que la
 * primera estaba asociada al QR que el cliente ya tiene expuesto».
 *
 * El desempate por uuid lo permitía: el id de la tarjeta NUEVA puede
 * ordenar antes que el de la vieja, y entonces `/tarjeta/<negocio>`
 * —que está impreso y pegado en la pared de un local— empezaba a servir
 * la tarjeta recién creada.
 */
describe("la tarjeta del link viejo del negocio", () => {
  const conFecha = (id: string, created_at: string, extra: Partial<FilaElegible> = {}) =>
    ({ id, estado: "activo", activo: true, created_at, ...extra }) as FilaElegible;

  it("es la MÁS VIEJA, aunque el uuid de la nueva ordene antes", () => {
    // El caso exacto del reporte: la segunda tarjeta tiene un uuid que
    // empieza con "a" y la original con "z". Con el desempate viejo
    // ganaba la nueva.
    const original = conFecha("zzz", "2026-05-01T10:00:00Z");
    const nueva = conFecha("aaa", "2026-08-19T10:00:00Z");
    expect(laDelLinkDelNegocio([nueva, original])?.id).toBe("zzz");
    expect(laDelLinkDelNegocio([original, nueva])?.id).toBe("zzz");
  });

  it("no se mueve por crear una tercera, ni una cuarta", () => {
    const original = conFecha("zzz", "2026-05-01T10:00:00Z");
    const filas = [original];
    for (const [id, fecha] of [
      ["aaa", "2026-08-19T10:00:00Z"],
      ["bbb", "2026-09-01T10:00:00Z"],
      ["000", "2026-10-01T10:00:00Z"],
    ] as const) {
      filas.push(conFecha(id, fecha));
      expect(laDelLinkDelNegocio(filas)?.id).toBe("zzz");
    }
  });

  it("sigue siendo la original AUNQUE esté pausada — no salta a la hermana", () => {
    // Esta es la diferencia con `elegirPrograma`: si la tarjeta del
    // póster está en pausa, la respuesta honesta es «está en pausa» (la
    // página la muestra con su aviso), no entregarle al cliente otra
    // tarjeta que él nunca pidió.
    const original = conFecha("zzz", "2026-05-01T10:00:00Z", PAUSADA);
    const nueva = conFecha("aaa", "2026-08-19T10:00:00Z");
    expect(laDelLinkDelNegocio([nueva, original])?.id).toBe("zzz");
  });

  it("sin tarjetas, null", () => {
    expect(laDelLinkDelNegocio([])).toBeNull();
  });

  it("una fila SIN fecha no le gana el primer puesto a una que sí la tiene", () => {
    // «No sé de cuándo es» no puede ser «entonces es la más vieja»: el
    // primer puesto es el que sirve el link impreso.
    const sinFecha = tarjeta("aaa");
    const conocida = conFecha("zzz", "2026-05-01T10:00:00Z");
    expect(laDelLinkDelNegocio([sinFecha, conocida])?.id).toBe("zzz");
  });
});

describe("elegirPrograma con fechas: la principal también prefiere la vieja", () => {
  it("entre dos emitiendo, gana la más vieja y no la del uuid menor", () => {
    const filas: FilaElegible[] = [
      { id: "aaa", estado: "activo", activo: true, created_at: "2026-08-19T10:00:00Z" },
      { id: "zzz", estado: "activo", activo: true, created_at: "2026-05-01T10:00:00Z" },
    ];
    expect(elegirPrograma(filas, AHORA)?.id).toBe("zzz");
  });

  it("pero si la vieja no emite, la principal sí pasa a la que emite", () => {
    // El panel tiene que mostrar como principal la que de verdad le
    // está dando tarjetas a los clientes hoy.
    const filas: FilaElegible[] = [
      { id: "aaa", estado: "activo", activo: true, created_at: "2026-08-19T10:00:00Z" },
      { id: "zzz", ...PAUSADA, created_at: "2026-05-01T10:00:00Z" },
    ];
    expect(elegirPrograma(filas, AHORA)?.id).toBe("aaa");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EL PASE QUE SE ENTREGA ES EL DE LA TARJETA QUE SE PIDIÓ
 * ═══════════════════════════════════════════════════════════════════
 *
 * La decisión más cara del módulo: si se equivoca, el cliente ve una
 * tarjeta en pantalla y se lleva otra al teléfono, sin ningún error a
 * la vista. Y del lado del REFRESCO es peor: el pase que ya está
 * guardado se reescribe solo con datos de una tarjeta que esa persona
 * nunca pidió.
 */
describe("tarjetaDelPase: cuál se entrega", () => {
  const activa = (id: string, created_at: string) => ({
    id,
    nombre: id,
    estado: "activo",
    activo: true,
    created_at,
  });
  const VIEJA = activa("sellos", "2026-05-01T10:00:00Z");
  const NUEVA = activa("evento", "2026-08-19T10:00:00Z");

  it("sin pedir ninguna, la de siempre: la que emite (y entre dos, la vieja)", () => {
    const r = tarjetaDelPase([NUEVA, VIEJA], AHORA, null);
    expect(r.fila?.id).toBe("sellos");
    expect(r.pausado).toBe(false);
  });

  it("pidiendo una, ESA — aunque no sea la que se elegiría sola", () => {
    expect(tarjetaDelPase([NUEVA, VIEJA], AHORA, "evento").fila?.id).toBe("evento");
  });

  it("un id que no es de este negocio no entrega NADA", () => {
    // El id viaja por la URL. Sin esta comprobación, pedir el programa
    // de otro rancho habría emitido su tarjeta desde acá.
    const r = tarjetaDelPase([NUEVA, VIEJA], AHORA, "de-otro-negocio");
    expect(r.fila).toBeNull();
    expect(r.motivo).toBe("ajena");
  });

  it("la pedida PAUSADA se entrega marcada, no se cambia por la hermana", () => {
    // El refresco de Wallet entra por acá: si devolviera la hermana, el
    // aviso de pausa nunca llegaría y encima el pase guardado quedaría
    // reescrito con otra tarjeta.
    const pausada = { ...VIEJA, ...PAUSADA };
    const r = tarjetaDelPase([NUEVA, pausada], AHORA, "sellos");
    expect(r.fila?.id).toBe("sellos");
    expect(r.pausado).toBe(true);
  });

  it("la pedida ARCHIVADA no entrega nada — y tampoco entrega la hermana", () => {
    // Una archivada no vuelve sola, así que no hay pase que dar. Lo que
    // NO puede pasar es que se entregue la otra tarjeta del negocio:
    // eso es reescribirle el pase al cliente con algo ajeno.
    const r = tarjetaDelPase([NUEVA, { ...VIEJA, ...ARCHIVADA }], AHORA, "sellos");
    expect(r.fila).toBeNull();
    expect(r.motivo).toBe("sin_programa");
  });

  it("sin pedir nada y con la principal pausada, se entrega marcada (lo de siempre)", () => {
    const r = tarjetaDelPase([{ ...VIEJA, ...PAUSADA }], AHORA, null);
    expect(r.fila?.id).toBe("sellos");
    expect(r.pausado).toBe(true);
  });

  it("un negocio sin tarjetas no entrega nada", () => {
    const r = tarjetaDelPase([], AHORA, null);
    expect(r.fila).toBeNull();
    expect(r.motivo).toBe("sin_programa");
  });

  it("devuelve LA FILA entera: el generador necesita los colores", () => {
    expect(tarjetaDelPase([VIEJA], AHORA, "sellos").fila).toBe(VIEJA);
  });
});

describe("filasCrudasPorAntiguedad", () => {
  it("ordena de la más vieja a la más nueva sin tocar la lista original", () => {
    const filas = [
      { id: "b", created_at: "2026-08-19T10:00:00Z" },
      { id: "a", created_at: "2026-05-01T10:00:00Z" },
    ];
    expect(filasCrudasPorAntiguedad(filas).map((f) => f.id)).toEqual(["a", "b"]);
    expect(filas.map((f) => f.id)).toEqual(["b", "a"]);
  });

  it("devuelve LAS MISMAS filas, no copias: quien llama necesita los colores", () => {
    const fila = { id: "a", created_at: "2026-05-01T10:00:00Z", pase_color_fondo: "#000" };
    expect(filasCrudasPorAntiguedad([fila])[0]).toBe(fila);
  });
});
