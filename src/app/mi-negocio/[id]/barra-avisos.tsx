import Link from "next/link";
import type { ReactNode } from "react";
import { IconCheck, IconChevronRight } from "@/components/icons";
import { Card, FilaPanel, PildoraEstado } from "@/components/panel/piezas";
import { ENLACE_CARD, GAP_TABLERO } from "@/components/panel/sistema";

export type Aviso = {
  id: string;
  texto: string;
  /** A dónde lleva el aviso (una pestaña del panel, normalmente). */
  href: string;
  /** El texto del enlace, ej. "Ir a Finanzas". */
  accion: string;
};

/**
 * LO QUE ESPERA TU RESPUESTA — el bloque «Próximas acciones» de la
 * maqueta (`.actions-list`), con nuestros datos.
 *
 * Adentro van las solicitudes por aceptar (que traen sus propios
 * botones de confirmar/rechazar) y, debajo, una tarjeta con los avisos
 * cortos que se resuelven yendo a otra pestaña. Cada aviso es una
 * `FilaPanel`: la misma fila que usan la agenda, el histórico y el
 * calendario, así que un pendiente se reconoce como pendiente en todo
 * el panel.
 *
 * EL CONTADOR SE CUENTA, NO SE ESCRIBE. La maqueta pinta un «3» al
 * lado del título; acá ese número es `avisos.length`, que sale de las
 * reservas reales (depósitos sin validar, saldos de hoy, saldos
 * vencidos) en `page.tsx`. Si no hay avisos, no hay tarjeta.
 *
 * Si no hay nada pendiente NO ocupa espacio: una línea discreta de
 * "todo al día", no un bloque vacío con marco. Un panel que muestra una
 * tarjeta vacía para decir que no pasa nada es un panel que hace ruido.
 */
export default function BarraAvisos({
  avisos,
  haySolicitudes,
  children,
}: {
  avisos: Aviso[];
  haySolicitudes: boolean;
  children?: ReactNode;
}) {
  if (!haySolicitudes && avisos.length === 0) {
    return (
      <p className="flex items-center gap-2 text-[12.5px] font-bold text-aventurea-ink-soft">
        <IconCheck className="h-4 w-4 shrink-0 text-aventurea-green" />
        Todo al día — no hay nada esperando tu respuesta.
      </p>
    );
  }

  return (
    <div className={`flex flex-col ${GAP_TABLERO}`}>
      {children}

      {avisos.length > 0 && (
        <Card
          eyebrow="Esperando tu respuesta"
          titulo="Próximas acciones"
          accion={
            <PildoraEstado estado="aviso">
              {avisos.length} {avisos.length === 1 ? "pendiente" : "pendientes"}
            </PildoraEstado>
          }
        >
          <div>
            {avisos.map((a, i) => (
              <FilaPanel
                key={a.id}
                marca="aviso"
                titulo={a.texto}
                separador={i < avisos.length - 1}
                derecha={
                  <Link href={a.href} className={`${ENLACE_CARD} flex items-center gap-1`}>
                    {a.accion}
                    <IconChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                }
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
