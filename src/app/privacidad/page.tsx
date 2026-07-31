import type { Metadata } from "next";
import PaginaLegal, { H2, P } from "@/components/pagina-legal";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos guarda Bookea, para qué se usan y cómo podés borrarlos.",
};

/**
 * La política de privacidad, en cristiano. Existe además porque App
 * Store y Google Play exigen una URL pública de privacidad para
 * aprobar la app — esta es la que se pone en App Store Connect.
 *
 * El andamiaje (header, columna, pie) es el mismo de /terminos y
 * /politicas y vive en PaginaLegal.
 */
export default function PrivacidadPage() {
  return (
    <PaginaLegal
      breadcrumb="Privacidad"
      titulo="Política de privacidad"
      actualizado="julio de 2026"
      intro={
        <>
          Esta política aplica al sitio bookea.lat y a la aplicación móvil de
          Bookea. La idea es simple: guardamos lo mínimo necesario para que
          puedas reservar y para que los proveedores puedan atenderte, y nada
          más.
        </>
      }
    >
      <H2>Qué datos guardamos</H2>
      <P>
        <strong className="text-aventurea-ink">Tu cuenta:</strong> correo
        electrónico y el nombre que vos elijás. Entrás con un código de un
        solo uso al correo — no guardamos contraseñas.
      </P>
      <P>
        <strong className="text-aventurea-ink">Tus reservas:</strong> la
        fecha, el tipo de evento, la cantidad de invitados, las notas que
        escribás y, si el proveedor pide depósito, el comprobante de pago que
        subás. El número de cédula, cuando se pide, se usa únicamente para
        identificar a quien reserva en caso de daños durante el evento (Ley
        8968 de protección de datos) y solo lo ven el proveedor y el equipo
        de Bookea.
      </P>
      <P>
        <strong className="text-aventurea-ink">Tus mensajes:</strong> los
        chats con proveedores viven en la plataforma para que la negociación
        quede en un solo lugar.
      </P>
      <P>
        <strong className="text-aventurea-ink">Si publicás un negocio:</strong>{" "}
        los datos y fotos del negocio que vos mismo cargués, incluidas las
        fotos que subás desde tu teléfono. La app solo accede a las fotos que
        vos elijás — nunca recorre tu galería.
      </P>

      <H2>Para qué se usan</H2>
      <P>
        Para operar el servicio: mostrar tu reserva al proveedor, abrir el
        chat entre ambos, mandarte correos de confirmación y recordatorio, y
        mostrar públicamente los negocios publicados. No vendemos ni
        compartimos tus datos con terceros para publicidad.
      </P>

      <H2>Dónde viven</H2>
      <P>
        La base de datos y los archivos se alojan en Supabase, y los correos
        se envían con Resend. Ambos proveedores cifran los datos en tránsito
        y en reposo.
      </P>

      <H2>Borrar tu cuenta y tus datos</H2>
      <P>
        Desde la app: Perfil → “Eliminar mi cuenta”. Se borran tu perfil, tus
        favoritos, tus reseñas, tus chats y tus negocios publicados de forma
        permanente. Las reservas que hiciste quedan en el historial del
        negocio que las recibió, pero sin conexión con tu cuenta. También
        podés pedirlo escribiendo a hola@bookea.lat.
      </P>

      <H2>Contacto</H2>
      <P>
        Cualquier consulta sobre tus datos: hola@bookea.lat. Esta política
        puede actualizarse; la versión vigente siempre está en
        bookea.lat/privacidad.
      </P>
    </PaginaLegal>
  );
}
