import {
  tarjetaDesdeFila,
  disenoDeLaConfig,
  type ConfigPase,
} from "@/lib/wallet/tarjeta";
import { configPorDefecto, tipoDe } from "@/lib/lealtad/tipos-tarjeta";
import { selloParaGuardar } from "@/lib/lealtad/iconos-sello";
import type { DatosVista } from "@/components/lealtad/vista-pase";

/**
 * UNA FILA DE `programa_lealtad` → LO QUE DIBUJA LA VISTA PREVIA.
 *
 * ════════════════════════════════════════════════════════════════════
 *  POR QUÉ EXISTE: «los previews de las tarjetas nunca se parecen a
 *  cómo son realmente» (dueño, 1 sep 2026)
 * ════════════════════════════════════════════════════════════════════
 *
 * Tenía razón, y la causa no era el dibujo: era que CADA PANTALLA
 * armaba su propia previa. Había cuatro traducciones distintas de la
 * misma fila —el modal del admin, /lealtad/industrias, el menú inicial
 * y el panel—, y cada una se olvidaba de algo distinto:
 *
 *   · tres de las cuatro NO leían `pase_diseno` (0212), así que un
 *     negocio que movió sus sellos veía la grilla clásica en la previa
 *     y la suya en el teléfono;
 *   · una no leía la banda;
 *   · y `/tarjeta/<slug>` —la que ve el CLIENTE justo antes de bajar el
 *     pase— ni siquiera usaba `VistaPase`: dibujaba un rectángulo plano
 *     con circulitos, siempre de sellos, aunque la tarjeta fuera de
 *     cupón, de puntos o de cashback.
 *
 * Con una sola traducción, el día que se agregue una columna al pase
 * hay UN lugar que actualizar y las cinco pantallas se enteran juntas.
 *
 * ------------------------------------------------------------------
 * LO QUE ESTA FUNCIÓN NO DECIDE
 * ------------------------------------------------------------------
 * Ni los textos ni el layout. Eso lo resuelve `VistaPase` llamando a
 * `camposSegunModo()`, que es la MISMA función que arma el `pass.json`
 * que se firma. Acá solo se leen columnas y se les pone tipo.
 *
 * Sigue habiendo una diferencia legítima entre la previa y el pase: el
 * dibujo final lo hacen Apple y Google, no nosotros. Por eso `VistaPase`
 * lleva su aviso al pie — pero ahora esa es la ÚNICA diferencia, no una
 * excusa para que la previa muestre otra tarjeta.
 */
export function datosVistaDeFila(
  negocioNombre: string,
  /**
   * La fila cruda de `programa_lealtad`. Cruda a propósito: quien la
   * lee usa `select *` porque las columnas nuevas (0174, 0212) pueden
   * no existir todavía en una base sin migrar, y un tipo estricto acá
   * obligaría a prometer columnas que la migración quizá no corrió.
   */
  fila: Record<string, unknown>,
): DatosVista {
  const modo = typeof fila.modo === "string" ? fila.modo : null;
  const tipo = tipoDe(modo);

  // `tarjetaDesdeFila` es la MISMA lectura que hace el generador del
  // pase: colores, logo, banda y el par coherente del ícono del sello.
  // Leer las columnas a mano acá era la forma en que cada pantalla se
  // olvidaba de una distinta.
  const { config, beneficio } = tarjetaDesdeFila(fila);
  const sello = selloParaGuardar({
    tipo: fila.modo,
    icono: fila.pase_sello_icono,
    url: fila.pase_sello_icono_url,
  });

  return {
    negocioNombre,
    modo,
    // Sin beneficio guardado, el del tipo por defecto: es lo mismo que
    // hace el generador, así que la previa no inventa una tarjeta que
    // el teléfono no armaría.
    beneficio: beneficio ?? configPorDefecto(tipo),
    colorFondo: config.pase_color_fondo,
    colorSello: config.pase_color_sello,
    logoUrl: config.pase_logo_url,
    bannerUrl: config.pase_banner_url ?? null,
    iconoSello: sello.icono,
    iconoUrl: sello.url,
    // La geometría de la tira (0212). Es la que se olvidaban tres de
    // las cuatro pantallas: sin ella, un negocio que corrió sus sellos
    // veía la grilla clásica en la previa y la suya en el teléfono.
    diseno: disenoDeLaConfig(config as ConfigPase),
  };
}
