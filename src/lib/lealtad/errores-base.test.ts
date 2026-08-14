import { describe, expect, it } from "vitest";
import {
  esColumnaAusente,
  faltaLaTabla,
  mensajeDeCheck,
  nombreDelCheck,
  traducirError,
} from "./errores-base";

/**
 * EL BUG QUE ESTAS PRUEBAS FIJAN.
 *
 * `guardarPrograma` reintenta sin las columnas nuevas cuando la
 * migración no está pegada. Decidía mirando si el mensaje MENCIONABA
 * el nombre de la columna — y los CHECK de la 0132/0145 llevan el
 * nombre de la columna adentro. Resultado: un valor rechazado por un
 * CHECK se reintentaba sin la banda, sin el icono y sin los textos, el
 * reintento funcionaba, y la pantalla decía «Guardado».
 *
 * O sea: el dueño elegía un icono, la base lo rechazaba, y el sistema
 * le borraba además la banda que ya tenía puesta y lo felicitaba.
 */

const COLUMNAS = [
  "pase_banner_url",
  "pase_sello_icono",
  "pase_codigo_formato",
  "pase_texto_reverso",
  "pase_mostrar_saldo",
  "pase_mostrar_progreso",
];

describe("esColumnaAusente — cuándo SÍ se degrada", () => {
  it("degrada cuando PostgREST no encuentra la columna (PGRST204)", () => {
    expect(
      esColumnaAusente(
        {
          code: "PGRST204",
          message: "Could not find the 'pase_sello_icono' column of 'programa_lealtad' in the schema cache",
        },
        COLUMNAS,
      ),
    ).toBe(true);
  });

  it("degrada con el undefined_column de Postgres (42703)", () => {
    expect(
      esColumnaAusente(
        { code: "42703", message: 'column "pase_banner_url" of relation "programa_lealtad" does not exist' },
        COLUMNAS,
      ),
    ).toBe(true);
  });

  it("sin `code`, todavía reconoce la frase de una columna que falta", () => {
    expect(
      esColumnaAusente(
        { message: "Could not find the 'pase_texto_reverso' column of 'programa_lealtad'" },
        COLUMNAS,
      ),
    ).toBe(true);
  });

  it("no degrada por una columna que el reintento no iba a soltar", () => {
    expect(
      esColumnaAusente(
        { code: "PGRST204", message: "Could not find the 'cuenta_id' column of 'programa_lealtad'" },
        COLUMNAS,
      ),
    ).toBe(false);
  });
});

describe("esColumnaAusente — el CHECK ya no se traga", () => {
  it("NO degrada una violación de CHECK aunque su nombre lleve la columna", () => {
    const error = {
      code: "23514",
      message:
        'new row for relation "programa_lealtad" violates check constraint "programa_lealtad_pase_sello_icono_check"',
    };
    expect(esColumnaAusente(error, COLUMNAS)).toBe(false);
  });

  it("tampoco con el CHECK del formato del código", () => {
    const error = {
      code: "23514",
      message:
        'new row for relation "programa_lealtad" violates check constraint "programa_lealtad_codigo_formato_check"',
    };
    expect(esColumnaAusente(error, [...COLUMNAS, "codigo_formato"])).toBe(false);
  });

  it("ni con el del texto del reverso", () => {
    const error = {
      code: "23514",
      message:
        'new row for relation "programa_lealtad" violates check constraint "programa_lealtad_texto_reverso_check"',
    };
    expect(esColumnaAusente(error, [...COLUMNAS, "texto_reverso"])).toBe(false);
  });
});

describe("nombreDelCheck", () => {
  it("saca el nombre del constraint violado", () => {
    expect(
      nombreDelCheck({
        code: "23514",
        message:
          'new row for relation "programa_lealtad" violates check constraint "programa_lealtad_dias_check"',
      }),
    ).toBe("programa_lealtad_dias_check");
  });

  it("devuelve null cuando el error no es un CHECK", () => {
    expect(nombreDelCheck({ code: "PGRST204", message: "Could not find the column" })).toBeNull();
    expect(nombreDelCheck({ message: 'violates check constraint "x"' })).toBeNull();
  });
});

describe("traducirError — lo que lee el dueño", () => {
  it("un CHECK conocido sale en palabras del negocio", () => {
    const texto = traducirError(
      {
        code: "23514",
        message:
          'new row for relation "programa_lealtad" violates check constraint "programa_lealtad_vigencia_check"',
      },
      "guardar el programa",
    );
    expect(texto).toBe("La fecha de vencimiento no puede ser anterior a la de inicio.");
  });

  it("un CHECK desconocido igual dice que fue un valor rechazado, no «faltan migraciones»", () => {
    const texto = traducirError(
      {
        code: "23514",
        message:
          'new row for relation "programa_lealtad" violates check constraint "programa_lealtad_inventado_check"',
      },
      "guardar el programa",
    );
    expect(texto).toContain("rechazó");
    expect(texto).not.toContain("migraciones");
  });

  it("la tabla que no existe sigue mandando a correr las migraciones", () => {
    expect(
      traducirError(
        { code: "42P01", message: 'relation "programa_lealtad" does not exist' },
        "guardar el programa",
      ),
    ).toContain("Faltan migraciones");
  });

  it("cualquier otra cosa se muestra tal cual, con el verbo de la acción", () => {
    expect(traducirError({ code: "500", message: "timeout" }, "guardar la recompensa")).toBe(
      "No se pudo guardar la recompensa: timeout",
    );
  });
});

describe("piezas sueltas", () => {
  it("mensajeDeCheck devuelve null para lo que no está en el diccionario", () => {
    expect(mensajeDeCheck("otro_check")).toBeNull();
    expect(mensajeDeCheck("programa_lealtad_topes_check")).toContain("topes");
  });

  it("faltaLaTabla solo mira las tablas de lealtad", () => {
    expect(faltaLaTabla('relation "programa_lealtad" does not exist')).toBe(true);
    expect(faltaLaTabla('relation "citas" does not exist')).toBe(false);
  });
});
