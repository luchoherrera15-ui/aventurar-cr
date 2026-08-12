import { describe, expect, it } from "vitest";
import {
  fichasDeMiembros,
  resumenDeLealtad,
  type MiembroCrudo,
  type TransaccionCruda,
} from "./tablero";

const HOY = "2026-08-12";

function miembro(id: string, extra: Partial<MiembroCrudo> = {}): MiembroCrudo {
  return { id, cliente_id: `c-${id}`, estado: "activa", created_at: "2026-01-01", ...extra };
}

function tx(
  miembro_id: string,
  puntos: number,
  created_at: string,
  tipo = "ganado",
): TransaccionCruda {
  return { miembro_id, puntos, tipo, created_at };
}

const NOMBRES = new Map([
  ["c-m1", "Ana"],
  ["c-m2", "Beto"],
]);

describe("fichasDeMiembros", () => {
  it("deriva el saldo sumando el ledger", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1")],
      transacciones: [tx("m1", 3, "2026-08-01"), tx("m1", 2, "2026-08-05")],
      pases: [],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    expect(f[0]).toMatchObject({ nombre: "Ana", saldo: 5, faltan: 5, puedeCanjear: false });
  });

  it("un canje resta del saldo", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1")],
      transacciones: [tx("m1", 10, "2026-08-01"), tx("m1", -10, "2026-08-02", "canjeado")],
      pases: [],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    expect(f[0].saldo).toBe(0);
    expect(f[0].puedeCanjear).toBe(false);
  });

  it("marca a quien ya puede canjear", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1")],
      transacciones: [tx("m1", 12, "2026-08-01")],
      pases: [],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    expect(f[0]).toMatchObject({ puedeCanjear: true, faltan: 0 });
  });

  it("los que pueden canjear van primero: son a quienes hay que atender", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1"), miembro("m2")],
      transacciones: [tx("m1", 3, "2026-08-01"), tx("m2", 10, "2026-08-01")],
      pases: [],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    expect(f.map((x) => x.miembroId)).toEqual(["m2", "m1"]);
  });

  it("sin recompensa configurada no inventa una meta", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1")],
      transacciones: [tx("m1", 4, "2026-08-01")],
      pases: [],
      nombres: NOMBRES,
      meta: null,
      hoy: HOY,
    });
    expect(f[0].faltan).toBeNull();
    expect(f[0].puedeCanjear).toBe(false);
  });

  it("un canje NO cuenta como visita para la antigüedad", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1")],
      transacciones: [
        tx("m1", 5, "2026-05-01"), // vino en mayo
        tx("m1", -5, "2026-08-11", "canjeado"), // canjeó ayer
      ],
      pases: [],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    // Si el canje contara, diría 1 día y el cliente parecería activo.
    expect(f[0].diasSinVenir).toBe(103);
  });

  it("sabe quién lleva la tarjeta en el teléfono", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1"), miembro("m2")],
      transacciones: [],
      pases: [{ miembro_id: "m1", plataforma: "apple" }],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    expect(f.find((x) => x.miembroId === "m1")!.conPase).toBe(true);
    expect(f.find((x) => x.miembroId === "m2")!.conPase).toBe(false);
  });

  it("un miembro sin movimientos no tiene antigüedad, no cero", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("m1")],
      transacciones: [],
      pases: [],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    // Un 0 lo mostraría como "vino hoy", que es lo contrario.
    expect(f[0].diasSinVenir).toBeNull();
    expect(f[0].saldo).toBe(0);
  });

  it("sin nombre en el perfil cae a una etiqueta, no a vacío", () => {
    const f = fichasDeMiembros({
      miembros: [miembro("mX", { cliente_id: "desconocido" })],
      transacciones: [],
      pases: [],
      nombres: NOMBRES,
      meta: null,
      hoy: HOY,
    });
    expect(f[0].nombre).toBe("Cliente");
  });
});

describe("resumenDeLealtad", () => {
  const miembros = [miembro("m1"), miembro("m2"), miembro("m3")];
  const transacciones = [
    tx("m1", 10, "2026-08-10"), // reciente
    tx("m2", 3, "2026-08-11"), // reciente
    tx("m3", 2, "2026-01-05"), // viejo: en riesgo
    tx("m1", -10, "2026-08-11", "canjeado"),
  ];
  const fichas = fichasDeMiembros({
    miembros,
    transacciones,
    pases: [{ miembro_id: "m1", plataforma: "apple" }],
    nombres: NOMBRES,
    meta: 3,
    hoy: HOY,
  });

  it("cuenta lo que el dueño mira de un vistazo", () => {
    const r = resumenDeLealtad({ fichas, transacciones, hoy: HOY });
    expect(r).toMatchObject({
      miembros: 3,
      conPase: 1,
      canjes: 1,
      // m2 tiene 3 y la meta es 3.
      listosParaCanjear: 1,
      // m3 no mueve nada desde enero.
      enRiesgo: 1,
    });
  });

  it("los sellos recientes solo miran la ventana pedida", () => {
    const r = resumenDeLealtad({ fichas, transacciones, hoy: HOY, ventanaDias: 30 });
    // 10 + 3 de agosto; los 2 de enero quedan fuera. El canje tampoco
    // suma: es negativo y no es "ganado".
    expect(r.sellosRecientes).toBe(13);
  });

  it("quien nunca tuvo un movimiento no está en riesgo, está recién llegado", () => {
    const nuevos = fichasDeMiembros({
      miembros: [miembro("nuevo")],
      transacciones: [],
      pases: [],
      nombres: NOMBRES,
      meta: 10,
      hoy: HOY,
    });
    expect(resumenDeLealtad({ fichas: nuevos, transacciones: [], hoy: HOY }).enRiesgo).toBe(0);
  });
});
