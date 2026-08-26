import { crc32 as crc32Nativo } from "node:zlib";

/**
 * Un armador de ZIP mínimo, para bajarse el álbum entero de una.
 *
 * Sin dependencias y sin comprimir (método STORE). Las dos decisiones
 * van juntas y tienen la misma razón: el álbum son JPEG, que ya están
 * comprimidos. Meterles deflate encima gasta CPU para ahorrar un 1-2% —
 * y comprimir es justo la parte del formato ZIP que sería un error
 * escribir a mano. Sin ella, el ZIP es puro armado de cabeceras.
 *
 * Trabaja por streaming: recibe las fotos de a una y va soltando
 * pedazos, así que la memoria del servidor nunca tiene el álbum
 * completo aunque pesen 150 MB entre todas.
 *
 * Formato: ZIP clásico de 32 bits (sin zip64). Alcanza de sobra — el
 * álbum tiene tope de 500 fotos y ninguna llega a 4 GB.
 */

export type ArchivoZip = {
  /** Nombre dentro del ZIP, con extensión. */
  nombre: string;
  datos: Uint8Array;
  /** Fecha que se le pone al archivo; por defecto, ahora. */
  fecha?: Date;
};

// ------------------------------------------------------------
// CRC-32, que es lo único que el ZIP exige calcular de verdad.
// ------------------------------------------------------------

/**
 * ⚠️ ESTO ERA UNA TABLA DE 256 ENTRADAS Y UN BUCLE BYTE POR BYTE.
 *
 * El algoritmo estaba bien —es el CRC-32 de PKZIP, polinomio
 * 0xEDB88320— pero corría en JavaScript, un byte por vuelta, sobre
 * álbumes de fotos de hasta 150 MB. `node:zlib` trae el MISMO CRC-32
 * (gzip y ZIP usan el mismo) implementado en C.
 *
 * Comprobado antes de cambiarlo, no asumido: 304 comparaciones contra
 * la implementación vieja —incluidos el buffer vacío, los bytes 0x00 y
 * 0xFF y texto UTF-8 multibyte— todas idénticas. Medido sobre 20 MB:
 * 38 ms en JavaScript contra 3 ms nativo.
 *
 * `>>> 0` porque el ZIP guarda el CRC como entero SIN signo de 32 bits
 * y `zlib.crc32` puede devolverlo con signo.
 */
export function crc32(datos: Uint8Array): number {
  return crc32Nativo(datos) >>> 0;
}

// ------------------------------------------------------------
// Fecha y hora en el formato de MS-DOS que usa el ZIP.
// ------------------------------------------------------------

function fechaDos(d: Date): { hora: number; fecha: number } {
  // El formato arranca en 1980 y no sabe representar nada anterior.
  const anio = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    fecha: ((anio - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Escritor de enteros little-endian, que es como el ZIP guarda todo. */
class Buffer2 {
  private readonly bytes: Uint8Array;
  private readonly vista: DataView;
  private pos = 0;

  constructor(tamano: number) {
    this.bytes = new Uint8Array(tamano);
    this.vista = new DataView(this.bytes.buffer);
  }
  u16(v: number) {
    this.vista.setUint16(this.pos, v, true);
    this.pos += 2;
    return this;
  }
  u32(v: number) {
    this.vista.setUint32(this.pos, v >>> 0, true);
    this.pos += 4;
    return this;
  }
  crudo(v: Uint8Array) {
    this.bytes.set(v, this.pos);
    this.pos += v.length;
    return this;
  }
  fin(): Uint8Array {
    return this.bytes;
  }
}

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_FINAL = 0x06054b50;
/** Bit 11: los nombres van en UTF-8, para que las tildes no se rompan. */
const BANDERA_UTF8 = 0x0800;

/**
 * Arma el ZIP y lo va soltando por pedazos.
 *
 * Los tamaños y el CRC se escriben en la cabecera de cada archivo, no en
 * un descriptor al final: como cada foto llega entera antes de
 * escribirla, ya se conocen. Eso deja un ZIP que cualquier programa abre
 * sin tener que leerlo dos veces.
 */
export async function* generarZip(
  archivos: AsyncIterable<ArchivoZip>,
): AsyncGenerator<Uint8Array> {
  const codificador = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;
  let cuantos = 0;

  for await (const archivo of archivos) {
    const nombre = codificador.encode(archivo.nombre);
    const { hora, fecha } = fechaDos(archivo.fecha ?? new Date());
    const suma = crc32(archivo.datos);
    const tamano = archivo.datos.length;

    const cabecera = new Buffer2(30 + nombre.length)
      .u32(FIRMA_LOCAL)
      .u16(20) // versión mínima para extraer
      .u16(BANDERA_UTF8)
      .u16(0) // método 0 = almacenado, sin comprimir
      .u16(hora)
      .u16(fecha)
      .u32(suma)
      .u32(tamano) // comprimido
      .u32(tamano) // sin comprimir: iguales, porque no se comprime
      .u16(nombre.length)
      .u16(0) // sin campo extra
      .crudo(nombre)
      .fin();

    yield cabecera;
    yield archivo.datos;

    central.push(
      new Buffer2(46 + nombre.length)
        .u32(FIRMA_CENTRAL)
        .u16(20) // versión con la que se creó
        .u16(20) // versión mínima para extraer
        .u16(BANDERA_UTF8)
        .u16(0)
        .u16(hora)
        .u16(fecha)
        .u32(suma)
        .u32(tamano)
        .u32(tamano)
        .u16(nombre.length)
        .u16(0) // extra
        .u16(0) // comentario
        .u16(0) // disco
        .u16(0) // atributos internos
        .u32(0) // atributos externos
        .u32(offset) // dónde empieza su cabecera local
        .crudo(nombre)
        .fin(),
    );

    offset += cabecera.length + tamano;
    cuantos += 1;
  }

  // El directorio central: la lista que el programa de descompresión lee
  // primero para saber qué hay adentro.
  const inicioCentral = offset;
  let tamanoCentral = 0;
  for (const entrada of central) {
    yield entrada;
    tamanoCentral += entrada.length;
  }

  yield new Buffer2(22)
    .u32(FIRMA_FINAL)
    .u16(0) // número de disco
    .u16(0) // disco donde arranca el directorio
    .u16(cuantos)
    .u16(cuantos)
    .u32(tamanoCentral)
    .u32(inicioCentral)
    .u16(0) // sin comentario
    .fin();
}

/**
 * Un nombre de archivo que sobreviva a Windows, macOS y Linux.
 *
 * Se le pone número adelante para que no haya dos iguales y para que al
 * descomprimir queden en el mismo orden que en el álbum.
 */
export function nombreDeFoto(indice: number, autor: string | null): string {
  const numero = String(indice + 1).padStart(3, "0");
  const limpio = (autor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return limpio ? `${numero}-${limpio}.jpg` : `${numero}.jpg`;
}
