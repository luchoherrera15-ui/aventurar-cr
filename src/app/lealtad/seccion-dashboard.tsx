import { Icono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * EL PANEL DEL NEGOCIO, como maqueta: qué se ve cuando el programa
 * está andando.
 *
 * La sección anterior muestra lo que recibe el CLIENTE (el pase). Esta
 * muestra lo que ve el DUEÑO — que es lo que de verdad decide la
 * compra: dónde mira la plata.
 *
 * ------------------------------------------------------------------
 * LOS NÚMEROS SON DE UN NEGOCIO DE EJEMPLO Y SE DICE
 * ------------------------------------------------------------------
 * Es una maqueta, y al pie lo aclara. La tentación es poner cifras que
 * impresionen y dejarlas ambiguas para que parezcan un promedio real;
 * eso es una promesa encubierta que después alguien reclama.
 *
 * Los que están son coherentes entre sí a propósito: 128 clientes con
 * ticket de ₡7 200 dan los ₡921 600 del mes, y los 34 canjes salen del
 * 26% de canje. Un dueño que saque la cuenta encuentra que cierra.
 */

const NARANJA = "#ee7420";

/** Las barras del mes. Suben, pero como sube un negocio real: con
 *  dientes, no en una diagonal perfecta de presentación. */
const BARRAS = [38, 52, 45, 61, 58, 74, 69, 88, 82, 96, 91, 100];
const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const ACTIVIDAD: { nombre: string; que: string; hace: string; tipo: "sello" | "canje" }[] = [
  { nombre: "Diego Ramírez", que: "sumó su sello 8 de 10", hace: "hace 2 min", tipo: "sello" },
  { nombre: "Laura Vargas", que: "canjeó su café gratis", hace: "hace 11 min", tipo: "canje" },
  { nombre: "Josué Campos", que: "sumó su sello 3 de 10", hace: "hace 24 min", tipo: "sello" },
  { nombre: "Marcela Soto", que: "se afilió al programa", hace: "hace 38 min", tipo: "sello" },
];

export default function SeccionDashboard() {
  return (
    <section className="px-5 py-24 sm:px-8">
      {/* `w-full max-w-…` y no `min(…,92vw)`: la sección ya deja su
          margen con `px-5`, y un ancho en `vw` lo ignora. Ver el
          comentario largo en page.tsx. */}
      <div className="mx-auto w-full max-w-[1120px]">
        <div data-reveal className="mx-auto max-w-[54ch] text-center">
          <p
            className="text-[12px] font-bold uppercase tracking-[0.22em]"
            style={{ color: NARANJA }}
          >
            Tu panel
          </p>
          <h2 className="titulo mx-auto mt-4 max-w-[20ch] text-[clamp(28px,4.6vw,50px)] leading-[1.08]">
            Vas a saber exactamente qué está pasando
          </h2>
          <p className="mx-auto mt-4 text-[clamp(15px,1.8vw,18px)] leading-relaxed text-white/55">
            Cada sello, cada canje y cada cliente que vuelve queda registrado. No hay que
            anotar nada a mano ni adivinar si el programa está sirviendo.
          </p>
        </div>

        {/* ── La maqueta del panel ──────────────────────────────── */}
        <div
          data-reveal
          className="organico mt-14 rounded-[32px] border border-white/10 p-4 sm:p-6"
          style={
            {
              background: "#0d1730",
              "--c1": "rgba(238,116,32,.30)",
              "--c2": "rgba(47,124,190,.28)",
              "--c3": "rgba(31,122,77,.22)",
            } as React.CSSProperties
          }
        >
          <div className="rounded-3xl border border-white/10 bg-[#0a1226]/80 p-5 backdrop-blur sm:p-7">
            {/* Barra del panel */}
            <div className="flex items-center gap-2.5 border-b border-white/8 pb-4">
              <span
                className="grid h-8 w-8 place-items-center rounded-xl text-[12px] font-extrabold"
                style={{ background: NARANJA, color: "#0a1226" }}
              >
                CE
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-extrabold text-white">
                  Café La Esquina
                </span>
                <span className="block text-[11px] text-white/45">Programa de lealtad</span>
              </span>
              <span className="ml-auto hidden gap-1.5 sm:flex">
                {["Inicio", "Clientes", "Tarjetas"].map((t, i) => (
                  <span
                    key={t}
                    className="rounded-full px-3 py-1.5 text-[11.5px] font-bold"
                    style={{
                      background: i === 0 ? "rgba(255,255,255,.1)" : "transparent",
                      color: i === 0 ? "#fff" : "rgba(255,255,255,.45)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </span>
            </div>

            {/* Los cuatro números */}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Dato icono="clientes" etiqueta="Clientes activos" valor="128" pie="+19 este mes" />
              <Dato icono="sellos" etiqueta="Sellos del mes" valor="412" pie="3,2 por cliente" />
              <Dato icono="regalo" etiqueta="Canjes" valor="34" pie="26% de canje" />
              <Dato
                icono="plan"
                etiqueta="Ventas del mes"
                valor="₡921 600"
                pie="ticket ₡7 200"
                destacado
              />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              {/* El gráfico */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-extrabold text-white">
                    Visitas de clientes con tarjeta
                  </p>
                  <p className="text-[11.5px] text-white/40">últimos 12 meses</p>
                </div>

                <div className="mt-5 flex h-[132px] items-end gap-[3px] sm:gap-1.5">
                  {BARRAS.map((v, i) => (
                    <span key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <span
                        className="w-full rounded-t-[3px]"
                        style={{
                          height: `${v}%`,
                          // Los últimos cuatro en naranja: es donde se
                          // nota el efecto del programa, y el color lo
                          // señala sin necesidad de una flecha ni un
                          // «+40%» que nadie puede respaldar.
                          background:
                            i >= BARRAS.length - 4
                              ? NARANJA
                              : "rgba(255,255,255,.16)",
                        }}
                      />
                      <span className="text-[8.5px] text-white/30">{MESES[i]}</span>
                    </span>
                  ))}
                </div>

                <p className="mt-4 flex items-center gap-2 text-[11.5px] text-white/45">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: NARANJA }}
                  />
                  Desde que arrancó el programa
                </p>
              </div>

              {/* La actividad en vivo */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2">
                  {/* El punto que late: lo único que se mueve en toda la
                      maqueta. Basta para que se lea «esto está vivo»
                      sin animar números, que se sentiría falso. */}
                  <span className="relative flex h-2 w-2">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                      style={{ background: NARANJA }}
                    />
                    <span
                      className="relative inline-flex h-2 w-2 rounded-full"
                      style={{ background: NARANJA }}
                    />
                  </span>
                  <p className="text-[13px] font-extrabold text-white">En este momento</p>
                </div>

                <ul className="mt-4 space-y-3.5">
                  {ACTIVIDAD.map((a) => (
                    <li key={a.nombre} className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
                        style={{
                          background:
                            a.tipo === "canje" ? "rgba(238,116,32,.16)" : "rgba(255,255,255,.07)",
                          color: a.tipo === "canje" ? NARANJA : "rgba(255,255,255,.6)",
                        }}
                      >
                        <Icono
                          nombre={a.tipo === "canje" ? "regalo" : "sellos"}
                          className="h-3.5 w-3.5"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-bold leading-snug text-white">
                          {a.nombre}
                        </span>
                        <span className="block text-[11.5px] leading-snug text-white/50">
                          {a.que} · {a.hace}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-white/35">
            Panel de ejemplo con datos de un negocio ficticio. El tuyo muestra los tuyos.
          </p>
        </div>
      </div>
    </section>
  );
}

function Dato({
  icono,
  etiqueta,
  valor,
  pie,
  destacado,
}: {
  icono: Parameters<typeof Icono>[0]["nombre"];
  etiqueta: string;
  valor: string;
  pie: string;
  destacado?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: destacado ? "rgba(238,116,32,.10)" : "rgba(255,255,255,.03)",
        borderColor: destacado ? "rgba(238,116,32,.35)" : "rgba(255,255,255,.09)",
      }}
    >
      <span
        className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide"
        style={{ color: destacado ? "#ffb076" : "rgba(255,255,255,.45)" }}
      >
        <Icono nombre={icono} className="h-3.5 w-3.5" />
        {etiqueta}
      </span>
      <p className="mt-1.5 text-[clamp(20px,2.4vw,26px)] font-extrabold leading-none text-white">
        {valor}
      </p>
      <p className="mt-1 text-[11px] text-white/40">{pie}</p>
    </div>
  );
}
