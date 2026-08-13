import type { ReactNode } from "react";
import Link from "next/link";
import { Icono, type NombreIcono } from "./iconos";
import Kpi from "./kpi";
import { CONSEJO_TARJETA, momentoDeInicio } from "@/lib/lealtad/inicio";
import { TIPOS_TARJETA, UNIDAD_SALDO, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { ETIQUETA_ESTADO, type EstadoVisible } from "@/lib/lealtad/programas";
import type { ResumenLealtad } from "@/lib/lealtad/tablero";
import type { EstadoLimite } from "@/lib/lealtad/planes";

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

const NARANJA = "#ee7420";

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

type Tarjeta = { icono: NombreIcono; titulo: string; detalle: string };

export default function InicioLealtad({
  nombre,
  tarjeta,
  tarjetas,
  regalia,
  resumen,
  limite,
  pasos,
  enlaces,
  accion,
}: {
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
  /** Cómo va la cuenta contra el tope de clientes de su paquete. */
  limite: EstadoLimite;
  pasos: PasoPrimero[];
  enlaces: EnlacesInicio;
  /** El botón de escanear, si quien mira puede acreditar. */
  accion?: ReactNode;
}) {
  const tipo = tarjeta?.tipo ?? "puntos";
  const definicion = TIPOS_TARJETA[tipo];
  const unidades = UNIDAD_SALDO[tipo];
  const miembros = resumen?.miembros ?? 0;

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

      {/* ── Lo que hay que hacer AHORA ──────────────────────────── */}
      {momento === "sin-publicar" && tarjeta && (
        <PanelAccion
          icono="tarjeta"
          titulo={CONSEJO_TARJETA[tarjeta.estado].titulo}
          detalle={CONSEJO_TARJETA[tarjeta.estado].consejo}
          nota={`«${tarjeta.nombre}» · ${definicion.nombre} · ${ETIQUETA_ESTADO[tarjeta.estado]}`}
          boton={CONSEJO_TARJETA[tarjeta.estado].boton}
          href={enlaces[CONSEJO_TARJETA[tarjeta.estado].ir]}
          sinPermiso="Pedile al dueño del negocio que la publique."
        />
      )}

      {momento === "sin-meta" && (
        <PanelAccion
          icono="regalo"
          titulo="Tu tarjeta todavía no promete nada"
          detalle={`Ya emite pases y la gente la puede agregar, pero sin una recompensa activa el pase muestra el saldo pelado: el cliente junta ${unidades} sin saber para qué.`}
          nota={tarjeta ? `«${tarjeta.nombre}» · ${definicion.nombre}` : null}
          boton="Definir qué se gana"
          href={enlaces.recompensas}
          sinPermiso="Pedile al dueño del negocio que defina la regalía."
        />
      )}

      {momento === "sin-clientes" && (
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
      )}

      {/* ── Los números, recién cuando hay de quién hablar ──────── */}
      {resumen && miembros > 0 && (
        <>
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

          <BarraPlan limite={limite} href={enlaces.plan} />
        </>
      )}

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

      {/* ── Primeros pasos, mientras quede alguno ───────────────── */}
      {pendientes > 0 && <ListaPasos pasos={pasos} />}
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
        style={{ borderColor: NARANJA, background: "rgba(238,116,32,.09)" }}
      >
        <span
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: "rgba(238,116,32,.18)", color: NARANJA }}
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
            className="mt-6 inline-block rounded-2xl px-7 py-4 text-[15px] font-extrabold text-white sm:text-[16px]"
            style={{ background: NARANJA }}
          >
            ¡Iniciá tu primer pase! →
          </Link>
        ) : (
          <p className="mt-6 text-[13px] font-bold text-white/70">
            Pedile al dueño del negocio que cree la primera tarjeta.
          </p>
        )}

        <p className="mx-auto mt-4 max-w-[440px] text-[12px] leading-relaxed text-white/45">
          Se arma en cinco pasos —tipo, diseño, beneficio, reglas y una última mirada— y
          nace en borrador: nada se publica sin que vos lo digas.
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
          Nada es obligatorio para arrancar: todo se puede cambiar después.
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
      style={{ borderColor: NARANJA, background: "rgba(238,116,32,.09)" }}
    >
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          style={{ background: "rgba(238,116,32,.18)", color: NARANJA }}
        >
          <Icono nombre={icono} className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-extrabold leading-tight text-white sm:text-[17px]">
            {titulo}
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{detalle}</p>
          {nota && <p className="mt-2 text-[12px] text-white/45">{nota}</p>}

          {href ? (
            <a
              href={href}
              className="mt-4 inline-block rounded-xl px-5 py-3 text-[13.5px] font-extrabold text-white"
              style={{ background: NARANJA }}
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
 * Cuánto le queda de paquete.
 *
 * Solo sale con tope: en un plan sin límite, una barra que nunca se
 * llena no dice nada. El aviso salta al 80% —lo decide
 * `estadoDelLimite`— porque enterarse cuando ya no entra nadie no deja
 * tiempo de decidir nada.
 */
function BarraPlan({ limite, href }: { limite: EstadoLimite; href: string | null }) {
  if (limite.limite === null) return null;

  const color = limite.lleno ? "#fca5a5" : limite.cerca ? "#ffb076" : NARANJA;

  return (
    <div className="rounded-2xl border border-aventurea-line bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-aventurea-ink-soft">
          Clientes de tu paquete
        </p>
        <p className="text-[12.5px] font-bold tabular-nums text-aventurea-ink">
          {limite.usado.toLocaleString("es-CR")} de {limite.limite.toLocaleString("es-CR")}
        </p>
      </div>

      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, limite.porcentaje)}%`, background: color }}
        />
      </div>

      {/* Nunca solo el color: lo que pasa se dice con palabras. */}
      <p className="mt-2 text-[12.5px] leading-snug text-aventurea-ink-soft">
        {limite.lleno ? (
          <>
            Llegaste al tope: un cliente nuevo ya no se puede afiliar.{" "}
            {href && (
              <a href={href} className="font-bold text-aventurea-ink underline">
                Subí de paquete →
              </a>
            )}
          </>
        ) : limite.cerca ? (
          <>
            Te quedan {limite.disponibles} lugares.{" "}
            {href && (
              <a href={href} className="font-bold text-aventurea-ink underline">
                Ver los paquetes →
              </a>
            )}
          </>
        ) : (
          `Te quedan ${limite.disponibles?.toLocaleString("es-CR")} lugares.`
        )}
      </p>
    </div>
  );
}

/**
 * «Primeros pasos». Cada casilla se marca con una SEÑAL REAL de la
 * base (¿hay recompensa activa?, ¿hay tarjeta publicada?, ¿hay
 * miembros?), nunca con un booleano que alguien tocó: una lista que se
 * auto-completa sin que nada haya pasado es peor que no tenerla.
 *
 * Desaparece cuando están los cuatro. Una lista toda en verde para
 * siempre es decoración, y el tablero necesita ese espacio para los
 * datos.
 */
function ListaPasos({ pasos }: { pasos: PasoPrimero[] }) {
  const listos = pasos.filter((p) => p.listo).length;
  const avance = pasos.length ? Math.round((listos / pasos.length) * 100) : 0;
  // El primero que falta es el que se resalta: una lista con cuatro
  // llamados a la acción a la vez no dice por dónde empezar.
  const siguiente = pasos.findIndex((p) => !p.listo);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
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
          style={{ width: `${avance}%`, background: NARANJA }}
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
                  ? { borderColor: NARANJA, background: "rgba(238,116,32,.07)" }
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
                    borderColor: destacado ? NARANJA : "rgba(255,255,255,.25)",
                    color: destacado ? NARANJA : "rgba(255,255,255,.5)",
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
                      ? "text-white"
                      : "border border-aventurea-line text-aventurea-ink-soft hover:text-aventurea-ink"
                  }`}
                  style={destacado ? { background: NARANJA } : undefined}
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
            style={{ background: "rgba(238,116,32,.15)", color: NARANJA }}
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
