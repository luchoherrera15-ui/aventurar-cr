import { ImageResponse } from "next/og";

/**
 * EL LOGO DE RESPALDO DEL PASE DE ANDROID.
 *
 * Google exige un `programLogo` en la LoyaltyClass: sin él rechaza la
 * clase y el negocio se queda sin pases. Cuando el negocio todavía no
 * subió su logo, esto le dibuja uno: su inicial, blanca, sobre el
 * color de su propia tarjeta.
 *
 * Antes en ese hueco iba el logo de Bookea, y el efecto era que la
 * tarjeta de Pura Matcha se veía en el teléfono del cliente como una
 * tarjeta de Bookea. El respaldo tiene que parecerse al negocio, no a
 * nosotros.
 *
 * ── POR QUÉ ES PÚBLICA Y SIN SESIÓN ────────────────────────────────
 * La baja Google desde sus propios servidores para armar la tarjeta.
 * No hay cookie ni token que mandar. Por eso no recibe ningún id: solo
 * un nombre y un color, que es exactamente lo que se dibuja. No se
 * consulta la base, así que no hay nada que filtrar aunque alguien
 * llame la URL a mano con otro nombre.
 *
 * Es la MISMA figura que dibuja la vista previa del panel
 * (`vista-pase.tsx`, la pestaña de Google): un círculo con la inicial.
 * Si algún día cambia una, tiene que cambiar la otra — o el negocio
 * vuelve a ver una cosa al configurar y otra en el teléfono.
 */

export const runtime = "edge";

/** Un color de CSS que se pueda pintar, o el navy de la marca. */
function colorSeguro(valor: string | null): string {
  if (valor && /^#[0-9a-fA-F]{6}$/.test(valor)) return valor;
  return "#10203a";
}

/** La primera letra del nombre, en mayúscula. */
function inicial(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio === "") return "B";
  // `[...limpio]` y no `limpio[0]`: partir por índice corta a la mitad
  // los emojis y los caracteres fuera del plano básico, y un negocio
  // que se llama "🌿 Pura Matcha" terminaría con medio símbolo roto.
  return [...limpio][0].toUpperCase();
}

export async function GET(peticion: Request) {
  const url = new URL(peticion.url);
  const nombre = (url.searchParams.get("nombre") ?? "").slice(0, 80);
  const fondo = colorSeguro(url.searchParams.get("color"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: fondo,
          color: "#ffffff",
          fontSize: 300,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        {inicial(nombre)}
      </div>
    ),
    {
      // Google recorta el logo en círculo y lo muestra chiquito, pero
      // guarda el original: 512 da margen para cualquier densidad de
      // pantalla sin que pese.
      width: 512,
      height: 512,
      headers: {
        // Un año de caché: el resultado depende solo de los dos
        // parámetros de la URL. `immutable` evita que Google vuelva a
        // pedirla en cada refresco de saldo.
        //
        // ⚠️ `s-maxage` NO ES REDUNDANTE CON `max-age`. Faltaba, y esa
        // ausencia costaba caro: `max-age` es una directiva para el
        // NAVEGADOR, y el CDN de Vercel no cachea la respuesta de una
        // función sin `s-maxage`. O sea que cada vez que Google pedía
        // este logo se volvía a correr Satori + resvg para dibujar un
        // círculo con una letra — trabajo de CPU de verdad, para un
        // resultado que ya se había dibujado idéntico.
        "cache-control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    },
  );
}
