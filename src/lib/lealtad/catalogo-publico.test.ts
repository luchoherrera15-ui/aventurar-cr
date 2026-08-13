import { describe, expect, it } from "vitest";
import {
  TOPES_PUBLICADOS,
  VERSION_CATALOGO,
  catalogoPublico,
  type CatalogoPublico,
} from "./catalogo-publico";
import {
  CAPACIDADES_SIN_PRODUCTO,
  ETIQUETAS_CAPACIDAD,
  PLANES,
  PLANES_OFRECIDOS,
  PLANES_RETIRADOS,
} from "./planes";
import { GET } from "@/app/api/lealtad/planes/route";

/**
 * Las pruebas de lo que sale por `GET /api/lealtad/planes`.
 *
 * Son de dos clases y las dos importan:
 *
 *   1. QUE NO FILTRE. El endpoint es público y sin sesión: cualquiera
 *      lo puede bajar. `planes.ts` tiene adentro paquetes retirados con
 *      sus precios, topes declarados sin producto detrás y capacidades
 *      que no existen — nada de eso puede viajar.
 *
 *   2. QUE LA FORMA NO SE MUEVA. Del otro lado hay una app que ya está
 *      instalada en teléfonos y que NO se puede actualizar a la par:
 *      renombrar un campo acá deja a esas instalaciones sin catálogo.
 *      Por eso el bloque de forma repite, campo por campo, lo que lee
 *      `mobile/src/lib/planes-lealtad.ts`.
 */

/**
 * El MISMO guardián que corre la app sobre el JSON que baja
 * (`esCatalogoPublico` en `mobile/src/lib/planes-lealtad.ts`).
 *
 * Está copiado a mano porque son dos proyectos npm distintos y no hay
 * import posible. Es la copia que importa que exista: si allá se
 * endurece una condición, esta prueba tiene que fallar hasta que se
 * endurezca también acá.
 */
function laAppLoPuedeLeer(dato: unknown): boolean {
  if (typeof dato !== "object" || dato === null) return false;
  const c = dato as Record<string, unknown>;
  if (typeof c.version !== "number") return false;
  if (typeof c.moneda !== "string") return false;
  if (typeof c.notaPago !== "string") return false;
  if (!Array.isArray(c.planes) || c.planes.length === 0) return false;
  return c.planes.every((p: unknown) => {
    if (typeof p !== "object" || p === null) return false;
    const q = p as Record<string, unknown>;
    return (
      typeof q.id === "string" &&
      typeof q.nombre === "string" &&
      typeof q.descripcion === "string" &&
      (typeof q.precio === "string" || q.precio === null) &&
      (typeof q.precioAnual === "string" || q.precioAnual === null) &&
      typeof q.esGratis === "boolean" &&
      typeof q.diasPrueba === "number" &&
      typeof q.destacado === "boolean" &&
      typeof q.notaPrecio === "string" &&
      typeof q.etiquetaClientes === "string" &&
      Array.isArray(q.incluye) &&
      q.incluye.every((i: unknown) => typeof i === "string") &&
      Array.isArray(q.topes) &&
      q.topes.every((t: unknown) => {
        if (typeof t !== "object" || t === null) return false;
        const u = t as Record<string, unknown>;
        return (
          typeof u.id === "string" &&
          typeof u.etiqueta === "string" &&
          (typeof u.valor === "number" || u.valor === null) &&
          typeof u.texto === "string"
        );
      })
    );
  });
}

/** Lo que de verdad sale por la red: pasado por JSON de ida y vuelta. */
function porLaRed(): CatalogoPublico {
  return JSON.parse(JSON.stringify(catalogoPublico())) as CatalogoPublico;
}

describe("catalogoPublico — lo que NO puede filtrar", () => {
  it("no publica ningún paquete retirado", () => {
    const ids = catalogoPublico().planes.map((p) => p.id);
    expect(ids).toEqual([...PLANES_OFRECIDOS]);
    for (const retirado of PLANES_RETIRADOS) {
      expect(ids).not.toContain(retirado);
    }
  });

  it("no filtra el nombre ni el precio de un paquete retirado", () => {
    const texto = JSON.stringify(catalogoPublico());
    for (const retirado of PLANES_RETIRADOS) {
      const def = PLANES[retirado];
      expect(texto).not.toContain(`"${def.nombre}"`);
    }
    // «Pro» costaba $69 y se retiró: ese precio no puede aparecer en
    // ningún lado del cuerpo, ni suelto ni dentro de otra frase.
    expect(texto).not.toContain("$69");
    expect(texto).not.toContain("$690");
    // «Crece» ($27) y «Esencial» ($9), del catálogo anterior.
    expect(texto).not.toContain("$27");
    expect(texto).not.toContain("$9 ");
  });

  it("no promete ninguna capacidad sin producto detrás", () => {
    const catalogo = catalogoPublico();
    const viñetas = catalogo.planes.flatMap((p) => p.incluye);
    const texto = JSON.stringify(catalogo);
    for (const capacidad of CAPACIDADES_SIN_PRODUCTO) {
      // La ETIQUETA es lo que ve quien está por pagar: esa no puede
      // aparecer ni parecida, así que se busca en el cuerpo entero.
      expect(texto).not.toContain(ETIQUETAS_CAPACIDAD[capacidad]);
      // El ID solo podría colarse como valor o como llave, o sea
      // ENTRECOMILLADO. Buscarlo suelto da falsos positivos: «pos»
      // vive dentro de «5 tipos de tarjeta».
      expect(texto).not.toContain(`"${capacidad}"`);
      expect(viñetas).not.toContain(capacidad);
    }
  });

  it("no publica los topes que nadie hace cumplir", () => {
    const texto = JSON.stringify(catalogoPublico());
    for (const inventado of ["notificacionesMes", "sedes", "automatizaciones"]) {
      expect(texto).not.toContain(inventado);
    }
    for (const plan of catalogoPublico().planes) {
      expect(plan.topes.map((t) => t.id)).toEqual([...TOPES_PUBLICADOS]);
    }
  });

  it("no cuela ningún campo interno de la definición del plan", () => {
    // `vigente`, `capacidades` y `limites` son vocabulario de adentro:
    // el que consume el endpoint no tiene por qué saber que existen
    // paquetes apagados ni cómo se llaman las capacidades por dentro.
    const texto = JSON.stringify(catalogoPublico());
    for (const interno of ["vigente", "capacidades", "limites", "precioMensual"]) {
      expect(texto).not.toContain(interno);
    }
  });
});

describe("catalogoPublico — la forma que la app espera", () => {
  it("pasa el mismo guardián que corre la app", () => {
    expect(laAppLoPuedeLeer(porLaRed())).toBe(true);
  });

  it("sobrevive el viaje por JSON sin perder nada", () => {
    // Un `undefined` en un campo se borra al serializar y la app
    // recibiría una forma distinta de la que ve el servidor.
    expect(porLaRed()).toEqual(catalogoPublico());
  });

  it("declara su versión y su moneda", () => {
    const c = catalogoPublico();
    expect(c.version).toBe(VERSION_CATALOGO);
    expect(c.moneda).toBe("USD");
    expect(c.notaPago).toContain("SINPE");
    // Los precios van en dólares y el depósito en colones: si la nota
    // no lo dice, alguien deposita ₡12 creyendo que paga Arranque.
    expect(c.notaPago).toContain("dólares");
    expect(c.notaPago).toContain("colones");
  });

  it("marca un solo destacado, y es el del catálogo", () => {
    const c = catalogoPublico();
    const destacados = c.planes.filter((p) => p.destacado);
    expect(destacados).toHaveLength(1);
    expect(destacados[0].id).toBe("impulso");
    expect(c.destacado).toBe("impulso");
  });
});

describe("catalogoPublico — los números que la app estaba mintiendo", () => {
  it("la Prueba son 25 clientes y 14 días, no 50 para siempre", () => {
    const prueba = catalogoPublico().planes.find((p) => p.id === "prueba");
    expect(prueba).toBeDefined();
    expect(prueba?.nombre).toBe("Prueba");
    expect(prueba?.precio).toBe("$0");
    expect(prueba?.esGratis).toBe(true);
    expect(prueba?.diasPrueba).toBe(14);
    expect(prueba?.etiquetaClientes).toBe("Hasta 25 clientes");
    expect(prueba?.notaPrecio).toBe("14 días, sin tarjeta");
  });

  it("Arranque son $12, no ₡12 900, y su cupo es 200", () => {
    const arranque = catalogoPublico().planes.find((p) => p.id === "arranque");
    expect(arranque?.precio).toBe("$12");
    expect(arranque?.precioAnual).toBe("$120");
    expect(arranque?.notaPrecio).toBe("$120 al año — 2 meses gratis");
    expect(arranque?.etiquetaClientes).toBe("Hasta 200 clientes");
  });

  it("Impulso escribe sus 1150 clientes con separador de miles", () => {
    const impulso = catalogoPublico().planes.find((p) => p.id === "impulso");
    expect(impulso?.precio).toBe("$42");
    // El separador de es-CR es un ESPACIO DURO (U+00A0), no un punto:
    // es lo que devuelve `toLocaleString("es-CR")` y por lo tanto lo
    // que ya pinta la landing (`paquetes-cliente.tsx`). Se escribe con
    // el código de escape para que nadie lo "arregle" a un espacio
    // normal creyendo que es un typo — con espacio normal el número se
    // parte en dos al final de una línea.
    expect(impulso?.etiquetaClientes).toBe("Hasta 1 150 clientes");
    expect(impulso?.topes.find((t) => t.id === "clientesActivos")?.valor).toBe(1150);
  });

  it("Ilimitado es el único sin tope, y son $89", () => {
    const c = catalogoPublico();
    const ilimitado = c.planes.find((p) => p.id === "ilimitado");
    expect(ilimitado?.precio).toBe("$89");
    expect(ilimitado?.etiquetaClientes).toBe("Clientes ilimitados");
    const sinTope = c.planes.filter((p) => p.etiquetaClientes === "Clientes ilimitados");
    expect(sinTope).toHaveLength(1);
  });

  it("los cuatro prometen Wallet, porque Wallet está en producción", () => {
    for (const plan of catalogoPublico().planes) {
      expect(plan.incluye).toContain("Pases en Apple Wallet y Google Wallet");
    }
  });

  it("ningún paquete promete sucursales — no existen", () => {
    const texto = JSON.stringify(catalogoPublico()).toLowerCase();
    expect(texto).not.toContain("sucursal");
  });
});

describe("GET /api/lealtad/planes", () => {
  it("responde 200 con el catálogo público", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    const cuerpo: unknown = await res.json();
    expect(cuerpo).toEqual(porLaRed());
    expect(laAppLoPuedeLeer(cuerpo)).toBe(true);
  });

  it("se puede cachear y lo puede pedir cualquiera", async () => {
    const res = GET();
    // Sin `public` en el cache-control, ni el CDN ni el teléfono lo
    // guardan y cada arranque de la app despierta una función.
    expect(res.headers.get("cache-control")).toContain("public");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    await res.json();
  });
});
