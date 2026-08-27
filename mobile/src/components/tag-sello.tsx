import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Fonts } from "@/constants/theme";

/**
 * ════════════════════════════════════════════════════════════════════
 *  EL SELLO DE UNA TARJETA — el gemelo del de la web
 * ════════════════════════════════════════════════════════════════════
 *
 * La app mostraba su tag «NUEVO» donde la web ya muestra «Verificado» o
 * «Info pública» (migraciones 0214 y 0217). Dos personas mirando el
 * mismo negocio veían cosas distintas, y una de ellas —la del
 * teléfono— no tenía forma de saber si alguien respondía por esa ficha.
 *
 *   Verificado    → hay una persona real detrás: el dueño la publicó, o
 *                   nos pasó sus datos y la cargamos por él.
 *   Info pública  → la armamos desde fuentes públicas y NADIE de ese
 *                   negocio participó.
 *
 * ── LOS COLORES SON LOS MEDIDOS EN LA WEB ───────────────────────────
 *
 * Verde `emerald-700` (#047857) para el texto: 5,48:1 sobre blanco, que
 * pasa el 4,5:1 de AA. El verde intuitivo (`emerald-500`) da 2,54:1 y
 * no pasa — en un elemento cuyo único trabajo es que se le crea, un
 * texto que cuesta leer trabaja en contra.
 *
 * «Info pública» va en pizarra y con un globo, no en verde con un ✓: el
 * ✓ dice «confirmado» y esto no lo está.
 */

export type EstadoSello = "verificado" | "info-publica";

/**
 * Qué sello le toca a un negocio. Es la MISMA regla que `selloDe` en la
 * web (`components/insignia-verificado.tsx`), y tiene la misma trampa:
 * sin `verificado` NO hay sello, venga la ficha de donde venga. Si
 * nadie comprobó los datos, no hay nada que afirmar sobre ellos.
 */
export function selloDe(negocio: {
  verificado?: boolean | null;
  info_publica?: boolean | null;
}): EstadoSello | null {
  if (!negocio.verificado) return null;
  // `info_publica` tiene default `false` en la base: un `undefined` —una
  // consulta que no pidió la columna— cae en «Verificado», que es el
  // estado normal. La excepción es la que se declara.
  return negocio.info_publica ? "info-publica" : "verificado";
}

const VERDE_TEXTO = "#047857";
const VERDE_PUNTO = "#059669";
const PIZARRA_TEXTO = "#475569";
const PIZARRA_PUNTO = "#64748b";

export default function TagSello({ estado }: { estado: EstadoSello }) {
  const esVerificado = estado === "verificado";
  const punto = esVerificado ? VERDE_PUNTO : PIZARRA_PUNTO;

  return (
    <View style={styles.tag}>
      <View style={[styles.punto, { backgroundColor: punto }]}>
        {esVerificado ? (
          <Svg viewBox="0 0 24 24" width={9} height={9} fill="none" stroke="#ffffff" strokeWidth={3.4}>
            <Path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7" />
          </Svg>
        ) : (
          <Svg viewBox="0 0 24 24" width={9} height={9} fill="none" stroke="#ffffff" strokeWidth={2.4}>
            <Circle cx={12} cy={12} r={9} />
            <Path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
          </Svg>
        )}
      </View>
      <Text style={[styles.texto, { color: esVerificado ? VERDE_TEXTO : PIZARRA_TEXTO }]}>
        {esVerificado ? "VERIFICADO" : "INFO PÚBLICA"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignItems: "center",
    // Blanco casi opaco: va SOBRE la foto del negocio, y un fondo
    // translúcido haría que el texto cambiara de contraste según la
    // foto que le toque debajo — justo lo que no puede pasarle a un
    // sello.
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 7,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  punto: {
    alignItems: "center",
    borderRadius: 7,
    height: 14,
    justifyContent: "center",
    width: 14,
  },
  texto: {
    fontFamily: Fonts.extraBold,
    fontSize: 8.5,
    letterSpacing: 0.6,
  },
});
