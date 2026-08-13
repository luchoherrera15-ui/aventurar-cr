import { describe, expect, it } from "vitest";
import { personasActivasDe } from "./cupo";

/**
 * EL BUG QUE ESTAS PRUEBAS CIERRAN
 *
 * `generar.ts` y `google.ts` contaban el cupo así:
 *
 *     select count(*) from miembros where programa_id = <la tarjeta>
 *
 * o sea POR TARJETA, contando FILAS y con TODOS los estados. Con eso,
 * un paquete de 200 y dos tarjetas afiliaba 400; dos pases de la misma
 * señora gastaban dos lugares; y una membresía cancelada seguía
 * ocupando el suyo.
 *
 * Acá se prueba lo contrario de las tres cosas, con y sin la 0142
 * pegada — porque las migraciones las pega el dueño a mano y el código
 * tiene que servir en las dos bases.
 */

type FilaMiembro = {
  id: string;
  programa_id: string;
  persona_id?: string | null;
  estado: string;
};

type FilaPrograma = { id: string; cuenta_id: string | null; rancho_id: string | null };

type Mundo = {
  /** Funciones de la 0142 que la base tiene. Ausente = todavía no está. */
  rpc?: Record<string, number>;
  programas?: FilaPrograma[];
  miembros?: FilaMiembro[];
  /** Base sin la 0138: `miembros.persona_id` no existe. */
  sinPersonaId?: boolean;
};

/** Un doble del cliente admin con solo lo que `cupo.ts` usa. */
function dbFalso(mundo: Mundo) {
  const llamadas: string[] = [];

  function consulta(tabla: string) {
    const filtros: Record<string, string> = {};
    let columnas = "";
    let cabeza = false;
    let dentro: string[] = [];
    let desde = 0;
    let hasta = Number.MAX_SAFE_INTEGER;

    function resolver() {
      if (tabla === "programa_lealtad") {
        llamadas.push(`programas:${Object.keys(filtros).join(",")}`);
        const filas = (mundo.programas ?? []).filter((p) =>
          Object.entries(filtros).every(
            ([col, val]) => (col === "cuenta_id" ? p.cuenta_id : p.rancho_id) === val,
          ),
        );
        return { data: filas.map((p) => ({ id: p.id })), error: null, count: filas.length };
      }

      if (columnas.includes("persona_id") && mundo.sinPersonaId) {
        llamadas.push("miembros:sin-persona");
        return {
          data: null,
          count: null,
          error: { message: 'column miembros.persona_id does not exist', code: "42703" },
        };
      }

      const filas = (mundo.miembros ?? []).filter(
        (m) =>
          dentro.includes(m.programa_id) &&
          (filtros.estado === undefined || m.estado === filtros.estado),
      );
      if (cabeza) {
        llamadas.push("miembros:count");
        return { data: null, count: filas.length, error: null };
      }
      llamadas.push(`miembros:${desde}-${hasta}`);
      return { data: filas.slice(desde, hasta + 1), count: filas.length, error: null };
    }

    const enc = {
      select(cols: string, opciones?: { count?: string; head?: boolean }) {
        columnas = cols;
        cabeza = opciones?.head === true;
        return enc;
      },
      eq(col: string, val: string) {
        filtros[col] = val;
        return enc;
      },
      in(_col: string, vals: string[]) {
        dentro = vals;
        return enc;
      },
      range(a: number, b: number) {
        desde = a;
        hasta = b;
        return enc;
      },
      then<T>(ok: (v: ReturnType<typeof resolver>) => T) {
        return Promise.resolve(resolver()).then(ok);
      },
    };
    return enc;
  }

  const db = {
    from: (tabla: string) => consulta(tabla),
    async rpc(nombre: string, _args: Record<string, string>) {
      llamadas.push(`rpc:${nombre}`);
      const valor = mundo.rpc?.[nombre];
      if (valor === undefined) {
        return { data: null, error: { message: `function ${nombre} does not exist` } };
      }
      return { data: valor, error: null };
    },
  };

  // El doble implementa solo lo que se usa; el cast lo declara.
  return { db: db as never, llamadas };
}

/** N miembros activos repartidos en una tarjeta, uno por persona. */
function miembrosDe(programa: string, cuantos: number, desde = 0): FilaMiembro[] {
  return Array.from({ length: cuantos }, (_, i) => ({
    id: `m-${programa}-${i}`,
    programa_id: programa,
    persona_id: `per-${desde + i}`,
    estado: "activa",
  }));
}

const DOS_TARJETAS: FilaPrograma[] = [
  { id: "p-1", cuenta_id: "c-1", rancho_id: "r-1" },
  { id: "p-2", cuenta_id: "c-1", rancho_id: "r-1" },
];

describe("con la 0142 pegada", () => {
  it("le pregunta a la base y devuelve su número", async () => {
    const { db, llamadas } = dbFalso({ rpc: { personas_activas_de_la_cuenta: 42 } });
    expect(await personasActivasDe(db, { cuentaId: "c-1" })).toBe(42);
    expect(llamadas).toContain("rpc:personas_activas_de_la_cuenta");
  });

  it("se queda con el MAYOR de los dos conteos", async () => {
    // La 0134 se corrió en dos tiempos: puede haber tarjetas del negocio
    // sin `cuenta_id`, y esas el conteo por cuenta no las ve. Quedarse
    // con el menor sería regalar cupo.
    const { db } = dbFalso({
      rpc: { personas_activas_de_la_cuenta: 10, personas_activas_del_negocio: 13 },
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1", ranchoId: "r-1" })).toBe(13);
  });

  it("con solo una de las dos funciones, usa la que hay", async () => {
    const { db } = dbFalso({ rpc: { personas_activas_del_negocio: 7 } });
    expect(await personasActivasDe(db, { cuentaId: "c-1", ranchoId: "r-1" })).toBe(7);
  });
});

describe("sin la 0142 (la ventana entre desplegar y pegar)", () => {
  it("cuenta POR CUENTA y no por tarjeta — el bug que esto cierra", async () => {
    // 120 en una tarjeta y 90 en la otra. El código viejo comparaba el
    // tope contra 120 y dejaba entrar a todo el mundo; el bueno dice 210.
    const { db } = dbFalso({
      programas: DOS_TARJETAS,
      miembros: [...miembrosDe("p-1", 120), ...miembrosDe("p-2", 90, 120)],
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1", ranchoId: "r-1" })).toBe(210);
  });

  it("varias tarjetas de la misma persona son UN cliente", async () => {
    // Es lo que planes.ts promete por escrito y lo que la 0138 rompió al
    // permitir el alta anónima: dos filas, una sola persona.
    const { db } = dbFalso({
      programas: DOS_TARJETAS,
      miembros: [
        { id: "m-1", programa_id: "p-1", persona_id: "ana", estado: "activa" },
        { id: "m-2", programa_id: "p-2", persona_id: "ana", estado: "activa" },
        { id: "m-3", programa_id: "p-1", persona_id: "beto", estado: "activa" },
      ],
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1" })).toBe(2);
  });

  it("las pausadas y las canceladas no ocupan lugar", async () => {
    const { db } = dbFalso({
      programas: DOS_TARJETAS,
      miembros: [
        { id: "m-1", programa_id: "p-1", persona_id: "ana", estado: "activa" },
        { id: "m-2", programa_id: "p-1", persona_id: "beto", estado: "pausada" },
        { id: "m-3", programa_id: "p-1", persona_id: "caro", estado: "cancelada" },
      ],
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1" })).toBe(1);
  });

  it("una fila sin persona cuenta como una persona, no como cero", async () => {
    // El backfill de la 0138 pudo dejar filas sin `persona_id` (la
    // columna quedó nullable en ese caso). Ignorarlas mostraría al
    // negocio más vacío de lo que está, o sea cupo regalado.
    const { db } = dbFalso({
      programas: DOS_TARJETAS,
      miembros: [
        { id: "m-1", programa_id: "p-1", persona_id: null, estado: "activa" },
        { id: "m-2", programa_id: "p-1", persona_id: null, estado: "activa" },
      ],
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1" })).toBe(2);
  });

  it("pasa de las 1.000 filas que corta PostgREST", async () => {
    // Sin paginar, un paquete de 1.150 se vería para siempre en 1.000 y
    // nunca llegaría a llenarse.
    const { db } = dbFalso({
      programas: DOS_TARJETAS,
      miembros: miembrosDe("p-1", 1_500),
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1" })).toBe(1_500);
  });

  it("sin la 0138 tampoco revienta: cuenta filas, como antes", async () => {
    const { db, llamadas } = dbFalso({
      sinPersonaId: true,
      programas: DOS_TARJETAS,
      miembros: [
        { id: "m-1", programa_id: "p-1", estado: "activa" },
        { id: "m-2", programa_id: "p-2", estado: "activa" },
        { id: "m-3", programa_id: "p-2", estado: "cancelada" },
      ],
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1" })).toBe(2);
    expect(llamadas).toContain("miembros:count");
  });

  it("une las tarjetas colgadas de la cuenta con las colgadas del rancho", async () => {
    // La 0134 se corrió a medias: una tarjeta migró y la otra no. Buscar
    // por un solo lado dejaría gente afuera del conteo.
    const { db } = dbFalso({
      programas: [
        { id: "p-1", cuenta_id: "c-1", rancho_id: "r-1" },
        { id: "p-2", cuenta_id: null, rancho_id: "r-1" },
      ],
      miembros: [...miembrosDe("p-1", 3), ...miembrosDe("p-2", 4, 3)],
    });
    expect(await personasActivasDe(db, { cuentaId: "c-1", ranchoId: "r-1" })).toBe(7);
  });

  it("un negocio sin tarjetas no consulta miembros y da 0", async () => {
    const { db, llamadas } = dbFalso({ programas: [] });
    expect(await personasActivasDe(db, { cuentaId: "c-1", ranchoId: "r-1" })).toBe(0);
    expect(llamadas.some((l) => l.startsWith("miembros"))).toBe(false);
  });

  it("sin cuenta ni rancho no inventa un número", async () => {
    const { db } = dbFalso({ miembros: miembrosDe("p-1", 50) });
    expect(await personasActivasDe(db, {})).toBe(0);
  });
});
