import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERMISOS_NADA, PERMISOS_TODO } from "@/lib/lealtad/permisos";
import { definicionDe } from "@/lib/lealtad/planes";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL NÚCLEO COMPARTIDO — un caso por cada cosa que la puerta NO cuida
 * ════════════════════════════════════════════════════════════════════
 *
 * `app-movil/puerta.test.ts` ya prueba quién entra. Esto prueba lo otro:
 * qué puede hacer una vez adentro. Son dos cosas distintas y por eso hay
 * dos suites — la puerta no sabe de qué negocio es un miembro, y el
 * núcleo no sabe si el token estaba vencido.
 *
 * Cada `it` de acá cierra un agujero que, abierto, mueve saldo o afilia
 * gente de verdad:
 *
 *   · la MISMA operación reintentada no puede entregar dos premios;
 *   · un miembro de otro negocio no se toca;
 *   · una recompensa de otra tarjeta no se canjea;
 *   · y el cupo del paquete se comprueba ANTES del RPC de alta, para
 *     que el endpoint del teléfono no sea la puerta de atrás del cobro.
 *
 * ── NADA DE ESTO TOCA LA BASE ───────────────────────────────────────
 *
 * La base de mentira ANOTA lo que se le pide. Lo que se prueba es el
 * ORDEN y la CONDICIÓN — «se rechazó ANTES de llamar al RPC» es una
 * afirmación sobre la secuencia, no sobre SQL.
 */

// ── Lo que se sustituye, y por qué cada cosa ────────────────────────

vi.mock("next/server", () => ({
  // El `after` de verdad necesita el contexto de una petición de Next.
  // Acá se ejecuta de una: lo que importa es QUE se ejecute — es lo que
  // mantiene viva la lambda mientras sale el aviso al Wallet.
  after: (fn: () => unknown) => {
    llamadas.push("after");
    return fn();
  },
}));

vi.mock("@/lib/wallet/servicio", () => ({
  avisarCambioDePase: vi.fn(async (id: string) => {
    llamadas.push(`avisar:${id}`);
  }),
}));

// El conteo del cupo y el plan de la cuenta van a la base de verdad y
// tienen sus propias suites (`cupo.test.ts`, `cuenta.test.ts`). Acá lo
// que se prueba es qué hace `afiliarCore` CON ese número.
vi.mock("@/lib/lealtad/cupo", () => ({
  personasActivasDe: async () => {
    llamadas.push("contar-cupo");
    return personasActivas;
  },
}));

vi.mock("@/lib/lealtad/cuenta", () => ({
  contextoDeCuenta: async () => ({ cuentaId: "cta-1", plan: planDelNegocio }),
}));

// Parcial a propósito: `revisarAlta` es pura y se prueba DE VERDAD acá
// (un WhatsApp mal escrito tiene que rebotar igual desde el teléfono).
// Lo único que se sustituye es la consulta que busca dueños del
// contacto, que sí va a la base.
vi.mock("@/lib/lealtad/personas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lealtad/personas")>()),
  duenosDelContacto: async () => {
    llamadas.push("duenos-del-contacto");
    return { porCorreo: null, porTelefono: null, confiable: true };
  },
}));

// La resolución de identidad tiene su propia suite. Acá lo que importa
// es CON QUÉ programas se la llama —ese es el filtro de tenencia— y qué
// hace el núcleo con lo que devuelve.
vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: async (_db: unknown, filtro: { programaIds?: string[] }) => {
    programasConsultados = filtro.programaIds ?? [];
    return miembrosDelNegocio;
  },
  identidadesDeMiembros: async () =>
    new Map(miembrosDelNegocio.map((m) => [m.id, identidades[m.id]])),
}));

const { afiliarCore, buscarClientesCore, canjearCore } = await import("./operar-core");

// ── El escenario ───────────────────────────────────────────────────

const RANCHO = "r-1";
const OTRO_RANCHO = "r-2";
const MIEMBRO = "m-1";
const PROGRAMA = "pg-1";
const OTRO_PROGRAMA = "pg-2";
const RECOMPENSA = "rc-1";

const QUIEN_PUEDE_TODO = { usuarioId: "u-1", permisos: PERMISOS_TODO };

/** Todo lo que se le pidió a la base, en orden. Es la prueba de «antes de». */
let llamadas: string[] = [];
/** Las filas escritas, por tabla. */
let inserciones: { tabla: string; fila: Record<string, unknown> }[] = [];

/** El `rancho_id` de la tarjeta del miembro. Distinto = miembro ajeno. */
let ranchoDelPrograma = RANCHO;
/** De qué programa es la recompensa. Distinto = premio de otra tarjeta. */
let programaDeLaRecompensa = PROGRAMA;
/**
 * Las referencias de canje ya escritas. Es el índice único
 * `canjes_referencia_unica` (0125:207) hecho Set: el RPC rebota la
 * segunda con «ya-canjeado», exactamente como en producción.
 */
let referenciasUsadas: Set<string> = new Set();

let personasActivas = 0;
let planDelNegocio: string | null = "impulso";

type FilaMiembro = {
  id: string;
  cliente_id: string | null;
  persona_id: string | null;
  estado: string;
  created_at: string;
};
let miembrosDelNegocio: FilaMiembro[] = [];
let identidades: Record<
  string,
  { nombre: string | null; correo: string | null; telefono: string | null }
> = {};
let programasConsultados: string[] = [];

/** La fila de `programa_lealtad` que ve `revisarReglas`: activa y sin reglas. */
const programaActivo = () => ({
  id: PROGRAMA,
  rancho_id: ranchoDelPrograma,
  estado: "activo",
  activo: true,
  modo: "sellos",
  beneficio: null,
});

type Respuesta = { data: unknown; count?: number; error: null };

/**
 * Qué contesta cada tabla.
 *
 * El `forma` no es un detalle del mock: el cliente de Supabase devuelve
 * UNA fila cuando la consulta termina en `.maybeSingle()` y una LISTA
 * cuando se la espera entera, y el núcleo usa las dos formas sobre las
 * MISMAS tablas (`programa_lealtad` se lee de a una para comprobar
 * tenencia y de a muchas para buscar clientes). Una base de mentira que
 * contestara siempre igual haría pasar código que en producción revienta.
 */
function respuestaDe(tabla: string, forma: "uno" | "lista"): Respuesta {
  if (tabla === "miembros") {
    return forma === "uno"
      ? { data: { id: MIEMBRO, programa_id: PROGRAMA }, error: null }
      : { data: [{ id: MIEMBRO }], error: null };
  }
  if (tabla === "programa_lealtad") {
    return forma === "uno"
      ? { data: programaActivo(), error: null }
      : { data: [{ id: PROGRAMA }], error: null };
  }
  if (tabla === "recompensas") {
    return forma === "uno"
      ? { data: { programa_id: programaDeLaRecompensa, costo_puntos: 5 }, error: null }
      : { data: [], error: null };
  }
  if (tabla === "canjes") return { data: [], count: 0, error: null };
  if (tabla === "ranchos") {
    return { data: { nombre: "Pura Matcha", plan_lealtad: planDelNegocio }, error: null };
  }
  if (tabla === "transacciones_puntos") {
    return { data: [{ miembro_id: MIEMBRO, puntos: 3 }], error: null };
  }
  if (tabla === "pases_wallet") return { data: [{ miembro_id: MIEMBRO }], error: null };
  return { data: [], error: null };
}

/**
 * Una consulta encadenable que resuelve igual si se la `await`ea entera
 * (`.in(...)`) o si termina en `.maybeSingle()`. El núcleo la usa de las
 * dos formas y las dos tienen que funcionar.
 */
function consulta(tabla: string) {
  const q = {
    select: () => q,
    eq: () => q,
    neq: () => q,
    in: () => q,
    maybeSingle: async () => respuestaDe(tabla, "uno"),
    insert: (fila: Record<string, unknown>) => {
      llamadas.push(`insert:${tabla}`);
      inserciones.push({ tabla, fila });
      return Promise.resolve({ error: null });
    },
    then: (ok: (v: Respuesta) => unknown, falla?: (e: unknown) => unknown) =>
      Promise.resolve(respuestaDe(tabla, "lista")).then(ok, falla),
  };
  return q;
}

const db = {
  from(tabla: string) {
    llamadas.push(`from:${tabla}`);
    return consulta(tabla);
  },
  async rpc(nombre: string, args: Record<string, unknown>) {
    llamadas.push(`rpc:${nombre}`);

    if (nombre === "canjear_recompensa") {
      const referencia = args.p_referencia as string;
      // El índice único, simulado. Segunda vez con la MISMA referencia:
      // no escribe y devuelve el código de máquina del RPC.
      if (referenciasUsadas.has(referencia)) {
        return { data: { ok: false, motivo: "ya-canjeado" }, error: null };
      }
      referenciasUsadas.add(referencia);
      return {
        data: {
          ok: true,
          canje_id: `cj-${referenciasUsadas.size}`,
          saldo: 0,
          recompensa: "Café gratis",
          sku: null,
          instrucciones: "Entregalo en barra",
        },
        error: null,
      };
    }

    if (nombre === "alta_persona_por_mostrador") {
      return { data: { estado: "listo", miembro_id: "m-nuevo" }, error: null };
    }

    return { data: null, error: null };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const DATOS_ALTA = {
  nombre: "Melissa Hernández",
  whatsapp: "7011 2233",
  correo: "melissa@ejemplo.cr",
  aceptaPromos: true,
};

beforeEach(() => {
  llamadas = [];
  inserciones = [];
  ranchoDelPrograma = RANCHO;
  programaDeLaRecompensa = PROGRAMA;
  referenciasUsadas = new Set();
  personasActivas = 0;
  planDelNegocio = "impulso";
  miembrosDelNegocio = [];
  identidades = {};
  programasConsultados = [];
});

const canjear = (referencia: string, quien = QUIEN_PUEDE_TODO) =>
  canjearCore({
    db,
    ranchoId: RANCHO,
    quien,
    miembroId: MIEMBRO,
    recompensaId: RECOMPENSA,
    referencia,
  });

// ════════════════════════════════════════════════════════════════════

describe("canjear · la misma operación, dos veces", () => {
  /**
   * La referencia que arma el endpoint del app. Se escribe igual acá a
   * propósito: lo que se está fijando es que DOS TOQUES con el mismo
   * `intentoId` produzcan la misma llave. Con la llave del panel web
   * —que lleva el minuto de CALENDARIO— dos toques a las 14:28:59 y a
   * las 14:29:01 caen en minutos distintos y entregan DOS premios.
   */
  const referenciaDelApp = `canje:${MIEMBRO}:${RECOMPENSA}:intento-a1b2c3d4`;

  it("el segundo intento NO escribe un segundo canje", async () => {
    const primero = await canjear(referenciaDelApp);
    const segundo = await canjear(referenciaDelApp);

    expect(primero.ok).toBe(true);
    expect(segundo.ok).toBe(false);
    // UNO. Es el número que importa: un premio entregado, un débito.
    expect(referenciasUsadas.size).toBe(1);
  });

  it("y al cliente no se le lee «ya-canjeado» en voz alta", async () => {
    await canjear(referenciaDelApp);
    const segundo = await canjear(referenciaDelApp);
    // `ya-canjeado` es un código de máquina del RPC. El empleado lo
    // leía tal cual delante del cliente.
    if (!segundo.ok) expect(segundo.motivo).not.toContain("ya-canjeado");
  });

  it("el evento para el POS y el aviso al Wallet salen UNA sola vez", async () => {
    await canjear(referenciaDelApp);
    llamadas = [];
    inserciones = [];

    await canjear(referenciaDelApp);

    // El segundo intento no entregó nada: ni evento de integración ni
    // aviso al teléfono. Avisar de un canje que no ocurrió haría que la
    // tarjeta se redibujara sin motivo.
    expect(inserciones.filter((i) => i.tabla === "eventos_integracion")).toHaveLength(0);
    expect(llamadas.filter((l) => l.startsWith("avisar:"))).toHaveLength(0);
  });

  it("un intento DISTINTO sí es una operación nueva", async () => {
    // La idempotencia es por intento, no por minuto: dos ventas de
    // verdad en el mismo segundo tienen que pasar las dos.
    await canjear(`canje:${MIEMBRO}:${RECOMPENSA}:intento-aaaaaaaa`);
    const otra = await canjear(`canje:${MIEMBRO}:${RECOMPENSA}:intento-bbbbbbbb`);
    expect(otra.ok).toBe(true);
    expect(referenciasUsadas.size).toBe(2);
  });
});

describe("canjear · lo que no es de este negocio", () => {
  it("un miembro de otro rancho se rechaza SIN llamar al RPC", async () => {
    // El `miembroId` llega de fuera —del navegador o del teléfono— y de
    // ahí para abajo todo corre con la llave de servicio. Sin este
    // filtro, un dueño con dos negocios canjea el premio caro de B
    // contra el saldo de A.
    ranchoDelPrograma = OTRO_RANCHO;

    const r = await canjear("canje:x");

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("miembro_ajeno");
    expect(llamadas).not.toContain("rpc:canjear_recompensa");
  });

  it("una recompensa de otro programa se rechaza SIN llamar al RPC", async () => {
    // La base ya lo frenaba (0125:461), así que esto no era plata que
    // se fuera. Lo que faltaba era la capa de afuera: `revisarReglas`
    // leía el costo de una recompensa ajena y la constancia del intento
    // escribía su id en la auditoría de ESTE negocio.
    programaDeLaRecompensa = OTRO_PROGRAMA;

    const r = await canjear("canje:x");

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("recompensa_ajena");
    expect(llamadas).not.toContain("rpc:canjear_recompensa");
    // Y tampoco quedó anotado el intento con el id ajeno.
    expect(inserciones.filter((i) => i.tabla === "intentos_canje")).toHaveLength(0);
  });

  it("el mensaje no delata si la recompensa existe fuera de acá", async () => {
    programaDeLaRecompensa = OTRO_PROGRAMA;
    const r = await canjear("canje:x");
    if (!r.ok) expect(r.motivo).toBe("Ese premio no es de esta tarjeta.");
  });
});

describe("canjear · el permiso", () => {
  it("`canjear` y NO `acreditar`: son distintos en el checklist de la 0127", async () => {
    const soloSella = { usuarioId: "u-2", permisos: { ...PERMISOS_NADA, acreditar: true } };

    const r = await canjear("canje:x", soloSella);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("sin_permiso");
    // Ni una consulta: el rechazo es antes de tocar la base.
    expect(llamadas).toHaveLength(0);
  });
});

describe("afiliar · el tope del paquete", () => {
  const afiliar = (quien = QUIEN_PUEDE_TODO) =>
    afiliarCore({ db, ranchoId: RANCHO, quien, programaId: PROGRAMA, datos: DATOS_ALTA });

  /**
   * Deja el negocio EXACTAMENTE en su techo.
   *
   * El número sale del catálogo y no está escrito a mano acá a
   * propósito: lo que se prueba es la comparación `usadas >= limite`, y
   * si el dueño sube el cupo de un paquete la prueba tiene que seguir
   * probando lo mismo, no romperse por una cifra.
   */
  function llenarElCupo() {
    planDelNegocio = "arranque";
    personasActivas = definicionDe(planDelNegocio)?.limites.clientesActivos ?? 0;
  }

  it("con el cupo lleno NO se llama al RPC de alta", async () => {
    // ESTA es la prueba que justifica que el tope viva en el núcleo y no
    // en el server action del panel: si se quedaba allá, el endpoint del
    // teléfono afiliaba sin techo y el paquete que se cobra por cantidad
    // de clientes dejaba de tener sentido.
    llenarElCupo();

    const r = await afiliar();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("cupo_agotado");
    expect(llamadas).toContain("contar-cupo");
    expect(llamadas).not.toContain("rpc:alta_persona_por_mostrador");
  });

  it("el código es EXACTAMENTE `cupo_agotado` — es contrato con la app", async () => {
    // `motivoParaMovil()` traduce por CÓDIGO, no por substring. Si acá
    // se renombra, el motivo real —que dice «Escribile a Bookea para
    // subir de plan»— viaja crudo al binario de iOS y la regla 3.1.1 lo
    // rebota. El motivo de la web sigue diciendo lo útil.
    llenarElCupo();

    const r = await afiliar();

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.codigo).toBe("cupo_agotado");
      expect(r.motivo).toMatch(/plan/i);
    }
  });

  it("con cupo disponible el alta pasa", async () => {
    personasActivas = 3;
    const r = await afiliar();
    expect(r.ok).toBe(true);
    expect(llamadas).toContain("rpc:alta_persona_por_mostrador");
  });

  it("un paquete sin tope no cuenta nada", async () => {
    // `ilimitado` tiene `clientesActivos: null`. Contar por gusto sería
    // una consulta cara en cada alta de quien ya pagó por no tener tope.
    planDelNegocio = "ilimitado";
    const r = await afiliar();
    expect(r.ok).toBe(true);
    expect(llamadas).not.toContain("contar-cupo");
  });

  it("un programa de otro negocio no se toca, y no se cuenta cupo ajeno", async () => {
    ranchoDelPrograma = OTRO_RANCHO;
    const r = await afiliar();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("programa_ajeno");
    expect(llamadas).not.toContain("rpc:alta_persona_por_mostrador");
  });

  it("sin permiso `acreditar` no se afilia a nadie", async () => {
    const soloCanjea = { usuarioId: "u-3", permisos: { ...PERMISOS_NADA, canjear: true } };
    const r = await afiliar(soloCanjea);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("sin_permiso");
    expect(llamadas).toHaveLength(0);
  });

  it("los datos se validan con la MISMA función que la web", async () => {
    // `revisarAlta` es la de verdad en esta suite (mock parcial). Un
    // WhatsApp de cuatro dígitos rebota acá igual que en el panel: dos
    // validaciones distintas es cómo se llega a que el teléfono acepte
    // lo que la web rechaza.
    const r = await afiliarCore({
      db,
      ranchoId: RANCHO,
      quien: QUIEN_PUEDE_TODO,
      programaId: PROGRAMA,
      datos: { ...DATOS_ALTA, correo: "", whatsapp: "7011" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("datos_invalidos");
    expect(llamadas).not.toContain("rpc:alta_persona_por_mostrador");
  });
});

describe("buscar clientes · la tenencia y el tope", () => {
  const buscar = (texto: string, quien = QUIEN_PUEDE_TODO) =>
    buscarClientesCore({ db, ranchoId: RANCHO, quien, texto });

  const miembro = (id: string): FilaMiembro => ({
    id,
    cliente_id: null,
    persona_id: `p-${id}`,
    estado: "activa",
    created_at: "2026-08-01T00:00:00.000Z",
  });

  it("solo se buscan miembros de los programas de ESTE negocio", async () => {
    miembrosDelNegocio = [miembro(MIEMBRO)];
    identidades = { [MIEMBRO]: { nombre: "Melissa", correo: null, telefono: null } };

    await buscar("mel");

    // El filtro por tenencia va en la consulta, no después: ningún
    // nombre de otro negocio llega a materializarse en memoria.
    expect(programasConsultados).toEqual([PROGRAMA]);
  });

  it("con menos de dos letras no se consulta nada", async () => {
    const r = await buscar("m");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("busqueda_corta");
    expect(llamadas).toHaveLength(0);
  });

  it("encuentra sin tildes: en la caja nadie escribe «Hernández»", async () => {
    miembrosDelNegocio = [miembro(MIEMBRO)];
    identidades = { [MIEMBRO]: { nombre: "Melissa Hernández", correo: null, telefono: null } };

    const r = await buscar("hernandez");

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clientes).toHaveLength(1);
  });

  it("el tope de 20 lo pone el servidor, no el que pregunta", async () => {
    // No hay parámetro `limite` en ninguna de las dos puertas: dejarlo
    // negociar convertiría el buscador en una descarga de la libreta de
    // clientes, y esta respuesta lleva correos y teléfonos reales.
    miembrosDelNegocio = Array.from({ length: 40 }, (_, i) => miembro(`m-${i}`));
    identidades = Object.fromEntries(
      miembrosDelNegocio.map((m) => [m.id, { nombre: `Melissa ${m.id}`, correo: null, telefono: null }]),
    );

    const r = await buscar("melissa");

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clientes).toHaveLength(20);
  });

  it("la ficha vacía no entra por su texto", async () => {
    // Buscar «cliente» no puede devolver a todos los anónimos del
    // negocio: el título de una ficha sin datos es «Cliente sin datos».
    miembrosDelNegocio = [miembro(MIEMBRO)];
    identidades = { [MIEMBRO]: { nombre: null, correo: null, telefono: null } };

    const r = await buscar("cliente");

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.clientes).toHaveLength(0);
  });

  it("sin permiso `acreditar` no se lee la lista de clientes", async () => {
    const soloCanjea = { usuarioId: "u-4", permisos: { ...PERMISOS_NADA, canjear: true } };
    const r = await buscar("melissa", soloCanjea);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("sin_permiso");
    expect(llamadas).toHaveLength(0);
  });
});
