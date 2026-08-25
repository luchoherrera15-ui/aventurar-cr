"use client";

/** BANDA 8 — QUÉ TRAE (claro). Grilla de 6 tarjetas de features, con
 *  reveal escalonado por índice. */

import { useRef } from "react";
import { useRevelar } from "./motor";
import estilos from "./assist.module.css";

function trazoIcono(d: string) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={estilos.featIconoSvg}>
      <path d={d} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CARACTERISTICAS = [
  {
    titulo: "Lee tu agenda real",
    texto: "Nunca ofrece una hora ocupada: consulta la disponibilidad real de tu negocio en Bookea antes de contestar.",
    icono: trazoIcono("M4 5h16M4 5v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5M8 3v4M16 3v4M8 13h3"),
  },
  {
    titulo: "Agenda sola",
    texto: "Crea la reserva directo en tu agenda de Bookea, sin que vos tengas que tocar nada.",
    icono: trazoIcono("M5 13l4 4L19 7"),
  },
  {
    titulo: "Tu tono de voz",
    texto: "Elegís cómo habla — cercano, neutral o formal — y se mantiene así en cada conversación.",
    icono: trazoIcono("M8 10h8M8 14h5M21 12a9 9 0 1 1-4.2-7.6L21 3v9Z"),
  },
  {
    titulo: "Responde precios y dudas",
    texto: "Contesta las preguntas de siempre — precios, horarios, servicios — sin que se le olvide nada.",
    icono: trazoIcono("M7 8h10M7 12h6M12 21c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8c0 1.4-.4 2.7-1 3.8L21 21l-4.3-1.1c-1.1.7-2.4 1.1-3.7 1.1Z"),
  },
  {
    titulo: "Nunca duerme",
    texto: "Contesta a las 11pm, en un feriado, o mientras estás ocupado con un cliente en el local.",
    icono: trazoIcono("M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"),
  },
  {
    titulo: "Vos seguís al mando",
    texto: "Entrás a cualquier conversación cuando querés — el bot no reemplaza, acompaña.",
    icono: trazoIcono("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0"),
  },
];

export default function Caracteristicas() {
  return (
    <section className={estilos.caracteristicas}>
      <div className={estilos.contenedor}>
        <div className={estilos.caracteristicasCabecera}>
          <p className={estilos.kickerClaro}>Qué trae</p>
          <h2 className={`${estilos.d2} ${estilos.tituloClaro}`}>Lo que necesita un WhatsApp de negocio.</h2>
        </div>
        <div className={estilos.featGrilla}>
          {CARACTERISTICAS.map((f, i) => (
            <TarjetaCaracteristica key={f.titulo} indice={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TarjetaCaracteristica({
  titulo,
  texto,
  icono,
  indice,
}: {
  titulo: string;
  texto: string;
  icono: React.ReactNode;
  indice: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const revelar = useRevelar(ref, indice);
  return (
    <div
      ref={ref}
      style={revelar.style}
      className={`${estilos.revelar} ${revelar.visible ? estilos.revelarVisible : ""} ${estilos.featTarjeta}`}
    >
      <span className={estilos.featIcono}>{icono}</span>
      <h3 className={estilos.featTitulo}>{titulo}</h3>
      <p className={estilos.featTexto}>{texto}</p>
    </div>
  );
}
