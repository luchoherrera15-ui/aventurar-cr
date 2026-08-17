import { describe, expect, it, vi } from "vitest";
import { extraerPassesUpdatedSince, GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { createAdminClient } from "@/lib/supabase/admin";

/** Un query-builder falso mínimo: cada método encadena y devuelve el
 * mismo objeto; al final es un thenable que resuelve al resultado
 * configurado para esa tabla — lo justo para lo que esta ruta usa
 * (.select/.eq/.in/.gt), sin simular todo el cliente real. */
function dbFalsoConError() {
  function tabla(resultado: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {};
    for (const metodo of ["select", "eq", "in", "gt"]) builder[metodo] = () => builder;
    builder.then = (resuelve: (r: unknown) => void) => resuelve(resultado);
    return builder;
  }
  return {
    from: (nombre: string) =>
      nombre === "registros_dispositivo"
        ? tabla({ data: [{ serial_number: "SERIAL-001" }], error: null })
        : tabla({ data: null, error: { message: "columna con formato inválido" } }),
  };
}

/**
 * HALLAZGO REAL (no de lectura de código): el log real de Apple mostró
 * "spurious push... returned no serial numbers" para un pase que SÍ
 * había cambiado. La causa: `URLSearchParams` interpreta un `+` en un
 * query string como espacio (semántica de
 * application/x-www-form-urlencoded) — y Apple manda `passesUpdatedSince`
 * con el `+` del huso horario sin codificar como `%2B`. La marca de
 * tiempo corrupta ("...099512 00:00", espacio en vez de +) es un
 * `timestamptz` inválido para Postgres — confirmado directo contra la
 * base, no supuesto — así que la consulta fallaba en silencio y la
 * ruta contestaba "nada cambió" aunque sí había un sello nuevo.
 */
describe("extraerPassesUpdatedSince", () => {
  it("preserva el '+' del huso horario cuando Apple lo manda literal, sin codificar (el caso real que rompía)", () => {
    const url =
      "https://www.bookea.lat/api/wallet/v1/devices/abc/registrations/pass.lat.bookea.afiliacion?passesUpdatedSince=2026-08-16T15:22:58.099512+00:00";
    expect(extraerPassesUpdatedSince(url)).toBe("2026-08-16T15:22:58.099512+00:00");
  });

  it("también funciona si algún cliente lo manda bien codificado (%2B)", () => {
    const url =
      "https://www.bookea.lat/api/wallet/v1/devices/abc/registrations/pass.lat.bookea.afiliacion?passesUpdatedSince=2026-08-16T15%3A22%3A58.099512%2B00%3A00";
    expect(extraerPassesUpdatedSince(url)).toBe("2026-08-16T15:22:58.099512+00:00");
  });

  it("acepta una marca terminada en Z (UTC sin offset numérico)", () => {
    const url =
      "https://www.bookea.lat/api/wallet/v1/devices/abc/registrations/pass.lat.bookea.afiliacion?passesUpdatedSince=2026-08-16T15:22:58.099512Z";
    expect(extraerPassesUpdatedSince(url)).toBe("2026-08-16T15:22:58.099512Z");
  });

  it("devuelve null cuando el teléfono todavía no manda el parámetro (primera consulta)", () => {
    const url = "https://www.bookea.lat/api/wallet/v1/devices/abc/registrations/pass.lat.bookea.afiliacion";
    expect(extraerPassesUpdatedSince(url)).toBeNull();
  });

  it("nunca deja pasar un espacio donde debería haber un '+' (la regresión exacta)", () => {
    const url =
      "https://www.bookea.lat/api/wallet/v1/devices/abc/registrations/pass.lat.bookea.afiliacion?passesUpdatedSince=2026-08-16T15:22:58.099512+00:00";
    const resultado = extraerPassesUpdatedSince(url);
    expect(resultado).not.toContain(" 00:00");
    expect(resultado).not.toBeNull();
    // El resultado tiene que ser un timestamp parseable de verdad.
    expect(Number.isNaN(new Date(resultado!).getTime())).toBe(false);
  });
});

describe("GET — si la consulta de pases cambiados falla, nunca contesta 204", () => {
  it("responde 500, no 204, cuando la consulta a pases_wallet trae error", async () => {
    vi.mocked(createAdminClient).mockReturnValue(dbFalsoConError() as unknown as ReturnType<typeof createAdminClient>);

    const pedido = new Request(
      "https://www.bookea.lat/api/wallet/v1/devices/abc/registrations/pass.lat.bookea.afiliacion?passesUpdatedSince=2026-08-16T15:22:58.099512+00:00",
    );
    const respuesta = await GET(pedido, { params: Promise.resolve({ deviceId: "abc", passTypeId: "pass.lat.bookea.afiliacion" }) });

    // Antes de esta corrección, este mismo escenario devolvía 204
    // ("nada cambió") — la afirmación que el enunciado prohíbe hacer
    // cuando la consulta que la respaldaría en realidad falló.
    expect(respuesta.status).toBe(500);
    expect(respuesta.status).not.toBe(204);
  });
});
