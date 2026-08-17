import Link from "next/link";
import { tipoDe, TIPOS_TARJETA, type TipoTarjeta } from "@/lib/lealtad/tipos-tarjeta";

/**
 * «Solicitá tu tarjeta en tu próxima visita» — en la página pública
 * del negocio, para el cliente.
 *
 * Solo aparece si el negocio TIENE el programa activo. No es una
 * promesa de marketing: si sale, la tarjeta existe y se puede pedir.
 *
 * ------------------------------------------------------------------
 * EL TEXTO CAMBIA SEGÚN EL TIPO DE PASE
 * ------------------------------------------------------------------
 * Una barbería de sellos y un súper de cashback no ofrecen lo mismo, y
 * decirle «tarjeta de promociones» a los dos desperdicia la parte que
 * convence. Si son sellos, se dice cuántos y qué se gana; si es
 * cashback, cuánto vuelve. El dato concreto es el que hace que alguien
 * la pida.
 */

const TEXTO: Record<TipoTarjeta, { gancho: string; sub: string }> = {
  sellos: {
    gancho: "Sumá sellos en cada visita",
    sub: "Completalos y tu premio va por la casa.",
  },
  puntos: {
    gancho: "Sumá puntos en cada visita",
    sub: "Se acumulan solos y los canjeás cuando querás.",
  },
  cashback: {
    gancho: "Te devolvemos parte de lo que gastás",
    sub: "El saldo queda en tu tarjeta para tu próxima visita.",
  },
  cupon: {
    gancho: "Llevate nuestros cupones en el teléfono",
    sub: "Te avisamos cuando haya uno nuevo para vos.",
  },
  descuento: {
    gancho: "Accedé a nuestros descuentos de cliente",
    sub: "Con tu tarjeta, el descuento se aplica solo.",
  },
  membresia: {
    gancho: "Hacete socio",
    sub: "Tu carnet vive en el teléfono, con tus beneficios a la vista.",
  },
  giftcard: {
    gancho: "Regalá una gift card",
    sub: "Se guarda en el Wallet de quien la recibe, lista para usarse.",
  },
  evento: {
    gancho: "Guardá tu entrada en el teléfono",
    sub: "Con la fecha, el lugar y el código para entrar.",
  },
};

export default function TarjetaLealtad({
  slug,
  negocio,
  modo,
  /** La recompensa activa más barata: la meta de la tarjeta. */
  meta,
}: {
  slug: string;
  negocio: string;
  modo: string | null;
  meta: { nombre: string; costo: number } | null;
}) {
  const tipo = tipoDe(modo);
  const t = TEXTO[tipo];
  const def = TIPOS_TARJETA[tipo];

  // Con meta y en modo sellos, la frase concreta gana: «10 sellos y el
  // café va» convence más que «completá tu tarjeta».
  const promesa =
    tipo === "sellos" && meta
      ? `${meta.costo} sellos y ${meta.nombre.toLowerCase()}`
      : meta
        ? meta.nombre
        : def.descripcion;

  return (
    <section className="mt-9">
      <div
        className="overflow-hidden rounded-3xl border"
        style={{ borderColor: "rgba(6,38,83,.14)", background: "#062653" }}
      >
        <div className="flex flex-wrap items-center gap-6 p-6 sm:p-7">
          <div className="min-w-[220px] flex-1">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "#ffb076" }}
            >
              Programa de {negocio}
            </p>
            <h2 className="mt-2 text-[22px] font-extrabold leading-tight text-white sm:text-[25px]">
              {t.gancho}
            </h2>
            <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-white/65">
              {t.sub} Se guarda en tu Apple Wallet o Google Wallet — sin instalar ninguna
              aplicación.
            </p>

            <p className="mt-4 inline-block rounded-full bg-white/10 px-3.5 py-1.5 text-[12.5px] font-bold text-white">
              {promesa}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                href={`/tarjeta/${slug}`}
                className="presionable rounded-full px-5 py-3 text-[13.5px] font-extrabold"
                // Azul de acción sobre oscuro + letra navy: los valores
                // de `--accion-claro`/`--accion-claro-tinta` del scope
                // .lealtad, escritos como literales porque este bloque
                // vive en una ruta del marketplace, fuera de ese scope.
                // Antes era relleno naranja con letra azul — la regla
                // vieja, cuando la acción era naranja. 9,23:1.
                style={{ background: "#9db4ff", color: "#0a1226" }}
              >
                Solicitar mi tarjeta →
              </Link>
              <span className="self-center text-[12.5px] text-white/55">
                Gratis · en tu próxima visita
              </span>
            </div>
          </div>

          {/* La tarjeta, chiquita. Es una maqueta: lo que el cliente
              recibe de verdad lo dibuja Apple o Google con los colores
              que el negocio configuró. */}
          <div
            className="mx-auto w-[172px] shrink-0 overflow-hidden rounded-2xl sm:mx-0"
            style={{ background: "rgba(255,255,255,.08)" }}
            aria-hidden
          >
            <div className="px-3.5 pb-3 pt-3.5">
              <p className="truncate text-[10px] font-medium text-white/80">{negocio}</p>
              <p className="mt-2.5 text-[7.5px] uppercase tracking-[0.18em] text-white/60">
                {tipo === "sellos" ? "SELLOS" : tipo === "cashback" ? "SALDO" : "TU TARJETA"}
              </p>
              <p className="text-[19px] font-extrabold leading-none text-white">
                {tipo === "sellos" && meta ? `0/${meta.costo}` : def.nombre}
              </p>

              {tipo === "sellos" && meta && (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {Array.from({ length: Math.min(meta.costo, 12) }, (_, i) => (
                    <span
                      key={i}
                      className="h-3 w-3 rounded-full"
                      // Los sellos SÍ se quedan naranjas: son el acento
                      // de marca, la pieza chica. Con el naranja real
                      // del logotipo (#f39200), no el retirado #FF6A00.
                      //
                      // Al 25 % daban 1,43:1 contra la tarjetita y no se
                      // veía ni que hubiera huecos. Al 45 % son 2,03:1 y
                      // ya se leen como casillas VACÍAS, que es lo que
                      // son: subirlos más los disfrazaría de sellos ya
                      // ganados y la maqueta diría una mentira. El estado
                      // de verdad lo canta el «0/N» de arriba, y el
                      // bloque entero es `aria-hidden`.
                      style={{ background: "#f39200", opacity: 0.45 }}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white px-3.5 py-2">
              <div className="mx-auto h-8 w-8 rounded bg-[#062653]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
