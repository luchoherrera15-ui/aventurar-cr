import { describe, expect, it } from "vitest";
import { crc32, generarZip, nombreDeFoto, type ArchivoZip } from "./zip";

/**
 * El ZIP se arma a mano, así que lo que se prueba es que los bytes
 * salgan donde el formato dice. Un ZIP mal armado no da error al
 * generarse: da error al abrirlo, en la computadora del cliente.
 */

const TEXTO = new TextEncoder();

async function* unaLista(archivos: ArchivoZip[]) {
  for (const a of archivos) yield a;
}

async function armar(archivos: ArchivoZip[]): Promise<Uint8Array> {
  const pedazos: Uint8Array[] = [];
  for await (const p of generarZip(unaLista(archivos))) pedazos.push(p);
  const total = pedazos.reduce((n, p) => n + p.length, 0);
  const salida = new Uint8Array(total);
  let pos = 0;
  for (const p of pedazos) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}

function leerU32(b: Uint8Array, pos: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(pos, true);
}
function leerU16(b: Uint8Array, pos: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(pos, true);
}

describe("crc32", () => {
  // Valores publicados del CRC-32 estándar (el mismo que usan ZIP y
  // gzip). Si esto se rompe, todo ZIP que salga va a estar corrupto.
  it("da los valores conocidos del estándar", () => {
    expect(crc32(TEXTO.encode(""))).toBe(0x00000000);
    expect(crc32(TEXTO.encode("a"))).toBe(0xe8b7be43);
    expect(crc32(TEXTO.encode("abc"))).toBe(0x352441c2);
    expect(crc32(TEXTO.encode("hello"))).toBe(0x3610a686);
    expect(crc32(TEXTO.encode("123456789"))).toBe(0xcbf43926);
  });

  it("no se confunde con bytes altos", () => {
    expect(crc32(new Uint8Array([0xff, 0x00, 0xff]))).toBe(crc32(new Uint8Array([0xff, 0x00, 0xff])));
    expect(crc32(new Uint8Array([0x00]))).not.toBe(crc32(new Uint8Array([0x01])));
  });
});

describe("generarZip", () => {
  const fecha = new Date(2026, 7, 2, 14, 30, 0);

  it("abre con la firma de archivo local", async () => {
    const zip = await armar([
      { nombre: "uno.txt", datos: TEXTO.encode("hola"), fecha },
    ]);
    expect(leerU32(zip, 0)).toBe(0x04034b50);
  });

  it("guarda sin comprimir, y los dos tamaños coinciden", async () => {
    const datos = TEXTO.encode("hola mundo");
    const zip = await armar([{ nombre: "uno.txt", datos, fecha }]);
    expect(leerU16(zip, 8)).toBe(0); // método 0 = almacenado
    expect(leerU32(zip, 18)).toBe(datos.length); // comprimido
    expect(leerU32(zip, 22)).toBe(datos.length); // sin comprimir
  });

  it("escribe el CRC del contenido en la cabecera", async () => {
    const datos = TEXTO.encode("hello");
    const zip = await armar([{ nombre: "uno.txt", datos, fecha }]);
    expect(leerU32(zip, 14)).toBe(0x3610a686);
  });

  it("marca los nombres como UTF-8 para no romper las tildes", async () => {
    const zip = await armar([
      { nombre: "cumpleaños.jpg", datos: TEXTO.encode("x"), fecha },
    ]);
    expect(leerU16(zip, 6) & 0x0800).toBe(0x0800);
    // El nombre viaja tal cual, en sus bytes UTF-8.
    const largo = leerU16(zip, 26);
    const nombre = new TextDecoder().decode(zip.slice(30, 30 + largo));
    expect(nombre).toBe("cumpleaños.jpg");
  });

  it("mete los datos del archivo justo después de su cabecera", async () => {
    const datos = TEXTO.encode("contenido");
    const zip = await armar([{ nombre: "a.txt", datos, fecha }]);
    const inicio = 30 + leerU16(zip, 26);
    expect(new TextDecoder().decode(zip.slice(inicio, inicio + datos.length))).toBe(
      "contenido",
    );
  });

  it("cierra con el registro final, que dice cuántos archivos hay", async () => {
    const zip = await armar([
      { nombre: "a.txt", datos: TEXTO.encode("uno"), fecha },
      { nombre: "b.txt", datos: TEXTO.encode("dos"), fecha },
      { nombre: "c.txt", datos: TEXTO.encode("tres"), fecha },
    ]);
    const fin = zip.length - 22;
    expect(leerU32(zip, fin)).toBe(0x06054b50);
    expect(leerU16(zip, fin + 8)).toBe(3);
    expect(leerU16(zip, fin + 10)).toBe(3);
  });

  it("el directorio central apunta a donde de verdad empieza cada archivo", async () => {
    const zip = await armar([
      { nombre: "a.txt", datos: TEXTO.encode("uno"), fecha },
      { nombre: "b.txt", datos: TEXTO.encode("dos"), fecha },
    ]);
    const fin = zip.length - 22;
    const inicioCentral = leerU32(zip, fin + 16);
    const tamanoCentral = leerU32(zip, fin + 12);

    // Empieza donde dice, y termina justo donde arranca el registro final.
    expect(leerU32(zip, inicioCentral)).toBe(0x02014b50);
    expect(inicioCentral + tamanoCentral).toBe(fin);

    // Y el offset de la primera entrada lleva a una cabecera local.
    const offsetPrimera = leerU32(zip, inicioCentral + 42);
    expect(leerU32(zip, offsetPrimera)).toBe(0x04034b50);

    // El de la segunda, también — que es lo que se rompe si el conteo
    // de bytes se desfasa.
    const largoNombre1 = leerU16(zip, inicioCentral + 28);
    const segundaEntrada = inicioCentral + 46 + largoNombre1;
    const offsetSegunda = leerU32(zip, segundaEntrada + 42);
    expect(leerU32(zip, offsetSegunda)).toBe(0x04034b50);
  });

  it("un ZIP vacío sigue siendo un ZIP válido", async () => {
    const zip = await armar([]);
    expect(zip.length).toBe(22);
    expect(leerU32(zip, 0)).toBe(0x06054b50);
    expect(leerU16(zip, 8)).toBe(0);
  });
});

describe("nombreDeFoto", () => {
  it("numera para que no haya dos iguales y se ordenen", () => {
    expect(nombreDeFoto(0, null)).toBe("001.jpg");
    expect(nombreDeFoto(41, null)).toBe("042.jpg");
  });

  it("suma el nombre de quien la subió, sin tildes ni signos", () => {
    expect(nombreDeFoto(0, "Tía Rosa")).toBe("001-Tia-Rosa.jpg");
    expect(nombreDeFoto(1, "José / María")).toBe("002-Jose-Maria.jpg");
  });

  it("aguanta un nombre que sea puro signos", () => {
    expect(nombreDeFoto(2, "!!!")).toBe("003.jpg");
    expect(nombreDeFoto(3, "   ")).toBe("004.jpg");
  });
});
