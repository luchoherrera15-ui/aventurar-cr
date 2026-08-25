import type { ReactNode } from "react";
import Link from "next/link";
import { Card, GrillaTablero, PildoraEstado } from "@/components/panel/piezas";
import {
  BAJADA_PANTALLA,
  CUERPO,
  CUERPO_SUAVE,
  DETALLE,
  ENLACE_CARD,
  EYEBROW_NEUTRO,
  GAP_METRICAS,
  GAP_TABLERO,
  RADIO_CARD,
  RADIO_TILE,
  TITULO_PANTALLA,
} from "@/components/panel/sistema";
import {
  ACCION,
  ACCION_BORDE,
  ACCION_TINTA,
  ACCION_TINTE,
  BOTON_ACCION,
  DISCO_LEALTAD,
  ESTADO_DE_TONO,
  TILE_LEALTAD,
} from "../sistema-lealtad";
import { Icono, type NombreIcono } from "./iconos";
import Kpi from "./kpi";
import Medidor from "./medidor";
import AvisosCerrables, { type AvisoCerrable } from "./avisos-cerrables";
import { CONSEJO_TARJETA, momentoDeInicio } from "@/lib/lealtad/inicio";
import { TIPOS_TARJETA, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { ETIQUETA_ESTADO, TONO_ESTADO, type EstadoVisible } from "@/lib/lealtad/programas";
import type { ResumenLealtad } from "@/lib/lealtad/tablero";
import {
  definicionDe,
  esPlanSinCosto,
  precioDe,
  PLANES_OFRECIDOS,
  type EstadoLimite,
} from "@/lib/lealtad/planes";
import { BotonCancelarSuscripcion } from "./pago-tarjeta";
import { textoRestante, type EstadoPrueba } from "@/lib/lealtad/prueba";

/**
 * EL TABLERO DE INICIO del panel de lealtad.
 *
 * ------------------------------------------------------------------
 * DE FOLLETO A TABLERO
 * ------------------------------------------------------------------
 * Acá vivía un explicador fijo —«Escanea el QR», «Se afilia»…— que
 * decía exactamente lo mismo el día 1 y el día 400, sin un solo dato
 * del negocio. Ahora la pantalla depende del MOMENTO en que está el
 * programa (`momentoDeInicio`, en src/lib/lealtad/inicio.ts):
 *
 *   sin-tarjeta   → bienvenida, botón grande y el mini-tutorial;
 *   sin-publicar  → qué le pasa a la tarjeta y cómo publicarla;
 *   sin-meta      → la tarjeta no promete nada todavía;
 *   sin-clientes  → ya funciona: hay que repartir el QR;
 *   en-marcha     → los números del ledger.
 *
 * El explicador viejo NO se borró: se mudó al único momento donde
 * enseña algo, que es cuando el negocio todavía no tiene nada. Ahí
 * responde la pregunta que de verdad se está haciendo («¿esto qué se
 * supone que hace?»); a los 400 días es decoración.
 *
 * ------------------------------------------------------------------
 * LOS AVISOS ARRIBA, EL TABLERO SIEMPRE DEBAJO
 * ------------------------------------------------------------------
 * Lo que falta hacer (el panel del momento y «Primeros pasos») abre la
 * pantalla mientras exista, porque es lo que destraba el programa. Pero
 * ahora cada aviso tiene su X —<AvisosCerrables>— y debajo hay algo a
 * lo que llegar: el tablero, con las cifras del ledger y el estado del
 * paquete. Cuando la puesta en marcha termina, los avisos se apagan
 * solos (los pasos se marcan con señales reales de la base) y lo que
 * queda es el tablero, que es lo que se pidió.
 *
 * El estado del paquete se pinta desde `sin-publicar` en adelante, y no
 * solo «en marcha»: no es una métrica en cero —es qué paquete tenés,
 * cuánto te queda de prueba y cuánto cupo—, así que quien cierra el
 * aviso del primer día igual encuentra algo cierto abajo.
 *
 * ------------------------------------------------------------------
 * LO QUE NO SE MUESTRA, Y POR QUÉ
 * ------------------------------------------------------------------
 * No hay cuadros de campañas, automatizaciones ni sedes. No existen:
 * ni tabla ni código. Un tablero con una caja vacía de algo que nadie
 * puede llenar es peor que no tenerla — promete un producto que no
 * está y manda a buscar el botón que lo enciende.
 *
 * Tampoco se pintan cuatro ceros cuando no hay nada que contar: las
 * métricas aparecen recién cuando hay al menos un afiliado. Cero,
 * cero, cero y cero no es información, es desánimo.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTE COMPONENTE VIVE EN EL SERVIDOR
 * ------------------------------------------------------------------
 * Los botones son anclas `#seccion` y el shell escucha el hash para
 * cambiar de sección: no hace falta ningún callback que cruce la
 * frontera. Los enlaces llegan ya resueltos —y en `null` si quien mira
 * no tiene esa sección—, así que ningún botón lleva a un callejón sin
 * salida.
 */

export type PasoPrimero = {
  titulo: string;
  detalle: string;
  listo: boolean;
  cta: { texto: string; href: string } | null;
};

/** A dónde puede llevar el tablero. `null` = quien mira no lo tiene. */
export type EnlacesInicio = {
  /** El asistente de cinco pasos, en su pantalla propia. */
  crear: string | null;
  recompensas: string | null;
  tarjeta: string | null;
  poster: string | null;
  clientes: string | null;
  programas: string | null;
  plan: string | null;
  /** Enlaces de la fila «Accesos rápidos» — null = quien mira no tiene
   *  esa sección (mismo criterio que el resto de `EnlacesInicio`). */
  marketing: string | null;
  configuracion: string | null;
};

export type TarjetaPrincipal = {
  nombre: string;
  tipo: TipoTarjeta;
  estado: EstadoVisible;
};

/** Un renglón del Top 5 — mismo conteo de `visitas` que ya usa la
 *  Auditoría de clientes (movimientos 'ganado' del ledger). */
export type ClienteRecurrente = {
  miembroId: string;
  nombre: string;
  visitas: number;
};

/** Un renglón del Top 5 por plata — mismo `gastoTotal` que ya calcula
 *  la Auditoría de clientes (colones reales de `lealtad_transacciones`,
 *  no un cálculo nuevo). */
export type ClienteComprador = {
  miembroId: string;
  nombre: string;
  gastoTotal: number;
};

/**
 * EL STATUS DEL PAQUETE, tal cual lo necesita el tablero.
 *
 * Los topes NO se guardan: `clientes` y `tarjetas` los arma
 * `estadoDelLimite` con el catálogo del plan y lo que se contó en la
 * base. Por eso cambiar de paquete mueve los medidores solo, sin que
 * nadie tenga que actualizar un número.
 */
export type EstadoPaquete = {
  /** El plan guardado. null = todavía no tiene ninguno asignado. */
  plan: string | null;
  /** El tope que importa: cuánta gente puede afiliar. */
  clientes: EstadoLimite;
  /** Cuántas tarjetas puede tener publicables a la vez. */
  tarjetas: EstadoLimite;
  /** Cuántos envíos promocionales lleva ESTE mes calendario (0183),
   *  contra `notificaciones_promocionales` — cupo real, no decorativo. */
  notificaciones: EstadoLimite;
  /** La cuenta regresiva, si su paquete es la prueba. */
  prueba: EstadoPrueba;
  /** Dónde comparar paquetes. null = quien mira no decide la plata. */
  planes: string | null;
};

type Tarjeta = { icono: NombreIcono; titulo: string; detalle: string };

export default function InicioLealtad({
  negocioId,
  nombre,
  tarjeta,
  tarjetas,
  regalia,
  resumen,
  paquete,
  pasos,
  enlaces,
  avisosOcultos,
  accion,
  topRecurrentes,
  topGasto,
}: {
  /** El id del negocio: con él se guarda qué avisos se cerraron. */
  negocioId: string;
  /** El nombre del negocio. */
  nombre: string;
  /** La tarjeta que manda en el tablero. null = no hay ninguna viva. */
  tarjeta: TarjetaPrincipal | null;
  /** Cuántas tarjetas sin archivar tiene, y cuántas emiten pases hoy. */
  tarjetas: { vivas: number; operan: number };
  /** La recompensa que marca la meta. null = todavía no hay ninguna. */
  regalia: { nombre: string; costo: number } | null;
  /** Lo que dice el ledger. null = no hay programa que mirar. */
  resumen: ResumenLealtad | null;
  /** El paquete y cómo va contra sus topes. */
  paquete: EstadoPaquete;
  pasos: PasoPrimero[];
  enlaces: EnlacesInicio;
  /** Las claves de aviso que este navegador ya cerró (de la cookie). */
  avisosOcultos: string[];
  /** El botón de escanear, si quien mira puede acreditar. */
  accion?: ReactNode;
  /** Los 5 con más visitas, ya ordenados. Vacío = nadie con una visita
   *  todavía — la card no se pinta, cero no es información. */
  topRecurrentes: ClienteRecurrente[];
  /** Los 5 que más gastaron (colones reales), ya ordenados. Vacío =
   *  nadie con un monto registrado — el negocio puede no cobrar por
   *  Bookea, o no anotar montos, y esa card no promete un dato que no
   *  tiene. */
  topGasto: ClienteComprador[];
}) {
  const tipo = tarjeta?.tipo ?? "puntos";
  const definicion = TIPOS_TARJETA[tipo];
  const unidades = UNIDAD_SALDO[tipo];
  const miembros = resumen?.miembros ?? 0;
  const limite = paquete.clientes;

  const momento = momentoDeInicio({
    vivas: tarjetas.vivas,
    operan: tarjetas.operan,
    tipo,
    tieneMeta: !!regalia,
    miembros,
  });

  if (momento === "sin-tarjeta") {
    return <Bienvenida nombre={nombre} enlaces={enlaces} />;
  }

  const pendientes = pasos.filter((p) => !p.listo).length;

  /* Los avisos de puesta en marcha, en el orden en que hay que
     atenderlos. La clave lleva el MOMENTO adentro y no un «puesta»
     genérico a propósito: si el dueño cierra «tu tarjeta está en
     borrador» y después la publica, el aviso siguiente —«no promete
     nada»— es otro problema y tiene que salir igual. Con una clave
     compartida, cerrar el primero le habría tapado todos los demás. */
  const avisos: AvisoCerrable[] = [];

  if (momento === "sin-publicar" && tarjeta) {
    avisos.push({
      clave: "puesta-sin-publicar",
      etiqueta: CONSEJO_TARJETA[tarjeta.estado].titulo,
      nodo: (
        <PanelAccion
          icono="tarjeta"
          titulo={CONSEJO_TARJETA[tarjeta.estado].titulo}
          detalle={CONSEJO_TARJETA[tarjeta.estado].consejo}
          nota={`«${tarjeta.nombre}» · ${definicion.nombre} · ${ETIQUETA_ESTADO[tarjeta.estado]}`}
          boton={CONSEJO_TARJETA[tarjeta.estado].boton}
          href={enlaces[CONSEJO_TARJETA[tarjeta.estado].ir]}
          sinPermiso="Pedile al dueño del negocio que la publique."
        />
      ),
    });
  }

  if (momento === "sin-meta") {
    avisos.push({
      clave: "puesta-sin-meta",
      etiqueta: "Tu tarjeta todavía no promete nada",
      nodo: (
        <PanelAccion
          icono="regalo"
          titulo="Tu tarjeta todavía no promete nada"
          detalle={`Ya emite pases y la gente la puede agregar, pero sin una recompensa activa el pase muestra el saldo pelado: el cliente junta ${unidades} sin saber para qué.`}
          nota={tarjeta ? `«${tarjeta.nombre}» · ${definicion.nombre}` : null}
          boton="Definir qué se gana"
          href={enlaces.recompensas}
          sinPermiso="Pedile al dueño del negocio que defina la regalía."
        />
      ),
    });
  }

  if (momento === "sin-clientes") {
    avisos.push({
      clave: "puesta-sin-clientes",
      etiqueta: "Ya funciona: ahora hay que repartirla",
      nodo: (
        <PanelAccion
          icono="qr"
          titulo="Ya funciona: ahora hay que repartirla"
          detalle={
            regalia
              ? `Tu tarjeta emite pases y promete ${regalia.nombre} a los ${regalia.costo} ${unidades}, pero nadie se ha afiliado todavía. El QR pegado en la caja es lo que más afilia.`
              : "Tu tarjeta emite pases, pero nadie se ha afiliado todavía. El QR pegado en la caja es lo que más afilia."
          }
          nota="El póster sale en una hoja A4 con tu QR, tus colores y tu regalía."
          boton="Imprimir el póster"
          href={enlaces.poster}
          sinPermiso={null}
        />
      ),
    });
  }

  if (pendientes > 0) {
    avisos.push({
      clave: "pasos",
      etiqueta: "Primeros pasos con Bookea",
      nodo: <ListaPasos pasos={pasos} />,
    });
  }

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {/* EL TITULAR DE LA PANTALLA (`.heading` de la maqueta): kicker de
          contexto, h1 y bajada a la izquierda; la acción a la derecha.
          El botón de escanear estaba debajo, suelto, como si fuera un
          bloque más del tablero — es LA acción de la pantalla y va donde
          la maqueta pone las acciones. */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className={EYEBROW_NEUTRO}>Tu programa de lealtad</p>
          <h2 className={`mt-1.5 ${TITULO_PANTALLA}`}>Hola de nuevo, {nombre}</h2>
          <p className={`mt-1.5 ${BAJADA_PANTALLA}`}>
            {momento === "en-marcha"
              ? "Esto es lo que está pasando con tu programa de lealtad."
              : "Falta un paso para que tu programa empiece a andar."}
          </p>
        </div>
        {accion}
      </div>

      {/* ── El plan, primero y a todo el ancho ────────────────────
          Indispensable a propósito (pedido del dueño, ago 2026): antes
          vivía a media altura, empujado a la columna angosta de
          `GrillaTablero`, y compitiendo con el status de la tarjeta.
          Acá arriba nadie se lo pierde. */}
      <PlanHero paquete={paquete} ranchoId={negocioId} />

      {/* ── Lo que hay que hacer AHORA, con su X ────────────────── */}
      <AvisosCerrables
        negocioId={negocioId}
        avisos={avisos}
        ocultosIniciales={avisosOcultos}
      />

      {/* ── Los números, recién cuando hay de quién hablar ────────
          Cuatro ceros no son información, son desánimo: hasta el primer
          afiliado esta fila no existe. Lo que sí se pinta abajo es el
          paquete, que no depende de que haya pasado nada. */}
      {resumen && miembros > 0 && (
        <div className={`grid grid-cols-2 ${GAP_METRICAS} lg:grid-cols-4`}>
          <Kpi
            titulo="Clientes afiliados"
            valor={resumen.miembros.toLocaleString("es-CR")}
            detalle={`${resumen.conPase} con la tarjeta en el teléfono`}
            icono="clientes"
            /* El tope se DICE, no solo se pinta: la tarjeta roja y la
               ámbar se ven igual para quien no distingue esos dos, y
               este es el estado que frena las afiliaciones. El texto
               sale de `estadoDelLimite`, no de un umbral inventado. */
            aviso={
              limite.lleno
                ? { estado: "alerta", texto: "Tope lleno" }
                : limite.cerca
                  ? { estado: "aviso", texto: "Casi lleno" }
                  : null
            }
          />
          <Kpi
            titulo={
              definicion.acumula
                ? `${mayuscula(unidades)} en 30 días`
                : "Movimientos en 30 días"
            }
            valor={resumen.sellosRecientes.toLocaleString("es-CR")}
            detalle="lo que dio tu equipo en el mostrador"
            icono="sumar"
          />
          <Kpi
            titulo="Ya canjearon"
            valor={resumen.canjes.toLocaleString("es-CR")}
            detalle={
              resumen.canjes > 0
                ? "clientes que se llevaron su regalía"
                : "todavía nadie pidió la suya"
            }
            icono="regalo"
          />
          <Kpi
            titulo="Les toca su regalía"
            valor={resumen.listosParaCanjear.toLocaleString("es-CR")}
            detalle={
              resumen.enRiesgo > 0
                ? `${resumen.enRiesgo} sin venir hace 2 meses`
                : "nadie se está enfriando"
            }
            icono="listo"
            aviso={
              resumen.listosParaCanjear > 0
                ? { estado: "aviso", texto: "Por entregar" }
                : null
            }
          />
        </div>
      )}

      {/* ── El status de la tarjeta y los accesos rápidos ─────────
          La grilla del sistema: la columna ancha para lo que se lee (la
          tarjeta) y la angosta para lo que se hace. A 390px es una sola
          columna. */}
      <GrillaTablero>
        {tarjeta && (
          <StatusDeLaTarjeta
            tarjeta={tarjeta}
            regalia={regalia}
            resumen={resumen}
            enlaces={enlaces}
          />
        )}
        <AccesosRapidos enlaces={enlaces} />
      </GrillaTablero>

      {/* ── Mejores clientes y mejores compras, lado a lado ───────
          Dos vistas del mismo padrón (`cargarClientesAuditados`), no
          dos cifras nuevas: una por VISITAS (fidelidad) y otra por
          PLATA (`gastoTotal`, colones reales de
          `lealtad_transacciones`). Cada una se pinta sola si la otra
          está vacía —un negocio que no registra montos igual ve quién
          más vuelve— y las dos comparten fila cuando ambas tienen
          datos, para que "quién más vuelve" y "quién más gasta" se
          lean como las dos caras de la misma pregunta. */}
      {(topRecurrentes.length > 0 || topGasto.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {topRecurrentes.length > 0 && (
            <Card
              eyebrow="Quién más vuelve"
              titulo="Top 5 clientes más recurrentes"
              nivel="h3"
              accion={
                enlaces.clientes ? (
                  <a href={enlaces.clientes} className={ENLACE_CARD}>
                    Ver todos →
                  </a>
                ) : undefined
              }
            >
              <ol className="space-y-2">
                {topRecurrentes.map((c, i) => (
                  <li
                    key={c.miembroId}
                    className={`flex items-center gap-3 ${RADIO_TILE} border border-aventurea-line bg-aventurea-surface px-3.5 py-2.5`}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] font-extrabold text-aventurea-ink"
                      style={{ borderColor: ACCION_BORDE }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-aventurea-ink">
                      {c.nombre}
                    </span>
                    <span className={`shrink-0 ${DETALLE}`}>
                      {c.visitas.toLocaleString("es-CR")} visita{c.visitas === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {topGasto.length > 0 && (
            <Card
              eyebrow="Quién más gasta"
              titulo="Top 5 mejores compras"
              nivel="h3"
              accion={
                enlaces.clientes ? (
                  <a href={enlaces.clientes} className={ENLACE_CARD}>
                    Ver todos →
                  </a>
                ) : undefined
              }
            >
              <ol className="space-y-2">
                {topGasto.map((c, i) => (
                  <li
                    key={c.miembroId}
                    className={`flex items-center gap-3 ${RADIO_TILE} border border-aventurea-line bg-aventurea-surface px-3.5 py-2.5`}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[12px] font-extrabold text-aventurea-ink"
                      style={{ borderColor: ACCION_BORDE }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-aventurea-ink">
                      {c.nombre}
                    </span>
                    <span className={`shrink-0 ${DETALLE}`}>
                      ₡{c.gastoTotal.toLocaleString("es-CR")}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      {/* ── Varias tarjetas: cuántas hay y cuántas están vivas ──── */}
      {tarjetas.vivas > 1 && enlaces.programas && (
        <Card
          eyebrow="Tus tarjetas"
          titulo={`Tenés ${tarjetas.vivas} tarjetas`}
          nivel="h3"
          accion={
            <a href={enlaces.programas} className={ENLACE_CARD}>
              Verlas todas →
            </a>
          }
        >
          <p className={CUERPO_SUAVE}>
            {tarjetas.operan === 0
              ? "Ninguna está emitiendo pases ahora mismo."
              : `${tarjetas.operan} está${tarjetas.operan === 1 ? "" : "n"} emitiendo pases ahora mismo.`}
          </p>
        </Card>
      )}
    </div>
  );
}

// ── El negocio que todavía no tiene ninguna tarjeta ───────────────

/**
 * La bienvenida y el mini-tutorial.
 *
 * Es la ÚNICA pantalla de Inicio sin métricas, y a propósito: acá no
 * hay nada que medir. Lo que hace falta es entender qué va a pasar y
 * arrancar, así que hay un solo botón grande y todo lo demás es
 * contexto que lo respalda.
 *
 * «Primeros pasos» tampoco sale acá: una lista de cuatro casillas al
 * lado de un botón grande parte la atención justo cuando hay una sola
 * cosa que hacer.
 */
function Bienvenida({ nombre, enlaces }: { nombre: string; enlaces: EnlacesInicio }) {
  const recorrido: Tarjeta[] = [
    {
      icono: "qr",
      titulo: "Escanea el QR",
      detalle: "Tu cliente apunta la cámara al código de tu mostrador.",
    },
    {
      icono: "afiliar",
      titulo: "Se afilia",
      detalle: "Pone su nombre una sola vez y queda adentro del programa.",
    },
    {
      icono: "movil",
      titulo: "Guarda su tarjeta",
      detalle: "Le queda en el Wallet del teléfono. Sin apps que instalar.",
    },
    {
      icono: "regalo",
      titulo: "Reclama su regalía",
      detalle: "Al completar lo que vos pidas, se lleva lo que vos prometas.",
    },
  ];

  const equipo: Tarjeta[] = [
    {
      icono: "escanear",
      titulo: "Escaneás su tarjeta",
      detalle: "Abrís el escáner del panel y leés el código del cliente.",
    },
    {
      icono: "sumar",
      titulo: "Le acreditás lo suyo",
      detalle: "Un toque para el sello, o el monto de la compra para los puntos.",
    },
    {
      icono: "listo",
      titulo: "Listo",
      detalle: "La tarjeta del cliente se actualiza sola en su teléfono.",
    },
  ];

  const aMano: Tarjeta[] = [
    {
      icono: "negocio",
      titulo: "El logo de tu negocio",
      detalle: "Un archivo de imagen. Sin logo, la tarjeta escribe tu nombre.",
    },
    {
      icono: "tarjeta",
      titulo: "Tus dos colores",
      detalle: "El del fondo y el del acento. Se pueden cambiar después.",
    },
    {
      icono: "regalo",
      titulo: "Qué regalás y cada cuánto",
      detalle: "«El café 11 gratis», «10% de descuento», lo que sea tuyo.",
    },
  ];

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      <div className="min-w-0">
        <p className={EYEBROW_NEUTRO}>Primer día</p>
        <h2 className={`mt-1.5 ${TITULO_PANTALLA}`}>
          Bienvenido a tu programa de lealtad, {nombre}
        </h2>
        <p className={`mt-1.5 ${BAJADA_PANTALLA}`}>
          Todavía no tenés ninguna tarjeta. Acá abajo está lo que va a pasar y lo que
          necesitás para armar la primera.
        </p>
      </div>

      {/* ── El botón grande ──────────────────────────────────────
          Es el `.insight` de la maqueta —el bloque de acento que se
          despega del resto— con contenido nuestro: la única cosa que
          hay que hacer el primer día. */}
      <div
        className={`${RADIO_CARD} border px-5 py-8 text-center sm:px-8`}
        style={{ borderColor: ACCION_BORDE, background: ACCION_TINTE }}
      >
        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: ACCION_TINTE, color: ACCION }}
        >
          <Icono nombre="tarjeta" className="h-7 w-7" />
        </span>
        <h3 className="titulo mt-4 text-[19px] leading-tight tracking-[-0.02em] text-white sm:text-[22px]">
          Tu programa arranca con tu primer pase
        </h3>
        <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] leading-relaxed text-aventurea-ink-soft">
          Es la tarjeta que tus clientes van a llevar en el teléfono: la agregan una vez
          desde tu QR y ahí les vas sumando lo que ganan en cada visita.
        </p>

        {enlaces.crear ? (
          <Link
            href={enlaces.crear}
            className={`${BOTON_ACCION} mt-6 h-12 px-7 text-[15px]`}
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            ¡Iniciá tu primer pase! →
          </Link>
        ) : (
          <p className="mt-6 text-[13px] font-bold text-aventurea-ink">
            Pedile al dueño del negocio que cree la primera tarjeta.
          </p>
        )}

        {/* Decía «nace en borrador: nada se publica sin que vos lo
            digas», y era mentira desde que `estadoAlCrear()` devuelve
            activo. La cautela la cumple el paso de Revisar, no un
            estado escondido — y eso es lo que dice ahora. */}
        <p className="mx-auto mt-4 max-w-[440px] text-[12px] leading-relaxed text-aventurea-ink-soft">
          Se arma en cinco pasos —tipo, diseño, beneficio, reglas y una última mirada— y al
          confirmar queda publicada: empieza a emitir pases de una.
        </p>
      </div>

      {/* ── El mini-tutorial ───────────────────────────────────── */}
      <Card
        eyebrow="Cómo funciona"
        titulo="Qué va a pasar cuando la tengas"
        nivel="h3"
        /* Se cuenta, no se escribe: si mañana el recorrido tiene un paso
           más, este número lo sigue solo. */
        accion={<span className={DETALLE}>{recorrido.length + equipo.length} pasos</span>}
      >
        <Rotulo>Lo que hace tu cliente</Rotulo>
        <Flujo tarjetas={recorrido} columnas={4} />

        <Rotulo className="mt-5">Lo que hace tu equipo</Rotulo>
        <Flujo tarjetas={equipo} columnas={3} />
      </Card>

      <Card
        eyebrow="Antes de empezar"
        titulo="Qué tener a mano"
        nivel="h3"
        accion={<span className={DETALLE}>Nada obligatorio</span>}
      >
        <p className={CUERPO_SUAVE}>
          Nada es obligatorio para arrancar: el logo, los colores, la regalía y las reglas se
          cambian cuando querás. Lo único que queda fijo es el tipo de tarjeta, y recién
          cuando tengas el primer cliente adentro.
        </p>
        <div className="mt-3">
          <Flujo tarjetas={aMano} columnas={3} conFlecha={false} />
        </div>
      </Card>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────

/**
 * El bloque de «esto es lo que falta y esto es lo que hay que hacer».
 *
 * El botón se pinta SOLO si quien mira tiene esa sección; si no, se
 * dice a quién pedírselo. Un colaborador de mostrador no configura la
 * tarjeta, y ofrecerle un botón que lo lleva a una sección que no ve
 * sería mandarlo a una pared.
 */
function PanelAccion({
  icono,
  titulo,
  detalle,
  nota,
  boton,
  href,
  sinPermiso,
}: {
  icono: NombreIcono;
  titulo: string;
  detalle: string;
  nota: string | null;
  boton: string;
  href: string | null;
  /** Qué decirle a quien no puede hacerlo. null = no se dice nada. */
  sinPermiso: string | null;
}) {
  return (
    <div
      className={`${RADIO_CARD} border p-4 sm:p-5`}
      style={{ borderColor: ACCION_BORDE, background: ACCION_TINTE }}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: ACCION_TINTE, color: ACCION }}
        >
          <Icono nombre={icono} className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          {/* El hueco de la derecha es para la X que le pone
              <AvisosCerrables>: sin él, el título le pasa por debajo. */}
          <h3 className="titulo pr-8 text-[17px] leading-tight tracking-[-0.02em] text-white sm:text-[18px]">
            {titulo}
          </h3>
          <p className={`mt-1.5 ${CUERPO}`}>{detalle}</p>
          {nota && <p className={`mt-2 ${CUERPO_SUAVE}`}>{nota}</p>}

          {href ? (
            <a
              href={href}
              className={`${BOTON_ACCION} mt-4`}
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              {boton} →
            </a>
          ) : (
            sinPermiso && (
              <p className="mt-4 text-[12.5px] font-bold text-aventurea-ink-soft">{sinPermiso}</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * EL PLAN, INDISPENSABLE Y A TODO EL ANCHO (pedido del dueño, ago
 * 2026): qué paquete tiene, cómo va contra sus topes y un botón para
 * subir de paquete que no se puede pasar por alto. Es lo primero que
 * se pinta después del titular — antes de los avisos de puesta en
 * marcha, no después.
 *
 * Los TRES topes que se pintan son los que el servidor hace cumplir de
 * verdad —clientes, tarjetas y notificaciones (0183, contra
 * `notificaciones_promocionales`, ver `cupo-notificaciones.ts`)—. Los
 * otros de `LimitesPlan` (sedes, automatizaciones…) siguen sin
 * medidor: un medidor de algo que nadie puede consumir promete una
 * función que no existe.
 *
 * El botón dice «¡Mejorar plan!» salvo en el paquete más alto del
 * catálogo (`PLANES_OFRECIDOS` está de menor a mayor): ahí no hay nada
 * más arriba, así que prometer una mejora sería mentir. Manda a
 * /lealtad/planes en vez de repintar la grilla de paquetes acá: esa
 * grilla se sacó a propósito de la sección Plan para no mantener el
 * mismo catálogo en dos lugares (ver seccion-plan.tsx).
 */
function PlanHero({
  paquete,
  ranchoId,
}: {
  paquete: EstadoPaquete;
  ranchoId: string;
}) {
  const definicion = definicionDe(paquete.plan);
  const precio = definicion ? precioDe(definicion) : null;
  const clientes = paquete.clientes;
  const restante = textoRestante(paquete.prueba);
  const esElMasAlto = definicion?.id === PLANES_OFRECIDOS[PLANES_OFRECIDOS.length - 1];

  return (
    <Card
      eyebrow="Tu paquete"
      titulo="Status del plan actual"
      nivel="h3"
      accion={
        definicion ? (
          <span
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold uppercase leading-none tracking-wide"
            style={{ background: ACCION_TINTE, color: ACCION }}
          >
            {precio === null ? "A convenir" : `${precio}/mes`}
          </span>
        ) : (
          <PildoraEstado estado="neutro">Sin paquete</PildoraEstado>
        )
      }
    >
      {definicion ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[26px] font-extrabold leading-none tracking-[-0.04em] text-aventurea-ink">
            {definicion.nombre}
          </p>
          {!definicion.vigente && (
            <PildoraEstado estado="neutro">Paquete anterior</PildoraEstado>
          )}
        </div>
      ) : (
        <p className={CUERPO}>
          Tu programa anda sin un paquete asignado, así que todavía no tiene topes escritos.
        </p>
      )}

      {/* La prueba se cuenta acá y no solo en un correo: el correo se
          pierde, y con la fecha a la vista el corte deja de ser una
          sorpresa. Quien no ve la sección Plan tampoco ve esto —el
          servidor no le carga la fecha—, y está bien: el empleado del
          mostrador no decide qué se paga. */}
      {restante && (
        <p
          className={`mt-3 ${RADIO_TILE} px-3 py-2 text-[12.5px] font-bold text-aventurea-ink`}
          style={{ background: ACCION_TINTE }}
        >
          {restante}
        </p>
      )}

      {/* Lado a lado y no apilados: a todo el ancho de la pantalla hay
          lugar de sobra, y separados se leen más rápido que en una
          columna angosta. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Medidor
            icono="clientes"
            etiqueta="Clientes afiliados"
            usado={clientes.usado}
            tope={clientes.limite}
            alerta={clientes.lleno}
            aviso={clientes.cerca}
            detalle="Sin tope de clientes en tu paquete."
          />
          {/* Nunca solo el color: lo que pasa se dice con palabras — la
              barra roja y la ámbar se ven igual para quien no distingue
              esos dos, y este es el tope que frena el programa. */}
          {clientes.limite !== null && (
            <p className="mt-1.5 text-[12px] leading-snug text-aventurea-ink-soft">
              {clientes.lleno
                ? "Llegaste al tope: un cliente nuevo ya no se puede afiliar."
                : `Te queda${clientes.disponibles === 1 ? "" : "n"} ${clientes.disponibles?.toLocaleString("es-CR")} lugar${clientes.disponibles === 1 ? "" : "es"}.`}
            </p>
          )}
        </div>

        <Medidor
          icono="tarjeta"
          etiqueta="Tarjetas publicables"
          usado={paquete.tarjetas.usado}
          tope={paquete.tarjetas.limite}
          alerta={paquete.tarjetas.lleno}
          aviso={paquete.tarjetas.cerca}
          detalle="Sin tope de tarjetas en tu paquete."
        />

        <div>
          <Medidor
            icono="campana"
            etiqueta="Anuncios este mes"
            usado={paquete.notificaciones.usado}
            tope={paquete.notificaciones.limite}
            alerta={paquete.notificaciones.lleno}
            aviso={paquete.notificaciones.cerca}
            detalle="Sin tope de anuncios en tu paquete."
          />
          {paquete.notificaciones.limite !== null && (
            <p className="mt-1.5 text-[12px] leading-snug text-aventurea-ink-soft">
              {paquete.notificaciones.lleno
                ? "Llegaste al tope: el cupo vuelve a abrirse el mes que viene."
                : `Te queda${paquete.notificaciones.disponibles === 1 ? "" : "n"} ${paquete.notificaciones.disponibles?.toLocaleString("es-CR")} por enviar este mes.`}
            </p>
          )}
        </div>
      </div>

      {paquete.planes ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href={paquete.planes}
            className={`${BOTON_ACCION} presionable px-6 text-[13.5px]`}
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            {esElMasAlto ? "Ver los paquetes" : "¡Mejorar plan!"}
            <span aria-hidden>→</span>
          </Link>

          {/* ── CANCELAR, SOLO EN PAQUETES PAGOS ────────────────────
              `esPlanSinCosto` y no `precio === "$0"`: el texto del
              precio es para mostrar, y comparar contra una cadena
              formateada se rompe el día que cambie el formato. Esa
              función además pregunta primero si el paquete SE OFRECE,
              que es la comprobación que este repo ya documenta como
              necesaria.

              En la Prueba el botón no aparece, y no por prolijidad: no
              hay nada que cancelar —no hay cobro— y ofrecerlo sugeriría
              que sí lo hay. Lo que se ofrece ahí es mejorar.

              No cancela desde acá: lleva al Customer Portal de Stripe,
              que es donde ya vive esa operación. Escribir nuestra propia
              pantalla de cancelación sería un lugar más donde un error
              toca plata de verdad — el mismo criterio que ya explica
              `abrirPortalDeFacturacion`. */}
          {!esPlanSinCosto(paquete.plan) && (
            <BotonCancelarSuscripcion ranchoId={ranchoId} />
          )}
        </div>
      ) : (
        /* Sin permiso no se ofrece el botón: comprar un paquete es del
           dueño, y mandar al mostrador a una pantalla de pago sería
           mandarlo a una pared. */
        <p className={`mt-5 ${DETALLE}`}>El paquete lo elige el dueño del negocio.</p>
      )}
    </Card>
  );
}

/**
 * ACCESOS RÁPIDOS: adónde ir a HACER algo, no a leer un número. Existe
 * para que el tablero tenga algo con qué actuar incluso el día que
 * todavía no hay una sola cifra que mostrar (negocio recién armado,
 * cero afiliados) — no se rellena con datos inventados, se rellena con
 * las secciones a las que esta persona ya tiene paso.
 *
 * Cada enlace sale de `EnlacesInicio`, que ya llega con el permiso
 * resuelto (`ancla()` en panel/[id]/page.tsx): si esta persona no tiene
 * esa sección, el campo es `null` y la fila no se pinta. Nunca se
 * inventa un enlace acá.
 */
function AccesosRapidos({ enlaces }: { enlaces: EnlacesInicio }) {
  const todos: { icono: NombreIcono; etiqueta: string; href: string | null }[] = [
    { icono: "tarjeta", etiqueta: "Tus tarjetas", href: enlaces.programas },
    { icono: "clientes", etiqueta: "Clientes", href: enlaces.clientes },
    { icono: "campana", etiqueta: "Marketing", href: enlaces.marketing },
    { icono: "configuracion", etiqueta: "Configuración", href: enlaces.configuracion },
    { icono: "poster", etiqueta: "Póster y QR", href: enlaces.poster },
  ];
  const accesos = todos.filter(
    (a): a is { icono: NombreIcono; etiqueta: string; href: string } => a.href !== null,
  );

  if (accesos.length === 0) return null;

  return (
    <Card eyebrow="A un toque" titulo="Accesos rápidos" nivel="h3">
      <div className="space-y-2">
        {accesos.map((a) => (
          <a key={a.etiqueta} href={a.href} className={TILE_LEALTAD}>
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={DISCO_LEALTAD}
            >
              <Icono nombre={a.icono} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-bold text-aventurea-ink">
              {a.etiqueta}
            </span>
            <span aria-hidden className="shrink-0 text-aventurea-ink-soft">
              →
            </span>
          </a>
        ))}
      </div>
    </Card>
  );
}

/**
 * EL STATUS DE LA TARJETA: qué promete y quién la lleva encima.
 *
 * Es la otra mitad de «cómo va mi programa». No repite ninguna cifra de
 * los KPI de arriba: acá va lo que la tarjeta DICE (su meta) y cuánta
 * de la gente afiliada la tiene de verdad en el teléfono, que es la
 * diferencia entre un cliente que se anotó y uno al que le podés
 * llegar.
 */
function StatusDeLaTarjeta({
  tarjeta,
  regalia,
  resumen,
  enlaces,
}: {
  tarjeta: TarjetaPrincipal;
  regalia: { nombre: string; costo: number } | null;
  resumen: ResumenLealtad | null;
  enlaces: EnlacesInicio;
}) {
  const definicion = TIPOS_TARJETA[tarjeta.tipo];
  const unidades = UNIDAD_SALDO[tarjeta.tipo];
  const miembros = resumen?.miembros ?? 0;

  return (
    <Card
      eyebrow="Tu tarjeta"
      titulo={tarjeta.nombre}
      nivel="h3"
      /* El estado como PÍLDORA del sistema y no como pastilla propia:
         la misma tarjeta se ve «Activa» acá y en la lista de Tarjetas, y
         tiene que verse igual en las dos. El color sale del MISMO mapa
         que usa esa lista (`ESTADO_DE_TONO` sobre `TONO_ESTADO`), que es
         donde vive la decisión de que «activa» va en azul y no en verde:
         el verde queda fuera de la marca de Lealtad. */
      accion={
        <PildoraEstado estado={ESTADO_DE_TONO[TONO_ESTADO[tarjeta.estado]]}>
          {ETIQUETA_ESTADO[tarjeta.estado]}
        </PildoraEstado>
      }
    >
      <p className={CUERPO_SUAVE}>{definicion.nombre}</p>

      <ul className="mt-3 space-y-2.5">
        <Dato
          icono="regalo"
          texto={
            regalia
              ? `Se gana ${regalia.nombre} a los ${regalia.costo.toLocaleString("es-CR")} ${unidades}.`
              : definicion.acumula
                ? "Todavía no hay una recompensa activa: el pase muestra el saldo pelado."
                : "El beneficio va adentro de la tarjeta, sin meta que juntar."
          }
        />
        {miembros > 0 && resumen && (
          <Dato
            icono="movil"
            texto={`${resumen.conPase.toLocaleString("es-CR")} de ${miembros.toLocaleString("es-CR")} la llevan en el teléfono.`}
          />
        )}
      </ul>

      {enlaces.tarjeta && (
        <a href={enlaces.tarjeta} className={`mt-4 inline-block ${ENLACE_CARD}`}>
          Abrir el diseño de la tarjeta →
        </a>
      )}
    </Card>
  );
}

/** Una línea de detalle con su disco de ícono. Es la `.action` de la
 *  maqueta en versión compacta: el disco lleva el color de acento, que
 *  es lo que hace que la lista se lea como parte del panel y no como
 *  una lista de viñetas. */
function Dato({ icono, texto }: { icono: NombreIcono; texto: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
        style={DISCO_LEALTAD}
      >
        <Icono nombre={icono} className="h-[13px] w-[13px]" />
      </span>
      <span className={CUERPO_SUAVE}>{texto}</span>
    </li>
  );
}

/**
 * «Primeros pasos». Cada casilla se marca con una SEÑAL REAL de la
 * base (¿hay recompensa activa?, ¿hay tarjeta publicada?, ¿hay
 * miembros?), nunca con un booleano que alguien tocó: una lista que se
 * auto-completa sin que nada haya pasado es peor que no tenerla.
 *
 * Desaparece SOLA cuando están los cuatro. Una lista toda en verde para
 * siempre es decoración, y el tablero necesita ese espacio para los
 * datos. Y mientras quede alguno, se puede cerrar a mano con la X que
 * le pone <AvisosCerrables> — cerrarla no marca nada como hecho: la
 * lista vuelve entera desde la barrita de abajo.
 */
function ListaPasos({ pasos }: { pasos: PasoPrimero[] }) {
  const listos = pasos.filter((p) => p.listo).length;
  const avance = pasos.length ? Math.round((listos / pasos.length) * 100) : 0;
  // El primero que falta es el que se resalta: una lista con cuatro
  // llamados a la acción a la vez no dice por dónde empezar.
  const siguiente = pasos.findIndex((p) => !p.listo);

  return (
    /* El contador va en el slot de acción del encabezado, que es donde
       la maqueta pone el dato de una tarjeta. `pr-9` sigue haciendo
       falta: es el hueco de la X que le pone <AvisosCerrables>. */
    <Card
      eyebrow="Puesta en marcha"
      titulo="Primeros pasos con Bookea"
      nivel="h3"
      accion={
        <span className={`pr-9 ${DETALLE}`}>
          {listos} de {pasos.length} listos
        </span>
      }
    >
      {/* La barra de progreso del sistema: 6px, carril hundido, relleno
          del color de acción. */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/25">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${avance}%`, background: ACCION }}
        />
      </div>

      <ol className="mt-4 space-y-2">
        {pasos.map((paso, i) => {
          const destacado = i === siguiente;
          return (
            <li
              key={paso.titulo}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2.5 ${RADIO_TILE} border border-aventurea-line bg-aventurea-surface px-4 py-3`}
              style={
                destacado
                  ? { borderColor: ACCION_BORDE, background: ACCION_TINTE }
                  : undefined
              }
            >
              {paso.listo ? (
                <span aria-hidden className="shrink-0 text-aventurea-green">
                  <Icono nombre="listo" className="h-[22px] w-[22px]" />
                </span>
              ) : (
                /* El número del paso pendiente. Antes su borde y su
                   letra eran alfas de blanco (.25 y .5): el mismo
                   estado se veía de dos colores según cayera sobre la
                   fila normal o sobre la destacada, y el .25 daba 1,6:1
                   contra la fila. Ahora los dos casos salen de tokens
                   sólidos — el de acción cuando es el próximo, y el
                   gris de texto del panel (6,81:1) cuando no. */
                <span
                  className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11px] font-extrabold ${
                    destacado ? "" : "border-aventurea-line text-aventurea-ink-soft"
                  }`}
                  style={destacado ? { borderColor: ACCION, color: ACCION } : undefined}
                >
                  {i + 1}
                </span>
              )}

              <span className="min-w-0 flex-1 basis-[min(100%,240px)]">
                <span
                  className={`block text-[13.5px] font-bold leading-tight ${
                    paso.listo ? "text-aventurea-ink-soft" : "text-aventurea-ink"
                  }`}
                >
                  {paso.titulo}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-aventurea-ink-soft">
                  {paso.detalle}
                </span>
              </span>

              {paso.cta && (
                <a
                  href={paso.cta.href}
                  className={`inline-flex h-9 shrink-0 items-center rounded-xl px-3.5 text-[12.5px] font-bold transition-colors ${
                    destacado
                      ? "font-extrabold"
                      : "border border-aventurea-line text-aventurea-ink-soft hover:text-aventurea-ink"
                  }`}
                  style={destacado ? { background: ACCION, color: ACCION_TINTA } : undefined}
                >
                  {paso.cta.texto} →
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Rotulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`mb-2.5 mt-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-aventurea-ink-soft ${className}`}
    >
      {children}
    </p>
  );
}

/**
 * La fila de pasos con la flecha en el canal entre tarjetas. La flecha
 * sale SOLO en la fila de una línea (lg): apilado, una flecha
 * horizontal entre cosas que van hacia abajo miente. Y se apaga entera
 * en las listas que no son una secuencia —«qué tener a mano» son tres
 * cosas sueltas, no tres pasos en orden—.
 */
function Flujo({
  tarjetas,
  columnas,
  conFlecha = true,
}: {
  tarjetas: Tarjeta[];
  columnas: 3 | 4;
  conFlecha?: boolean;
}) {
  return (
    <div
      className={`grid gap-2.5 sm:grid-cols-2 ${columnas === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      {tarjetas.map((t, i) => (
        <div
          key={t.titulo}
          className={`relative flex items-start gap-3 ${RADIO_TILE} border border-aventurea-line bg-aventurea-cream-2 px-3.5 py-3`}
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={DISCO_LEALTAD}
          >
            <Icono nombre={t.icono} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight text-aventurea-ink">
              {t.titulo}
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-aventurea-ink-soft">
              {t.detalle}
            </span>
          </span>

          {/* La flecha del canal entre pasos. Sólida y no `text-white/25`
              (1,6:1 sobre el panel, o sea que no se veía): usa el mismo
              gris de texto del módulo, 6,81:1. */}
          {conFlecha && i < tarjetas.length - 1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-[15px] top-1/2 hidden -translate-y-1/2 text-[13px] text-aventurea-ink-soft lg:block"
            >
              →
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** «sellos» → «Sellos», sin tocar el resto de la palabra. */
function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
