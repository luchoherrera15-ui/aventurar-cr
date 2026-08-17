import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { verificarAccesoLealtad } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { definicionDe, estadoDelLimite } from "@/lib/lealtad/planes";
import { estadoDePrueba } from "@/lib/lealtad/prueba";
import { contextoDeCuenta } from "@/lib/lealtad/cuenta";
import { minutoISOCR } from "@/lib/fechas";
import SeccionProgramas, { type ProgramaEnLista } from "./seccion-programas";
import { estadoVisible, operaAhora } from "@/lib/lealtad/programas";
import { elegirPrograma } from "@/lib/wallet/programa-principal";
import { cupoLleno, lasQueOcupanCupo } from "./cupo-tarjetas";
import { TIPOS_TARJETA, tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { pideMontoElTipo } from "@/lib/lealtad/mostrador";
import { permisosDeFila } from "@/lib/lealtad/permisos";
import { cargarLealtad } from "./datos-lealtad";
import ShellLealtad, { type GrupoLealtad } from "./shell-lealtad";
import InicioLealtad, { type EnlacesInicio, type PasoPrimero } from "./inicio-lealtad";
import ModoMostrador from "./modo-mostrador";
import BotonEscanear from "./boton-escanear";
import LealtadEstado from "./lealtad-estado";
import MarketingLealtad from "./marketing-lealtad";
import CompartirTarjeta from "./compartir-tarjeta";
import { BloqueEstado } from "./pases-panel";
import EditorRecompensas from "./editor-recompensas";
import SeccionPlan from "./seccion-plan";
import FacturacionConTarjeta from "./facturacion-tarjeta";
import { suscripcionDelNegocio } from "@/lib/pagos/puerta-supabase";
import { AvisoError, AvisoGuardado, ProveedorPrograma } from "./programa-contexto";
import MetricasLealtad from "./metricas";
import AuditoriaResumen from "./auditoria-resumen";
import EquipoLealtad, { type MiembroEquipo } from "./equipo-cliente";
import { ActividadLealtad, IntegracionesLealtad, WalletLealtad } from "./lealtad-secciones";
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

/* El azul de acción para fondo oscuro. Todo el panel vive sobre navy
   profundo: el azul de marca se apaga ahí, y `--accion-claro` es la
   versión que sí se lee, con su letra ya decidida. El tinte y el borde
   translúcidos salen de la misma familia para que un bloque tenue y su
   botón no parezcan dos colores distintos. */
const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";
const ACCION_TINTE = "rgba(157,180,255,.14)";
const ACCION_BORDE = "rgba(157,180,255,.45)";

export const metadata = { title: "Programa de lealtad · Bookea" };

export default async function PanelNegocioLealtad({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // De vuelta de Stripe Checkout: `?pago=listo` o `?pago=cancelado`.
  // OJO — es un AVISO y nada más: ningún plan se activa por lo que
  // diga esta URL, que se escribe a mano. Activa el webhook firmado
  // (src/app/api/stripe/webhook/route.ts) y nadie más.
  searchParams: Promise<{ pago?: string }>;
}) {
  const { id } = await params;
  const { pago } = await searchParams;
  const avisoPago = pago === "listo" || pago === "cancelado" ? pago : null;

  const acceso = await verificarAccesoLealtad(id);
  if (!acceso.user) redirect("/lealtad/login");
  if (!acceso.ok) redirect("/lealtad/panel");
  const { permisos } = acceso;

  // El negocio. `verificarAccesoLealtad` de arriba ya es el chequeo de
  // seguridad real (dueño/colaborador/admin, con redirect si no pasa);
  // esta lectura va con la llave de servicio solo para poder pedir `*`
  // sin lista de columnas a mano — `authenticated` ya no tiene permiso
  // de tabla completa sobre `ranchos` (0155), y `select *` es a
  // propósito porque lealtad_aprobado_en (0129) puede no existir
  // todavía en la base.
  const { data: rancho } = await (createAdminClient() ?? acceso.supabase)
    .from("ranchos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rancho) redirect("/lealtad/panel");

  // ── En revisión (0129): creado pero sin aprobar por Bookea ──────────
  // Si la columna no existe todavía, el negocio se trata como aprobado
  // — el comportamiento de antes de la migración.
  const enRevision =
    "lealtad_aprobado_en" in rancho && rancho.lealtad_aprobado_en === null && !acceso.esAdmin;
  if (enRevision) {
    return (
      <Antesala nombre={rancho.nombre}>
        <p className="text-[15px] font-extrabold text-white">Tu negocio está en revisión</p>
        <p className="mx-auto mt-2 max-w-[440px] text-[13.5px] leading-relaxed text-white/60">
          El equipo de Bookea revisa cada negocio nuevo antes de habilitarle el programa de
          lealtad. Te avisamos al correo apenas quede aprobado — de ahí elegís tu paquete y
          dejás la solicitud.
        </p>
      </Antesala>
    );
  }

  const { data: tieneAddon } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: id,
    p_addon: "lealtad",
  });

  // ── Sin el complemento: acá se pide, no se configura ────────────────
  if (tieneAddon !== true) {
    // ¿Ya hay una solicitud esperando? (0126; si no corrió, se ignora.)
    const { data: solicitud } = await acceso.supabase
      .from("solicitudes_lealtad")
      .select("plan, created_at")
      .eq("rancho_id", id)
      .eq("estado", "pendiente")
      .maybeSingle();

    // ¿O es que se le TERMINÓ LA PRUEBA? No es lo mismo que «todavía no
    // tiene el programa»: este negocio lo tuvo, lo armó, tiene clientes
    // con sellos adentro, y lo que necesita leer es qué pasó y qué
    // conserva — no un texto de bienvenida que lo deje pensando que
    // perdió todo. La fila se lee con la llave de servicio porque la
    // política de `addons_negocio` (0077) solo se la muestra al dueño, y
    // a esta pantalla también entran los colaboradores.
    const dbAddon = createAdminClient();
    const { data: filaAddon } = dbAddon
      ? await dbAddon
          .from("addons_negocio")
          .select("activo, vence_en")
          .eq("rancho_id", id)
          .eq("addon", "lealtad")
          .maybeSingle()
      : { data: null };
    const prueba = estadoDePrueba({
      plan: (rancho.plan_lealtad as string | null) ?? null,
      venceEn: (filaAddon?.vence_en as string | null) ?? null,
    });
    const pruebaTerminada = prueba.vencida && !!filaAddon?.activo;

    return (
      <Antesala nombre={rancho.nombre}>
        {pruebaTerminada ? (
          <>
            <p className="text-[15px] font-extrabold text-white">
              Se terminaron tus 14 días de prueba
            </p>
            <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] leading-relaxed text-white/60">
              Tu programa quedó <b className="text-white/80">en pausa</b>: por ahora no se
              pueden dar sellos, canjear premios ni emitir tarjetas nuevas.
            </p>
            <p className="mx-auto mt-3 max-w-[460px] rounded-2xl px-4 py-3 text-[13px] leading-relaxed font-bold text-white"
              style={{ background: ACCION_TINTE }}>
              No se borró nada. Tus clientes, sus sellos y los pases que ya tienen en el
              teléfono siguen exactamente como estaban — elegí un paquete y todo vuelve tal
              cual lo dejaste.
            </p>
            <Link
              href={`/lealtad/planes?negocio=${id}`}
              className="mt-5 inline-block rounded-2xl px-6 py-3.5 text-[14px] font-extrabold"
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              Elegir mi paquete →
            </Link>
          </>
        ) : solicitud ? (
          <>
            <p className="text-[15px] font-extrabold text-white">
              Tu solicitud del plan {definicionDe(solicitud.plan as string)?.nombre ?? ""} está en
              revisión
            </p>
            <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-white/60">
              El equipo de Bookea la está armando para que quede bien. Te avisamos al correo
              cuando el programa esté activo.
            </p>
          </>
        ) : (
          <>
            <p className="text-[15px] font-extrabold text-white">
              Este negocio todavía no tiene el programa de lealtad
            </p>
            <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-white/60">
              Elegí tu paquete y dejá la solicitud: el equipo de Bookea genera el programa y la
              tarjeta por vos, y te avisa cuando esté listo.
            </p>
            <Link
              href={`/lealtad/planes?negocio=${id}`}
              className="mt-5 inline-block rounded-2xl px-6 py-3.5 text-[14px] font-extrabold"
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              Ver los paquetes →
            </Link>
          </>
        )}
      </Antesala>
    );
  }

  // ── Con el complemento: los datos del programa (llave de servicio,
  //    porque un colaborador no puede leer un programa pausado por RLS) ─
  const admin = createAdminClient();

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

  // ── TODAS las tarjetas del negocio ─────────────────────────────
  // Desde la 0134 puede haber varias (el `unique(rancho_id)` se
  // liberó). `select *` porque las columnas de las 0134/0135/0136
  // pueden no existir todavía y una lista explícita fallaría entera.
  const { data: filasProgramas } = admin
    ? await admin.from("programa_lealtad").select("*").eq("rancho_id", id)
    : { data: [] };

  const todasLasFilas = (filasProgramas ?? []) as Record<string, unknown>[];

  // Los miembros de cada una, en UNA consulta y no una por tarjeta.
  const idsProgramas = todasLasFilas.map((f) => f.id as string);
  const { data: filasMiembros } = admin && idsProgramas.length
    ? await admin.from("miembros").select("programa_id").in("programa_id", idsProgramas)
    : { data: [] };
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
  }));

  // ── LA TARJETA PRINCIPAL: la que mandan Inicio, Clientes, Métricas
  //    y el editor del pase ─────────────────────────────────────────
  // Sale de la lista que ya se trajo, y no de un segundo
  // `select ... .maybeSingle()`. Ese `maybeSingle` era de cuando había
  // UNA tarjeta por negocio: desde que la 0134 liberó el
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
  // y con los dos generadores de pases (`elegirPrograma`), para que el
  // dueño configure exactamente la tarjeta que su cliente recibe.
  const principal = elegirPrograma(programasEnLista, ahoraCR);

  const p = (principal
    ? (todasLasFilas.find((f) => f.id === principal.id) ?? null)
    : null) as ProgramaFila | null;

  const { data: recompensas } = admin && p
    ? await admin
        .from("recompensas")
        .select("*")
        .eq("programa_id", p.id)
        .order("costo_puntos", { ascending: true })
    : { data: [] };

  const lista = (recompensas ?? []) as RecompensaFila[];
  const meta = lista.find((r) => r.activo) ?? null;
  // «Activo» acá es la pregunta que decide si el QR lleva a algún lado,
  // así que se responde con `operaAhora`: una tarjeta con estado activo
  // pero vencida NO emite pases, y decir que sí mandaría a imprimir un
  // póster con un código que responde «no encontrado».
  const programaActivo = principal ? operaAhora(principal, ahoraCR) : false;

  // Las archivadas no cuentan como tarjetas que el negocio tenga: para
  // volver a emitir hay que crear otra, no reanimar la archivada. El
  // MISMO criterio que aplica el servidor al crear (`cupo-tarjetas.ts`).
  const vivas = lasQueOcupanCupo(programasEnLista, ahoraCR);
  const operan = vivas.filter((f) => operaAhora(f, ahoraCR)).length;

  // Lo que dice el ledger. La misma llamada que hace <LealtadEstado>:
  // `cargarLealtad` está envuelta en `cache()`, así que las dos
  // secciones del mismo render comparten una sola consulta.
  const datosLealtad = await cargarLealtad(p?.id ?? null, meta?.costo_puntos ?? null);
  const miembros = datosLealtad?.resumen.miembros ?? 0;

  // El complemento de cercanía (0123): lo pide el editor de la tarjeta
  // para saber si ofrece el aviso por ubicación.
  const { data: cercania } = await acceso.supabase.rpc("tiene_addon", {
    p_rancho_id: id,
    p_addon: "pases_cercania",
  });

  // Quién está mirando: el nombre sale de `perfiles`, nunca de la
  // metadata que el cliente puede escribir.
  const { data: perfil } = await acceso.supabase
    .from("perfiles")
    .select("nombre")
    .eq("id", acceso.user.id)
    .maybeSingle();
  const nombreUsuario =
    ((perfil?.nombre as string | null) ?? "").trim() || (acceso.user.email ?? "Tu cuenta");

  // ── El equipo (solo lo carga quien lo puede editar) ─────────────────
  let equipo: MiembroEquipo[] = [];
  const puedeEquipo = acceso.esDueno || acceso.esAdmin;
  if (puedeEquipo) {
    const { data } = await acceso.supabase.rpc("colaboradores_del_rancho", { p_rancho: id });
    equipo = ((data ?? []) as {
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

  // ── Las secciones según el permiso ──────────────────────────────────
  // «Negocio», «Recompensas», «Tarjeta digital» y «Plan» son del DUEÑO:
  // colores, logo, regalías y paquete se tocan sin pedirle permiso a
  // nadie. Los colaboradores no las ven — su checklist gobierna la
  // operación diaria, no la identidad ni la plata de la marca.
  const puedeDisenar = acceso.esDueno || acceso.esAdmin;
  const slug = rancho.slug as string | null;

  // El plan sale de la CUENTA desde la 0134 (`cuentas.plan`), con el
  // del rancho como respaldo mientras la migración no esté corrida.
  // Toda la pantalla —topes, capacidades, medidores— cuelga de acá,
  // así que resolverlo en UN lugar evita que media pantalla muestre el
  // plan nuevo y la otra media el viejo.
  const { plan, cuentaId } = admin
    ? await contextoDeCuenta(admin, (p ?? {}) as Record<string, unknown>, {
        planRancho: rancho.plan_lealtad as string | null,
      })
    : { plan: (rancho.plan_lealtad as string | null) ?? null, cuentaId: null };
  const def = definicionDe(plan);

  // La suscripción con tarjeta (0143), si la hay. Solo la carga quien
  // ve la sección Plan — y devuelve null sin la migración corrida, así
  // que el panel sigue funcionando igual mientras el dueño la pega.
  const suscripcion =
    admin && puedeDisenar ? await suscripcionDelNegocio(admin, { ranchoId: id, cuentaId }) : null;

  // La cuenta regresiva de la prueba. Se pinta EN EL PANEL y no solo en
  // un correo a propósito: el correo se pierde, se filtra o se lee
  // tarde, y el panel es el lugar donde el dueño ya está mirando su
  // programa. Con la fecha a la vista, que la prueba se termine deja de
  // ser una sorpresa aunque el aviso por correo nunca haya salido.
  const { data: filaAddonPlan } =
    admin && puedeDisenar
      ? await admin
          .from("addons_negocio")
          .select("vence_en")
          .eq("rancho_id", id)
          .eq("addon", "lealtad")
          .maybeSingle()
      : { data: null };
  const prueba = estadoDePrueba({
    plan,
    venceEn: (filaAddonPlan?.vence_en as string | null) ?? null,
  });

  const topeProgramas = def?.limites.programas ?? null;
  const limiteClientes = estadoDelLimite(plan, "clientesActivos", miembros);

  const grupos: GrupoLealtad[] = [
    {
      titulo: "Principal",
      items: [
        { id: "inicio", etiqueta: "Inicio", icono: "inicio" as const },
        { id: "programas", etiqueta: "Tarjetas", icono: "tarjeta" as const },
        { id: "clientes", etiqueta: "Clientes", icono: "clientes" as const },
        ...(permisos.auditoria
          ? [
              { id: "actividad", etiqueta: "Actividad", icono: "actividad" as const },
              { id: "metricas", etiqueta: "Métricas", icono: "metricas" as const },
            ]
          : []),
        ...(puedeEquipo ? [{ id: "equipo", etiqueta: "Equipo", icono: "equipo" as const }] : []),
        ...(puedeDisenar ? [{ id: "marketing", etiqueta: "Marketing", icono: "campana" as const }] : []),
      ],
    },
    {
      titulo: "Configuración",
      items: [
        ...(puedeDisenar
          ? [
              { id: "negocio", etiqueta: "Negocio", icono: "negocio" as const },
              { id: "recompensas", etiqueta: "Recompensas", icono: "recompensas" as const },
              // Acá había «Tarjeta digital», y se quitó a propósito: era
              // un atajo que editaba SIEMPRE la tarjeta principal. Con
              // una sola tarjeta parecía natural; con dos, el dueño
              // tocaba el menú creyendo editar la que estaba mirando y
              // cambiaba la otra. El diseño ahora se abre desde la
              // tarjeta misma —«Tarjetas» → tocar una— que es donde ya
              // vivía el editor de verdad (editar/[programaId]). Un
              // camino, no dos que se desincronizan.
            ]
          : []),
        { id: "poster", etiqueta: "Póster y QR", icono: "poster" as const },
        ...(puedeDisenar ? [{ id: "plan", etiqueta: "Plan y facturación", icono: "plan" as const }] : []),
      ],
    },
    {
      titulo: "Cuenta",
      items: [{ id: "perfil", etiqueta: "Mi perfil", icono: "perfil" as const }],
    },
  ];

  // Un botón que apunta a una sección que quien mira no tiene es un
  // callejón sin salida: el ancla solo se pinta si la sección existe.
  const visibles = new Set(grupos.flatMap((g) => g.items).map((i) => i.id));
  const ancla = (seccion: string) => (visibles.has(seccion) ? `#${seccion}` : null);
  const irA = (seccion: string, texto: string) => {
    const href = ancla(seccion);
    return href ? { texto, href } : null;
  };

  // El tipo de la tarjeta principal sale del CATÁLOGO de ocho, con
  // `tipoDe` para tolerar lo desconocido. Antes se casteaba a mano a
  // tres valores («sellos» | «puntos» | «cashback»): con un cupón, una
  // gift card o un evento, esa lista mentía y los textos salían mal.
  const tipoPrincipal = tipoDe(p?.modo ?? null);
  const acumula = TIPOS_TARJETA[tipoPrincipal].acumula;

  const reglasDan = p ? p.puntos_por_visita > 0 || Number(p.puntos_por_colon) > 0 : false;
  const pasos: PasoPrimero[] = [
    {
      titulo: "Tu negocio está creado",
      detalle: `${rancho.nombre} ya existe en Bookea con su programa de lealtad.`,
      listo: true,
      cta: irA("negocio", "Ver los datos"),
    },
    {
      // La recompensa la pide lo que ACUMULA. Un cupón, un evento o una
      // membresía llevan su beneficio adentro de la tarjeta: pedirles
      // una recompensa activa dejaba este paso en rojo para siempre,
      // sin que faltara nada.
      titulo: acumula ? "Definí cómo se gana y qué se gana" : "Configurá el beneficio",
      detalle: acumula
        ? meta
          ? `La meta es ${meta.nombre} a los ${meta.costo_puntos}.`
          : "Sin una recompensa activa, la tarjeta no promete nada."
        : `Tu ${TIPOS_TARJETA[tipoPrincipal].nombre.toLowerCase()} ya trae su beneficio adentro.`,
      listo: acumula ? !!meta && reglasDan : !!p,
      // Al editor DE ESA TARJETA, no a la sección. Los cinco tipos que
      // llevan el beneficio adentro (cupón, descuento, membresía,
      // evento, gift card) no se configuran en «Recompensas»: mandarlos
      // ahí era mandarlos a una pantalla que les dice que no hay nada
      // que hacer. Sin tarjeta todavía, el paso lleva al asistente.
      cta: !puedeDisenar
        ? null
        : p
          ? { texto: "Configurar", href: `/lealtad/panel/${id}/editar/${p.id}` }
          : { texto: "Crear la tarjeta", href: `/lealtad/panel/${id}/crear` },
    },
    {
      // "Listo" = el QR EXISTE y lleva a algún lado (programa activo y
      // página publicada). Si el programa está pausado o el negocio no
      // tiene slug, el póster imprimiría un código que responde "no
      // encontrado" — eso no es un paso cumplido.
      titulo: "Publicá tu tarjeta y tu QR",
      detalle: programaActivo && slug
        ? "Ya funciona: imprimí el póster y pegalo en la caja para que se afilien solos."
        : "Con el programa activo y tu página publicada, el QR queda listo para imprimir.",
      listo: programaActivo && !!slug,
      cta: irA("poster", "Imprimir el póster"),
    },
    {
      titulo: "Conseguí tu primer cliente",
      detalle:
        miembros > 0
          ? `Ya llevás ${miembros} ${miembros === 1 ? "afiliado" : "afiliados"}.`
          : "Nadie se ha afiliado todavía. El QR y el link son el camino.",
      listo: miembros > 0,
      cta: irA("clientes", "Ver clientes"),
    },
  ];

  // El asistente vive en su propia pantalla (ancho completo para el
  // formulario más la vista previa), la misma a la que manda la sección
  // «Tarjetas»: dos caminos distintos para crear lo mismo terminan en
  // dos experiencias que se desincronizan.
  const enlaces: EnlacesInicio = {
    crear: puedeDisenar ? `/lealtad/panel/${id}/crear` : null,
    recompensas: ancla("recompensas"),
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
  };

  const contenidos: Record<string, React.ReactNode> = {
    inicio: (
      <InicioLealtad
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
        limite={limiteClientes}
        pasos={pasos}
        enlaces={enlaces}
        accion={
          p && permisos.acreditar ? (
            <BotonEscanear
              ranchoId={id}
              // Mismo criterio que el mostrador — ver el comentario de
              // más abajo. Las dos puertas al escáner tienen que
              // preguntar lo mismo.
              pideMonto={pideMontoElTipo(tipoPrincipal)}
              recompensa={
                meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
              }
            />
          ) : null
        }
      />
    ),

    programas: (
      <Seccion
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
        titulo="Clientes"
        bajada="Quién se afilió, cuánto lleva cada quien y a quién le toca su regalía."
      >
        {p ? (
          <LealtadEstado programaId={p.id} plan={plan} meta={meta?.costo_puntos ?? null} />
        ) : (
          <Vacio texto="Tu plan está activo y el equipo de Bookea está armando el programa y la tarjeta. Te avisamos al correo cuando esté listo." />
        )}
      </Seccion>
    ),

    marketing: <MarketingLealtad ranchoId={id} programaId={p?.id ?? null} />,

    poster: (
      <Seccion
        titulo="Póster y QR"
        bajada="Con esto tus clientes consiguen la tarjeta: el código para el mostrador y el link para mandar."
      >
        <Link
          href={`/lealtad/panel/${id}/poster`}
          className="flex items-center justify-between rounded-2xl border px-4 py-4 transition-colors hover:border-white/40"
          style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
        >
          <span>
            <span className="block text-[14px] font-extrabold text-white">
              Diseñá e imprimí tu póster
            </span>
            <span className="block text-[12.5px] text-white/60">
              Hoja A4 lista para pegar en la caja, con tu QR, tus colores y tu regalía.
            </span>
          </span>
          <span aria-hidden className="ml-3 shrink-0 text-[18px]" style={{ color: ACCION }}>
            →
          </span>
        </Link>
        <CompartirTarjeta slug={slug} programaActivo={programaActivo} />
      </Seccion>
    ),

    perfil: (
      <Seccion titulo="Mi perfil" bajada="Tu cuenta de Bookea — la misma para todo el sistema.">
        <div className="rounded-2xl border border-aventurea-line bg-white p-5">
          <p className="text-[15px] font-extrabold text-aventurea-ink">{nombreUsuario}</p>
          <p className="mt-0.5 text-[13px] text-aventurea-ink-soft">{acceso.user.email}</p>
          <p className="mt-3 text-[12.5px] text-aventurea-ink-soft">
            En {rancho.nombre} sos{" "}
            <strong>
              {acceso.esAdmin ? "administrador de Bookea" : acceso.esDueno ? "el dueño" : "colaborador"}
            </strong>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/cuenta"
              className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
            >
              Tu cuenta en Bookea →
            </Link>
            <Link
              href="/lealtad/panel"
              className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
            >
              Cambiar de negocio →
            </Link>
          </div>
        </div>
      </Seccion>
    ),

    ...(permisos.auditoria
      ? {
          actividad: (
            <Seccion
              titulo="Actividad"
              bajada="Quién hizo qué y cuándo. Todo movimiento queda escrito; nada se borra."
            >
              <Rotulo>Quién hizo qué — últimos 30 días</Rotulo>
              <AuditoriaResumen programaId={p?.id ?? null} />
              <Rotulo className="mt-6">El libro, movimiento por movimiento</Rotulo>
              <ActividadLealtad ranchoId={id} programaId={p?.id ?? null} />
              <Rotulo className="mt-6">Canjes por pasar a la caja</Rotulo>
              <IntegracionesLealtad ranchoId={id} programaId={p?.id ?? null} />
            </Seccion>
          ),
          metricas: (
            <Seccion
              titulo="Métricas"
              bajada="¿Está creciendo el programa? Los últimos 30 días contra los 30 anteriores."
            >
              <MetricasLealtad programaId={p?.id ?? null} plan={plan} />
              <Rotulo className="mt-6">Estado de las tarjetas</Rotulo>
              <WalletLealtad programaId={p?.id ?? null} />
            </Seccion>
          ),
        }
      : {}),

    ...(puedeEquipo
      ? {
          equipo: (
            <Seccion
              titulo="Equipo"
              bajada="Quién puede dar sellos, canjear, revertir y ver la auditoría."
            >
              <EquipoLealtad ranchoId={id} equipo={equipo} />
            </Seccion>
          ),
        }
      : {}),

    ...(puedeDisenar
      ? {
          negocio: (
            <Seccion
              titulo="Negocio"
              bajada="Los datos con los que tu cliente te reconoce en la tarjeta y en la página."
            >
              <div className="rounded-2xl border border-aventurea-line bg-white p-5">
                <Campo etiqueta="Nombre" valor={rancho.nombre} />
                <Campo etiqueta="Dirección de tu tarjeta" valor={slug ? `/tarjeta/${slug}` : "Sin publicar"} />
                <Campo etiqueta="Plan de lealtad" valor={def ? def.nombre : "Sin plan"} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/mi-negocio/${id}`}
                    className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
                  >
                    Editar en tu panel de negocio →
                  </Link>
                  {slug && (
                    <Link
                      href={`/tarjeta/${slug}`}
                      className="rounded-xl border border-aventurea-line px-4 py-2.5 text-[12.5px] font-bold text-aventurea-ink"
                    >
                      Ver la tarjeta del cliente →
                    </Link>
                  )}
                </div>
              </div>
            </Seccion>
          ),
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
          recompensas: (
            <Seccion
              titulo="Recompensas"
              bajada="Qué se lleva tu cliente, cuánto le cuesta y cuál es la meta de la tarjeta."
            >
              {p ? (
                <>
                  <AvisoError />
                  <AvisoGuardado />
                  {/* Con varias tarjetas, esta sección edita la que
                      manda. Decirlo es la diferencia entre editar la
                      que uno quiere y editar la que el sistema eligió. */}
                  {vivas.length > 1 && (
                    <p className="rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[12.5px] leading-relaxed text-white/65">
                      Estás viendo las regalías de{" "}
                      <strong className="font-bold text-white">{principal?.nombre}</strong>, la
                      tarjeta que está emitiendo pases. Las otras {vivas.length - 1} se editan
                      desde <strong className="font-bold text-white">Tarjetas</strong>.
                    </p>
                  )}
                  <EditorRecompensas />
                  <BloqueEstado />
                  <Link
                    href={`/lealtad/panel/${id}/editar/${p.id}`}
                    className="flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-colors hover:border-white/40"
                    style={{ background: ACCION_TINTE, borderColor: ACCION_BORDE }}
                  >
                    <span>
                      <span className="block text-[13.5px] font-extrabold text-white">
                        Cambiar el beneficio, las reglas o el tipo
                      </span>
                      <span className="block text-[12px] text-white/60">
                        La meta, los vencimientos, los días permitidos y los topes de canje.
                      </span>
                    </span>
                    <span aria-hidden className="ml-3 shrink-0 text-[18px]" style={{ color: ACCION }}>
                      →
                    </span>
                  </Link>
                </>
              ) : (
                <Vacio texto="Todavía no tenés ninguna tarjeta. Creá la primera desde «Tarjetas» y sus regalías se editan acá." />
              )}
            </Seccion>
          ),
          /* La sección «Tarjeta digital» vivía acá. Se quitó: editaba
             siempre la tarjeta principal, así que con dos tarjetas el
             dueño cambiaba el color de la que no estaba mirando. El
             diseño se abre desde la tarjeta misma —«Tarjetas» → tocar
             una→ /editar/[programaId]—, que ya existía y sí sabe cuál
             está tocando. `BloqueDiseno` (el contenido de aquella
             sección) no se borró: es lo que ese editor monta adentro. */
          plan: (
            <Seccion
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
        usuario={{ nombre: nombreUsuario, email: acceso.user.email ?? "" }}
        grupos={grupos}
        contenidos={contenidos}
        mostrador={
          p && permisos.acreditar ? (
            <ModoMostrador
              ranchoId={id}
              // `pideMontoElTipo` y no «todo lo que no sea sellos»: esa
              // condición le pedía el monto de la compra a un cupón, a
              // una entrada de evento y a un carnet de socio, donde el
              // número no cambia absolutamente nada — y el empleado, con
              // el cliente enfrente, se queda mirando un campo que no
              // sabe qué poner. Solo puntos, cashback y gift card
              // dependen de cuánto se gastó.
              pideMonto={pideMontoElTipo(tipoPrincipal)}
              tipo={p.modo ?? null}
              permisos={permisos}
              recompensa={
                meta ? { id: meta.id, nombre: meta.nombre, costo: meta.costo_puntos } : null
              }
            />
          ) : undefined
        }
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
    <main className="lealtad-oscuro min-h-svh px-5 py-8" style={{ background: NAVY_PROFUNDO }}>
      <div className="mx-auto w-full max-w-[720px]">
        <header className="flex items-center justify-between">
          <Link
            href="/lealtad/panel"
            className="text-[12.5px] font-bold text-white/50 hover:text-white"
          >
            ← Mis negocios
          </Link>
          <Link href="/lealtad">
            <Image
              src="/logo-bookea-blanco-v3.png"
              alt="Bookea"
              width={110}
              height={34}
              className="h-[24px] w-auto"
            />
          </Link>
        </header>

        <h1 className="mt-6 text-[24px] font-extrabold text-white">{nombre}</h1>

        <div
          className="mt-5 rounded-3xl border px-5 py-10 text-center"
          style={{ background: "rgba(255,255,255,.035)", borderColor: "rgba(255,255,255,.09)" }}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

function Seccion({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[21px] font-extrabold leading-tight text-white sm:text-[23px]">
          {titulo}
        </h2>
        <p className="mt-1 text-[13.5px] text-white/55">{bajada}</p>
      </div>
      {children}
    </div>
  );
}

function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h3
      className={`mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/45 ${className}`}
    >
      {children}
    </h3>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-aventurea-line bg-white p-6 text-center text-[13.5px] text-aventurea-ink-soft">
      {texto}
    </p>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="border-b border-aventurea-line py-2.5 first:pt-0 last:border-b-0">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
        {etiqueta}
      </p>
      <p className="mt-0.5 text-[13.5px] font-bold text-aventurea-ink">{valor}</p>
    </div>
  );
}
