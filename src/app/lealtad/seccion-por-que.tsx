/**
 * «¿POR QUÉ IMPLEMENTARLO?» — la primera sección después del hero.
 *
 * Pedido del dueño (31 ago 2026), con una referencia a la vista: cuatro
 * tarjetas con título, texto y una maqueta chica abajo.
 *
 * ------------------------------------------------------------------
 * QUÉ CUENTA, Y POR QUÉ NO ES LO MISMO QUE «BENEFICIOS»
 * ------------------------------------------------------------------
 * Al final de la página vive `seccion-beneficios.tsx`, que también son
 * cuatro tarjetas con maqueta. La diferencia no es de forma sino de
 * pregunta: aquella contesta QUÉ HACE el producto (tu tarjeta, el
 * Wallet, los avisos, las métricas); esta contesta POR QUÉ LE CONVIENE
 * a un dueño de negocio poner uno. Son razones de plata, no funciones.
 *
 * Si algún día las dos se sienten repetidas, la que sobra es la de
 * abajo: a esa altura la persona ya vio el producto funcionando tres
 * veces.
 *
 * ------------------------------------------------------------------
 * LAS MAQUETAS
 * ------------------------------------------------------------------
 * Mismo criterio que `seccion-beneficios`: son versiones en miniatura
 * de pantallas que EXISTEN —la tarjeta con sus sellos, la lista de
 * quién no vuelve, el pase en el Wallet, el aviso— y no ilustraciones
 * inventadas. Van quietas a propósito: la página ya tiene tres mockups
 * animados más abajo, y cuatro más compitiendo arriba cansan.
 */

const SOMBRA = "shadow-[0_10px_24px_-14px_rgba(22,41,94,0.35)]";

/** Sellos a medio llenar: la razón por la que alguien vuelve. */
function MaquetaSellos() {
  return (
    <div className={`w-[150px] rounded-xl bg-white p-3 ${SOMBRA}`}>
      <div className="flex items-center justify-between">
        <span className="h-1.5 w-14 rounded-full bg-aventurea-cream-2" />
        <span className="text-[10px] font-extrabold text-aventurea-navy">7/10</span>
      </div>
      <div className="mt-2.5 flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--accion)", opacity: i < 7 ? 1 : 0.2 }}
          />
        ))}
      </div>
      <p className="mt-2.5 text-[8.5px] font-bold text-aventurea-ink-soft">
        Te faltan 3 para tu café
      </p>
    </div>
  );
}

/** Quién dejó de venir, con los días exactos. */
function MaquetaRescate() {
  const filas = [
    { nombre: "María G.", dato: "hace 21 días", tono: "#F5C451" },
    { nombre: "Carlos M.", dato: "hace 34 días", tono: "#E8845C" },
    { nombre: "Ana R.", dato: "12 visitas", tono: "#6FCF97" },
  ];
  return (
    <div className={`w-[160px] overflow-hidden rounded-xl bg-white ${SOMBRA}`}>
      <p className="border-b border-aventurea-line px-2.5 py-1.5 text-[8px] font-extrabold uppercase tracking-[0.1em] text-aventurea-ink-soft">
        ¿Quiénes no vuelven?
      </p>
      {filas.map((f) => (
        <div key={f.nombre} className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-[8.5px] font-bold text-aventurea-ink">{f.nombre}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-[8px] text-aventurea-ink-soft">{f.dato}</span>
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: f.tono }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * LOS DOS WALLETS — los íconos de verdad.
 *
 * Salen de la lámina que pasó el dueño (`referencia/wallet.png`,
 * 1 sep 2026), recortados a `public/wallets/`. Antes acá había dos
 * SVG dibujados a mano porque en el repo solo estaban los logos de
 * Apple PAY y Google PAY, que son otro producto; con los archivos
 * buenos a mano, dibujarlos ya no tiene sentido.
 *
 * ⚠️ NO SON `<Image>` DE NEXT y es a propósito: son dos PNG de 28 KB
 *    a tamaño fijo (48 px), y el optimizador de Next agrega una
 *    petición y un srcset que acá no compran nada. `width`/`height`
 *    van igual para que el navegador reserve el espacio y la tarjeta
 *    no salte al cargar.
 */
function MaquetaWallets() {
  return (
    <div className={`flex w-[150px] items-center justify-center gap-3 rounded-xl bg-white px-3 py-6 ${SOMBRA}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG
          estático de marca a tamaño fijo; ver la nota de arriba. */}
      <img
        src="/wallets/apple-wallet.png"
        alt="Apple Wallet"
        width={48}
        height={48}
        className="h-12 w-12"
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- ídem. */}
      <img
        src="/wallets/google-wallet.png"
        alt="Google Wallet"
        width={48}
        height={48}
        className="h-12 w-12"
      />
    </div>
  );
}

/** El aviso que cae en el pase que ya guardaron. */
function MaquetaAviso() {
  return (
    <div className={`w-[160px] rounded-xl bg-white p-2.5 ${SOMBRA}`}>
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] text-[9px] font-extrabold text-white"
          style={{ background: "var(--navy)" }}
        >
          B
        </span>
        <span className="min-w-0">
          <span className="block text-[8.5px] font-extrabold text-aventurea-ink">Café Aroma</span>
          <span className="mt-0.5 block text-[8px] leading-snug text-aventurea-ink-soft">
            Miércoles de 2×1 en cualquier bebida caliente.
          </span>
        </span>
      </div>
      <p className="mt-2 text-[8.5px] font-bold uppercase tracking-[0.1em] text-aventurea-ink-soft/70">
        Llega al teléfono directo
      </p>
    </div>
  );
}

const RAZONES: { titulo: string; texto: string; visual: React.ReactNode }[] = [
  {
    titulo: "Vuelven más seguido",
    texto:
      "Una tarjeta a medio llenar es una razón para volver. El cliente ve cuánto le falta, y la próxima visita deja de ser casualidad.",
    visual: <MaquetaSellos />,
  },
  {
    titulo: "Sabés quién se está yendo",
    texto:
      "El panel te dice quién no aparece hace semanas, con los días exactos. Le podés escribir antes de perderlo, no después.",
    visual: <MaquetaRescate />,
  },
  {
    titulo: "Les llegás sin pagar pauta",
    texto:
      "Un anuncio cae como notificación en el pase que ya guardaron. No compite con cien chats ni depende de un algoritmo.",
    visual: <MaquetaAviso />,
  },
  {
    titulo: "Sin apps que instalar",
    texto:
      "Vive en Apple Wallet y Google Wallet, que ya están en el teléfono de tu cliente. Nadie descarga nada ni crea otra cuenta.",
    visual: <MaquetaWallets />,
  },
];

export default function SeccionPorQue() {
  return (
    <section id="por-que" className="scroll-mt-28 px-5 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-12">
      <div className="mx-auto w-full max-w-[1120px]">
        <p className="text-center text-[11.5px] font-extrabold uppercase tracking-[0.18em] text-aventurea-navy">
          Por qué implementarlo
        </p>
        <h2 className="titulo mx-auto mt-3 max-w-[19ch] text-center text-[34px] leading-[1.08] text-aventurea-ink sm:text-[44px]">
          No es una tarjeta bonita. Es que tu cliente{" "}
          <span className="text-aventurea-navy">vuelva</span>.
        </h2>
        <p className="mx-auto mt-4 max-w-[62ch] text-center text-[15px] leading-relaxed text-aventurea-ink-soft sm:text-[16.5px]">
          Traer a alguien que ya te conoce cuesta una fracción de lo que cuesta traer a
          alguien nuevo. Un programa de lealtad es la razón por la que elige tu local y no
          el de al lado.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {RAZONES.map((r) => (
            <article
              key={r.titulo}
              className="elevar flex flex-col rounded-[20px] border border-aventurea-line bg-white p-6 sm:p-7"
            >
              <h3 className="text-[19px] font-extrabold leading-snug text-aventurea-ink">
                {r.titulo}
              </h3>
              <p className="mt-2.5 flex-1 text-[15px] leading-relaxed text-aventurea-ink-soft">
                {r.texto}
              </p>
              {/* La maqueta va abajo y centrada: el texto es lo que se
                  lee, y esto lo confirma de un vistazo. */}
              <div
                className="mt-7 flex items-center justify-center rounded-2xl px-3 py-8"
                style={{ background: "var(--accion-suave)" }}
              >
                {r.visual}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
