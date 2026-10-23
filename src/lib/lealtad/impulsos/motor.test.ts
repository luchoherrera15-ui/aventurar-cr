import { beforeEach, describe, expect, it } from "vitest";
import { correrImpulsos, sigueVigente, type CanalesDeEnvio, type EntradaDeEnvio, type ResultadoDeEnvio } from "./motor";
import { RepoEnMemoria } from "./repo-memoria";
import type { ContextoCliente, EventoImpulso, Impulso, InfoPrograma } from "./tipos";

// ── el mundo de las pruebas ────────────────────────────────────────
// Miércoles 21 de octubre de 2026. Costa Rica = UTC−6.
const T0 = new Date("2026-10-21T16:00:00Z"); // 10:00 en Costa Rica
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

const RANCHO = "rancho-1";
const PROGRAMA = "prog-1";
const MIEMBRO = "miembro-1";

function info(extra: Partial<InfoPrograma> = {}): InfoPrograma {
  return {
    programaId: PROGRAMA,
    ranchoId: RANCHO,
    nombrePrograma: "Tarjeta de sellos",
    nombreNegocio: "Café del Parque",
    modo: "sellos",
    zona: "America/Costa_Rica",
    opera: true,
    esFoorkie: false,
    meta: 5,
    recompensa: "Café gratis",
    cuentaId: null,
    ...extra,
  };
}

function impulso(extra: Partial<Impulso> = {}): Impulso {
  return {
    id: "imp-1",
    rancho_id: RANCHO,
    programa_id: PROGRAMA,
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
    estado: "activo",
    plantilla: null,
    version: 3,
    activado_en: "2026-10-01T00:00:00Z",
    ultimo_escaneo_en: null,
    creado_por: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...extra,
  };
}

function evento(extra: Partial<EventoImpulso> = {}): EventoImpulso {
  return {
    id: "ev-1",
    rancho_id: RANCHO,
    programa_id: PROGRAMA,
    miembro_id: MIEMBRO,
    tipo: "inscripcion",
    clave: `miembro:${MIEMBRO}`,
    ocurrido_en: T0.toISOString(),
    datos: {},
    intentos: 0,
    ...extra,
  };
}

function contexto(extra: Partial<ContextoCliente> = {}): ContextoCliente {
  return {
    nombre: "María",
    nombreNegocio: "Café del Parque",
    nombrePrograma: "Tarjeta de sellos",
    modo: "sellos",
    saldo: 4,
    meta: 5,
    recompensa: "Café gratis",
    visitas: 4,
    canjes: 0,
    ultimaActividad: "2026-10-20",
    diasSinActividad: 1,
    antiguedadDias: 30,
    plataformas: ["google"],
    ...extra,
  };
}

type Llamada = { canal: "wallet" | "correo"; titulo: string; cuerpo: string; miembro: string; tarea: string };

function canalesFalsos(respuesta: (e: EntradaDeEnvio) => Promise<ResultadoDeEnvio> | ResultadoDeEnvio = () => ({ tipo: "enviado", detalle: "ok" })) {
  const llamadas: Llamada[] = [];
  const hacer = (canal: "wallet" | "correo") => async (e: EntradaDeEnvio) => {
    llamadas.push({ canal, titulo: e.titulo, cuerpo: e.cuerpo, miembro: e.tarea.miembro_id, tarea: e.tarea.id });
    return respuesta(e);
  };
  const canales: CanalesDeEnvio = { wallet: hacer("wallet"), correo: hacer("correo") };
  return { canales, llamadas };
}

let repo: RepoEnMemoria;
beforeEach(() => {
  repo = new RepoEnMemoria();
  repo.infos.set(PROGRAMA, info());
  repo.impulsos.set("imp-1", impulso());
  repo.clientes.set(MIEMBRO, { programaId: PROGRAMA, cargado: { miembroActivo: true, ctx: contexto() } });
  repo.eventos.push(evento());
});

const correr = (canales: CanalesDeEnvio, ahora: Date, extra = {}) => correrImpulsos(repo, canales, { ahora, ...extra });

describe("la bienvenida a los 5 minutos", () => {
  it("el hecho se vuelve una tarea para 5 minutos después", async () => {
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(1);
    expect(repo.tareas[0].estado).toBe("programada");
    expect(repo.tareas[0].ejecutar_en).toBe(min(5).toISOString());
    expect(repo.tareas[0].version_impulso).toBe(3);
  });

  it("antes de los 5 minutos NO sale; después, sí, una sola vez, con las variables puestas", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    await correr(canales, min(3));
    expect(llamadas).toHaveLength(0);

    await correr(canales, min(6));
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].canal).toBe("wallet");
    expect(llamadas[0].titulo).toBe("¡Bienvenido a Café del Parque!");
    expect(llamadas[0].cuerpo).toBe("Hola María, gracias por unirte.");

    // y una corrida más tarde no la repite
    await correr(canales, min(30));
    expect(llamadas).toHaveLength(1);
    const t = repo.tareas[0];
    expect(t.estado).toBe("enviada");
    expect(t.enviada_en).not.toBeNull();
    expect(t.mensaje_cuerpo).toBe("Hola María, gracias por unirte.");
  });
});

describe("sin duplicados", () => {
  it("el mismo hecho dos veces (trigger repetido o webhook repetido) es UNA sola tarea y UN solo mensaje", async () => {
    repo.eventos.push(evento({ id: "ev-2" })); // mismo hecho, otra fila
    const { canales, llamadas } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(1);
    expect(r.tareasDuplicadas).toBe(1);
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(1);
  });

  it("dos corridas al mismo tiempo no mandan el mismo mensaje dos veces", async () => {
    const { canales, llamadas } = canalesFalsos(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { tipo: "enviado", detalle: "ok" };
    });
    await correr(canales, T0);
    await Promise.all([correr(canales, min(10)), correr(canales, min(10)), correr(canales, min(10))]);
    expect(llamadas).toHaveLength(1);
  });

  it("un hecho ya procesado no se vuelve a procesar", async () => {
    const { canales } = canalesFalsos();
    await correr(canales, T0);
    const r2 = await correr(canales, min(1));
    expect(r2.eventos).toBe(0);
  });
});

describe("pausar, eliminar y vigencia", () => {
  it("si el impulso se pausa antes de que salga, la tarea se cancela y nada se manda", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    repo.impulsos.set("imp-1", impulso({ estado: "pausado" }));
    const r = await correr(canales, min(10));
    expect(llamadas).toHaveLength(0);
    expect(r.canceladas).toBe(1);
    expect(repo.tareas[0].estado).toBe("cancelada");
    expect(repo.tareas[0].motivo).toBe("impulso_pausado");
  });

  it("un impulso eliminado cancela sus tareas", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    repo.impulsos.delete("imp-1");
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].motivo).toBe("impulso_eliminado");
  });

  it("un impulso activado DESPUÉS del hecho no le escribe a lo de antes", async () => {
    repo.impulsos.set("imp-1", impulso({ activado_en: min(60).toISOString() }));
    const { canales } = canalesFalsos();
    const r = await correr(canales, min(120));
    expect(r.tareasCreadas).toBe(0);
    expect(repo.tareas).toHaveLength(0);
  });

  it("una campaña que ya terminó no manda", async () => {
    repo.impulsos.set("imp-1", impulso({ vigente_hasta: "2026-10-20" }));
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0]?.estado).toBe("omitida");
    expect(repo.tareas[0]?.motivo).toBe("fuera_de_vigencia");
  });

  it("un hecho de ANTES del inicio de la campaña no deja ni rastro", async () => {
    repo.impulsos.set("imp-1", impulso({ vigente_desde: "2026-11-01" }));
    const { canales } = canalesFalsos();
    await correr(canales, T0);
    expect(repo.tareas).toHaveLength(0);
  });

  it("una tarjeta que no está operando no manda", async () => {
    repo.infos.set(PROGRAMA, info({ opera: false }));
    const { canales, llamadas } = canalesFalsos();
    repo.infos.set(PROGRAMA, info({ opera: true }));
    await correr(canales, T0);
    repo.infos.set(PROGRAMA, info({ opera: false }));
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].motivo).toBe("tarjeta_inactiva");
  });
});

describe("horarios", () => {
  it("la hora exacta es la del negocio (9:00 en Costa Rica = 15:00 UTC)", async () => {
    repo.impulsos.set("imp-1", impulso({ retraso_minutos: 0, horario: { modo: "hora_exacta", hora: "09:00" } }));
    const { canales } = canalesFalsos();
    await correr(canales, T0); // 10:00 local: ya pasaron las 9, sale mañana
    expect(repo.tareas[0].ejecutar_en).toBe("2026-10-22T15:00:00.000Z");
  });

  it("si la corrida se atrasa y la ventana ya cerró, la tarea se corre a la próxima ventana", async () => {
    repo.impulsos.set(
      "imp-1",
      impulso({ retraso_minutos: 0, horario: { modo: "ventana", desde: "09:00", hasta: "18:00", siguiente_ventana: true } }),
    );
    const { canales, llamadas } = canalesFalsos();
    // El hecho fue a las 10:00 locales (dentro de la ventana), pero el worker no corrió hasta las
    // 19:00 locales (01:00 UTC del 22): para entonces la ventana ya cerró.
    const tarde = new Date("2026-10-22T01:00:00Z");
    const r = await correr(canales, tarde);
    expect(llamadas).toHaveLength(0);
    expect(r.reprogramadas).toBe(1);
    expect(repo.tareas[0].estado).toBe("programada");
    expect(repo.tareas[0].ejecutar_en).toBe("2026-10-22T15:00:00.000Z"); // jueves 09:00 local
    expect(repo.tareas[0].intentos).toBe(0); // reprogramar no gasta un intento
  });

  it("una tarea que lleva más de 24 horas esperando ya no se manda (quedaría desactualizada)", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    const r = await correr(canales, min(5 + 25 * 60));
    expect(llamadas).toHaveLength(0);
    expect(r.omitidas).toBe(1);
    expect(repo.tareas[0].motivo).toBe("vencida");
  });
});

describe("antes de mandar, se vuelve a mirar todo", () => {
  async function conCliente(ctx: Partial<ContextoCliente>, extraImpulso: Partial<Impulso> = {}) {
    repo.impulsos.set("imp-1", impulso(extraImpulso));
    repo.clientes.set(MIEMBRO, { programaId: PROGRAMA, cargado: { miembroActivo: true, ctx: contexto(ctx) } });
    const f = canalesFalsos();
    await correr(f.canales, T0);
    await correr(f.canales, min(10));
    return f;
  }

  it("condiciones que no se cumplen → omitida, con el motivo", async () => {
    const { llamadas } = await conCliente({ visitas: 1 }, { condiciones: [{ campo: "visitas", op: "gte", valor: 3 }] });
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].estado).toBe("omitida");
    expect(repo.tareas[0].motivo).toBe("condiciones_no_cumplidas");
    expect(repo.tareas[0].detalle).toBe("Número de visitas es al menos 3");
  });

  it("condiciones que sí se cumplen → sale", async () => {
    const { llamadas } = await conCliente({ visitas: 5 }, { condiciones: [{ campo: "visitas", op: "gte", valor: 3 }] });
    expect(llamadas).toHaveLength(1);
  });

  it("un dato que falta y no tiene alternativo NO se inventa: el mensaje no se manda", async () => {
    const { llamadas } = await conCliente({ nombre: null }, { cuerpo: "Hola {{nombre_cliente}}, gracias." });
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].motivo).toBe("variable_faltante");
    expect(repo.tareas[0].detalle).toContain("nombre_cliente");
  });

  it("con alternativo, el mismo dato faltante sale bien", async () => {
    const { llamadas } = await conCliente({ nombre: null }, { cuerpo: "Hola {{nombre_cliente|amigo}}, gracias." });
    expect(llamadas[0].cuerpo).toBe("Hola amigo, gracias.");
  });

  it("un cliente dado de baja no recibe nada", async () => {
    repo.clientes.set(MIEMBRO, { programaId: PROGRAMA, cargado: { miembroActivo: false, ctx: contexto() } });
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].motivo).toBe("miembro_inactivo");
  });

  it("un cliente que no es de ESTA tarjeta no se carga (aislamiento entre negocios)", async () => {
    repo.clientes.set(MIEMBRO, { programaId: "otra-tarjeta", cargado: { miembroActivo: true, ctx: contexto() } });
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].motivo).toBe("miembro_inactivo");
  });
});

describe("límites por cliente", () => {
  it("la espera mínima evita repetirle el mismo impulso", async () => {
    repo.impulsos.set("imp-1", impulso({ espera_minima_horas: 48 }));
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    await correr(canales, min(10)); // sale la primera
    expect(llamadas).toHaveLength(1);
    // otro hecho distinto del mismo cliente, horas después
    repo.eventos.push(evento({ id: "ev-9", clave: "otro-hecho", ocurrido_en: min(300).toISOString() }));
    await correr(canales, min(300));
    await correr(canales, min(320));
    expect(llamadas).toHaveLength(1);
    expect(repo.tareas[1].motivo).toBe("espera_minima");
  });

  it("nunca más de 3 mensajes de impulsos en 24 horas a un mismo cliente", async () => {
    const { canales, llamadas } = canalesFalsos();
    for (let i = 1; i <= 5; i++) {
      repo.impulsos.set(`imp-${i}`, impulso({ id: `imp-${i}`, retraso_minutos: 1 }));
    }
    await correr(canales, T0);
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(3);
    expect(repo.tareas.filter((t) => t.motivo === "tope_diario_cliente")).toHaveLength(2);
  });
});

describe("fallos del proveedor y reintentos", () => {
  it("un fallo común se reintenta a los 5 minutos", async () => {
    let falla = true;
    const { canales, llamadas } = canalesFalsos(() =>
      falla ? { tipo: "fallo", motivo: "error_proveedor", detalle: "Google respondió 500", permanente: false } : { tipo: "enviado", detalle: "ok" },
    );
    await correr(canales, T0);
    const r1 = await correr(canales, min(10));
    expect(r1.reintentos).toBe(1);
    expect(repo.tareas[0].estado).toBe("pendiente");
    expect(repo.tareas[0].proximo_intento_en).toBe(min(15).toISOString());

    await correr(canales, min(12)); // todavía no toca
    expect(llamadas).toHaveLength(1);

    falla = false;
    await correr(canales, min(16));
    expect(llamadas).toHaveLength(2);
    expect(repo.tareas[0].estado).toBe("enviada");
  });

  it("al tercer intento fallido se da por fallida y no se insiste más", async () => {
    const { canales, llamadas } = canalesFalsos(() => ({ tipo: "fallo", motivo: "error_proveedor", detalle: "caído", permanente: false }));
    await correr(canales, T0);
    await correr(canales, min(10)); // intento 1 → +5
    await correr(canales, min(20)); // intento 2 → +30
    const r = await correr(canales, min(60)); // intento 3 → fallida
    expect(llamadas).toHaveLength(3);
    expect(r.fallidas).toBe(1);
    expect(repo.tareas[0].estado).toBe("fallida");
    await correr(canales, min(600));
    expect(llamadas).toHaveLength(3);
  });

  it("un fallo permanente (proveedor sin configurar) no se reintenta", async () => {
    const { canales, llamadas } = canalesFalsos(() => ({ tipo: "fallo", motivo: "proveedor_no_configurado", detalle: "sin clave", permanente: true }));
    await correr(canales, T0);
    await correr(canales, min(10));
    await correr(canales, min(60));
    expect(llamadas).toHaveLength(1);
    expect(repo.tareas[0].estado).toBe("fallida");
    expect(repo.tareas[0].motivo).toBe("proveedor_no_configurado");
  });

  it("una excepción DESPUÉS de empezar a mandar queda como resultado incierto y NO se reintenta (podría duplicarse)", async () => {
    const { canales, llamadas } = canalesFalsos(async (e) => {
      await e.marcarInicio();
      throw new Error("se cortó la conexión");
    });
    await correr(canales, T0);
    await correr(canales, min(10));
    await correr(canales, min(120));
    expect(llamadas).toHaveLength(1);
    expect(repo.tareas[0].estado).toBe("fallida");
    expect(repo.tareas[0].motivo).toBe("resultado_incierto");
    expect(repo.tareas[0].envio_iniciado_en).not.toBeNull();
  });

  it("una excepción ANTES de empezar a mandar sí se reintenta", async () => {
    let n = 0;
    const { canales, llamadas } = canalesFalsos(() => {
      n += 1;
      if (n === 1) throw new Error("no se pudo leer la base");
      return { tipo: "enviado", detalle: "ok" };
    });
    await correr(canales, T0);
    await correr(canales, min(10));
    expect(repo.tareas[0].estado).toBe("pendiente");
    await correr(canales, min(20));
    expect(llamadas).toHaveLength(2);
    expect(repo.tareas[0].estado).toBe("enviada");
  });

  it("un canal que decide no mandar (sin consentimiento) deja la tarea omitida con su motivo", async () => {
    const { canales } = canalesFalsos(() => ({ tipo: "omitido", motivo: "sin_consentimiento", detalle: "no aceptó correos" }));
    await correr(canales, T0);
    await correr(canales, min(10));
    expect(repo.tareas[0].estado).toBe("omitida");
    expect(repo.tareas[0].motivo).toBe("sin_consentimiento");
  });

  it("los errores no llevan correos ni datos personales", async () => {
    const { canales } = canalesFalsos(() => {
      throw new Error("fallo al escribirle a ana@correo.com");
    });
    await correr(canales, T0);
    const r = await correr(canales, min(10));
    expect(JSON.stringify(r.errores) + JSON.stringify(repo.tareas)).not.toContain("ana@correo.com");
  });
});

describe("cada tipo de hecho", () => {
  it("un sello en una tarjeta de sellos dispara «recibe un sello» solo en los sellos elegidos", async () => {
    repo.impulsos.set("imp-1", impulso({ activador: "sello_registrado", activador_config: { sellos: [3] }, retraso_minutos: 0 }));
    repo.eventos.length = 0;
    repo.eventos.push(
      evento({ id: "e-a", tipo: "ledger_ganado", clave: "tx:1", datos: { saldo_anterior: 1, saldo_posterior: 2, referencia: "qr:1" } }),
      evento({ id: "e-b", tipo: "ledger_ganado", clave: "tx:2", datos: { saldo_anterior: 2, saldo_posterior: 3, referencia: "qr:2" } }),
    );
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(1);
    expect(repo.tareas[0].clave).toBe("ledger_ganado:tx:2");
  });

  it("«te falta 1» se dispara cuando el saldo queda a un sello de la meta, y NO con el sello de regalo del inicio", async () => {
    repo.impulsos.set("imp-1", impulso({ activador: "meta_proxima", activador_config: { faltan: 1 }, retraso_minutos: 0 }));
    repo.eventos.length = 0;
    repo.eventos.push(
      evento({ id: "e-a", tipo: "ledger_ganado", clave: "tx:1", datos: { saldo_anterior: 3, saldo_posterior: 4, referencia: "qr:1" } }),
      evento({ id: "e-b", tipo: "ledger_ganado", clave: "tx:2", datos: { saldo_anterior: 1, saldo_posterior: 2, referencia: "qr:2" } }),
    );
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(1);
    expect(repo.tareas[0].clave).toBe("ledger_ganado:tx:1");
  });

  it("«te falta 1» ya no sale si el cliente sumó otro sello antes de que saliera (quedaría desactualizado)", async () => {
    repo.impulsos.set("imp-1", impulso({ activador: "meta_proxima", activador_config: { faltan: 1 }, retraso_minutos: 30 }));
    repo.eventos.length = 0;
    repo.eventos.push(evento({ tipo: "ledger_ganado", clave: "tx:1", datos: { saldo_anterior: 3, saldo_posterior: 4, referencia: "qr:1" } }));
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    repo.clientes.set(MIEMBRO, { programaId: PROGRAMA, cargado: { miembroActivo: true, ctx: contexto({ saldo: 5 }) } }); // sumó otro
    await correr(canales, min(40));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].motivo).toBe("ya_no_aplica");
  });

  it("la primera visita cuenta solo la visita real, no el sello de bienvenida", async () => {
    repo.impulsos.set("imp-1", impulso({ activador: "primera_visita", retraso_minutos: 0 }));
    repo.eventos.length = 0;
    repo.eventos.push(
      evento({ id: "e-a", tipo: "ledger_ganado", clave: "tx:1", datos: { saldo_anterior: 0, saldo_posterior: 1, referencia: `bienvenida:${MIEMBRO}` } }),
      evento({ id: "e-b", tipo: "ledger_ganado", clave: "tx:2", datos: { saldo_anterior: 1, saldo_posterior: 2, referencia: "qr:2" } }),
    );
    repo.visitas.set(MIEMBRO, 1);
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(1);
    expect(repo.tareas[0].clave).toBe("ledger_ganado:tx:2");
  });

  it("un canje dispara «canjea un premio»", async () => {
    repo.impulsos.set("imp-1", impulso({ activador: "canje_realizado", retraso_minutos: 0 }));
    repo.eventos.length = 0;
    repo.eventos.push(evento({ tipo: "ledger_canjeado", clave: "tx:9", datos: { saldo_anterior: 5, saldo_posterior: 0 } }));
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(1);
  });

  it("Apple Wallet: el hecho del pase dispara «agrega la tarjeta al Wallet»", async () => {
    repo.impulsos.set("imp-1", impulso({ activador: "pase_apple", retraso_minutos: 5 }));
    repo.eventos.length = 0;
    repo.eventos.push(evento({ tipo: "pase_apple", clave: "apple:SER1" }));
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(1);
  });

  it("un impulso de un activador que hoy no se puede cumplir (cumpleaños) no dispara nada", async () => {
    repo.impulsos.set("imp-1", impulso({ activador: "cumpleanos" }));
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(0);
  });
});

describe("inactividad (el barrido por tiempo)", () => {
  beforeEach(() => {
    repo.eventos.length = 0;
    repo.impulsos.set(
      "imp-1",
      impulso({
        activador: "inactividad",
        activador_config: { dias: 30, ventana_dias: 30 },
        retraso_minutos: 0,
        horario: { modo: "inmediato" },
        titulo: "¡Te extrañamos!",
        cuerpo: "Volvé a {{nombre_negocio}}.",
      }),
    );
    repo.inactivosDe.set(PROGRAMA, [{ miembroId: MIEMBRO, ultima: "2026-09-15" }]);
    repo.clientes.set(MIEMBRO, { programaId: PROGRAMA, cargado: { miembroActivo: true, ctx: contexto({ diasSinActividad: 36 }) } });
  });

  it("le escribe una sola vez por ausencia, aunque el barrido corra cada hora", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    expect(llamadas).toHaveLength(1);
    expect(repo.tareas[0].clave).toBe(`inactivo:${MIEMBRO}:2026-09-15`);

    // el barrido vuelve una hora después: el mismo cliente sigue en la lista, pero es la misma ausencia
    const r2 = await correr(canales, min(61));
    expect(r2.tareasDuplicadas).toBe(1);
    expect(llamadas).toHaveLength(1);
  });

  it("si el cliente volvió antes de que saliera, no se manda", async () => {
    repo.impulsos.set("imp-1", impulso({ ...repo.impulsos.get("imp-1")!, retraso_minutos: 60 }));
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    repo.clientes.set(MIEMBRO, { programaId: PROGRAMA, cargado: { miembroActivo: true, ctx: contexto({ diasSinActividad: 0 }) } });
    await correr(canales, min(90));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].motivo).toBe("ya_no_aplica");
  });

  it("un impulso pausado no escanea", async () => {
    repo.impulsos.set("imp-1", impulso({ ...repo.impulsos.get("imp-1")!, estado: "pausado" }));
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.escaneados).toBe(0);
  });

  it("revisa a lo sumo una vez por hora", async () => {
    const { canales } = canalesFalsos();
    await correr(canales, T0);
    repo.inactivosDe.set(PROGRAMA, [{ miembroId: "miembro-2", ultima: "2026-09-10" }]);
    const r = await correr(canales, min(20));
    expect(r.escaneados).toBe(0);
  });
});

describe("aislamiento entre negocios", () => {
  it("un hecho cuyo negocio no es el de la tarjeta se descarta sin crear nada", async () => {
    repo.eventos.length = 0;
    repo.eventos.push(evento({ rancho_id: "rancho-OTRO" }));
    const { canales } = canalesFalsos();
    const r = await correr(canales, T0);
    expect(r.tareasCreadas).toBe(0);
    expect(repo.eventos[0].procesado).toBe(true);
  });

  it("un impulso de otro negocio no se aplica a esta tarjeta", async () => {
    repo.impulsos.set("imp-x", impulso({ id: "imp-x", rancho_id: "rancho-OTRO" }));
    const { canales } = canalesFalsos();
    await correr(canales, T0);
    expect(repo.tareas.filter((t) => t.impulso_id === "imp-x")).toHaveLength(0);
  });

  it("una tarea que no cuadra con su impulso falla en vez de mandarse", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    repo.tareas[0].rancho_id = "rancho-OTRO";
    await correr(canales, min(10));
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].estado).toBe("fallida");
  });
});

describe("robustez", () => {
  it("si leer los hechos falla, igual se procesan las tareas que ya estaban listas", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0); // deja la tarea programada
    repo.fallar.eventosPendientes = true;
    const r = await correr(canales, min(10));
    expect(r.errores.join(" ")).toContain("materializar");
    expect(llamadas).toHaveLength(1);
  });

  it("sin presupuesto de tiempo no toma tareas nuevas", async () => {
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    await correr(canales, min(10), { presupuestoMs: 0 });
    expect(llamadas).toHaveLength(0);
    expect(repo.tareas[0].estado).toBe("programada");
  });

  it("atiende lotes grandes, de a pocos clientes en paralelo", async () => {
    repo.eventos.length = 0;
    for (let i = 0; i < 25; i++) {
      const m = `m-${i}`;
      repo.clientes.set(m, { programaId: PROGRAMA, cargado: { miembroActivo: true, ctx: contexto() } });
      repo.eventos.push(evento({ id: `ev-${i}`, miembro_id: m, clave: `miembro:${m}` }));
    }
    const { canales, llamadas } = canalesFalsos();
    await correr(canales, T0);
    const r = await correr(canales, min(10), { tamanoLote: 7 });
    expect(llamadas).toHaveLength(25);
    expect(r.enviadas).toBe(25);
    expect(new Set(llamadas.map((l) => l.miembro)).size).toBe(25);
  });
});

describe("sigueVigente", () => {
  it("cada activador con un número exacto se vuelve a comprobar", () => {
    const c = contexto({ saldo: 4, meta: 5, diasSinActividad: 40 });
    expect(sigueVigente({ activador: "meta_proxima", activador_config: { faltan: 1 } }, c)).toBe(true);
    expect(sigueVigente({ activador: "meta_proxima", activador_config: { faltan: 2 } }, c)).toBe(false);
    expect(sigueVigente({ activador: "recompensa_alcanzada", activador_config: {} }, c)).toBe(false);
    expect(sigueVigente({ activador: "recompensa_alcanzada", activador_config: {} }, contexto({ saldo: 5, meta: 5 }))).toBe(true);
    expect(sigueVigente({ activador: "inactividad", activador_config: { dias: 30 } }, c)).toBe(true);
    expect(sigueVigente({ activador: "inactividad", activador_config: { dias: 30 } }, contexto({ diasSinActividad: null }))).toBe(false);
    expect(sigueVigente({ activador: "inscripcion", activador_config: {} }, c)).toBe(true);
  });
});
