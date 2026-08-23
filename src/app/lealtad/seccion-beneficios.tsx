import { Icono, type NombreIcono } from "./panel/[id]/iconos";

/**
 * BENEFICIOS — reemplaza a la vieja lista "Para qué rubros" (pedido del
 * dueño, ago 2026: cuatro tarjetas con una mini-maqueta cada una, en
 * vez de un listado de enlaces a industrias).
 *
 * Cada mini-maqueta ilustra una función real ya construida en el sitio
 * —no un ícono suelto—: el pase editable (tarjeta-formulario.tsx), el
 * pase que se actualiza solo en el Wallet (mockup-anuncios.tsx / la
 * actualización automática de sellos), el anuncio que llega como
 * notificación (MockupAnuncios, la misma sección "Marketing" de más
 * arriba) y el panel de métricas (MockupPanelNegocio / Impacto
 * comercial). No son ilustraciones inventadas: son versiones en
 * miniatura del mismo vocabulario visual que el resto de la página, así
 * que no hace falta un componente de "maqueta grande" nuevo acá — estas
 * cuatro son deliberadamente chicas y quietas, para cerrar el
 * recorrido sin repetir las animaciones que ya se vieron arriba.
 */

const RECUADRO = "var(--accion-suave)";

function VisualTarjeta() {
  return (
    <div className="w-[136px] rounded-xl bg-white p-2.5 shadow-[0_10px_24px_-14px_rgba(22,41,94,0.35)]">
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ background: "var(--accion)" }}
        />
        <span className="h-1.5 flex-1 rounded-full bg-aventurea-cream-2" />
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: "var(--accion)", opacity: i < 4 ? 1 : 0.22 }}
          />
        ))}
      </div>
    </div>
  );
}

function VisualWallet() {
  return (
    <div
      className="relative flex h-[76px] w-[46px] flex-col items-center rounded-[16px] pt-2"
      style={{ background: "linear-gradient(165deg,#1c2d63 0%,#0e1638 100%)" }}
    >
      <span aria-hidden className="h-[3px] w-4 rounded-full bg-white/25" />
      <span
        aria-hidden
        className="mt-4 grid h-6 w-6 place-items-center rounded-full text-white"
        style={{ background: "rgba(255,255,255,.14)" }}
      >
        <Icono nombre="listo" className="h-3 w-3" />
      </span>
    </div>
  );
}

function VisualAnuncio() {
  return (
    <div className="w-[136px] rounded-xl bg-white p-2.5 shadow-[0_10px_24px_-14px_rgba(22,41,94,0.35)]">
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
          style={{ background: RECUADRO, color: "var(--accion-fuerte)" }}
        >
          <Icono nombre="campana" className="h-3 w-3" />
        </span>
        <div className="mt-0.5 flex-1">
          <span className="block h-1.5 w-full rounded-full bg-aventurea-cream-2" />
          <span className="mt-1.5 block h-1.5 w-2/3 rounded-full bg-aventurea-cream-2" />
        </div>
      </div>
    </div>
  );
}

function VisualMetricas() {
  const alturas = [14, 24, 18, 30];
  return (
    <div className="flex h-[52px] w-[112px] items-end gap-2 rounded-xl bg-white px-3 py-2 shadow-[0_10px_24px_-14px_rgba(22,41,94,0.35)]">
      {alturas.map((h, i) => (
        <span
          key={i}
          aria-hidden
          className="flex-1 rounded-full"
          style={{
            height: h,
            background: i === alturas.length - 1 ? "var(--accion)" : "var(--accion-claro)",
          }}
        />
      ))}
    </div>
  );
}

const BENEFICIOS: {
  icono: NombreIcono;
  titulo: string;
  texto: string;
  visual: () => React.ReactNode;
}[] = [
  {
    icono: "tarjeta",
    titulo: "Tu tarjeta, con tu marca",
    texto:
      "Elegís el color, el logo y cuántos sellos hacen falta para el premio: tu programa, no una plantilla genérica.",
    visual: VisualTarjeta,
  },
  {
    icono: "movil",
    titulo: "Vive en el Wallet, se actualiza sola",
    texto:
      "Cada sello y cada canje aparece al instante en el pase que tu cliente ya tiene guardado — nadie recarga nada a mano.",
    visual: VisualWallet,
  },
  {
    icono: "campana",
    titulo: "Tus avisos llegan, no se pierden",
    texto:
      "Mandás una promoción desde tu panel y cae como notificación al Wallet — no un mensaje más entre cien chats.",
    visual: VisualAnuncio,
  },
  {
    icono: "metricas",
    titulo: "Métricas reales de tu negocio",
    texto:
      "Clientes frecuentes, ventas con Bookea y premios entregados, siempre desde tu panel — sin pedirle una hoja de cálculo a nadie.",
    visual: VisualMetricas,
  },
];

export default function SeccionBeneficios() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {BENEFICIOS.map((b) => (
        <div
          key={b.titulo}
          className="group flex flex-col overflow-hidden rounded-2xl border border-aventurea-line bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accion)]/40 hover:shadow-[0_8px_24px_-16px_rgba(22,41,94,0.35)]"
        >
          <div
            aria-hidden
            className="flex h-[112px] items-center justify-center"
            style={{ background: RECUADRO }}
          >
            <b.visual />
          </div>
          <div className="flex flex-1 flex-col p-5">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-xl"
              style={{ background: RECUADRO, color: "var(--accion-fuerte)" }}
            >
              <Icono nombre={b.icono} className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[13.5px] font-extrabold leading-tight text-aventurea-navy">
              {b.titulo}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-aventurea-ink-soft">
              {b.texto}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
