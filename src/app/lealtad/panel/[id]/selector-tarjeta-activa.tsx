import Link from "next/link";
import { Icono, type NombreIcono } from "./iconos";
import { TIPOS_TARJETA, tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import type { ProgramaEnLista } from "./seccion-programas";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  QUÉ TARJETA SE ESTÁ MIRANDO — el selector que faltaba
 * ═══════════════════════════════════════════════════════════════════
 *
 * Pura Matcha tiene dos tarjetas: "Pase de los sellos" (31 clientes) y
 * "Entrada para Paint and Matcha" (un evento). Clientes, Actividad y
 * Métricas mostraban SIEMPRE la principal —la de sellos— sin decir
 * que había otra ni dejar mirar la del evento desde acá. Cuando tres
 * personas quedaron afiliadas a la tarjeta equivocada, nadie lo notó
 * hasta la tarde: no había manera de ver esos tres clientes sin saber
 * de antemano que tenían que ir a buscarlos a "Tarjetas" → tocar la
 * otra → un editor que ni siquiera es esta pantalla.
 *
 * Cada pestaña es un LINK, no un estado de cliente: cambiar de
 * tarjeta cambia qué `programaId` consulta el servidor (`?tarjeta=`
 * en la URL, validado en page.tsx contra las tarjetas REALES de este
 * negocio), así que los datos de la que se elige siempre están
 * completos y al día — no una copia pre-cargada y escondida como
 * hacen `TabsLealtad`/`ClientesVistas` con las DOS vistas de una
 * misma tarjeta. Con quince tarjetas (paquete Pro) esto sigue
 * pidiendo solo una consulta por vez, no quince en cada carga.
 *
 * Solo se pinta con más de una tarjeta: para el negocio con una sola
 * —la inmensa mayoría— esta fila no debe existir.
 */
export default function SelectorTarjetaActiva({
  ranchoId,
  programas,
  activaId,
  seccion,
}: {
  ranchoId: string;
  programas: ProgramaEnLista[];
  activaId: string | null;
  /** El ancla a la que hay que volver: cambiar de tarjeta no debe
   *  mandar de vuelta a Inicio. */
  seccion: string;
}) {
  if (programas.length <= 1) return null;

  return (
    <div
      role="tablist"
      aria-label="Qué tarjeta estás mirando"
      className="flex flex-wrap gap-1.5 rounded-xl border border-aventurea-line bg-aventurea-cream-2 p-1.5"
    >
      {programas.map((prog) => {
        const activa = prog.id === activaId;
        const tipo = TIPOS_TARJETA[tipoDe(prog.modo)];
        return (
          <Link
            key={prog.id}
            href={`/lealtad/panel/${ranchoId}?tarjeta=${prog.id}#${seccion}`}
            role="tab"
            aria-selected={activa}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-bold transition-colors ${
              activa
                ? "bg-white text-aventurea-navy shadow-sm"
                : "text-aventurea-ink-soft hover:text-aventurea-navy"
            }`}
          >
            <span
              aria-hidden
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-white"
              style={{ background: prog.colorFondo ?? "var(--navy-elevado)" }}
            >
              <Icono nombre={tipo.icono as NombreIcono} className="h-3 w-3" />
            </span>
            <span className="min-w-0 truncate">{prog.nombre}</span>
            <span className={activa ? "text-aventurea-ink-soft" : "opacity-70"}>
              · {prog.miembros}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
