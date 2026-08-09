import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import PanelNav, { ALTO_PANEL_NAV } from "@/components/panel-nav";
import { FilaLista, Lista, Micro } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import {
  cargarContextoNegocio,
  TIPO_NEGOCIO_LABEL,
  type ContextoNegocio,
} from "@/lib/business";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * Configuración del negocio: TODO lo que antes andaba suelto como
 * atajo en el Inicio del panel (editar la página, precios, cobros,
 * sincronizar calendarios, equipo y horario, clientes).
 *
 * Son cosas que se tocan una vez y se dejan andando, así que no tienen
 * por qué competir en la pantalla de todos los días. Acá adentro cada
 * una dice para qué sirve, que es lo que un atajo con dos palabras
 * nunca alcanzó a explicar.
 */

type Entrada = {
  ruta: string;
  icono: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalle: string;
};

export default function ConfiguracionNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [nombre, setNombre] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [vertical, setVertical] = useState<string | null>(null);
  const [negocio, setNegocio] = useState<ContextoNegocio | null>(null);
  const [cargando, setCargando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let vigente = true;
      supabase
        .from("ranchos")
        .select("nombre, categoria, vertical")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          if (!vigente) return;
          setNombre((data?.nombre as string) ?? null);
          setCategoria((data?.categoria as string) ?? null);
          setVertical((data?.vertical as string) ?? null);
          setCargando(false);
        });
      // Bookea Business: qué módulos usa el negocio. Se elige desde la
      // web (bookea.lat); el app los respeta.
      cargarContextoNegocio(id)
        .then((ctx) => {
          if (vigente) setNegocio(ctx);
        })
        .catch(() => {});
      return () => {
        vigente = false;
      };
    }, [id, session]),
  );

  const esCitas = vertical === "citas";
  const esLugar = categoria === "lugares";

  const tuPagina: Entrada[] = [
    {
      ruta: `/negocio/${id}/editar`,
      icono: "create-outline",
      titulo: "Editar página",
      detalle: "Nombre, descripción, fotos, ubicación y capacidad.",
    },
  ];

  const plata: Entrada[] = [
    {
      ruta: `/negocio/${id}/cobros`,
      icono: "wallet-outline",
      titulo: "Cobros y tarifas",
      detalle: "Cuentas de pago, el adelanto para agendar y cómo cobrás.",
    },
    ...(esCitas
      ? []
      : [
          {
            ruta: `/negocio/${id}/precios`,
            icono: "pricetags-outline",
            titulo: "Precios y descuentos",
            detalle: esLugar
              ? "Rangos por invitados, servicios extra, códigos y promos por día."
              : "Tus tarifas, servicios extra, códigos y promos por día.",
          } satisfies Entrada,
        ]),
  ];

  const agenda: Entrada[] = [
    {
      ruta: `/negocio/${id}/agenda`,
      icono: "calendar-outline",
      titulo: "Agenda completa",
      detalle: esCitas
        ? "El día por persona, cargar una cita del mostrador y bloquear franjas."
        : "El día hora por hora, con lo que ya está agendado.",
    },
    {
      ruta: `/negocio/${id}/sincronizar`,
      icono: "sync-outline",
      titulo: "Sincronizar calendario",
      detalle: "Traer tu Google o Apple Calendar como bloqueos de agenda.",
    },
    ...(esCitas
      ? [
          {
            ruta: `/negocio/${id}/citas`,
            icono: "people-circle-outline",
            titulo: "Equipo, horario y giftcards",
            detalle: "Quién atiende, a qué horas abrís, vacaciones y giftcards.",
          } satisfies Entrada,
        ]
      : []),
  ];

  // El módulo manda: un negocio que apagó Clientes en la web tampoco
  // lo ve acá. Mientras el contexto no cargó rige lo de siempre.
  const conClientes = negocio ? negocio.modulos.has("clientes") : true;

  const clientes: Entrada[] = esCitas && conClientes
    ? [
        {
          ruta: `/negocio/${id}/clientes`,
          icono: "people-outline",
          titulo: "Clientes",
          detalle: "Quién viene seguido, quién dejó de venir y a quién escribirle.",
        },
      ]
    : [];

  return (
    <View style={styles.contenedor}>
      <BarraSuperior kicker="Panel" titulo="Configuración" subtitulo={nombre ?? undefined} />

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.navy} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            gap: Spacing.four,
            padding: Spacing.three,
            paddingBottom: ALTO_PANEL_NAV + Spacing.four,
          }}
        >
          <Bloque titulo="Tu página" entradas={tuPagina} />
          <Bloque titulo="Plata" entradas={plata} />
          <Bloque titulo="Agenda" entradas={agenda} />
          {clientes.length > 0 && <Bloque titulo="Clientes" entradas={clientes} />}

          {negocio && (
            <View style={{ gap: Spacing.two }}>
              <Micro>Tipo de negocio</Micro>
              <Lista>
                <FilaLista primera>
                  <View style={styles.burbuja}>
                    <Ionicons name="business-outline" size={17} color={Colors.navy} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.titulo}>{TIPO_NEGOCIO_LABEL[negocio.tipo]}</Text>
                    <Text style={styles.detalle}>
                      Define qué herramientas ves. Se cambia desde bookea.lat, en Configuración →
                      Tipo de negocio y módulos.
                    </Text>
                  </View>
                </FilaLista>
              </Lista>
            </View>
          )}

          <Text style={styles.pie}>
            Lo que no está acá —el asistente con IA y los informes largos— se maneja mejor desde
            bookea.lat en la computadora.
          </Text>
        </ScrollView>
      )}

      <PanelNav
        negocioId={id}
        activa="configuracion"
        mostrarCatalogo={esCitas || !esLugar}
        etiquetaCatalogo={esCitas ? "Servicios" : "Catálogo"}
      />
    </View>
  );
}

function Bloque({ titulo, entradas }: { titulo: string; entradas: Entrada[] }) {
  const router = useRouter();
  return (
    <View style={{ gap: Spacing.two }}>
      <Micro>{titulo}</Micro>
      <Lista>
        {entradas.map((e, i) => (
          <FilaLista key={e.ruta} primera={i === 0} onPress={() => router.push(e.ruta as never)}>
            <View style={styles.burbuja}>
              <Ionicons name={e.icono} size={17} color={Colors.navy} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.titulo}>{e.titulo}</Text>
              <Text style={styles.detalle}>{e.detalle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.inkMuted} />
          </FilaLista>
        ))}
      </Lista>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  burbuja: {
    alignItems: "center",
    backgroundColor: Colors.blueLight,
    borderRadius: 10,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  titulo: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
  detalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 2 },
  pie: {
    color: Colors.inkMuted,
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
  },
});
