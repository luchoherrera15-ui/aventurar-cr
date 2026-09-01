import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA IMAGEN QUE SE VE AL COMPARTIR UN LINK DE BOOKEA
 * ════════════════════════════════════════════════════════════════════
 *
 * Next la detecta por convención de nombre y la enchufa sola en
 * `openGraph.images` de TODA ruta que no traiga la suya. No hay que
 * declararla a mano en `metadata`.
 *
 * ── LA B Y UNA SOLA FRASE (1 sep 2026) ──────────────────────────────
 *
 * Pedido del dueño: «al enviar un link salen unas tonteras de info» y
 * después, en concreto: la letra B del logo y «Plataforma que te brinda
 * soluciones digitales».
 *
 * Acá había una tarjeta con titular grande, bajada, halo naranja y el
 * dominio abajo: «¿Necesitás un servicio? Mirá la lista completa de
 * locales…». Tenía sentido cuando lo que se compartía era el
 * marketplace. Hoy los links que circulan son de Lealtad, de una
 * tarjeta o de un panel, y ese titular los describía a todos igual —o
 * sea, mal—: la previa de `/tarjeta/x` decía «mirá la lista de
 * locales», que no es lo que hay del otro lado.
 *
 * Una frase que vale para toda la plataforma no puede describir mal
 * ninguna página.
 *
 * ── EL LOGO ES EL ARCHIVO, NO UN PARECIDO ───────────────────────────
 *
 * La versión anterior dibujaba una «b» minúscula en un cuadradito
 * naranja hecho con CSS. Acá se lee `public/logo-b-bookea.png`, que es
 * el tile recortado del logo oficial (`logo-bookea-v4.png`), y se
 * incrusta como data URI: se lee UNA vez, en el build.
 *
 * ── POR QUÉ NO VA `runtime = "edge"` ────────────────────────────────
 *
 * Una ruta de metadata en edge no se prerenderiza: Next la compila como
 * función y la ejecuta EN CADA PETICIÓN, y `ImageResponse` monta Satori,
 * arma un SVG y lo rasteriza. Medido en Vercel: 135 invocaciones en 12
 * horas a ~444 ms de CPU cada una — un minuto entero de CPU para
 * dibujar una imagen que nunca cambia.
 *
 * En Node, Next la prerenderiza en el build y después sale del CDN.
 * Cero invocaciones. Y `readFileSync` solo funciona de este lado.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/** El `alt` dice lo que se DIBUJA: lo lee quien usa lector de pantalla. */
export const alt = "Bookea — Plataforma que te brinda soluciones digitales";

/**
 * El logo, leído del disco en el build.
 *
 * A nivel de módulo a propósito: corre una sola vez cuando Next
 * prerenderiza, no una por render. `process.cwd()` es la raíz del
 * proyecto durante el build, que es donde vive `public/`.
 */
const LOGO_B = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "logo-b-bookea.png"),
).toString("base64")}`;

const NAVY = "#031b4e";

export default function ImagenOg() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
          // Blanco: el logo ES navy, así que sobre navy desaparecería.
          // Y en la burbuja de WhatsApp, que ya tiene su propio fondo,
          // el blanco recorta limpio.
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori
            solo entiende <img>; acá no hay DOM ni next/image. */}
        <img src={LOGO_B} width={210} height={200} alt="" />

        {/* Una sola línea y centrada. `maxWidth` para que no se estire
            de borde a borde: cuando WhatsApp recorta la previa, lo
            primero que pierde son los extremos. */}
        <div
          style={{
            display: "flex",
            // 40px contra 1040 de ancho: la frase entra en UNA línea.
            // A 46 se partía y dejaba «digitales» solo en el segundo
            // renglón, que en una previa chica se lee como un error.
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: -0.8,
            color: NAVY,
            maxWidth: 1040,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          Plataforma que te brinda soluciones digitales
        </div>
      </div>
    ),
    size,
  );
}
