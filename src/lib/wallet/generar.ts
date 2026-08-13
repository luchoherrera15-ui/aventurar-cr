import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarSaldo } from "@/lib/lealtad/motor";
import { puede } from "@/lib/lealtad/planes";
import {
  dibujarBanda,
  dibujarIcono,
  dibujarLogo,
  dibujarTiraDeSellos,
  type ColoresTarjeta,
} from "./imagenes";
import { empaquetarPase } from "./empaquetar";
import { credencialesDelEntorno } from "./firma";

/**
 * Base pública del sitio; Apple le agrega `/v1/...` por su cuenta.
 *
 * TIENE que ser el host CANÓNICO, con `www`. El ápex `bookea.lat`
 * responde 308 hacia `www`, y el Web Service de Wallet no sigue
 * redirecciones: el iPhone acepta el pase, nunca completa el registro,
 * y el sello no se refresca jamás — sin error visible en ningún lado.
 *
 * El `replace` no es paranoia: en Vercel `NEXT_PUBLIC_SITE_URL` está
 * seteada AL ÁPEX, y esa URL viaja horneada dentro de cada .pkpass.
 * Así se emitieron pases mudos de verdad (registros_dispositivo en
 * cero) — por eso el host se corrige acá, gane quien gane la variable.
 */
const SITIO_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.bookea.lat").replace(
  /^https:\/\/bookea\.lat(?=\/|$)/,
  "https://www.bookea.lat",
);
import {
  coloresDe,
  construirPassJson,
  tarjetaDesdeFila,
  tiraDelPase,
  type MetaRecompensa,
  type TiraDelPase,
} from "./tarjeta";

/**
 * Genera el .pkpass de un cliente para un negocio.
 *
 * Junta lo que vive repartido: el programa y su apariencia (0060,
 * 0121, 0122), el saldo derivado del ledger, la recompensa que marca
 * la meta, y el certificado del entorno.
 *
 * Corre con la llave de servicio a propósito: `pases_wallet` no tiene
 * política de escritura para clientes —crear el pase y firmarlo es del
 * servidor— pero la IDENTIDAD la comprueba quien llama, con la sesión
 * del usuario, antes de invocar esto.
 */

export type ResultadoPase =
  | { ok: true; pkpass: Buffer; serialNumber: string }
  | { ok: false; motivo: string };

export async function generarPaseDeLealtad({
  ranchoId,
  clienteId,
  ahora,
}: {
  ranchoId: string;
  /** Ya verificado por quien llama contra la sesión. */
  clienteId: string;
  ahora: Date;
}): Promise<ResultadoPase> {
  const credenciales = credencialesDelEntorno();
  if (!credenciales) {
    return { ok: false, motivo: "El pase de Wallet no está configurado en este servidor." };
  }

  const db = createAdminClient();
  if (!db) return { ok: false, motivo: "No hay conexión de servicio." };

  // ── El negocio y su programa ──────────────────────────────────────
  const { data: negocio } = await db
    .from("ranchos")
    .select("id, nombre, latitud, longitud, plan_lealtad")
    .eq("id", ranchoId)
    .maybeSingle();
  if (!negocio) return { ok: false, motivo: "Ese negocio no existe." };

  // `select *` y no una lista de columnas: desde la 0134 el programa
  // cuelga de una CUENTA, y pedir `cuenta_id` explícitamente haría
  // fallar la consulta entera mientras la migración no esté corrida —
  // con el síntoma "este negocio no tiene programa", que manda a mirar
  // justo donde no está el problema.
  const { data: programaFila } = await db
    .from("programa_lealtad")
    .select("*")
    .eq("rancho_id", ranchoId)
    .eq("activo", true)
    .maybeSingle();
  if (!programaFila) {
    return { ok: false, motivo: "Este negocio todavía no tiene programa de lealtad." };
  }
  const programa = programaFila as { id: string; activo: boolean };

  // La apariencia Y el beneficio salen de la fila en un solo lugar
  // (tarjeta.ts). Antes esto era un casteo a una lista de columnas
  // escrita a mano que NO incluía `beneficio`: el `select *` la traía y
  // el casteo la tiraba, así que los cinco tipos de la 0135 llegaban al
  // teléfono con el texto de degradación —«CUPÓN / Beneficio»— y no
  // había test que lo viera, porque todos probaban la función pura.
  const { config, beneficio } = tarjetaDesdeFila(programaFila as Record<string, unknown>);

  // ── El miembro: si no lo es, se afilia acá ────────────────────────
  // Pedir la tarjeta ES afiliarse. Obligar a un paso previo solo
  // agrega una pantalla donde la gente se cae.
  let { data: miembro } = await db
    .from("miembros")
    .select("id, estado")
    .eq("programa_id", programa.id)
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (!miembro) {
    // EL TOPE DEL PLAN SE CUMPLE ACÁ, no solo se pinta: sin este
    // check, la Prueba (25 clientes) afiliaría al 26 igual y el tope
    // sería decorativo. Los miembros existentes no se tocan — solo se
    // frena la afiliación NUEVA.
    //
    // El plan sale de la CUENTA desde la 0134, con el del rancho como
    // respaldo mientras la migración no esté corrida en todos lados.
    //
    // Y el CONSUMO también se cuenta por cuenta (0142), con
    // `personasActivasDe`: contarlo por tarjeta —como se hacía— le
    // regalaba un cupo entero a cada tarjeta nueva. El mismo llamado
    // corre en `google.ts`; el bloque estaba copiado literal en los dos
    // archivos y se arregló en uno solo.
    const { definicionDe } = await import("@/lib/lealtad/planes");
    const { contextoDeCuenta } = await import("@/lib/lealtad/cuenta");
    const { personasActivasDe } = await import("@/lib/lealtad/cupo");
    const { plan, cuentaId } = await contextoDeCuenta(
      db,
      programaFila as Record<string, unknown>,
      { planRancho: (negocio as { plan_lealtad?: string | null }).plan_lealtad ?? null },
    );
    const limite = definicionDe(plan)?.limites.clientesActivos;
    if (limite !== null && limite !== undefined) {
      const usadas = await personasActivasDe(db, { cuentaId, ranchoId });
      if (usadas >= limite) {
        return {
          ok: false,
          motivo:
            "El programa de este negocio está lleno por ahora — preguntá en el local.",
        };
      }
    }

    const { data: nuevo, error } = await db
      .from("miembros")
      .insert({ programa_id: programa.id, cliente_id: clienteId, estado: "activa" })
      .select("id, estado")
      .single();
    if (error) return { ok: false, motivo: "No se pudo afiliar: " + error.message };
    miembro = nuevo;
  }

  if (miembro!.estado === "cancelada") {
    return { ok: false, motivo: "Esta membresía está cancelada." };
  }

  // ── El saldo y la meta ────────────────────────────────────────────
  const saldo = (await consultarSaldo(miembro!.id)) ?? 0;

  // La recompensa activa MÁS BARATA es la próxima meta: es lo que el
  // cliente puede alcanzar primero, y de ahí sale el "5 de 10".
  const { data: recompensa } = await db
    .from("recompensas")
    .select("nombre, costo_puntos")
    .eq("programa_id", programa.id)
    .eq("activo", true)
    .order("costo_puntos", { ascending: true })
    .limit(1)
    .maybeSingle();

  const meta: MetaRecompensa = recompensa
    ? { nombre: recompensa.nombre as string, costo_puntos: recompensa.costo_puntos as number }
    : null;

  // ── El pase: uno por miembro, con serial estable ──────────────────
  // El serial NO se regenera: es la identidad de la tarjeta en el
  // teléfono. Si cambiara, cada actualización agregaría una tarjeta
  // nueva en vez de refrescar la que el cliente ya tiene.
  let { data: pase } = await db
    .from("pases_wallet")
    .select("serial_number, auth_token")
    .eq("miembro_id", miembro!.id)
    .eq("plataforma", "apple")
    .maybeSingle();

  if (!pase) {
    const { data: nuevo, error } = await db
      .from("pases_wallet")
      .insert({
        miembro_id: miembro!.id,
        plataforma: "apple",
        serial_number: randomUUID(),
        // Con esto Apple se autentica al pedir el pase actualizado.
        auth_token: randomBytes(32).toString("hex"),
        saldo_cache: saldo,
      })
      .select("serial_number, auth_token")
      .single();
    if (error) return { ok: false, motivo: "No se pudo crear el pase: " + error.message };
    pase = nuevo;
  }

  const serialNumber = pase!.serial_number as string;
  const authToken = pase!.auth_token as string;

  // ── Las imágenes ──────────────────────────────────────────────────
  const colores = coloresDe(config);
  const logoNegocio = await bajarImagen(config.pase_logo_url);

  const archivos: Record<string, Buffer> = {
    "icon.png": await dibujarIcono(29),
    "icon@2x.png": await dibujarIcono(58),
    "icon@3x.png": await dibujarIcono(87),
    ...(await archivosDelLogo(negocio.nombre, logoNegocio)),
    ...(await archivosDeLaTira({
      tira: tiraDelPase(config, meta),
      colores,
      logo: logoNegocio,
      saldo,
    })),
  };

  // El aviso por cercanía lo trae el PLAN (0124), o lo regala un
  // complemento suelto (0123) para una cortesía o una prueba. No
  // alcanza con que el negocio tenga coordenadas cargadas.
  const { data: regalado } = await db.rpc("tiene_addon", {
    p_rancho_id: ranchoId,
    p_addon: "pases_cercania",
  });
  const tieneCercania = puede(
    (negocio as { plan_lealtad?: string | null }).plan_lealtad ?? null,
    "cercania",
    regalado === true ? ["pases_cercania"] : [],
  );

  const passJson = construirPassJson({
    negocioNombre: negocio.nombre,
    saldo,
    meta,
    config,
    // Lo que hace que un cupón diga «30% OFF» y no «Beneficio».
    beneficio,
    serialNumber,
    passTypeIdentifier: credenciales.passTypeIdentifier,
    teamIdentifier: credenciales.teamIdentifier,
    ubicacion: tieneCercania === true ? coordenadasDe(negocio) : null,
    // Con esto el pase se registra solo para recibir actualizaciones:
    // al sumar un sello, el teléfono lo refresca sin que el cliente
    // vuelva a bajarlo.
    authToken,
    webServiceUrl: `${SITIO_URL}/api/wallet`,
  });
  archivos["pass.json"] = Buffer.from(JSON.stringify(passJson, null, 2), "utf8");

  try {
    const pkpass = await empaquetarPase({ archivos, credenciales, ahora });
    return { ok: true, pkpass, serialNumber };
  } catch (e) {
    // El caso típico es el certificado vencido, y su mensaje ya viene
    // en español con la fecha.
    return { ok: false, motivo: e instanceof Error ? e.message : "No se pudo firmar el pase." };
  }
}

/**
 * Una imagen del negocio, si la configuró. Un fallo bajándola NO tumba
 * el pase: quien llama se cae a lo de siempre, que es peor pero sirve.
 */
async function bajarImagen(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * `logo.png` y sus escalas, arriba a la izquierda del pase.
 *
 * Bajar el archivo puede fallar (eso lo cubre `bajarImagen`) pero
 * DIBUJARLO también: un «png» que en realidad es otra cosa, un archivo
 * cortado a medio subir, un formato que sharp no conoce. Ese error se
 * escapaba hasta arriba y dejaba al cliente sin tarjeta por una imagen
 * mala — cuando el negocio que nunca subió logo recibe la suya sin
 * problema. Acá se cae a ese mismo camino: el nombre en Montserrat.
 */
async function archivosDelLogo(
  nombre: string,
  imagen: Buffer | null,
): Promise<Record<string, Buffer>> {
  const dibujar = async (img: Buffer | null) => ({
    "logo.png": await dibujarLogo({ nombre, imagen: img, ancho: 160, alto: 50 }),
    "logo@2x.png": await dibujarLogo({ nombre, imagen: img, ancho: 320, alto: 100 }),
    "logo@3x.png": await dibujarLogo({ nombre, imagen: img, ancho: 480, alto: 150 }),
  });

  if (!imagen) return dibujar(null);
  try {
    return await dibujar(imagen);
  } catch (e) {
    console.warn("[wallet] No se pudo dibujar el logo del negocio:", e);
    return dibujar(null);
  }
}

/**
 * `strip.png` y sus escalas: la banda del negocio, los sellos, o las
 * dos cosas en la misma imagen (ver `tiraDelPase`).
 *
 * Todo lo que se dibuja con la foto del dueño va envuelto: una imagen
 * que sharp no puede procesar NO puede dejar sin pase a un cliente que
 * está en el mostrador. Se degrada en el orden que menos se nota —
 * sellos sobre la foto → sellos sobre el color → sin strip— y el motivo
 * queda en los logs, porque «no se ve mi banda» sin rastro es un
 * misterio y con rastro es un ticket.
 */
async function archivosDeLaTira({
  tira,
  colores,
  logo,
  saldo,
}: {
  tira: TiraDelPase;
  colores: ColoresTarjeta;
  /** El logo va DENTRO de cada sello, no solo arriba del pase. */
  logo: Buffer | null;
  saldo: number;
}): Promise<Record<string, Buffer>> {
  if (tira.tipo === "ninguna") return {};

  // La foto se baja UNA vez y se recorta por escala: es la misma imagen
  // en tres tamaños, no tres descargas.
  const banda = await bajarImagen(tira.banda);

  const enTresEscalas = async (dibujar: (escala: 1 | 2 | 3) => Promise<Buffer>) => {
    const salida: Record<string, Buffer> = {};
    for (const escala of [1, 2, 3] as const) {
      salida[escala === 1 ? "strip.png" : `strip@${escala}x.png`] = await dibujar(escala);
    }
    return salida;
  };

  if (tira.tipo === "banda") {
    if (!banda) return {};
    try {
      return await enTresEscalas((escala) => dibujarBanda({ imagen: banda, escala }));
    } catch (e) {
      console.warn("[wallet] No se pudo dibujar la banda del pase:", e);
      return {};
    }
  }

  const sellos = (fondo: Buffer | null) => (escala: 1 | 2 | 3) =>
    dibujarTiraDeSellos({
      total: tira.total,
      logrados: Math.min(saldo, tira.total),
      colores,
      imagen: logo,
      banda: fondo,
      escala,
    });

  if (banda) {
    try {
      return await enTresEscalas(sellos(banda));
    } catch (e) {
      console.warn("[wallet] La banda no sirvió de fondo de los sellos:", e);
    }
  }
  try {
    return await enTresEscalas(sellos(null));
  } catch (e) {
    console.warn("[wallet] No se pudo dibujar la tira de sellos:", e);
    return {};
  }
}

function coordenadasDe(negocio: Record<string, unknown>) {
  const lat = Number(negocio.latitud);
  const lon = Number(negocio.longitud);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitud: lat, longitud: lon };
}
