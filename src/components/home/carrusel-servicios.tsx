/**
 * "TODO LO QUE BOOKEA TE DA" — las 4 herramientas, en tarjetas
 * numeradas, cada una con el mockup de teléfono de su propio producto
 * (antes vivían en el héroe, en un desfile continuo — el dueño pidió
 * separarlos y ponerlos acá, uno por card, con su info breve al lado).
 *
 * No es realmente un carrusel (el nombre lo hereda del pedido
 * original) — es una grilla estática de 4 cards. Sigue sin "use
 * client" PROPIO: los mockups animados que renderiza ya lo llevan
 * ellos (`carrusel-hero-servicios.tsx`), y un Server Component puede
 * montar un Client Component como hijo sin volverse cliente él mismo.
 */

import {
  MockupWalletTelefono,
  MockupWhatsApp,
  MockupInvitacion,
  MockupMapa,
} from "./carrusel-hero-servicios";

type Servicio = {
  numero: string;
  titulo: string;
  descripcion: string;
  Mockup: React.ComponentType<{ activo: boolean; mostrarFlotante?: boolean }>;
};

const SERVICIOS: Servicio[] = [
  {
    numero: "01",
    titulo: "Pases de lealtad",
    descripcion:
      "Sellos, puntos y membresías en Apple Wallet y Google Wallet. Tus clientes vuelven porque ya tienen la tarjeta encima.",
    Mockup: MockupWalletTelefono,
  },
  {
    numero: "02",
    titulo: "Automatizaciones",
    descripcion:
      "Un asistente que contesta tu WhatsApp las 24 horas, revisa tu agenda real y agenda la cita solo.",
    Mockup: MockupWhatsApp,
  },
  {
    numero: "03",
    titulo: "Marketplace",
    descripcion:
      "Reservas de espacios y servicios, directo — sin cadenas de mensajes ni ida y vuelta para coordinar.",
    Mockup: MockupMapa,
  },
  {
    numero: "04",
    titulo: "Invitaciones digitales",
    descripcion:
      "Invitaciones con diseño propio y confirmación de asistencia, listas para compartir por WhatsApp.",
    Mockup: MockupInvitacion,
  },
];

export default function CarruselServicios() {
  return (
    <section className="bg-[#f5f7fa] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1200px] px-4 text-center lg:px-6">
        <h2 className="titulo text-[26px] text-[color:var(--navy)] sm:text-[34px]">
          Todo lo que Bookea te da.
        </h2>
        <p className="mx-auto mt-2 max-w-[52ch] text-[15px] text-aventurea-ink-soft">
          Cuatro herramientas conectadas entre sí, para conseguir clientes y hacerlos volver.
        </p>
      </div>

      <div className="mx-auto mt-10 w-full max-w-[1200px] px-4 lg:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICIOS.map((s) => (
            <div
              key={s.numero}
              className="flex flex-col items-center rounded-2xl border border-aventurea-line bg-white p-5 text-center"
            >
              <span className="titulo self-start text-[13px] text-[color:var(--navy)]">{s.numero}</span>

              <div className="mt-1 scale-[0.82] sm:scale-90">
                <s.Mockup activo mostrarFlotante={false} />
              </div>

              <h3 className="mt-1 text-[15px] font-extrabold text-aventurea-ink">{s.titulo}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-aventurea-ink-soft">
                {s.descripcion}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
