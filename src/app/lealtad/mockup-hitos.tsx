"use client";

import { useEffect, useState } from "react";
import { useMockupVivo } from "./use-mockup-vivo";

/**
 * LA COMPOSICIÓN ANIMADA DE «LOS HITOS DEL CLIENTE» (ago 2026).
 *
 * Mismo marco de teléfono en pantalla de bloqueo que
 * `mockup-anuncios.tsx` —para que las tres franjas se lean como una
 * familia— pero acá NO hay panel a la izquierda: nadie escribe nada,
 * porque el punto de esta franja es que ESTO SALE SOLO. Lo que se ve
 * es una tira de sellos llenándose y, en los TRES momentos reales que
 * dispara `correoDelMiembro` (primer sello, penúltimo, meta), la
 * notificación correspondiente entra deslizándose.
 *
 * Tres hitos, tres textos — el mismo criterio de `sello-acreditado.ts`
 * (hitoDelSaldo): «arrancó», «te falta uno», «premio desbloqueado».
 */

const META = 8;

const HITOS: { enSaldo: number; titulo: string; texto: string; icono: string }[] = [
  { enSaldo: 1, titulo: "¡Tu tarjeta ya arrancó!", texto: "Recibiste tu primer sello. Te faltan 7 para el café gratis.", icono: "🎉" },
  { enSaldo: META - 1, titulo: "¡Te falta uno!", texto: "Con el próximo sello, el café va por la casa.", icono: "☕" },
  { enSaldo: META, titulo: "¡Premio desbloqueado!", texto: "Completaste tu tarjeta — canjeá tu café gratis cuando quieras.", icono: "🏆" },
];

type Fase = "llenando" | "notificacion" | "pausa";

export default function MockupHitos() {
  // Quieto: la tarjeta completa y el hito de la meta a la vista.
  const [saldo, setSaldo] = useState(META);
  const [hitoIndice, setHitoIndice] = useState(HITOS.length - 1);
  const [fase, setFase] = useState<Fase>("notificacion");

  // `vivo` reemplaza al viejo `animar`: preferencia de movimiento Y
  // cercanía al viewport en una sola bandera (`useMockupVivo`), así la
  // tira no se llena en el fondo mientras nadie la mira. El reset del
  // montaje sobra: el loop entra por `notificacion` —el estado
  // inicial, tarjeta llena— y `llenando` ya arranca la vuelta en cero.
  const { ref, vivo } = useMockupVivo<HTMLDivElement>();

  useEffect(() => {
    if (!vivo) return;
    let t: ReturnType<typeof setTimeout>;

    if (fase === "llenando") {
      const proximoHito = HITOS.find((h) => h.enSaldo === saldo + 1);
      if (saldo >= META) {
        t = setTimeout(() => setSaldo(0), 1600);
      } else {
        // Los tramos SIN hito avanzan rápido (es relleno); justo antes
        // de un hito, una pausa para que se note que algo va a pasar.
        // El hito se detecta ACÁ, al armar el próximo paso, para que
        // sea un solo efecto el que decide y no dos reaccionando entre
        // sí sobre el mismo `saldo`.
        t = setTimeout(() => {
          const nuevoSaldo = saldo + 1;
          const i = HITOS.findIndex((h) => h.enSaldo === nuevoSaldo);
          setSaldo(nuevoSaldo);
          if (i >= 0) {
            setHitoIndice(i);
            setFase("notificacion");
          }
        }, proximoHito ? 260 : 480);
      }
    } else if (fase === "notificacion") {
      t = setTimeout(() => setFase("pausa"), 3600);
    } else {
      t = setTimeout(() => setFase("llenando"), 500);
    }
    return () => clearTimeout(t);
  }, [vivo, fase, saldo]);

  const hito = HITOS[hitoIndice];
  const notificacionVisible = fase === "notificacion";

  return (
    /* ⚠️ EL `aria-hidden` ESTABA EN ESTE DIV, O SEA ENVOLVIENDO AL
       PROPIO `sr-only`. Un `aria-hidden` esconde el subárbol ENTERO,
       así que el párrafo que explica la demostración NO le llegaba a
       nadie: quien no ve la pantalla se encontraba con un hueco mudo.

       Es exactamente el mismo bug que ya se había encontrado y
       corregido en `mockup-cercania.tsx` —ver el comentario largo de
       ese archivo—, que quedó vivo acá porque los dos mockups se
       escribieron copiando el mismo molde.

       Ahora el `aria-hidden` baja al teléfono, que es el dibujo, y el
       texto queda afuera: es lo único que ese público recibe. */
    <div ref={ref} className="flex justify-center">
      <p className="sr-only">
        Demostración: a medida que un cliente junta sellos, recibe un correo solo en tres
        momentos — el primer sello, el penúltimo y cuando completa su tarjeta.
      </p>

      <div
        aria-hidden
        className="relative h-[560px] w-[268px] rotate-[1.5deg] rounded-[46px] p-[9px] sm:h-[600px] sm:w-[287px]"
        style={{
          background: "linear-gradient(145deg,#121827,#3d4557 50%,#0c101a)",
          boxShadow: "0 45px 90px rgba(10,18,38,.28), 0 8px 25px rgba(10,18,38,.14)",
        }}
      >
        <span className="absolute left-1/2 top-[15px] z-[8] h-[23px] w-[80px] -translate-x-1/2 rounded-full bg-[#070b12]" />
        <div
          className="relative h-full overflow-hidden rounded-[38px]"
          style={{
            background:
              "radial-gradient(circle at 22% 16%, rgba(157,180,255,.35), transparent 52%)," +
              "linear-gradient(195deg,#1b2a55 0%,#31437c 52%,#7286c4 100%)",
          }}
        >
          <div className="pt-11 text-center text-white">
            <p className="text-[13px] opacity-80">🔒</p>
            <p className="mt-2 text-[13px] font-bold text-white/85">miércoles, 20 de agosto</p>
            <p className="mt-0.5 text-[52px] font-extrabold leading-none tracking-tight">9:41</p>
          </div>

          {/* La tira de sellos: se llena en vivo, no espera al hito. */}
          <div className="mx-6 mt-6 flex flex-wrap justify-center gap-[7px]">
            {Array.from({ length: META }, (_, i) => (
              <span
                key={i}
                className="h-[13px] w-[13px] rounded-full transition-all duration-300"
                style={{
                  background: i < saldo ? "var(--orange, #f39200)" : "rgba(255,255,255,.18)",
                  transform: i < saldo ? "scale(1)" : "scale(0.85)",
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] font-bold text-white/70">
            {Math.min(saldo, META)} de {META} sellos
          </p>

          {/* La notificación del hito: mismo marco que mockup-anuncios,
              con el ícono e ícono del hito que corresponde. */}
          <div
            className={`mx-3 mt-7 rounded-[18px] bg-white/95 p-3.5 transition-[transform,opacity] duration-500 ${
              notificacionVisible ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"
            }`}
            style={{ boxShadow: "0 14px 34px rgba(10,18,38,.25)" }}
          >
            <div className="flex items-start gap-2.5">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[16px]"
                style={{ background: "linear-gradient(145deg,#16295e,#0f4c9e)" }}
              >
                {hito.icono}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12.5px] font-extrabold text-[#0d1733]">Café Aurora</p>
                  <p className="shrink-0 text-[10px] font-bold text-[#8a91a4]">ahora</p>
                </div>
                <p className="mt-0.5 text-[11px] font-bold text-[#0d1733]">{hito.titulo}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-[#3a4356]">{hito.texto}</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-between px-9">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[15px]">
              🔦
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-[15px]">
              📷
            </span>
          </div>
          <span className="absolute bottom-2 left-1/2 h-[5px] w-[110px] -translate-x-1/2 rounded-full bg-white/85" />
        </div>
      </div>
    </div>
  );
}
