import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { Vacio } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import { fmtColones } from "@/lib/types";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  PROMOS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Lo que los negocios están ofreciendo hoy: «20 % en corte», «2x1 en
 * manicura», «₡5.000 en vez de ₡8.000». Cada negocio escribe las suyas
 * desde su panel y salen acá mezcladas — las de Eventos y las de
 * Citas juntas, como en la calle.
 *
 * ── PROMOS NO ES FAVORITOS ─────────────────────────────────────────
 * Antes esta pestaña mostraba dos cosas prestadas: los programas de
 * lealtad de otros negocios y lo que la persona había guardado con el
 * corazón. Ninguna de las dos es una promoción, y mezclarlas hacía que
 * la pestaña no fuera de nada. Favoritos volvió a su lugar: Perfil ›
 * Favoritos (`/favoritos`).
 *
 * ── SIN TÍTULO ARRIBA ──────────────────────────────────────────────
 * A pedido del dueño: la pantalla arranca en la primera promo. Una
 * pantalla que se llama «Promos» en una pestaña que dice «Promos» solo
 * gasta los primeros 90 píxeles, que en un teléfono son la mitad de lo
 * que se ve sin scrollear.
 */

const ALTO_FOTO = 168;

type Promo = {
  id: string;
  rancho_id: string;
  titulo: string;
  descripcion: string | null;
  foto_url: string | null;
  descuento_porcentaje: number | null;
  precio_antes: number | null;
  precio_ahora: number | null;
  hasta: string | null;
  ranchos: {
    nombre: string;
    foto_url: string | null;
    vertical: string | null;
    canton: string | null;
    provincia: string | null;
  } | null;
};

/** A qué ficha lleva la promo — cada vertical tiene la suya. */
function rutaDelNegocio(ranchoId: string, vertical: string | null): string {
  switch (vertical) {
    case "citas":
      return `/citas/${ranchoId}`;
    case "restaurantes":
      return `/restaurantes/${ranchoId}`;
    default:
      return `/rancho/${ranchoId}`;
  }
}

/** "2026-08-31" → "hasta el 31 de agosto". null si no vence. */
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];
function vigencia(hasta: string | null): string | null {
  if (!hasta) return null;
  const [, m, d] = hasta.split("-").map(Number);
  if (!m || !d) return null;
  return `Hasta el ${d} de ${MESES[m - 1]}`;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- el pager pasa `activa` a todas las pestañas; Promos carga al montar y con pull-refresh
export default function PromosScreen({ activa = true }: { activa?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    // La RLS ya deja pasar solo las vigentes de negocios publicados
    // (migración 0189), así que acá NO se repite ese filtro: repetirlo
    // sería una segunda regla que se puede desincronizar de la de la
    // base. Lo único que se pide de más es el orden.
    const { data, error: err } = await supabase
      .from("promociones")
      .select(
        "id, rancho_id, titulo, descripcion, foto_url, descuento_porcentaje, precio_antes, precio_ahora, hasta, ranchos(nombre, foto_url, vertical, canton, provincia)",
      )
      // Las que vencen antes, primero: es la que se pierde si no la usa hoy.
      .order("hasta", { ascending: true, nullsFirst: false })
      .order("creado_en", { ascending: false });

    if (err) {
      setError(true);
      return;
    }
    setError(false);
    setPromos((data ?? []) as unknown as Promo[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  if (promos === null && !error) {
    return (
      <View style={[estilos.raiz, estilos.centro]}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={estilos.raiz}>
      <FlatList
        data={promos ?? []}
        keyExtractor={(p) => p.id}
        // El único aire de arriba es el de la barra de estado: sin
        // título, la primera promo es lo primero que se ve.
        contentContainerStyle={[
          estilos.lista,
          { paddingTop: insets.top + Spacing.two, paddingBottom: TAB_BAR_ESPACIO },
          (promos ?? []).length === 0 && estilos.listaVacia,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={Colors.accent}
          />
        }
        ListEmptyComponent={
          error ? (
            <Vacio
              icono="cloud-offline-outline"
              titulo="No pudimos cargar las promos"
              texto="Puede ser la señal. Deslizá hacia abajo para volver a intentar."
            />
          ) : (
            <Vacio
              icono="pricetag-outline"
              titulo="Todavía no hay promos"
              texto="Cuando los negocios publiquen sus ofertas, aparecen acá."
              accion={{
                texto: "Ver negocios",
                onPress: () => router.replace("/?tab=explorar" as never),
              }}
            />
          )
        }
        renderItem={({ item }) => <TarjetaPromo promo={item} router={router} />}
      />
    </View>
  );
}

function TarjetaPromo({
  promo,
  router,
}: {
  promo: Promo;
  router: ReturnType<typeof useRouter>;
}) {
  const negocio = promo.ranchos;
  // Si la promo no trae foto propia, se usa la del negocio: una
  // tarjeta sin imagen se pierde entre las que sí tienen.
  const foto = promo.foto_url ?? negocio?.foto_url ?? null;
  const hasta = vigencia(promo.hasta);
  const zona = [negocio?.canton, negocio?.provincia].filter(Boolean).join(", ");

  return (
    <Pressable
      onPress={() => router.push(rutaDelNegocio(promo.rancho_id, negocio?.vertical ?? null) as never)}
      accessibilityRole="button"
      accessibilityLabel={`${promo.titulo}. ${negocio?.nombre ?? ""}`}
      style={estilos.tarjeta}
    >
      <View style={estilos.foto}>
        {foto ? (
          <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
        ) : (
          <View style={[StyleSheet.absoluteFill, estilos.fotoVacia]}>
            <Ionicons name="pricetag-outline" size={26} color={Colors.inkMuted} />
          </View>
        )}

        {/* El gancho, arriba a la izquierda: es lo que hace parar el
            dedo. Solo uno de los dos — la base no deja tener los dos
            (constraint `promociones_un_solo_gancho`, 0189). */}
        {promo.descuento_porcentaje !== null && (
          <View style={estilos.sello}>
            <Text style={estilos.selloTexto}>{Math.round(promo.descuento_porcentaje)}% OFF</Text>
          </View>
        )}
        {promo.descuento_porcentaje === null && promo.precio_ahora !== null && (
          <View style={estilos.sello}>
            <Text style={estilos.selloTexto}>{fmtColones(promo.precio_ahora)}</Text>
          </View>
        )}

        {hasta && (
          <View style={estilos.vigencia}>
            <Text style={estilos.vigenciaTexto}>{hasta}</Text>
          </View>
        )}
      </View>

      <View style={estilos.cuerpo}>
        <Text style={estilos.titulo} numberOfLines={2}>
          {promo.titulo}
        </Text>
        {promo.descripcion ? (
          <Text style={estilos.descripcion} numberOfLines={2}>
            {promo.descripcion}
          </Text>
        ) : null}

        <View style={estilos.pie}>
          <Text style={estilos.negocio} numberOfLines={1}>
            {negocio?.nombre ?? "Un negocio de Bookea"}
            {zona ? ` · ${zona}` : ""}
          </Text>
          {promo.precio_antes !== null && promo.precio_ahora !== null && (
            <Text style={estilos.antes}>{fmtColones(promo.precio_antes)}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: { backgroundColor: Colors.canvas, flex: 1 },
  centro: { alignItems: "center", justifyContent: "center" },
  lista: { gap: Spacing.three, paddingHorizontal: Spacing.three },
  listaVacia: { flexGrow: 1, justifyContent: "center" },

  tarjeta: {
    backgroundColor: Colors.surface,
    borderRadius: Radios.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.line,
  },
  foto: { height: ALTO_FOTO, backgroundColor: Colors.cream2 },
  fotoVacia: { alignItems: "center", justifyContent: "center" },

  sello: {
    position: "absolute",
    top: Spacing.three,
    left: Spacing.three,
    backgroundColor: Colors.accent,
    borderRadius: Radios.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selloTexto: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 14 },

  vigencia: {
    position: "absolute",
    bottom: Spacing.three,
    right: Spacing.three,
    backgroundColor: "rgba(6,16,38,0.72)",
    borderRadius: Radios.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vigenciaTexto: { color: "#fff", fontFamily: Fonts.semiBold, fontSize: 11 },

  cuerpo: { gap: 4, padding: Spacing.three },
  titulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16, letterSpacing: -0.3 },
  descripcion: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18 },
  pie: {
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: 2,
  },
  negocio: { color: Colors.inkMuted, flex: 1, fontFamily: Fonts.semiBold, fontSize: 12 },
  antes: {
    color: Colors.inkMuted,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    textDecorationLine: "line-through",
  },
});
