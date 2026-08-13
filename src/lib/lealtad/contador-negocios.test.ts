import { describe, expect, it } from "vitest";
import {
  altasDelDia,
  negociosAlaFecha,
  nuevosEstaSemana,
  textoDelContador,
} from "./contador-negocios";

const DIA = 86_400_000;
const ANCLA = new Date(Date.UTC(2026, 6, 1));

describe("altasDelDia", () => {
  it("nunca es negativa — es lo que hace que el total no pueda bajar", () => {
    for (let d = 0; d < 1200; d++) {
      expect(altasDelDia(d), `día ${d}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("es determinista: el mismo día siempre da lo mismo", () => {
    for (const d of [0, 7, 42, 365, 999]) {
      expect(altasDelDia(d)).toBe(altasDelDia(d));
    }
  });

  it("antes del ancla no suma nada", () => {
    expect(altasDelDia(-1)).toBe(0);
    expect(altasDelDia(-500)).toBe(0);
  });
});

describe("negociosAlaFecha", () => {
  /**
   * LA PRUEBA QUE IMPORTA.
   *
   * El pedido fue «progresivo y aleatorio pero EN ORDEN, llevando un
   * control positivo». Eso es monotonía. Si el martes dice 30 y el
   * miércoles 24, cualquiera que vio las dos pantallas sabe que el
   * número es inventado — y eso hace más daño que no ponerlo.
   *
   * Tres años, día por día. Si alguien alguna vez cambia la curva por
   * una que sortee el TOTAL en vez de acumular incrementos, este test
   * lo frena antes de que llegue a la portada.
   */
  it("NUNCA baja, ni un solo día en tres años", () => {
    let anterior = 0;
    for (let d = 0; d < 365 * 3; d++) {
      const hoy = negociosAlaFecha(new Date(ANCLA.getTime() + d * DIA));
      expect(hoy, `bajó el día ${d}: ${anterior} → ${hoy}`).toBeGreaterThanOrEqual(anterior);
      anterior = hoy;
    }
  });

  it("crece de verdad: en un año sube bastante más que la base", () => {
    const alAncla = negociosAlaFecha(ANCLA);
    const enUnAnio = negociosAlaFecha(new Date(ANCLA.getTime() + 365 * DIA));
    expect(enUnAnio).toBeGreaterThan(alAncla * 5);
  });

  it("antes del ancla se queda en la base, no da negativo", () => {
    const antes = negociosAlaFecha(new Date(Date.UTC(2020, 0, 1)));
    expect(antes).toBe(negociosAlaFecha(ANCLA));
    expect(antes).toBeGreaterThan(0);
  });

  it("dos llamadas del mismo día dan el mismo número", () => {
    const a = new Date(Date.UTC(2026, 8, 15, 3, 0, 0));
    const b = new Date(Date.UTC(2026, 8, 15, 22, 59, 0));
    expect(negociosAlaFecha(a)).toBe(negociosAlaFecha(b));
  });
});

describe("nuevosEstaSemana", () => {
  it("nunca es negativa", () => {
    for (let d = 0; d < 400; d++) {
      expect(nuevosEstaSemana(new Date(ANCLA.getTime() + d * DIA))).toBeGreaterThanOrEqual(0);
    }
  });

  /**
   * Las dos cifras de la franja salen de los MISMOS incrementos. Si se
   * calcularan por separado, un día el titular diría «+30 esta semana»
   * y el total habría subido 12, y eso se nota.
   */
  it("concuerda con lo que de verdad subió el total desde el lunes", () => {
    for (let d = 30; d < 200; d++) {
      const hoy = new Date(ANCLA.getTime() + d * DIA);
      const semana = nuevosEstaSemana(hoy);

      // Retrocedemos al domingo anterior y comparamos el salto real.
      const diaSemana = (d % 7 + 7) % 7;
      const desdeElLunes = (diaSemana + 6) % 7;
      const antesDelLunes = new Date(ANCLA.getTime() + (d - desdeElLunes - 1) * DIA);

      const salto = negociosAlaFecha(hoy) - negociosAlaFecha(antesDelLunes);
      expect(semana, `día ${d}`).toBe(salto);
    }
  });
});

describe("textoDelContador", () => {
  it("siempre devuelve las tres piezas, con números coherentes", () => {
    for (let d = 0; d < 120; d++) {
      const t = textoDelContador(new Date(ANCLA.getTime() + d * DIA));
      expect(t.cantidad).toBeGreaterThan(0);
      // El título habla del total O de la semana según el caso, así
      // que se verifica que traiga UN número, no cuál.
      expect(t.titulo).toMatch(/\+\d+ negocios/);
      expect(t.bajada.length).toBeGreaterThan(10);
    }
  });

  /**
   * Con una semana floja no se anuncia la semana: «+2 negocios nuevos»
   * se lee como que el producto no arranca. Ahí gana el total, que es
   * el número grande y sigue siendo el mismo dato.
   */
  it("con pocas altas semanales habla del total y no de la semana", () => {
    let encontroSemanaFloja = false;
    for (let d = 0; d < 400; d++) {
      const hoy = new Date(ANCLA.getTime() + d * DIA);
      if (nuevosEstaSemana(hoy) < 5) {
        encontroSemanaFloja = true;
        expect(textoDelContador(hoy).titulo).not.toContain("esta semana");
      }
    }
    expect(encontroSemanaFloja, "no hubo ninguna semana floja que probar").toBe(true);
  });
});
