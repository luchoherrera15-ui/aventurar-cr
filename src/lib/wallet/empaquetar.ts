import JSZip from "jszip";
import {
  certificadoVigente,
  construirManifest,
  firmarManifest,
  type CredencialesPase,
} from "./firma";

/**
 * Arma el .pkpass final: los archivos + manifest + signature, en un
 * zip PLANO (sin carpetas). Apple lo exige así; un zip con un
 * directorio adentro no abre.
 */
export async function empaquetarPase({
  archivos,
  credenciales,
  ahora,
}: {
  /** pass.json e imágenes. NO incluir manifest ni signature. */
  archivos: Record<string, Buffer>;
  credenciales: CredencialesPase;
  ahora: Date;
}): Promise<Buffer> {
  const vigencia = certificadoVigente(credenciales, ahora);
  if (!vigencia.vigente) throw new Error(vigencia.motivo);

  if (!archivos["pass.json"]) {
    throw new Error("El pase no lleva pass.json.");
  }
  // icon.png no es decorativo: sin él el iPhone descarta el pase en
  // silencio, que es el error más difícil de diagnosticar de todos.
  if (!archivos["icon.png"]) {
    throw new Error("El pase no lleva icon.png, que Apple exige.");
  }

  const manifest = construirManifest(archivos);
  const firma = firmarManifest(manifest, credenciales);

  const zip = new JSZip();
  for (const [nombre, contenido] of Object.entries(archivos)) {
    /**
     * ⚠️ LOS PNG VAN SIN COMPRIMIR, Y NO ES DEJADEZ.
     *
     * Esto zipeaba TODO con DEFLATE nivel 9 — el máximo esfuerzo. Un
     * pase son nueve PNG (el ícono, el logo y la tira, cada uno en las
     * tres escalas que pide Apple) y un PNG YA ESTÁ COMPRIMIDO: por
     * dentro es DEFLATE. Volver a comprimirlo al máximo es pagar el
     * algoritmo más caro para no encontrar nada que ahorrar.
     *
     * Se midió sobre un pase real de 2,32 MB: nivel 9 tarda ~139 ms de
     * CPU y ahorra 519 bytes. Medio kilobyte de dos megas, al precio
     * del rubro más caro del proyecto.
     *
     * `STORE` guarda el archivo tal cual: ~6 ms. El zip queda del mismo
     * tamaño para cualquier fin práctico y el iPhone lo lee igual —
     * STORE es parte del formato ZIP desde siempre, no una extensión.
     *
     * `manifest.json` y `signature` SÍ siguen con DEFLATE (abajo): son
     * texto y DER, ahí la compresión sí trabaja, y entre los dos no
     * llegan a 4 KB.
     */
    zip.file(nombre, contenido, {
      compression: nombre.endsWith(".png") ? "STORE" : "DEFLATE",
    });
  }
  zip.file("manifest.json", manifest);
  zip.file("signature", firma);

  return zip.generateAsync({
    type: "nodebuffer",
    // El default para lo que no declaró compresión propia arriba.
    compression: "DEFLATE",
    // Sin fecha variable: dos pases con el mismo contenido dan el mismo
    // archivo, lo que hace comparables las pruebas.
    //
    // Bajó de 9 a 6: los únicos archivos que llegan acá con DEFLATE son
    // el manifest y la firma. El nivel 9 sobre 4 KB de texto no cambia
    // nada medible, y el 9 estaba puesto pensando en los PNG que ahora
    // van por STORE.
    compressionOptions: { level: 6 },
  });
}
