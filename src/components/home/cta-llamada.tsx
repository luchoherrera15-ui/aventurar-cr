/**
 * LA BANDA DE LLAMADA — navy, entre "Todo lo que Bookea te da" y la
 * vidriera del marketplace. Mismo número que usa /assist
 * (NEXT_PUBLIC_ASSIST_WHATSAPP): es la misma línea de ventas, no una
 * segunda a mantener sincronizada a mano.
 */
const NUMERO = process.env.NEXT_PUBLIC_ASSIST_WHATSAPP ?? "50664101184";
const NUMERO_VISIBLE = "+506 6410-1184";

export default function CtaLlamada() {
  return (
    <section className="py-16 sm:py-20" style={{ background: "var(--navy)" }}>
      <div className="mx-auto w-full max-w-[720px] px-5 text-center">
        <h2 className="titulo text-[26px] text-white sm:text-[32px]">
          ¿Querés verlo funcionando en tu negocio?
        </h2>
        <p className="mt-3 text-[15px] text-white/75">
          Coordiná una llamada con nuestro equipo, sin compromiso.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`tel:+${NUMERO}`}
            className="presionable rounded-full px-6 py-3 text-[13.5px] font-extrabold text-[color:var(--navy)]"
            style={{ background: "#ffffff" }}
          >
            ¡Agendá una llamada!
          </a>
          <a
            href={`https://wa.me/${NUMERO}`}
            target="_blank"
            rel="noreferrer"
            className="presionable rounded-full border border-white/25 px-6 py-3 text-[13.5px] font-extrabold text-white hover:bg-white/10"
          >
            Escribir por WhatsApp
          </a>
        </div>

        <p className="mt-4 text-[13px] font-bold text-white/60">{NUMERO_VISIBLE}</p>
      </div>
    </section>
  );
}
