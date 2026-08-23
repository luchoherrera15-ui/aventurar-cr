"use client";

import { useEffect, useState } from "react";

/**
 * El configurador embebido en la landing arranca OCULTO —ni se
 * monta— y recién aparece cuando algún <BotonCrearPase> dispara este
 * evento (pedido del dueño, ago 2026: "Elegí tu paquete" no puede ser
 * lo primero que ve alguien que todavía no pidió crear nada).
 *
 * También se revela solo si la URL ya trae el ancla al cargar: es el
 * caso de quien vuelve del correo de verificación a medio armar su
 * tarjeta (`tarjeta-formulario.tsx`, `FormularioAuth destino={ANCLA}`
 * = "/lealtad#configurador-lealtad") — sin esto, ese enlace aterrizaría
 * en una landing sin nada que mostrar.
 */
export const EVENTO_MOSTRAR_CONFIGURADOR = "bookea:mostrar-configurador";
const ID_ANCLA = "configurador-lealtad";

export default function RevelarConfigurador({
  children,
}: {
  children: React.ReactNode;
}) {
  const [revelado, setRevelado] = useState(false);

  useEffect(() => {
    if (window.location.hash === `#${ID_ANCLA}`) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lee window.location una sola vez al montar, no hay forma de saberlo durante el render del servidor
      setRevelado(true);
      return;
    }
    const mostrar = () => setRevelado(true);
    window.addEventListener(EVENTO_MOSTRAR_CONFIGURADOR, mostrar);
    return () => window.removeEventListener(EVENTO_MOSTRAR_CONFIGURADOR, mostrar);
  }, []);

  useEffect(() => {
    if (!revelado) return;
    document.getElementById(ID_ANCLA)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [revelado]);

  if (!revelado) return null;
  return <>{children}</>;
}
