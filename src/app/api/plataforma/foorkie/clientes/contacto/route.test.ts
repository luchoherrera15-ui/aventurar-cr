import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/plataforma/foorkie/clientes/contacto de punta a punta: la firma
 * de verdad, la puerta de verdad (`abrirElPanel` = `abrirLaCaja`), el
 * vínculo con Foorkie y la marca `lealtad_por_foorkie`, contra una base de
 * mentira que aplica los filtros de cada consulta.
 *
 * Pedido del dueño (13 oct 2026): ver los correos y los teléfonos de sus
 * clientes y exportarlos a Excel, pero SOLO los de quienes aceptaron que el
 * negocio los contacte. Lo que se fija: lo que sale de cada cliente según lo
 * que aceptó, que de los demás no sale ni un dato, que una tarjeta de
 * Bookea (sin la marca) contesta 403, que no se escribe nada y que ni la
 * respuesta ni el log nombran un contacto de quien no aceptó.
 */

type Identidad = { nombre: string | null; correo: string | null; telefono: string | null };
const IDENTIDADES: Record<string, Identidad> = {};

vi.mock("@/lib/lealtad/identidades-db", () => ({
  miembrosConIdentidad: async () => [],
  identidadesDeMiembros: async (_db: unknown, miembros: { id: string }[]) =>
    new Map(miembros.map((m) => [m.id, IDENTIDADES[m.id] ?? { nombre: null, correo: null, telefono: null }])),
}));
vi.mock("@/lib/lealtad/plan-del-negocio", () => ({ planDelNegocio: vi.fn(async () => "arranque") }));
vi.mock("@/lib/wallet/mensaje-promocional", () => ({ enviarMensajePromocional: vi.fn() }));
vi.mock("@/lib/wallet/aviso-de-pausa", () => ({ plataformasConfiguradas: vi.fn(() => ["apple", "google"]) }));
vi.mock("@/lib/wallet/aviso-de-diseno", () => ({ avisarCambioDeDiseno: vi.fn() }));
vi.mock("@/lib/wallet/google", () => ({ refrescarClaseGoogle: vi.fn() }));

type Fila = Record<string, unknown>;
let tablas: Record<string, Fila[]> = {};
let escrituras = 0;
let falla: string | null = null;

/** Una consulta encadenable que aplica los filtros, el orden y el rango a las filas de su tabla. */
function consulta(tabla: string) {
  const filtros: unknown[][] = [];
  let unico = false;
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "lt", "order", "limit", "range"]) {
    b[m] = (...args: unknown[]) => {
      filtros.push([m, ...args]);
      return b;
    };
  }
  for (const m of ["insert", "update", "upsert", "delete"]) {
    b[m] = () => {
      escrituras += 1;
      return b;
    };
  }
  b.maybeSingle = () => {
    unico = true;
    return b;
  };
  b.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
    Promise.resolve()
      .then(() => {
        if (falla === tabla) return { data: null, error: { message: `falló ${tabla}` } };
        let filas = (tablas[tabla] ?? []).map((f) => ({ ...f }));
        for (const [m, col, val] of filtros as [string, string, unknown][]) {
          if (m === "eq") filas = filas.filter((f) => f[col] === val);
          if (m === "in") filas = filas.filter((f) => (val as unknown[]).includes(f[col]));
          if (m === "lt") filas = filas.filter((f) => String(f[col]) < String(val));
        }
        for (const [, col, o] of (filtros.filter((f) => f[0] === "order") as [string, string, { ascending?: boolean }?][]).reverse()) {
          const sube = o?.ascending !== false;
          filas.sort((a, z) => (String(a[col]) < String(z[col]) ? (sube ? -1 : 1) : String(a[col]) > String(z[col]) ? (sube ? 1 : -1) : 0));
        }
        const rango = filtros.find((f) => f[0] === "range") as [string, number, number] | undefined;
        if (rango) filas = filas.slice(rango[1], rango[2] + 1);
        const limite = filtros.find((f) => f[0] === "limit") as [string, number] | undefined;
        if (limite) filas = filas.slice(0, limite[1]);
        return { data: unico ? (filas[0] ?? null) : filas, error: null };
      })
      .then(ok, mal);
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => consulta(t) }),
}));

import { POST as contacto } from "./route";

const SECRETO = "secreto-de-prueba-de-la-puerta";
const RANCHO = "11111111-1111-4111-8111-111111111111";
const PROGRAMA = "22222222-2222-4222-8222-222222222222";
const CUENTA = "99999999-9999-4999-8999-999999999999";
const DUENO = "66666666-6666-4666-8666-666666666666";
const ANA = "aaaaaaa1-0000-4000-8000-000000000001"; // aceptó los dos canales
const BETO = "aaaaaaa2-0000-4000-8000-000000000002"; // aceptó y después revocó
const CARLA = "aaaaaaa3-0000-4000-8000-000000000003"; // nunca contestó
const DANI = "aaaaaaa4-0000-4000-8000-000000000004"; // acepta el correo, no el WhatsApp
const ELI = "aaaaaaa5-0000-4000-8000-000000000005"; // aceptó, pero se bajó de toda la plataforma
const FRAN = "aaaaaaa6-0000-4000-8000-000000000006"; // membresía sin persona (anterior a la 0138)
const GINA = "aaaaaaa7-0000-4000-8000-000000000007"; // aceptó, pero en OTRO negocio
const HUGO = "aaaaaaa8-0000-4000-8000-000000000008"; // acepta por la CUENTA del negocio
const OTRA = "aaaaaaa9-0000-4000-8000-000000000009"; // miembro de otra tarjeta
const BAJA = "aaaaaaaa-0000-4000-8000-00000000000a"; // dada de baja
const NADIE = "bbbbbbbb-0000-4000-8000-00000000000b"; // no existe
const vinculo = { rancho_id: RANCHO, programa_id: PROGRAMA };

function firmado(cuerpo: Record<string, unknown>, secreto = SECRETO): Request {
  const texto = JSON.stringify(cuerpo);
  const t = Date.now();
  const v1 = createHmac("sha256", secreto).update(`${t}.${texto}`).digest("hex");
  return new Request("https://www.bookea.lat/api/plataforma/foorkie/clientes/contacto", {
    method: "POST",
    headers: { "content-type": "application/json", "x-foorkie-firma": `t=${t},v1=${v1}` },
    body: texto,
  });
}

async function pedir(cuerpo: Record<string, unknown>, secreto?: string) {
  const r = await contacto(firmado(cuerpo, secreto));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

let ids = 0;
const consentimiento = (persona: string, canal: "correo" | "whatsapp", estado: "aceptado" | "revocado", created_at: string, extra: Fila = {}): Fila => {
  ids += 1;
  return {
    id: `00000000-0000-4000-8000-${String(ids).padStart(12, "0")}`,
    persona_id: persona,
    ambito: "negocio",
    canal,
    estado,
    cuenta_id: null,
    rancho_id: RANCHO,
    created_at,
    ...extra,
  };
};
/** El alta por el QR: una fila por canal. */
const alta = (persona: string, estado: "aceptado" | "revocado", created_at: string, extra: Fila = {}): Fila[] => [
  consentimiento(persona, "whatsapp", estado, created_at, extra),
  consentimiento(persona, "correo", estado, created_at, extra),
];
const miembro = (id: string, persona: string | null, extra: Fila = {}): Fila => ({
  id,
  programa_id: PROGRAMA,
  persona_id: persona,
  cliente_id: null,
  estado: "activa",
  created_at: "2026-08-01T10:00:00+00:00",
  ...extra,
});

beforeAll(() => vi.stubEnv("FOORKIE_PLATAFORMA_SECRETO", SECRETO));
afterAll(() => vi.unstubAllEnvs());

beforeEach(() => {
  escrituras = 0;
  falla = null;
  ids = 0;
  for (const k of Object.keys(IDENTIDADES)) delete IDENTIDADES[k];
  Object.assign(IDENTIDADES, {
    [ANA]: { nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "88887777" },
    [BETO]: { nombre: "Beto Mora", correo: "beto@correo.cr", telefono: "88881111" },
    [CARLA]: { nombre: "Carla Vega", correo: "carla@correo.cr", telefono: "88882222" },
    [DANI]: { nombre: "Dani Rojas", correo: "dani@correo.cr", telefono: "88883333" },
    [ELI]: { nombre: "Eli Cruz", correo: "eli@correo.cr", telefono: "88884444" },
    [FRAN]: { nombre: "Fran Soto", correo: "fran@correo.cr", telefono: "88885555" },
    [GINA]: { nombre: "Gina León", correo: "gina@correo.cr", telefono: "88886666" },
    [HUGO]: { nombre: "Hugo Paz", correo: "hugo@correo.cr", telefono: "88889999" },
    [OTRA]: { nombre: "Otra Tarjeta", correo: "otra@correo.cr", telefono: "88880000" },
    [BAJA]: { nombre: "Baja Cliente", correo: "baja@correo.cr", telefono: "88887000" },
  });
  tablas = {
    foorkie_restaurantes: [
      { id: "local-1", slug: "puramatcha", activo: true, estado_publicacion: "aprobado", created_at: "2026-09-01T10:00:00+00:00", bookea_rancho_id: RANCHO, bookea_programa_id: PROGRAMA, lealtad_por_foorkie: true },
    ],
    ranchos: [{ id: RANCHO, owner_id: DUENO, nombre: "Pura Matcha" }],
    programa_lealtad: [{ id: PROGRAMA, rancho_id: RANCHO, cuenta_id: CUENTA, nombre: "Tarjeta", modo: "sellos", estado: "activo", activo: true }],
    miembros: [
      miembro(ANA, "p-ana"),
      miembro(BETO, "p-beto"),
      miembro(CARLA, "p-carla"),
      miembro(DANI, "p-dani"),
      miembro(ELI, "p-eli"),
      miembro(FRAN, null),
      miembro(GINA, "p-gina"),
      miembro(HUGO, "p-hugo"),
      miembro(OTRA, "p-otra", { programa_id: "otra-tarjeta" }),
      miembro(BAJA, "p-baja", { estado: "cancelada" }),
    ],
    consentimientos_persona: [
      ...alta("p-ana", "aceptado", "2026-08-01T10:00:00+00:00"),
      ...alta("p-beto", "aceptado", "2026-08-01T10:00:00+00:00"),
      ...alta("p-beto", "revocado", "2026-09-05T10:00:00+00:00", { origen: "link_baja" }),
      // Carla: sin filas.
      consentimiento("p-dani", "correo", "aceptado", "2026-08-01T10:00:00+00:00"),
      consentimiento("p-dani", "whatsapp", "revocado", "2026-08-01T10:00:00+00:00"),
      ...alta("p-eli", "aceptado", "2026-08-01T10:00:00+00:00"),
      consentimiento("p-eli", "correo", "revocado", "2026-09-01T10:00:00+00:00", { ambito: "bookea", rancho_id: null }),
      consentimiento("p-eli", "whatsapp", "revocado", "2026-09-01T10:00:00+00:00", { ambito: "bookea", rancho_id: null }),
      ...alta("p-gina", "aceptado", "2026-08-01T10:00:00+00:00", { rancho_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }),
      ...alta("p-hugo", "aceptado", "2026-08-01T10:00:00+00:00", { rancho_id: null, cuenta_id: CUENTA }),
      ...alta("p-otra", "aceptado", "2026-08-01T10:00:00+00:00"),
      ...alta("p-baja", "aceptado", "2026-08-01T10:00:00+00:00"),
    ],
  };
});

const contactos = (r: { cuerpo: Record<string, unknown> }) => r.cuerpo.contactos as Fila[];
const por = (r: { cuerpo: Record<string, unknown> }, id: string) => contactos(r).find((c) => c.miembro_id === id);

describe("clientes/contacto: el contacto completo, solo de quien aceptó", () => {
  it("entrega nombre, correo y teléfono de quien aceptó, y nada de los demás", async () => {
    const r = await pedir({ ...vinculo, miembro_ids: [ANA, BETO, CARLA, DANI, ELI, FRAN, GINA, HUGO] });
    expect(r.status).toBe(200);
    expect(contactos(r).map((c) => c.miembro_id)).toEqual([ANA, BETO, CARLA, DANI, ELI, FRAN, GINA, HUGO]);

    expect(por(r, ANA)).toEqual({ miembro_id: ANA, nombre: "Ana María Solís", correo: "ana.solis@gmail.com", telefono: "88887777", acepta: { correo: true, whatsapp: true } });
    // Aceptó solo el correo: el teléfono no sale.
    expect(por(r, DANI)).toEqual({ miembro_id: DANI, nombre: "Dani Rojas", correo: "dani@correo.cr", telefono: null, acepta: { correo: true, whatsapp: false } });
    // Aceptó por la cuenta del negocio, no por el rancho.
    expect(por(r, HUGO)).toMatchObject({ nombre: "Hugo Paz", correo: "hugo@correo.cr", telefono: "88889999", acepta: { correo: true, whatsapp: true } });

    // Revocó, nunca contestó, se bajó de la plataforma, no tiene persona, aceptó en otro negocio: nada.
    for (const id of [BETO, CARLA, ELI, FRAN, GINA]) {
      expect(por(r, id)).toEqual({ miembro_id: id, nombre: null, correo: null, telefono: null, acepta: { correo: false, whatsapp: false } });
    }
    const texto = JSON.stringify(r.cuerpo);
    expect(texto).not.toMatch(/beto@|carla@|eli@|fran@|gina@|8888[1245]|88886666|Beto|Carla|Eli |Fran |Gina/);
    expect(escrituras).toBe(0);
  });

  it("un cliente de otra tarjeta, uno dado de baja o uno que no existe no salen", async () => {
    const r = await pedir({ ...vinculo, miembro_ids: [OTRA, BAJA, NADIE, ANA] });
    expect(r.status).toBe(200);
    expect(contactos(r).map((c) => c.miembro_id)).toEqual([ANA]);
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/otra@|baja@/);
    const nadie = await pedir({ ...vinculo, miembro_ids: [OTRA, BAJA, NADIE] });
    expect(nadie).toEqual({ status: 200, cuerpo: { ok: true, contactos: [] } });
  });

  it("si aceptó y después revocó solo un canal, solo ese se cierra; si vuelve a aceptar, se abre", async () => {
    tablas.consentimientos_persona.push(consentimiento("p-ana", "whatsapp", "revocado", "2026-09-10T10:00:00+00:00"));
    let r = await pedir({ ...vinculo, miembro_ids: [ANA] });
    expect(por(r, ANA)).toMatchObject({ correo: "ana.solis@gmail.com", telefono: null, acepta: { correo: true, whatsapp: false } });
    tablas.consentimientos_persona.push(consentimiento("p-ana", "whatsapp", "aceptado", "2026-09-20T10:00:00+00:00"));
    r = await pedir({ ...vinculo, miembro_ids: [ANA] });
    expect(por(r, ANA)).toMatchObject({ telefono: "88887777", acepta: { correo: true, whatsapp: true } });
  });

  it("una tarjeta vinculada pero de Bookea (sin la marca de Foorkie): 403, sin entregar nada", async () => {
    tablas.foorkie_restaurantes[0].lealtad_por_foorkie = false;
    const r = await pedir({ ...vinculo, miembro_ids: [ANA] });
    expect(r).toMatchObject({ status: 403, cuerpo: { ok: false, codigo: "no_es_de_foorkie" } });
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/ana|solis|8888/i);
  });

  it("la misma puerta de siempre: firma ajena 401, tarjeta sin vínculo 403, pedido mal formado 400", async () => {
    expect(await pedir({ ...vinculo, miembro_ids: [ANA] }, "otra-llave")).toMatchObject({ status: 401, cuerpo: { codigo: "firma" } });
    expect(await pedir({ ...vinculo })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    expect(await pedir({ ...vinculo, miembro_ids: [] })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    expect(await pedir({ ...vinculo, miembro_ids: ["no-es-uuid"] })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
    tablas.foorkie_restaurantes = [];
    expect(await pedir({ ...vinculo, miembro_ids: [ANA] })).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });

  it("sin la tarjeta en la base, la puerta rechaza antes de leer nada", async () => {
    tablas.programa_lealtad = [];
    // El vínculo (foorkie_restaurantes + ranchos + programa) también se pregunta: sin programa, la puerta lo rechaza.
    expect(await pedir({ ...vinculo, miembro_ids: [ANA] })).toMatchObject({ status: 403, cuerpo: { codigo: "no_vinculado" } });
  });

  it("si una lectura falla no se entrega una lista a medias: 500", async () => {
    falla = "consentimientos_persona";
    const r = await pedir({ ...vinculo, miembro_ids: [ANA, CARLA] });
    expect(r).toMatchObject({ status: 500, cuerpo: { ok: false, codigo: "error_base" } });
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/ana|8888/i);
    falla = "miembros";
    expect(await pedir({ ...vinculo, miembro_ids: [ANA] })).toMatchObject({ status: 500, cuerpo: { codigo: "error_base" } });
  });

  it("200 clientes caben en el cuerpo firmado (más que los 4000 de las otras rutas)", async () => {
    const muchos = Array.from({ length: 200 }, (_, i) => `dddddddd-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const r = await pedir({ ...vinculo, miembro_ids: muchos });
    expect(r).toEqual({ status: 200, cuerpo: { ok: true, contactos: [] } });
    expect(await pedir({ ...vinculo, miembro_ids: [...muchos, ANA] })).toMatchObject({ status: 400, cuerpo: { codigo: "datos" } });
  });

  it("muchas personas: las consultas van de a cien y todas salen", async () => {
    const muchos: string[] = [];
    for (let i = 0; i < 150; i++) {
      const id = `eeeeeeee-0000-4000-8000-${String(i).padStart(12, "0")}`;
      muchos.push(id);
      tablas.miembros.push(miembro(id, `p-${i}`));
      tablas.consentimientos_persona.push(...alta(`p-${i}`, i % 2 === 0 ? "aceptado" : "revocado", "2026-08-02T10:00:00+00:00"));
      IDENTIDADES[id] = { nombre: `Cliente ${i}`, correo: `c${i}@correo.cr`, telefono: `8800${String(i).padStart(4, "0")}` };
    }
    const r = await pedir({ ...vinculo, miembro_ids: muchos });
    expect(contactos(r)).toHaveLength(150);
    expect(contactos(r).filter((c) => c.correo !== null)).toHaveLength(75);
    expect(contactos(r).every((c, i) => (c.correo !== null) === (i % 2 === 0))).toBe(true);
  });
});
