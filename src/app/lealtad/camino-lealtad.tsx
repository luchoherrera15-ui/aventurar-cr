"use client";

/**
 * EL PRIMER PASO DEL ALTA DE LEALTAD — ¿solo o con ayuda?
 *
 * Pedido del dueño (8 sep 2026): antes de elegir el plan, dos opciones
 * grandes: «¿Querés crear tu tarjeta digital vos mismo?» sigue al
 * configurador de siempre; «¿Necesitás ayuda para configurar el
 * sistema?» abre la agenda chica para programar una reunión con
 * Bookea. Dos cards del mismo tamaño, sin una «recomendada»: las dos
 * son buenas salidas y la persona sabe cuál es la suya.
 */
export default function CaminoLealtad({ alSolo, alConAyuda }: { alSolo: () => void; alConAyuda: () => void }) {
  const opciones = [
    {
      id: "solo",
      titulo: "¿Querés crear tu tarjeta digital vos mismo?",
      pie: "Elegís el plan, el tipo de tarjeta, los colores y el premio en el configurador. En cinco minutos está en la calle.",
      accion: "Sí, la armo yo →",
      icono: "✦",
      onClick: alSolo,
      primario: true,
    },
    {
      id: "ayuda",
      titulo: "¿Necesitás ayuda para configurar el sistema?",
      pie: "Programá una videollamada de 30 minutos con el equipo de Bookea. La armamos juntos, sin costo.",
      accion: "Programar una reunión →",
      icono: "☎",
      onClick: alConAyuda,
      primario: false,
    },
  ];
  return (
    <div className="p-5 sm:px-7 sm:py-5">
      <span className="inline-flex rounded-full bg-bookea-azul-suave px-3 py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-bookea-azul">Antes de empezar</span>
      <h2 className="titulo mt-2 text-[26px] leading-tight text-bookea-tinta">¿Cómo querés armar tu tarjeta?</h2>
      <p className="mt-1.5 text-[13px] text-bookea-gris">Las dos llegan al mismo lugar: tu tarjeta de lealtad en el teléfono de tus clientes.</p>

      <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
        {opciones.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={o.onClick}
            className={`presionable flex min-h-[220px] flex-col items-start rounded-3xl border p-6 text-left transition-colors ${o.primario ? "border-transparent text-white" : "border-bookea-linea bg-white text-bookea-tinta hover:border-bookea-azul"}`}
            style={o.primario ? { background: "var(--accion, #062653)" } : undefined}
          >
            <span aria-hidden className={`grid h-11 w-11 place-items-center rounded-2xl text-[20px] ${o.primario ? "bg-white/15" : "bg-bookea-azul-suave text-bookea-azul"}`}>
              {o.icono}
            </span>
            <span className="titulo mt-5 text-[21px] leading-tight">{o.titulo}</span>
            <span className={`mt-2 text-[13.5px] leading-snug ${o.primario ? "text-white/85" : "text-bookea-gris"}`}>{o.pie}</span>
            <span className={`mt-auto pt-5 text-[14px] font-extrabold ${o.primario ? "text-white" : "text-bookea-azul"}`}>{o.accion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
