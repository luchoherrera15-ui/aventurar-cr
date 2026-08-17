import { Metrica, PildoraEstado } from "@/components/panel/piezas";
import type { EstadoPanel } from "@/components/panel/sistema";
import { Icono, type NombreIcono } from "./iconos";

/**
 * EL DATO GRANDE de las pantallas de lealtad.
 *
 * Había dos copias casi iguales —`Dato` en lealtad-estado.tsx y `Kpi`
 * en metricas.tsx— que solo se diferenciaban en el tamaño de la cifra.
 * Cuando Inicio pasó a mostrar números iba a haber una tercera, y tres
 * versiones del mismo cuadrito es cómo un panel deja de verse como un
 * panel.
 *
 * ── AHORA ES LA `Metrica` DEL SISTEMA ──────────────────────────────
 * Ya no dibuja nada propio: compone `Metrica` de `@/components/panel`,
 * que es la `.metric` de la maqueta (disco de ícono arriba, rótulo en
 * versalitas, la cifra en `tabular-nums`, el detalle debajo). Así el
 * número de un programa de lealtad y el de una agenda de citas se ven
 * exactamente igual, que es lo que se pidió. Lo único que sigue
 * viviendo acá es el vocabulario del módulo: qué ícono le toca a cada
 * cifra y cómo se dice un estado que pide atención.
 *
 * ── DOS COSAS QUE CAMBIARON Y POR QUÉ ──────────────────────────────
 * 1. EL TONO ERA SOLO COLOR. `tono="alerta"` pintaba la tarjeta de
 *    rojo tenue y nada más: quien no distingue el rojo del ámbar veía
 *    dos tarjetas idénticas, y el tope del paquete es justo lo que
 *    frena el programa. Ahora el estado se DICE, con la píldora del
 *    sistema — el mismo criterio que este panel ya aplicaba bajo los
 *    medidores («Nunca solo el color»).
 * 2. LA TENDENCIA TIENE SU LUGAR. `delta()` de Métricas —un
 *    comparativo REAL contra los 30 días previos— entraba como
 *    `detalle`, o sea en letra chica al pie. Va arriba a la derecha,
 *    que es donde la maqueta pone la tendencia. Y sigue siendo
 *    opcional: la métrica que no tiene comparativo calculado va sin
 *    nada, nunca con un «+0 %» de relleno.
 *
 * Los colores salen de las clases del tema claro A PROPÓSITO: el bloque
 * `.lealtad-oscuro` de globals.css (más lo que agrega
 * `panel/panel-oscuro.css`) las re-mapea a sus equivalentes sobre navy.
 * Una clase que esos bloques no conozcan deja el texto invisible sobre
 * el fondo oscuro — ya pasó.
 */
export default function Kpi({
  titulo,
  valor,
  detalle,
  icono,
  tendencia,
  aviso,
}: {
  titulo: string;
  /** Ya escrito: quien llama decide el formato (miles, ₡, %). */
  valor: string;
  detalle?: string | null;
  /** El disco de arriba. Sin ícono, la métrica sigue funcionando. */
  icono?: NombreIcono;
  /** Un comparativo REAL contra el período anterior. Nunca se rellena:
   *  la métrica que no lo tiene calculado va sin tendencia. */
  tendencia?: string | null;
  /** El estado que pide atención, dicho con palabras además del color.
   *  Sale de una señal de la base (un tope lleno, gente esperando su
   *  regalía), nunca de un umbral inventado acá. */
  aviso?: { estado: EstadoPanel; texto: string } | null;
}) {
  return (
    <Metrica
      rotulo={titulo}
      valor={valor}
      detalle={detalle ?? undefined}
      icono={icono ? <Icono nombre={icono} className="h-[17px] w-[17px]" /> : undefined}
      tendencia={
        aviso ? (
          <PildoraEstado estado={aviso.estado}>{aviso.texto}</PildoraEstado>
        ) : tendencia ? (
          <span className="shrink-0 text-[11px] font-bold leading-tight text-aventurea-ink-soft">
            {tendencia}
          </span>
        ) : undefined
      }
    />
  );
}
