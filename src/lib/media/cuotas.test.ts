import { describe, expect, it } from "vitest";
import {
  LIMITE_COMERCIAL_ALBUM,
  LIMITE_TECNICO_ALBUM,
  MAX_BYTES,
  MAX_POR_TANDA,
  MAX_SUBIDAS_SIMULTANEAS,
  PAGINA_ALBUM,
  albumEsValido,
  estadoAlbum,
  puedeAgregarFotos,
  validarArchivo,
} from "./cuotas";
import { MAX_BYTES_IMAGEN } from "./tipos";

describe("los dos límites del álbum", () => {
  it("160 comercial, 500 técnico", () => {
    expect(LIMITE_COMERCIAL_ALBUM).toBe(160);
    expect(LIMITE_TECNICO_ALBUM).toBe(500);
  });

  it("la primera pantalla pide 20, suben de a 3, tandas de 10", () => {
    expect(PAGINA_ALBUM).toBe(20);
    expect(MAX_SUBIDAS_SIMULTANEAS).toBe(3);
    expect(MAX_POR_TANDA).toBe(10);
  });
});

describe("el álbum de 164 fotos que YA existe en producción", () => {
  // Es el caso que motiva tener dos límites y no uno.
  const ACTUALES = 164;

  it("sigue siendo válido: nadie tiene que borrarle nada", () => {
    expect(albumEsValido(ACTUALES)).toBe(true);
  });

  it("está lleno por cupo comercial, no por error", () => {
    expect(estadoAlbum(ACTUALES)).toBe("lleno-comercial");
  });

  it("no acepta fotos nuevas, y lo dice con amabilidad", () => {
    const r = puedeAgregarFotos({ actuales: ACTUALES, aAgregar: 1 });
    expect(r.ok).toBe(false);
    expect(r.permitidas).toBe(0);
    expect(r.motivo).toBe("album-lleno");
    expect(r.mensaje).toContain("160");
  });

  it("con un cupo mayor vuelve a tener lugar, sin haber tocado nada", () => {
    expect(puedeAgregarFotos({ actuales: ACTUALES, aAgregar: 5, limitePlan: 500 })).toEqual({
      ok: true,
      permitidas: 5,
    });
  });
});

describe("puedeAgregarFotos — cupo", () => {
  it("deja subir mientras haya lugar", () => {
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 10 })).toEqual({ ok: true, permitidas: 10 });
    expect(puedeAgregarFotos({ actuales: 150, aAgregar: 10 })).toEqual({ ok: true, permitidas: 10 });
  });

  it("en el borde exacto de 160 no entra una más", () => {
    expect(puedeAgregarFotos({ actuales: 159, aAgregar: 1 }).ok).toBe(true);
    expect(puedeAgregarFotos({ actuales: 160, aAgregar: 1 }).ok).toBe(false);
  });

  it("el techo técnico se reporta distinto del comercial", () => {
    const r = puedeAgregarFotos({ actuales: 500, aAgregar: 1, limitePlan: 500 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("tope-tecnico");
  });
});

describe("puedeAgregarFotos — tanda y cupo COMBINADOS", () => {
  it("con 159 fotos y 50 pedidas, informa 1 y no 10", () => {
    // El bug: el tope por tanda se revisaba primero y contestaba
    // "permitidas: 10" cuando quedaba un solo lugar.
    const r = puedeAgregarFotos({ actuales: 159, aAgregar: 50 });
    expect(r.ok).toBe(false);
    expect(r.permitidas).toBe(1);
    expect(r.motivo).toBe("album-lleno");
    expect(r.mensaje).toContain("1 lugar");
  });

  it("con 155 fotos y 10 pedidas, informa los 5 que quedan", () => {
    const r = puedeAgregarFotos({ actuales: 155, aAgregar: 10 });
    expect(r.ok).toBe(false);
    expect(r.permitidas).toBe(5);
    expect(r.motivo).toBe("album-lleno");
  });

  it("con lugar de sobra pero tanda muy grande, informa 10", () => {
    const r = puedeAgregarFotos({ actuales: 0, aAgregar: 50 });
    expect(r.ok).toBe(false);
    expect(r.permitidas).toBe(MAX_POR_TANDA);
    expect(r.motivo).toBe("tanda-muy-grande");
  });

  it("nunca sube una parte sin confirmación: si no caben todas, ok es false", () => {
    // 157 + 10 → caben 3. Antes devolvía ok:true con permitidas:3 y se
    // subían 3 de las 10 sin avisar cuáles.
    const r = puedeAgregarFotos({ actuales: 157, aAgregar: 10 });
    expect(r.ok).toBe(false);
    expect(r.permitidas).toBe(3);
  });

  it("pedir exactamente lo que cabe sí pasa", () => {
    expect(puedeAgregarFotos({ actuales: 157, aAgregar: 3 })).toEqual({ ok: true, permitidas: 3 });
    expect(puedeAgregarFotos({ actuales: 159, aAgregar: 1 })).toEqual({ ok: true, permitidas: 1 });
  });
});

describe("puedeAgregarFotos — validación de entradas", () => {
  it("rechaza cantidades no enteras o negativas", () => {
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 0 }).motivo).toBe("cantidad-invalida");
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: -3 }).motivo).toBe("cantidad-invalida");
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1.5 }).motivo).toBe("cantidad-invalida");
    expect(puedeAgregarFotos({ actuales: -1, aAgregar: 1 }).motivo).toBe("cantidad-invalida");
    expect(puedeAgregarFotos({ actuales: 2.5, aAgregar: 1 }).motivo).toBe("cantidad-invalida");
  });

  it("rechaza NaN e Infinity en las dos cantidades", () => {
    for (const malo of [NaN, Infinity, -Infinity]) {
      expect(puedeAgregarFotos({ actuales: malo, aAgregar: 1 }).motivo).toBe("cantidad-invalida");
      expect(puedeAgregarFotos({ actuales: 0, aAgregar: malo }).motivo).toBe("cantidad-invalida");
    }
  });

  it("rechaza un límite inválido en vez de dejarlo pasar", () => {
    // Un límite de 9999 abriría el álbum por encima del techo técnico.
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1, limitePlan: 9999 }).motivo).toBe(
      "limite-invalido",
    );
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1, limitePlan: 0 }).motivo).toBe(
      "limite-invalido",
    );
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1, limitePlan: -5 }).motivo).toBe(
      "limite-invalido",
    );
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1, limitePlan: 10.5 }).motivo).toBe(
      "limite-invalido",
    );
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1, limitePlan: NaN }).motivo).toBe(
      "limite-invalido",
    );
  });

  it("el límite exacto de 500 sí se acepta", () => {
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1, limitePlan: 500 }).ok).toBe(true);
  });

  it("albumEsValido rechaza basura sin reventar", () => {
    expect(albumEsValido(164)).toBe(true);
    expect(albumEsValido(500)).toBe(true);
    expect(albumEsValido(501)).toBe(false);
    expect(albumEsValido(-1)).toBe(false);
    expect(albumEsValido(1.5)).toBe(false);
    expect(albumEsValido(NaN)).toBe(false);
  });
});

describe("validarArchivo — el control del SERVIDOR", () => {
  it("acepta una foto normal", () => {
    expect(validarArchivo({ mime: "image/jpeg", bytes: 2 * 1024 * 1024 })).toEqual({
      ok: true,
      tipo: "imagen",
    });
  });

  it("rechaza un MIME que no está en la lista", () => {
    const r = validarArchivo({ mime: "application/zip", bytes: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("mime-no-permitido");
  });

  it("rechaza el archivo vacío y el tamaño ilegible", () => {
    expect(validarArchivo({ mime: "image/jpeg", bytes: 0 }).ok).toBe(false);
    expect(validarArchivo({ mime: "image/jpeg", bytes: "mucho" }).ok).toBe(false);
    expect(validarArchivo({ mime: "image/jpeg", bytes: NaN }).ok).toBe(false);
    expect(validarArchivo({ mime: "image/jpeg", bytes: Infinity }).ok).toBe(false);
    expect(validarArchivo({ mime: "image/jpeg", bytes: -5 }).ok).toBe(false);
  });
});

describe("imágenes y el tope de 10 MB de Cloudflare", () => {
  it("el archivo más pesado del bucket (5702 KB) se sigue aceptando", () => {
    // El más pesado medido en `ranchos-fotos`: 5,57 MB. Todo lo que ya
    // existe entra sin tocar nada.
    expect(validarArchivo({ mime: "image/jpeg", bytes: 5702 * 1024 })).toEqual({
      ok: true,
      tipo: "imagen",
    });
  });

  it("justo en 10 MB entra", () => {
    expect(validarArchivo({ mime: "image/jpeg", bytes: MAX_BYTES_IMAGEN }).ok).toBe(true);
  });

  it("una imagen de 12 MB se RECHAZA, no se guarda R2-only", () => {
    // Aceptarla crearía un asset que no se puede mostrar en ninguna
    // variante y que nunca podría completar el flujo dual.
    const r = validarArchivo({ mime: "image/jpeg", bytes: 12 * 1024 * 1024 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("muy-pesado");
      expect(r.mensaje).toContain("10 MB");
    }
  });

  it("el tope de imagen ES el de Cloudflare, no un número aparte", () => {
    expect(MAX_BYTES.imagen).toBe(MAX_BYTES_IMAGEN);
  });
});

describe("video y audio tienen sus propios topes", () => {
  it("un video de 12 MB sí entra (su tope es 100 MB)", () => {
    expect(validarArchivo({ mime: "video/mp4", bytes: 12 * 1024 * 1024 })).toEqual({
      ok: true,
      tipo: "video",
    });
  });

  it("un video de más de 100 MB no", () => {
    expect(validarArchivo({ mime: "video/mp4", bytes: MAX_BYTES.video + 1 }).ok).toBe(false);
  });

  it("un audio de más de 20 MB no", () => {
    expect(validarArchivo({ mime: "audio/mpeg", bytes: MAX_BYTES.audio + 1 }).ok).toBe(false);
    expect(validarArchivo({ mime: "audio/mpeg", bytes: MAX_BYTES.audio }).ok).toBe(true);
  });
});

describe("HEIC de iPhone", () => {
  it("se acepta por debajo de 10 MB — PERO falta la prueba real contra Cloudflare", () => {
    // Está en la lista por expectativa, no por medición. Hasta que se
    // pruebe con archivos de iOS 17 y 18 contra nuestra cuenta, tratar
    // el soporte como no confirmado (ver nota en tipos.ts).
    expect(validarArchivo({ mime: "image/heic", bytes: 4 * 1024 * 1024 })).toEqual({
      ok: true,
      tipo: "imagen",
    });
    expect(validarArchivo({ mime: "image/heif", bytes: 4 * 1024 * 1024 }).ok).toBe(true);
  });

  it("un HEIC de más de 10 MB se rechaza igual que cualquier imagen", () => {
    expect(validarArchivo({ mime: "image/heic", bytes: 11 * 1024 * 1024 }).ok).toBe(false);
  });
});
