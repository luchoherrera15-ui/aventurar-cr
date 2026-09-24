"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconUsers, IconWhatsapp } from "@/components/icons";
import { useMovimientoReducido } from "@/lib/use-movimiento-reducido";

/**
 * «PROBALO»: el producto entero en tres pasos, y el tercero reacciona al
 * segundo.
 *
 * La landing anterior lo CONTABA («tus invitados confirman y la lista
 * se te arma sola»). Esto lo hace pasar: quien mira escribe su nombre en
 * el formulario del invitado, toca «Sí, voy», y su fila aparece arriba
 * de todo en el panel del anfitrión con los contadores moviéndose. Es
 * la relación causa→efecto que vende el producto, y no se entiende
 * igual leyéndola.
 *
 * Todo es local: no escribe en la base ni manda nada. Los invitados que
 * van llegando solos son de mentira (nombres de ejemplo, los mismos de
 * /invitaciones/ejemplo/confirmaciones) y llegan de a uno mientras el
 * bloque está a la vista, para que el panel se sienta vivo aunque nadie
 * toque nada. Con movimiento reducido llegan todos de una.
 */

type Confirmacion = {
  id: string;
  nombre: string;
  acompanantes: number;
  asistira: boolean;
  detalle: string;
  /** La fila de quien está mirando la landing. */
  propia?: boolean;
};

/** Los invitados que llegan solos, en este orden. */
const INVITADOS_DE_EJEMPLO: Omit<Confirmacion, "id">[] = [
  { nombre: "Daniela Chaves", acompanantes: 1, asistira: true, detalle: "Vegetariano" },
  { nombre: "Jose Pablo Herrera", acompanantes: 2, asistira: true, detalle: "Pollo · Sin alergias" },
  { nombre: "Andrés Mora", acompanantes: 0, asistira: false, detalle: "Ese finde estoy fuera del país." },
  { nombre: "Marcela Vindas", acompanantes: 0, asistira: true, detalle: "Pollo" },
  { nombre: "Carlos Jiménez", acompanantes: 3, asistira: true, detalle: "Pollo · Mesa de niños" },
];

const MENUS = ["Pollo", "Vegetariano", "Menú de niños"] as const;
/** Cada cuánto llega un invitado de ejemplo. */
const CADENCIA_MS = 3200;
/** El link que se copia en el paso 1: la demo estrella, de verdad. */
const LINK_EJEMPLO = "https://bookea.lat/i/demo-boda-premium";

export default function DemoConfirmaciones({ claseSerif }: { claseSerif: string }) {
  const reducido = useMovimientoReducido();
  const bloqueRef = useRef<HTMLDivElement>(null);

  // ── Paso 1: el link ───────────────────────────────────────────────
  const [copiado, setCopiado] = useState(false);
  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(LINK_EJEMPLO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sin permiso de portapapeles (iframe, http): el link igual está
      // escrito en pantalla para copiarlo a mano.
    }
  }

  // ── Paso 2: el invitado ───────────────────────────────────────────
  const [nombre, setNombre] = useState("");
  const [acompanantes, setAcompanantes] = useState(0);
  const [menu, setMenu] = useState<(typeof MENUS)[number]>("Pollo");
  const [enviada, setEnviada] = useState<Confirmacion | null>(null);
  const [avisoNombre, setAvisoNombre] = useState(false);

  // ── Paso 3: el panel ──────────────────────────────────────────────
  const [lista, setLista] = useState<Confirmacion[]>([]);
  const [visible, setVisible] = useState(false);
  const llegados = useRef(0);

  // Los invitados de ejemplo empiezan a llegar cuando el bloque asoma.
  useEffect(() => {
    const el = bloqueRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (reducido) {
      // Sin animar la llegada: la lista completa, de una.
      setLista((l) => [
        ...l,
        ...INVITADOS_DE_EJEMPLO.slice(llegados.current).map((g, i) => ({ ...g, id: `ej-${llegados.current + i}` })),
      ]);
      llegados.current = INVITADOS_DE_EJEMPLO.length;
      return;
    }
    if (llegados.current >= INVITADOS_DE_EJEMPLO.length) return;
    const t = setTimeout(() => {
      const g = INVITADOS_DE_EJEMPLO[llegados.current];
      const id = `ej-${llegados.current}`;
      llegados.current += 1;
      setLista((l) => [{ ...g, id }, ...l]);
    }, llegados.current === 0 ? 900 : CADENCIA_MS);
    return () => clearTimeout(t);
    // `lista.length` en las deps: cada llegada programa la siguiente.
  }, [visible, reducido, lista.length]);

  function confirmar(asistira: boolean) {
    const limpio = nombre.trim();
    if (!limpio) {
      setAvisoNombre(true);
      return;
    }
    setAvisoNombre(false);
    const fila: Confirmacion = {
      id: `propia-${Date.now()}`,
      nombre: limpio,
      acompanantes: asistira ? acompanantes : 0,
      asistira,
      detalle: asistira ? menu : "No puede ir",
      propia: true,
    };
    setEnviada(fila);
    setLista((l) => [fila, ...l.filter((x) => !x.propia)]);
  }

  function otraVez() {
    setEnviada(null);
    setNombre("");
    setAcompanantes(0);
    setMenu("Pollo");
  }

  const confirmados = lista.filter((c) => c.asistira);
  const personas = confirmados.reduce((s, c) => s + 1 + c.acompanantes, 0);
  const noPueden = lista.length - confirmados.length;

  return (
    <div ref={bloqueRef} className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
      {/* ═══════════ 1 · El link ═══════════ */}
      <Paso numero={1} titulo="Mandás el link" texto="Por WhatsApp, por Instagram o impreso en un QR. Un solo link para todos.">
        <div className="rounded-[18px] bg-[var(--inv-papel)] p-4 text-[var(--inv-papel-tinta)]">
          {/* La burbuja saliente, como en el chat. */}
          <div className="ml-6 rounded-[14px] rounded-br-[4px] bg-[var(--inv-papel-2)] p-3">
            <p className="text-[13.5px] leading-snug">
              Familia, esta es nuestra invitación. Ahí mismo confirman quiénes van.
            </p>
            <div className="mt-2.5 overflow-hidden rounded-[10px] border border-[var(--inv-papel-tinta)]/10 bg-[var(--inv-papel)]">
              <div className="flex items-center gap-3 p-2.5">
                <span
                  aria-hidden
                  className={`${claseSerif} flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] text-[20px] leading-none text-[var(--inv-papel)]`}
                  style={{ background: "var(--inv-vino)" }}
                >
                  I&amp;M
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold">Isabella &amp; Mateo — ¡Nos casamos!</span>
                  <span className="block truncate text-[11.5px] opacity-70">{LINK_EJEMPLO.replace("https://", "")}</span>
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-right text-[10.5px] opacity-60">7:42 p. m. ✓✓</p>
          </div>

          <button
            type="button"
            onClick={copiarLink}
            className="presionable mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--inv-vino)] px-4 text-[13.5px] font-bold text-[var(--inv-papel)] transition-colors duration-[var(--duracion-micro)]"
          >
            <IconWhatsapp className="h-4 w-4" />
            {copiado ? "Link copiado" : "Copiar el link de ejemplo"}
          </button>
        </div>
      </Paso>

      {/* ═══════════ 2 · El invitado ═══════════ */}
      <Paso numero={2} titulo="Tu invitado confirma con un toque" texto="Sin descargar nada ni crear cuenta. Y podés preguntarle lo que necesités.">
        <div className="rounded-[18px] bg-[var(--inv-papel)] p-4 text-[var(--inv-papel-tinta)]">
          {enviada ? (
            <div className="flex min-h-[292px] flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--inv-verde-papel)] text-[var(--inv-papel)]">
                <IconCheck className="h-5 w-5" />
              </span>
              <p className={`${claseSerif} text-[28px] leading-tight text-[var(--inv-vino)]`}>
                {enviada.asistira ? `¡Gracias, ${enviada.nombre}!` : `Te vamos a extrañar, ${enviada.nombre}.`}
              </p>
              <p className="text-[13.5px]">
                {enviada.asistira
                  ? `Te esperamos${enviada.acompanantes > 0 ? ` con ${enviada.acompanantes} más` : ""}. Ya estás en la lista de al lado.`
                  : "Quedó anotado para que no te sigan preguntando."}
              </p>
              <button type="button" onClick={otraVez} className="mt-1 min-h-[44px] text-[13px] font-bold text-[var(--inv-vino)] underline underline-offset-4">
                Probar de nuevo
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                confirmar(true);
              }}
              className="flex flex-col gap-3"
            >
              <p className={`${claseSerif} text-center text-[24px] leading-tight text-[var(--inv-vino)]`}>
                ¿Nos acompañás?
              </p>
              <label className="block">
                <span className="mb-1 block text-[12px] font-bold">Tu nombre</span>
                <input
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (avisoNombre) setAvisoNombre(false);
                  }}
                  placeholder="Escribí tu nombre"
                  maxLength={40}
                  aria-invalid={avisoNombre}
                  className="min-h-[44px] w-full rounded-[12px] border border-[var(--inv-papel-tinta)]/20 bg-white px-3.5 text-[14px] placeholder:text-[var(--inv-papel-tinta)]/50"
                />
                {avisoNombre && (
                  <span role="alert" className="mt-1 block text-[12px] font-bold text-[var(--inv-vino)]">
                    Poné tu nombre para ver cómo aparece en la lista.
                  </span>
                )}
              </label>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-bold">Acompañantes</span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Un acompañante menos"
                    onClick={() => setAcompanantes((n) => Math.max(0, n - 1))}
                    className="presionable flex h-9 w-9 items-center justify-center rounded-full border border-[var(--inv-papel-tinta)]/20 text-[16px] font-bold"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-[15px] font-bold tabular-nums">{acompanantes}</span>
                  <button
                    type="button"
                    aria-label="Un acompañante más"
                    onClick={() => setAcompanantes((n) => Math.min(4, n + 1))}
                    className="presionable flex h-9 w-9 items-center justify-center rounded-full border border-[var(--inv-papel-tinta)]/20 text-[16px] font-bold"
                  >
                    +
                  </button>
                </span>
              </div>

              <div>
                <span className="mb-1.5 block text-[12px] font-bold">¿Qué menú preferís?</span>
                <div className="flex flex-wrap gap-1.5">
                  {MENUS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={menu === m}
                      onClick={() => setMenu(m)}
                      className={`presionable min-h-[36px] rounded-[8px] px-3 text-[12.5px] font-bold transition-colors duration-[var(--duracion-micro)] ${
                        menu === m
                          ? "bg-[var(--inv-vino)] text-[var(--inv-papel)]"
                          : "border border-[var(--inv-papel-tinta)]/20 bg-white"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="submit"
                  className="presionable min-h-[44px] rounded-[12px] bg-[var(--inv-vino)] text-[14px] font-bold text-[var(--inv-papel)]"
                >
                  Sí, voy
                </button>
                <button
                  type="button"
                  onClick={() => confirmar(false)}
                  className="presionable min-h-[44px] rounded-[12px] border border-[var(--inv-papel-tinta)]/25 bg-white text-[14px] font-bold"
                >
                  No puedo
                </button>
              </div>
            </form>
          )}
        </div>
      </Paso>

      {/* ═══════════ 3 · El anfitrión ═══════════ */}
      <Paso numero={3} titulo="La lista se te arma sola" texto="Quién va, con cuántos y qué pidió. En tu teléfono, al instante, sin perseguir a nadie.">
        <div className="rounded-[18px] border border-[var(--inv-linea)] bg-[var(--inv-vidrio)] p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[12px] font-bold text-[var(--inv-tinta-suave)]">
              <IconUsers className="h-4 w-4" />
              Confirmaciones
            </p>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--inv-verde-navy)]">
              <span aria-hidden className="inv-pulso h-1.5 w-1.5 rounded-full bg-[var(--inv-verde-navy)]" />
              En vivo
            </p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <Cifra etiqueta="Confirmados" valor={confirmados.length} />
            <Cifra etiqueta="Personas" valor={personas} />
            <Cifra etiqueta="No pueden" valor={noPueden} />
          </div>

          <ul className="mt-3 flex min-h-[184px] flex-col gap-1.5" aria-live="polite">
            {lista.length === 0 && (
              <li className="rounded-[12px] border border-dashed border-[var(--inv-linea)] px-3 py-5 text-center text-[12.5px] text-[var(--inv-tinta-suave)]">
                Las confirmaciones van a ir apareciendo acá.
              </li>
            )}
            {lista.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className={`inv-fila-entra flex items-center gap-3 rounded-[12px] px-3 py-2 ${
                  c.propia ? "bg-[var(--inv-papel)] text-[var(--inv-papel-tinta)]" : "bg-[var(--inv-vidrio)]"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    c.asistira
                      ? c.propia
                        ? "bg-[var(--inv-verde-papel)] text-[var(--inv-papel)]"
                        : "bg-[var(--inv-verde-navy)] text-[var(--inv-fondo)]"
                      : "border border-current"
                  }`}
                  aria-hidden
                >
                  {c.asistira ? <IconCheck className="h-3.5 w-3.5" /> : "–"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">
                    {c.nombre}
                    {c.propia && (
                      <span className="ml-1.5 rounded-[6px] bg-[var(--inv-vino)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--inv-papel)]">
                        Vos
                      </span>
                    )}
                  </span>
                  <span className={`block truncate text-[11.5px] ${c.propia ? "" : "text-[var(--inv-tinta-suave)]"}`}>
                    {c.asistira ? `${1 + c.acompanantes} ${1 + c.acompanantes === 1 ? "persona" : "personas"} · ${c.detalle}` : c.detalle}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Paso>
    </div>
  );
}

/** Un paso: el número, el título, el texto y la pieza viva debajo. */
function Paso({
  numero,
  titulo,
  texto,
  children,
}: {
  numero: number;
  titulo: string;
  texto: string;
  children: React.ReactNode;
}) {
  return (
    // min-w-0: la columna no puede crecer más que la pantalla por un
    // texto truncado adentro (en el teléfono desbordaba 12 px).
    <div className="flex min-w-0 flex-col">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--inv-naranja)] text-[13px] font-bold text-[var(--inv-naranja-tinta)]">
          {numero}
        </span>
        <div>
          <p className="text-[17px] font-bold leading-tight">{titulo}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--inv-tinta-suave)]">{texto}</p>
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Un contador del panel: al cambiar, el número entra de nuevo. */
function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-[12px] bg-[var(--inv-vidrio)] px-2 py-2 text-center">
      <span key={valor} className="inv-fila-entra block text-[24px] font-bold leading-none tabular-nums">
        {valor}
      </span>
      <span className="mt-1 block text-[10.5px] font-bold uppercase tracking-wide text-[var(--inv-tinta-suave)]">
        {etiqueta}
      </span>
    </div>
  );
}
