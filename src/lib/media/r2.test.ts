import { describe, expect, it, vi } from "vitest";

/**
 * `server-only` es un paquete centinela: su `index.js` LANZA siempre,
 * salvo bajo la condición de exportación `react-server` que activa el
 * bundler de Next. En Vitest (Node a secas) esa condición no existe, así
 * que importar el módulo bajo prueba explotaría antes de la primera
 * aserción.
 *
 * Se reemplaza por un módulo vacío, que es exactamente lo que Next le
 * entrega al servidor. El `import "server-only"` NO se quita del código
 * de producción: es la barrera que hace fallar el build si alguien lo
 * importa desde un componente de cliente.
 *
 * `vi.mock` se iza por encima de los imports, así que esto corre antes.
 */
vi.mock("server-only", () => ({}));

import {
  EXPIRACION_DESCARGA_S,
  EXPIRACION_MAXIMA_S,
  EXPIRACION_MINIMA_S,
  borrarObjeto,
  configuracionR2,
  existeObjeto,
  firmarDescarga,
  firmarSubida,
  obtenerMetadatos,
  r2Configurado,
  verificarMetadatosOriginal,
  type DependenciasR2,
} from "./r2";

/**
 * NINGUNA prueba de este archivo toca la red.
 *
 * Se inyectan `cliente` y `presignar`, que son las dos únicas puertas
 * hacia afuera del módulo. El `entorno` también se inyecta, así que las
 * pruebas no dependen de que la máquina tenga credenciales — ni de que
 * NO las tenga, que es el error opuesto y más difícil de ver.
 */

const ENTORNO_COMPLETO = {
  R2_ACCESS_KEY_ID: "id-de-prueba",
  R2_SECRET_ACCESS_KEY: "secreto-de-prueba",
  R2_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com",
  R2_REGION: "auto",
  R2_BUCKET_ORIGINALS: "originales",
} as unknown as NodeJS.ProcessEnv;

const CLAVE = "originals/usuario/album/entidad/asset/foto.jpg";

/** Un doble del cliente S3: registra qué comando recibió y responde. */
function clienteFalso(respuesta: unknown | (() => never)) {
  const enviados: unknown[] = [];
  const cliente = {
    send: vi.fn(async (comando: unknown) => {
      enviados.push(comando);
      if (typeof respuesta === "function") return (respuesta as () => never)();
      return respuesta;
    }),
  };
  return { cliente, enviados };
}

function deps(over: Partial<DependenciasR2> = {}): DependenciasR2 {
  return {
    entorno: ENTORNO_COMPLETO,
    presignar: vi.fn(async () => "https://firmada.example/objeto?X-Amz-Signature=abc"),
    ...over,
  } as DependenciasR2;
}

// ------------------------------------------------------------

describe("configuración del entorno", () => {
  it("importar el módulo NO exige credenciales", () => {
    // Si el módulo leyera process.env arriba del archivo, este import
    // ya habría reventado y `next build` con él.
    expect(typeof configuracionR2).toBe("function");
  });

  it("con las cinco variables devuelve la configuración", () => {
    const r = configuracionR2(ENTORNO_COMPLETO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.bucket).toBe("originales");
    expect(r2Configurado(ENTORNO_COMPLETO)).toBe(true);
  });

  it("con el entorno vacío falla y NOMBRA las que faltan", () => {
    const r = configuracionR2({} as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("config-incompleta");
      expect(r.error.mensaje).toContain("R2_ACCESS_KEY_ID");
      expect(r.error.mensaje).toContain("R2_BUCKET_ORIGINALS");
    }
    expect(r2Configurado({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("un entorno INCOMPLETO nombra solo lo que falta", () => {
    const parcial = { ...ENTORNO_COMPLETO, R2_SECRET_ACCESS_KEY: "" } as NodeJS.ProcessEnv;
    const r = configuracionR2(parcial);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.mensaje).toContain("R2_SECRET_ACCESS_KEY");
      expect(r.error.mensaje).not.toContain("R2_ENDPOINT");
    }
  });

  it("el mensaje de error NUNCA trae el valor de un secreto", () => {
    const r = configuracionR2({ ...ENTORNO_COMPLETO, R2_ENDPOINT: "" } as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.mensaje).not.toContain("secreto-de-prueba");
  });

  it("una operación con el entorno incompleto falla sin intentar firmar", async () => {
    const presignar = vi.fn();
    const r = await firmarSubida(
      { clave: CLAVE, mime: "image/jpeg", bytes: 1000 },
      { entorno: {} as NodeJS.ProcessEnv, presignar: presignar as never },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("config-incompleta");
    expect(presignar).not.toHaveBeenCalled();
  });
});

describe("firmarSubida", () => {
  it("firma un PUT y devuelve las cabeceras obligatorias", async () => {
    const d = deps();
    const r = await firmarSubida({ clave: CLAVE, mime: "image/jpeg", bytes: 1234 }, d);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.url).toContain("https://");
      expect(r.valor.clave).toBe(CLAVE);
      expect(r.valor.cabeceras["Content-Type"]).toBe("image/jpeg");
      expect(r.valor.cabeceras["If-None-Match"]).toBe("*");
    }
    expect(d.presignar).toHaveBeenCalledTimes(1);
  });

  it("el tipo, el tamaño y If-None-Match van DENTRO de la firma", async () => {
    const d = deps();
    await firmarSubida({ clave: CLAVE, mime: "image/png", bytes: 99 }, d);
    const opciones = (d.presignar as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][2] as {
      signableHeaders: Set<string>;
    };
    // Sin esto, la URL para "una foto de 99 bytes" serviría para subir
    // cualquier cosa de cualquier tamaño.
    expect(opciones.signableHeaders.has("content-type")).toBe(true);
    expect(opciones.signableHeaders.has("content-length")).toBe(true);
    // Y sin esto, la URL serviría para SOBRESCRIBIR un objeto ya sellado.
    expect(opciones.signableHeaders.has("if-none-match")).toBe(true);
  });

  it("el comando lleva IfNoneMatch: '*' (escritura condicional)", async () => {
    const d = deps();
    await firmarSubida({ clave: CLAVE, mime: "image/jpeg", bytes: 10 }, d);
    const comando = (d.presignar as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as { input: { IfNoneMatch?: string } };
    expect(comando.input.IfNoneMatch).toBe("*");
  });

  it("devuelve If-None-Match pero NO Content-Length (cabecera prohibida)", async () => {
    // `fetch` no deja establecer Content-Length; el navegador la manda
    // sola. Pedírsela al frontend sería pedirle algo imposible.
    const r = await firmarSubida({ clave: CLAVE, mime: "image/jpeg", bytes: 10 }, deps());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.cabeceras["If-None-Match"]).toBe("*");
      expect(r.valor.cabeceras["Content-Type"]).toBe("image/jpeg");
      expect(r.valor.cabeceras).not.toHaveProperty("Content-Length");
    }
  });

  it("rechaza una clave con traversal antes de firmar", async () => {
    const d = deps();
    const r = await firmarSubida({ clave: "originals/../otro.jpg", mime: "image/jpeg", bytes: 1 }, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("clave-invalida");
    expect(d.presignar).not.toHaveBeenCalled();
  });

  it("rechaza claves vacías, absolutas y con caracteres raros", async () => {
    for (const clave of ["", "/absoluta/x.jpg", "a//b.jpg", "a b.jpg", "a\\b.jpg"]) {
      const r = await firmarSubida({ clave, mime: "image/jpeg", bytes: 1 }, deps());
      expect(r.ok, clave).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("clave-invalida");
    }
  });

  it("rechaza un MIME que no está permitido", async () => {
    const r = await firmarSubida({ clave: CLAVE, mime: "application/zip", bytes: 10 }, deps());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("mime-invalido");
  });

  it("rechaza un tamaño imposible", async () => {
    for (const bytes of [0, -5, 1.5, NaN]) {
      const r = await firmarSubida({ clave: CLAVE, mime: "image/jpeg", bytes }, deps());
      expect(r.ok, String(bytes)).toBe(false);
    }
  });
});

describe("límites de expiración", () => {
  it("rechaza por debajo del mínimo y por encima del máximo", async () => {
    for (const seg of [EXPIRACION_MINIMA_S - 1, EXPIRACION_MAXIMA_S + 1, 0, -60]) {
      const r = await firmarDescarga(
        { clave: CLAVE, nombreArchivo: "f.jpg", expiraEnSegundos: seg },
        deps(),
      );
      expect(r.ok, String(seg)).toBe(false);
      if (!r.ok) expect(r.error.codigo).toBe("expiracion-invalida");
    }
  });

  it("rechaza una expiración que no es entera", async () => {
    const r = await firmarDescarga(
      { clave: CLAVE, nombreArchivo: "f.jpg", expiraEnSegundos: 90.5 },
      deps(),
    );
    expect(r.ok).toBe(false);
  });

  it("acepta justo los bordes", async () => {
    for (const seg of [EXPIRACION_MINIMA_S, EXPIRACION_MAXIMA_S]) {
      const r = await firmarDescarga(
        { clave: CLAVE, nombreArchivo: "f.jpg", expiraEnSegundos: seg },
        deps(),
      );
      expect(r.ok, String(seg)).toBe(true);
    }
  });

  it("la descarga usa 15 minutos por defecto", async () => {
    expect(EXPIRACION_DESCARGA_S).toBe(900);
    const r = await firmarDescarga({ clave: CLAVE, nombreArchivo: "f.jpg" }, deps());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.expiraEnSegundos).toBe(900);
  });
});

describe("firmarDescarga y el nombre del archivo", () => {
  it("sanea el nombre y fuerza attachment", async () => {
    const d = deps();
    const r = await firmarDescarga(
      { clave: CLAVE, nombreArchivo: "../../Cumpleaños de Mamá.JPG" },
      d,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.nombreArchivo).toBe("Cumpleanos-de-Mama.jpg");

    const comando = (d.presignar as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0][1] as { input: { ResponseContentDisposition?: string } };
    const disposition = comando.input.ResponseContentDisposition ?? "";
    expect(disposition.startsWith("attachment;")).toBe(true);
    expect(disposition).toContain("filename*=UTF-8''");
    // El nombre saneado no puede reintroducir una ruta.
    expect(disposition).not.toContain("..");
  });
});

describe("obtenerMetadatos (HEAD)", () => {
  it("devuelve tamaño, tipo y etag", async () => {
    const { cliente } = clienteFalso({
      ContentLength: 2048,
      ContentType: "image/jpeg",
      ETag: '"abc123"',
      LastModified: new Date("2026-08-10T12:00:00Z"),
    });
    const r = await obtenerMetadatos({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.bytes).toBe(2048);
      expect(r.valor.mime).toBe("image/jpeg");
      expect(r.valor.etag).toBe('"abc123"');
      expect(r.valor.modificadoEn).toBe("2026-08-10T12:00:00.000Z");
    }
  });

  it("el ETag se expone tal cual y NO como checksum", async () => {
    // Un ETag de subida multiparte es un hash de hashes con sufijo -N:
    // no es el SHA-256 del contenido y no puede usarse como tal.
    const { cliente } = clienteFalso({
      ContentLength: 10,
      ContentType: "image/jpeg",
      ETag: '"d41d8cd98f00b204e9800998ecf8427e-3"',
    });
    const r = await obtenerMetadatos({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.etag).toContain("-3");
      expect(r.valor).not.toHaveProperty("checksum_sha256");
      expect(r.valor).not.toHaveProperty("sha256");
    }
  });

  it("un objeto inexistente da 'no-existe', no un fallo genérico", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error("no está") as Error & { name: string };
      e.name = "NotFound";
      throw e;
    });
    const r = await obtenerMetadatos({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("no-existe");
  });

  it("rechaza una clave insegura sin llamar a R2", async () => {
    const { cliente } = clienteFalso({});
    const r = await obtenerMetadatos({ clave: "../fuga" }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("clave-invalida");
    expect(cliente.send).not.toHaveBeenCalled();
  });
});

describe("errores del SDK sanitizados", () => {
  it("no filtra la URL firmada ni las credenciales del error original", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error(
        "failed: https://cuenta.r2.cloudflarestorage.com/x?X-Amz-Credential=SECRETO123",
      ) as Error & { name: string; $metadata: { httpStatusCode: number } };
      e.name = "AccessDenied";
      e.$metadata = { httpStatusCode: 403 };
      throw e;
    });
    const r = await obtenerMetadatos({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("fallo-proveedor");
      expect(r.error.mensaje).toContain("AccessDenied");
      expect(r.error.mensaje).toContain("403");
      // Lo que importa: nada del cuerpo del error original.
      expect(r.error.mensaje).not.toContain("SECRETO123");
      expect(r.error.mensaje).not.toContain("X-Amz-Credential");
    }
  });

  it("un error sin nombre ni metadata tampoco revienta", async () => {
    const { cliente } = clienteFalso(() => {
      throw "algo raro";
    });
    const r = await obtenerMetadatos({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("fallo-proveedor");
  });
});

describe("verificarMetadatosOriginal — compara metadatos, NO contenido", () => {
  const metadatosOk = { ContentLength: 5000, ContentType: "image/jpeg", ETag: '"x"' };

  it("con tamaño y tipo correctos, pasa", async () => {
    const { cliente } = clienteFalso(metadatosOk);
    const r = await verificarMetadatosOriginal(
      { clave: CLAVE, bytesEsperados: 5000, mimeEsperado: "image/jpeg" },
      deps({ cliente: cliente as never }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.metadatos.bytes).toBe(5000);
  });

  it("DECLARA qué comparó y qué no", async () => {
    // El nombre viejo (`verificarOriginal`) prometía de más. Esto es lo
    // que impide que el bloque siguiente escriba `r2_verificado_en`
    // creyendo que se validó el archivo.
    const { cliente } = clienteFalso(metadatosOk);
    const r = await verificarMetadatosOriginal(
      { clave: CLAVE, bytesEsperados: 5000, mimeEsperado: "image/jpeg" },
      deps({ cliente: cliente as never }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.comprobado).toEqual(["existe", "bytes", "content-type-declarado"]);
      expect(r.valor.sinComprobar).toEqual(["contenido-real", "magic-bytes", "checksum-sha256"]);
    }
  });

  it("tolera el charset pegado al Content-Type", async () => {
    const { cliente } = clienteFalso({ ...metadatosOk, ContentType: "image/jpeg; charset=binary" });
    const r = await verificarMetadatosOriginal(
      { clave: CLAVE, bytesEsperados: 5000, mimeEsperado: "image/jpeg" },
      deps({ cliente: cliente as never }),
    );
    expect(r.ok).toBe(true);
  });

  it("con un tamaño distinto, NO pasa", async () => {
    const { cliente } = clienteFalso(metadatosOk);
    const r = await verificarMetadatosOriginal(
      { clave: CLAVE, bytesEsperados: 4999, mimeEsperado: "image/jpeg" },
      deps({ cliente: cliente as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.codigo).toBe("tamano-distinto");
      expect(r.error.mensaje).toContain("5000");
    }
  });

  it("con un MIME distinto, NO pasa", async () => {
    const { cliente } = clienteFalso(metadatosOk);
    const r = await verificarMetadatosOriginal(
      { clave: CLAVE, bytesEsperados: 5000, mimeEsperado: "image/png" },
      deps({ cliente: cliente as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("mime-distinto");
  });

  it("si el objeto no existe, tampoco", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error("nada") as Error & { name: string };
      e.name = "NotFound";
      throw e;
    });
    const r = await verificarMetadatosOriginal(
      { clave: CLAVE, bytesEsperados: 1, mimeEsperado: "image/jpeg" },
      deps({ cliente: cliente as never }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe("no-existe");
  });

  it("un Content-Type mentiroso pasa igual: por eso faltan los magic bytes", async () => {
    // R2 devuelve el Content-Type que se FIRMÓ al subir. Si alguien pidió
    // una URL declarando image/jpeg y subió otra cosa, esto no lo nota.
    // Queda como prueba de la limitación, no de una virtud.
    const { cliente } = clienteFalso({ ContentLength: 12, ContentType: "image/jpeg" });
    const r = await verificarMetadatosOriginal(
      { clave: CLAVE, bytesEsperados: 12, mimeEsperado: "image/jpeg" },
      deps({ cliente: cliente as never }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor.sinComprobar).toContain("magic-bytes");
  });
});

describe("existeObjeto", () => {
  it("true cuando está", async () => {
    const { cliente } = clienteFalso({ ContentLength: 1, ContentType: "image/jpeg" });
    const r = await existeObjeto({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r).toEqual({ ok: true, valor: true });
  });

  it("false cuando no está", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error("nada") as Error & { name: string };
      e.name = "NotFound";
      throw e;
    });
    const r = await existeObjeto({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r).toEqual({ ok: true, valor: false });
  });

  it("un fallo real NO se confunde con 'no existe'", async () => {
    const { cliente } = clienteFalso(() => {
      const e = new Error("x") as Error & { name: string };
      e.name = "AccessDenied";
      throw e;
    });
    const r = await existeObjeto({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(false);
  });
});

describe("borrarObjeto", () => {
  it("borra y devuelve la clave", async () => {
    const { cliente } = clienteFalso({});
    const r = await borrarObjeto({ clave: CLAVE }, deps({ cliente: cliente as never }));
    expect(r).toEqual({ ok: true, valor: { clave: CLAVE } });
    expect(cliente.send).toHaveBeenCalledTimes(1);
  });

  it("no borra con una clave insegura", async () => {
    const { cliente } = clienteFalso({});
    const r = await borrarObjeto({ clave: "../../todo" }, deps({ cliente: cliente as never }));
    expect(r.ok).toBe(false);
    expect(cliente.send).not.toHaveBeenCalled();
  });
});
