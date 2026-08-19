import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Colors,
  Fonts,
  Radios,
  Sombras,
  Spacing,
  Tipo,
  colorAcentoDe,
  type Vertical,
} from "@/constants/theme";

type IconoNombre = keyof typeof Ionicons.glyphMap;

/**
 * Las piezas del lenguaje visual de Bookea — el mismo juego para las
 * cuatro verticales (Eventos, Servicios, Restaurantes, Hospedajes), de
 * modo que reservar un salón, una manicura, una mesa o una noche se
 * vea y se aprenda igual.
 *
 * Las reglas del sistema, en una línea cada una:
 *  - El lienzo es gris (`Colors.canvas`) y las tarjetas blancas.
 *  - Cada bloque se rotula con `Micro` (mayúsculas, tracking abierto).
 *  - Elegir es tocar una `Opcion`: fila de ancho completo que al
 *    quedar seleccionada saca una barra navy a la izquierda.
 *  - La acción de reservar es naranja; lo confirmado es verde; lo que
 *    está en manos del negocio es navy.
 *
 * Nada de esto duplica componentes existentes: `BarraSuperior`,
 * `ChipsVerticales` y `TabBar` siguen siendo los de siempre y ahora
 * consumen estos tokens.
 */

/* ------------------------------------------------------------------ */
/* Rótulos y textos                                                     */
/* ------------------------------------------------------------------ */

/**
 * La micro-etiqueta que encabeza cada bloque ("ELEGÍ TU SERVICIO",
 * "AGOSTO"). Es la firma del diseño: si un bloque no se entiende de un
 * vistazo, le falta su Micro.
 */
export function Micro({
  children,
  tono = "gris",
  style,
}: {
  children: ReactNode;
  /** `naranja` para los rótulos de Eventos ("AGOSTO"); `navy` para los
   * del flujo de reserva ("ELEGÍ TU SERVICIO"). */
  tono?: "gris" | "naranja" | "navy";
  style?: StyleProp<TextStyle>;
}) {
  const color =
    tono === "naranja" ? Colors.accent : tono === "navy" ? Colors.navy : Colors.inkMuted;
  return <Text style={[styles.micro, { color }, style]}>{children}</Text>;
}

/** Título de sección dentro de una pantalla, con su Micro opcional. */
export function Encabezado({
  kicker,
  titulo,
  accion,
}: {
  kicker?: string;
  titulo: string;
  /** Enlace a la derecha, tipo "Ver todos →". */
  accion?: { texto: string; onPress: () => void };
}) {
  return (
    <View style={styles.encabezado}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {kicker ? <Micro style={{ marginBottom: 4 }}>{kicker}</Micro> : null}
        <Text style={styles.encabezadoTitulo} numberOfLines={2}>
          {titulo}
        </Text>
      </View>
      {accion && (
        <Pressable onPress={accion.onPress} hitSlop={8}>
          <Text style={styles.encabezadoAccion}>{accion.texto} →</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Superficies                                                          */
/* ------------------------------------------------------------------ */

/** La tarjeta blanca sobre el lienzo: borde fino, radio grande. */
export function Tarjeta({
  children,
  style,
  plana = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Sin sombra — para tarjetas que ya van dentro de otra superficie. */
  plana?: boolean;
}) {
  return <View style={[styles.tarjeta, !plana && Sombras.tarjeta, style]}>{children}</View>;
}

/**
 * Lista de filas dentro de una sola tarjeta, separadas por línea (el
 * bloque de servicios, el horario, el resumen de una reserva).
 */
export function Lista({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.lista, style]}>{children}</View>;
}

/** Una fila de `Lista`: la primera va sin línea superior. */
export function FilaLista({
  children,
  primera = false,
  onPress,
}: {
  children: ReactNode;
  primera?: boolean;
  onPress?: () => void;
}) {
  const contenido = <View style={[styles.filaLista, !primera && styles.filaListaBorde]}>{children}</View>;
  if (!onPress) return contenido;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.75 }}>
      {contenido}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Elegir: la fila seleccionable                                        */
/* ------------------------------------------------------------------ */

/**
 * La pieza central del flujo de reserva: una fila de ancho completo
 * que se toca para elegir (un servicio, una hora, un plan, una mesa).
 * Seleccionada saca la barra navy a la izquierda y tiñe el fondo —
 * mucho más legible que un chip, y deja lugar para precio y duración.
 */
export function Opcion({
  titulo,
  detalle,
  derecha,
  detalleDerecha,
  seleccionada = false,
  deshabilitada = false,
  onPress,
}: {
  titulo: string;
  detalle?: string;
  /** Lo que va alineado a la derecha (precio, duración). */
  derecha?: string;
  /** Segunda línea bajo `derecha`. */
  detalleDerecha?: string;
  seleccionada?: boolean;
  deshabilitada?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionada, disabled: deshabilitada }}
      disabled={deshabilitada}
      onPress={onPress}
      style={({ pressed }) => [
        styles.opcion,
        seleccionada && styles.opcionActiva,
        deshabilitada && styles.opcionApagada,
        pressed && !deshabilitada && { opacity: 0.85 },
      ]}
    >
      {seleccionada && <View style={styles.opcionBarra} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[styles.opcionTitulo, deshabilitada && styles.textoApagado]}
          numberOfLines={1}
        >
          {titulo}
        </Text>
        {detalle ? (
          <Text
            style={[styles.opcionDetalle, deshabilitada && styles.textoApagado]}
            numberOfLines={1}
          >
            {detalle}
          </Text>
        ) : null}
      </View>
      {derecha ? (
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.opcionDerecha, deshabilitada && styles.textoApagado]}>
            {derecha}
          </Text>
          {detalleDerecha ? (
            <Text style={styles.opcionDetalle}>{detalleDerecha}</Text>
          ) : null}
        </View>
      ) : null}
      {seleccionada && (
        <Ionicons name="checkmark-circle" size={19} color={Colors.navy} style={{ marginLeft: 2 }} />
      )}
    </Pressable>
  );
}

/**
 * La casilla de hora: recuadros iguales de a tres por fila. Elegida NO
 * se rellena — se marca con borde navy y el texto en navy, igual que
 * el "10:30" del diseño de referencia. Rellenarla la hacía competir
 * con el botón de reservar, que es lo único sólido de la pantalla.
 */
export function Casilla({
  texto,
  seleccionada = false,
  deshabilitada = false,
  onPress,
}: {
  texto: string;
  seleccionada?: boolean;
  deshabilitada?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: seleccionada, disabled: deshabilitada }}
      disabled={deshabilitada}
      onPress={onPress}
      style={({ pressed }) => [
        styles.casilla,
        seleccionada && styles.casillaActiva,
        deshabilitada && styles.opcionApagada,
        pressed && !deshabilitada && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[
          styles.casillaTexto,
          seleccionada && styles.casillaTextoActivo,
          deshabilitada && styles.textoApagado,
        ]}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

/** Contenedor de `Casilla`: filas de tres, todas del mismo ancho. */
export function RejillaHoras({ children }: { children: ReactNode }) {
  return <View style={styles.rejilla}>{children}</View>;
}

/**
 * El chip de categoría con su conteo que encabeza los directorios
 * ("Uñas (4)"). Los cuatro directorios usan este mismo, así filtrar se
 * siente igual en Eventos, Servicios, Restaurantes y Hospedajes.
 */
export function ChipCategoria({
  texto,
  activo,
  icono,
  apagado,
  onPress,
}: {
  texto: string;
  activo: boolean;
  icono?: IconoNombre;
  /** El rubro existe en el catálogo pero todavía no tiene negocios:
   *  se ve (es vitrina) pero no responde al toque. */
  apagado?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activo, disabled: apagado }}
      disabled={apagado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        activo && styles.chipActivo,
        apagado && styles.chipApagado,
        pressed && { opacity: 0.85 },
      ]}
    >
      {icono ? (
        <Ionicons
          name={icono}
          size={14}
          color={activo ? "#ffffff" : apagado ? Colors.inkMuted : Colors.accent}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.chipTexto,
          activo && styles.chipTextoActivo,
          apagado && styles.chipTextoApagado,
        ]}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Identidad del negocio                                                */
/* ------------------------------------------------------------------ */

/** Las iniciales de un nombre: "Rancho Las Torres" → "RT". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "B";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

/** El círculo navy con las iniciales, cuando no hay foto. */
export function Avatar({ nombre, tamano = 40 }: { nombre: string; tamano?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { borderRadius: tamano / 2, height: tamano, width: tamano },
      ]}
    >
      <Text style={[styles.avatarTexto, { fontSize: tamano * 0.36 }]}>{iniciales(nombre)}</Text>
    </View>
  );
}

/**
 * El encabezado de negocio del mockup: avatar de iniciales, nombre y
 * la línea de contexto "★ 4.8 · Lugares · Alajuela". Es la misma
 * presentación para un rancho, un salón de uñas, un restaurante o una
 * villa — solo cambia lo que dice la línea.
 */
export function Identidad({
  nombre,
  meta,
  calificacion,
  derecha,
}: {
  nombre: string;
  /** Los trozos de la línea de contexto; los vacíos se descartan. */
  meta?: (string | null | undefined)[];
  calificacion?: number | null;
  derecha?: ReactNode;
}) {
  const partes = (meta ?? []).filter((m): m is string => !!m && m.trim() !== "");
  return (
    <View style={styles.identidad}>
      <Avatar nombre={nombre} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.identidadNombre} numberOfLines={1}>
          {nombre}
        </Text>
        <View style={styles.identidadMeta}>
          {calificacion != null && (
            <>
              <Ionicons name="star" size={11} color={Colors.accent} />
              <Text style={styles.identidadMetaFuerte}>
                {calificacion.toFixed(1).replace(".", ",")}
              </Text>
            </>
          )}
          {partes.length > 0 && (
            <Text style={styles.identidadMetaTexto} numberOfLines={1}>
              {calificacion != null ? "· " : ""}
              {partes.join(" · ")}
            </Text>
          )}
        </View>
      </View>
      {derecha}
    </View>
  );
}

/**
 * La tarjetita de prueba social que corona la página de un negocio:
 * un punto encendido y "12 personas visitaron este sitio hoy".
 *
 * Es chica y va sola en su línea, apenas debajo del encabezado — tiene
 * que leerse como un dato vivo del lugar, no como un anuncio: por eso
 * el número en negrita y el resto en gris, sin relleno de color. El
 * punto toma el acento de la vertical (naranja en Eventos y
 * Restaurantes, navy en Servicios y Hospedajes).
 *
 * Quién la muestra y cuándo lo decide `lib/visitas.ts` (la regla de los
 * 3). Acá no hay lógica: si llega, se pinta.
 */
export function PruebaSocial({
  numero,
  texto,
  vertical = "eventos",
}: {
  numero: number;
  /** Lo que va después del número: "personas visitaron este sitio hoy". */
  texto: string;
  vertical?: Vertical;
}) {
  const color = colorAcentoDe(vertical);
  // Con separador de miles, igual que `fmtColones` y que la web.
  const cifra = numero.toLocaleString("es-CR");
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${cifra} ${texto}`}
      style={styles.pruebaSocial}
    >
      {/* El halo alrededor del punto es lo que lo hace ver "encendido". */}
      <View style={[styles.pruebaSocialHalo, { backgroundColor: `${color}26` }]}>
        <View style={[styles.pruebaSocialPunto, { backgroundColor: color }]} />
      </View>
      <Text style={styles.pruebaSocialTexto} numberOfLines={1}>
        <Text style={styles.pruebaSocialNumero}>{cifra}</Text> {texto}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Estados                                                              */
/* ------------------------------------------------------------------ */

export type TonoEstado = "verde" | "naranja" | "navy" | "gris" | "rojo";

const TONOS: Record<TonoEstado, { fondo: string; texto: string }> = {
  // Verde tinte (no sólido): es el "APROBADA" del diseño — informa sin
  // gritar, porque en una lista de reservas casi todas están bien.
  verde: { fondo: Colors.greenLight, texto: Colors.green },
  // El tono "naranja" conserva su nombre (lo usan muchas pantallas)
  // pero se pinta en celeste: los rellenos naranjas salieron de la UI.
  naranja: { fondo: Colors.skyLight, texto: Colors.skyInk },
  // Navy sólido: el único estado que se rellena, para la cita del
  // momento ("CITA CONFIRMADA" en la agenda del día).
  navy: { fondo: Colors.navy, texto: "#ffffff" },
  gris: { fondo: Colors.cream2, texto: Colors.inkSoft },
  rojo: { fondo: Colors.dangerLight, texto: Colors.danger },
};

/**
 * La píldora de estado en mayúsculas: APROBADA, CITA CONFIRMADA,
 * NUEVA RESERVA. Verde = cerrado y confirmado; naranja = pide una
 * acción; navy = lo que está pasando ahora; gris = pasado o inactivo.
 */
export function Estado({ texto, tono = "gris" }: { texto: string; tono?: TonoEstado }) {
  const t = TONOS[tono];
  return (
    <View style={[styles.estado, { backgroundColor: t.fondo }]}>
      <Text style={[styles.estadoTexto, { color: t.texto }]} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Acciones                                                             */
/* ------------------------------------------------------------------ */

/**
 * El botón del sistema. `reservar` (naranja) es la acción que compra;
 * `navy` es la del panel y la confirmación; `contorno` es la salida
 * secundaria. Ancho completo salvo que se pida lo contrario.
 */
export function Boton({
  texto,
  onPress,
  tono = "reservar",
  icono,
  deshabilitado = false,
  cargando = false,
  compacto = false,
  style,
}: {
  texto: string;
  onPress: () => void;
  tono?: "reservar" | "navy" | "contorno" | "verde";
  icono?: IconoNombre;
  deshabilitado?: boolean;
  cargando?: boolean;
  /** Se ajusta al contenido en vez de ocupar todo el ancho. */
  compacto?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const esContorno = tono === "contorno";
  // "reservar" es el botón principal: pasó de naranja a celeste (el
  // naranja quedó solo para texto).
  const fondo =
    tono === "reservar" ? Colors.sky : tono === "navy" ? Colors.navy : tono === "verde" ? Colors.green : "transparent";
  const color = esContorno ? Colors.navy : "#ffffff";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado || cargando }}
      disabled={deshabilitado || cargando}
      onPress={onPress}
      style={({ pressed }) => [
        styles.boton,
        { backgroundColor: fondo },
        esContorno && styles.botonContorno,
        compacto ? styles.botonCompacto : { alignSelf: "stretch" },
        (deshabilitado || cargando) && { opacity: 0.45 },
        pressed && { opacity: 0.88 },
        style,
      ]}
    >
      {icono && !cargando ? <Ionicons name={icono} size={16} color={color} /> : null}
      <Text style={[styles.botonTexto, { color }]}>{cargando ? "Un momento…" : texto}</Text>
    </Pressable>
  );
}

/**
 * La barra sólida del final del flujo — el "✓ Reserva enviada" del
 * mockup. Verde cuando quedó cerrado, navy cuando queda en manos del
 * negocio.
 */
export function BarraConfirmacion({
  titulo,
  nota,
  tono = "navy",
}: {
  titulo: string;
  nota?: string;
  tono?: "navy" | "verde";
}) {
  return (
    <View
      style={[
        styles.confirmacion,
        { backgroundColor: tono === "verde" ? Colors.green : Colors.navy },
      ]}
    >
      <Ionicons name="checkmark-circle" size={19} color="#ffffff" />
      <Text style={styles.confirmacionTitulo} numberOfLines={2}>
        {titulo}
      </Text>
      {nota ? (
        <Text style={styles.confirmacionNota} numberOfLines={2}>
          {nota}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * La barra inferior pegada de los flujos de reserva: a la izquierda el
 * total y el resumen de lo elegido; a la derecha el botón que avanza.
 */
export function BarraAccion({
  total,
  nota,
  children,
  paddingBottom = 12,
}: {
  total?: string;
  nota?: string;
  children: ReactNode;
  paddingBottom?: number;
}) {
  return (
    <View style={[styles.barraAccion, { paddingBottom }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {total ? <Text style={styles.barraTotal}>{total}</Text> : null}
        {nota ? (
          <Text style={styles.barraNota} numberOfLines={1}>
            {nota}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda                                                               */
/* ------------------------------------------------------------------ */

/**
 * Una fila de la línea de tiempo del día: la hora en su columna fija a
 * la izquierda y lo que pase a esa hora a la derecha. Sin nada, deja
 * la ranura punteada de "Libre" — el hueco tiene que verse tan claro
 * como la cita.
 */
export function FilaHora({ hora, children }: { hora: string; children?: ReactNode }) {
  return (
    <View style={styles.filaHora}>
      <Text style={styles.filaHoraLabel}>{hora}</Text>
      <View style={{ flex: 1, gap: Spacing.two, minWidth: 0 }}>
        {children ?? <Ranura />}
      </View>
    </View>
  );
}

/**
 * El hueco libre de la agenda: un recuadro blanco con borde fino, del
 * mismo alto que una cita. Tiene que leerse como una ranura vacía en
 * la que algo cabe, no como una raya divisoria.
 */
export function Ranura({ texto = "Libre" }: { texto?: string }) {
  return (
    <View style={styles.ranura}>
      <Text style={styles.ranuraTexto}>{texto}</Text>
    </View>
  );
}

/**
 * El aviso azul que corona la agenda del día ("Nueva reserva de María
 * P."): lo último que entró, antes de la línea de tiempo.
 */
export function AvisoAgenda({ texto, icono = "calendar-outline" }: { texto: string; icono?: IconoNombre }) {
  return (
    <View style={styles.avisoAgenda}>
      <Ionicons name={icono} size={15} color={Colors.navy} />
      <Text style={styles.avisoAgendaTexto} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Vacíos y avisos                                                      */
/* ------------------------------------------------------------------ */

/** El estado vacío del sistema: ícono en burbuja, título y salida. */
export function Vacio({
  icono = "search-outline",
  titulo,
  texto,
  accion,
}: {
  icono?: IconoNombre;
  titulo: string;
  texto?: string;
  accion?: { texto: string; onPress: () => void };
}) {
  return (
    <View style={styles.vacio}>
      <View style={styles.vacioBurbuja}>
        <Ionicons name={icono} size={24} color={Colors.navy} />
      </View>
      <Text style={styles.vacioTitulo}>{titulo}</Text>
      {texto ? <Text style={styles.vacioTexto}>{texto}</Text> : null}
      {accion && (
        <Boton
          compacto
          tono="contorno"
          texto={accion.texto}
          onPress={accion.onPress}
          // `botonCompacto` trae `alignSelf: "flex-start"` -pensado
          // para hileras de botones lado a lado, donde ese campo
          // controla el eje vertical, no el horizontal- pero acá
          // `vacio` es una columna centrada: ese mismo campo empuja el
          // botón contra el borde izquierdo en vez de dejarlo centrado
          // bajo el texto. Se pisa puntual con `alignSelf: "center"`
          // en vez de tocar el estilo compartido, que a los demás
          // botones compactos (todos en hileras) les sigue sirviendo.
          style={{ marginTop: Spacing.three, alignSelf: "center" }}
        />
      )}
    </View>
  );
}

/** Aviso en línea: informativo (azul), atención (naranja) o error. */
export function Aviso({
  texto,
  tono = "info",
  icono,
}: {
  texto: string;
  tono?: "info" | "atencion" | "error";
  icono?: IconoNombre;
}) {
  const paleta =
    tono === "error"
      ? { fondo: Colors.dangerLight, texto: Colors.danger, icono: "alert-circle-outline" as IconoNombre }
      : tono === "atencion"
        ? { fondo: Colors.skyLight, texto: Colors.skyInk, icono: "information-circle-outline" as IconoNombre }
        : { fondo: Colors.blueLight, texto: Colors.navy, icono: "information-circle-outline" as IconoNombre };
  return (
    <View style={[styles.aviso, { backgroundColor: paleta.fondo }]}>
      <Ionicons name={icono ?? paleta.icono} size={16} color={paleta.texto} />
      <Text style={[styles.avisoTexto, { color: paleta.texto }]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  micro: Tipo.micro,

  encabezado: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: Spacing.two,
    justifyContent: "space-between",
  },
  encabezadoTitulo: Tipo.titulo2,
  encabezadoAccion: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 12.5 },

  tarjeta: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
  },
  lista: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  filaLista: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  filaListaBorde: { borderTopColor: Colors.line, borderTopWidth: 1 },

  opcion: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    overflow: "hidden",
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
  },
  // Elegida se marca con BORDE navy y la barra de acento a la
  // izquierda, sobre blanco — sin tinte de fondo. El único relleno de
  // la pantalla es el botón de reservar.
  opcionActiva: {
    borderColor: Colors.navy,
    borderWidth: 2,
    paddingLeft: Spacing.three + 4,
    paddingVertical: 12,
  },
  opcionBarra: {
    backgroundColor: Colors.navy,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 4,
  },
  opcionApagada: { backgroundColor: "#fafbfc", borderColor: "#eef0f5" },
  opcionTitulo: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  opcionDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, marginTop: 2 },
  opcionDerecha: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 13.5 },
  textoApagado: { color: "#b3b8c4" },

  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  casilla: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    // Tres por fila, todas iguales: el gap de 8 se descuenta del ancho.
    flexBasis: "31%",
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 11,
  },
  // Elegida se contornea, no se rellena (igual que la fila elegida).
  casillaActiva: { borderColor: Colors.navy, borderWidth: 2, paddingVertical: 10 },
  casillaTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
  casillaTextoActivo: { color: Colors.navy, fontFamily: Fonts.extraBold },

  chip: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  // El rubro sin negocios todavía: se ve, no se toca. Fondo hundido y
  // letra apagada — nunca `opacity`, que le bajaría el contraste al
  // texto por debajo de AA.
  chipApagado: { backgroundColor: Colors.cream2, borderColor: Colors.line },
  chipTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 12.5 },
  chipTextoActivo: { color: "#ffffff" },
  chipTextoApagado: { color: Colors.inkMuted },

  avatar: { alignItems: "center", backgroundColor: Colors.navy, justifyContent: "center" },
  avatarTexto: { color: "#ffffff", fontFamily: Fonts.extraBold, letterSpacing: 0.3 },
  identidad: { alignItems: "center", flexDirection: "row", gap: Spacing.two + 2 },
  identidadNombre: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16, letterSpacing: -0.3 },
  identidadMeta: { alignItems: "center", flexDirection: "row", gap: 3, marginTop: 2 },
  identidadMetaFuerte: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 12 },
  identidadMetaTexto: { color: Colors.inkSoft, flexShrink: 1, fontFamily: Fonts.medium, fontSize: 12 },

  pruebaSocial: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pruebaSocialHalo: {
    alignItems: "center",
    borderRadius: Radios.full,
    height: 14,
    justifyContent: "center",
    width: 14,
  },
  pruebaSocialPunto: { borderRadius: Radios.full, height: 6, width: 6 },
  pruebaSocialTexto: {
    color: Colors.inkSoft,
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  pruebaSocialNumero: { color: Colors.ink, fontFamily: Fonts.extraBold },

  estado: {
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  estadoTexto: {
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },

  boton: {
    alignItems: "center",
    borderRadius: Radios.sm,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  botonCompacto: { alignSelf: "flex-start", paddingVertical: 11 },
  botonContorno: { borderColor: Colors.navy, borderWidth: 1.5 },
  botonTexto: { fontFamily: Fonts.bold, fontSize: 14.5 },

  confirmacion: {
    alignItems: "center",
    borderRadius: Radios.md,
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  confirmacionTitulo: { color: "#ffffff", flex: 1, fontFamily: Fonts.bold, fontSize: 14 },
  confirmacionNota: { color: "rgba(255,255,255,0.8)", fontFamily: Fonts.medium, fontSize: 11.5, maxWidth: 120, textAlign: "right" },

  barraAccion: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
  },
  barraTotal: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17 },
  barraNota: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },

  filaHora: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: Spacing.two + 2,
    minHeight: 44,
    paddingVertical: 5,
  },
  filaHoraLabel: {
    color: Colors.inkMuted,
    fontFamily: Fonts.bold,
    fontSize: 11.5,
    paddingTop: 12,
    width: 42,
  },
  ranura: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ranuraTexto: { color: Colors.inkMuted, fontFamily: Fonts.semiBold, fontSize: 12.5 },

  avisoAgenda: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.sm,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  avisoAgendaTexto: { color: Colors.navy, flex: 1, fontFamily: Fonts.bold, fontSize: 12.5 },

  vacio: { alignItems: "center", paddingHorizontal: Spacing.four, paddingVertical: Spacing.five },
  vacioBurbuja: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: Radios.full,
    height: 52,
    justifyContent: "center",
    marginBottom: Spacing.three,
    width: 52,
  },
  vacioTitulo: { ...Tipo.titulo3, textAlign: "center" },
  vacioTexto: { ...Tipo.cuerpo, marginTop: 6, textAlign: "center" },

  aviso: {
    alignItems: "flex-start",
    borderRadius: Radios.md,
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
  },
  avisoTexto: { flex: 1, fontFamily: Fonts.medium, fontSize: 12.5, lineHeight: 18 },
});
