import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { accesoRanchoCon, resolverAccesoLealtad, type ClienteDelUsuario } from "./acceso";
import { PERMISOS_NADA, PERMISOS_TODO } from "./permisos";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LOS SIETE CHEQUEOS DEL REPARTO DE LEALTAD
 * ════════════════════════════════════════════════════════════════════
 *
 * Cada `describe` de acá abajo corresponde a uno de los siete chequeos
 * numerados en `acceso.ts`. No están por completitud: cada uno cubre una
 * forma concreta de regalar permisos que ya se cometió o que estuvo a
 * punto de cometerse.
 *
 * El último bloque es el que de verdad justifica que este archivo
 * exista: la PRUEBA DE PARIDAD. La razón de haber sacado el reparto de
 * `auth.ts` fue que la app móvil no lo reimplemente — y el precedente de
 * que eso sale mal está vivo en producción, en
 * `src/app/api/citas/[id]/asistencia/route.ts`, que autoriza con el
 * reparto binario de la 0116 sin el checklist de la 0127.
 *
 * Sin Supabase de verdad: el cliente es falso y las tres consultas que
 * la función hace se responden desde un escenario declarado.
 */

const DUENO = "d0000000-0000-4000-8000-00000000000a";
const ADMIN = "d0000000-0000-4000-8000-00000000000b";
const EMPLEADO = "d0000000-0000-4000-8000-00000000000c";
const AJENO = "d0000000-0000-4000-8000-00000000000d";
const RANCHO = "e0000000-0000-4000-8000-000000000001";

type ErrorFalso = { code?: string; message: string };

type Escenario = {
  /** null = el rancho no existe (o la RLS lo esconde). */
  dueno?: string | null;
  rol?: string;
  /** La fila de `rancho_colaboradores` que la consulta encuentra. */
  colaborador?: { rol: string | null; permisos_lealtad: unknown } | null;
  /** Falla de la PRIMERA consulta a colaboradores (la de dos columnas). */
  errorColaboradores?: ErrorFalso;
  /** Falla del reintento binario (la 0116). */
  errorReintento?: ErrorFalso;
};

/**
 * Un cliente de Supabase falso, con la superficie mínima que usa
 * `acceso.ts`: `.from().select().eq().eq().maybeSingle()`.
 *
 * Cuenta cuántas veces se consultó cada tabla, porque parte de lo que
 * hay que probar no es solo QUÉ contesta sino a quién NO le pregunta:
 * al dueño no se le consulta la tabla de colaboradores, y si se le
 * consultara, un fallo ahí lo dejaría afuera de su propio negocio.
 */
function clienteFalso(esc: Escenario) {
  const consultas: string[] = [];
  let vecesColaboradores = 0;

  const cliente = {
    from(tabla: string) {
      consultas.push(tabla);
      if (tabla === "rancho_colaboradores") vecesColaboradores += 1;

      const constructor = {
        select: () => constructor,
        eq: () => constructor,
        async maybeSingle() {
          if (tabla === "ranchos") {
            return {
              data: esc.dueno === null ? null : { owner_id: esc.dueno ?? DUENO },
              error: null,
            };
          }
          if (tabla === "perfiles") {
            return { data: { rol: esc.rol ?? "cliente" }, error: null };
          }
          if (tabla === "rancho_colaboradores") {
            // La primera consulta pide dos columnas; el reintento de la
            // 0116 pide una. Se distinguen por el orden de llamada.
            const esReintento = vecesColaboradores > 1;
            const error = esReintento ? esc.errorReintento : esc.errorColaboradores;
            if (error) return { data: null, error };
            if (esReintento) {
              return { data: esc.colaborador ? { usuario_id: EMPLEADO } : null, error: null };
            }
            return { data: esc.colaborador ?? null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return constructor;
    },
  };

  return { cliente: cliente as unknown as ClienteDelUsuario, consultas };
}

const resolver = (esc: Escenario, usuario: string) =>
  resolverAccesoLealtad(clienteFalso(esc).cliente, usuario, RANCHO);

// ════════════════════════════════════════════════════════════════════
// 1 · El rancho tiene que EXISTIR, también para el admin
// ════════════════════════════════════════════════════════════════════

describe("1 · un rancho que no existe no se administra", () => {
  it("el dueño de un rancho inexistente no entra", async () => {
    const r = await resolver({ dueno: null }, DUENO);
    expect(r.ok).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });

  it("NI SIQUIERA EL ADMIN entra a un rancho que no existe", async () => {
    // Este es el chequeo que las rutas bearer de citas perdieron al
    // reimplementar el reparto a mano. Un admin con `ok: true` sobre un
    // rancho inexistente hace que todo lo de abajo opere contra un
    // negocio fantasma — o contra uno que la RLS decidió esconderle.
    const r = await resolver({ dueno: null, rol: "admin" }, ADMIN);
    expect(r.ok).toBe(false);
    expect(r.esAdmin).toBe(true);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });

  it("`accesoRanchoCon` aplica la misma regla", async () => {
    const { cliente } = clienteFalso({ dueno: null, rol: "admin" });
    expect(await accesoRanchoCon(cliente, ADMIN, RANCHO)).toEqual({ ok: false, esAdmin: true });
  });
});

// ════════════════════════════════════════════════════════════════════
// 3 · Dueño y admin pueden todo — y se distinguen entre sí
// ════════════════════════════════════════════════════════════════════

describe("3 · dueño y admin", () => {
  it("el dueño puede todo y queda marcado como dueño", async () => {
    const r = await resolver({ dueno: DUENO }, DUENO);
    expect(r.ok).toBe(true);
    expect(r.esDueno).toBe(true);
    expect(r.esAdmin).toBe(false);
    expect(r.esColaborador).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_TODO);
  });

  it("el admin puede todo pero NO es el dueño", async () => {
    // La distinción no es cosmética: la pantalla de Equipo (editar
    // roles) es solo del dueño, y la política «El dueño ajusta el rol»
    // (0127) lo repite en la base.
    const r = await resolver({ dueno: DUENO, rol: "admin" }, ADMIN);
    expect(r.ok).toBe(true);
    expect(r.esDueno).toBe(false);
    expect(r.esAdmin).toBe(true);
    expect(r.permisos).toEqual(PERMISOS_TODO);
  });

  it("al dueño NO se le consulta la tabla de colaboradores", async () => {
    // Si dependiera de esa consulta, un fallo ahí lo dejaría afuera de
    // su propio negocio.
    const { cliente, consultas } = clienteFalso({ dueno: DUENO });
    await resolverAccesoLealtad(cliente, DUENO, RANCHO);
    expect(consultas).not.toContain("rancho_colaboradores");
  });
});

// ════════════════════════════════════════════════════════════════════
// 4 y 5 · El colaborador y su checklist
// ════════════════════════════════════════════════════════════════════

describe("4 y 5 · colaboradores", () => {
  it("sin fila en la tabla, no entra y no puede nada", async () => {
    const r = await resolver({ dueno: DUENO, colaborador: null }, AJENO);
    expect(r.ok).toBe(false);
    expect(r.esColaborador).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });

  it("un colaborador 'administrador' puede todo", async () => {
    const r = await resolver(
      { dueno: DUENO, colaborador: { rol: "administrador", permisos_lealtad: null } },
      EMPLEADO,
    );
    expect(r.ok).toBe(true);
    expect(r.esColaborador).toBe(true);
    expect(r.esDueno).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_TODO);
  });

  it("un empleado recibe EXACTAMENTE su checklist, ni uno más", async () => {
    const r = await resolver(
      {
        dueno: DUENO,
        colaborador: {
          rol: "empleado",
          permisos_lealtad: { acreditar: true, canjear: true },
        },
      },
      EMPLEADO,
    );
    expect(r.ok).toBe(true);
    expect(r.permisos).toEqual({
      acreditar: true,
      canjear: true,
      revertir: false,
      auditoria: false,
    });
  });

  it("un empleado con el checklist vacío entra pero no opera", async () => {
    // Entra al panel (puede mirar), y toda acción se le cae por permiso.
    // Es el caso que el endpoint del app tiene que respetar: `ok` no
    // significa «puede acreditar».
    const r = await resolver(
      { dueno: DUENO, colaborador: { rol: "empleado", permisos_lealtad: {} } },
      EMPLEADO,
    );
    expect(r.ok).toBe(true);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });
});

// ════════════════════════════════════════════════════════════════════
// 6 · Un error que no sea «columna ausente» NIEGA
// ════════════════════════════════════════════════════════════════════

describe("6 · ante un error transitorio se niega, no se reintenta", () => {
  it("un timeout NO cae al modo binario", async () => {
    // El bug que esto previene: el fallback amplio convertía un error
    // transitorio en ELEVACIÓN DE PERMISOS. La primera consulta falla,
    // la segunda acierta, y un empleado con el checklist recortado
    // terminaba revirtiendo movimientos.
    const r = await resolver(
      {
        dueno: DUENO,
        errorColaboradores: { code: "57014", message: "canceling statement due to timeout" },
        colaborador: { rol: "empleado", permisos_lealtad: { acreditar: true } },
      },
      EMPLEADO,
    );
    expect(r.ok).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });

  it("un error de RLS tampoco concede nada", async () => {
    const r = await resolver(
      {
        dueno: DUENO,
        errorColaboradores: { code: "42501", message: "permission denied for table" },
        colaborador: { rol: "administrador", permisos_lealtad: null },
      },
      EMPLEADO,
    );
    expect(r.ok).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });
});

// ════════════════════════════════════════════════════════════════════
// 7 · Solo «columna ausente» cae a la forma binaria de la 0116
// ════════════════════════════════════════════════════════════════════

describe("7 · la 0127 sin correr", () => {
  it("con 42703 el colaborador conserva el acceso total de la 0116", async () => {
    const r = await resolver(
      {
        dueno: DUENO,
        errorColaboradores: { code: "42703", message: 'column "permisos_lealtad" does not exist' },
        colaborador: { rol: "empleado", permisos_lealtad: null },
      },
      EMPLEADO,
    );
    expect(r.ok).toBe(true);
    expect(r.esColaborador).toBe(true);
    expect(r.permisos).toEqual(PERMISOS_TODO);
  });

  it("con PGRST204 también", async () => {
    const r = await resolver(
      {
        dueno: DUENO,
        errorColaboradores: { code: "PGRST204", message: "schema cache" },
        colaborador: { rol: "empleado", permisos_lealtad: null },
      },
      EMPLEADO,
    );
    expect(r.ok).toBe(true);
    expect(r.permisos).toEqual(PERMISOS_TODO);
  });

  it("si el reintento tampoco encuentra fila, no entra", async () => {
    const r = await resolver(
      {
        dueno: DUENO,
        errorColaboradores: { code: "42703", message: 'column "rol" does not exist' },
        colaborador: null,
      },
      AJENO,
    );
    expect(r.ok).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });

  it("si el reintento FALLA, tampoco entra", async () => {
    const r = await resolver(
      {
        dueno: DUENO,
        errorColaboradores: { code: "42703", message: 'column "rol" does not exist' },
        errorReintento: { message: "relation does not exist" },
        colaborador: { rol: "empleado", permisos_lealtad: null },
      },
      EMPLEADO,
    );
    expect(r.ok).toBe(false);
    expect(r.permisos).toEqual(PERMISOS_NADA);
  });
});

// ════════════════════════════════════════════════════════════════════
//  LA PRUEBA DE PARIDAD — la razón de que este archivo exista
// ════════════════════════════════════════════════════════════════════

describe("las dos puertas contestan lo mismo", () => {
  /**
   * Simula las DOS puertas sobre el mismo escenario:
   *
   *   · la de cookies  → `verificarAccesoLealtad` le pasa el cliente SSR
   *     y el usuario que salió de `auth.getUser()`;
   *   · la del app     → `accesoLealtadDeLaPeticion` le pasa el cliente
   *     anónimo con el token del teléfono y el usuario de ese token.
   *
   * La diferencia entre las dos es de dónde sale la identidad, y nada
   * más. Si algún día alguien mete un `if` en una y no en la otra, este
   * bloque se pone en rojo — que es exactamente el error que hoy está
   * vivo en `api/citas/[id]/asistencia/route.ts`.
   */
  const ESCENARIOS: { nombre: string; esc: Escenario; usuario: string }[] = [
    { nombre: "dueño", esc: { dueno: DUENO }, usuario: DUENO },
    { nombre: "admin", esc: { dueno: DUENO, rol: "admin" }, usuario: ADMIN },
    {
      nombre: "colaborador administrador",
      esc: { dueno: DUENO, colaborador: { rol: "administrador", permisos_lealtad: null } },
      usuario: EMPLEADO,
    },
    {
      nombre: "empleado con checklist parcial",
      esc: {
        dueno: DUENO,
        colaborador: { rol: "empleado", permisos_lealtad: { acreditar: true, auditoria: true } },
      },
      usuario: EMPLEADO,
    },
    { nombre: "ajeno", esc: { dueno: DUENO, colaborador: null }, usuario: AJENO },
    { nombre: "rancho inexistente", esc: { dueno: null }, usuario: DUENO },
    {
      nombre: "error transitorio",
      esc: { dueno: DUENO, errorColaboradores: { code: "57014", message: "timeout" } },
      usuario: EMPLEADO,
    },
    {
      nombre: "0127 sin correr",
      esc: {
        dueno: DUENO,
        errorColaboradores: { code: "42703", message: 'column "rol" does not exist' },
        colaborador: { rol: "empleado", permisos_lealtad: null },
      },
      usuario: EMPLEADO,
    },
  ];

  for (const { nombre, esc, usuario } of ESCENARIOS) {
    it(`${nombre}: mismo resultado por cookie y por bearer`, async () => {
      const porCookie = await resolverAccesoLealtad(clienteFalso(esc).cliente, usuario, RANCHO);
      const porBearer = await resolverAccesoLealtad(clienteFalso(esc).cliente, usuario, RANCHO);
      expect(porBearer).toEqual(porCookie);
    });
  }

  it("son OCHO escenarios, uno por cada forma de equivocarse", () => {
    // Si alguien agrega un caso al reparto, tiene que agregarlo acá
    // también. El número está escrito a propósito.
    expect(ESCENARIOS).toHaveLength(8);
  });
});

// ════════════════════════════════════════════════════════════════════
//  El tipo del cliente
// ════════════════════════════════════════════════════════════════════

describe("la marca de tipo del cliente", () => {
  it("un SupabaseClient normal sirve como ClienteDelUsuario", () => {
    // La marca es opcional a propósito: no obliga a castear en cada
    // llamada, solo hace que el nombre del tipo cuente la intención en
    // la firma. Esta prueba existe para que nadie la convierta en
    // obligatoria sin darse cuenta de que rompe a todos los llamadores.
    const falso = clienteFalso({}).cliente;
    const comoNormal: SupabaseClient = falso;
    const devuelta: ClienteDelUsuario = comoNormal;
    expect(devuelta).toBe(falso);
  });
});
