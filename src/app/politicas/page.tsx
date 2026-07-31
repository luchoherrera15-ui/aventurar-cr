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
  title: "Políticas de la plataforma",
  description:
    "Cómo funcionan las reservas, las cancelaciones, los pagos, las publicaciones y las reseñas en Bookea.",
};

/**
 * Las políticas operativas: el «cómo funciona» del día a día, en
 * lenguaje llano. Los términos dicen quién responde por qué; esto dice
 * qué pasa en la práctica cuando alguien cancela, cuando llueve o
 * cuando un proveedor no aparece.
 *
 * Igual que en los términos, la línea de fondo no se mueve: las
 * condiciones comerciales las pone cada proveedor y Bookea las
 * transmite, no las garantiza.
 */
export default function PoliticasPage() {
  return (
    <PaginaLegal
      breadcrumb="Políticas"
      titulo="Políticas de la plataforma"
      actualizado="julio de 2026"
      intro={
        <>
          Acá está el «cómo funciona» de Bookea en la práctica: reservas,
          cancelaciones, pagos, publicaciones y reseñas. Estas políticas
          complementan los{" "}
          <Link
            href="/terminos"
            className="font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange"
          >
            Términos y condiciones
          </Link>{" "}
          y forman parte de ellos.
        </>
      }
    >
      <H2>Reservas</H2>
      <P>
        La reserva en Bookea es instantánea: cuando se confirman el espacio o
        servicio, la fecha y el pago, la reserva queda hecha. No hay una etapa
        de aprobación posterior salvo que el proveedor la tenga configurada así
        y lo indique en su publicación.
      </P>
      <Lista>
        <Punto>
          Los datos que se muestran —precio, capacidad, horarios,
          disponibilidad y reglas del lugar— los publica y actualiza cada
          proveedor.
        </Punto>
        <Punto>
          El cliente debe reservar con la cantidad real de personas y describir
          con honestidad la actividad. Un dato falso puede hacer que el
          proveedor rechace la entrada el día del evento.
        </Punto>
        <Punto>
          Las conversaciones y acuerdos con el proveedor conviene dejarlos en
          el chat de la Plataforma: es el respaldo de lo que se acordó.
        </Punto>
      </Lista>

      <H2>Cancelaciones y reembolsos</H2>
      <Destacado>
        Las condiciones de cancelación, reprogramación y devolución las define
        cada proveedor, no Bookea. La política aplicable es la que aparece en
        la publicación del proveedor al momento de reservar.
      </Destacado>
      <Lista>
        <Punto>
          <strong className="text-aventurea-ink">Si cancela el cliente:</strong>{" "}
          aplica la política de cancelación del proveedor. Los depósitos de
          garantía y las señales pueden no ser reembolsables si así está
          indicado.
        </Punto>
        <Punto>
          <strong className="text-aventurea-ink">
            Si cancela el proveedor:
          </strong>{" "}
          el proveedor debe devolver lo pagado por el servicio no prestado.
          Bookea puede gestionar administrativamente esa devolución y colaborar
          en encontrar una alternativa, pero no la cubre con recursos propios.
        </Punto>
        <Punto>
          <strong className="text-aventurea-ink">
            Clima, emergencias y fuerza mayor:
          </strong>{" "}
          quedan sujetos a lo que disponga la política del proveedor. Bookea no
          garantiza reembolsos por lluvia, cortes de servicios, disposiciones de
          autoridad ni hechos ajenos a su control.
        </Punto>
        <Punto>
          Las comisiones de la Plataforma y los cargos de las pasarelas de pago
          pueden no ser reembolsables, aun cuando el servicio se devuelva.
        </Punto>
      </Lista>
      <P>
        Para pedir una cancelación, lo primero es escribirle al proveedor por
        el chat de la reserva. Si no responde o no se llega a un acuerdo,
        escribinos a hola@bookea.lat y damos seguimiento en lo que esté a
        nuestro alcance.
      </P>

      <H2>Pagos y depósitos</H2>
      <Lista>
        <Punto>
          Los precios se muestran en colones. Los productos con precio en
          dólares indican su equivalente aproximado.
        </Punto>
        <Punto>
          Los pagos con tarjeta de crédito o débito los procesa Stripe, con
          soporte para Apple Pay. También se aceptan SINPE Móvil y
          transferencia bancaria.
        </Punto>
        <Punto>
          Bookea no almacena números de tarjeta: esa información la maneja
          directamente la pasarela de pago.
        </Punto>
        <Punto>
          Cuando el proveedor pide depósito de garantía, su monto, su forma de
          devolución y las causales de retención son las que él establezca.
        </Punto>
        <Punto>
          La factura electrónica del servicio la emite el proveedor. Bookea
          factura únicamente sus comisiones y sus productos propios.
        </Punto>
      </Lista>

      <H2>Publicar un negocio</H2>
      <P>
        Publicar en Bookea es gratis. Al hacerlo, el proveedor se compromete a:
      </P>
      <Lista>
        <Punto>
          Publicar información verdadera y mantenerla al día: fotos reales del
          lugar, precios vigentes, capacidad real y disponibilidad efectiva.
        </Punto>
        <Punto>
          Contar con los permisos, patentes, permisos sanitarios y pólizas que
          la ley le exija, y mantenerlos vigentes.
        </Punto>
        <Punto>
          Honrar las reservas confirmadas y responder los mensajes en un plazo
          razonable.
        </Punto>
        <Punto>
          Usar únicamente fotos y textos sobre los que tenga derechos.
        </Punto>
      </Lista>
      <P>
        Bookea puede editar, despublicar o retirar del directorio cualquier
        publicación que incumpla estas reglas, que contenga información falsa o
        que genere reclamos reiterados, sin obligación de indemnizar.
      </P>

      <H2>Reseñas y contenido</H2>
      <Lista>
        <Punto>
          Solo se reseña lo que se vivió: las reseñas deben venir de una
          experiencia real con el proveedor.
        </Punto>
        <Punto>
          No se permiten reseñas falsas, compradas, escritas por la
          competencia, ni contenido ofensivo, discriminatorio o con datos
          personales de terceros.
        </Punto>
        <Punto>
          Las reseñas son la opinión de quien las escribe. Bookea no las hace
          suyas y puede retirar las que incumplan estas reglas.
        </Punto>
      </Lista>

      <H2>Conducta en la plataforma</H2>
      <P>
        Están prohibidos el fraude, la suplantación de identidad, el acoso, el
        uso de la Plataforma para actividades ilícitas, la extracción masiva de
        datos del directorio y cualquier intento de vulnerar la seguridad del
        sistema. Bookea puede suspender o cancelar las cuentas involucradas.
      </P>
      <P>
        Un punto importante: llevar la negociación y el pago fuera de la
        Plataforma deja a ambas partes sin respaldo del chat, de la reserva y
        del comprobante — y sin ninguna posibilidad de que Bookea colabore si
        algo sale mal.
      </P>

      <H2>Invitaciones digitales</H2>
      <Lista>
        <Punto>
          Lo que incluye cada invitación depende del paquete adquirido; el
          detalle está en la página de{" "}
          <Link
            href="/invitaciones"
            className="font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange"
          >
            invitaciones digitales
          </Link>
          .
        </Punto>
        <Punto>
          El cliente entrega los datos y materiales del evento; de su exactitud
          depende el resultado. Los cambios posteriores a la entrega pueden
          tener costo adicional según el paquete.
        </Punto>
        <Punto>
          El diseño se entrega para el evento contratado. Revender la plantilla
          o reutilizarla para otro evento requiere autorización.
        </Punto>
        <Punto>
          El link permanece activo mientras dure la vigencia del paquete
          contratado.
        </Punto>
      </Lista>

      <H2>Datos personales</H2>
      <P>
        Qué datos se guardan, para qué se usan y cómo borrarlos está en la{" "}
        <Link
          href="/privacidad"
          className="font-bold text-aventurea-navy underline underline-offset-2 hover:text-aventurea-orange"
        >
          Política de privacidad
        </Link>
        .
      </P>

      <H2>Cambios y contacto</H2>
      <P>
        Estas políticas pueden actualizarse; la versión vigente siempre está en
        bookea.lat/politicas. Consultas y reclamos: hola@bookea.lat.
      </P>
    </PaginaLegal>
  );
}
