import Link from "next/link";
import VistaPase, { type DatosVista } from "@/components/lealtad/vista-pase";
import { configPorDefecto } from "@/lib/lealtad/tipos-tarjeta";
import { Encabezado, Escenario, NotaDemo, Seccion } from "./piezas";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LEALTAD — el pase de verdad, dentro de un teléfono
 * ════════════════════════════════════════════════════════════════════
 *
 * Acá había una tarjeta dibujada a mano: un rectángulo negro con seis
 * círculos. Se veía como un gráfico de landing, no como lo que el
 * cliente se guarda en el teléfono. Pedido del dueño (23 sep 2026):
 * «que se vea realmente como una tarjeta digital, que tenga código QR
 * y demás».
 *
 * No hubo que dibujar ninguna: `<VistaPase>` ES el pase. Es el mismo
 * componente que pinta la vista previa del panel de Lealtad, la
 * pantalla de afiliación y el modal del admin — con su banda superior,
 * su tira de sellos, su QR de 21 módulos y el conmutador Apple/Google.
 * La misma decisión que se tomó con `<VistaPagina>` en la sección de
 * «tu página»: mostrar el producto, no una imitación del producto.
 *
 * `marco="telefono"` lo mete dentro del teléfono dibujado que el
 * propio componente trae, y `superficie="clara"` le dice que el fondo
 * de la página es blanco para que los textos que rodean a la tarjeta
 * —las pestañas y el aviso— se pinten en gris y no en blanco.
 *
 * ── ⚠️ ZONA PROTEGIDA: SE LEE, NO SE TOCA ───────────────────────────
 *
 * Lealtad está en producción con clientes reales. Esto IMPORTA el
 * componente y `configPorDefecto()`, y no modifica ni una línea de
 * ninguno de los dos: ni puntos, ni miembros, ni transacciones, ni
 * pases, ni Wallet. Si algún día esta sección necesitara un cambio
 * DENTRO de `vista-pase.tsx`, hay que parar y pedirlo — no hacerlo de
 * paso desde el home.
 */

/**
 * El pase de muestra.
 *
 * `configPorDefecto("sellos")` es la configuración real con la que
 * arranca cualquier programa nuevo —10 sellos, el 11 gratis, que es el
 * caso más común del país—, así que ni la meta ni el saldo salen de un
 * número inventado acá.
 */
/**
 * `configPorDefecto` devuelve la UNIÓN de todas las configuraciones, así
 * que hay que estrecharla antes de agregarle `recompensa` —que solo
 * existe en la de sellos—. El `if` es el estrechamiento; el `else` no
 * puede pasar, pero deja el tipo cerrado sin un `as`.
 */
const BASE = configPorDefecto("sellos");
const BENEFICIO: DatosVista["beneficio"] =
  BASE.tipo === "sellos" ? { ...BASE, recompensa: "Un corte gratis" } : BASE;

const DEMO: DatosVista = {
  negocioNombre: "Silence Barber",
  modo: "sellos",
  beneficio: BENEFICIO,
  // El navy de la marca y el ámbar del sello: los mismos valores con
  // los que se ve un pase de verdad, no una paleta nueva.
  colorFondo: "#10192e",
  colorSello: "#e0a34a",
  logoUrl: null,
  saldoEjemplo: 7,
};

export default function Lealtad() {
  return (
    <Seccion id="lealtad">
      <Encabezado rotulo="Lealtad" titulo="Sellos que los traen de vuelta.">
        La tarjeta vive en Apple Wallet y Google Wallet, y se actualiza sola
        cada vez que le sellás.
      </Encabezado>

      <Escenario ancho="telefono">
        <div className="flex justify-center">
          <VistaPase datos={DEMO} superficie="clara" marco="telefono" anchoTelefono={280} />
        </div>
        <NotaDemo>
          Es el pase de verdad, el mismo que ve tu cliente. El diseño lo elegís
          vos.
        </NotaDemo>

        <div className="mt-8 text-center">
          <Link href="/lealtad" className="btn-tinta-contorno">
            Conocer Lealtad
          </Link>
        </div>
      </Escenario>
    </Seccion>
  );
}
