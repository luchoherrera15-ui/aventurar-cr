import { describe, expect, it } from "vitest";
import {
  HORAS_VIGENCIA_ZIP,
  LIMITE_COMERCIAL_ALBUM,
  LIMITE_TECNICO_ALBUM,
  LIMITES_PLAN,
  MAX_BYTES,
  MAX_BYTES_CLOUDFLARE,
  MAX_POR_TANDA,
  MAX_SUBIDAS_SIMULTANEAS,
  PAGINA_ALBUM,
  admiteCopiaVisual,
  albumEsValido,
  cabeEnCuota,
  esMimePermitido,
  estadoAlbum,
  firmaDeAlbum,
  limitesDe,
  puedeAgregarFotos,
  tipoDeMime,
  validarArchivo,
  zipSigueValido,
} from "./cuotas";

describe("los dos límites del álbum", () => {
  it("160 comercial, 500 técnico", () => {
    expect(LIMITE_COMERCIAL_ALBUM).toBe(160);
    expect(LIMITE_TECNICO_ALBUM).toBe(500);
  });

  it("la primera pantalla pide 20 y suben de a 3", () => {
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

  it("con un plan pro vuelve a tener lugar, sin haber tocado nada", () => {
    const r = puedeAgregarFotos({ actuales: ACTUALES, aAgregar: 5, limitePlan: LIMITE_TECNICO_ALBUM });
    expect(r).toEqual({ ok: true, permitidas: 5 });
  });
});

describe("puedeAgregarFotos", () => {
  it("deja subir mientras haya lugar", () => {
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 10 })).toEqual({ ok: true, permitidas: 10 });
    expect(puedeAgregarFotos({ actuales: 150, aAgregar: 10 })).toEqual({ ok: true, permitidas: 10 });
  });

  it("en el borde exacto de 160 no entra una más", () => {
    expect(puedeAgregarFotos({ actuales: 159, aAgregar: 1 }).ok).toBe(true);
    expect(puedeAgregarFotos({ actuales: 160, aAgregar: 1 }).ok).toBe(false);
  });

  it("cuando quedan menos lugares que fotos, sube las que entran", () => {
    const r = puedeAgregarFotos({ actuales: 157, aAgregar: 10 });
    expect(r.ok).toBe(true);
    expect(r.permitidas).toBe(3);
    expect(r.mensaje).toContain("3");
  });

  it("respeta el tope por tanda", () => {
    const r = puedeAgregarFotos({ actuales: 0, aAgregar: 50 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("tanda-muy-grande");
  });

  it("el techo técnico le gana a un plan generoso", () => {
    const r = puedeAgregarFotos({ actuales: 500, aAgregar: 1, limitePlan: 9999 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("tope-tecnico");
  });

  it("rechaza cantidades absurdas sin reventar", () => {
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 0 }).motivo).toBe("cantidad-invalida");
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: -3 }).motivo).toBe("cantidad-invalida");
    expect(puedeAgregarFotos({ actuales: -1, aAgregar: 1 }).motivo).toBe("cantidad-invalida");
    expect(puedeAgregarFotos({ actuales: 0, aAgregar: 1.5 }).motivo).toBe("cantidad-invalida");
  });
});

describe("MIME", () => {
  it("acepta los formatos de foto que se usan de verdad", () => {
    for (const m of ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"]) {
      expect(esMimePermitido(m)).toBe(true);
      expect(tipoDeMime(m)).toBe("imagen");
    }
  });

  it("rechaza lo que no es media", () => {
    for (const m of ["application/zip", "text/html", "image/svg+xml", "application/pdf", ""]) {
      expect(esMimePermitido(m)).toBe(false);
    }
  });

  it("no se cae con basura", () => {
    for (const m of [null, undefined, 42, {}]) expect(esMimePermitido(m)).toBe(false);
  });

  it("tolera el charset pegado y las mayúsculas", () => {
    expect(tipoDeMime("IMAGE/JPEG; charset=binary")).toBe("imagen");
  });

  it("clasifica video y audio", () => {
    expect(tipoDeMime("video/mp4")).toBe("video");
    expect(tipoDeMime("audio/mpeg")).toBe("audio");
  });
});

describe("validarArchivo — el control del SERVIDOR", () => {
  it("acepta una foto normal", () => {
    expect(validarArchivo({ mime: "image/jpeg", bytes: 2 * 1024 * 1024 })).toEqual({
      ok: true,
      tipo: "imagen",
      copiaVisual: true,
    });
  });

  it("rechaza un MIME que no está en la lista", () => {
    const r = validarArchivo({ mime: "application/zip", bytes: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("mime-no-permitido");
  });

  it("rechaza lo demasiado pesado, por tipo", () => {
    const r = validarArchivo({ mime: "image/jpeg", bytes: MAX_BYTES.imagen + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe("muy-pesado");
      expect(r.mensaje).toContain("25 MB");
    }
    // Un video del mismo peso sí entra: su tope es otro.
    expect(validarArchivo({ mime: "video/mp4", bytes: MAX_BYTES.imagen + 1 }).ok).toBe(true);
  });

  it("rechaza el archivo vacío y el tamaño ilegible", () => {
    expect(validarArchivo({ mime: "image/jpeg", bytes: 0 }).ok).toBe(false);
    expect(validarArchivo({ mime: "image/jpeg", bytes: "mucho" }).ok).toBe(false);
    expect(validarArchivo({ mime: "image/jpeg", bytes: NaN }).ok).toBe(false);
    expect(validarArchivo({ mime: "image/jpeg", bytes: -5 }).ok).toBe(false);
  });

  it("una foto grande va a R2 pero NO a Cloudflare Images", () => {
    const grande = MAX_BYTES_CLOUDFLARE + 1;
    const r = validarArchivo({ mime: "image/jpeg", bytes: grande });
    expect(r).toEqual({ ok: true, tipo: "imagen", copiaVisual: false });
    expect(admiteCopiaVisual("image/jpeg", grande)).toBe(false);
    expect(admiteCopiaVisual("image/jpeg", MAX_BYTES_CLOUDFLARE)).toBe(true);
  });

  it("un video nunca lleva copia visual", () => {
    expect(admiteCopiaVisual("video/mp4", 1000)).toBe(false);
  });

  it("el archivo más pesado del bucket (5702 KB) entra entero, con copia visual", () => {
    // El más pesado medido en `ranchos-fotos`: 5,57 MB, por debajo del
    // tope de 10 MB de Cloudflare Images. O sea que TODO lo que hay hoy
    // en el bucket se puede migrar sin casos especiales.
    const r = validarArchivo({ mime: "image/jpeg", bytes: 5702 * 1024 });
    expect(r).toEqual({ ok: true, tipo: "imagen", copiaVisual: true });
  });

  it("una foto de 12 MB se guarda igual, pero sin copia visual", () => {
    // El caso que hay que probar contra Cloudflare de verdad antes de
    // confiar en él (matriz de validación del plan).
    const r = validarArchivo({ mime: "image/jpeg", bytes: 12 * 1024 * 1024 });
    expect(r).toEqual({ ok: true, tipo: "imagen", copiaVisual: false });
  });
});

describe("planes y cuota", () => {
  it("ningún plan puede pasar el techo técnico", () => {
    for (const p of Object.values(LIMITES_PLAN)) {
      expect(p.fotosPorAlbum).toBeLessThanOrEqual(LIMITE_TECNICO_ALBUM);
    }
  });

  it("un plan desconocido cae en el MÁS CHICO, no en el más grande", () => {
    expect(limitesDe("enterprise")).toEqual(LIMITES_PLAN.gratis);
    expect(limitesDe(null)).toEqual(LIMITES_PLAN.gratis);
    expect(limitesDe(undefined)).toEqual(LIMITES_PLAN.gratis);
    expect(limitesDe("pro")).toEqual(LIMITES_PLAN.pro);
  });

  it("cabeEnCuota mira lo que queda", () => {
    const limite = LIMITES_PLAN.gratis.bytesPorCuenta;
    expect(cabeEnCuota({ usados: 0, aAgregar: 1024, plan: "gratis" }).ok).toBe(true);
    const lleno = cabeEnCuota({ usados: limite, aAgregar: 1, plan: "gratis" });
    expect(lleno.ok).toBe(false);
    expect(lleno.disponibles).toBe(0);
  });
});

describe("invalidación del ZIP", () => {
  const AHORA = new Date("2026-08-09T12:00:00Z");
  const RECIEN = new Date("2026-08-09T11:00:00Z");
  const IDS = ["a", "b", "c"];

  it("sigue valiendo si nada cambió y es reciente", () => {
    expect(
      zipSigueValido({
        firmaGuardada: firmaDeAlbum(IDS),
        fotoIdsActuales: IDS,
        generadoEn: RECIEN,
        ahora: AHORA,
      }),
    ).toBe(true);
  });

  it("se invalida si AGREGAN una foto", () => {
    expect(
      zipSigueValido({
        firmaGuardada: firmaDeAlbum(IDS),
        fotoIdsActuales: [...IDS, "d"],
        generadoEn: RECIEN,
        ahora: AHORA,
      }),
    ).toBe(false);
  });

  it("se invalida si BORRAN una foto", () => {
    expect(
      zipSigueValido({
        firmaGuardada: firmaDeAlbum(IDS),
        fotoIdsActuales: ["a", "b"],
        generadoEn: RECIEN,
        ahora: AHORA,
      }),
    ).toBe(false);
  });

  it("se invalida si REORDENAN (los nombres del ZIP van numerados)", () => {
    expect(
      zipSigueValido({
        firmaGuardada: firmaDeAlbum(IDS),
        fotoIdsActuales: ["c", "b", "a"],
        generadoEn: RECIEN,
        ahora: AHORA,
      }),
    ).toBe(false);
  });

  it("se invalida al vencer", () => {
    const viejo = new Date(AHORA.getTime() - (HORAS_VIGENCIA_ZIP + 1) * 3_600_000);
    expect(
      zipSigueValido({
        firmaGuardada: firmaDeAlbum(IDS),
        fotoIdsActuales: IDS,
        generadoEn: viejo,
        ahora: AHORA,
      }),
    ).toBe(false);
  });

  it("sin ZIP previo, no hay nada que reusar", () => {
    expect(
      zipSigueValido({
        firmaGuardada: null,
        fotoIdsActuales: IDS,
        generadoEn: null,
        ahora: AHORA,
      }),
    ).toBe(false);
  });

  it("la firma distingue orden y cantidad", () => {
    expect(firmaDeAlbum(["a", "b"])).not.toBe(firmaDeAlbum(["b", "a"]));
    expect(firmaDeAlbum(["a"])).not.toBe(firmaDeAlbum(["a", "b"]));
  });
});
