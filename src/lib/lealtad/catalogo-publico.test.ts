import { describe, expect, it, vi } from "vitest";

/**
 * Las pruebas de lo que sale por `GET /api/lealtad/planes`.
 *
 * Son de dos clases y las dos importan:
 *
 *   1. QUE NO FILTRE. El endpoint es público y sin sesión: cualquiera
 *      lo puede bajar. `planes.ts` puede tener adentro paquetes
 *      retirados con sus precios, topes declarados sin producto detrás
 *      y capacidades que no existen — nada de eso puede viajar.
 *
 *   2. QUE LA FORMA NO SE MUEVA. Del otro lado hay una app que ya está
 *      instalada en teléfonos y que NO se puede actualizar a la par:
 *      renombrar un campo acá deja a esas instalaciones sin catálogo.
 *      Por eso el bloque de forma repite, campo por campo, lo que lee
 *      `mobile/src/lib/planes-lealtad.ts`.
 */

// ── EL PAQUETE RETIRADO QUE HOY NO EXISTE ───────────────────────────
/**
 * El catálogo se quedó sin paquetes retirados el 2026-08-17 (se
 * borraron los ocho después de comprobar que ninguna fila de la base
 * los tenía). Con cero retirados, «los retirados no salen por la API»
 * pasaba sin comprobar nada: recorría una lista vacía.
 *
 * Así que se inventa uno y se le mete a `PLANES_VIGENTES`, que es de
 * donde `catalogoPublico()` saca los paquetes. Es el mismo criterio de
 * `prueba.test.ts` con su paquete de prueba propio, y acá alcanza con
 * mockear `./planes` porque `catalogo-publico.ts` LEE esa constante —
 * no la calcula.
 *
 * Lo que esto prueba de verdad: que el filtro de `catalogoPublico()`
 * existe y muerde. Sin el filtro, este paquete saldría publicado con su
 * nombre, su precio y sus viñetas sin producto, y la prueba fallaría —
 * que es exactamente lo que tiene que pasar.
 *
 * Se le ponen a propósito las viñetas que NO se pueden vender (`api`,
 * `webhooks`, `marca_blanca`…): así el bloque de capacidades también
 * vuelve a tener con qué fallar.
 */
const { RETIRADO } = vi.hoisted(() => ({
  RETIRADO: {
    id: "retirado-solo-del-test",
    nombre: "Paquete Retirado Del Test",
    descripcion: "Paquete anterior — se mantiene para quien ya lo tiene.",
    // $69 era el precio de «Pro», el retirado más caro que llegó a
    // publicarse. Se repite acá para que el número siga teniendo dueño.
    precioMensual: 69,
    precioAnual: 690,
    limites: {
      clientesActivos: null,
      programas: null,
      notificacionesMes: null,
      ubicaciones: null,
      administradores: null,
      sedes: null,
      automatizaciones: null,
    },
    capacidades: ["wallet", "api", "webhooks", "marca_blanca", "soporte_dedicado"],
    tipos: null,
    diasPrueba: 0,
    vigente: false,
  },
}));

vi.mock("./planes", async (importOriginal) => {
  const real = await importOriginal<typeof import("./planes")>();
  // El cast es la inyección: el id no está en `PlanId` y las viñetas
  // sin producto no las lleva ningún paquete del catálogo.
  const retirado = RETIRADO as unknown as import("./planes").DefinicionPlan;
  return {
    ...real,
    // Va AL FINAL: si el filtro no estuviera, saldría como un quinto
    // paquete y el `toEqual([...PLANES_OFRECIDOS])` lo delataría además
    // de las pruebas de contenido.
    PLANES_VIGENTES: [...real.PLANES_VIGENTES, retirado],
  };
});

import {
  TOPES_PUBLICADOS,
  VERSION_CATALOGO,
  catalogoPublico,
  type CatalogoPublico,
} from "./catalogo-publico";
import {
  CAPACIDADES_SIN_PRODUCTO,
  ETIQUETAS_CAPACIDAD,
  PLANES_OFRECIDOS,
  PLANES_RETIRADOS,
  PLANES_VIGENTES,
} from "./planes";
import { GET } from "@/app/api/lealtad/planes/route";

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
  it("el paquete retirado del test está puesto: si no, esto no prueba nada", () => {
    // El guardián del guardián. Si la inyección dejara de aplicarse
    // —por un rename, por un mock que no resuelve— las tres pruebas de
    // abajo pasarían recorriendo el vacío, que es justo el modo de
    // fallar silencioso que este archivo tuvo cuando el catálogo se
    // quedó sin retirados.
    expect(PLANES_VIGENTES.map((p) => p.id)).toContain(RETIRADO.id);
    expect(RETIRADO.vigente).toBe(false);
  });

  it("no publica ningún paquete retirado", () => {
    const ids = catalogoPublico().planes.map((p) => p.id);
    expect(ids).toEqual([...PLANES_OFRECIDOS]);
    expect(ids).not.toContain(RETIRADO.id);
    // Y dicho como regla y no como lista: todo lo publicado está vivo.
    for (const publicado of catalogoPublico().planes) {
      const def = PLANES_VIGENTES.find((d) => d.id === publicado.id);
      expect(def?.vigente, `${publicado.id} se publicó estando retirado`).toBe(true);
    }
    // Desde el 1 sep 2026 el catálogo arrastra uno de verdad
    // («ilimitado», que se retiró cuando Impulso pasó a ser el tope),
    // además del inventado acá arriba. Ninguno de los dos puede salir
    // publicado, y eso se comprueba como REGLA y no como lista.
    for (const id of PLANES_RETIRADOS) {
      expect(ids, `${id} se publicó estando retirado`).not.toContain(id);
    }
  });

  it("no filtra el nombre ni el precio de un paquete retirado", () => {
    const texto = JSON.stringify(catalogoPublico());
    expect(texto).not.toContain(RETIRADO.nombre);
    expect(texto).not.toContain(RETIRADO.descripcion);
    // «Pro» costaba $69 y se retiró: ese precio no puede aparecer en
    // ningún lado del cuerpo, ni suelto ni dentro de otra frase. Es el
    // precio que lleva el paquete inventado, justamente para que la
    // prueba tenga contra qué fallar.
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
  it("la Prueba son 5 clientes y NO VENCE — lo que la sostiene es el tope", () => {
    // Decisión del dueño: el paquete gratis dejó de ser una prueba de 14
    // días y pasó a ser gratis permanente. Lo que impide que se opere
    // gratis para siempre ya no es una fecha, son los 5 clientes.
    const prueba = catalogoPublico().planes.find((p) => p.id === "prueba");
    expect(prueba).toBeDefined();
    expect(prueba?.nombre).toBe("Prueba");
    expect(prueba?.precio).toBe("$0");
    expect(prueba?.esGratis).toBe(true);
    expect(prueba?.diasPrueba).toBe(0);
    expect(prueba?.etiquetaClientes).toBe("Hasta 5 clientes");
    expect(prueba?.notaPrecio).toBe("Gratis, sin vencimiento");
  });

  it("ningún paquete anuncia «0 días», que se leería como ya vencido", () => {
    // La línea chica sale de `diasPrueba`, y con el cero la fórmula vieja
    // escribía «0 días, sin tarjeta»: se lee como un error o, peor, como
    // que la prueba ya se terminó. Del otro lado hay una app instalada
    // que pinta este texto tal cual viene.
    const texto = JSON.stringify(catalogoPublico());
    expect(texto).not.toContain("0 días");
  });

  it("Arranque son $12, no ₡12 900, y su cupo es 100", () => {
    const arranque = catalogoPublico().planes.find((p) => p.id === "arranque");
    expect(arranque?.precio).toBe("$12");
    expect(arranque?.precioAnual).toBe("$115");
    expect(arranque?.notaPrecio).toBe("$115 al año — 20% menos");
    expect(arranque?.etiquetaClientes).toBe("Hasta 100 clientes");
  });

  it("Starter escribe sus 100 clientes", () => {
    const starter = catalogoPublico().planes.find((p) => p.id === "arranque");
    expect(starter?.precio).toBe("$12");
    expect(starter?.etiquetaClientes).toBe("Hasta 100 clientes");
    expect(starter?.topes.find((t) => t.id === "clientesActivos")?.valor).toBe(100);
  });

  it("Impulso es el único sin tope, y son $42", () => {
    // Desde el 1 sep 2026 Impulso es el paquete tope: se quedó con lo
    // que era de «Ilimitado», que se retiró del catálogo.
    const c = catalogoPublico();
    const impulso = c.planes.find((p) => p.id === "impulso");
    expect(impulso?.precio).toBe("$42");
    expect(impulso?.etiquetaClientes).toBe("Clientes ilimitados");
    const sinTope = c.planes.filter((p) => p.etiquetaClientes === "Clientes ilimitados");
    expect(sinTope).toHaveLength(1);
  });

  it("todos prometen Wallet, porque Wallet está en producción", () => {
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
