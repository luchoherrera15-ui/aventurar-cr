import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import BarraSuperior from "@/components/barra-superior";
import { useAuth } from "@/lib/auth-context";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import type { ModalidadCobro } from "@/lib/cotizador-servicio";
import type { Categoria, Rancho } from "@/lib/types";

/** Qué modalidades de cobro ofrece cada rubro — espejo de
 *  campos-servicio.ts de /web. */
const MODALIDADES_POR_CATEGORIA: Record<Exclude<Categoria, "lugares">, ModalidadCobro[]> = {
  alimentacion: ["por_persona", "por_evento", "por_unidad"],
  animacion: ["por_hora", "por_evento", "por_paquete"],
  organizacion: ["por_evento", "por_hora", "por_paquete", "por_unidad"],
  decoracion: ["por_evento", "por_dia", "por_unidad"],
  otros: ["por_evento", "por_hora", "por_dia", "por_unidad"],
};

const MODALIDAD_LABEL: Record<ModalidadCobro, string> = {
  por_persona: "Por persona",
  por_hora: "Por hora",
  por_evento: "Por evento",
  por_dia: "Por día",
  por_paquete: "Por paquete",
  por_unidad: "Por unidad (el catálogo es el precio)",
};

function num(v: string): number | null {
  const limpio = v.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Cobros y tarifas en una sola pantalla: cuentas de pago (SINPE y
 * banco), el depósito para agendar, el cupo de eventos por día, y —
 * para servicios — cómo cobrás y tus tarifas. En la web esto vive
 * repartido entre dos pestañas; acá es la ventanilla única.
 *
 * Las tarifas se guardan DENTRO de ranchos.detalles (jsonb),
 * mezclándose con las claves que ya existan — nunca pisándolas.
 */
export default function CobrosNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [rancho, setRancho] = useState<Rancho | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cuentas
  const [sinpeNumero, setSinpeNumero] = useState("");
  const [sinpeTitular, setSinpeTitular] = useState("");
  const [cuentaBanco, setCuentaBanco] = useState("");
  const [cuentaNumero, setCuentaNumero] = useState("");
  const [cuentaTitular, setCuentaTitular] = useState("");
  // Reserva
  const [deposito, setDeposito] = useState("");
  const [eventosPorDia, setEventosPorDia] = useState("");
  // Tarifas (servicios)
  const [modalidad, setModalidad] = useState<ModalidadCobro | "">("");
  const [tarifaPersona, setTarifaPersona] = useState("");
  const [minimoPersonas, setMinimoPersonas] = useState("");
  const [tarifaHora, setTarifaHora] = useState("");
  const [horasMinimas, setHorasMinimas] = useState("");
  const [tarifaEvento, setTarifaEvento] = useState("");
  const [horasIncluidas, setHorasIncluidas] = useState("");
  const [horaExtra, setHoraExtra] = useState("");
  const [tarifaDia, setTarifaDia] = useState("");
  const [costoTraslado, setCostoTraslado] = useState("");
  const [anticipacion, setAnticipacion] = useState("");

  const cargar = useCallback(async () => {
    const { data } = await supabase.from("ranchos").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    const r = data as Rancho;
    setRancho(r);
    setSinpeNumero(r.sinpe_numero ?? "");
    setSinpeTitular(r.sinpe_titular ?? "");
    setCuentaBanco(r.cuenta_banco ?? "");
    setCuentaNumero(r.cuenta_numero ?? "");
    setCuentaTitular(r.cuenta_titular ?? "");
    setDeposito(r.deposito_reserva ? String(r.deposito_reserva) : "");
    setEventosPorDia(r.eventos_por_dia != null ? String(r.eventos_por_dia) : "");
    const d = r.detalles ?? {};
    const leer = (k: string) => (d[k] != null && d[k] !== "" ? String(d[k]) : "");
    setModalidad((leer("modalidad_cobro") as ModalidadCobro) || "");
    setTarifaPersona(leer("tarifa_persona"));
    setMinimoPersonas(leer("minimo_personas"));
    setTarifaHora(leer("tarifa_hora"));
    setHorasMinimas(leer("horas_minimas"));
    setTarifaEvento(leer("tarifa_evento"));
    setHorasIncluidas(leer("duracion_horas"));
    setHoraExtra(leer("hora_extra"));
    setTarifaDia(leer("tarifa_dia"));
    setCostoTraslado(leer("costo_traslado"));
    setAnticipacion(leer("anticipacion_dias"));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function guardar() {
    if (!rancho) return;
    setGuardando(true);
    setMensaje(null);
    setError(null);

    const esLugar = rancho.categoria === "lugares";

    // Las tarifas se mezclan con los detalles existentes: la pantalla
    // de editar guarda ahí otras cosas del rubro y no se pueden perder.
    const detalles: Record<string, unknown> = { ...(rancho.detalles ?? {}) };
    if (!esLugar) {
      const escribir = (k: string, v: string) => {
        const n = num(v);
        if (n === null) delete detalles[k];
        else detalles[k] = n;
      };
      if (modalidad) detalles.modalidad_cobro = modalidad;
      else delete detalles.modalidad_cobro;
      escribir("tarifa_persona", tarifaPersona);
      escribir("minimo_personas", minimoPersonas);
      escribir("tarifa_hora", tarifaHora);
      escribir("horas_minimas", horasMinimas);
      escribir("tarifa_evento", tarifaEvento);
      escribir("duracion_horas", horasIncluidas);
      escribir("hora_extra", horaExtra);
      escribir("tarifa_dia", tarifaDia);
      escribir("costo_traslado", costoTraslado);
      escribir("anticipacion_dias", anticipacion);
    }

    const cupo = num(eventosPorDia);
    const { error: err } = await supabase
      .from("ranchos")
      .update({
        sinpe_numero: sinpeNumero.trim() || null,
        sinpe_titular: sinpeTitular.trim() || null,
        cuenta_banco: cuentaBanco.trim() || null,
        cuenta_numero: cuentaNumero.trim() || null,
        cuenta_titular: cuentaTitular.trim() || null,
        deposito_reserva: num(deposito) ?? 0,
        // Lugares: el salón se alquila entero, siempre 1.
        eventos_por_dia: esLugar ? 1 : cupo && cupo >= 1 ? Math.min(cupo, 50) : null,
        ...(esLugar ? {} : { detalles }),
      })
      .eq("id", id);

    setGuardando(false);
    if (err) {
      setError("No se pudo guardar: " + err.message);
      return;
    }
    setMensaje("Guardado. Tu página pública ya muestra los cambios.");
  }

  if (!session) {
    router.replace("/cuenta");
    return null;
  }

  if (!rancho) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const esLugar = rancho.categoria === "lugares";
  const modalidades = esLugar
    ? []
    : MODALIDADES_POR_CATEGORIA[rancho.categoria as Exclude<Categoria, "lugares">] ?? [];

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Cobros y tarifas" subtitulo={rancho.nombre} />
      <ScrollView contentContainerStyle={{ padding: Spacing.four, gap: Spacing.four }}>
        {/* ---------- Cuentas ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.etiqueta}>Cuentas de cobro</Text>
          <Text style={styles.ayuda}>
            Sin cuentas configuradas, esa forma de pago no se le ofrece al
            cliente al reservar.
          </Text>
          <Campo label="SINPE Móvil (número)" valor={sinpeNumero} onCambiar={setSinpeNumero} placeholder="8888-8888" />
          <Campo label="SINPE a nombre de" valor={sinpeTitular} onCambiar={setSinpeTitular} placeholder="Nombre del titular" />
          <Campo label="Banco" valor={cuentaBanco} onCambiar={setCuentaBanco} placeholder="Ej. BAC, BCR, BN" />
          <Campo label="Cuenta IBAN" valor={cuentaNumero} onCambiar={setCuentaNumero} placeholder="CR..." />
          <Campo label="Cuenta a nombre de" valor={cuentaTitular} onCambiar={setCuentaTitular} placeholder="Nombre del titular" />
        </View>

        {/* ---------- Reserva ---------- */}
        <View style={styles.bloque}>
          <Text style={styles.etiqueta}>Reserva</Text>
          <Campo
            label="Depósito para agendar (₡, 0 = sin depósito)"
            valor={deposito}
            onCambiar={setDeposito}
            placeholder="25000"
            numerico
          />
          {!esLugar && (
            <Campo
              label="¿Cuántos eventos atendés por día? (vacío = sin tope)"
              valor={eventosPorDia}
              onCambiar={setEventosPorDia}
              placeholder="Ej. 2"
              numerico
            />
          )}
          {esLugar && (
            <Text style={styles.ayuda}>
              Tu lugar se alquila completo: un evento por día. Los días con
              reserva confirmada se bloquean solos.
            </Text>
          )}
        </View>

        {/* ---------- Tarifas (solo servicios) ---------- */}
        {!esLugar && (
          <View style={styles.bloque}>
            <Text style={styles.etiqueta}>Cómo cobrás</Text>
            <View style={styles.chipsEnvueltos}>
              {modalidades.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setModalidad((prev) => (prev === m ? "" : m))}
                  style={[styles.chip, modalidad === m && styles.chipActivo]}
                >
                  <Text style={[styles.chipTexto, modalidad === m && styles.chipTextoActivo]}>
                    {MODALIDAD_LABEL[m]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {modalidad === "por_persona" && (
              <>
                <Campo label="Tarifa por persona (₡)" valor={tarifaPersona} onCambiar={setTarifaPersona} placeholder="4500" numerico />
                <Campo label="Mínimo de personas" valor={minimoPersonas} onCambiar={setMinimoPersonas} placeholder="30" numerico />
              </>
            )}
            {modalidad === "por_hora" && (
              <>
                <Campo label="Tarifa por hora (₡)" valor={tarifaHora} onCambiar={setTarifaHora} placeholder="35000" numerico />
                <Campo label="Horas mínimas" valor={horasMinimas} onCambiar={setHorasMinimas} placeholder="2" numerico />
              </>
            )}
            {(modalidad === "por_evento" || modalidad === "por_paquete") && (
              <>
                <Campo
                  label={modalidad === "por_paquete" ? "Precio del paquete (₡)" : "Tarifa por evento (₡)"}
                  valor={tarifaEvento}
                  onCambiar={setTarifaEvento}
                  placeholder="150000"
                  numerico
                />
                <Campo label="Horas que incluye" valor={horasIncluidas} onCambiar={setHorasIncluidas} placeholder="5" numerico />
                <Campo label="Hora extra (₡)" valor={horaExtra} onCambiar={setHoraExtra} placeholder="25000" numerico />
              </>
            )}
            {modalidad === "por_dia" && (
              <Campo label="Tarifa por día (₡)" valor={tarifaDia} onCambiar={setTarifaDia} placeholder="60000" numerico />
            )}
            {modalidad === "por_unidad" && (
              <Text style={styles.ayuda}>
                Con esta modalidad el precio sale de tu catálogo: cada producto
                con su precio y su cantidad. Cargalo en la pestaña del catálogo.
              </Text>
            )}

            <Campo label="Costo de traslado (₡, opcional)" valor={costoTraslado} onCambiar={setCostoTraslado} placeholder="15000" numerico />
            <Campo
              label="Días de anticipación que pedís (opcional)"
              valor={anticipacion}
              onCambiar={setAnticipacion}
              placeholder="Ej. 3"
              numerico
            />
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {mensaje && <Text style={styles.ok}>{mensaje}</Text>}

        <Pressable
          style={[styles.botonPrimario, guardando && { opacity: 0.5 }]}
          disabled={guardando}
          onPress={guardar}
        >
          <Text style={styles.botonPrimarioTexto}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </Text>
        </Pressable>
        <View style={{ height: Spacing.six }} />
      </ScrollView>
    </View>
  );
}

function Campo({
  label,
  valor,
  onCambiar,
  placeholder,
  numerico,
}: {
  label: string;
  valor: string;
  onCambiar: (v: string) => void;
  placeholder: string;
  numerico?: boolean;
}) {
  return (
    <View>
      <Text style={styles.campoLabel}>{label}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        placeholder={placeholder}
        placeholderTextColor={Colors.inkSoft}
        keyboardType={numerico ? "decimal-pad" : "default"}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  bloque: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  etiqueta: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Colors.inkSoft,
  },
  ayuda: { fontSize: 12, color: Colors.inkSoft, lineHeight: 17, fontFamily: Fonts.regular },
  campoLabel: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: Colors.inkSoft,
    marginBottom: 5,
  },
  input: {
    backgroundColor: Colors.cream2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    fontFamily: Fonts.regular,
    color: Colors.ink,
  },
  chipsEnvueltos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTexto: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.inkSoft },
  chipTextoActivo: { color: "#ffffff" },
  error: { color: Colors.danger, fontSize: 13, fontFamily: Fonts.medium },
  ok: { color: Colors.green, fontSize: 13, fontFamily: Fonts.bold },
  botonPrimario: {
    backgroundColor: Colors.sky,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonPrimarioTexto: { color: "#ffffff", fontSize: 14, fontFamily: Fonts.bold },
});
