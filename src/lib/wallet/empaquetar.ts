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
    zip.file(nombre, contenido);
  }
  zip.file("manifest.json", manifest);
  zip.file("signature", firma);

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    // Sin fecha variable: dos pases con el mismo contenido dan el mismo
    // archivo, lo que hace comparables las pruebas.
    compressionOptions: { level: 9 },
  });
}
