"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { esHostCelebrar, esRutaDeCelebrar } from "@/lib/celebrar/dominios";

// La burbuja pesa (tabs, buscador de negocios, hilos) y casi nadie la
// abre en la primera visita: se carga aparte y solo en el navegador.
const ChatFlotante = dynamic(() => import("./chat-flotante"), { ssr: false });

/**
 * La burbuja de mensajes es de BOOKEA. Dentro de CELEBRAR (`/celebrar/…`
 * hoy, `celebrar.lat` mañana) no se monta: el producto tiene su propia
 * marca y su propia navegación, y una burbuja del marketplace flotando
 * sobre una invitación de boda rompe esa independencia (decisión del
 * dueño, sep 2026 — ver docs/celebrar/audit.md, riesgo R-5).
 *
 * Se decide acá, en el envoltorio, y no dentro de `chat-flotante.tsx`:
 * así el componente grande no se toca y el criterio queda en un solo
 * lugar. `esHostCelebrar` cubre el dominio propio, donde la ruta del
 * navegador ya no lleva el prefijo.
 */
export default function ChatFlotanteLazy() {
  const pathname = usePathname() ?? "";
  const enCelebrar =
    esRutaDeCelebrar(pathname) ||
    (typeof window !== "undefined" && esHostCelebrar(window.location.hostname));
  if (enCelebrar) return null;
  return <ChatFlotante />;
}
