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
 *
 * ── LAS 33 DE «icono» SE ACTUALIZARON UNA VEZ, Y ASÍ SE HIZO ────────
 *
 * El 26 de agosto de 2026 se redibujaron los doce íconos de sello a
 * pedido del dueño («los iconos son sumamente feos»). Eso movió, como
 * tenía que moverlos, los 33 casos de `icono` — y esta prueba los
 * atrapó a los 33.
 *
 * Lo importante es lo que NO se movió: los 66 casos de `liso` y `logo`
 * quedaron byte por byte iguales. Ese contraste es la prueba de que el
 * cambio hizo exactamente lo que decía y ni un píxel de más; si alguno
 * de esos 66 se hubiera movido, habría significado que el rediseño tocó
 * algo que no era suyo.
 *
 * O sea: se verificó QUÉ cambió antes de aceptar el cambio. Ese es el
 * procedimiento, y no «correr el test y pegar los números nuevos».
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
  "1|1|icono|ac6e43917ecab69b",
  "1|2|liso|a284fc537ae8daf4",
  "1|2|logo|28299ab2e49d58d9",
  "1|2|icono|852aeceef85d7d04",
  "1|3|liso|4eed66f8f56aa255",
  "1|3|logo|7b6e8812ae3684de",
  "1|3|icono|1d7618ce5bbbc020",
  "3|1|liso|d671bf97ba1baec3",
  "3|1|logo|5d44d9d91adaf1eb",
  "3|1|icono|157d221995a8e7b0",
  "3|2|liso|28a256dc9799fc14",
  "3|2|logo|91b0be8b3063ac4a",
  "3|2|icono|93fb751374009857",
  "3|3|liso|dc39e8c625d51690",
  "3|3|logo|368a63369bbfb3b3",
  "3|3|icono|990b761ad9c7005e",
  "5|1|liso|468316690b7c7581",
  "5|1|logo|d7f5be47a15e2f1c",
  "5|1|icono|9458f28d9ba58515",
  "5|2|liso|1c7fdb8859f2e0b7",
  "5|2|logo|db0edbe1ec0f0c96",
  "5|2|icono|0283bc2481ef6f97",
  "5|3|liso|76a7c20a39787aa7",
  "5|3|logo|bb137784311fbb3b",
  "5|3|icono|f5e294b38ae9ac2a",
  "6|1|liso|1247fdc74d6df292",
  "6|1|logo|7884f77274596a92",
  "6|1|icono|2dfb9b0157927d19",
  "6|2|liso|28463d5ec7f6a11d",
  "6|2|logo|ddf6a08fe55475cd",
  "6|2|icono|f9b149962b170afe",
  "6|3|liso|91f22d77393c5df4",
  "6|3|logo|447444539dde1e50",
  "6|3|icono|5566980894f8497c",
  "7|1|liso|b256bfac6833cc9a",
  "7|1|logo|e2d8a3eff3d550dc",
  "7|1|icono|a8707644dc210b82",
  "7|2|liso|dfde4cce3f6e37e1",
  "7|2|logo|17bf64f8b3f7e0c1",
  "7|2|icono|a7d0bdf4a5e4b89d",
  "7|3|liso|3a0f5d2598226fe0",
  "7|3|logo|17838fb5cbf4cebe",
  "7|3|icono|3d1f9860fca430a7",
  "8|1|liso|738cc64318736c2d",
  "8|1|logo|29f5d0c1cf75356c",
  "8|1|icono|fa6605dec8f2126c",
  "8|2|liso|4687199d322f7a5e",
  "8|2|logo|68426fdc6b34be97",
  "8|2|icono|24c4a10016ed953d",
  "8|3|liso|9cef93e993b643c9",
  "8|3|logo|818a819633e7494c",
  "8|3|icono|3d904222896226b5",
  "10|1|liso|b4cfc408562036c0",
  "10|1|logo|1e6145278e6f7705",
  "10|1|icono|f8840b05c44352cd",
  "10|2|liso|1feec319af09ff83",
  "10|2|logo|ee87fd261e7fb251",
  "10|2|icono|6065229e003835af",
  "10|3|liso|f5baae9ab90c7638",
  "10|3|logo|239644ba0a89760e",
  "10|3|icono|cf318ce3438c9e96",
  "12|1|liso|6135c5be22a699de",
  "12|1|logo|7e2b0a7aed91385c",
  "12|1|icono|2da59740645bafae",
  "12|2|liso|2f4c7301212a001d",
  "12|2|logo|5b0316c204a8ce57",
  "12|2|icono|1080e16c3dfdee34",
  "12|3|liso|5570237201881316",
  "12|3|logo|4e81c4b7427dd2b8",
  "12|3|icono|b070b41057739012",
  "15|1|liso|dfde66290859d3b0",
  "15|1|logo|192b5baa4531153b",
  "15|1|icono|060e9e420737e393",
  "15|2|liso|9e3017bafe317652",
  "15|2|logo|b182586fe9714c33",
  "15|2|icono|9aaeb87f6a578dde",
  "15|3|liso|3c2106f3453231f4",
  "15|3|logo|c33e01c4f4f9a4a5",
  "15|3|icono|b167e738d82bf1db",
  "20|1|liso|f41561eba459fe88",
  "20|1|logo|20332caf1b0f4325",
  "20|1|icono|68b38cf7b62b8b18",
  "20|2|liso|ccfc15bfe8b8ff1e",
  "20|2|logo|54cb5c79b795e0c4",
  "20|2|icono|9866060cca3e6817",
  "20|3|liso|6e234e742158b8ad",
  "20|3|logo|391fc49110d8548b",
  "20|3|icono|2d56594485e39c27",
  "30|1|liso|3d1dd65824f4ed62",
  "30|1|logo|8992a843a32b646f",
  "30|1|icono|cd25dc8c227de702",
  "30|2|liso|4d59ef6f44395c6d",
  "30|2|logo|7be6775a89df31d2",
  "30|2|icono|7609d67d986ad569",
  "30|3|liso|6046202ce9ed6eee",
  "30|3|logo|6134c97678084944",
  "30|3|icono|9d24942133eae088",
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
