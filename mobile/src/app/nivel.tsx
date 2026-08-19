import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import BarraSuperior from "@/components/barra-superior";
import { TAB_BAR_ESPACIO } from "@/components/tab-bar";
import { Vacio } from "@/components/ui";
import { Colors, Fonts, Spacing } from "@/constants/theme";

/**
 * "NIVEL": las tarjetas de lealtad de ESTA persona.
 *
 * Antes era un Alert que decía "muy pronto". Ahora muestra de verdad
 * los negocios donde está afiliada al programa de Lealtad, con su
 * avance (5/10 sellos, puntos, etc.) y —al tocar uno— una vista de la
 * tarjeta como se ve en el Wallet.
 *
 * ------------------------------------------------------------------
 * POR QUÉ ESTA CONSULTA Y NO OTRA
 * ------------------------------------------------------------------
 * Desde la 0138 la identidad raíz de un miembro es `personas`, no la
 * cuenta: quien se afilió escaneando el póster tiene `cliente_id` en
 * NULL y solo `persona_id`. La política "Cada quien ve su membresía"
 * (0138:1121) ya cubre LAS DOS ramas —`cliente_id = auth.uid()` O
 * `persona_id = mi_persona()`—, así que un `select` sin filtro trae
 * exactamente las membresías de quien consulta y ninguna más: la RLS
 * hace el trabajo. Filtrar acá por `cliente_id` a mano sería un bug —
 * escondería las afiliaciones hechas por QR, que son la mayoría.
 */

type ProgramaFila = {
  id: string;
  nombre: string | null;
  modo: string | null;
  pase_color_fondo: string | null;
  pase_color_sello: string | null;
  pase_logo_url: string | null;
  activo: boolean;
  ranchos: { nombre: string; foto_url: string | null } | null;
};

type MiembroFila = {
  id: string;
  programa_id: string;
  saldo_cache: number | null;
  created_at: string;
  programa_lealtad: ProgramaFila | null;
};

type Tarjeta = {
  miembroId: string;
  negocio: string;
  programa: string;
  modo: string;
  saldo: number;
  /** La meta de la recompensa más barata; null = no hay meta que llenar. */
  meta: number | null;
  recompensa: string | null;
  colorFondo: string;
  colorSello: string;
  logoUrl: string | null;
  fotoNegocio: string | null;
};

const FONDO_POR_DEFECTO = "#101a2c";
const SELLO_POR_DEFECTO = "#ee7420";

/** Cómo se dice el saldo según el tipo de tarjeta. */
function unidadDe(modo: string, n: number): string {
  switch (modo) {
    case "puntos":
      return n === 1 ? "punto" : "puntos";
    case "cashback":
      return "de saldo";
    case "giftcard":
      return "de saldo";
    default:
      return n === 1 ? "sello" : "sellos";
  }
}

export default function NivelScreen() {
  const { session } = useAuth();
  const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);
  const [abierta, setAbierta] = useState<Tarjeta | null>(null);

  const cargar = useCallback(async () => {
    if (!session) {
      setTarjetas([]);
      return;
    }
    // Sin filtro por cliente_id a propósito — ver el comentario grande
    // de arriba: la RLS de la 0138 ya acota a las membresías propias,
    // incluidas las que se hicieron por QR sin cuenta.
    const { data: miembrosData } = await supabase
      .from("miembros")
      .select(
        "id, programa_id, saldo_cache, created_at, programa_lealtad(id, nombre, modo, pase_color_fondo, pase_color_sello, pase_logo_url, activo, ranchos(nombre, foto_url))",
      )
      .order("created_at", { ascending: false });

    const miembros = (miembrosData ?? []) as unknown as MiembroFila[];
    const programaIds = miembros.map((m) => m.programa_id);

    // La meta real es la recompensa activa MÁS BARATA, igual que la que
    // usa el pase del teléfono (`metaDeSellos` en la web) — no el jsonb
    // del programa, que puede estar desalineado.
    const { data: recompensasData } = programaIds.length
      ? await supabase
          .from("recompensas")
          .select("programa_id, nombre, costo_puntos, activo")
          .in("programa_id", programaIds)
          .eq("activo", true)
          .order("costo_puntos", { ascending: true })
      : { data: [] };

    const metaPorPrograma = new Map<string, { meta: number; nombre: string }>();
    for (const r of (recompensasData ?? []) as {
      programa_id: string;
      nombre: string;
      costo_puntos: number;
    }[]) {
      if (!metaPorPrograma.has(r.programa_id)) {
        metaPorPrograma.set(r.programa_id, { meta: r.costo_puntos, nombre: r.nombre });
      }
    }

    setTarjetas(
      miembros
        // Un programa archivado o borrado no tiene nada que mostrarle a
        // la persona: su tarjeta ya no opera.
        .filter((m) => m.programa_lealtad && m.programa_lealtad.activo)
        .map((m) => {
          const p = m.programa_lealtad!;
          const premio = metaPorPrograma.get(m.programa_id) ?? null;
          return {
            miembroId: m.id,
            negocio: p.ranchos?.nombre ?? "Negocio",
            programa: p.nombre ?? "Programa de lealtad",
            modo: p.modo ?? "sellos",
            saldo: m.saldo_cache ?? 0,
            meta: premio?.meta ?? null,
            recompensa: premio?.nombre ?? null,
            colorFondo: p.pase_color_fondo || FONDO_POR_DEFECTO,
            colorSello: p.pase_color_sello || SELLO_POR_DEFECTO,
            logoUrl: p.pase_logo_url,
            fotoNegocio: p.ranchos?.foto_url ?? null,
          };
        }),
    );
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Nivel" subtitulo="Tus tarjetas de lealtad" />
      {tarjetas === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : tarjetas.length === 0 ? (
        <Vacio
          icono="ribbon-outline"
          titulo="Todavía no tenés tarjetas"
          texto="Cuando te afiliés al programa de lealtad de un negocio —escaneando su QR o desde su página— tu tarjeta aparece acá con tu avance."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: Spacing.four,
            paddingBottom: TAB_BAR_ESPACIO,
            gap: Spacing.three,
          }}
        >
          {tarjetas.map((t) => (
            <FilaNegocio key={t.miembroId} tarjeta={t} onVer={() => setAbierta(t)} />
          ))}
        </ScrollView>
      )}

      {/* La tarjeta "simulada", como se ve en el Wallet. */}
      <Modal
        visible={abierta !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierta(null)}
      >
        <Pressable style={styles.modalFondo} onPress={() => setAbierta(null)}>
          {abierta && (
            <Pressable style={styles.modalCaja} onPress={(e) => e.stopPropagation()}>
              <PaseSimulado tarjeta={abierta} />
              <Pressable style={styles.cerrarModal} onPress={() => setAbierta(null)}>
                <Text style={styles.cerrarModalTexto}>Cerrar</Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

/** Una fila: el negocio, su avance y el botón que abre la tarjeta. */
function FilaNegocio({ tarjeta: t, onVer }: { tarjeta: Tarjeta; onVer: () => void }) {
  const progreso = t.meta && t.meta > 0 ? Math.min(1, t.saldo / t.meta) : null;

  return (
    <View style={styles.fila}>
      <View style={styles.filaEncabezado}>
        {t.fotoNegocio ? (
          <Image source={{ uri: t.fotoNegocio }} style={styles.filaFoto} contentFit="cover" alt="" />
        ) : (
          <View style={[styles.filaFoto, { backgroundColor: t.colorFondo }]} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.filaNegocio} numberOfLines={1}>
            {t.negocio}
          </Text>
          <Text style={styles.filaAvance}>
            {t.meta && t.meta > 0
              ? `${t.saldo}/${t.meta} ${unidadDe(t.modo, t.meta)}`
              : `${t.saldo} ${unidadDe(t.modo, t.saldo)}`}
          </Text>
        </View>
      </View>

      {progreso !== null && (
        <View style={styles.barra}>
          <View
            style={[
              styles.barraLlena,
              { width: `${progreso * 100}%`, backgroundColor: t.colorSello },
            ]}
          />
        </View>
      )}

      {t.recompensa && (
        <Text style={styles.filaPremio} numberOfLines={1}>
          {progreso !== null && progreso >= 1
            ? `¡Ya podés canjear: ${t.recompensa}!`
            : `Tu próxima regalía: ${t.recompensa}`}
        </Text>
      )}

      <Pressable style={styles.botonTarjeta} onPress={onVer}>
        <Ionicons name="card-outline" size={15} color={Colors.navy} />
        <Text style={styles.botonTarjetaTexto}>Ver mi tarjeta</Text>
      </Pressable>
    </View>
  );
}

/**
 * La tarjeta como se ve en el teléfono. No es el pase real de Apple/
 * Google Wallet (ese lo genera el servidor y vive en la app de Wallet):
 * es la MISMA información pintada acá, para poder mostrarla en el
 * mostrador sin salir de Bookea.
 */
function PaseSimulado({ tarjeta: t }: { tarjeta: Tarjeta }) {
  const esSellos = t.modo === "sellos" || t.modo === "";
  const meta = t.meta ?? 0;

  return (
    <View style={[styles.pase, { backgroundColor: t.colorFondo }]}>
      <View style={styles.paseEncabezado}>
        {t.logoUrl ? (
          <Image source={{ uri: t.logoUrl }} style={styles.paseLogo} contentFit="contain" alt="" />
        ) : (
          <Text style={styles.paseNegocio} numberOfLines={1}>
            {t.negocio}
          </Text>
        )}
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.paseRotulo}>{t.modo.toUpperCase() || "SELLOS"}</Text>
          <Text style={styles.paseSaldo}>{t.saldo}</Text>
        </View>
      </View>

      {/* Los sellos como círculos que se llenan — lo que la persona
          reconoce de su tarjeta física. Solo si hay meta que llenar y
          es razonable dibujarla (más de 20 se vuelve ilegible). */}
      {esSellos && meta > 0 && meta <= 20 && (
        <View style={styles.sellosFila}>
          {Array.from({ length: meta }, (_, i) => (
            <View
              key={i}
              style={[
                styles.sello,
                {
                  backgroundColor: i < t.saldo ? t.colorSello : "rgba(255,255,255,0.14)",
                  borderColor: i < t.saldo ? t.colorSello : "rgba(255,255,255,0.28)",
                },
              ]}
            />
          ))}
        </View>
      )}

      <View style={styles.paseFooter}>
        <Text style={styles.paseFooterRotulo}>
          {t.meta && t.saldo >= t.meta ? "LISTO PARA CANJEAR" : "PARA TU PRÓXIMA REGALÍA"}
        </Text>
        <Text style={styles.paseFooterValor} numberOfLines={1}>
          {t.recompensa ??
            (t.meta ? `Te faltan ${Math.max(0, t.meta - t.saldo)}` : "Seguí sumando")}
        </Text>
      </View>

      <Text style={styles.paseMarca}>Powered by Bookea.lat</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", padding: Spacing.five },
  fila: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  filaEncabezado: { alignItems: "center", flexDirection: "row", gap: Spacing.two + 2 },
  filaFoto: { borderRadius: 12, height: 44, width: 44 },
  filaNegocio: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  filaAvance: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 12.5, marginTop: 1 },
  barra: {
    backgroundColor: Colors.cream2,
    borderRadius: 99,
    height: 7,
    overflow: "hidden",
  },
  barraLlena: { borderRadius: 99, height: "100%" },
  filaPremio: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12 },
  botonTarjeta: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: Colors.line,
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  botonTarjetaTexto: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 12.5 },
  modalFondo: {
    alignItems: "center",
    backgroundColor: "rgba(8,12,24,0.72)",
    flex: 1,
    justifyContent: "center",
    padding: Spacing.four,
  },
  modalCaja: { alignSelf: "stretch", gap: Spacing.three },
  pase: {
    borderRadius: 20,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  paseEncabezado: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  paseLogo: { height: 34, width: 110 },
  paseNegocio: { color: "#ffffff", flex: 1, fontFamily: Fonts.extraBold, fontSize: 16 },
  paseRotulo: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  paseSaldo: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 26, letterSpacing: -0.5 },
  sellosFila: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sello: { borderRadius: 13, borderWidth: 1.5, height: 26, width: 26 },
  paseFooter: { gap: 2 },
  paseFooterRotulo: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: Fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  paseFooterValor: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
  paseMarca: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: Fonts.medium,
    fontSize: 10,
    textAlign: "center",
  },
  cerrarModal: {
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 13,
  },
  cerrarModalTexto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 14 },
});
