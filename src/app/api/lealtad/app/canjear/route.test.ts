import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISOS_NADA, PERMISOS_TODO } from "@/lib/lealtad/permisos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA LLAVE DEL CANJE, VISTA DESDE LA PUERTA DEL TELÉFONO
 * ════════════════════════════════════════════════════════════════════
 *
 * `operar-core.test.ts` prueba que dos canjes con la MISMA referencia
 * entregan un solo premio. Lo que falta probar es lo de acá: que esa
 * referencia sea la misma cuando el teléfono reintenta.
 *
 * Y no es una formalidad. La llave del panel web lleva el MINUTO DE
 * CALENDARIO adentro, y ese minuto falla en las dos direcciones —dos
 * toques a las 14:28:59 y a las 14:29:01 caen en minutos distintos y
 * pasan los dos—. La app nace sin esa deuda porque el `intentoId` es
 * obligatorio: sin él, 400 y no se toca la base.
 *
 * El núcleo se sustituye a propósito: acá no se prueba qué hace el
 * canje, se prueba QUÉ LLAVE recibe.
 */

vi.mock("@/lib/lealtad/operar-core", () => ({
  canjearCore: async (entrada: { referencia: string }) => {
    referenciasRecibidas.push(entrada.referencia);
    return { ok: true, saldo: 0, recompensa: "Café gratis", sku: null, instrucciones: null };
  },
}));

vi.mock("@/lib/auth", () => ({
  accesoLealtadDeLaPeticion: async () => {
    llamadas.push("acceso");
    return {
      ok: true,
      esAdmin: false,
      esDueno: true,
      esColaborador: false,
      usuarioId: "u-1",
      permisos,
      supabase: { rpc: async () => ({ data: true, error: null }) },
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from() {
      const c = {
        select: () => c,
        eq: () => c,
        maybeSingle: async () => ({ data: { id: RANCHO }, error: null }),
      };
      return c;
    },
    async rpc(nombre: string) {
      llamadas.push(`rpc:${nombre}`);
      return { data: 1, error: null };
    },
  }),
}));

const { POST } = await import("./route");

const RANCHO = "34525402-b895-4070-90fa-be3449f9b15c";
const MIEMBRO = "m-1";
const RECOMPENSA = "rc-1";
const INTENTO = "a1b2c3d4-5566";

let referenciasRecibidas: string[] = [];
let llamadas: string[] = [];
let permisos = PERMISOS_TODO;

function pedido(cuerpo: Record<string, unknown>): Request {
  return new Request("https://bookea.lat/api/lealtad/app/canjear", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer tok" },
    body: JSON.stringify(cuerpo),
  });
}

const CUERPO = {
  ranchoId: RANCHO,
  miembroId: MIEMBRO,
  recompensaId: RECOMPENSA,
  intentoId: INTENTO,
};

beforeEach(() => {
  referenciasRecibidas = [];
  llamadas = [];
  permisos = PERMISOS_TODO;
});

describe("el `intentoId` es obligatorio", () => {
  it("sin él se responde 400 y NO se toca nada", async () => {
    const r = await POST(pedido({ ...CUERPO, intentoId: undefined }));
    expect(r.status).toBe(400);
    // Ni la puerta se abrió: el rechazo es antes de gastar una consulta.
    expect(llamadas).toHaveLength(0);
    expect(referenciasRecibidas).toHaveLength(0);
  });

  it("con forma rara tampoco pasa", async () => {
    // `INTENTO_VALIDO` es el MISMO regex que valida lo que genera
    // `llaveDeIntento`. Un segundo regex escrito a mano acá haría que la
    // misma llave se acepte por un lado y se rechace por el otro.
    const r = await POST(pedido({ ...CUERPO, intentoId: "corto" }));
    expect(r.status).toBe(400);
    expect(referenciasRecibidas).toHaveLength(0);
  });
});

describe("la referencia la arma el servidor", () => {
  it("el mismo intento dos veces produce la MISMA llave", async () => {
    await POST(pedido(CUERPO));
    await POST(pedido(CUERPO));

    expect(referenciasRecibidas).toHaveLength(2);
    // Idénticas: el índice `canjes_referencia_unica` rebota la segunda
    // y el cliente se lleva UN premio, no dos.
    expect(referenciasRecibidas[0]).toBe(referenciasRecibidas[1]);
    expect(referenciasRecibidas[0]).toBe(`canje:${MIEMBRO}:${RECOMPENSA}:${INTENTO}`);
  });

  it("una `referencia` mandada por el cliente se ignora", async () => {
    // Aceptarla cruda dejaría mandar `api:tiquete-2026-0001` y quemar de
    // antemano la llave del integrador de punto de venta, haciendo
    // rebotar su canje legítimo.
    await POST(pedido({ ...CUERPO, referencia: "api:tiquete-2026-0001" }));
    expect(referenciasRecibidas[0]).toBe(`canje:${MIEMBRO}:${RECOMPENSA}:${INTENTO}`);
  });

  it("intentos distintos son operaciones distintas", async () => {
    await POST(pedido({ ...CUERPO, intentoId: "aaaaaaaa-1111" }));
    await POST(pedido({ ...CUERPO, intentoId: "bbbbbbbb-2222" }));
    expect(referenciasRecibidas[0]).not.toBe(referenciasRecibidas[1]);
  });
});

describe("el permiso es `canjear`, no `acreditar`", () => {
  it("quien solo sella NO entrega premios", async () => {
    // Son dos permisos distintos del checklist de la 0127: hay locales
    // donde sella cualquiera del turno y entrega solo el encargado.
    permisos = { ...PERMISOS_NADA, acreditar: true };

    const r = await POST(pedido(CUERPO));

    expect(r.status).toBe(403);
    expect(referenciasRecibidas).toHaveLength(0);
  });
});
