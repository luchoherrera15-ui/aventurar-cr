/**
 * EL MARCO DE TELÉFONO — para la vista previa y los mockups.
 *
 * Dibuja el aparato (bisel, isla, botones del canto, barra de estado,
 * indicador) y le hace de ventana a lo que se le meta adentro. No sabe
 * nada de Solutions: recibe `children` y los recorta.
 *
 * Es puro y sin estado, así que sirve igual en la landing (Server
 * Component) y en el panel (dentro de uno de cliente).
 *
 * El alto sale del ancho por PROPORCIÓN en vez de fijarse en px: así el
 * mismo componente entra en la columna del panel y en el héroe de la
 * landing sin dos juegos de medidas que se desincronizan.
 *
 * El default 2.05 es un pelo más ancho que el 19.5:9 (2.167) de un
 * iPhone moderno, y es a propósito: a los tamaños chicos del héroe la
 * proporción real se lee «super delgada» —el dueño lo marcó el 4 sep
 * 2026— porque el bisel y la isla no encogen igual que el alto.
 *
 * ── LO QUE LO HACE PARECER UN TELÉFONO ──────────────────────────────
 * No es el rectángulo redondeado: eso lo tiene cualquier caja. Son
 * cuatro cosas chicas, y la primera es la que más pesa:
 *
 *   1. LA BARRA DE ESTADO (hora, señal, wifi, batería). Sin ella el
 *      dibujo se lee como una tarjeta; con ella, como una captura.
 *   2. El bisel con brillo: un borde interior claro sobre el marco
 *      oscuro imita el canto de metal tomando luz.
 *   3. El reflejo diagonal sobre el vidrio, muy tenue.
 *   4. Los botones del canto, que rompen la silueta perfecta.
 *
 * La barra hereda el color por `tinta`: sobre una pantalla clara los
 * glifos blancos desaparecen.
 */
export default function Telefono({
  ancho = 260,
  proporcion = 2.05,
  tinta,
  barraEstado = true,
  children,
  className = "",
  style,
}: {
  ancho?: number;
  /** Alto = ancho × proporción. 2.167 = 19.5:9 exacto. */
  proporcion?: number;
  /** Color de los glifos de la barra de estado. Ausente = blanco. */
  tinta?: string;
  barraEstado?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const alto = Math.round(ancho * proporcion);
  const bisel = Math.max(4, Math.round(ancho * 0.017));
  const radio = Math.round(ancho * 0.155);
  const color = tinta ?? "#ffffff";
  const altoIsla = Math.round(ancho * 0.082);

  return (
    <div className={className} style={{ width: ancho, ...style }}>
      <div
        className="relative"
        style={{
          borderRadius: radio,
          padding: bisel,
          background: "linear-gradient(155deg,#5b6273 0%,#20242e 30%,#171a22 60%,#3a404e 100%)",
          boxShadow:
            "0 34px 64px -24px rgba(6,12,26,.6), 0 2px 6px rgba(6,12,26,.35), inset 0 0 0 1px rgba(255,255,255,.14)",
        }}
      >
        {/* Los botones del canto: rompen la silueta y es lo que separa
            «rectángulo redondeado» de «aparato». */}
        <span aria-hidden className="absolute -left-[2.5px] top-[16%] w-[2.5px] rounded-l-full" style={{ height: "3.2%", background: "#59606f" }} />
        <span aria-hidden className="absolute -left-[2.5px] top-[23%] w-[2.5px] rounded-l-full" style={{ height: "6.5%", background: "#59606f" }} />
        <span aria-hidden className="absolute -left-[2.5px] top-[31.5%] w-[2.5px] rounded-l-full" style={{ height: "6.5%", background: "#59606f" }} />
        <span aria-hidden className="absolute -right-[2.5px] top-[25%] w-[2.5px] rounded-r-full" style={{ height: "10%", background: "#59606f" }} />

        <div
          className="relative overflow-hidden bg-white"
          style={{ borderRadius: radio - bisel, height: alto }}
        >
          {/* La ventana: scroll propio y oculto — el contenido puede ser
              más alto que la pantalla, igual que en el teléfono real. */}
          <div className="h-full w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>

          {/* ── La barra de estado, encima de todo ──────────────────
              `pointer-events-none`: es decoración, no debe comerse un
              clic del contenido que tiene debajo. */}
          {barraEstado && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-[7%]"
              style={{ height: altoIsla + Math.round(ancho * 0.03), color }}
            >
              <span
                className="font-semibold tabular-nums"
                style={{ fontSize: Math.max(8, Math.round(ancho * 0.043)) }}
              >
                9:41
              </span>
              <span className="flex items-center" style={{ gap: Math.round(ancho * 0.014) }}>
                {/* Señal: cuatro barras crecientes. */}
                <svg viewBox="0 0 18 12" fill="currentColor" style={{ height: Math.round(ancho * 0.038) }}>
                  <rect x="0" y="8.5" width="3" height="3.5" rx="1" />
                  <rect x="5" y="6" width="3" height="6" rx="1" />
                  <rect x="10" y="3" width="3" height="9" rx="1" />
                  <rect x="15" y="0" width="3" height="12" rx="1" />
                </svg>
                {/* Wifi */}
                <svg viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" style={{ height: Math.round(ancho * 0.038) }}>
                  <path d="M1 4.2a10 10 0 0 1 14 0" />
                  <path d="M3.6 7a6.4 6.4 0 0 1 8.8 0" />
                  <path d="M6.3 9.7a2.6 2.6 0 0 1 3.4 0" />
                </svg>
                {/* Batería */}
                <svg viewBox="0 0 26 12" fill="none" style={{ height: Math.round(ancho * 0.04) }}>
                  <rect x="0.6" y="0.6" width="21" height="10.8" rx="3" stroke="currentColor" strokeWidth={1.2} opacity={0.6} />
                  <rect x="2.4" y="2.4" width="15" height="7.2" rx="1.8" fill="currentColor" />
                  <path d="M23.6 4.2v3.6a2.2 2.2 0 0 0 0-3.6Z" fill="currentColor" opacity={0.6} />
                </svg>
              </span>
            </div>
          )}

          {/* La isla dinámica, encima de la barra. */}
          <span
            aria-hidden
            className="absolute left-1/2 z-30 -translate-x-1/2 rounded-full"
            style={{
              top: Math.round(ancho * 0.032),
              height: altoIsla,
              width: Math.round(ancho * 0.3),
              background: "#0b0d12",
            }}
          />

          {/* El reflejo del vidrio: una diagonal muy tenue. Sin esto la
              pantalla se ve «plana como una imagen». */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              background:
                "linear-gradient(112deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 18%, transparent 42%)",
            }}
          />

          {/* El indicador de abajo. */}
          <span
            aria-hidden
            className="absolute bottom-[6px] left-1/2 z-30 -translate-x-1/2 rounded-full"
            style={{ height: 4, width: Math.round(ancho * 0.32), background: color, opacity: 0.45 }}
          />
        </div>
      </div>
    </div>
  );
}
