import { describe, expect, it } from "vitest";
import {
  agruparDevengo,
  esFuncionDevengoInexistente,
  ESTADOS_QUE_DEVENGAN,
  evaluarDevengo,
  montoDevengado,
  personasCobrables,
  resolverTarifa,
  semanaDelEvento,
  ventanaValida,
  VENTANA_BARRIDO_MAX,
  type FilaDevengada,
  type ReservaDevengable,
  type TarifaAplicada,
} from "@/lib/cobro-dia-evento";

/**
 * Las reglas del cobro que se devenga el día del evento.
 *
 * Es plata: cada caso raro de acá abajo corresponde a una decisión
 * tomada a conciencia, y el test existe para que nadie la cambie sin
 * darse cuenta. Lo que se prueba es el ESPEJO en TypeScript de
 * `devengar_cobros_del_dia` (migración 0171) — la base es la que manda,
 * pero las dos tienen que decir lo mismo.
 */

const CR = "America/Costa_Rica";

/** Una reserva confirmada, de 40 invitados, ₡1.000.000, en CR. */
function reserva(cambios: Partial<ReservaDevengable> = {}): ReservaDevengable {
  return {
    id: "r1",
    fecha: "2026-08-17",
    estado: "confirmada",
    invitados: 40,
    monto_total: 1_000_000,
    monto_cobrado_final: null,
    rancho_id: "n1",
    nombre: "Boda Ramírez",
    zona_horaria: CR,
    ...cambios,
  };
}

const POR_PERSONA: TarifaAplicada = {
  modelo: "comision_por_persona",
  valor: 150,
  esGlobal: false,
};

/** Un instante concreto: 17 de agosto de 2026, 11:30 p. m. en CR. */
const ONCE_Y_MEDIA_CR = new Date("2026-08-18T05:30:00Z");

describe("personasCobrables", () => {
  it("una reserva sin invitados es UNA persona, no cero", () => {
    expect(personasCobrables(null)).toBe(1);
    expect(personasCobrables(undefined)).toBe(1);
    expect(personasCobrables(0)).toBe(1);
  });

  it("no se deja envenenar por basura ni por negativos", () => {
    expect(personasCobrables(Number.NaN)).toBe(1);
    expect(personasCobrables(-5)).toBe(1);
    expect(personasCobrables(40.7)).toBe(40);
  });
});

describe("montoDevengado — la cuenta de cada modelo", () => {
  it("por persona: personas × tarifa", () => {
    expect(montoDevengado(reserva(), POR_PERSONA)).toBe(6_000);
  });

  it("por persona con cero invitados cobra igual, por una persona", () => {
    expect(montoDevengado(reserva({ invitados: 0 }), POR_PERSONA)).toBe(150);
  });

  it("fija por reserva: la tarifa, sin importar cuánta gente", () => {
    const tarifa: TarifaAplicada = {
      modelo: "comision_fija_reserva",
      valor: 5_000,
      esGlobal: false,
    };
    expect(montoDevengado(reserva({ invitados: 300 }), tarifa)).toBe(5_000);
  });

  it("porcentaje: sale del total del evento y se redondea", () => {
    const tarifa: TarifaAplicada = {
      modelo: "comision_porcentaje",
      valor: 7.5,
      esGlobal: false,
    };
    expect(montoDevengado(reserva({ monto_total: 333_333 }), tarifa)).toBe(25_000);
  });

  it("porcentaje: manda lo COBRADO de verdad sobre la cotización", () => {
    // Esta es la diferencia real de mover el devengo al día del evento:
    // al confirmar, monto_cobrado_final siempre era null y la comisión
    // salía de monto_total. Ahora, si el negocio ya registró que cobró
    // más (invitados de más, horas extra), la comisión sale de ahí.
    const tarifa: TarifaAplicada = {
      modelo: "comision_porcentaje",
      valor: 10,
      esGlobal: false,
    };
    const r = reserva({ monto_total: 1_000_000, monto_cobrado_final: 1_400_000 });
    expect(montoDevengado(r, tarifa)).toBe(140_000);
  });

  it("membresía y gratis no dejan cobro por reserva", () => {
    for (const modelo of ["membresia_mensual", "gratis"]) {
      expect(montoDevengado(reserva(), { modelo, valor: 99_999, esGlobal: false })).toBe(0);
    }
  });

  it("un modelo desconocido no inventa plata", () => {
    expect(montoDevengado(reserva(), { modelo: "lo_que_sea", valor: 500, esGlobal: false })).toBe(0);
  });

  it("una reserva sin monto no aporta nada en el modelo de porcentaje", () => {
    const tarifa: TarifaAplicada = {
      modelo: "comision_porcentaje",
      valor: 10,
      esGlobal: false,
    };
    const r = reserva({ monto_total: null, monto_cobrado_final: null });
    expect(montoDevengado(r, tarifa)).toBe(0);
  });
});

describe("resolverTarifa", () => {
  it("manda la tarifa propia del negocio si la tiene", () => {
    const mapa = new Map([["n1", { modelo: "comision_porcentaje", valor: 8 }]]);
    expect(resolverTarifa("n1", mapa, 150)).toEqual({
      modelo: "comision_porcentaje",
      valor: 8,
      esGlobal: false,
    });
  });

  it("sin fila propia aplica el default global, por persona", () => {
    expect(resolverTarifa("n9", new Map(), 150)).toEqual({
      modelo: "comision_por_persona",
      valor: 150,
      esGlobal: true,
    });
  });
});

describe("semanaDelEvento — el corte es lunes", () => {
  it("un domingo cae en la semana que arrancó el lunes anterior", () => {
    // 2026-08-16 es domingo.
    expect(semanaDelEvento("2026-08-16")).toBe("2026-08-10");
  });

  it("un lunes es su propio inicio de semana", () => {
    expect(semanaDelEvento("2026-08-17")).toBe("2026-08-17");
  });

  it("la semana sale del EVENTO, no del día en que corre el barrido", () => {
    // El barrido de hoy recoge un evento de la semana pasada que quedó
    // sin cobrar: el asiento tiene que caer en LA SEMANA DEL EVENTO.
    expect(semanaDelEvento("2026-08-11")).toBe("2026-08-10");
    expect(semanaDelEvento("2026-08-18")).toBe("2026-08-17");
  });
});

describe("evaluarDevengo — a quién le toca cobro hoy", () => {
  it("el evento de HOY, confirmado, devenga", () => {
    const v = evaluarDevengo(reserva(), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v.devenga).toBe(true);
    if (!v.devenga) return;
    expect(v.monto).toBe(6_000);
    expect(v.personas).toBe(40);
    expect(v.semana).toBe("2026-08-17");
    expect(v.hoyAlla).toBe("2026-08-17");
  });

  it("un evento FUTURO no devenga nada todavía", () => {
    const v = evaluarDevengo(reserva({ fecha: "2026-12-31" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "evento_futuro" });
  });

  it("el evento de mañana tampoco: un día antes es cobrar de más", () => {
    const v = evaluarDevengo(reserva({ fecha: "2026-08-18" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "evento_futuro" });
  });

  it("una reserva que ya tiene su asiento no se vuelve a cobrar", () => {
    const v = evaluarDevengo(reserva({ yaDevengada: true }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "ya_devengada" });
  });

  it("sin negocio no hay a quién cobrarle", () => {
    const v = evaluarDevengo(reserva({ rancho_id: null }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "sin_negocio" });
  });

  it("la tarifa de membresía o gratis no devenga por reserva", () => {
    const v = evaluarDevengo(
      reserva(),
      { modelo: "membresia_mensual", valor: 30_000, esGlobal: false },
      ONCE_Y_MEDIA_CR,
    );
    expect(v).toMatchObject({ devenga: false, motivo: "modelo_sin_cobro" });
  });

  it("una cuenta que da ₡0 no anota un asiento vacío", () => {
    const v = evaluarDevengo(reserva(), { ...POR_PERSONA, valor: 0 }, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "monto_cero" });
  });
});

describe("evaluarDevengo — la zona horaria del negocio", () => {
  /**
   * EL BUG DE PLATA QUE ESTO EVITA: Vercel corre en UTC, seis horas
   * adelantado a Costa Rica. A las 11:30 p. m. del 17 en CR, el
   * servidor ya cree que es 18. Si "hoy" saliera de UTC, un evento del
   * 18 se cobraría la noche del 17 — un día ANTES de prestarse el
   * servicio.
   */
  it("a las 11:30 p. m. de CR, el evento de mañana NO se cobra (aunque en UTC ya sea mañana)", () => {
    expect(ONCE_Y_MEDIA_CR.toISOString().slice(0, 10)).toBe("2026-08-18");
    const v = evaluarDevengo(
      reserva({ fecha: "2026-08-18", zona_horaria: CR }),
      POR_PERSONA,
      ONCE_Y_MEDIA_CR,
    );
    expect(v.hoyAlla).toBe("2026-08-17");
    expect(v.devenga).toBe(false);
  });

  it("cada negocio cambia de día cuando le toca a ÉL, no cuando le toca a Costa Rica", () => {
    // Mismo instante, tres negocios. En Tijuana (UTC-7) todavía es 17;
    // en Madrid (UTC+2) ya son las 7:30 a. m. del 18.
    const enTijuana = evaluarDevengo(
      reserva({ fecha: "2026-08-17", zona_horaria: "America/Tijuana" }),
      POR_PERSONA,
      ONCE_Y_MEDIA_CR,
    );
    const enMadrid = evaluarDevengo(
      reserva({ fecha: "2026-08-18", zona_horaria: "Europe/Madrid" }),
      POR_PERSONA,
      ONCE_Y_MEDIA_CR,
    );
    expect(enTijuana.hoyAlla).toBe("2026-08-17");
    expect(enTijuana.devenga).toBe(true);
    expect(enMadrid.hoyAlla).toBe("2026-08-18");
    expect(enMadrid.devenga).toBe(true);
  });

  it("una zona guardada inválida no tumba el barrido: se cae a Costa Rica", () => {
    const v = evaluarDevengo(
      reserva({ zona_horaria: "Mordor/Barad-dur" }),
      POR_PERSONA,
      ONCE_Y_MEDIA_CR,
    );
    expect(v.hoyAlla).toBe("2026-08-17");
    expect(v.devenga).toBe(true);
  });

  it("sin zona guardada también se asume Costa Rica", () => {
    const v = evaluarDevengo(reserva({ zona_horaria: null }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v.hoyAlla).toBe("2026-08-17");
  });
});

describe("evaluarDevengo — los estados raros", () => {
  it("una reserva PENDIENTE cuyo día llegó no se cobra", () => {
    // Preserva lo que pasaba antes: el cobro nacía al confirmar, así
    // que una reserva que nunca se confirmó nunca devengó nada.
    const v = evaluarDevengo(reserva({ estado: "pendiente" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "estado_no_devenga" });
  });

  it("una CANCELADA no paga la comisión completa", () => {
    // La comisión completa no; el 10 % del depósito retenido SÍ, y eso
    // lo sigue anotando el trigger de la 0106/0171 al cancelarse, no
    // este barrido.
    const v = evaluarDevengo(reserva({ estado: "cancelada" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "estado_no_devenga" });
  });

  it("una RECHAZADA tampoco", () => {
    const v = evaluarDevengo(reserva({ estado: "rechazada" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "estado_no_devenga" });
  });

  it("un día BLOQUEADO a mano no es un cliente y no devenga", () => {
    const v = evaluarDevengo(reserva({ estado: "bloqueada" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "estado_no_devenga" });
  });

  it("un apartado TEMPORAL no devenga", () => {
    const v = evaluarDevengo(reserva({ estado: "temporal" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v).toMatchObject({ devenga: false, motivo: "estado_no_devenga" });
  });

  it("una cita CUMPLIDA sí devenga — si no, las citas dejarían de pagar", () => {
    // Las citas pasan de 'confirmada' a 'cumplida' el mismo día del
    // evento. Si el barrido solo mirara 'confirmada', una cita marcada
    // a las 10 a. m. no calificaría a las 11:30 p. m. y no pagaría
    // comisión nunca — plata que HOY sí se cobra.
    const v = evaluarDevengo(reserva({ estado: "cumplida" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v.devenga).toBe(true);
  });

  it("un NO_ASISTIO devenga igual, como devengaba antes", () => {
    const v = evaluarDevengo(reserva({ estado: "no_asistio" }), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v.devenga).toBe(true);
  });

  it("el depósito sin validar NO cambia nada: la comisión no depende de eso", () => {
    // El cobro de plataforma nunca miró `deposito_validado` — ese es un
    // asunto entre el negocio y su cliente. Ni siquiera está en el tipo,
    // y este test lo deja escrito: la comisión sale igual.
    const v = evaluarDevengo(reserva(), POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(v.devenga).toBe(true);
    if (v.devenga) expect(v.monto).toBe(6_000);
  });
});

describe("evaluarDevengo — la ventana del barrido", () => {
  it("una reserva creada y confirmada el mismo día, tarde, entra en el barrido siguiente", () => {
    // Se creó y confirmó el 17 después de las 11:30 p. m. El barrido de
    // esa noche ya había pasado. Al día siguiente su fecha es "ayer" y
    // la ventana la recoge: se cobra con un día de atraso, no se pierde.
    const alDiaSiguiente = new Date("2026-08-19T05:30:00Z"); // 18 a las 11:30 p. m. CR
    const v = evaluarDevengo(reserva({ fecha: "2026-08-17" }), POR_PERSONA, alDiaSiguiente);
    expect(v.devenga).toBe(true);
    if (v.devenga) expect(v.semana).toBe("2026-08-17");
  });

  it("con ventana de 7, entran hoy y los seis días anteriores", () => {
    const dentro = evaluarDevengo(
      reserva({ fecha: "2026-08-11" }),
      POR_PERSONA,
      ONCE_Y_MEDIA_CR,
      7,
    );
    expect(dentro.devenga).toBe(true);
  });

  it("una reserva VIEJA que quedó sin cobrar queda fuera: no se factura el histórico solo", () => {
    const vieja = evaluarDevengo(
      reserva({ fecha: "2026-08-10" }),
      POR_PERSONA,
      ONCE_Y_MEDIA_CR,
      7,
    );
    expect(vieja).toMatchObject({ devenga: false, motivo: "fuera_de_ventana" });

    const muyVieja = evaluarDevengo(
      reserva({ fecha: "2025-03-04" }),
      POR_PERSONA,
      ONCE_Y_MEDIA_CR,
      7,
    );
    expect(muyVieja).toMatchObject({ devenga: false, motivo: "fuera_de_ventana" });
  });

  it("ampliar la ventana a mano sí la recoge (es una decisión, no un accidente)", () => {
    const v = evaluarDevengo(reserva({ fecha: "2026-08-10" }), POR_PERSONA, ONCE_Y_MEDIA_CR, 30);
    expect(v.devenga).toBe(true);
    if (v.devenga) expect(v.semana).toBe("2026-08-10");
  });

  it("ventana 0 no devenga nada — ni siquiera lo de hoy", () => {
    const v = evaluarDevengo(reserva(), POR_PERSONA, ONCE_Y_MEDIA_CR, 0);
    expect(v).toMatchObject({ devenga: false, motivo: "fuera_de_ventana" });
  });
});

describe("ventanaValida — el tope que evita facturar un año de golpe", () => {
  it("recorta cualquier número gigante al tope", () => {
    expect(ventanaValida(100_000)).toBe(VENTANA_BARRIDO_MAX);
    expect(ventanaValida("9999")).toBe(VENTANA_BARRIDO_MAX);
  });

  it("los negativos se aplanan a 0 (no devenga nada, no rompe)", () => {
    expect(ventanaValida(-5)).toBe(0);
  });

  it("la basura cae en el default de 7", () => {
    expect(ventanaValida("hola")).toBe(7);
  });

  it("lo AUSENTE cae en 7, no en 0 — un 0 silencioso sería un cron que no cobra", () => {
    expect(ventanaValida(null)).toBe(7);
    expect(ventanaValida(undefined)).toBe(7);
    expect(ventanaValida("")).toBe(7);
  });

  it("pero un 0 explícito sí vale 0 (para probar sin escribir nada)", () => {
    expect(ventanaValida(0)).toBe(0);
    expect(ventanaValida("0")).toBe(0);
  });

  it("un número normal pasa tal cual", () => {
    expect(ventanaValida("14")).toBe(14);
  });
});

describe("idempotencia", () => {
  /**
   * LA GARANTÍA DE VERDAD ESTÁ EN LA BASE: el índice único
   * (reserva_id, concepto) + `on conflict do nothing` de la 0171. Es
   * una sola sentencia, así que dos barridos simultáneos no pueden
   * cobrar dos veces ni aunque arranquen en el mismo milisegundo: el
   * segundo espera en el índice y después ve el conflicto.
   *
   * Lo que se prueba acá es que el espejo en TypeScript diga lo mismo:
   * en cuanto la reserva tiene su asiento, deja de ser candidata. Si
   * este test se cayera, la simulación estaría prometiendo cobros que
   * la base no va a hacer (o al revés).
   */
  it("dos corridas seguidas: la segunda no devenga nada", () => {
    const r = reserva();

    const primera = evaluarDevengo(r, POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(primera.devenga).toBe(true);

    // Lo que hace la base al insertar: la reserva ya tiene su asiento.
    const segunda = evaluarDevengo({ ...r, yaDevengada: true }, POR_PERSONA, ONCE_Y_MEDIA_CR);
    expect(segunda).toMatchObject({ devenga: false, motivo: "ya_devengada" });
  });

  it("re-confirmar una reserva el mismo día no la vuelve a cobrar", () => {
    const r = reserva({ estado: "pendiente" });
    expect(evaluarDevengo(r, POR_PERSONA, ONCE_Y_MEDIA_CR).devenga).toBe(false);

    const confirmada = { ...r, estado: "confirmada" };
    expect(evaluarDevengo(confirmada, POR_PERSONA, ONCE_Y_MEDIA_CR).devenga).toBe(true);

    // Se confirma, se anota, se vuelve a pendiente y se re-confirma.
    const reconfirmada = { ...confirmada, yaDevengada: true };
    expect(evaluarDevengo(reconfirmada, POR_PERSONA, ONCE_Y_MEDIA_CR)).toMatchObject({
      devenga: false,
      motivo: "ya_devengada",
    });
  });

  it("el barrido de mañana no vuelve a cobrar el evento de hoy", () => {
    const r = reserva({ yaDevengada: true });
    const manana = new Date("2026-08-19T05:30:00Z");
    expect(evaluarDevengo(r, POR_PERSONA, manana)).toMatchObject({
      devenga: false,
      motivo: "ya_devengada",
    });
  });
});

describe("agruparDevengo — lo que dice el correo", () => {
  function fila(cambios: Partial<FilaDevengada> = {}): FilaDevengada {
    return {
      cobro_id: "c1",
      reserva: "r1",
      negocio_id: "n1",
      negocio: "Rancho Los Cocos",
      cliente: "Boda Ramírez",
      fecha_evento: "2026-08-17",
      personas: 40,
      tarifa: 150,
      modelo: "comision_por_persona",
      monto: 6_000,
      semana: "2026-08-17",
      ...cambios,
    };
  }

  it("suma el total, cuenta las reservas y ordena por plata", () => {
    const resumen = agruparDevengo([
      fila(),
      fila({ cobro_id: "c2", monto: 3_000 }),
      fila({ cobro_id: "c3", negocio_id: "n2", negocio: "Salón Aurora", monto: 20_000 }),
    ]);

    expect(resumen.total).toBe(29_000);
    expect(resumen.reservas).toBe(3);
    expect(resumen.negocios.map((n) => n.negocio)).toEqual([
      "Salón Aurora",
      "Rancho Los Cocos",
    ]);
    expect(resumen.negocios[1].reservas).toBe(2);
    expect(resumen.negocios[1].total).toBe(9_000);
  });

  it("un negocio dado de baja no se pierde del total", () => {
    const resumen = agruparDevengo([fila({ negocio_id: null, negocio: null, monto: 500 })]);
    expect(resumen.total).toBe(500);
    expect(resumen.negocios[0].negocio).toBe("Negocio dado de baja");
  });

  it("una corrida sin nada devengado da todo en cero (y no manda correo)", () => {
    const resumen = agruparDevengo([]);
    expect(resumen).toEqual({ total: 0, reservas: 0, negocios: [], semanas: [] });
  });

  it("junta las semanas de corte que tocó, ordenadas", () => {
    const resumen = agruparDevengo([
      fila({ semana: "2026-08-17" }),
      fila({ cobro_id: "c2", semana: "2026-08-10" }),
      fila({ cobro_id: "c3", semana: "2026-08-17" }),
    ]);
    expect(resumen.semanas).toEqual(["2026-08-10", "2026-08-17"]);
  });
});

describe("esFuncionDevengoInexistente", () => {
  it("reconoce el 42883 de Postgres y el PGRST202 de PostgREST", () => {
    expect(esFuncionDevengoInexistente({ code: "42883" })).toBe(true);
    expect(esFuncionDevengoInexistente({ code: "PGRST202" })).toBe(true);
  });

  it("reconoce el mensaje aunque no venga el código", () => {
    expect(
      esFuncionDevengoInexistente({
        message: "Could not find the function public.devengar_cobros_del_dia",
      }),
    ).toBe(true);
  });

  it("no confunde un error cualquiera con la migración sin pegar", () => {
    expect(esFuncionDevengoInexistente({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(esFuncionDevengoInexistente({})).toBe(false);
  });
});

describe("ESTADOS_QUE_DEVENGAN", () => {
  it("son exactamente tres, y ninguno es 'pendiente'", () => {
    // Si alguien agrega 'pendiente' acá, empiezan a cobrarse reservas
    // que nunca se confirmaron. Que el test lo diga en voz alta.
    expect([...ESTADOS_QUE_DEVENGAN]).toEqual(["confirmada", "cumplida", "no_asistio"]);
  });
});
