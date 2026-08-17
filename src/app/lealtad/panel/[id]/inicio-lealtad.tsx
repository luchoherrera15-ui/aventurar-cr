import type { ReactNode } from "react";
import Link from "next/link";
import { Icono, type NombreIcono } from "./iconos";
import Kpi from "./kpi";
import Medidor from "./medidor";
import AvisosCerrables, { type AvisoCerrable } from "./avisos-cerrables";
import { CONSEJO_TARJETA, momentoDeInicio } from "@/lib/lealtad/inicio";
import { TIPOS_TARJETA, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { ETIQUETA_ESTADO, type EstadoVisible } from "@/lib/lealtad/programas";
import type { ResumenLealtad } from "@/lib/lealtad/tablero";
import { definicionDe, precioDe, type EstadoLimite } from "@/lib/lealtad/planes";
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

/* El azul de acción para fondo oscuro. Este tablero se dibuja sobre el
   navy profundo del panel (y sobre cards blancas translúcidas, que ahí
   son casi igual de oscuras): el azul de marca se apaga en los dos, y
   `--accion-claro` es el que sí se lee. La letra va con el token, no a
   ojo, porque sobre este azul el blanco no alcanza. */
const ACCION = "var(--accion-claro)";
const ACCION_TINTA = "var(--accion-claro-tinta)";
const ACCION_TINTE = "rgba(157,180,255,.14)";
const ACCION_BORDE = "rgba(157,180,255,.45)";

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
};

export type TarjetaPrincipal = {
  nombre: string;
  tipo: TipoTarjeta;
  estado: EstadoVisible;
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
    <div className="space-y-5">
      <div>
        <h2 className="text-[21px] font-extrabold leading-tight text-white sm:text-[24px]">
          Hola de nuevo, {nombre}
        </h2>
        <p className="mt-1 text-[13.5px] text-white/55">
          {momento === "en-marcha"
            ? "Esto es lo que está pasando con tu programa de lealtad."
            : "Falta un paso para que tu programa empiece a andar."}
        </p>
      </div>

      {accion}

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            titulo="Clientes afiliados"
            valor={resumen.miembros.toLocaleString("es-CR")}
            detalle={`${resumen.conPase} con la tarjeta en el teléfono`}
            tono={limite.lleno ? "alerta" : limite.cerca ? "aviso" : "normal"}
          />
          <Kpi
            titulo={
              definicion.acumula
                ? `${mayuscula(unidades)} en 30 días`
                : "Movimientos en 30 días"
            }
            valor={resumen.sellosRecientes.toLocaleString("es-CR")}
            detalle="lo que dio tu equipo en el mostrador"
          />
          <Kpi
            titulo="Ya canjearon"
            valor={resumen.canjes.toLocaleString("es-CR")}
            detalle={
              resumen.canjes > 0
                ? "clientes que se llevaron su regalía"
                : "todavía nadie pidió la suya"
            }
          />
          <Kpi
            titulo="Les toca su regalía"
            valor={resumen.listosParaCanjear.toLocaleString("es-CR")}
            detalle={
              resumen.enRiesgo > 0
                ? `${resumen.enRiesgo} sin venir hace 2 meses`
                : "nadie se está enfriando"
            }
            tono={resumen.listosParaCanjear > 0 ? "aviso" : "normal"}
          />
        </div>
      )}

      {/* ── El status del paquete y el de la tarjeta ────────────── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <StatusDelPlan paquete={paquete} />
        {tarjeta && (
          <StatusDeLaTarjeta
            tarjeta={tarjeta}
            regalia={regalia}
            resumen={resumen}
            enlaces={enlaces}
          />
        )}
      </div>

      {/* ── Varias tarjetas: cuántas hay y cuántas están vivas ──── */}
      {tarjetas.vivas > 1 && enlaces.programas && (
        <a
          href={enlaces.programas}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-aventurea-line bg-white px-4 py-3.5"
        >
          <span className="text-[13.5px] font-bold text-aventurea-ink">
            Tenés {tarjetas.vivas} tarjetas
          </span>
          <span className="text-[12.5px] text-aventurea-ink-soft">
            {tarjetas.operan === 0
              ? "ninguna está emitiendo pases"
              : `${tarjetas.operan} emitiendo pases →`}
          </span>
        </a>
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
    <div className="space-y-5">
      <div>
        <h2 className="text-[21px] font-extrabold leading-tight text-white sm:text-[24px]">
          Bienvenido a tu programa de lealtad, {nombre}
        </h2>
        <p className="mt-1 text-[13.5px] text-white/55">
          Todavía no tenés ninguna tarjeta. Acá abajo está lo que va a pasar y lo que
          necesitás para armar la primera.
        </p>
      </div>

      {/* ── El botón grande ────────────────────────────────────── */}
      <div
        className="rounded-3xl border px-5 py-8 text-center sm:px-8"
        style={{ borderColor: ACCION_BORDE, background: ACCION_TINTE }}
      >
        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: ACCION_TINTE, color: ACCION }}
        >
          <Icono nombre="tarjeta" className="h-7 w-7" />
        </span>
        <h3 className="mt-4 text-[19px] font-extrabold leading-tight text-white sm:text-[22px]">
          Tu programa arranca con tu primer pase
        </h3>
        <p className="mx-auto mt-2 max-w-[460px] text-[13.5px] leading-relaxed text-white/60">
          Es la tarjeta que tus clientes van a llevar en el teléfono: la agregan una vez
          desde tu QR y ahí les vas sumando lo que ganan en cada visita.
        </p>

        {enlaces.crear ? (
          <Link
            href={enlaces.crear}
            className="mt-6 inline-block rounded-2xl px-7 py-4 text-[15px] font-extrabold sm:text-[16px]"
            style={{ background: ACCION, color: ACCION_TINTA }}
          >
            ¡Iniciá tu primer pase! →
          </Link>
        ) : (
          <p className="mt-6 text-[13px] font-bold text-white/70">
            Pedile al dueño del negocio que cree la primera tarjeta.
          </p>
        )}

        {/* Decía «nace en borrador: nada se publica sin que vos lo
            digas», y era mentira desde que `estadoAlCrear()` devuelve
            activo. La cautela la cumple el paso de Revisar, no un
            estado escondido — y eso es lo que dice ahora. */}
        <p className="mx-auto mt-4 max-w-[440px] text-[12px] leading-relaxed text-white/55">
          Se arma en cinco pasos —tipo, diseño, beneficio, reglas y una última mirada— y al
          confirmar queda publicada: empieza a emitir pases de una.
        </p>
      </div>

      {/* ── El mini-tutorial ───────────────────────────────────── */}
      <Card>
        <h3 className="text-[16px] font-extrabold text-aventurea-ink">
          Qué va a pasar cuando la tengas
        </h3>

        <Rotulo>Lo que hace tu cliente</Rotulo>
        <Flujo tarjetas={recorrido} columnas={4} />

        <Rotulo className="mt-5">Lo que hace tu equipo</Rotulo>
        <Flujo tarjetas={equipo} columnas={3} />
      </Card>

      <Card>
        <h3 className="text-[16px] font-extrabold text-aventurea-ink">
          Qué tener a mano antes de empezar
        </h3>
        <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">
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
      className="rounded-3xl border p-4 sm:p-6"
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
          <h3 className="pr-8 text-[16px] font-extrabold leading-tight text-white sm:text-[17px]">
            {titulo}
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{detalle}</p>
          {nota && <p className="mt-2 text-[12px] text-white/55">{nota}</p>}

          {href ? (
            <a
              href={href}
              className="mt-4 inline-block rounded-xl px-5 py-3 text-[13.5px] font-extrabold"
              style={{ background: ACCION, color: ACCION_TINTA }}
            >
              {boton} →
            </a>
          ) : (
            sinPermiso && (
              <p className="mt-4 text-[12.5px] font-bold text-white/60">{sinPermiso}</p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * STATUS DEL PLAN ACTUAL: qué paquete tiene, cómo va contra sus topes y
 * por dónde se comparan los demás.
 *
 * Los DOS topes que se pintan son los dos que el servidor hace cumplir
 * de verdad —clientes y tarjetas—. Los otros cuatro de `LimitesPlan`
 * (notificaciones, sedes, automatizaciones…) no tienen producto detrás:
 * un medidor de algo que nadie puede consumir promete una función que
 * no existe.
 *
 * Y el botón manda a /lealtad/planes en vez de repintar la grilla de
 * paquetes: esa grilla se sacó a propósito de la sección Plan para no
 * mantener el mismo catálogo en dos lugares (ver seccion-plan.tsx).
 */
function StatusDelPlan({ paquete }: { paquete: EstadoPaquete }) {
  const definicion = definicionDe(paquete.plan);
  const precio = definicion ? precioDe(definicion) : null;
  const clientes = paquete.clientes;
  const restante = textoRestante(paquete.prueba);

  return (
    <Card>
      <Encabezado icono="plan" titulo="Status del plan actual" />

      {definicion ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[24px] font-extrabold leading-none text-aventurea-ink">
            {definicion.nombre}
          </p>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: ACCION_TINTE, color: ACCION }}
          >
            {precio === null ? "A convenir" : `${precio}/mes`}
          </span>
          {!definicion.vigente && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-aventurea-ink-soft">
              Paquete anterior
            </span>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-aventurea-ink-soft">
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
          className="mt-3 rounded-xl px-3 py-2 text-[12.5px] font-bold text-aventurea-ink"
          style={{ background: ACCION_TINTE }}
        >
          {restante}
        </p>
      )}

      <div className="mt-4 space-y-4">
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
      </div>

      {paquete.planes ? (
        <Link
          href={paquete.planes}
          className="presionable mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-extrabold"
          style={{ background: ACCION, color: ACCION_TINTA }}
        >
          Ver los demás paquetes
          <span aria-hidden>→</span>
        </Link>
      ) : (
        /* Sin permiso no se ofrece el botón: comprar un paquete es del
           dueño, y mandar al mostrador a una pantalla de pago sería
           mandarlo a una pared. */
        <p className="mt-5 text-[12px] text-aventurea-ink-soft">
          El paquete lo elige el dueño del negocio.
        </p>
      )}
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
    <Card>
      <Encabezado icono="tarjeta" titulo="Tu tarjeta" />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-[19px] font-extrabold leading-tight text-aventurea-ink">
          {tarjeta.nombre}
        </p>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={
            tarjeta.estado === "activo"
              ? { background: ACCION_TINTE, color: ACCION }
              : { background: "rgba(255,255,255,.10)" }
          }
        >
          {ETIQUETA_ESTADO[tarjeta.estado]}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-aventurea-ink-soft">{definicion.nombre}</p>

      <ul className="mt-4 space-y-2.5">
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
        <a
          href={enlaces.tarjeta}
          className="mt-4 inline-block text-[12.5px] font-bold text-aventurea-ink underline"
        >
          Abrir el diseño de la tarjeta →
        </a>
      )}
    </Card>
  );
}

function Encabezado({ icono, titulo }: { icono: NombreIcono; titulo: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
        style={{ background: ACCION_TINTE, color: ACCION }}
      >
        <Icono nombre={icono} className="h-[17px] w-[17px]" />
      </span>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
        {titulo}
      </h3>
    </div>
  );
}

function Dato({ icono, texto }: { icono: NombreIcono; texto: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-[1px] shrink-0 text-aventurea-ink-soft">
        <Icono nombre={icono} className="h-[15px] w-[15px]" />
      </span>
      <span className="text-[12.5px] leading-snug text-aventurea-ink-soft">{texto}</span>
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
    <Card>
      {/* `pr-9` deja libre la esquina donde <AvisosCerrables> pone la X:
          si no, «2 de 4 listos» le queda debajo. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pr-9">
        <h3 className="text-[16px] font-extrabold text-aventurea-ink">
          Primeros pasos con Bookea
        </h3>
        <span className="text-[12.5px] font-bold text-aventurea-ink-soft">
          {listos} de {pasos.length} listos
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
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
              className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-2xl border bg-white px-4 py-3.5"
              style={
                destacado
                  ? { borderColor: ACCION_BORDE, background: ACCION_TINTE }
                  : undefined
              }
            >
              {paso.listo ? (
                <span className="shrink-0 text-aventurea-green">
                  <Icono nombre="listo" className="h-[22px] w-[22px]" />
                </span>
              ) : (
                <span
                  className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border text-[11px] font-extrabold"
                  style={{
                    borderColor: destacado ? ACCION : "rgba(255,255,255,.25)",
                    color: destacado ? ACCION : "rgba(255,255,255,.5)",
                  }}
                >
                  {i + 1}
                </span>
              )}

              <span className="min-w-0 flex-1 basis-[min(100%,240px)]">
                <span
                  className={`block text-[13.5px] font-bold ${
                    paso.listo ? "text-aventurea-ink-soft" : "text-aventurea-ink"
                  }`}
                >
                  {paso.titulo}
                </span>
                <span className="block text-[12px] leading-snug text-aventurea-ink-soft">
                  {paso.detalle}
                </span>
              </span>

              {paso.cta && (
                <a
                  href={paso.cta.href}
                  className={`shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition-colors ${
                    destacado
                      ? ""
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl border p-4 sm:p-6"
      style={{ background: "rgba(255,255,255,.035)", borderColor: "rgba(255,255,255,.09)" }}
    >
      {children}
    </div>
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
          className="relative flex items-start gap-3 rounded-2xl border border-aventurea-line bg-white px-3.5 py-3"
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ background: ACCION_TINTE, color: ACCION }}
          >
            <Icono nombre={t.icono} className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold text-aventurea-ink">{t.titulo}</span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-aventurea-ink-soft">
              {t.detalle}
            </span>
          </span>

          {conFlecha && i < tarjetas.length - 1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute -right-[15px] top-1/2 hidden -translate-y-1/2 text-[13px] text-white/25 lg:block"
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
