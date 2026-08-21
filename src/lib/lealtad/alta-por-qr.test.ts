import { describe, expect, it } from "vitest";
import { altaPorQr, textoConsentimientoNegocio } from "./personas";

/**
 * EL ALTA POR QR, CONTRA UNA BASE DE MENTIRA.
 *
 * Lo que estas pruebas cuidan no es la 0138 —eso lo prueba Postgres—
 * sino las TRES decisiones que se toman de este lado y que la base no
 * puede tomar por nosotros:
 *
 *   1. EL TOPE DEL PAQUETE. `alta_persona_por_qr` inserta en `miembros`
 *      directo y su propio comentario dice «el tope lo comprueba el
 *      servidor antes de llamar» (0138:2111). `cupo.ts:45` dejó el
 *      aviso escrito: el día que se conectara el alta por QR, si el
 *      llamador no pasaba por `personasActivasDe()`, el tope que se
 *      cobra se saltaba entero por la puerta del mostrador. Acá se
 *      comprueba que pasa — y que NO se le aplica a quien ya es
 *      miembro, porque si no el cliente 100 de un paquete lleno no
 *      podría ni volver a abrir su propia tarjeta.
 *
 *   2. LA PRUEBA DEL CONSENTIMIENTO. Que el texto que viaja a la base
 *      sea el mismo que se le muestra a la persona.
 *
 *   3. QUÉ LEE LA PERSONA en cada respuesta del RPC.
 */

type Mundo = {
  /** Lo que devuelve `alta_persona_por_qr`. */
  respuesta?: Record<string, unknown>;
  errorRpc?: { message: string; code?: string };
  /** Cuántas personas activas dice la 0142 que tiene la cuenta. */
  personasActivas?: number;
  plan?: string;
  /** Personas que ya existen, por contacto. */
  personas?: { id: string; correo?: string; telefono?: string; cliente_id?: string }[];
  /** Membresías ya existentes: persona_id del programa de la prueba. */
  miembros?: string[];
  /** La tabla de sesiones no existe (base sin la 0138). */
  sinSesiones?: boolean;
  /** `personas` no contesta: la base no sabe de quién es cada contacto. */
  personasRotas?: boolean;
  /** Lo que devuelve `alta_persona_local_por_qr` (0200). */
  respuestaLocal?: Record<string, unknown>;
  errorRpcLocal?: { message: string; code?: string };
};

type Registro = {
  rpc: { nombre: string; args: Record<string, unknown> }[];
  sesiones: Record<string, unknown>[];
};

const PROGRAMA = { id: "prog-1", cuenta_id: "cuenta-1", rancho_id: "rancho-1" };

function dbFalso(mundo: Mundo, registro: Registro) {
  function consulta(tabla: string) {
    const filtros: Record<string, string> = {};

    function filas(): Record<string, unknown>[] {
      if (tabla === "cuentas") return [{ plan: mundo.plan ?? "arranque" }];
      if (tabla === "personas") {
        const todas = mundo.personas ?? [];
        for (const col of ["cliente_id", "correo", "telefono"]) {
          if (filtros[col] !== undefined) {
            return todas.filter((p) => (p as Record<string, unknown>)[col] === filtros[col]);
          }
        }
        return [];
      }
      if (tabla === "miembros") {
        return (mundo.miembros ?? [])
          .filter((persona) => persona === filtros.persona_id)
          .map((persona) => ({ id: `miembro-${persona}` }));
      }
      return [];
    }

    const enc = {
      select() {
        return enc;
      },
      eq(col: string, val: string) {
        filtros[col] = val;
        return enc;
      },
      maybeSingle() {
        if (tabla === "personas" && mundo.personasRotas) {
          return Promise.resolve({
            data: null,
            error: { message: 'relation "personas" does not exist' },
          });
        }
        return Promise.resolve({ data: filas()[0] ?? null, error: null });
      },
    };
    return enc;
  }

  return {
    from(tabla: string) {
      if (tabla === "sesiones_persona") {
        return {
          insert(fila: Record<string, unknown>) {
            if (mundo.sinSesiones) {
              return Promise.resolve({
                error: { message: 'relation "sesiones_persona" does not exist' },
              });
            }
            registro.sesiones.push(fila);
            return Promise.resolve({ error: null });
          },
        };
      }
      return consulta(tabla);
    },
    rpc(nombre: string, args: Record<string, unknown>) {
      registro.rpc.push({ nombre, args });
      if (nombre === "personas_activas_de_la_cuenta") {
        return Promise.resolve({ data: mundo.personasActivas ?? 0, error: null });
      }
      if (nombre === "personas_activas_del_negocio") {
        return Promise.resolve({ data: mundo.personasActivas ?? 0, error: null });
      }
      if (nombre === "alta_persona_local_por_qr") {
        if (mundo.errorRpcLocal) return Promise.resolve({ data: null, error: mundo.errorRpcLocal });
        return Promise.resolve({
          data: mundo.respuestaLocal ?? {
            estado: "listo",
            persona_id: "persona-local",
            miembro_id: "miembro-local",
            miembro_nuevo: true,
            solo_contacto: true,
          },
          error: null,
        });
      }
      if (nombre === "alta_persona_por_qr") {
        if (mundo.errorRpc) return Promise.resolve({ data: null, error: mundo.errorRpc });
        return Promise.resolve({
          data: mundo.respuesta ?? {
            estado: "listo",
            persona_id: "persona-nueva",
            miembro_id: "miembro-nuevo",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "sin función" } });
    },
  };
}

// El doble implementa solo lo que `altaPorQr` usa; el cast es el mismo
// truco que `cupo.test.ts`, y es a un tipo concreto, nunca a `any`.
type Admin = Parameters<typeof altaPorQr>[0];

async function correrAlta(mundo: Mundo, extra: Partial<Parametros> = {}) {
  const registro: Registro = { rpc: [], sesiones: [] };
  const db = dbFalso(mundo, registro) as unknown as Admin;
  const resultado = await altaPorQr(db, {
    programa: PROGRAMA,
    ranchoId: "rancho-1",
    planRancho: null,
    nombreNegocio: "Silence Barber",
    contacto: { correo: "ana@ejemplo.com", telefono: "88888888" },
    nombre: "Ana",
    acepta: true,
    personaProbada: null,
    sesion: { clienteId: null, correo: null },
    ip: "190.7.1.20",
    userAgent: "Mozilla/5.0",
    ...extra,
  });
  return { resultado, registro };
}

/** Los argumentos con que se llamó al RPC del alta, si se llamó. */
function argsDelAlta(registro: Registro) {
  return registro.rpc.find((l) => l.nombre === "alta_persona_por_qr")?.args ?? null;
}

/** Los del alta LOCAL (0200), la que no reclama el contacto ajeno. */
function argsDelAltaLocal(registro: Registro) {
  return registro.rpc.find((l) => l.nombre === "alta_persona_local_por_qr")?.args ?? null;
}

type Parametros = Parameters<typeof altaPorQr>[1];

/**
 * LA PUERTA DEL SERVIDOR.
 *
 * Que el formulario tenga `required` no protege nada: `altaPorQr` es la
 * única función que llama al RPC que inserta, y le puede llegar un
 * `fetch` armado a mano. Estas pruebas son el contrato de que la
 * validación vive ACÁ y no en el navegador — sin ellas, quitar el
 * `revisarAlta` de adentro pasaría el `tsc`, el lint y el resto de la
 * suite sin que nada se ponga rojo.
 */
describe("altaPorQr — el mínimo se exige en el SERVIDOR", () => {
  it("sin nombre no se llama al RPC que inserta", async () => {
    const { resultado, registro } = await correrAlta({}, { nombre: "" });
    expect(resultado.estado).toBe("error");
    expect(registro.rpc.map((l) => l.nombre)).not.toContain("alta_persona_por_qr");
  });

  it("sin ningún contacto tampoco", async () => {
    const { resultado, registro } = await correrAlta(
      {},
      { contacto: { correo: null, telefono: null } },
    );
    expect(resultado.estado).toBe("error");
    expect(registro.rpc.map((l) => l.nombre)).not.toContain("alta_persona_por_qr");
  });

  it("con UN solo contacto sí pasa, y el otro viaja en null", async () => {
    const { resultado, registro } = await correrAlta(
      {},
      { contacto: { correo: null, telefono: "88888888" } },
    );
    expect(resultado.estado).toBe("listo");
    expect(argsDelAlta(registro)?.p_correo).toBeNull();
    expect(argsDelAlta(registro)?.p_telefono).toBe("88888888");
  });

  it("el nombre que viaja a la base es el LIMPIO, no el crudo", async () => {
    const { registro } = await correrAlta({}, { nombre: "  Ana   Ruiz  " });
    expect(argsDelAlta(registro)?.p_nombre).toBe("Ana Ruiz");
  });
});

describe("altaPorQr — el tope del paquete no se salta por esta puerta", () => {
  it("frena a alguien NUEVO cuando el paquete está lleno, sin tocar la base", async () => {
    // Arranque son 100 clientes activos.
    const { resultado, registro } = await correrAlta({ plan: "arranque", personasActivas: 100 });
    expect(resultado.estado).toBe("lleno");
    // Y lo importante: NO se llamó al RPC que inserta.
    expect(registro.rpc.map((l) => l.nombre)).not.toContain("alta_persona_por_qr");
  });

  it("deja pasar mientras haya lugar", async () => {
    const { resultado, registro } = await correrAlta({ plan: "arranque", personasActivas: 99 });
    expect(resultado.estado).toBe("listo");
    expect(registro.rpc.map((l) => l.nombre)).toContain("alta_persona_por_qr");
  });

  it("a QUIEN YA ES MIEMBRO no se le cobra un asiento otra vez", async () => {
    // El paquete está lleno, pero esta señora ya está adentro: si el
    // tope se le aplicara, no podría ni volver a abrir su tarjeta.
    const { resultado } = await correrAlta({
      plan: "arranque",
      personasActivas: 100,
      personas: [{ id: "persona-ana", correo: "ana@ejemplo.com" }],
      miembros: ["persona-ana"],
    });
    expect(resultado.estado).toBe("listo");
  });

  it("reconoce a la misma persona por el teléfono aunque el correo sea otro", async () => {
    const { resultado } = await correrAlta({
      plan: "arranque",
      personasActivas: 100,
      personas: [{ id: "persona-ana", telefono: "88888888" }],
      miembros: ["persona-ana"],
    });
    expect(resultado.estado).toBe("listo");
  });

  it("la cookie de este navegador también la identifica", async () => {
    const { resultado } = await correrAlta(
      { plan: "arranque", personasActivas: 100, miembros: ["persona-ana"] },
      { personaProbada: "persona-ana" },
    );
    expect(resultado.estado).toBe("listo");
  });

  it("una cuenta con sesión también cuenta como cliente ya conocido", async () => {
    const { resultado } = await correrAlta(
      {
        plan: "arranque",
        personasActivas: 100,
        personas: [{ id: "persona-ana", cliente_id: "cuenta-ana" }],
        miembros: ["persona-ana"],
      },
      { sesion: { clienteId: "cuenta-ana", correo: "otro@ejemplo.com" } },
    );
    expect(resultado.estado).toBe("listo");
  });

  it("un plan sin tope no consulta el cupo", async () => {
    const { resultado, registro } = await correrAlta({ plan: "ilimitado", personasActivas: 9999 });
    expect(resultado.estado).toBe("listo");
    expect(registro.rpc.map((l) => l.nombre)).not.toContain("personas_activas_de_la_cuenta");
  });
});

/**
 * EL PORTERO DE LA 0138 SE SALTA EN CUANTO LLEGA `p_persona_probada` o
 * `p_cliente_id` (0138:1964). O sea que mandar cualquiera de los dos a
 * la ligera lo desarma entero — y el portero es lo único que impide
 * que alguien reclame la tarjeta (con sus sellos) de otra persona
 * escribiendo su correo o su número.
 *
 * Cada prueba de acá es un intento de reclamo ajeno. Todas tienen que
 * terminar con el argumento en null: entonces la 0138 hace su trabajo
 * y responde `requiere_prueba`.
 */
describe("altaPorQr — las pruebas de posesión se validan contra el contacto", () => {
  const VICTIMA = [
    { id: "persona-victima", correo: "victima@ejemplo.com", telefono: "77777777" },
  ];

  it("la cookie vale cuando el contacto tecleado es de esa misma persona", async () => {
    // El caso honesto y frecuente: la misma señora, el mismo teléfono,
    // escaneando ahora el QR de otro negocio.
    const { registro } = await correrAlta(
      { personas: [{ id: "persona-ana", correo: "ana@ejemplo.com", telefono: "88888888" }] },
      { personaProbada: "persona-ana" },
    );
    expect(argsDelAlta(registro)!.p_persona_probada).toBe("persona-ana");
  });

  it("la cookie NO vale para reclamar el contacto de otra persona", async () => {
    const { registro } = await correrAlta(
      { personas: VICTIMA },
      {
        personaProbada: "persona-atacante",
        contacto: { correo: "victima@ejemplo.com", telefono: "77777777" },
      },
    );
    expect(argsDelAlta(registro)!.p_persona_probada).toBeNull();
  });

  it("tampoco vale si solo UNO de los dos datos es ajeno", async () => {
    const { registro } = await correrAlta(
      {
        personas: [
          { id: "persona-ana", correo: "ana@ejemplo.com" },
          { id: "persona-victima", telefono: "77777777" },
        ],
      },
      {
        personaProbada: "persona-ana",
        contacto: { correo: "ana@ejemplo.com", telefono: "77777777" },
      },
    );
    expect(argsDelAlta(registro)!.p_persona_probada).toBeNull();
  });

  it("la sesión prueba SU correo: con eso se le cuelga la cuenta a la persona", async () => {
    const { registro } = await correrAlta(
      { personas: [{ id: "persona-ana", correo: "ana@ejemplo.com", telefono: "88888888" }] },
      { sesion: { clienteId: "cuenta-ana", correo: "Ana@Ejemplo.com " } },
    );
    // El correo se compara normalizado, no carácter por carácter.
    expect(argsDelAlta(registro)!.p_cliente_id).toBe("cuenta-ana");
  });

  it("la sesión NO sirve para adoptar la fila de otro por su correo", async () => {
    const { registro } = await correrAlta(
      { personas: VICTIMA },
      {
        sesion: { clienteId: "cuenta-atacante", correo: "atacante@ejemplo.com" },
        contacto: { correo: "victima@ejemplo.com", telefono: "77777777" },
      },
    );
    expect(argsDelAlta(registro)!.p_cliente_id).toBeNull();
  });

  it("ni por su TELÉFONO, aunque el correo tecleado sí sea el suyo", async () => {
    // El agujero más sutil: `resolver_persona` busca por correo y, si no
    // encuentra, por teléfono — y a la fila que encuentre le pone el
    // `cliente_id` de quien pidió (0138:933). Con el correo propio como
    // llave y el número ajeno como cerradura, la identidad cambia de dueño.
    const { registro } = await correrAlta(
      { personas: VICTIMA },
      {
        sesion: { clienteId: "cuenta-atacante", correo: "atacante@ejemplo.com" },
        contacto: { correo: "atacante@ejemplo.com", telefono: "77777777" },
      },
    );
    expect(argsDelAlta(registro)!.p_cliente_id).toBeNull();
  });

  it("un contacto que no existe todavía no necesita prueba de nadie", async () => {
    const { registro, resultado } = await correrAlta({});
    expect(argsDelAlta(registro)!.p_persona_probada).toBeNull();
    expect(argsDelAlta(registro)!.p_cliente_id).toBeNull();
    expect(resultado.estado).toBe("listo");
  });

  it("si la base no puede decir de quién es el contacto, no se abre la puerta", async () => {
    // «No sé de quién es» nunca puede volverse «entonces es tuyo». Con
    // la consulta rota, las dos pruebas caen y manda el portero.
    const { registro } = await correrAlta(
      { personasRotas: true },
      {
        personaProbada: "persona-ana",
        sesion: { clienteId: "cuenta-ana", correo: "ana@ejemplo.com" },
        contacto: { correo: "ana@ejemplo.com", telefono: "88888888" },
      },
    );
    expect(argsDelAlta(registro)!.p_persona_probada).toBeNull();
    expect(argsDelAlta(registro)!.p_cliente_id).toBeNull();
  });
});

describe("altaPorQr — lo que viaja a la base", () => {
  it("manda los dos contactos, la IP, el navegador y el texto exacto del permiso", async () => {
    const { registro } = await correrAlta({});
    const llamada = registro.rpc.find((l) => l.nombre === "alta_persona_por_qr");
    expect(llamada).toBeDefined();
    const args = llamada!.args;
    expect(args.p_correo).toBe("ana@ejemplo.com");
    expect(args.p_telefono).toBe("88888888");
    expect(args.p_ip).toBe("190.7.1.20");
    expect(args.p_user_agent).toBe("Mozilla/5.0");
    // El nombre SÍ viaja, y es obligatorio: es el pedido del dueño
    // («necesitamos saber quién se registra»). Antes esta línea decía
    // lo contrario — `toBeNull()` — porque el nombre era opcional y las
    // fichas del panel terminaban diciendo «Cliente sin datos».
    expect(args.p_nombre).toBe("Ana");

    const consentimientos = args.p_consentimientos as {
      negocio: { acepta: boolean; texto: string };
    };
    expect(consentimientos.negocio.acepta).toBe(true);
    // El MISMO string que ve la persona en la casilla.
    expect(consentimientos.negocio.texto).toBe(textoConsentimientoNegocio("Silence Barber"));
  });

  it("el NO también se guarda, con su texto", async () => {
    const { registro } = await correrAlta({}, { acepta: false });
    const args = registro.rpc.find((l) => l.nombre === "alta_persona_por_qr")!.args;
    const consentimientos = args.p_consentimientos as {
      negocio: { acepta: boolean; texto: string };
    };
    expect(consentimientos.negocio.acepta).toBe(false);
    expect(consentimientos.negocio.texto.length).toBeGreaterThan(10);
  });

  it("abre la sesión de la persona: es lo que evita volver a escribir todo", async () => {
    const { resultado, registro } = await correrAlta({});
    expect(registro.sesiones).toHaveLength(1);
    expect(registro.sesiones[0].persona_id).toBe("persona-nueva");
    // El token viaja en la cookie; en la base va solo su sha-256.
    expect(registro.sesiones[0].token_hash).toHaveLength(64);
    if (resultado.estado === "listo") {
      expect(resultado.token).not.toBe(registro.sesiones[0].token_hash);
      expect(resultado.token.length).toBeGreaterThan(30);
    }
  });
});

describe("altaPorQr — qué lee la persona en cada caso", () => {
  it("un contacto ajeno con sellos pide prueba, y no escribe nada", async () => {
    const { resultado } = await correrAlta({
      respuesta: { estado: "requiere_prueba", persona_id: "otra", canal_sugerido: "correo" },
    });
    expect(resultado.estado).toBe("requiere_prueba");
    if (resultado.estado === "requiere_prueba") expect(resultado.canal).toBe("correo");
  });

  it("un error de la base llega traducido, nunca crudo", async () => {
    const { resultado } = await correrAlta({
      errorRpc: { message: "Esta identidad está bloqueada", code: "22023" },
    });
    expect(resultado.estado).toBe("error");
    if (resultado.estado === "error") expect(resultado.mensaje).toContain("bloqueada");
  });

  it("una base sin la 0138 ofrece la otra puerta", async () => {
    const { resultado } = await correrAlta({
      errorRpc: { message: "Could not find the function", code: "PGRST202" },
    });
    if (resultado.estado === "error") expect(resultado.mensaje).toContain("Entrá con tu correo");
  });

  it("si el navegador no puede recordarla, se lo dice y se puede reintentar", async () => {
    // El alta ya quedó en la base y es idempotente: reintentar no
    // duplica nada, así que el mensaje invita a repetir.
    const { resultado } = await correrAlta({ sinSesiones: true });
    expect(resultado.estado).toBe("error");
    if (resultado.estado === "error") expect(resultado.mensaje).toContain("Probá otra vez");
  });

  it("una respuesta que no entendemos no se muestra como éxito", async () => {
    const { resultado } = await correrAlta({ respuesta: { estado: "vaya_a_saber" } });
    expect(resultado.estado).toBe("error");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════
 *  «NO ES MÍA, DAME UNA NUEVA» — el desvío de la 0200
 * ═══════════════════════════════════════════════════════════════════
 *
 * Pedido del dueño: «si el correo ya está, pide loguearse y eso es
 * tedioso». La salida NO puede ser abrir el portero —eso entrega los
 * sellos de otro—: es darle a quien está en la caja una identidad
 * propia, de cero, con su contacto guardado como dato de contacto.
 *
 * Lo que estas pruebas clavan es lo único que puede salir caro: que ese
 * camino se tome SOLO cuando la persona lo pidió, y que cuando se toma
 * no se reclame nada de la identidad ajena.
 */
describe("altaPorQr — el desvío sin cuenta (0200)", () => {
  const AJENO = {
    respuesta: { estado: "requiere_prueba", persona_id: "otra", canal_sugerido: "correo" },
  };

  it("SIN pedirlo, el contacto ajeno sigue pidiendo prueba y no se crea nada", async () => {
    // Que el desvío sea opt-in es la mitad de la seguridad: si se
    // tomara solo, cualquiera que teclee un correo ajeno se llevaría
    // una tarjeta sin haber decidido nada, y la deduplicación global de
    // Bookea se disolvería sola.
    const { resultado, registro } = await correrAlta(AJENO);
    expect(resultado.estado).toBe("requiere_prueba");
    expect(argsDelAltaLocal(registro)).toBeNull();
  });

  it("pidiéndolo, se abre una identidad LOCAL y se entrega la tarjeta", async () => {
    const { resultado, registro } = await correrAlta(AJENO, { sinReclamo: true });
    expect(resultado.estado).toBe("listo");
    if (resultado.estado === "listo") {
      expect(resultado.personaId).toBe("persona-local");
      expect(resultado.miembroNuevo).toBe(true);
      // La cookie se abre igual: es lo que hace que no tenga que
      // volver a escribir todo la próxima vez.
      expect(registro.sesiones).toHaveLength(1);
    }
  });

  it("el desvío NO le manda a la base ninguna prueba de posesión", async () => {
    // El agujero que hay que tener cerrado: si el alta local recibiera
    // `p_persona_probada` o `p_cliente_id`, estaría reclamando la
    // identidad ajena por la puerta de atrás. Su firma ni siquiera
    // tiene esos parámetros — esto lo deja escrito.
    const { registro } = await correrAlta(AJENO, { sinReclamo: true });
    const args = argsDelAltaLocal(registro);
    expect(args).not.toBeNull();
    expect(args).not.toHaveProperty("p_persona_probada");
    expect(args).not.toHaveProperty("p_cliente_id");
  });

  it("el contacto tecleado SÍ viaja: es la base de datos que el dueño pidió", async () => {
    const { registro } = await correrAlta(AJENO, { sinReclamo: true });
    const args = argsDelAltaLocal(registro);
    expect(args?.p_correo).toBe("ana@ejemplo.com");
    expect(args?.p_telefono).toBe("88888888");
    expect(args?.p_nombre).toBe("Ana");
  });

  it("el texto exacto del permiso viaja igual que en el alta normal", async () => {
    const { registro } = await correrAlta(AJENO, { sinReclamo: true });
    const args = argsDelAltaLocal(registro);
    const cuerpo = args?.p_consentimientos as { negocio?: { texto?: string; acepta?: boolean } };
    expect(cuerpo.negocio?.texto).toBe(textoConsentimientoNegocio("Silence Barber"));
    expect(cuerpo.negocio?.acepta).toBe(true);
  });

  it("con el contacto LIBRE el desvío no cambia nada: sigue el alta de siempre", async () => {
    // `sinReclamo` no debe saltarse la deduplicación cuando no hace
    // falta: si el correo no es de nadie, la persona tiene que quedar
    // con su identidad global, como cualquiera.
    const { resultado, registro } = await correrAlta({}, { sinReclamo: true });
    expect(resultado.estado).toBe("listo");
    expect(argsDelAlta(registro)).not.toBeNull();
    expect(argsDelAltaLocal(registro)).toBeNull();
  });

  it("sin la 0200 pegada, se vuelve al login de hoy en vez de romper", async () => {
    const { resultado } = await correrAlta(
      { ...AJENO, errorRpcLocal: { message: "Could not find the function", code: "PGRST202" } },
      { sinReclamo: true },
    );
    expect(resultado.estado).toBe("requiere_prueba");
    if (resultado.estado === "requiere_prueba") expect(resultado.canal).toBe("correo");
  });

  it("otro error de la base llega traducido, nunca crudo", async () => {
    const { resultado } = await correrAlta(
      { ...AJENO, errorRpcLocal: { message: "Hace falta el nombre", code: "22023" } },
      { sinReclamo: true },
    );
    expect(resultado.estado).toBe("error");
    if (resultado.estado === "error") expect(resultado.mensaje).not.toContain("22023");
  });

  it("el desvío NO abre una puerta para pasarse del tope del paquete", async () => {
    // EL AGUJERO QUE ESTO CIERRA, y no es teórico:
    //
    // `esClienteConocido` mira a propósito también las identidades que
    // quien pide NO probó —le alcanza con que el correo tecleado sea de
    // alguien que ya es miembro— porque en el camino normal esa persona
    // se reusa y no consume un asiento nuevo.
    //
    // Pero este camino existe justamente porque el contacto es de OTRO:
    // la ficha que crea es nueva sí o sí. Con el paquete lleno, teclear
    // el correo de un cliente que ya está adentro apagaba el chequeo
    // —`yaMiembro` en true por el dueño del correo— y el negocio
    // afiliaba gente por encima de su tope, de a una por dedazo.
    const { resultado, registro } = await correrAlta(
      {
        ...AJENO,
        plan: "arranque", // 100 clientes activos
        personasActivas: 100,
        personas: [{ id: "persona-otra", correo: "ana@ejemplo.com" }],
        miembros: ["persona-otra"], // el dueño del correo YA es miembro
      },
      { sinReclamo: true },
    );
    expect(resultado.estado).toBe("lleno");
    // Y lo que de verdad importa: no se creó ninguna ficha.
    expect(argsDelAltaLocal(registro)).toBeNull();
  });

  it("con lugar en el paquete, el desvío sigue entregando la tarjeta", async () => {
    const { resultado, registro } = await correrAlta(
      {
        ...AJENO,
        plan: "arranque",
        personasActivas: 99,
        personas: [{ id: "persona-otra", correo: "ana@ejemplo.com" }],
        miembros: ["persona-otra"],
      },
      { sinReclamo: true },
    );
    expect(resultado.estado).toBe("listo");
    expect(argsDelAltaLocal(registro)).not.toBeNull();
  });
});
