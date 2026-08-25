/** BANDA 10 — FOOTER. */

import Link from "next/link";
import { SITIO } from "@/lib/sitio";
import estilos from "./assist.module.css";

export default function Pie() {
  return (
    <footer className={estilos.pie}>
      <div className={estilos.pieInner}>
        <div>
          <p className={estilos.pieMarca}>Bookea Assist</p>
          <p className={estilos.pieTexto}>El WhatsApp de tu negocio, atendido solo.</p>
        </div>
        <div className={estilos.pieLinks}>
          <Link href="/" className={estilos.pieLink}>
            Un producto de Bookea ↗
          </Link>
        </div>
      </div>
      <p className={estilos.pieCopy}>
        © {new Date().getFullYear()} {new URL(SITIO).hostname.replace(/^www\./, "")}
      </p>
    </footer>
  );
}
