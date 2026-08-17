import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EL PROPÓSITO ENTERO DE LA API, PROBADO.
 *
 * Después de acotar el alcance en agosto de 2026, esta API existe para
 * UNA cosa: que un sistema externo le sume un sello al cliente y el
 * pase del teléfono se actualice solo. Si el sello entra a la base y el
 * teléfono no se entera, el endpoint no sirve para nada — y eso es
 * exactamente lo que pasaba: la ruta acreditaba y nunca llamaba a
 * `avisarCambioDePase`, que es lo que sí hacen los dos caminos del
 * panel (`escaner-actions.ts` y `lealtad-operar-actions.ts`).
 *
 * El bug era invisible desde afuera: 201, `puntos_otorgados: 1`, saldo
 * correcto, ledger correcto. Solo el cliente lo notaba, mirando una
 * tarjeta que no se movía. Es el mismo fallo que ya dejó mudos los
 * sellos una vez, visto desde el otro lado —`entregarApple` empujaba
 * sin marcar `actualizado_en`, y acá se marcaba sin empujar— y por eso
 * esta suite fija LAS DOS MITADES:
 *
 *   1. que se llame al RPC `acreditar_lealtad` (que marca el pase
 *      adentro de su transacción, 0125:407-409);
 *   2. y que DESPUÉS se empuje el aviso, para que el teléfono pregunte.
 *
 * Nada de esto toca la base: se sustituyen la puerta (`contexto`), las
 * consultas (`datos`) y el avisador. Lo que se prueba es el ORDEN y la
 * CONDICIÓN, que es donde estaba el error.
 */

vi.mock("next/server", () => ({
  // El `after` de verdad necesita el contexto de una petición de Next.
  // Acá se ejecuta de una: lo que importa es QUE se ejecute.
  after: (fn: () => unknown) => {
    pasos.push("after");
    return fn();
  },
  NextResponse: { json: () => ({ status: 200 }) },
}));

vi.mock("@/lib/wallet/servicio", () => ({
  avisarCambioDePase: vi.fn(async (id: string) => {
    pasos.push(`avisar:${id}`);
  }),
}));

vi.mock("@/lib/lealtad/api/contexto", () => ({
  abrirContexto: () => Promise.resolve({ ok: true, ctx }),
  cerrar: (_ctx: unknown, respuesta: unknown) => respuesta,
  responder: (_ctx: unknown, cuerpo: unknown, estado = 200) => ({ cuerpo, estado }),
}));

vi.mock("@/lib/lealtad/api/datos", () => ({
  miembroPorRef: () =>
    Promise.resolve(
      miembroExiste
        ? { miembroId: MIEMBRO, programaId: "pg-1", estado: "activa", clienteId: "cl-1" }
        : null,
    ),
  metaDelPrograma: () => Promise.resolve(10),
}));

import { avisarCambioDePase } from "@/lib/wallet/servicio";
import { POST } from "./route";

const MIEMBRO = "9f1c8a4e-1234-4a4a-9c9c-0f0f0f0f0f0f";
const REF = "mb_7Q2KX9FJ4M8NBVDA";

let pasos: string[] = [];
let miembroExiste = true;
/** Qué contesta el RPC `acreditar_lealtad` en esta corrida. */
let resultadoRpc: Record<string, unknown> = { otorgado: true, puntos: 1, saldo: 8 };
/** La fila que se relee de `transacciones_puntos`, o null si no aparece. */
let movimiento: Record<string, unknown> | null = null;

/**
 * Una base de mentira que ANOTA lo que se le pide. No valida SQL: valida
 * la secuencia de decisiones de la ruta.
 */
const ctx = {
  requestId: "req-1",
  inicioMs: Date.now(),
  metodo: "POST",
  ruta: "/acreditaciones",
  llaveId: "llave-1",
  kid: "kid1",
  autorizacionId: "aut-1",
  desarrolladorId: "dev-1",
  desarrollador: "Fulano POS",
  ranchoId: "rancho-1",
  programaId: "pg-1",
  entorno: "live",
  scopes: ["acreditar"],
  mostrarIniciales: false,
  pepperRef: Buffer.alloc(32),
  ipHmac: null,
  cabecerasLimite: {},
  db: {
    rpc(nombre: string) {
      pasos.push(`rpc:${nombre}`);
      return Promise.resolve({ data: resultadoRpc, error: null });
    },
    from() {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              limit: () => {
                pasos.push("releer-movimiento");
                return Promise.resolve({ data: movimiento ? [movimiento] : [] });
              },
            }),
          }),
        }),
        update: () => ({
          eq: () => {
            pasos.push("estampar-llave");
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  },
};

function pedido(cuerpo: Record<string, unknown>): Request {
  return new Request("https://bookea.lat/api/lealtad/v1/acreditaciones", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

const CUERPO = { ref: REF, monto: 12500, referencia: "tiquete-00194" };

beforeEach(() => {
  pasos = [];
  miembroExiste = true;
  resultadoRpc = { otorgado: true, puntos: 1, saldo: 8 };
  movimiento = {
    id: "99999999-8888-7777-6666-555555555555",
    puntos: 1,
    saldo_anterior: 7,
    saldo_posterior: 8,
    created_at: "2026-08-17T20:31:00.000Z",
    reglas: { monto: 12500 },
  };
  vi.mocked(avisarCambioDePase).mockClear();
});

describe("POST /acreditaciones — el pase SE TIENE QUE ACTUALIZAR", () => {
  it("después de acreditar, empuja el aviso al teléfono", async () => {
    await POST(pedido(CUERPO));

    expect(avisarCambioDePase).toHaveBeenCalledTimes(1);
    expect(avisarCambioDePase).toHaveBeenCalledWith(MIEMBRO);
  });

  it("el aviso va DESPUÉS del RPC, no antes ni en vez de", async () => {
    // Avisar antes de acreditar haría que el teléfono preguntara y se
    // llevara el saldo viejo: el push se gasta y el sello queda mudo
    // igual, que es el bug de siempre con otra cara.
    await POST(pedido(CUERPO));

    const rpc = pasos.indexOf("rpc:acreditar_lealtad");
    const aviso = pasos.findIndex((p) => p.startsWith("avisar:"));
    expect(rpc).toBeGreaterThanOrEqual(0);
    expect(aviso).toBeGreaterThan(rpc);
  });

  it("el aviso va dentro de `after`, que es lo que lo mantiene vivo en Vercel", async () => {
    // Un `void` suelto muere cuando la función se congela al responder.
    await POST(pedido(CUERPO));

    const after = pasos.indexOf("after");
    const aviso = pasos.findIndex((p) => p.startsWith("avisar:"));
    expect(after).toBeGreaterThanOrEqual(0);
    expect(aviso).toBeGreaterThanOrEqual(after);
  });
});

describe("POST /acreditaciones — cuándo NO se avisa", () => {
  it("no avisa en el reintento idempotente: no cambió nada que bajar", async () => {
    // Un POS con la red mala reintenta. El ledger ya rebotó el
    // duplicado, así que empujar acá sería gastar pushes por nada.
    resultadoRpc = { otorgado: false, motivo: "ya-otorgado", saldo: 8 };

    const salida = (await POST(pedido(CUERPO))) as unknown as { estado: number };
    expect(salida.estado).toBe(200);
    expect(avisarCambioDePase).not.toHaveBeenCalled();
  });

  it("no avisa cuando una regla del programa dijo que no", async () => {
    resultadoRpc = { otorgado: false, motivo: "Este cliente ya llegó a su tope de hoy." };
    movimiento = null;

    await POST(pedido(CUERPO));
    expect(avisarCambioDePase).not.toHaveBeenCalled();
  });

  it("no avisa cuando el `ref` no es de esta llave (el paso 8)", async () => {
    miembroExiste = false;

    await POST(pedido(CUERPO));
    expect(pasos).not.toContain("rpc:acreditar_lealtad");
    expect(avisarCambioDePase).not.toHaveBeenCalled();
  });

  it("SÍ avisa aunque el movimiento no se pueda releer: el sello ya está en el ledger", async () => {
    // La relectura es para poder CONTESTARLE bien al POS; el sello ya
    // entró. Si el aviso colgara de ella, un fallo acá dejaría un sello
    // acreditado y un teléfono mudo para siempre — porque el reintento
    // del POS es `duplicada` y por diseño no vuelve a empujar.
    movimiento = null;

    await POST(pedido(CUERPO));
    expect(avisarCambioDePase).toHaveBeenCalledWith(MIEMBRO);
  });
});

describe("POST /acreditaciones — la idempotencia la pone la base", () => {
  it("un reintento con la MISMA referencia y el MISMO monto devuelve 200 y no suma", async () => {
    // `acreditar_lealtad` atrapa el `unique_violation` de
    // `transacciones_puntos_referencia_unica` (0060:187) y contesta
    // `ya-otorgado`. Dos peticiones simultáneas atraviesan las dos un
    // `if` de TypeScript; ninguna atraviesa un unique de Postgres.
    resultadoRpc = { otorgado: false, motivo: "ya-otorgado", saldo: 8 };

    const salida = (await POST(pedido(CUERPO))) as unknown as {
      estado: number;
      cuerpo: { duplicada: boolean; puntos_otorgados: number };
    };
    expect(salida.estado).toBe(200);
    expect(salida.cuerpo.duplicada).toBe(true);
    expect(salida.cuerpo.puntos_otorgados).toBe(0);
  });

  it("la primera vez devuelve 201 y estampa la llave para poder revertir en bloque", async () => {
    const salida = (await POST(pedido(CUERPO))) as unknown as {
      estado: number;
      cuerpo: { duplicada: boolean };
    };
    expect(salida.estado).toBe(201);
    expect(salida.cuerpo.duplicada).toBe(false);
    expect(pasos).toContain("estampar-llave");
  });
});
