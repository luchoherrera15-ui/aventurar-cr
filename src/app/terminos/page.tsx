import type { Metadata } from "next";
import Link from "next/link";
import PaginaLegal, {
  Destacado,
  H2,
  Lista,
  P,
  Punto,
} from "@/components/pagina-legal";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Las reglas de uso de Bookea: qué hace la plataforma, qué responde cada proveedor y qué responde cada usuario.",
};

/**
 * Los términos de uso de la plataforma. La tesis del documento, que se
 * repite en cada apartado, es una sola: Bookea es un intermediario
 * tecnológico y NO es parte del contrato entre el cliente y el
 * proveedor. Todo lo que ocurra durante el servicio —calidad,
 * seguridad, daños, incumplimientos— es del proveedor.
 *
 * La excepción honesta son las Invitaciones Digitales: ese sí es un
 * producto propio de Bookea y por eso lleva su propio apartado, con la
 * responsabilidad acotada a lo que el cliente pagó por ella.
 */
export default function TerminosPage() {
  return (
    <PaginaLegal
      breadcrumb="Términos"
      titulo="Términos y condiciones"
      actualizado="julio de 2026"
      intro={
        <>
          Estos términos regulan el uso del sitio bookea.lat, de la aplicación
          móvil de Bookea y de todos los servicios asociados (en adelante, «la
          Plataforma»). Al crear una cuenta, reservar, publicar un negocio o
          simplemente navegar la Plataforma, aceptás estos términos en su
          totalidad. Si no estás de acuerdo con alguno, no usés la Plataforma.
        </>
      }
    >
      <H2>1. Qué es Bookea y qué no es</H2>
      <P>
        Bookea es una plataforma tecnológica de intermediación. Su función es
        poner en contacto a personas que buscan un servicio (clientes) con
        negocios independientes que lo ofrecen (proveedores), y facilitar la
        reserva, la comunicación y, cuando corresponde, el cobro entre ambos.
      </P>
      <Destacado>
        Bookea no presta, no organiza, no ejecuta, no supervisa ni controla
        ninguno de los servicios que se publican en la Plataforma. No es dueño
        de los salones, ranchos, restaurantes, hospedajes ni negocios de citas
        que aparecen en el directorio, ni tiene relación laboral, societaria o
        de representación con ellos. Cada proveedor es un tercero independiente
        que actúa por su cuenta y riesgo.
      </Destacado>
      <P>
        En consecuencia, el contrato por el servicio reservado se celebra
        directa y exclusivamente entre el cliente y el proveedor.{" "}
        <strong className="text-aventurea-ink">
          Bookea no es parte de ese contrato
        </strong>{" "}
        y su intervención se agota en poner la herramienta a disposición de
        ambos.
      </P>

      <H2>2. Definiciones</H2>
      <Lista>
        <Punto>
          <strong className="text-aventurea-ink">Plataforma:</strong> el sitio
          bookea.lat, la aplicación móvil y cualquier otro canal operado por
          Bookea.
        </Punto>
        <Punto>
          <strong className="text-aventurea-ink">Usuario o cliente:</strong>{" "}
          quien usa la Plataforma para buscar, consultar o reservar un
          servicio.
        </Punto>
        <Punto>
          <strong className="text-aventurea-ink">Proveedor:</strong> el negocio
          o persona independiente que publica su servicio y lo presta.
        </Punto>
        <Punto>
          <strong className="text-aventurea-ink">Servicio de tercero:</strong>{" "}
          todo servicio prestado por un proveedor: alquiler de espacios,
          alimentación, animación, organización, decoración, hospedaje, citas,
          restaurantes y cualquier otro publicado en el directorio.
        </Punto>
      </Lista>

      <H2>3. Qué responde el proveedor</H2>
      <P>
        El proveedor es el único y exclusivo responsable del servicio que
        ofrece y presta. Esto incluye, sin que la lista sea limitativa:
      </P>
      <Lista>
        <Punto>
          La prestación efectiva del servicio en la fecha, hora, lugar y
          condiciones acordadas.
        </Punto>
        <Punto>
          La calidad, idoneidad, higiene y seguridad de sus instalaciones,
          equipos, alimentos, personal y servicios.
        </Punto>
        <Punto>
          Contar con todas las licencias, permisos, patentes municipales,
          permisos sanitarios, pólizas de seguro y autorizaciones que la
          legislación costarricense le exija para operar.
        </Punto>
        <Punto>
          El cumplimiento de sus obligaciones tributarias, laborales y de
          seguridad social, incluida la emisión de la factura electrónica que
          corresponda.
        </Punto>
        <Punto>
          La veracidad y exactitud de toda la información que publique: fotos,
          descripciones, capacidad, ubicación, precios, disponibilidad,
          políticas de cancelación y reglas del lugar.
        </Punto>
        <Punto>
          Cualquier daño, lesión, pérdida o perjuicio que ocurra durante la
          prestación del servicio o dentro de sus instalaciones.
        </Punto>
      </Lista>

      <H2>4. Qué responde el usuario</H2>
      <Lista>
        <Punto>
          Dar información veraz al reservar, incluidas la cantidad real de
          personas y la naturaleza de la actividad.
        </Punto>
        <Punto>
          Pagar el precio acordado y, cuando aplique, el depósito de garantía.
        </Punto>
        <Punto>
          Respetar las reglas, horarios y condiciones del proveedor, y
          responder por los daños que él o sus acompañantes causen a las
          instalaciones o a terceros.
        </Punto>
        <Punto>
          Usar la Plataforma de buena fe, sin suplantar identidades, sin
          publicar contenido ilícito y sin intentar vulnerar la seguridad del
          sistema.
        </Punto>
      </Lista>

      <H2>5. La información la publica el proveedor</H2>
      <P>
        Los contenidos del directorio —textos, fotos, precios, disponibilidad y
        políticas— los carga y actualiza cada proveedor bajo su exclusiva
        responsabilidad. Bookea puede revisar publicaciones y retirar las que
        considere inapropiadas, pero{" "}
        <strong className="text-aventurea-ink">
          no verifica ni garantiza la veracidad, exactitud o vigencia de esa
          información
        </strong>
        , ni realiza inspecciones de las instalaciones, ni certifica permisos,
        licencias o pólizas.
      </P>

      <H2>6. La Plataforma se ofrece «tal cual»</H2>
      <P>
        Bookea pone la Plataforma a disposición en el estado en que se
        encuentra y según disponibilidad. No garantiza que el servicio vaya a
        estar disponible de forma ininterrumpida, libre de errores, ni que los
        resultados de búsqueda, recomendaciones o disponibilidad mostrada sean
        exactos en todo momento. Bookea puede modificar, suspender o
        descontinuar cualquier funcionalidad en cualquier momento.
      </P>

      <H2>7. Limitación de responsabilidad</H2>
      <Destacado>
        Bookea no responde por el incumplimiento, la mala prestación, la
        cancelación ni la calidad de los servicios contratados con un
        proveedor, ni por los daños de cualquier naturaleza que se deriven de
        ellos.
      </Destacado>
      <P>
        En particular, y sin que la enumeración sea limitativa, Bookea no
        asume responsabilidad alguna por:
      </P>
      <Lista>
        <Punto>
          Que el proveedor no se presente, cancele, cambie las condiciones,
          entregue algo distinto a lo ofrecido o preste un servicio de calidad
          inferior a la esperada.
        </Punto>
        <Punto>
          Lesiones, accidentes, intoxicaciones, enfermedades o cualquier daño a
          la salud ocurrido durante el servicio o en las instalaciones del
          proveedor.
        </Punto>
        <Punto>
          Robos, hurtos, pérdidas o daños a bienes de los clientes o de sus
          invitados.
        </Punto>
        <Punto>
          Daños causados a las instalaciones del proveedor por el cliente o sus
          invitados.
        </Punto>
        <Punto>
          Conflictos, reclamos o disputas entre clientes y proveedores, entre
          los que Bookea no actúa como árbitro ni como garante.
        </Punto>
        <Punto>
          Caso fortuito o fuerza mayor: clima, desastres naturales, cortes de
          energía o de internet, bloqueos, huelgas, disposiciones de autoridad
          o cualquier hecho ajeno al control razonable de Bookea.
        </Punto>
        <Punto>
          Fallas, demoras o interrupciones de servicios de terceros de los que
          la Plataforma depende, incluidos proveedores de pago, correo,
          mensajería, alojamiento en la nube y notificaciones.
        </Punto>
        <Punto>
          Daños indirectos, lucro cesante, pérdida de datos, pérdida de
          oportunidad o daño moral, cualquiera que sea su causa.
        </Punto>
      </Lista>
      <Destacado>
        En todo caso, y en la máxima medida permitida por la legislación
        costarricense, la responsabilidad total de Bookea frente a un usuario
        por cualquier reclamo relacionado con la Plataforma o con una reserva
        no excederá el monto de la comisión efectivamente percibida por Bookea
        por esa transacción en concreto.
      </Destacado>

      <H2>8. Indemnidad</H2>
      <P>
        El usuario y el proveedor se obligan a mantener indemne a Bookea, sus
        socios, personal y colaboradores frente a cualquier reclamo, demanda,
        multa, sanción, costo o gasto —incluidos honorarios de abogado— que
        surja de: el servicio prestado o recibido, el contenido que hayan
        publicado, el incumplimiento de estos términos o la infracción de
        derechos de terceros.
      </P>

      <H2>9. Pagos, depósitos y comisiones</H2>
      <P>
        Según el caso, el pago puede hacerse directamente al proveedor o a
        través de la Plataforma. Los cobros con tarjeta los procesa Stripe, y
        también se aceptan SINPE Móvil y transferencia bancaria. Bookea actúa
        únicamente como facilitador del cobro: no es entidad financiera, no
        custodia fondos más allá de lo estrictamente necesario para liquidar al
        proveedor y no responde por fallas, rechazos, retenciones o contracargos
        de las plataformas de pago o de las entidades bancarias.
      </P>
      <P>
        Bookea puede cobrar una comisión por el uso de la Plataforma o tarifas
        por sus productos propios. Las tarifas vigentes son las publicadas en la
        Plataforma al momento de la contratación y pueden modificarse hacia el
        futuro.
      </P>

      <H2>10. Reservas, cancelaciones y reembolsos</H2>
      <P>
        La reserva es instantánea: al confirmarse el espacio, la fecha y el
        pago, queda reservada. Las condiciones de cancelación, reprogramación y
        reembolso las define cada proveedor y se rigen por lo indicado en su
        publicación y por las{" "}
        <Link href="/politicas" className="font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange">
          Políticas de la plataforma
        </Link>
        . Bookea puede gestionar administrativamente una devolución cuando así
        corresponda, pero no la garantiza con recursos propios ni responde por
        la negativa del proveedor a reembolsar.
      </P>

      <H2>11. Invitaciones digitales y otros productos propios</H2>
      <P>
        Las invitaciones digitales, los álbumes y demás productos que Bookea
        diseña y entrega directamente sí son servicios propios, y por eso se
        rigen por reglas específicas:
      </P>
      <Lista>
        <Punto>
          Bookea se obliga a entregar el producto contratado conforme al
          paquete adquirido, en el plazo informado al momento del pedido.
        </Punto>
        <Punto>
          El cliente es responsable de la exactitud de los datos que suministre
          —nombres, fechas, horas, direcciones, textos y fotos—. Bookea no
          responde por errores originados en información entregada
          incorrectamente por el cliente.
        </Punto>
        <Punto>
          El cliente declara contar con los derechos sobre las fotos, música,
          textos y materiales que entregue, y autoriza a Bookea a usarlos para
          elaborar el producto.
        </Punto>
        <Punto>
          Bookea no garantiza la asistencia real de los invitados ni que estos
          confirmen, abran o respondan la invitación.
        </Punto>
        <Punto>
          La responsabilidad de Bookea por estos productos se limita, como
          máximo, al monto efectivamente pagado por el producto de que se
          trate.
        </Punto>
      </Lista>

      <H2>12. Contenido, propiedad intelectual y reseñas</H2>
      <P>
        La marca Bookea, el sitio, la aplicación, su diseño, su código y sus
        plantillas son propiedad de Bookea y no pueden copiarse, reproducirse
        ni explotarse sin autorización escrita.
      </P>
      <P>
        El contenido que publica cada usuario o proveedor sigue siendo suyo,
        pero al publicarlo otorga a Bookea una licencia gratuita, mundial y no
        exclusiva para mostrarlo, adaptarlo y promocionarlo dentro de la
        Plataforma y en sus canales de difusión. Quien publica garantiza contar
        con los derechos sobre ese material y responde frente a terceros por
        él.
      </P>
      <P>
        Las reseñas expresan la opinión de quien las escribe y no de Bookea.
        Bookea puede retirar reseñas o contenidos falsos, ofensivos, ilícitos o
        que infrinjan derechos de terceros.
      </P>

      <H2>13. Cuentas, suspensión y terminación</H2>
      <P>
        Cada usuario es responsable de la seguridad de su cuenta y de todo lo
        que se haga desde ella. Bookea puede suspender o cancelar cuentas,
        publicaciones o reservas —sin obligación de indemnizar— cuando detecte
        incumplimiento de estos términos, información falsa, fraude, uso
        abusivo de la Plataforma o conductas que pongan en riesgo a otros
        usuarios.
      </P>

      <H2>14. Cambios a estos términos</H2>
      <P>
        Bookea puede modificar estos términos en cualquier momento. La versión
        vigente es siempre la publicada en bookea.lat/terminos, y el uso de la
        Plataforma después de una modificación implica su aceptación.
      </P>

      <H2>15. Ley aplicable y jurisdicción</H2>
      <P>
        Estos términos se rigen por la legislación de la República de Costa
        Rica. Cualquier controversia que no se resuelva de forma directa se
        someterá a los tribunales de San José, Costa Rica. Si alguna cláusula
        fuera declarada nula o inaplicable, las demás mantendrán plena validez.
      </P>
      <P>
        Nada de lo dispuesto en estos términos excluye los derechos que la
        normativa costarricense de protección al consumidor reconozca de forma
        imperativa a quien tenga esa condición.
      </P>

      <H2>16. Contacto</H2>
      <P>
        Consultas sobre estos términos: hola@bookea.lat.
      </P>
    </PaginaLegal>
  );
}
