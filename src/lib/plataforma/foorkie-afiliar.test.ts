import { describe, expect, it } from "vitest";
import type { ParametrosAlta, ResultadoAltaSinSesion } from "@/lib/lealtad/personas";
import {
  afiliarDesdeFoorkie,
  leerPedidoAfiliar,
  motivoDeBaja,
  motivoNoOpera,
  rechazoDelAlta,
  revisarDatosAfiliar,
  type PedidoAfiliar,
} from "./foorkie-afiliar";
import { leerLinkPase } from "./foorkie-api";

const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "33333333-3333-4333-8333-333333333333";
const MIEMBRO = "44444444-4444-4444-8444-444444444444";
const PERSONA = "55555555-5555-4555-8555-555555555555";
const SECRETO = "secreto-de-prueba-de-la-puerta";
const AHORA = new Date("2026-10-01T18:00:00Z");
const TEXTO = "Sí, quiero que Pura Matcha y Foorkie me avisen de promociones y de lo que voy juntando.";

/** Un pedido como lo manda Foorkie. */
function crudo(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rancho_id: RANCHO,
    programa_id: PROGRAMA,
    nombre: "  Ana   Ruiz ",
    correo: "Ana@Ejemplo.com",
    whatsapp: "50688887777",
    acepta_promos: true,
    consentimiento: { texto: TEXTO, version: "foorkie-lealtad-v1" },
    origen: "foorkie_app",
    ip: "190.7.1.20",
    user_agent: "FoorkieApp/1.1 (iPhone)",
    ...extra,
  };
}

function pedido(extra: Record<string, unknown> = {}): PedidoAfiliar {
  const l = leerPedidoAfiliar(crudo(extra));
  if (!l.ok) throw new Error(l.motivo);
  return l.valor;
}

describe("leerPedidoAfiliar — la forma del contrato (lo que no cumple es un 400)", () => {
  it("lee el pedido bien armado y lo deja listo", () => {
    expect(pedido()).toEqual({
      ranchoId: RANCHO,
      programaId: PROGRAMA,
      nombre: "Ana Ruiz",
      correo: "Ana@Ejemplo.com",
      whatsapp: "50688887777",
      aceptaPromos: true,
      consentimiento: { texto: TEXTO, version: "foorkie-lealtad-v1" },
      origen: "foorkie_app",
      ip: "190.7.1.20",
      userAgent: "FoorkieApp/1.1 (iPhone)",
    });
  });

  it("el WhatsApp, la IP y el navegador son opcionales; una IP sin forma se descarta, no tumba el alta", () => {
    const p = pedido({ whatsapp: undefined, ip: "no-es-ip", user_agent: undefined });
    expect(p.whatsapp).toBeNull();
    expect(p.ip).toBeNull();
    expect(p.userAgent).toBeNull();
    expect(pedido({ whatsapp: "" }).whatsapp).toBeNull();
    expect(pedido({ user_agent: "x".repeat(900) }).userAgent).toHaveLength(400);
  });

  it("el texto del permiso viaja TAL CUAL: es la prueba de lo que se leyó", () => {
    const conEspacios = `  ${TEXTO}\n`;
    expect(pedido({ consentimiento: { texto: conEspacios, version: " v2 " } }).consentimiento).toEqual({
      texto: conEspacios,
      version: "v2",
    });
  });

  it.each([
    ["sin negocio", { rancho_id: "no-es-uuid" }],
    ["sin tarjeta", { programa_id: undefined }],
    ["nombre de una letra", { nombre: "A" }],
    ["nombre de 81", { nombre: "x".repeat(81) }],
    ["sin correo", { correo: "  " }],
    ["correo larguísimo", { correo: `${"a".repeat(250)}@x.com` }],
    ["WhatsApp que no es texto", { whatsapp: 88887777 }],
    ["sin acepta_promos", { acepta_promos: "si" }],
    ["sin consentimiento", { consentimiento: undefined }],
    ["texto del permiso corto", { consentimiento: { texto: "Sí", version: "v1" } }],
    ["texto del permiso de más de 2000", { consentimiento: { texto: "x".repeat(2001), version: "v1" } }],
    ["sin versión", { consentimiento: { texto: TEXTO, version: "" } }],
    ["versión de más de 40", { consentimiento: { texto: TEXTO, version: "v".repeat(41) } }],
    ["origen inventado", { origen: "bookea" }],
  ])("rechaza: %s", (_caso, extra) => {
    const l = leerPedidoAfiliar(crudo(extra));
    expect(l.ok).toBe(false);
    if (!l.ok) expect(l.motivo.length).toBeGreaterThan(5);
  });
});

describe("revisarDatosAfiliar — lo que la persona corrige, con los mensajes del póster", () => {
  const base = { nombre: "Ana", correo: "ana@ejemplo.com", whatsapp: null as string | null };

  it("normaliza igual que el alta de Bookea: correo en minúsculas y los 8 dígitos del teléfono", () => {
    const r = revisarDatosAfiliar({ ...base, correo: " Ana@Ejemplo.COM ", whatsapp: "50688887777" });
    expect(r).toEqual({ ok: true, nombre: "Ana", contacto: { correo: "ana@ejemplo.com", telefono: "88887777" } });
    const r2 = revisarDatosAfiliar({ ...base, whatsapp: "8888-7777" });
    expect(r2.ok && r2.contacto.telefono).toBe("88887777");
  });

  it("el WhatsApp es de Costa Rica: 8 dígitos, o 11 con el 506", () => {
    for (const malo of ["8888777", "988887777", "52155512345678", "15125550123"]) {
      expect(revisarDatosAfiliar({ ...base, whatsapp: malo })).toEqual({
        ok: false,
        campo: "whatsapp",
        motivo: "El WhatsApp lleva 8 números — así: 8888 8888.",
      });
    }
  });

  it("un correo mal escrito y un nombre largo de más se marcan en su campo", () => {
    expect(revisarDatosAfiliar({ ...base, correo: "ana.ejemplo.com" })).toMatchObject({ ok: false, campo: "correo" });
    // El alta de Bookea acepta hasta 60 (LARGO_NOMBRE): de 61 a 80 vuelve con su mensaje.
    expect(revisarDatosAfiliar({ ...base, nombre: "x".repeat(61) })).toEqual({
      ok: false,
      campo: "nombre",
      motivo: "Ese nombre es demasiado largo.",
    });
  });
});

describe("los motivos — en español y sin hablar de planes ni paquetes", () => {
  it("la tarjeta que no opera dice por qué", () => {
    expect(motivoNoOpera("pausado", "Pura Matcha")).toContain("en pausa");
    expect(motivoNoOpera("vencido", "Pura Matcha")).toContain("ya terminó");
    expect(motivoNoOpera("borrador", "")).toContain("este local");
  });

  it("dada de baja o suspendida; activa = nada", () => {
    expect(motivoDeBaja("cancelada", "Pura Matcha")).toContain("dada de baja");
    expect(motivoDeBaja("pausada", "Pura Matcha")).toContain("suspendida");
    expect(motivoDeBaja("activa", "Pura Matcha")).toBeNull();
  });

  it("el cupo lleno no menciona el plan del negocio", () => {
    const r = rechazoDelAlta({ estado: "lleno" }, "Pura Matcha");
    expect(r.codigo).toBe("cupo_agotado");
    expect(r.motivo).not.toMatch(/plan|paquete/i);
  });

  it("un contacto que ya tiene esta tarjeta con sellos: a buscarla en su cuenta, sin decir cuántos tiene", () => {
    const r = rechazoDelAlta({ estado: "requiere_prueba", canal: "correo" }, "Pura Matcha");
    expect(r).toMatchObject({ codigo: "requiere_prueba", canal: "correo" });
    expect(r.motivo).toContain("Foorkie");
    expect(r.motivo).not.toMatch(/\d/);
  });
});

// ════════════════════════════════════════════════════════════════════
//  De punta a punta, contra una base de mentira y el alta inyectada
// ════════════════════════════════════════════════════════════════════

type Fila = Record<string, unknown>;
type Mundo = {
  negocio?: Fila | null;
  programa?: Fila | null;
  miembro?: Fila | null;
  ledger?: { puntos: number }[] | "error";
  recompensa?: Fila | null;
};
type Escritura = { tabla: string; valores: Fila; filtros: [string, string, unknown][] };

const PROGRAMA_ACTIVO: Fila = {
  id: PROGRAMA,
  rancho_id: RANCHO,
  nombre: "Tarjeta Matcha",
  modo: "sellos",
  estado: "activo",
  activo: true,
  beneficio: null,
  created_at: "2026-09-01T10:00:00Z",
};

function dbFalsa(mundo: Mundo, escrituras: Escritura[]) {
  return {
    from(tabla: string) {
      const filtros: [string, string, unknown][] = [];
      let valores: Fila | null = null;
      const lista = () => {
        if (valores) {
          escrituras.push({ tabla, valores, filtros });
          return { data: null, error: null };
        }
        if (tabla === "transacciones_puntos") {
          return mundo.ledger === "error"
            ? { data: null, error: { message: "se cortó" } }
            : { data: mundo.ledger ?? [], error: null };
        }
        return { data: [], error: null };
      };
      const q = {
        select: () => q,
        update(v: Fila) {
          valores = v;
          return q;
        },
        eq(c: string, v: unknown) {
          filtros.push(["eq", c, v]);
          return q;
        },
        gte(c: string, v: unknown) {
          filtros.push(["gte", c, v]);
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle() {
          const fila =
            tabla === "ranchos"
              ? mundo.negocio
              : tabla === "programa_lealtad"
                ? mundo.programa
                : tabla === "miembros"
                  ? mundo.miembro
                  : tabla === "recompensas"
                    ? mundo.recompensa
                    : null;
          return Promise.resolve({ data: fila ?? null, error: null });
        },
        then<R1, R2>(ok: (v: ReturnType<typeof lista>) => R1, mal?: (e: unknown) => R2) {
          return Promise.resolve(lista()).then(ok, mal);
        },
      };
      return q;
    },
  };
}

type Db = Parameters<typeof afiliarDesdeFoorkie>[0];

async function correr(
  {
    mundo = {},
    respuesta = { estado: "listo", personaId: PERSONA, miembroId: MIEMBRO, miembroNuevo: true },
    extra = {},
  }: { mundo?: Mundo; respuesta?: ResultadoAltaSinSesion; extra?: Record<string, unknown> } = {},
) {
  const escrituras: Escritura[] = [];
  const llamadasAlta: ParametrosAlta[] = [];
  const db = dbFalsa(
    {
      negocio: { id: RANCHO, nombre: "Pura Matcha", plan_lealtad: "crecer" },
      programa: PROGRAMA_ACTIVO,
      miembro: { id: MIEMBRO, programa_id: PROGRAMA, estado: "activa" },
      ledger: [{ puntos: 1 }, { puntos: 2 }],
      recompensa: { nombre: "Un matcha gratis", costo_puntos: 10 },
      ...mundo,
    },
    escrituras,
  ) as unknown as Db;
  const r = await afiliarDesdeFoorkie(
    db,
    pedido(extra),
    { base: "https://www.bookea.lat", secreto: SECRETO, ahora: AHORA },
    {
      alta: async (_db, p) => {
        llamadasAlta.push(p);
        return respuesta;
      },
    },
  );
  return { r, escrituras, llamadasAlta };
}

describe("afiliarDesdeFoorkie — el alta del póster, desde Foorkie", () => {
  it("una persona nueva: la tarjeta, con los links al Wallet de ESE miembro", async () => {
    const { r } = await correr();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ya_era_miembro).toBe(false);
    expect(r.tarjeta).toMatchObject({
      miembro_id: MIEMBRO,
      programa_id: PROGRAMA,
      rancho_id: RANCHO,
      negocio: "Pura Matcha",
      nombre: "Tarjeta Matcha",
      modo: "sellos",
      saldo: 3,
      progreso: { actual: 3, total: 10 },
    });
    const token = decodeURIComponent(r.tarjeta.wallet.apple.split("t=")[1]);
    expect(leerLinkPase(token, SECRETO, AHORA.getTime())).toMatchObject({ m: MIEMBRO, w: "apple" });
    expect(r.tarjeta.wallet.google.startsWith("https://www.bookea.lat/api/plataforma/foorkie/pase?t=")).toBe(true);
  });

  it("al núcleo le llega lo mismo que manda el póster, con el permiso de Foorkie y sin pruebas de posesión", async () => {
    const { llamadasAlta } = await correr();
    expect(llamadasAlta).toHaveLength(1);
    const p = llamadasAlta[0];
    expect(p.programa).toBe(PROGRAMA_ACTIVO);
    expect(p.ranchoId).toBe(RANCHO);
    expect(p.planRancho).toBe("crecer");
    expect(p.nombreNegocio).toBe("Pura Matcha");
    expect(p.nombre).toBe("Ana Ruiz");
    expect(p.contacto).toEqual({ correo: "ana@ejemplo.com", telefono: "88887777" });
    expect(p.acepta).toBe(true);
    expect(p.consentimiento).toEqual({ texto: TEXTO, version: "foorkie-lealtad-v1" });
    // El correo lo tecleó alguien: no prueba nada, y nunca se abre una segunda tarjeta.
    expect(p.personaProbada).toBeNull();
    expect(p.sesion).toEqual({ clienteId: null, correo: null });
    expect(p.sinReclamo).toBe(false);
    expect(p.ip).toBe("190.7.1.20");
    expect(p.userAgent).toBe("FoorkieApp/1.1 (iPhone)");
  });

  it("anota el origen real del permiso SOLO en las filas recién escritas por el alta", async () => {
    const { escrituras } = await correr();
    const prueba = escrituras.find((e) => e.tabla === "consentimientos_persona");
    expect(prueba?.valores).toEqual({ origen: "foorkie_app" });
    expect(prueba?.filtros).toEqual(
      expect.arrayContaining([
        ["eq", "persona_id", PERSONA],
        ["eq", "ambito", "negocio"],
        ["eq", "rancho_id", RANCHO],
        ["eq", "origen", "qr_tarjeta"],
        ["eq", "texto_version", "foorkie-lealtad-v1"],
        ["gte", "created_at", new Date(AHORA.getTime() - 120_000).toISOString()],
      ]),
    );
    const espejo = escrituras.find((e) => e.tabla === "consentimientos");
    expect(espejo?.valores).toEqual({ origen: "foorkie_app" });
    expect(espejo?.filtros).toEqual(
      expect.arrayContaining([
        ["eq", "correo", "ana@ejemplo.com"],
        ["eq", "rancho_id", RANCHO],
        ["eq", "origen", "qr_tarjeta"],
      ]),
    );
    // Nada más se escribe desde acá.
    expect(escrituras).toHaveLength(2);
  });

  it("quien ya tenía ESTA tarjeta la recibe de vuelta, sin duplicarla", async () => {
    const { r } = await correr({
      respuesta: { estado: "listo", personaId: PERSONA, miembroId: MIEMBRO, miembroNuevo: false },
    });
    expect(r).toMatchObject({ ok: true, ya_era_miembro: true, tarjeta: { miembro_id: MIEMBRO } });
  });

  it("un contacto con sellos en esta tarjeta pide prueba: no se entrega nada ni se escribe nada", async () => {
    const { r, escrituras } = await correr({ respuesta: { estado: "requiere_prueba", canal: "correo" } });
    expect(r).toMatchObject({ ok: false, codigo: "requiere_prueba", canal: "correo" });
    expect(escrituras).toHaveLength(0);
  });

  it("el cupo lleno es `cupo_agotado`; un error de la base llega traducido", async () => {
    expect((await correr({ respuesta: { estado: "lleno" } })).r).toMatchObject({ ok: false, codigo: "cupo_agotado" });
    const { r } = await correr({ respuesta: { estado: "error", mensaje: "Esta identidad está bloqueada. Preguntá en el local." } });
    expect(r).toEqual({ ok: false, codigo: "rechazado", motivo: "Esta identidad está bloqueada. Preguntá en el local." });
  });

  it("una tarjeta en pausa o vencida no afilia a nadie (y no llama al alta)", async () => {
    const pausada = await correr({ mundo: { programa: { ...PROGRAMA_ACTIVO, estado: "pausado" } } });
    expect(pausada.r).toMatchObject({ ok: false, codigo: "programa_no_opera" });
    expect(pausada.llamadasAlta).toHaveLength(0);
    const vencida = await correr({ mundo: { programa: { ...PROGRAMA_ACTIVO, vigente_hasta: "2026-09-30" } } });
    expect(vencida.r).toMatchObject({ ok: false, codigo: "programa_no_opera" });
    if (!vencida.r.ok) expect(vencida.r.motivo).toContain("ya terminó");
    const sinTarjeta = await correr({ mundo: { programa: null } });
    expect(sinTarjeta.r).toMatchObject({ ok: false, codigo: "programa_no_opera" });
  });

  it("los datos que la persona tiene que corregir vuelven con su campo, sin llamar al alta", async () => {
    const corto = await correr({ extra: { whatsapp: "123456789" } });
    expect(corto.r).toMatchObject({ ok: false, codigo: "datos", campo: "whatsapp" });
    expect(corto.llamadasAlta).toHaveLength(0);
    const largo = await correr({ extra: { nombre: "x".repeat(70) } });
    expect(largo.r).toMatchObject({ ok: false, codigo: "datos", campo: "nombre" });
  });

  it("una membresía dada de baja o suspendida no devuelve la tarjeta", async () => {
    const baja = await correr({ mundo: { miembro: { id: MIEMBRO, programa_id: PROGRAMA, estado: "cancelada" } } });
    expect(baja.r).toMatchObject({ ok: false, codigo: "dada_de_baja" });
    const suspendida = await correr({ mundo: { miembro: { id: MIEMBRO, programa_id: PROGRAMA, estado: "pausada" } } });
    expect(suspendida.r).toMatchObject({ ok: false, codigo: "dada_de_baja" });
  });

  it("si la tarjeta quedó pero no se puede leer, se pide reintentar (nunca se inventa un saldo)", async () => {
    expect((await correr({ mundo: { ledger: "error" } })).r).toMatchObject({ ok: false, codigo: "reintentar" });
    const sinMiembro = await correr({
      respuesta: { estado: "listo", personaId: PERSONA, miembroId: null, miembroNuevo: true },
    });
    expect(sinMiembro.r).toMatchObject({ ok: false, codigo: "reintentar" });
    const deOtra = await correr({ mundo: { miembro: { id: MIEMBRO, programa_id: "otra", estado: "activa" } } });
    expect(deOtra.r).toMatchObject({ ok: false, codigo: "reintentar" });
  });
});
