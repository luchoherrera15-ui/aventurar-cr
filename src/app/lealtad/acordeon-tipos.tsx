"use client";

import { useEffect, useRef, useState } from "react";
import { useTieneMouse } from "@/lib/use-movimiento-reducido";
import Link from "next/link";
import { TIPOS_TARJETA_LISTA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";
import { Icono, type NombreIcono } from "@/app/lealtad/panel/[id]/iconos";

/**
 * LOS OCHO TIPOS DE PASE.
 *
 * Escritorio: acordeón horizontal que se abre AL PASAR EL MOUSE.
 * Móvil: carrusel de tarjetas que se deslizan con el dedo.
 *
 * Son dos componentes distintos y no uno responsive, porque el gesto
 * es distinto: en escritorio hay puntero y se explora pasando por
 * encima; en un teléfono no existe el hover y ocho columnas de 90px
 * serían ocho tiras con el texto de canto.
 *
 * ------------------------------------------------------------------
 * LOS OCHO SALEN DEL CATÁLOGO, NO DE UNA LISTA DE ACÁ
 * ------------------------------------------------------------------
 * `TIPOS_TARJETA_LISTA` es el mismo que usa el creador y el generador
 * del pase. Si la landing tuviera su propia lista, prometería tipos
 * que el producto no tiene — que es exactamente lo que pasaba antes
 * con los paquetes inventados.
 */

const NARANJA = "#ee7420";

/** Lo que la landing cuenta de cada tipo. */
const CONTENIDO: Record<TipoTarjeta, { gancho: string; beneficios: string[] }> = {
  sellos: {
    gancho: "El cartón de toda la vida, pero que no se pierde ni se olvida en casa.",
    beneficios: [
      "Se sella solo al escanear, sin apuntar nada",
      "El cliente ve cuánto le falta cada vez que abre el teléfono",
      "Al completarla, arranca otra vuelta sola",
    ],
  },
  puntos: {
    gancho: "Suma por lo que gasta y canjea por lo que quiera.",
    beneficios: [
      "Puntos por visita, por monto, o los dos",
      "El saldo se actualiza en el pase al instante",
      "Vos definís el mínimo para canjear",
    ],
  },
  cupon: {
    gancho: "Un beneficio puntual que llega al teléfono y se usa una vez.",
    beneficios: [
      "Con fecha de vencimiento que el servidor hace cumplir",
      "No se puede usar dos veces ni con una captura de pantalla",
      "Ideal para reactivar al que hace rato no viene",
    ],
  },
  descuento: {
    gancho: "«30% de lunes a jueves», con sus días y horas de verdad.",
    beneficios: [
      "Días y horarios permitidos, en hora de Costa Rica",
      "Compra mínima y tope de descuento",
      "Se apaga solo cuando vence",
    ],
  },
  membresia: {
    gancho: "El carnet de socio que nunca se queda en la otra cartera.",
    beneficios: [
      "Nivel, beneficios y fecha de renovación a la vista",
      "Número de socio propio",
      "Se renueva sola si vos querés",
    ],
  },
  giftcard: {
    gancho: "Plata que entra hoy por un consumo que llega después.",
    beneficios: [
      "Se gasta de a poco: el saldo baja con cada uso",
      "Quien la compra se la puede regalar a otra persona",
      "En colones o en dólares",
    ],
  },
  evento: {
    gancho: "La entrada con fecha, lugar y control en la puerta.",
    beneficios: [
      "Aparece sola en la pantalla el día del evento",
      "Cupo por aforo, sin sobreventa",
      "Se valida escaneando, no en una lista impresa",
    ],
  },
  cashback: {
    gancho: "Devolvés un porcentaje y vuelve a gastarse con vos.",
    beneficios: [
      "El saldo se acumula y se descuenta en la próxima visita",
      "Compra mínima y tope por compra",
      "La plata se queda en tu negocio, no en un descuento perdido",
    ],
  },
};

export default function AcordeonTipos() {
  return (
    <>
      <AcordeonEscritorio />
      <CarruselMovil />
    </>
  );
}

// ── Escritorio ─────────────────────────────────────────────────────

/**
 * Se abre al pasar el mouse, con un respiro de 90 ms.
 *
 * Sin ese retraso, cruzar el acordeón de un lado al otro abre y cierra
 * las ocho columnas a su paso — un parpadeo que marea y que además
 * dispara ocho transiciones de ancho encimadas. Con el retraso, pasar
 * de largo no abre nada; detenerse, sí.
 */
function AcordeonEscritorio() {
  const [abierto, setAbierto] = useState<TipoTarjeta>("sellos");
  // Sin hover no hay apertura automática: en táctil manda el toque.
  const conMouse = useTieneMouse();
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const temporizador = useRef<number | null>(null);

  // Al desmontar hay que matar el temporizador pendiente: si no, un
  // `setState` llega a un componente que ya no existe.
  useEffect(() => {
    return () => {
      if (temporizador.current) window.clearTimeout(temporizador.current);
    };
  }, []);

  function alEntrar(id: TipoTarjeta) {
    if (!conMouse) return;
    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => setAbierto(id), 90);
  }

  function alSalir() {
    // Cancela la apertura pendiente, pero NO cierra lo abierto: dejar
    // el acordeón vacío al sacar el mouse deja la sección en blanco.
    if (temporizador.current) window.clearTimeout(temporizador.current);
  }

  const indice = TIPOS_TARJETA_LISTA.findIndex((t) => t.id === abierto);

  function alTeclado(e: React.KeyboardEvent) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const i = (indice + delta + TIPOS_TARJETA_LISTA.length) % TIPOS_TARJETA_LISTA.length;
    setAbierto(TIPOS_TARJETA_LISTA[i].id);
    botones.current[i]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Tipos de pase"
      aria-orientation="horizontal"
      onKeyDown={alTeclado}
      onMouseLeave={alSalir}
      className="hidden gap-2 lg:flex"
    >
      {TIPOS_TARJETA_LISTA.map((tipo, i) => {
        const esta = tipo.id === abierto;
        const info = CONTENIDO[tipo.id];
        return (
          <div
            key={tipo.id}
            onMouseEnter={() => alEntrar(tipo.id)}
            className="acordeon-col min-w-0 overflow-hidden rounded-3xl border"
            style={{
              flex: esta ? "1 1 0%" : "0 0 92px",
              background: esta ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.025)",
              borderColor: esta ? "rgba(238,116,32,.45)" : "rgba(255,255,255,.09)",
            }}
          >
            <button
              ref={(el) => {
                botones.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={esta}
              tabIndex={esta ? 0 : -1}
              // El clic sigue funcionando: teclado, lectores de
              // pantalla y quien prefiera hacer clic no dependen del
              // hover para nada.
              onClick={() => setAbierto(tipo.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl transition-colors duration-200"
                style={{
                  background: esta ? NARANJA : "rgba(255,255,255,.08)",
                  color: esta ? "#0a1226" : "rgba(255,255,255,.75)",
                }}
              >
                <Icono nombre={tipo.icono as NombreIcono} className="h-5 w-5" />
              </span>
              {esta && (
                <span className="min-w-0 truncate text-[17px] font-extrabold text-white">
                  {tipo.nombre}
                </span>
              )}
            </button>

            {esta && (
              <div role="tabpanel" className="px-4 pb-5">
                <p className="text-[14px] leading-relaxed text-white/70">{info.gancho}</p>

                <div className="mt-5 flex flex-wrap items-start gap-6">
                  <TelefonoDelPase tipo={tipo.id} />

                  <ul className="min-w-[220px] flex-1 space-y-2.5">
                    {info.beneficios.map((b) => (
                      <li key={b} className="flex gap-2.5 text-[13.5px] leading-snug text-white/75">
                        <span className="mt-0.5 shrink-0" style={{ color: NARANJA }}>
                          <Icono nombre="listo" className="h-4 w-4" />
                        </span>
                        {b}
                      </li>
                    ))}
                    <li className="pt-2">
                      <Link
                        href="/lealtad/nuevo"
                        className="presionable inline-block rounded-full px-5 py-2.5 text-[13.5px] font-extrabold"
                        style={{ background: NARANJA, color: "#0a1226" }}
                      >
                        Armar mi {tipo.nombre.toLowerCase()} →
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Móvil ──────────────────────────────────────────────────────────

/**
 * Carrusel que se desliza con el dedo, sin acordeón.
 *
 * Cada tarjeta se ve ENTERA: no hay nada que abrir. En un teléfono,
 * tocar para desplegar y volver a tocar para cerrar es un paso de más
 * cuando deslizar ya muestra lo mismo.
 *
 * El encuadre lo hace `scroll-snap` del navegador, no JavaScript: se
 * siente nativo, respeta la inercia del sistema y no se pelea con el
 * gesto de volver atrás.
 *
 * `-mx-5 px-5` deja que las tarjetas lleguen al borde de la pantalla
 * sin que el scroll horizontal se le escape a la PÁGINA — el que
 * desborda es este contenedor, no el body.
 */
function CarruselMovil() {
  const pista = useRef<HTMLDivElement | null>(null);
  const [activa, setActiva] = useState(0);

  function alDeslizar() {
    const el = pista.current;
    if (!el) return;
    const ancho = el.scrollWidth / TIPOS_TARJETA_LISTA.length;
    setActiva(Math.round(el.scrollLeft / ancho));
  }

  function irA(i: number) {
    const el = pista.current;
    if (!el) return;
    el.scrollTo({ left: (el.scrollWidth / TIPOS_TARJETA_LISTA.length) * i, behavior: "smooth" });
  }

  return (
    <div className="lg:hidden">
      <div
        ref={pista}
        onScroll={alDeslizar}
        className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TIPOS_TARJETA_LISTA.map((tipo) => {
          const info = CONTENIDO[tipo.id];
          return (
            <article
              key={tipo.id}
              className="w-[84vw] max-w-[330px] shrink-0 snap-center rounded-3xl border border-white/12 p-5"
              style={{ background: "rgba(255,255,255,.04)" }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
                  style={{ background: NARANJA, color: "#0a1226" }}
                >
                  <Icono nombre={tipo.icono as NombreIcono} className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[17px] font-extrabold text-white">
                    {tipo.nombre}
                  </span>
                </span>
              </div>

              <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">{info.gancho}</p>

              <div className="mt-4 flex justify-center">
                <TelefonoDelPase tipo={tipo.id} />
              </div>

              <ul className="mt-4 space-y-2">
                {info.beneficios.map((b) => (
                  <li key={b} className="flex gap-2 text-[13px] leading-snug text-white/75">
                    <span className="mt-0.5 shrink-0" style={{ color: NARANJA }}>
                      <Icono nombre="listo" className="h-4 w-4" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href="/lealtad/nuevo"
                className="presionable mt-5 block rounded-full px-5 py-3 text-center text-[13.5px] font-extrabold"
                style={{ background: NARANJA, color: "#0a1226" }}
              >
                Armar mi {tipo.nombre.toLowerCase()} →
              </Link>
            </article>
          );
        })}
      </div>

      {/* Los puntos: dicen cuántas hay y en cuál vas. Sin esto, nadie
          sabe que a la derecha hay siete más. */}
      <div className="mt-4 flex justify-center gap-1.5">
        {TIPOS_TARJETA_LISTA.map((tipo, i) => (
          <button
            key={tipo.id}
            type="button"
            onClick={() => irA(i)}
            aria-label={`Ver ${tipo.nombre}`}
            aria-current={i === activa}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: i === activa ? 22 : 8,
              background: i === activa ? NARANJA : "rgba(255,255,255,.22)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * El teléfono con el pase de ese tipo.
 *
 * Es una maqueta de la landing, no el pase real: los datos son de un
 * negocio de ejemplo. Por eso NO reusa `camposSegunModo` —esa función
 * describe un pase de verdad, con el saldo de un cliente de verdad— y
 * meterle «Café La Esquina» sería llenar de datos inventados la
 * función que arma lo que se firma y se manda al teléfono.
 */
function TelefonoDelPase({ tipo }: { tipo: TipoTarjeta }) {
  const ejemplos: Record<TipoTarjeta, { arriba: string; valor: string; abajo: string }> = {
    sellos: { arriba: "SELLOS", valor: "7/10", abajo: "Te faltan 3 para tu café" },
    puntos: { arriba: "PUNTOS", valor: "340", abajo: "Canjeá desde 200" },
    cupon: { arriba: "CUPÓN", valor: "2x1", abajo: "Válido hasta el 30" },
    descuento: { arriba: "DESCUENTO", valor: "30% OFF", abajo: "Lunes a jueves" },
    membresia: { arriba: "MEMBRESÍA", valor: "Gold", abajo: "Renueva en marzo" },
    giftcard: { arriba: "SALDO", valor: "₡15 000", abajo: "Gift card de regalo" },
    evento: { arriba: "ENTRADA", valor: "20 set · 7 pm", abajo: "Rancho Las Torres" },
    cashback: { arriba: "SALDO", valor: "₡3 400", abajo: "5% de vuelta en cada compra" },
  };
  const e = ejemplos[tipo];

  return (
    <div
      className="w-[186px] shrink-0 overflow-hidden rounded-[26px] border-4 border-black/60 shadow-2xl"
      style={{ background: "#12203f" }}
      aria-hidden
    >
      <div className="px-3.5 pb-3 pt-4">
        <p className="text-[10px] font-medium text-white/70">Café La Esquina</p>
        <p className="mt-3 text-[8.5px] uppercase tracking-widest text-white/50">{e.arriba}</p>
        <p className="text-[22px] font-extrabold leading-none text-white">{e.valor}</p>
        <p className="mt-2 text-[9.5px] leading-snug text-white/60">{e.abajo}</p>

        {tipo === "sellos" && (
          <div className="mt-3 flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className="h-3.5 w-3.5 rounded-full"
                style={{ background: NARANJA, opacity: i < 7 ? 1 : 0.22 }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="bg-white px-3.5 py-2.5">
        <div className="mx-auto h-11 w-11 rounded bg-[#0a1226]" />
        <p className="mt-1 text-center text-[6.5px] text-[#53657f]">Powered by Bookea.lat</p>
      </div>
    </div>
  );
}
