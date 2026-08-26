import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { dibujarTiraDeSellos } from "./imagenes";

/**
 * ════════════════════════════════════════════════════════════════════
 *  LA HUELLA DE LAS TARJETAS YA EMITIDAS
 * ════════════════════════════════════════════════════════════════════
 *
 * Hay pases instalados en teléfonos de clientes reales, y TODOS se
 * vuelven a dibujar con este código la próxima vez que su dueño gana un
 * sello. Si una pasada de trabajo mueve un píxel, la tarjeta de alguien
 * cambia de aspecto sin que nadie lo haya pedido.
 *
 * Estas 99 huellas SHA-256 se capturaron ANTES de agregar los fondos con
 * degradado (ago 2026), con la configuración clásica: 11 metas × 3
 * escalas × los tres caminos de dibujo (círculo liso, logo adentro,
 * ícono elegido).
 *
 * ⚠️ SI UNA DE ESTAS FALLA, NO SE ACTUALIZA EL NÚMERO. Se averigua qué
 * cambió. Reemplazar la huella por la nueva convierte esta prueba en un
 * sello de goma que aprueba cualquier cosa — que es exactamente lo que
 * vino a impedir.
 *
 * Cambiarlas a propósito es legítimo UNA sola vez: cuando el dueño pida
 * un cambio de aspecto para todas las tarjetas, y sabiendo que se les
 * va a empujar a todos los teléfonos.
 */

const COLORES = { fondo: "#2F4230", sello: "#D9E8C4" };

/** El mismo logo determinista con el que se capturaron las huellas. */
async function logoDePrueba(): Promise<Buffer> {
  return sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 240, g: 90, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

/** Formato: `meta|escala|camino|huella`, como se capturaron. */
const HUELLAS: readonly string[] = [
  "1|1|liso|3a505527298ade83",
  "1|1|logo|905b7a141b463330",
  "1|1|icono|2e4a1bb32af4cba1",
  "1|2|liso|a284fc537ae8daf4",
  "1|2|logo|28299ab2e49d58d9",
  "1|2|icono|2b0617aa4e43d407",
  "1|3|liso|4eed66f8f56aa255",
  "1|3|logo|7b6e8812ae3684de",
  "1|3|icono|d0ef641fd7d9b7a1",
  "3|1|liso|d671bf97ba1baec3",
  "3|1|logo|5d44d9d91adaf1eb",
  "3|1|icono|5c3bc6d090c84bff",
  "3|2|liso|28a256dc9799fc14",
  "3|2|logo|91b0be8b3063ac4a",
  "3|2|icono|8178bda7da9d2eda",
  "3|3|liso|dc39e8c625d51690",
  "3|3|logo|368a63369bbfb3b3",
  "3|3|icono|c5c6c64350e5b7a5",
  "5|1|liso|468316690b7c7581",
  "5|1|logo|d7f5be47a15e2f1c",
  "5|1|icono|115303bedb5648e1",
  "5|2|liso|1c7fdb8859f2e0b7",
  "5|2|logo|db0edbe1ec0f0c96",
  "5|2|icono|07f4281b58432752",
  "5|3|liso|76a7c20a39787aa7",
  "5|3|logo|bb137784311fbb3b",
  "5|3|icono|10643098264b599c",
  "6|1|liso|1247fdc74d6df292",
  "6|1|logo|7884f77274596a92",
  "6|1|icono|a3280e69aa50d248",
  "6|2|liso|28463d5ec7f6a11d",
  "6|2|logo|ddf6a08fe55475cd",
  "6|2|icono|a8618034b5b473f1",
  "6|3|liso|91f22d77393c5df4",
  "6|3|logo|447444539dde1e50",
  "6|3|icono|46fc174122b1eda6",
  "7|1|liso|b256bfac6833cc9a",
  "7|1|logo|e2d8a3eff3d550dc",
  "7|1|icono|bb902e18f25ed46f",
  "7|2|liso|dfde4cce3f6e37e1",
  "7|2|logo|17bf64f8b3f7e0c1",
  "7|2|icono|e9d0838a2da76a28",
  "7|3|liso|3a0f5d2598226fe0",
  "7|3|logo|17838fb5cbf4cebe",
  "7|3|icono|3dead92af6f9114f",
  "8|1|liso|738cc64318736c2d",
  "8|1|logo|29f5d0c1cf75356c",
  "8|1|icono|9c68dc1ac44cc95a",
  "8|2|liso|4687199d322f7a5e",
  "8|2|logo|68426fdc6b34be97",
  "8|2|icono|62ebdda9e1565356",
  "8|3|liso|9cef93e993b643c9",
  "8|3|logo|818a819633e7494c",
  "8|3|icono|383edebd8f2f81cc",
  "10|1|liso|b4cfc408562036c0",
  "10|1|logo|1e6145278e6f7705",
  "10|1|icono|9fe17fc1cf6b9e17",
  "10|2|liso|1feec319af09ff83",
  "10|2|logo|ee87fd261e7fb251",
  "10|2|icono|59ea8619c57ad81e",
  "10|3|liso|f5baae9ab90c7638",
  "10|3|logo|239644ba0a89760e",
  "10|3|icono|1760065094d26f1d",
  "12|1|liso|6135c5be22a699de",
  "12|1|logo|7e2b0a7aed91385c",
  "12|1|icono|0f6fa97d6640ed3b",
  "12|2|liso|2f4c7301212a001d",
  "12|2|logo|5b0316c204a8ce57",
  "12|2|icono|6711fe2746b8e975",
  "12|3|liso|5570237201881316",
  "12|3|logo|4e81c4b7427dd2b8",
  "12|3|icono|9cbfe8923653cf5d",
  "15|1|liso|dfde66290859d3b0",
  "15|1|logo|192b5baa4531153b",
  "15|1|icono|1c7dcf4c2869a8ed",
  "15|2|liso|9e3017bafe317652",
  "15|2|logo|b182586fe9714c33",
  "15|2|icono|d4985b2d96a8a806",
  "15|3|liso|3c2106f3453231f4",
  "15|3|logo|c33e01c4f4f9a4a5",
  "15|3|icono|becdbb5b36da3621",
  "20|1|liso|f41561eba459fe88",
  "20|1|logo|20332caf1b0f4325",
  "20|1|icono|ce954caf2db115c5",
  "20|2|liso|ccfc15bfe8b8ff1e",
  "20|2|logo|54cb5c79b795e0c4",
  "20|2|icono|6b078f720b33cbf8",
  "20|3|liso|6e234e742158b8ad",
  "20|3|logo|391fc49110d8548b",
  "20|3|icono|25993191563cc036",
  "30|1|liso|3d1dd65824f4ed62",
  "30|1|logo|8992a843a32b646f",
  "30|1|icono|8b44e16c0b8c8dde",
  "30|2|liso|4d59ef6f44395c6d",
  "30|2|logo|7be6775a89df31d2",
  "30|2|icono|994fbab6cd572443",
  "30|3|liso|6046202ce9ed6eee",
  "30|3|logo|6134c97678084944",
  "30|3|icono|384d9e747e60c8c1",
];

describe("ninguna tarjeta ya emitida cambia de aspecto", () => {
  it("las 99 tiras clásicas salen byte por byte iguales", async () => {
    const logo = await logoDePrueba();
    const distintas: string[] = [];

    for (const fila of HUELLAS) {
      const [totalStr, escalaStr, camino, esperada] = fila.split("|");
      const total = Number(totalStr);
      const escala = Number(escalaStr) as 1 | 2 | 3;
      const extra =
        camino === "logo"
          ? { imagen: logo }
          : camino === "icono"
            ? ({ icono: "cafe" } as const)
            : {};

      const png = await dibujarTiraDeSellos({
        total,
        logrados: Math.floor(total / 2),
        colores: COLORES,
        imagen: null,
        banda: null,
        escala,
        ...extra,
      });
      const salio = createHash("sha256").update(png).digest("hex").slice(0, 16);
      if (salio !== esperada) {
        distintas.push(`${total} sellos, ${escala}x, ${camino}: ${esperada} → ${salio}`);
      }
    }

    expect(
      distintas,
      `CAMBIÓ EL DIBUJO DE TARJETAS YA EMITIDAS:\n${distintas.join("\n")}`,
    ).toEqual([]);
  });
});
