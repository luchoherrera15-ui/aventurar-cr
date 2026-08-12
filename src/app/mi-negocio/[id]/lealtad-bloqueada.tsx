import Link from "next/link";

/**
 * Lo que ve un negocio SIN el complemento de lealtad al abrir la
 * pestaña. Antes la pestaña directamente no existía — y un producto
 * que solo se ve cuando ya se compró no lo compra nadie. Además,
 * esconderla en silencio hacía imposible saber si era un bug o una
 * decisión.
 *
 * La activación sigue siendo de Bookea (addons_negocio es solo-servidor
 * desde la 0077): esta pantalla no vende sola, dirige.
 */
export default function LealtadBloqueada() {
  return (
    <div className="rounded-2xl border border-aventurea-line bg-aventurea-surface p-8 text-center">
      <p className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-aventurea-navy/10 text-[26px]">
        🎟️
      </p>
      <h3 className="mt-4 text-[17px] font-bold text-aventurea-ink">
        Tu programa de lealtad, listo para encender
      </h3>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-aventurea-ink-soft">
        Sellos y puntos con la tarjeta de tu negocio en el Wallet del cliente: se
        actualiza sola en su teléfono, le avisa cuánto le falta, y vos sumás sellos
        escaneando con la cámara. Este módulo se activa con Bookea.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/lealtad"
          className="rounded-full bg-aventurea-navy px-6 py-3 text-[13.5px] font-bold text-white"
        >
          Ver cómo funciona y precios
        </Link>
        <a
          href="mailto:luchoherrera15@gmail.com?subject=Quiero%20el%20programa%20de%20lealtad"
          className="rounded-full border border-aventurea-line bg-white px-6 py-3 text-[13.5px] font-bold text-aventurea-ink"
        >
          Pedir activación
        </a>
      </div>
    </div>
  );
}
