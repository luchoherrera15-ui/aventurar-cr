import Link from "next/link";

/**
 * La lista de la bandeja de mensajes, separada de la página para poder
 * probarla con datos de mentira. No sabe nada de Supabase: recibe las
 * filas ya armadas.
 */

export type FilaConversacion = {
  id: string;
  /** /mensajes/[reservaId] para hilos de reserva, /mensajes/hilo/[id]
   *  para consultas directas sin reserva. */
  href: string;
  titulo: string;
  subtitulo: string;
  foto: string | null;
  ultimoTexto: string;
  actividad: string;
  pendientes: number;
};

export function fechaCorta(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

export default function ListaConversaciones({ filas }: { filas: FilaConversacion[] }) {
  if (filas.length === 0) {
    return (
      <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-8 text-center">
        <p className="text-[14px] font-bold text-aventurea-ink">
          Todavía no tenés conversaciones.
        </p>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-[13px] text-aventurea-ink-soft">
          Cuando reservés un lugar o pidás una cotización, el chat con el
          proveedor aparece acá.
        </p>
        <Link
          href="/ranchos-eventos"
          className="mt-5 inline-flex rounded-xl bg-aventurea-navy px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-aventurea-navy-2"
        >
          Ver el directorio
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-aventurea-line bg-aventurea-surface">
      {filas.map((f) => {
        const nuevo = f.pendientes > 0;
        return (
          <Link
            key={f.id}
            href={f.href}
            className={`flex items-center gap-3.5 border-b border-aventurea-line px-4 py-3.5 transition-colors last:border-none ${
              nuevo
                ? "bg-aventurea-green/[0.06] hover:bg-aventurea-green/10"
                : "hover:bg-aventurea-cream-2/50"
            }`}
          >
            <div
              className="h-12 w-12 shrink-0 rounded-full bg-aventurea-cream-2 bg-cover bg-center"
              style={f.foto ? { backgroundImage: `url(${f.foto})` } : undefined}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-aventurea-ink">
                {f.titulo}
              </p>
              {f.subtitulo && (
                <p className="truncate text-[12px] text-aventurea-ink-soft">
                  {f.subtitulo}
                </p>
              )}
              <p
                className={`mt-0.5 truncate text-[12.5px] ${
                  nuevo ? "font-bold text-aventurea-ink" : "text-aventurea-ink-soft"
                }`}
              >
                {f.ultimoTexto}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold ${
                  nuevo
                    ? "bg-aventurea-navy text-white"
                    : "border border-aventurea-line bg-aventurea-cream-2 text-aventurea-ink-soft"
                }`}
              >
                {fechaCorta(f.actividad)}
              </span>
              {nuevo && (
                <span className="rounded-lg bg-aventurea-green px-2.5 py-1 text-[10.5px] font-bold text-white">
                  {f.pendientes} nuevo{f.pendientes === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
