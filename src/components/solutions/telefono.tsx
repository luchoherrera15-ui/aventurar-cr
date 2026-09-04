/**
 * EL MARCO DE TELÉFONO — para la vista previa y los mockups.
 *
 * Dibuja el aparato (bisel, isla, botones del canto, indicador) y le
 * hace de ventana a lo que se le meta adentro. No sabe nada de
 * Solutions: recibe `children` y los recorta.
 *
 * Es puro y sin estado, así que sirve igual en la landing (Server
 * Component) y en el panel (dentro de uno de cliente).
 *
 * El alto sale del ancho por proporción (19.5:9, el de un iPhone
 * moderno) en vez de fijarse en px: así el mismo componente entra en
 * la columna del panel y en el héroe de la landing sin dos juegos de
 * medidas que se desincronizan.
 */
export default function Telefono({
  ancho = 260,
  children,
  className = "",
  style,
}: {
  ancho?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const alto = Math.round(ancho * (19.5 / 9));
  const bisel = Math.max(3, Math.round(ancho * 0.013));
  const radio = Math.round(ancho * 0.155);

  return (
    <div className={className} style={{ width: ancho, ...style }}>
      <div
        className="relative"
        style={{
          borderRadius: radio,
          padding: bisel,
          background: "linear-gradient(160deg,#3d4351 0%,#171a22 42%,#2f343f 100%)",
          boxShadow: "0 30px 60px -22px rgba(6,12,26,.55), 0 0 0 1px rgba(255,255,255,.06)",
        }}
      >
        {/* Los botones del canto: el detalle que hace que se lea como un
            aparato y no como un rectángulo con una captura adentro. */}
        <span aria-hidden className="absolute -left-[2px] top-[17%] h-[3.5%] w-[2px] rounded-l-full" style={{ background: "#4a5060" }} />
        <span aria-hidden className="absolute -left-[2px] top-[24%] h-[6.5%] w-[2px] rounded-l-full" style={{ background: "#4a5060" }} />
        <span aria-hidden className="absolute -left-[2px] top-[32%] h-[6.5%] w-[2px] rounded-l-full" style={{ background: "#4a5060" }} />
        <span aria-hidden className="absolute -right-[2px] top-[26%] h-[10%] w-[2px] rounded-r-full" style={{ background: "#4a5060" }} />

        <div
          className="relative overflow-hidden bg-white"
          style={{ borderRadius: radio - bisel, height: alto }}
        >
          {/* La isla dinámica, encima del contenido. */}
          <span
            aria-hidden
            className="absolute left-1/2 top-[8px] z-20 -translate-x-1/2 rounded-full"
            style={{ height: Math.round(ancho * 0.082), width: Math.round(ancho * 0.30), background: "#0b0d12" }}
          />
          {/* La ventana: scroll propio y oculto — el contenido puede ser
              más alto que la pantalla, igual que en el teléfono real. */}
          <div className="h-full w-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children}
          </div>
          {/* El indicador de abajo. */}
          <span
            aria-hidden
            className="absolute bottom-[6px] left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/25"
            style={{ height: 4, width: Math.round(ancho * 0.32) }}
          />
        </div>
      </div>
    </div>
  );
}
