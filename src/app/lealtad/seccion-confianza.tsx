import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * CONFIANZA — sin logos de clientes ni testimonios inventados.
 *
 * El pedido fue explícito: nada de cifras o clientes fabricados. Este
 * sitio no tiene hoy testimonios públicos ni logos de clientes listos
 * para una landing, así que la sección se apoya en lo que SÍ es
 * verificable en el producto — los mismos hechos que ya viven en otras
 * partes del sitio (el canje se valida server-side en `contenido-tipos.ts`,
 * el pago seguro de `panel-paquetes-lealtad.tsx`, el "sin contratos" del
 * cierre) — nunca una cifra o una cita atribuida a alguien que no la dijo.
 */

const PUNTOS: { icono: NombreIcono; titulo: string; texto: string }[] = [
  {
    icono: "candado",
    titulo: "Cada canje se valida en el servidor",
    texto: "Una captura de pantalla no alcanza: el sistema autoriza cada sello y cada canje contra la base, no contra lo que se ve en el teléfono.",
  },
  {
    icono: "listo",
    titulo: "Sin contratos ni permanencia mínima",
    texto: "Empezás gratis y subís de paquete cuando lo necesitás — nunca antes. Cancelás cuando quieras, sin penalidad.",
  },
  {
    icono: "moneda",
    titulo: "Pago seguro, como prefieras",
    texto: "Tarjeta (Visa, Mastercard, Amex, Apple Pay o Google Pay) o SINPE Móvil. Bookea no guarda los datos de tu tarjeta.",
  },
  {
    icono: "movil",
    titulo: "Wallet nativo, no una app aparte",
    texto: "El pase corre sobre Apple Wallet y Google Wallet, la app que ya trae el teléfono — no una app propia que tu cliente tenga que mantener instalada.",
  },
];

export default function SeccionConfianza() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PUNTOS.map((p) => (
        <div key={p.titulo} className="flex items-start gap-3.5 rounded-2xl border border-aventurea-line bg-white p-5">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: "var(--accion-suave)", color: "var(--accion-fuerte)" }}
          >
            <Icono nombre={p.icono} className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13.5px] font-extrabold leading-tight text-aventurea-navy">{p.titulo}</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">{p.texto}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
