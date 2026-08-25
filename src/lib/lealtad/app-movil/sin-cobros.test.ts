import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EN LA APP NO SE HABLA DE PLATA — la barrera, escrita como prueba
 * ════════════════════════════════════════════════════════════════════
 *
 * Decisión del dueño (ago 2026), literal: «En la app no muestres nada de
 * lo que es "pago", solo tipo ver métricas, escanear».
 *
 * Y coincide con la regla 3.1.1 de Apple: una app que muestra planes o
 * precios de un software y manda a pagarlo por fuera de la compra dentro
 * de la app es lo que hace que una revisión rebote. El módulo de Lealtad
 * SÍ puede vivir en el binario porque lo que opera —sellar, canjear,
 * escanear— es un servicio del mundo real entre el negocio y SUS
 * clientes. Lo que no puede es venderle el paquete al negocio.
 *
 * ── POR QUÉ ESTO ES UNA PRUEBA Y NO UN COMENTARIO ───────────────────
 *
 * Porque el dato está a mano. `page.tsx` del panel web ya carga el plan,
 * los topes y la suscripción, y el endpoint del app corre en el mismo
 * repo con las mismas funciones importables. La tentación de agregar
 * «tu paquete va en 34 de 1.000 clientes» a la pantalla del teléfono es
 * real y se ve útil. Esta prueba es la que lo frena antes de que llegue
 * a una revisión de la tienda, que es donde sale caro.
 *
 * ── QUÉ VIGILA ─────────────────────────────────────────────────────
 *
 * El CÓDIGO FUENTE de todo `src/app/api/lealtad/app/**`. No la respuesta
 * en tiempo de ejecución: para eso habría que levantar la ruta con una
 * sesión válida, y una prueba que no se puede correr en CI no protege
 * nada. Vigilar el fuente alcanza porque para que un campo de plan salga
 * al teléfono, alguien tiene que escribir su nombre acá.
 */

const RAIZ = path.join(process.cwd(), "src", "app", "api", "lealtad", "app");

/**
 * Lo que no puede aparecer, y por qué cada uno.
 *
 * Son nombres de SÍMBOLOS y columnas, no palabras sueltas: buscar
 * «precio» a secas daría falso positivo con el precio de un café del
 * catálogo de la caja, que sí es un dato operativo legítimo — es lo que
 * el negocio le cobra a su cliente, no lo que Bookea le cobra al
 * negocio.
 */
const PROHIBIDOS: { patron: RegExp; que: string }[] = [
  { patron: /\bplan_lealtad\b/, que: "la columna del paquete contratado" },
  { patron: /\bdefinicionDe\b/, que: "la definición del paquete (topes y capacidades)" },
  { patron: /\bPLANES\b/, que: "el catálogo de paquetes" },
  { patron: /\bprecioDe\b/, que: "el formateador de precios de paquete" },
  { patron: /\bprecioMensual\b|\bprecioAnual\b/, que: "el precio del paquete" },
  { patron: /\bsuscripcionDelNegocio\b|\bsuscripciones\b/, que: "el estado de la suscripción" },
  { patron: /\bestadoDelLimite\b|\bLimitesPlan\b/, que: "los topes del paquete" },
  { patron: /\bpersonasActivasDe\b/, que: "el conteo contra el cupo del paquete" },
  { patron: /\bestadoDePrueba\b/, que: "el vencimiento de la prueba" },
  { patron: /\bcheckout\b|\bstripe\b/i, que: "el cobro" },
];

function archivosDe(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivosDe(completo);
    return e.name.endsWith(".ts") || e.name.endsWith(".tsx") ? [completo] : [];
  });
}

describe("los endpoints de la app no hablan de paquetes ni de plata", () => {
  const archivos = archivosDe(RAIZ);

  it("hay endpoints que vigilar", () => {
    // Si alguien mueve la carpeta, esta prueba dejaría de vigilar nada y
    // pasaría en verde. Este caso es el que avisa.
    expect(archivos.length).toBeGreaterThan(0);
  });

  for (const { patron, que } of PROHIBIDOS) {
    it(`no aparece ${que}`, () => {
      const culpables = archivos.filter((f) => patron.test(sinComentarios(f)));
      expect(culpables.map((f) => path.relative(process.cwd(), f))).toEqual([]);
    });
  }

  /**
   * ── EL MOTIVO TAMBIÉN SE ESCAPA POR LA PUERTA DE ATRÁS ─────────────
   *
   * Los patrones de arriba vigilan que el DATO del paquete no se lea
   * acá. Falta la otra mitad: el núcleo compartido devuelve motivos
   * escritos para el panel web, y uno de ellos dice literalmente
   * «Escribile a Bookea para subir de plan» (el cupo lleno, en
   * `afiliarCore`). Esa frase no está en ningún archivo de esta carpeta
   * —y por eso ningún regex de arriba la ve— pero llega al teléfono
   * igual si la ruta devuelve `jsonApp({ ok: false, motivo: r.motivo })`
   * en vez de `errorApp(r)`, que es el único que traduce por código.
   *
   * Así que la regla es estructural: quien llama al núcleo, importa el
   * traductor. Es lo bastante burda para no estorbar (una ruta que no
   * toca el núcleo no la despierta) y lo bastante fuerte para que el
   * atajo no compile en verde.
   */
  it("toda ruta que llama al núcleo importa `errorApp`", () => {
    const culpables = archivos
      .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
      .filter((f) => {
        const fuente = sinComentarios(f);
        return /operar-core/.test(fuente) && !/\berrorApp\b/.test(fuente);
      });
    expect(culpables.map((f) => path.relative(process.cwd(), f))).toEqual([]);
  });
});

/**
 * Los comentarios no viajan al teléfono, y este repo los usa justamente
 * para explicar por qué algo NO está. Sin quitarlos, la propia
 * explicación dispararía la prueba.
 */
function sinComentarios(archivo: string): string {
  return fs
    .readFileSync(archivo, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}
