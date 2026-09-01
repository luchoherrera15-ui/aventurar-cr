import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * «CÓMO TRABAJAMOS» — los cinco pasos, del primer mensaje al cliente
 * que vuelve.
 *
 * Pedido del dueño (31 ago 2026) con una referencia a la vista, y con
 * un encargo explícito: «que te esfuerces haciendo mejores mockups,
 * que hagas cosas de calidad y con buen diseño».
 *
 * ------------------------------------------------------------------
 * LA LÍNEA DE TIEMPO
 * ------------------------------------------------------------------
 * Los cinco discos y la línea que los une viven SOLO en `lg`. Por
 * debajo, cinco tarjetas apiladas ya se leen como una secuencia por su
 * propio orden y su número: dibujar una línea vertical al costado
 * sumaría un elemento que hay que mantener alineado a cinco alturas
 * distintas sin agregar información.
 *
 * El disco del paso lleva su ícono; el número grande vive en la
 * tarjeta. Repetir el número arriba y abajo era la primera versión y
 * se leía como dos listas superpuestas.
 *
 * ------------------------------------------------------------------
 * LAS MAQUETAS — NI HEX SUELTOS NI DATOS INVENTADOS
 * ------------------------------------------------------------------
 * Todo color sale de los tokens de `.lealtad` (`--accion`, `--navy`,
 * `--line`…). Un hex escrito acá rompería el scope: el mismo componente
 * dentro de otra sección del sitio dejaría de adaptarse.
 *
 * Y ninguna maqueta muestra una cifra que el producto no calcule: son
 * formas —una burbuja, un selector de color, un control, una fila de
 * personas— y no capturas con números de fantasía.
 */

/* ── 01 · El primer mensaje ─────────────────────────────────────────
   Una conversación, no un formulario: el primer contacto real es por
   WhatsApp, y la burbuja lo dice sin una palabra de explicación. */
function MaquetaContacto() {
  return (
    <div className="w-full max-w-[190px] space-y-2">
      <div
        className="ml-auto w-[78%] rounded-[14px] rounded-br-[4px] px-3 py-2"
        style={{ background: "var(--accion)" }}
      >
        <span className="block text-[9px] font-bold leading-snug text-white">
          Hola, tengo una cafetería y quiero fidelizar clientes.
        </span>
      </div>
      <div
        className="w-[86%] rounded-[14px] rounded-bl-[4px] border px-3 py-2"
        style={{ background: "var(--hoja)", borderColor: "var(--line)" }}
      >
        <span className="block text-[9px] font-bold leading-snug text-aventurea-ink">
          ¡Perfecto! Te armamos el programa. ¿Cuántas visitas para el premio?
        </span>
      </div>
      <div className="flex items-center gap-1.5 pl-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accion-claro)" }}
          />
        ))}
        <span className="text-[8px] font-bold text-aventurea-ink-soft">escribiendo…</span>
      </div>
    </div>
  );
}

/* ── 02 · Los dos caminos ───────────────────────────────────────────
   Este paso es una BIFURCACIÓN, no una acción: o lo armás vos en
   minutos, o lo armamos nosotros. Las dos opciones van una al lado de
   la otra, del mismo tamaño, porque ninguna es «la buena». */
function MaquetaCaminos() {
  const opciones = [
    { icono: "tarjeta", titulo: "Lo armo yo", detalle: "En minutos" },
    { icono: "personas", titulo: "Me acompañan", detalle: "Con un asesor" },
  ] as const;
  return (
    <div className="flex w-full max-w-[200px] gap-2">
      {opciones.map((o, i) => (
        <div
          key={o.titulo}
          className="flex-1 rounded-[12px] border px-2 py-2.5 text-center"
          style={{
            background: i === 0 ? "var(--accion-suave)" : "var(--hoja)",
            borderColor: i === 0 ? "var(--accion)" : "var(--line)",
          }}
        >
          <span
            className="mx-auto grid h-7 w-7 place-items-center rounded-[8px]"
            style={{
              background: i === 0 ? "var(--accion)" : "var(--navy-suave)",
              color: i === 0 ? "var(--accion-tinta)" : "var(--navy)",
            }}
          >
            <Icono nombre={o.icono as NombreIcono} className="h-3.5 w-3.5" />
          </span>
          <span className="mt-1.5 block text-[9px] font-extrabold text-aventurea-ink">
            {o.titulo}
          </span>
          <span className="block text-[8px] text-aventurea-ink-soft">{o.detalle}</span>
        </div>
      ))}
    </div>
  );
}

/* ── 03 · El diseño de la tarjeta ───────────────────────────────────
   La misma pieza que la persona va a ver en el editor: el pase a la
   izquierda y los colores a la derecha, con uno marcado. */
function MaquetaDiseno() {
  return (
    <div className="flex w-full max-w-[200px] items-center gap-2.5">
      <div
        className="h-[62px] flex-1 rounded-[10px] p-2"
        style={{ background: "var(--navy)" }}
      >
        <span className="block h-1.5 w-10 rounded-full" style={{ background: "var(--accion-claro)" }} />
        <span className="mt-2 block text-[11px] font-extrabold leading-none text-white">7/10</span>
        <span className="mt-2 flex gap-[3px]">
          {Array.from({ length: 7 }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: i < 5 ? "var(--orange)" : "var(--accion-claro)" }}
            />
          ))}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {["var(--navy)", "var(--accion)", "var(--orange)"].map((c, i) => (
          <span
            key={c}
            aria-hidden
            className="grid h-5 w-5 place-items-center rounded-full"
            style={{ background: c, outline: i === 0 ? "2px solid var(--accion)" : "none", outlineOffset: 2 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── 04 · Los parámetros ────────────────────────────────────────────
   Controles de verdad —la meta, el sello de regalo, el vencimiento—,
   que es lo que de verdad se ajusta en esta etapa. */
function MaquetaParametros() {
  const filas = [
    { etiqueta: "Meta de sellos", valor: "10" },
    { etiqueta: "Sello de regalo", valor: "1" },
  ];
  return (
    <div
      className="w-full max-w-[200px] overflow-hidden rounded-[12px] border"
      style={{ background: "var(--hoja)", borderColor: "var(--line)" }}
    >
      {filas.map((f) => (
        <div
          key={f.etiqueta}
          className="flex items-center justify-between border-b px-2.5 py-2"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="text-[8.5px] font-bold text-aventurea-ink-soft">{f.etiqueta}</span>
          <span
            className="rounded-[6px] px-1.5 py-0.5 text-[9px] font-extrabold"
            style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
          >
            {f.valor}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between px-2.5 py-2">
        <span className="text-[8.5px] font-bold text-aventurea-ink-soft">Se puede repetir</span>
        {/* El interruptor encendido: el estado se lee por la posición
            del disco, no solo por el color. */}
        <span
          aria-hidden
          className="flex h-3.5 w-6 items-center justify-end rounded-full px-[2px]"
          style={{ background: "var(--accion)" }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}

/* ── 05 · El acompañamiento ─────────────────────────────────────────
   El equipo del negocio ya capacitado, y el canal abierto abajo: lo
   que este paso promete es que después del lanzamiento seguimos. */
function MaquetaAcompanamiento() {
  return (
    <div className="w-full max-w-[200px]">
      <div className="flex items-end justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex flex-col items-center gap-1">
            <span
              aria-hidden
              className="rounded-full"
              style={{
                width: i === 1 ? 22 : 18,
                height: i === 1 ? 22 : 18,
                background: i === 1 ? "var(--accion)" : "var(--navy-suave)",
              }}
            />
            <span
              aria-hidden
              className="rounded-t-full"
              style={{
                width: i === 1 ? 30 : 24,
                height: i === 1 ? 16 : 13,
                background: i === 1 ? "var(--accion)" : "var(--navy-suave)",
              }}
            />
          </span>
        ))}
      </div>
      <div
        className="mt-2.5 flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5"
        style={{ background: "var(--hoja)", borderColor: "var(--line)" }}
      >
        <span
          className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          <Icono nombre="listo" className="h-2.5 w-2.5" />
        </span>
        <span className="text-[8.5px] font-bold text-aventurea-ink">Equipo capacitado</span>
      </div>
    </div>
  );
}

const PASOS: {
  icono: NombreIcono;
  titulo: string;
  texto: string;
  maqueta: React.ReactNode;
}[] = [
  {
    icono: "campana",
    titulo: "Nos contactás",
    texto:
      "Nos escribís por WhatsApp o dejás tu correo. Escuchamos cómo funciona tu negocio y cada cuánto vuelve tu cliente.",
    maqueta: <MaquetaContacto />,
  },
  {
    icono: "afiliar",
    titulo: "Lo armás vos o te acompañamos",
    texto:
      "Podés registrarte y crear tu tarjeta en minutos, o te acompañamos en todo el proceso. Las dos puertas llevan al mismo lugar.",
    maqueta: <MaquetaCaminos />,
  },
  {
    icono: "tarjeta",
    titulo: "Diseñamos tu tarjeta con vos",
    texto:
      "El color, el logo y qué se gana los definimos juntos, hasta que el pase se vea como tu marca y no como una plantilla.",
    maqueta: <MaquetaDiseno />,
  },
  {
    icono: "configuracion",
    titulo: "Ajustamos la plataforma",
    texto:
      "La meta de sellos, los sellos de regalo, los vencimientos y las reglas quedan afinados según cómo se compra en tu local.",
    maqueta: <MaquetaParametros />,
  },
  {
    icono: "personas",
    titulo: "Capacitamos y seguimos con vos",
    texto:
      "Le enseñamos a tu equipo a sellar y canjear en el mostrador, y quedamos disponibles para lo que venga después.",
    maqueta: <MaquetaAcompanamiento />,
  },
];

export default function SeccionComoTrabajamos() {
  return (
    <section id="como-trabajamos" className="scroll-mt-28 px-5 pb-20 pt-6 sm:px-8 sm:pb-24 sm:pt-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <p className="text-center text-[11.5px] font-extrabold uppercase tracking-[0.18em] text-aventurea-navy">
          Cómo trabajamos
        </p>
        <h2 className="titulo mx-auto mt-3 max-w-[22ch] text-center text-[34px] leading-[1.08] text-aventurea-ink sm:text-[44px]">
          Del primer mensaje a clientes que vuelven, en{" "}
          <span className="text-aventurea-navy">cinco pasos</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-[60ch] text-center text-[15px] leading-relaxed text-aventurea-ink-soft sm:text-[16.5px]">
          Nos encargamos de la estrategia, el diseño y la configuración. Vos te encargás de
          atender a los clientes que vuelven.
        </p>

        {/* ── La línea de tiempo, solo en escritorio ─────────────────
            Los discos se reparten en cinco columnas iguales, las mismas
            de la grilla de abajo, así que cada uno cae sobre su
            tarjeta. La línea va DETRÁS y se corta a la mitad del primer
            y del último disco (`inset-x`), para que no asome por los
            costados como una barra suelta. */}
        <div aria-hidden className="grupo-proceso relative mt-14 hidden lg:block">
          {/* La línea es el carril y el destello viaja adentro: el
              `overflow-hidden` es lo que hace que aparezca y
              desaparezca en los extremos en vez de asomar por fuera.
              2 px y no 1: a un píxel el destello no se distingue del
              propio color de la línea. */}
          <span
            className="absolute left-[10%] right-[10%] top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full"
            style={{ background: "var(--line)" }}
          >
            <span
              className="anim-flujo-proceso absolute inset-y-0 left-0 w-[24%]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accion) 45%, var(--accion) 55%, transparent)",
              }}
            />
          </span>
          <div className="relative grid grid-cols-5">
            {PASOS.map((p, i) => (
              <span key={p.titulo} className="flex justify-center">
                <span
                  className="grid h-12 w-12 place-items-center rounded-full border"
                  style={{
                    background: i === 0 ? "var(--accion)" : "var(--hoja)",
                    borderColor: i === 0 ? "var(--accion)" : "var(--line)",
                    color: i === 0 ? "var(--accion-tinta)" : "var(--navy)",
                  }}
                >
                  <Icono nombre={p.icono} className="h-5 w-5" />
                </span>
              </span>
            ))}
          </div>
        </div>

        <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {PASOS.map((p, i) => (
            <li key={p.titulo}>
              <article className="elevar flex h-full flex-col rounded-[18px] border border-aventurea-line bg-white p-5">
                <span className="text-[13px] font-extrabold tabular-nums text-aventurea-navy">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1.5 text-[16.5px] font-extrabold leading-snug text-aventurea-ink">
                  {p.titulo}
                </h3>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-aventurea-ink-soft">
                  {p.texto}
                </p>
                {/* La maqueta, sobre el mismo tinte que usa el resto de
                    la landing para separar un ejemplo del texto. */}
                <div
                  className="mt-5 flex min-h-[118px] items-center justify-center rounded-[14px] px-3 py-4"
                  style={{ background: "var(--accion-suave)" }}
                >
                  {p.maqueta}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
