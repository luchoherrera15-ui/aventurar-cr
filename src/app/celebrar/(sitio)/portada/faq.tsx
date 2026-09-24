const PREGUNTAS = [
  {
    q: "¿Mis invitados necesitan instalar algo o crear una cuenta?",
    a: "No. Abren el link en el navegador del teléfono, confirman y suben fotos sin registrarse. Solo la persona que organiza tiene cuenta.",
  },
  {
    q: "¿Cómo se comparte la invitación?",
    a: "Con un link propio y un código QR. El link lleva una previa con la portada para que se vea bien en WhatsApp; el QR se imprime en la tarjeta física o en el cartel de bienvenida.",
  },
  {
    q: "¿Cuánto cuesta y cómo se paga?",
    a: "La invitación de plantilla cuesta ₡7 500 y la diseñada a medida por nuestro equipo ₡10 500. Es un solo pago por invitación, con tarjeta, Apple Pay o Google Pay (o SINPE Móvil si nos escribís). Despublicar y volver a publicar no cobra de nuevo.",
  },
  {
    q: "¿Puedo empezar sin pagar?",
    a: "Sí. Podés crear tu celebración, elegir cualquier plantilla, editarla completa y verla en vista previa sin pagar nada. Pagás recién al publicarla para compartir el link.",
  },
  {
    q: "¿Qué pasa con la página después del evento?",
    a: "La misma dirección se convierte en la página de recuerdos, con las fotos del álbum, los mensajes y el video. Se mantiene activa un tiempo después de la fecha y se puede renovar.",
  },
  {
    q: "¿Quién ve las fotos que suben los invitados?",
    a: "Vos decidís: podés aprobar cada foto antes de que se publique, y elegir si el álbum es público con el link, con un código o solo para vos.",
  },
];

/**
 * Preguntas frecuentes con `<details>` nativo: cero JS, accesible, y el
 * cambio de altura lo maneja el navegador. Las respuestas describen el
 * producto tal como está diseñado; no prometen precios ni plazos.
 */
export default function Faq() {
  return (
    <section
      id="preguntas"
      aria-labelledby="faq-titulo"
      className="scroll-mt-20 bg-(--c-hielo) py-16 lg:py-24"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
        <div>
          <p className="c-pastilla">Preguntas frecuentes</p>
          <h2 id="faq-titulo" className="mt-4 text-[clamp(1.75rem,3.4vw,2.6rem)] leading-[1.1] text-(--c-tinta)">
            Lo que más nos preguntan
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-(--c-tinta-suave)">
            Si algo no está acá, escribinos desde tu panel y te respondemos.
          </p>
        </div>
        <div className="grid gap-3">
          {PREGUNTAS.map((p) => (
            <details key={p.q} className="c-tarjeta group px-6 py-1">
              <summary className="c-montserrat flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-(--c-tinta) [&::-webkit-details-marker]:hidden">
                {p.q}
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 shrink-0 text-(--c-azul) transition-transform duration-(--duracion-micro) ease-(--ease-bookea) group-open:rotate-45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-(--c-tinta-suave)">{p.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
