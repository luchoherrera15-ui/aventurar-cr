/**
 * LA CLAVE DEL CLIENTE, VIAJANDO EN LA URL.
 *
 * La clave del CRM derivado es texto con `:` y `@`
 * (`correo:ana@x.com`, `tel:88887777`). En una ruta de Next eso obliga
 * a escapes frágiles; base64url la vuelve un segmento opaco y estable:
 * `/mi-negocio/<id>/clientes/<clave64>`.
 *
 * base64url y no base64 a secas: el alfabeto estándar trae `/` y `+`,
 * y un `/` dentro de un segmento de ruta lo parte en dos.
 */

export function claveAUrl(clave: string): string {
  return Buffer.from(clave, "utf8").toString("base64url");
}

/** null si el segmento no es base64url válido o no parece una clave. */
export function claveDeUrl(segmento: string): string | null {
  try {
    const clave = Buffer.from(segmento, "base64url").toString("utf8");
    // Toda clave real lleva el prefijo `tipo:` — un segmento arbitrario
    // que decodifica a basura no pasa de acá.
    return /^(id|cuenta|correo|tel|nombre):.+/.test(clave) ? clave : null;
  } catch {
    return null;
  }
}
