import { describe, expect, it } from "vitest";
import { canalDelMovimiento, ETIQUETA_CANAL } from "./canal-del-sello";

/**
 * LA TABLA DE PREFIJOS ES UN CONTRATO CON SEIS ARCHIVOS.
 *
 * Cada caso de acá abajo corresponde a la referencia que arma un camino
 * de entrega distinto. Si alguien cambia el prefijo en su archivo y no
 * acá, el badge del panel empieza a mentir en silencio — y un badge que
 * miente es peor que no tener badge. Estas pruebas son el ruido que
 * tiene que hacer ese cambio.
 */
describe("canalDelMovimiento — de qué puerta salió cada sello", () => {
  it("reconoce las referencias que arma cada camino", () => {
    // atencion-manual.tsx:157 → `mostrador:${llaveDeIntento()}`
    expect(canalDelMovimiento({ referencia: "mostrador:a1b2c3" })).toBe("mostrador");
    // escaner-actions.ts → `escaneo:${serial}:${intento}`
    expect(canalDelMovimiento({ referencia: "escaneo:ABC123:x9" })).toBe("escaner");
    // lealtad-operar-actions.ts → `panel:{miembro}:{monto}:{minuto}`
    expect(canalDelMovimiento({ referencia: "panel:m-1:visita:2026-08-17T10:00" })).toBe("panel");
    // el canje también sale del panel
    expect(canalDelMovimiento({ referencia: "canje:xyz" })).toBe("panel");
    // api/lealtad/v1 → prefijo obligatorio en entrada.ts
    expect(canalDelMovimiento({ referencia: "api:factura-99" })).toBe("api");
    // motor.ts, por una cita marcada como cumplida
    expect(canalDelMovimiento({ referencia: "cita:reserva-7" })).toBe("cita");
    // vencer-sellos.ts, el cron
    expect(canalDelMovimiento({ referencia: "venc:2026-08-01" })).toBe("vencimiento");
  });

  it("la llave de API gana sobre cualquier referencia", () => {
    // La 0178 puso `llave_id` para poder revertir en bloque lo de una
    // llave filtrada: es la única señal estructurada de la tabla y no la
    // puede pisar un integrador mandando la referencia que se le ocurra.
    expect(canalDelMovimiento({ referencia: "mostrador:trucho", llaveId: "llave-1" })).toBe("api");
    expect(canalDelMovimiento({ referencia: null, llaveId: "llave-1" })).toBe("api");
  });

  it("el número de factura del POS borra el prefijo, y eso se admite", () => {
    // No hay prefijo, pero hay una persona del equipo detrás: es el
    // panel con la factura como referencia. Es una respuesta menos
    // precisa, y está documentada como tal en la cabecera del módulo.
    expect(canalDelMovimiento({ referencia: "FE-000123", usuarioId: "u-1" })).toBe("panel");
  });

  it("sin nada con qué decidir, lo dice — no adivina", () => {
    expect(canalDelMovimiento({})).toBe("desconocido");
    expect(canalDelMovimiento({ referencia: "  ", usuarioId: null })).toBe("desconocido");
    // Y se lee como una ausencia, no como un canal inventado.
    expect(ETIQUETA_CANAL.desconocido).toBe("sin origen");
  });
});
