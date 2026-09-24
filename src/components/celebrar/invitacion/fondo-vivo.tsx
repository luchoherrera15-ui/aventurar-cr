import type { FondoVivo as TipoFondoVivo, Intensidad, Velocidad } from "@/lib/celebrar/invitacion/esquema";

const OPACIDAD: Record<Intensidad, string> = { sutil: "0.35", media: "0.6", fuerte: "0.9" };
const DURACION: Record<Velocidad, string> = { lenta: "34s", media: "20s", rapida: "11s" };

/** Una onda de dos periodos (para el bucle sin costura: se desplaza la mitad y vuelve). */
const ONDA = "M0 120 C 240 40, 480 200, 720 120 S 1200 40, 1440 120 S 1920 200, 2160 120 S 2640 40, 2880 120 V 240 H 0 Z";

/**
 * El fondo vivo de una escena: formas grandes y lentas detrás del
 * contenido — ondas que se mecen, una aurora de manchas, un degradado
 * que se desplaza, círculos flotando, un destello que barre, líneas a la
 * deriva o una malla de color quieta. Solo transform y opacity: nada que
 * haga trabajar de más a un teléfono. Los colores salen de la paleta
 * (acento, escena, tinta) mezclados con el fondo de la escena.
 */
export default function FondoVivoCapa({
  tipo,
  intensidad,
  velocidad,
  atenuado = false,
}: {
  tipo: TipoFondoVivo;
  intensidad: Intensidad;
  velocidad: Velocidad;
  /** Sobre una foto de ambiente: a la mitad, para que la foto siga siendo la foto. */
  atenuado?: boolean;
}) {
  if (tipo === "ninguno") return null;
  const op = Number(OPACIDAD[intensidad]) * (atenuado ? 0.5 : 1);
  const estilo = { "--vivo-op": op.toFixed(3), "--vivo-t": DURACION[velocidad] } as React.CSSProperties;
  return (
    <div className={`inv-vivo inv-vivo-${tipo}`} style={estilo} aria-hidden="true">
      {tipo === "ondas" && (
        <>
          <svg className="inv-ola inv-ola-1" viewBox="0 0 2880 240" preserveAspectRatio="none"><path d={ONDA} /></svg>
          <svg className="inv-ola inv-ola-2" viewBox="0 0 2880 240" preserveAspectRatio="none"><path d={ONDA} /></svg>
          <svg className="inv-ola inv-ola-3" viewBox="0 0 2880 240" preserveAspectRatio="none"><path d={ONDA} /></svg>
        </>
      )}
      {tipo === "aurora" && (
        <>
          <span className="inv-mancha inv-mancha-1" />
          <span className="inv-mancha inv-mancha-2" />
          <span className="inv-mancha inv-mancha-3" />
        </>
      )}
      {tipo === "degradado" && <span className="inv-deg" />}
      {tipo === "circulos" &&
        Array.from({ length: 6 }, (_, i) => <span key={i} className={`inv-circulo inv-circulo-${i + 1}`} />)}
      {tipo === "destello" && <span className="inv-destello" />}
      {tipo === "lineas" && <span className="inv-lineas" />}
      {tipo === "malla" && <span className="inv-malla" />}
    </div>
  );
}
