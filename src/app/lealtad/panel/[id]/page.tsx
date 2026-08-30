import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardVacia, PildoraEstado } from "@/components/panel/piezas";
import {
  BAJADA_PANTALLA,
  CUERPO,
  EYEBROW_NEUTRO,
  GAP_TABLERO,
  RADIO_CARD,
  RADIO_TILE,
  ROTULO_CIFRA,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
import {
  ACCION,
  ACCION_BORDE,
  ACCION_TINTA,
  ACCION_TINTE,
  BOTON_ACCION,
  BOTON_LEALTAD,
} from "../sistema-lealtad";
import "../panel-oscuro.css";
import { verificarAccesoLealtad } from "@/lib/auth";
import { COOKIE_AVISOS, avisosOcultosDe } from "@/lib/lealtad/avisos-ocultos";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, estadoDelLimite } from "@/lib/lealtad/planes";
import { estadoCupoNotificaciones } from "@/lib/lealtad/cupo-notificaciones";
import { estadoDePrueba } from "@/lib/lealtad/prueba";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { minutoISOCR } from "@/lib/fechas";
import SeccionProgramas, { type ProgramaEnLista } from "./seccion-programas";
import SelectorTarjetaActiva from "./selector-tarjeta-activa";
import { estadoVisible, operaAhora } from "@/lib/lealtad/programas";
import {
  elegirDeFilasCrudas,
  filasCrudasPorAntiguedad,
  resumenDeFila,
} from "@/lib/wallet/programa-principal";
import { llaveDeTarjeta, tarjetaConLlaveDeFila } from "@/lib/lealtad/llave-tarjeta";
import { cupoLleno, lasQueOcupanCupo } from "./cupo-tarjetas";
import { tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { registraCompraElTipo } from "@/lib/lealtad/mostrador";
import { permisosDeFila } from "@/lib/lealtad/permisos";
import { cargarLealtad } from "./datos-lealtad";
import ShellLealtad, { type GrupoLealtad } from "./shell-lealtad";
import InicioLealtad, {
  type ClienteComprador,
  type ClienteRecurrente,
  type EnlacesInicio,
  type EstadoPaquete,

} from "./inicio-lealtad";
import ModoMostrador from "./modo-mostrador";
import BotonEscanear from "./boton-escanear";
import LealtadEstado from "./lealtad-estado";
import ClientesVistas from "./clientes-vistas";
import TabsContenido from "./tabs-contenido";
import ClientesAuditoria from "./clientes-auditoria";
import { cargarClientesAuditados } from "./clientes-datos";
import MarketingLealtad from "./marketing-lealtad";
import CompartirTarjeta, { type TarjetaCompartible } from "./compartir-tarjeta";
import { BloqueEstado } from "./pases-panel";
import EditorRecompensas from "./editor-recompensas";
import SeccionPlan from "./seccion-plan";
import FacturacionConTarjeta from "./facturacion-tarjeta";
import { suscripcionDelNegocio } from "@/lib/pagos/puerta-supabase";
import { AvisoError, AvisoGuardado, ProveedorPrograma } from "./programa-contexto";
import MetricasLealtad from "./metricas";
import ImpactoComercial from "./impacto-comercial";
import AuditoriaResumen from "./auditoria-resumen";
import EquipoLealtad, { type MiembroEquipo } from "./equipo-cliente";
import LinkScanLealtad from "./link-scan";
import { ActividadLealtad, IntegracionesLealtad, WalletLealtad } from "./lealtad-secciones";
import SeccionDevelopers from "./seccion-developers";
import SeccionUbicaciones from "./seccion-ubicaciones";
import type { UbicacionFila } from "./ubicaciones-actions";
import SeccionProductos from "./seccion-productos";
import { catalogoDelNegocio, productosParaVender } from "@/lib/lealtad/productos-db";
import type { ProductoCatalogo, ProductoDeVenta } from "@/lib/lealtad/productos";
import type { ProgramaFila, RecompensaFila } from "./pases-actions";

/**
 * LA interfaz del programa de lealtad de un negocio.
 *
 * Menú lateral con las secciones agrupadas (el shell vive en
 * shell-lealtad.tsx), tema navy de la marca de lealtad, y el contenido
 * en tarjetas translúcidas que el bloque .lealtad-oscuro de globals.css
 * re-mapea desde los componentes del panel claro.
 *
 * QUÉ VE CADA QUIEN lo decide el servidor, acá, y no el navegador
 * (0127). El shell solo pinta la lista de secciones que le llega:
 *
 *   Inicio · Clientes · Póster · Mi perfil  → todos los que entran
 *   Actividad · Métricas                    → permiso `auditoria`
 *   Equipo · Negocio · Recompensas ·
 *   Tarjeta digital · Plan                  → el dueño (y Bookea)
 *   Modo mostrador                          → permiso `acreditar`
 *
 * «Recompensas» y «Tarjeta digital» editan la misma fila, así que van
 * envueltas en <ProveedorPrograma>: un solo borrador para las dos, o
 * guardar en una revierte lo que se guardó en la otra.
 */

const NAVY_PROFUNDO = "#0a1226";

export const metadata = { title: "Programa de lealtad · Bookea" };

export default async function PanelNegocioLealtad({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    // De vuelta de Stripe Checkout: `?pago=listo` o `?pago=cancelado`.
    // OJO — es un AVISO y nada más: ningún plan se activa por lo que
    // diga esta URL, que se escribe a mano. Activa el webhook firmado
    // (src/app/api/stripe/webhook/route.ts) y nadie más.
    pago?: string;
    // Qué tarjeta mirar en Clientes/Actividad/Métricas cuando el
    // negocio tiene más de una — ver `selector-tarjeta-activa.tsx`.
    // Se valida abajo contra las tarjetas REALES del negocio antes de
    // usarse; nunca se confía en el string suelto de la URL.
    tarjeta?: string;
  }>;
}) {
  const { id } = await params;
  const { pago, tarjeta } = await searchParams;
  const avisoPago = pago === "listo" || pago === "cancelado" ? pago : null;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.ok) redirect("/lealtad/panel");
  const { permisos } = acceso;

  // La llave de servicio, UNA vez para toda la página: con ella se lee
  // lo que la RLS no le muestra a un colaborador (un programa pausado,
  // el vencimiento del addon) y se pide `*` sin lista de columnas —
  // `authenticated` ya no tiene permiso de tabla completa sobre
  // `ranchos` (0155). El chequeo de seguridad real ya pasó arriba:
  // `verificarAccesoLealtad`, con redirect si no.
  const admin = createAdminClient();

  // Quién puede qué. Sale del acceso ya verificado, sin una consulta
  // más — y se resuelve acá arriba porque decide QUÉ entra en la
  // primera tanda de consultas. «Negocio», «Recompensas», «Tarjeta
  // digital» y «Plan» son del DUEÑO: colores, logo, regalías y paquete
  // se tocan sin pedirle permiso a nadie. Los colaboradores no las ven
  // — su checklist gobierna la operación diaria, no la identidad ni la
  // plata de la marca. `puedeEquipo` es la misma expresión hoy, pero se
  // mantienen separados por si algún día divergen.
  const puedeEquipo = acceso.esDueno || acceso.esAdmin;
  const puedeDisenar = acceso.esDueno || acceso.esAdmin;

  // El "ahora" en hora de Costa Rica, resuelto UNA vez en el servidor.
  // De acá salen los estados «programada» y «vencida»: si cada tarjeta
  // leyera su propio reloj, una lista larga podría cruzar la medianoche
  // a la mitad y mostrar dos verdades distintas en la misma pantalla.
  //
  // `minutoISOCR` y no un Intl armado acá: la página pública del QR y
  // los dos generadores de pases usan ese mismo minuto para decidir qué
  // tarjeta manda, y dos formas de escribir la misma hora es la manera
  // de que un día no coincidan.
  const ahoraCR = minutoISOCR();

  /**
   * ═══════════════════════════════════════════════════════════════
   *  EL MAPA DE DEPENDENCIAS DE LAS CONSULTAS
   * ═══════════════════════════════════════════════════════════════
   *
   * Este render llegó a encadenar ~16 consultas EN FILA y el TTFB del
   * panel las pagaba todas sumadas — casi ninguna necesitaba el
   * resultado de la anterior: la fila era solo el orden en que estaban
   * escritas. Ahora van en TRES tandas de `Promise.all` (después de
   * `verificarAccesoLealtad`, que es el portón y va solo), y la regla
   * para no romperlas es una: una consulta entra en la tanda N solo si
   * TODO lo que necesita ya salió de la tanda N−1.
   *
   *   TANDA 1 — solo necesitan `id` y el acceso ya verificado:
   *     rancho · tiene_addon(lealtad) · programa_lealtad (todas las
   *     tarjetas) · tiene_addon(cercanía) · perfil de quien mira ·
   *     colaboradores_del_rancho · lealtad_ubicaciones · catálogo
   *     (0198) · productos de venta · addons_negocio.vence_en
   *
   *   TANDA 2 — necesitan las FILAS de programa_lealtad (la tarjeta
   *   principal `p` y la mirada `pVista` se eligen EN MEMORIA entre
   *   una tanda y otra, no con otra consulta):
   *     miembros (conteo por tarjeta) · recompensas de `p` ·
   *     recompensas de `pVista` (solo si es otra) · contextoDeCuenta
   *     (plan y cuenta, 0134)
   *
   *   TANDA 3 — necesitan la META (recompensas) o el PLAN (cuenta):
   *     cargarLealtad (ledger) · clientes auditados de `p` · clientes
   *     auditados de `pVista` · suscripción con tarjeta (0143) · cupo
   *     de notificaciones (0183)
   *
   * Los cortes tempranos (negocio en revisión, sin el complemento)
   * siguen cortando después de la tanda 1: en esos casos —los raros—
   * sobran unas lecturas que ya venían en paralelo, puro SELECT sin
   * efectos. El camino que importa, el panel que un negocio abre cien
   * veces por día, deja de pagar la fila entera.
   */
  const [
    // `select *` a propósito: lealtad_aprobado_en (0129) puede no
    // existir todavía en la base.
    { data: rancho },
    { data: tieneAddon },
    // TODAS las tarjetas del negocio. Desde la 0134 puede haber varias
    // (el `unique(rancho_id)` se liberó). `select *` porque las
    // columnas de las 0134/0135/0136 pueden no existir todavía y una
    // lista explícita fallaría entera.
    { data: filasProgramas },
    // El complemento de cercanía (0123): lo pide el editor de la
    // tarjeta para saber si ofrece el aviso por ubicación.
    { data: cercania },
    // Quién está mirando: el nombre sale de `perfiles`, nunca de la
    // metadata que el cliente puede escribir.
    { data: perfil },
    // El equipo (solo lo carga quien lo puede editar).
    { data: equipoCrudo },
    // Geo-Push (0196): las ubicaciones del negocio. Se guarda la
    // respuesta ENTERA porque el error importa — ver el mapeo abajo.
    respuestaUbicaciones,
    // El catálogo de productos (0198), pantalla de CONFIGURACIÓN del
    // dueño — el porqué de los dos lectores distintos está abajo,
    // donde se usan.
    catalogo,
    // El desplegable de la CAJA: solo activos, y lo ve también un
    // colaborador — por eso cuelga de `permisos.acreditar`.
    productosDeVenta,
    // El vencimiento de la prueba, para la cuenta regresiva del panel.
    { data: filaAddonPlan },
  ] = await Promise.all([
    (admin ?? acceso.supabase).from("ranchos").select("*").eq("id", id).maybeSingle(),
    acceso.supabase.rpc("tiene_addon", { p_rancho_id: id, p_addon: "lealtad" }),
    admin
      ? admin.from("programa_lealtad").select("*").eq("rancho_id", id)
      : Promise.resolve({ data: [] }),
    acceso.supabase.rpc("tiene_addon", { p_rancho_id: id, p_addon: "pases_cercania" }),
    acceso.supabase.from("perfiles").select("nombre").eq("id", acceso.user.id).maybeSingle(),
    puedeEquipo
      ? acceso.supabase.rpc("colaboradores_del_rancho", { p_rancho: id })
      : Promise.resolve({ data: null }),
    admin && puedeDisenar
      ? admin
          .from("lealtad_ubicaciones")
          .select("id, nombre, latitud, longitud, mensaje")
          .eq("rancho_id", id)
          .order("created_at", { ascending: true })
      : Promise.resolve(null),
    admin && puedeDisenar
      ? catalogoDelNegocio(admin, id)
      : Promise.resolve<ProductoCatalogo[] | null>(null),
    admin && permisos.acreditar
      ? productosParaVender(admin, id)
      : Promise.resolve<ProductoDeVenta[]>([]),
    admin && puedeDisenar
      ? admin
          .from("addons_negocio")
          .select("vence_en")
          .eq("rancho_id", id)
          .eq("addon", "lealtad")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!rancho) redirect("/lealtad/panel");

  // ── En revisión (0129): creado pero sin aprobar por Bookea ──────────
  // Si la columna no existe todavía, el negocio se trata como aprobado
  // — el comportamiento de antes de la migración.
  const enRevision =
    "lealtad_aprobado_en" in rancho && rancho.lealtad_aprobado_en === null && !acceso.esAdmin;
  if (enRevision) {
    return (
      <Antesala nombre={rancho.nombre}>
        <p className="text-[15px] font-extrabold text-aventurea-ink">Tu negocio está en revisión</p>
        <p className={`mx-auto mt-2 max-w-[440px] ${CUERPO}`}>
          El equipo de Bookea revisa cada negocio nuevo antes de habilitarle el programa de
          lealtad. Te avisamos al correo apenas quede aprobado — de ahí elegís tu paquete y
          dejás la solicitud.
        </p>
      </Antesala>
    );
  }

  // ── Sin el complemento: acá se pide, no se configura ────────────────
  if (tieneAddon !== true) {
    // Dos preguntas independientes, en UNA tanda:
    //
    //   · ¿Ya hay una solicitud esperando? (0126; si no corrió, se
    //     ignora.)
    //   · ¿O es que se le TERMINÓ LA PRUEBA? No es lo mismo que
    //     «todavía no tiene el programa»: este negocio lo tuvo, lo
    //     armó, tiene clientes con sellos adentro, y lo que necesita
    //     leer es qué pasó y qué conserva — no un texto de bienvenida
    //     que lo deje pensando que perdió todo. La fila se lee con la
    //     llave de servicio porque la política de `addons_negocio`
    //     (0077) solo se la muestra al dueño, y a esta pantalla
    //     también entran los colaboradores.
    const [{ data: solicitud }, { data: filaAddon }] = await Promise.all([
      acceso.supabase
        .from("solicitudes_lealtad")
        .select("plan, created_at")
        .eq("rancho_id", id)
        .eq("estado", "pendiente")
        .maybeSingle(),
      admin
        ? admin
            .from("addons_negocio")
            .select("activo, vence_en")
            .eq("rancho_id", id)
            .eq("addon", "lealtad")
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const prueba = estadoDePrueba({
      plan: (rancho.plan_lealtad as string | null) ?? null,
      venceEn: (filaAddon?.vence_en as string | null) ?? null,
    });
    const pruebaTerminada = prueba.vencida && !!filaAddon?.activo;

    return (
      <Antesala nombre={rancho.nombre}>
        {pruebaTerminada ? (
          <>
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Se terminaron tus 14 días de prueba
            </p>
            <p className={`mx-auto mt-2 max-w-[460px] ${CUERPO}`}>
              Tu programa quedó <b className="text-aventurea-ink">en pausa</b>: por ahora no se
              pueden dar sellos, canjear premios ni emitir tarjetas nuevas.
            </p>
            <p
              className={`mx-auto mt-3 max-w-[460px] ${RADIO_TILE} px-4 py-3 text-[13px] font-bold leading-relaxed text-aventurea-ink`}
              style={{ background: ACCION_TINTE }}
            >
              No se borró nada. Tus clientes, sus sellos y los pases que ya tienen en el
              teléfono siguen exactamente como estaban — elegí un paquete y todo vuelve tal
              cual lo dejaste.
            </p>
            <Link
              href={`/lealtad/planes?negocio=${id}`}
              className={`${BOTON_ACCION} mt-5 h-12 px-6 text-[14px]`}
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              Elegir mi paquete →
            </Link>
          </>
        ) : solicitud ? (
          <>
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Tu solicitud del plan {definicionDe(solicitud.plan as string)?.nombre ?? ""} está en
              revisión
            </p>
            <p className={`mx-auto mt-2 max-w-[420px] ${CUERPO}`}>
              El equipo de Bookea la está armando para que quede bien. Te avisamos al correo
              cuando el programa esté activo.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-extrabold text-aventurea-ink">
              Este negocio todavía no tiene el programa de lealtad
            </p>
            <p className={`mx-auto mt-2 max-w-[420px] ${CUERPO}`}>
              Elegí tu paquete y dejá la solicitud: el equipo de Bookea genera el programa y la
              tarjeta por vos, y te avisa cuando esté listo.
            </p>
            <Link
              href={`/lealtad/planes?negocio=${id}`}
              className={`${BOTON_ACCION} mt-5 h-12 px-6 text-[14px]`}
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              Ver los paquetes →
            </Link>
          </>
        )}
      </Antesala>
    );
  }

  // ── Con el complemento: los datos del programa (con la llave de
  //    servicio de arriba, porque un colaborador no puede leer un
  //    programa pausado por RLS) ────────────────────────────────────
  const todasLasFilas = (filasProgramas ?? []) as Record<string, unknown>[];

  // ── LA TARJETA PRINCIPAL: la que mandan Inicio, Clientes, Métricas
  //    y el editor del pase ─────────────────────────────────────────
  // Sale EN MEMORIA de las filas que ya se trajeron, y no de un
  // segundo `select ... .maybeSingle()`. Ese `maybeSingle` era de
  // cuando había UNA tarjeta por negocio: desde que la 0134 liberó el
  // `unique(rancho_id)`, con dos tarjetas devuelve error y `data` en
  // null — o sea que el negocio que MÁS tiene era el que veía «todavía
  // no hay programa» en media pantalla.
  //
  // Se elige la que está emitiendo pases; si ninguna, la primera que no
  // esté archivada; y si todas lo están, la primera. Siempre la misma
  // para todas las secciones: dos criterios distintos mostrarían dos
  // tarjetas distintas en la misma visita.
  //
  // Y la elección NO vive acá: la comparte con la página pública del QR
  // y con los dos generadores de pases (`elegirDeFilasCrudas`, el
  // mismo `elegirPrograma` para filas crudas), para que el dueño
  // configure exactamente la tarjeta que su cliente recibe. Se elige
  // ANTES de contar miembros a propósito: la elección solo mira
  // estado, vigencias y antigüedad, así que no tiene por qué esperar
  // esa consulta — y eso es lo que deja pedir sus recompensas en la
  // misma tanda que el conteo.
  const p = elegirDeFilasCrudas(todasLasFilas, ahoraCR) as ProgramaFila | null;

  // ── LA TARJETA QUE SE ESTÁ MIRANDO en Clientes/Actividad/Métricas ──
  // Por defecto es la misma principal (`p`): para el negocio con una
  // sola tarjeta nada cambia. `?tarjeta=<id>` la pisa, y SOLO si ese
  // id está en `todasLasFilas` —las tarjetas reales de ESTE
  // negocio—, nunca confiando en el string suelto de la URL.
  //
  // El botón grande «Escanear» del shell, «Recompensas» y el resto de
  // Inicio siguen atados a `p`/`meta`: cambiar de pestaña acá NO
  // cambia a qué tarjeta acredita un escaneo desde el botón de
  // siempre. Esto es SOLO para mirar y operar el mostrador/auditoría
  // de la tarjeta elegida — ver selector-tarjeta-activa.tsx.
  const tarjetaVistaId =
    tarjeta && todasLasFilas.some((f) => f.id === tarjeta) ? tarjeta : (p?.id ?? null);
  const pVista = (
    tarjetaVistaId === p?.id ? p : (todasLasFilas.find((f) => f.id === tarjetaVistaId) ?? null)
  ) as ProgramaFila | null;

  const idsProgramas = todasLasFilas.map((f) => f.id as string);

  // ── TANDA 2: lo que necesita las filas de programa_lealtad ────────
  const [
    // Los miembros de cada tarjeta, en UNA consulta y no una por
    // tarjeta.
    { data: filasMiembros },
    { data: recompensas },
    // La recompensa activa de la tarjeta que se está mirando, si es
    // DISTINTA de la principal — mismo criterio que ya corre para `p`,
    // una sola vez más solo cuando hace falta.
    { data: recompensasVista },
    // El plan sale de la CUENTA desde la 0134 (`cuentas.plan`), con el
    // del rancho como respaldo mientras la migración no esté corrida.
    // Toda la pantalla —topes, capacidades, medidores— cuelga de acá,
    // así que resolverlo en UN lugar evita que media pantalla muestre
    // el plan nuevo y la otra media el viejo.
    contextoCuenta,
  ] = await Promise.all([
    admin && idsProgramas.length
      ? admin.from("miembros").select("programa_id").in("programa_id", idsProgramas)
      : Promise.resolve({ data: [] }),
    admin && p
      ? admin
          .from("recompensas")
          .select("*")
          .eq("programa_id", p.id)
          .order("costo_puntos", { ascending: true })
      : Promise.resolve({ data: [] }),
    admin && pVista && pVista.id !== p?.id
      ? admin
          .from("recompensas")
          .select("*")
          .eq("programa_id", pVista.id)
          .order("costo_puntos", { ascending: true })
      : Promise.resolve({ data: null }),
    admin
      ? contextoDeCuenta(admin, (p ?? {}) as Record<string, unknown>, {
          planRancho: rancho.plan_lealtad as string | null,
        })
      : Promise.resolve({ plan: (rancho.plan_lealtad as string | null) ?? null, cuentaId: null }),
  ]);

  const miembrosPorPrograma = new Map<string, number>();
  for (const m of (filasMiembros ?? []) as { programa_id: string }[]) {
    miembrosPorPrograma.set(m.programa_id, (miembrosPorPrograma.get(m.programa_id) ?? 0) + 1);
  }

  const programasEnLista: ProgramaEnLista[] = todasLasFilas.map((f) => ({
    id: f.id as string,
    nombre: (f.nombre as string) ?? "Tarjeta",
    modo: (f.modo as string | null) ?? null,
    estado: (f.estado as string | null) ?? null,
    activo: !!f.activo,
    vigente_desde: (f.vigente_desde as string | null) ?? null,
    vigente_hasta: (f.vigente_hasta as string | null) ?? null,
    colorFondo: (f.pase_color_fondo as string | null) ?? null,
    miembros: miembrosPorPrograma.get(f.id as string) ?? 0,
    // OBLIGATORIO aunque la sección no lo dibuje: `lasQueOcupanCupo`
    // y el desempate por antigüedad de la elección (que ahora corre
    // sobre las filas crudas, arriba) miran esta fecha. Sin ella el
    // desempate cae al uuid y el panel elige una tarjeta distinta de
    // la que sirven el link público y el pase.
    created_at: typeof f.created_at === "string" ? f.created_at : null,
  }));

  // La misma tarjeta que `p`, en la forma que consumen las secciones.
  const principal = p ? (programasEnLista.find((f) => f.id === p.id) ?? null) : null;

  // Para el link directo de la caja (0206) — ver link-scan.tsx. Solo lo
  // que esa card necesita: nombre y si ese link deja atender a mano.
  const tarjetasParaLink = todasLasFilas.map((f) => ({
    id: f.id as string,
    nombre: (f.nombre as string) ?? "Tarjeta",
    permiteManual: f.permite_manual_en_link === true,
  }));

  // ── EL LINK DE CADA TARJETA ────────────────────────────────────
  // Uno por tarjeta, ordenadas de la más vieja a la más nueva. La
  // PRIMERA es la que sirve el link corto `/tarjeta/<negocio>`, o sea
  // la del QR que el negocio ya tiene impreso y pegado en la caja: por
  // eso se marca, y por eso su sufijo va vacío. Ver `llave-tarjeta.ts`
  // y `laDelLinkDelNegocio`.
  const porAntiguedad = filasCrudasPorAntiguedad(todasLasFilas);
  const tarjetasCompartibles: TarjetaCompartible[] = porAntiguedad.map((f, i) => ({
    id: f.id as string,
    nombre: (f.nombre as string) ?? "Tarjeta",
    sufijo: i === 0 ? "" : `/${llaveDeTarjeta(tarjetaConLlaveDeFila(f))}`,
    esLaDelQrImpreso: i === 0,
    emitiendo: operaAhora(resumenDeFila(f), ahoraCR),
  }));

  const lista = (recompensas ?? []) as RecompensaFila[];
  const meta = lista.find((r) => r.activo) ?? null;
  const metaVista: RecompensaFila | null =
    pVista?.id === p?.id ? meta : ((recompensasVista as RecompensaFila[] | null)?.find((r) => r.activo) ?? null);

  const { plan, cuentaId } = contextoCuenta;
  const def = definicionDe(plan);

  // «Activo» acá es la pregunta que decide si el QR lleva a algún lado,
  // así que se responde con `operaAhora`: una tarjeta con estado activo
  // pero vencida NO emite pases, y decir que sí mandaría a imprimir un
  // póster con un código que responde «no encontrado».

  // Las archivadas no cuentan como tarjetas que el negocio tenga: para
  // volver a emitir hay que crear otra, no reanimar la archivada. El
  // MISMO criterio que aplica el servidor al crear (`cupo-tarjetas.ts`).
  const vivas = lasQueOcupanCupo(programasEnLista, ahoraCR);
  const operan = vivas.filter((f) => operaAhora(f, ahoraCR)).length;

  // ── TANDA 3: lo que necesita la meta (recompensas) o el plan ──────
  const [
    // Lo que dice el ledger. La misma llamada que hace <LealtadEstado>:
    // `cargarLealtad` está envuelta en `cache()`, así que las dos
    // secciones del mismo render comparten una sola consulta.
    datosLealtad,
    // El Top 5 del tablero de Inicio SIEMPRE de la tarjeta PRINCIPAL
    // (`p`), nunca de la que esté seleccionada en el selector de
    // Clientes/Métricas (`pVista`): son pantallas distintas y no
    // tienen por qué mirar la misma tarjeta. `cargarClientesAuditados`
    // ya trae `visitas` por miembro (movimientos 'ganado' del ledger)
    // — es el mismo número que ordena "más visitas" en Auditoría, no
    // un cálculo nuevo.
    //
    // Gateado por `permisos.auditoria`: es el MISMO dato que la
    // pestaña Auditoría de Clientes, que ya no le llega a un
    // colaborador con solo el permiso de acreditar (default de un
    // empleado invitado). Ponerlo sin cerrojo en Inicio le habría
    // abierto por atrás lo que Clientes le cierra por adelante.
    datosClientesPrincipal,
    // La vista de auditoría (clientes-datos.ts) se apoya en la MISMA
    // `cargarLealtad` de arriba — cache() por render, no es una
    // segunda consulta del padrón (y con una sola tarjeta es LA MISMA
    // llamada que la de `p`: el cache() la deduplica también dentro de
    // esta tanda). null cuando no hay programa todavía: la pestaña de
    // Auditoría se apaga sola, no se rompe.
    datosClientes,
    // La suscripción con tarjeta (0143), si la hay. Solo la carga
    // quien ve la sección Plan — y devuelve null sin la migración
    // corrida, así que el panel sigue funcionando igual mientras el
    // dueño la pega.
    suscripcion,
    // El mismo cupo que hace cumplir marketing-actions.ts (0183)
    // contra `notificaciones_promocionales` — fail-open sin `admin`,
    // mismo criterio que el resto de este archivo.
    limiteNotificaciones,
  ] = await Promise.all([
    cargarLealtad(p?.id ?? null, meta?.costo_puntos ?? null),
    p && permisos.auditoria
      ? cargarClientesAuditados(p.id, meta?.costo_puntos ?? null)
      : Promise.resolve(null),
    pVista
      ? cargarClientesAuditados(pVista.id, metaVista?.costo_puntos ?? null)
      : Promise.resolve(null),
    admin && puedeDisenar
      ? suscripcionDelNegocio(admin, { ranchoId: id, cuentaId })
      : Promise.resolve(null),
    admin
      ? estadoCupoNotificaciones(admin, id, plan)
      : Promise.resolve(estadoDelLimite(plan, "notificacionesMes", 0)),
  ]);

  const miembros = datosLealtad?.resumen.miembros ?? 0;

  const topRecurrentes: ClienteRecurrente[] = (datosClientesPrincipal?.clientes ?? [])
    .filter((c) => c.visitas > 0)
    .sort((a, b) => b.visitas - a.visitas)
    .slice(0, 5)
    .map((c) => ({ miembroId: c.miembroId, nombre: c.nombre, visitas: c.visitas }));

  // Misma fuente, ordenada por PLATA en vez de visitas — el otro lado
  // de "quién más vuelve". `gastoTotal` sale de `lealtad_transacciones`
  // (colones reales); en 0 cuando el negocio no registra montos, así
  // que esos clientes se filtran en vez de pintar un ₡0 que no dice
  // nada de ellos.
  const topGasto: ClienteComprador[] = (datosClientesPrincipal?.clientes ?? [])
    .filter((c) => c.gastoTotal > 0)
    .sort((a, b) => b.gastoTotal - a.gastoTotal)
    .slice(0, 5)
    .map((c) => ({ miembroId: c.miembroId, nombre: c.nombre, gastoTotal: c.gastoTotal }));

  const nombreUsuario =
    ((perfil?.nombre as string | null) ?? "").trim() || (acceso.user.email ?? "Tu cuenta");

  // El equipo, ya traído en la tanda 1 (solo para quien lo puede
  // editar); acá nada más se le da forma.
  let equipo: MiembroEquipo[] = [];
  if (puedeEquipo) {
    equipo = ((equipoCrudo ?? []) as {
      usuario_id: string;
      email: string;
      nombre: string;
      rol?: string | null;
      permisos_lealtad?: unknown;
    }[]).map((c) => ({
      usuario_id: c.usuario_id,
      email: c.email,
      nombre: c.nombre,
      // Sin la 0127 la RPC no trae rol: esos colaboradores siguen
      // siendo administradores, igual que antes de la migración.
      rol: c.rol ?? "administrador",
      // SIEMPRE el checklist GUARDADO (resuelto como empleado), no el
      // efectivo del rol: si el dueño baja a un administrador, hereda
      // su checklist real y no un "todo en true" fantasma.
      permisos: permisosDeFila("empleado", c.permisos_lealtad),
    }));
  }

  const slug = rancho.slug as string | null;

  // ── Geo-Push (0196): las ubicaciones del negocio ────────────────
  // `null` = la consulta falló (típicamente: la tabla no existe porque
  // la migración se aplica aparte). La sección se pinta con su aviso
  // neutro y el RESTO del panel sigue vivo — el mismo criterio
  // degradable que `suscripcionDelNegocio`. Por eso la tanda 1 guarda
  // la respuesta ENTERA: acá se distingue el error de la lista vacía.
  let ubicaciones: UbicacionFila[] | null = null;
  if (respuestaUbicaciones && !respuestaUbicaciones.error) {
    ubicaciones = ((respuestaUbicaciones.data ?? []) as Record<string, unknown>[]).map(
      (u): UbicacionFila => ({
        id: String(u.id),
        nombre: typeof u.nombre === "string" ? u.nombre : "",
        latitud: Number(u.latitud),
        longitud: Number(u.longitud),
        mensaje: typeof u.mensaje === "string" ? u.mensaje : "",
      }),
    );
  }

  // ── El catálogo de productos (0198), traído en la tanda 1 ──────
  // DOS lecturas distintas, y no son la misma por quién las usa:
  //
  //   · `catalogo` es la pantalla de CONFIGURACIÓN, del dueño: trae
  //     también los desactivados, porque son suyos y los tiene que
  //     poder volver a encender. `null` = la migración no está pegada,
  //     y la sección lo dice con su aviso neutro sin tumbar el panel.
  //   · `productosDeVenta` es el desplegable de la CAJA: solo los
  //     activos, y lo ve también un colaborador — por eso cuelga de
  //     `permisos.acreditar` y NUNCA de `puedeDisenar`. Definir el
  //     precio es del dueño; elegir el producto al cobrar, de quien
  //     está atendiendo.
  //
  // Las dos degradan a «no hay catálogo» sin la 0198, y entonces el
  // mostrador queda exactamente como antes: monto a mano.

  // La cuenta regresiva de la prueba. Se pinta EN EL PANEL y no solo en
  // un correo a propósito: el correo se pierde, se filtra o se lee
  // tarde, y el panel es el lugar donde el dueño ya está mirando su
  // programa. Con la fecha a la vista, que la prueba se termine deja de
  // ser una sorpresa aunque el aviso por correo nunca haya salido.
  const prueba = estadoDePrueba({
    plan,
    venceEn: (filaAddonPlan?.vence_en as string | null) ?? null,
  });

  const topeProgramas = def?.limites.programas ?? null;
  const limiteClientes = estadoDelLimite(plan, "clientesActivos", miembros);

  // Qué avisos de puesta en marcha cerró QUIEN MIRA (la X del tablero).
  // Se lee acá, en el servidor, para que el aviso cerrado ni siquiera se
  // dibuje: guardado en el navegador se pintaría un cuadro antes de
  // esconderse, que es exactamente la sensación de que la X no sirvió.
  const avisosOcultos = avisosOcultosDe((await cookies()).get(COOKIE_AVISOS)?.value, id);

  // (0163) Rediseño del rail: de 16 ítems en 3 grupos a 9 en uno solo.
  // Actividad se fundió adentro de Clientes (misma pregunta, dos
  // respuestas — ver ClientesVistas); Ventas se fundió adentro de
  // Métricas, como una pestaña propia y no enterrada al final (la 0197
  // ya había aprendido esa lección al revés, sacándola de ahí — acá se
  // vuelve a juntar pero SIN perder su prominencia); Negocio,
  // Recompensas, Productos, Ubicación y Equipo se fundieron en una
  // sola «Configuración» con pestañas. Mi perfil y Mis negocios se
  // mudaron al menú del avatar en la barra superior (shell-lealtad.tsx)
  // — ya no son ítems del rail.
  const grupos: GrupoLealtad[] = [
    {
      titulo: "Principal",
      items: [
        // Inicio ES el mostrador para quien puede acreditar (ver el
        // comentario grande de `mostradorEsElInicio`), y por eso lleva el
        // ícono del escáner: el ítem tiene que decir a qué pantalla
        // lleva, no repetir la palabra «inicio».
        {
          id: "inicio",
          etiqueta: "Inicio",
          icono: p && permisos.acreditar ? ("escanear" as const) : ("inicio" as const),
        },
        // El tablero, debajo. Solo cuando Inicio se lo llevó el
        // mostrador: si no, Inicio ya ES el tablero y esto sería el
        // mismo contenido dos veces en el mismo menú.
        ...(p && permisos.acreditar
          ? [{ id: "dashboard", etiqueta: "Dashboard", icono: "inicio" as const }]
          : []),
        { id: "programas", etiqueta: "Tarjetas", icono: "tarjeta" as const },
        { id: "clientes", etiqueta: "Clientes", icono: "clientes" as const },
        ...(permisos.auditoria
          ? [{ id: "metricas", etiqueta: "Métricas", icono: "metricas" as const }]
          : []),
        ...(puedeDisenar ? [{ id: "marketing", etiqueta: "Marketing", icono: "campana" as const }] : []),
        ...(puedeDisenar
          ? [{ id: "configuracion", etiqueta: "Configuración", icono: "configuracion" as const }]
          : []),
        { id: "poster", etiqueta: "Póster y QR", icono: "poster" as const },
        ...(puedeDisenar ? [{ id: "plan", etiqueta: "Plan y facturación", icono: "plan" as const }] : []),
      ],
    },
  ];

  // Un botón que apunta a una sección que quien mira no tiene es un
  // callejón sin salida: el ancla solo se pinta si la sección existe.
  const visibles = new Set(grupos.flatMap((g) => g.items).map((i) => i.id));
  const ancla = (seccion: string) => (visibles.has(seccion) ? `#${seccion}` : null);

  // El tipo de la tarjeta principal sale del CATÁLOGO de ocho, con
  // `tipoDe` para tolerar lo desconocido. Antes se casteaba a mano a
  // tres valores («sellos» | «puntos» | «cashback»): con un cupón, una
  // gift card o un evento, esa lista mentía y los textos salían mal.
  const tipoPrincipal = tipoDe(p?.modo ?? null);


  // El asistente vive en su propia pantalla (ancho completo para el
  // formulario más la vista previa), la misma a la que manda la sección
  // «Tarjetas»: dos caminos distintos para crear lo mismo terminan en
  // dos experiencias que se desincronizan.
  const enlaces: EnlacesInicio = {
    crear: puedeDisenar ? `/lealtad/panel/${id}/crear` : null,
    // «Recompensas» vive adentro de Configuración desde la 0163. No es
    // la primera pestaña ahí (Negocio lo es), así que este enlace deja
    // a la persona en Configuración y a un toque de Recompensas — no
    // exactamente en la pestaña, por no armar un sub-hash nuevo para
    // esto solo.
    recompensas: ancla("configuracion"),
    // «Ir a diseñar la tarjeta» ahora abre SU editor, no una sección del
    // menú: la sección se quitó (ver el comentario en los ítems de
    // Configuración). Sin tarjeta principal todavía, se cae a la lista
    // —«Tarjetas»—, que es de donde se crea la primera.
    tarjeta:
      puedeDisenar && principal ? `/lealtad/panel/${id}/editar/${principal.id}` : ancla("programas"),
    poster: ancla("poster"),
    clientes: ancla("clientes"),
    programas: ancla("programas"),
    plan: ancla("plan"),
    marketing: ancla("marketing"),
    configuracion: ancla("configuracion"),
  };

  // El status del paquete que abre el tablero. Los dos topes son los
  // dos que el servidor HACE CUMPLIR, contados igual que quien los hace
  // cumplir: los clientes con `miembros` (el mismo número del ledger) y
  // las tarjetas con las VIVAS, que es lo que mira `crear-actions.ts`.
  const paquete: EstadoPaquete = {
    plan,
    clientes: limiteClientes,
    tarjetas: estadoDelLimite(plan, "programas", vivas.length),
    notificaciones: limiteNotificaciones,
    prueba,
    // Comparar paquetes es decidir plata: solo el dueño. El resto del
    // equipo ve el status —les sirve saber que el cupo está lleno— sin
    // un botón que los mandaría a una pantalla que no pueden usar.
    planes: puedeDisenar ? `/lealtad/planes?negocio=${id}` : null,
  };

  /**
   * ⚠️ «INICIO» YA NO ES EL TABLERO — es el MOSTRADOR.
   *
   * Pedido del dueño (26 ago 2026): «en el inicio tendremos activo el
   * modo mostrador, las mismas funciones ahí», y el tablero se muda a
   * una ventana nueva abajo que dice «Dashboard».
   *
   * El motivo es de uso, no de gusto: la pantalla que un negocio abre
   * cien veces por día es la de atender a alguien en la caja, no la de
   * mirar métricas. Tenerla a un clic de distancia era un clic por
   * cada cliente.
   *
   * ── QUIÉN NO PUEDE ACREDITAR VE EL TABLERO ──────────────────────
   * La sección «Escanear» siempre estuvo detrás de
   * `permisos.acreditar`. Si Inicio
   * fuera el mostrador para todos, un colaborador sin ese permiso
   * abriría el panel en una pantalla vacía. Para ellos Inicio SIGUE
   * siendo el tablero, y entonces no se dibuja «Dashboard» aparte —
   * sería el mismo contenido dos veces en el mismo menú.
   *
   * Y se cae el ítem «Escanear»: era exactamente este componente. Con
   * Inicio siendo el mostrador, dejarlo habría puesto la misma pantalla
   * dos veces, una debajo de la otra.
   */
  const mostradorEsElInicio = !!p && permisos.acreditar;

  const tablero = (
      <InicioLealtad
        negocioId={id}
        nombre={rancho.nombre}
        tarjeta={
          principal
            ? {
                nombre: principal.nombre,
                tipo: tipoPrincipal,
                estado: estadoVisible(principal, ahoraCR),
              }
            : null
        }
        tarjetas={{ vivas: vivas.length, operan }}
        regalia={meta ? { nombre: meta.nombre, costo: meta.costo_puntos } : null}
        resumen={datosLealtad?.resumen ?? null}
        paquete={paquete}
        enlaces={enlaces}
        avisosOcultos={avisosOcultos}
        topRecurrentes={topRecurrentes}
        topGasto={topGasto}
        accion={
          p && permisos.acreditar ? (
            <BotonEscanear
              ranchoId={id}
              // Mismo criterio que el mostrador — ver el comentario de
              // más abajo. Las dos puertas al escáner tienen que
              // preguntar lo mismo.
              pideMonto={registraCompraElTipo(tipoPrincipal)}
              productos={productosDeVenta}
              recompensa={
                meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
              }
            />
          ) : null
        }
      />
  );

  const contenidos: Record<string, React.ReactNode> = {
    // Inicio: el mostrador para quien puede acreditar; el tablero para
    // quien no. Ver el comentario de `mostradorEsElInicio`.
    inicio: mostradorEsElInicio ? (
      <Seccion
        eyebrow="En el mostrador"
        titulo="Atender a un cliente"
        bajada="Activá la cámara o buscá al cliente por nombre, correo o teléfono. Si ya completó su tarjeta, acá mismo le entregás el premio y la tarjeta arranca de cero."
        accion={
          /* La puerta al tutorial (pedido del dueño, 28 ago 2026). En
             pestaña nueva a propósito: quien está atendiendo en el
             mostrador no puede perder lo que tiene a medias por ir a
             leer cómo se hace. */
          <a href="/lealtad/ayuda" target="_blank" rel="noreferrer" className={BOTON_LEALTAD}>
            Tutorial de ayuda
          </a>
        }
      >
        <ModoMostrador
          ranchoId={id}
          programaId={p!.id}
          pideMonto={registraCompraElTipo(tipoPrincipal)}
          tipo={p!.modo ?? null}
          permisos={permisos}
          productos={productosDeVenta}
          recompensa={
            meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
          }
        />
      </Seccion>
    ) : (
      tablero
    ),

    // El tablero, en su ventana propia. Solo existe cuando Inicio se lo
    // llevó el mostrador: si no, sería el mismo contenido dos veces.
    ...(mostradorEsElInicio ? { dashboard: tablero } : {}),

    programas: (
      <Seccion
        eyebrow="Tu catálogo"
        titulo="Tarjetas"
        // La bajada dice dónde se toca el diseño porque la sección
        // «Tarjeta digital» del menú se quitó: quien la buscaba ahí
        // tiene que descubrir acá que se entra tocando la tarjeta.
        bajada="Todos los programas de tu negocio. Tocá una para cambiarle el diseño, las reglas o el estado."
      >
        <SeccionProgramas
          ranchoId={id}
          programas={programasEnLista}
          ahoraCR={ahoraCR}
          puedeCrear={puedeDisenar}
          // Cuenta las VIVAS, no todas: contando las archivadas, archivar
          // no liberaba nada y el aviso mandaba a hacer algo que no
          // servía. Es la misma cuenta que hace el servidor al crear.
          topeAlcanzado={cupoLleno({ ocupadas: vivas.length, tope: topeProgramas })}
          topePlan={topeProgramas}
        />
      </Seccion>
    ),

    clientes: (
      <Seccion
        eyebrow="Quién se afilió"
        titulo="Clientes"
        bajada="Quién se afilió, cuánto lleva cada quien y a quién le toca su regalía."
      >
        <SelectorTarjetaActiva
          ranchoId={id}
          programas={programasEnLista}
          activaId={pVista?.id ?? null}
          seccion="clientes"
        />
        {pVista ? (
          datosClientes ? (
            <ClientesVistas
              mostrador={
                <LealtadEstado
                  programaId={pVista.id}
                  plan={plan}
                  meta={metaVista?.costo_puntos ?? null}
                />
              }
              auditoria={
                <ClientesAuditoria ranchoId={id} programaId={pVista.id} datos={datosClientes} />
              }
              // La pestaña Actividad (0163: se fundió acá desde su
              // propio ítem del rail) — mismo candado que tenía como
              // sección propia.
              actividad={
                permisos.auditoria ? (
                  <>
                    <Rotulo>Quién hizo qué — últimos 30 días</Rotulo>
                    <AuditoriaResumen programaId={pVista?.id ?? null} />
                    <Rotulo className="mt-6">El libro, movimiento por movimiento</Rotulo>
                    <ActividadLealtad ranchoId={id} programaId={pVista?.id ?? null} />
                    <Rotulo className="mt-6">Canjes por pasar a la caja</Rotulo>
                    <IntegracionesLealtad ranchoId={id} programaId={pVista?.id ?? null} />
                  </>
                ) : null
              }
            />
          ) : (
            // Sin llave de servicio (entorno local sin configurar) la
            // auditoría no tiene con qué armarse: el mostrador de
            // siempre sigue andando, la pestaña nueva simplemente no
            // aparece en vez de mostrar una vista rota.
            <LealtadEstado
              programaId={pVista.id}
              plan={plan}
              meta={metaVista?.costo_puntos ?? null}
            />
          )
        ) : (
          <Vacio texto="Tu plan está activo y el equipo de Bookea está armando el programa y la tarjeta. Te avisamos al correo cuando esté listo." />
        )}
      </Seccion>
    ),

    marketing: <MarketingLealtad ranchoId={id} programaId={p?.id ?? null} />,

    poster: (
      <Seccion
        eyebrow="Repartí tu tarjeta"
        titulo="Póster y QR"
        bajada="Con esto tus clientes consiguen la tarjeta: el código para el mostrador y el link para mandar."
      >
        <Link
          href={`/lealtad/panel/${id}/poster`}
          className={`flex items-center justify-between gap-3 ${RADIO_TILE} border px-4 py-4 transition-colors hover:border-white/40`}
          style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
        >
          <span className="min-w-0">
            <span className="block text-[14px] font-extrabold leading-tight text-aventurea-ink">
              Diseñá e imprimí tu póster
            </span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-aventurea-ink-soft">
              Hoja A4 lista para pegar en la caja, con tu QR, tus colores y tu regalía.
            </span>
          </span>
          <span aria-hidden className="shrink-0 text-[18px]" style={{ color: ACCION }}>
            →
          </span>
        </Link>
        <CompartirTarjeta slug={slug} ranchoId={id} tarjetas={tarjetasCompartibles} />
      </Seccion>
    ),

    // «Mi perfil» ya no es una sección del rail (0163): su contenido
    // —rol, correo, los dos links— se mudó al menú del avatar en la
    // barra superior (shell-lealtad.tsx). `nombreUsuario` y el rol
    // calculado acá se le pasan a ShellLealtad como prop, ver el
    // render más abajo.

    // ⚠️ ACÁ VIVÍA LA SECCIÓN «ESCANEAR», Y SE FUE A «INICIO».
    //
    // Era el MISMO `ModoMostrador` que ahora abre el panel. Dejarla
    // habría puesto la misma pantalla dos veces, una debajo de la otra
    // en el mismo menú.
    //
    // El toggle de «Modo mostrador» de la barra superior NO se toca y
    // sigue siendo otra cosa: esconde el rail entero (0137/0148) para
    // que un empleado en la caja no toque configuración sin querer.
    // Inicio es la misma herramienta CON el menú a la vista, para el
    // dueño que atiende y además administra.

    // Métricas (0163): Ventas se fundió acá adentro, como pestaña propia
    // — no al final de la lista. La 0197 había aprendido esa lección al
    // revés (sacándola de Métricas porque enterrada ahí nadie la veía);
    // como pestaña con el mismo peso que «Crecimiento», la lección se
    // respeta: Ventas sigue tan a la vista como antes, solo que un
    // ítem menos en el rail.
    ...(permisos.auditoria
      ? {
          metricas: (
            <Seccion
              eyebrow="Cómo va creciendo"
              titulo="Métricas"
              bajada="¿Está creciendo el programa? Los últimos 30 días contra los 30 anteriores, y cuánto vendés con la tarjeta."
            >
              <SelectorTarjetaActiva
                ranchoId={id}
                programas={programasEnLista}
                activaId={pVista?.id ?? null}
                seccion="metricas"
              />
              <TabsContenido
                etiquetaGrupo="Qué métricas ver"
                pestanas={[
                  {
                    id: "crecimiento",
                    etiqueta: "Crecimiento",
                    contenido: (
                      <>
                        <MetricasLealtad
                          programaId={pVista?.id ?? null}
                          plan={plan}
                          meta={metaVista?.costo_puntos ?? null}
                        />
                        <Rotulo className="mt-6">Estado de las tarjetas</Rotulo>
                        <WalletLealtad programaId={pVista?.id ?? null} />
                      </>
                    ),
                  },
                  {
                    id: "ventas",
                    etiqueta: "Ventas",
                    contenido: <ImpactoComercial ranchoId={id} />,
                  },
                ]}
              />
            </Seccion>
          ),
        }
      : {}),

    // Configuración (0163): Negocio, Recompensas, Productos, Ubicación y
    // Equipo se fundieron en una sola sección con pestañas — antes eran
    // cinco ítems del rail que solo el dueño/admin veía. El gate es UNO
    // solo (`puedeDisenar`) para las cuatro primeras; Equipo sigue
    // colgando de `puedeEquipo` (misma expresión hoy, pero se
    // mantienen separados por si algún día divergen — ver el fetch de
    // `equipo` más arriba, que solo corre bajo `puedeEquipo`).
    // «Negocio» va PRIMERO a propósito: es la pestaña que abren los
    // anclas de «Primeros pasos» (`irA("configuracion", ...)`), y
    // `TabsContenido` arranca siempre en la primera.
    ...(puedeDisenar
      ? {
          configuracion: (
            <Seccion
              eyebrow="Ajustes del negocio"
              titulo="Configuración"
              bajada="Tu identidad, tus regalías, tu catálogo, tus puntos de aviso y tu equipo — todo en un solo lugar."
            >
              <TabsContenido
                etiquetaGrupo="Qué configurar"
                pestanas={[
                  {
                    id: "negocio",
                    etiqueta: "Negocio",
                    contenido: (
                      <Card
                        eyebrow="Ficha"
                        titulo="Los datos de tu negocio"
                        nivel="h3"
                        /* Publicada o no es un ESTADO, y el estado va en el
                           encabezado: sin slug el QR del póster lleva a una
                           página que no existe, así que no es un detalle. Azul y
                           no verde, como todo lo que está funcionando en
                           Lealtad — el verde queda fuera de la marca del
                           módulo (ver TONO_ESTADO). */
                        accion={
                          <PildoraEstado estado={slug ? "info" : "neutro"}>
                            {slug ? "Publicada" : "Sin publicar"}
                          </PildoraEstado>
                        }
                      >
                        <Campo etiqueta="Nombre" valor={rancho.nombre} />
                        <Campo
                          etiqueta="Dirección de tu tarjeta"
                          valor={slug ? `/tarjeta/${slug}` : "Sin publicar"}
                        />
                        <Campo etiqueta="Plan de lealtad" valor={def ? def.nombre : "Sin plan"} />
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/mi-negocio/${id}`} className={BOTON_LEALTAD}>
                            Editar en tu panel de negocio →
                          </Link>
                          {slug && (
                            <Link href={`/tarjeta/${slug}`} className={BOTON_LEALTAD}>
                              Ver la tarjeta del cliente →
                            </Link>
                          )}
                        </div>
                      </Card>
                    ),
                  },
                  // ── RECOMPENSAS = LAS REGALÍAS, no un asistente ─────────
                  // Acá vivía el CREADOR de tarjetas entero. O sea que el dueño
                  // que entraba a cambiar «Café gratis a los 10» por «Corte
                  // gratis a los 8» se encontraba con un formulario de cinco
                  // pasos para armar OTRA tarjeta — y si su paquete estaba en el
                  // tope, el asistente ni siquiera lo dejaba terminar. La
                  // regalía que ya tenía no se podía tocar desde ninguna
                  // pantalla del panel del negocio.
                  //
                  // Antes de eso vivía el formulario viejo, que conocía TRES
                  // modos de ocho y reventaba con un cupón o una gift card. Los
                  // dos se fueron: acá se editan las regalías de la tarjeta que
                  // manda, y la tarjeta se crea (o se corrige entera) desde su
                  // propia pantalla, que es donde el tope del paquete y el
                  // candado del tipo se hacen cumplir.
                  {
                    id: "recompensas",
                    etiqueta: "Recompensas",
                    contenido: p ? (
                      <>
                        <AvisoError />
                        <AvisoGuardado />
                        {/* Con varias tarjetas, esta sección edita la que
                            manda. Decirlo es la diferencia entre editar la
                            que uno quiere y editar la que el sistema eligió. */}
                        {vivas.length > 1 && (
                          <p
                            className={`${RADIO_TILE} border px-4 py-3 text-[12.5px] leading-relaxed text-aventurea-ink`}
                            style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
                          >
                            Estás viendo las regalías de{" "}
                            <strong className="font-extrabold">{principal?.nombre}</strong>, la
                            tarjeta que está emitiendo pases. Las otras {vivas.length - 1} se
                            editan desde <strong className="font-extrabold">Tarjetas</strong>.
                          </p>
                        )}
                        <EditorRecompensas />
                        <BloqueEstado />
                        <Link
                          href={`/lealtad/panel/${id}/editar/${p.id}`}
                          className={`flex items-center justify-between gap-3 ${RADIO_TILE} border px-4 py-3.5 transition-colors hover:border-white/40`}
                          style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
                        >
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-extrabold leading-tight text-aventurea-ink">
                              Cambiar el beneficio, las reglas o el tipo
                            </span>
                            <span className="mt-0.5 block text-[12px] leading-snug text-aventurea-ink-soft">
                              La meta, los vencimientos, los días permitidos y los topes de canje.
                            </span>
                          </span>
                          <span aria-hidden className="shrink-0 text-[18px]" style={{ color: ACCION }}>
                            →
                          </span>
                        </Link>
                      </>
                    ) : (
                      <Vacio texto="Todavía no tenés ninguna tarjeta. Creá la primera desde «Tarjetas» y sus regalías se editan acá." />
                    ),
                  },
                  /* La sección «Tarjeta digital» vivía acá. Se quitó: editaba
                     siempre la tarjeta principal, así que con dos tarjetas el
                     dueño cambiaba el color de la que no estaba mirando. El
                     diseño se abre desde la tarjeta misma —«Tarjetas» → tocar
                     una→ /editar/[programaId]—, que ya existía y sí sabe cuál
                     está tocando. `BloqueDiseno` (el contenido de aquella
                     sección) no se borró: es lo que ese editor monta adentro. */
                  // ── EL CATÁLOGO (0198): cuánto vale lo que se vende ─────
                  // La pregunta del dueño era literal: «¿dónde configuro los
                  // precios de cuánto vale X cosa que se vende?». No había
                  // dónde — el mostrador tecleaba el monto en cada venta y el
                  // producto era texto libre. Acá está el dónde.
                  {
                    id: "productos",
                    etiqueta: "Productos",
                    contenido: <SeccionProductos ranchoId={id} iniciales={catalogo} />,
                  },
                  // ── GEO-PUSH (0196): el aviso en la pantalla bloqueada ──
                  // El radio (~100 m) lo fija iOS y la píldora lo dice con el
                  // «~» a la vista: prometer un radio exacto o configurable
                  // sería vender lo que Apple no entrega.
                  {
                    id: "ubicacion",
                    etiqueta: "Ubicación",
                    contenido: (
                      <>
                        <div className="mb-3 flex justify-end">
                          <PildoraEstado estado="info">
                            Geo-Push en un radio de ~100 m
                          </PildoraEstado>
                        </div>
                        <SeccionUbicaciones
                          ranchoId={id}
                          negocioNombre={rancho.nombre}
                          iniciales={ubicaciones}
                          topePlan={def?.limites.ubicaciones ?? null}
                          planNombre={def?.nombre ?? null}
                        />
                      </>
                    ),
                  },
                  ...(puedeEquipo
                    ? [
                        {
                          id: "equipo",
                          etiqueta: "Equipo",
                          contenido: (
                            <>
                              <EquipoLealtad ranchoId={id} equipo={equipo} />
                              <div className="mt-5">
                                <LinkScanLealtad ranchoId={id} slug={slug} tarjetas={tarjetasParaLink} />
                              </div>
                            </>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </Seccion>
          ),
          developers: (
            <Seccion
              eyebrow="Quién se conecta"
              titulo="Developers"
              bajada="Quién puede hablarle a tu programa desde otro sistema, con qué permisos, y cómo lo desconectás."
            >
              <SeccionDevelopers
                ranchoId={id}
                tarjetas={todasLasFilas.map((f) => ({
                  id: f.id as string,
                  nombre: (f.nombre as string) ?? "Tarjeta",
                  // El tope diario es la PRECONDICIÓN para dejar que
                  // alguien acredite por API: sin él, una llave filtrada
                  // imprime premios. La pantalla lo dice antes de que el
                  // dueño intente y el RPC lo vuelva a rechazar.
                  topeDiario: (f.max_diario_cliente as number | null) ?? null,
                }))}
              />
            </Seccion>
          ),
          plan: (
            <Seccion
              eyebrow="Tu paquete"
              titulo="Plan y facturación"
              bajada="Qué incluye tu paquete, cuánto llevás consumido y qué gana si subís."
            >
              {/* El cobro con tarjeta (0143) va ARRIBA del catálogo:
                  quien entra a esta sección con la suscripción morosa
                  o cancelada tiene que ver eso antes que la grilla de
                  paquetes. Sin llaves de Stripe no dibuja nada. */}
              <FacturacionConTarjeta
                ranchoId={id}
                suscripcion={suscripcion}
                aviso={avisoPago}
              />
              <SeccionPlan
                ranchoId={id}
                plan={plan}
                miembros={miembros}
                equipo={equipo.length}
                prueba={prueba}
              />
            </Seccion>
          ),
        }
      : {}),
  };

  return (
    <ProveedorPrograma
      ranchoId={id}
      programaInicial={p}
      recompensasIniciales={lista}
      tieneCercania={cercania === true}
    >
      <ShellLealtad
        negocio={{ nombre: rancho.nombre, plan: def ? `Plan ${def.nombre}` : null }}
        usuario={{
          nombre: nombreUsuario,
          email: acceso.user.email ?? "",
          // Para el menú del avatar (0163: absorbió lo que mostraba
          // «Mi perfil» como sección propia del rail).
          rol: acceso.esAdmin ? "Bookea" : acceso.esDueno ? "Dueño" : "Colaborador",
        }}
        grupos={grupos}
        contenidos={contenidos}
      />
    </ProveedorPrograma>
  );
}

// ── Piezas ────────────────────────────────────────────────────────────

/**
 * La pantalla de los negocios que todavía no tienen nada que
 * administrar (en revisión, o sin el complemento). No lleva menú
 * lateral a propósito: no hay a dónde navegar.
 */
function Antesala({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <main className="lealtad-oscuro min-h-svh px-4 py-6 sm:px-6" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[720px]">
        {/* La misma barra de 64px que el shell del panel: quien llega
            acá y quien llega al panel completo tienen que sentir que
            entraron al mismo producto. */}
        <header className="flex h-16 items-center justify-between">
          <Link
            href="/lealtad/panel"
            className="text-[12.5px] font-bold text-aventurea-rail hover:text-white"
          >
            ← Mis negocios
          </Link>
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v4.png"
              alt="Bookea"
              width={110}
              height={34}
              className="h-[24px] w-auto opacity-70"
            />
          </Link>
        </header>

        <p className={EYEBROW_NEUTRO}>Programa de lealtad</p>
        <h1 className={`mt-1.5 ${TITULO_PANTALLA}`}>{nombre}</h1>

        <div
          className={`mt-5 ${RADIO_CARD} border border-aventurea-line bg-aventurea-surface px-5 py-10 text-center`}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

/**
 * EL TITULAR DE UNA SECCIÓN (`.heading` de la maqueta): kicker de
 * contexto arriba, h2, bajada, y la acción de la pantalla pegada al
 * borde derecho. El kicker no es decoración: es lo que dice en qué
 * parte del panel estás sin tener que ir a mirar el menú.
 */
function Seccion({
  eyebrow,
  titulo,
  bajada,
  accion,
  children,
}: {
  eyebrow: string;
  titulo: string;
  bajada: string;
  /** Lo que se puede hacer desde acá. Va a la derecha del titular. */
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className={EYEBROW_NEUTRO}>{eyebrow}</p>
          <h2 className={`mt-1.5 ${TITULO_PANTALLA}`}>{titulo}</h2>
          <p className={`mt-1.5 ${BAJADA_PANTALLA}`}>{bajada}</p>
        </div>
        {accion}
      </div>
      {children}
    </div>
  );
}

/** El rótulo que separa dos bloques dentro de una sección. Sólido y no
 *  `text-white/45` (que daba 4,05:1 sobre el navy y variaba según qué
 *  hubiera detrás): el gris de texto del módulo, 7,61:1. */
function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`mb-2.5 ${EYEBROW_NEUTRO} ${className}`}>{children}</h3>;
}

function Vacio({ texto }: { texto: string }) {
  return <CardVacia>{texto}</CardVacia>;
}

/** Una fila de dato de solo lectura. Es la fila canónica del panel
 *  puesta en modo ficha: rótulo en versalitas, dato en negrita y un
 *  separador de 1px, sin la barrita de estado porque acá no hay estado
 *  que comunicar. */
function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border-b border-aventurea-line py-2.5 first:pt-0 last:border-b-0">
      <p className={ROTULO_CIFRA}>{etiqueta}</p>
      <p className="mt-1 text-[13.5px] font-bold text-aventurea-ink">{valor}</p>
    </div>
  );
}
