import { Icono, type NombreIcono } from "../panel/[id]/iconos";

/**
 * LAS TRES MAQUETAS DE /lealtad/partner.
 *
 * Viven aparte de la página para que `page.tsx` se lea como lo que es
 * —el guion de la propuesta— y no como 300 líneas de `<rect>`.
 *
 * ------------------------------------------------------------------
 * TODO SALE DE LOS TOKENS
 * ------------------------------------------------------------------
 * Ni un hex escrito a mano: `var(--accion)`, `var(--navy)`,
 * `var(--line)`… Dentro de `.lealtad` esas siete variables ya están
 * re-declaradas, así que estas piezas se adaptan solas al módulo. Un
 * hex acá rompería justamente eso.
 *
 * ------------------------------------------------------------------
 * ⚠️ LAS CIFRAS SON DE EJEMPLO Y SE DICE
 * ------------------------------------------------------------------
 * El repo tiene una regla explícita contra inventar datos que parezcan
 * reales. Las maquetas 2 y 3 muestran montos, así que van rotuladas
 * como ejemplo EN LA PROPIA MAQUETA — no en una nota al pie que nadie
 * lee. Nadie tiene que poder confundir esto con su panel.
 */

const SOMBRA = "shadow-[0_18px_40px_-24px_rgba(6,38,83,.4)]";

/* ── 01 · El código que se reparte ──────────────────────────────────
   Lo que un partner de verdad hace: mandar su código. La maqueta es
   ese código y el gesto de compartirlo, nada más. */
export function MaquetaInvitar() {
  return (
    <div className={`w-full max-w-[260px] rounded-[18px] border bg-white p-4 ${SOMBRA}`}
      style={{ borderColor: "var(--line)" }}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-aventurea-ink-soft">
        Tu código
      </p>
      <div
        className="mt-2 flex items-center justify-between rounded-[12px] px-3 py-2.5"
        style={{ background: "var(--accion-suave)" }}
      >
        <span
          className="text-[19px] font-extrabold tracking-[0.08em]"
          style={{ color: "var(--accion-fuerte)" }}
        >
          MAR-42
        </span>
        <span
          className="grid h-7 w-7 place-items-center rounded-[8px]"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          <Icono nombre="qr" className="h-4 w-4" />
        </span>
      </div>

      {/* El mensaje ya escrito: el partner solo lo reenvía. */}
      <div
        className="mt-3 rounded-[12px] rounded-bl-[4px] border px-3 py-2"
        style={{ borderColor: "var(--line)" }}
      >
        <span className="block text-[10px] leading-snug text-aventurea-ink">
          Te comparto Bookea Lealtad. Poné mi código{" "}
          <strong className="font-extrabold text-aventurea-navy">MAR-42</strong> al
          registrarte.
        </span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {["WhatsApp", "Instagram", "Correo"].map((canal) => (
          <span
            key={canal}
            className="rounded-full px-2 py-[3px] text-[9px] font-bold"
            style={{ background: "var(--navy-suave)", color: "var(--navy)" }}
          >
            {canal}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 02 · El panel ──────────────────────────────────────────────────
   Una lista de negocios con su estado, que es lo que un partner mira:
   quién ya activó y quién sigue en trámite. */
export function MaquetaPanel() {
  const filas = [
    { negocio: "Café La Esquina", plan: "Impulso", activo: true },
    { negocio: "Barbería Nogal", plan: "Starter", activo: true },
    { negocio: "Spa Almendro", plan: "En trámite", activo: false },
  ];
  return (
    <div className={`w-full max-w-[280px] overflow-hidden rounded-[18px] border bg-white ${SOMBRA}`}
      style={{ borderColor: "var(--line)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "var(--navy)" }}
      >
        <span className="text-[10.5px] font-extrabold text-white">Tu panel de partner</span>
        <span
          className="rounded-full px-2 py-[2px] text-[8.5px] font-extrabold uppercase tracking-[0.1em]"
          style={{ background: "var(--accion-claro)", color: "var(--accion-claro-tinta)" }}
        >
          Ejemplo
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--line)" }}>
        <div className="px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft">
            Negocios activos
          </p>
          <p className="mt-0.5 text-[20px] font-extrabold tabular-nums text-aventurea-ink">12</p>
        </div>
        <div className="px-4 py-3" style={{ borderColor: "var(--line)" }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft">
            Este mes
          </p>
          <p
            className="mt-0.5 text-[20px] font-extrabold tabular-nums"
            style={{ color: "var(--accion-fuerte)" }}
          >
            $186
          </p>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: "var(--line)" }}>
        {filas.map((f) => (
          <div
            key={f.negocio}
            className="flex items-center justify-between border-b px-4 py-2"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="text-[10px] font-bold text-aventurea-ink">{f.negocio}</span>
            <span
              className="rounded-full px-2 py-[2px] text-[8.5px] font-extrabold"
              style={{
                background: f.activo ? "var(--accion-suave)" : "var(--grey)",
                color: f.activo ? "var(--accion-fuerte)" : "var(--muted)",
              }}
            >
              {f.plan}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── 03 · La ganancia que se repite ─────────────────────────────────
   Lo que distingue esta propuesta de una comisión suelta es que el
   monto VUELVE cada mes. Por eso la maqueta es una serie de barras que
   crecen, no un número solo: la forma cuenta la recurrencia. */
export function MaquetaGanancias() {
  const meses = [
    { mes: "Ene", alto: 26 },
    { mes: "Feb", alto: 38 },
    { mes: "Mar", alto: 47 },
    { mes: "Abr", alto: 58 },
    { mes: "May", alto: 72 },
    { mes: "Jun", alto: 88 },
  ];
  return (
    <div className={`w-full max-w-[280px] rounded-[18px] border bg-white p-4 ${SOMBRA}`}
      style={{ borderColor: "var(--line)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-aventurea-ink-soft">
            Ingreso mensual
          </p>
          <p className="mt-0.5 text-[13px] font-bold text-aventurea-ink">
            Se repite mientras el negocio siga activo
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-[2px] text-[8.5px] font-extrabold uppercase tracking-[0.1em]"
          style={{ background: "var(--navy-suave)", color: "var(--navy)" }}
        >
          Ejemplo
        </span>
      </div>

      <div className="mt-4 flex h-[70px] items-end gap-2">
        {meses.map((m, i) => (
          <span key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span
              aria-hidden
              className="w-full rounded-t-[4px]"
              style={{
                height: `${m.alto}%`,
                background: i === meses.length - 1 ? "var(--accion)" : "var(--accion-claro)",
              }}
            />
            <span className="text-[7.5px] font-bold text-aventurea-ink-soft">{m.mes}</span>
          </span>
        ))}
      </div>

      <div
        className="mt-3 flex items-center gap-2 rounded-[10px] px-2.5 py-2"
        style={{ background: "var(--accion-suave)" }}
      >
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accion)", color: "var(--accion-tinta)" }}
        >
          <Icono nombre={"repetir" as NombreIcono} className="h-3 w-3" />
        </span>
        <span className="text-[9.5px] font-bold" style={{ color: "var(--accion-fuerte)" }}>
          Cada negocio que traés suma al mes siguiente
        </span>
      </div>
    </div>
  );
}
