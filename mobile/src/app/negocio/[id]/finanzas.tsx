import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";
import {
  CATEGORIAS_GASTO,
  GASTO_LABEL,
  aFecha,
  claveFecha,
  fmtColones,
  fmtColonesCorto,
  resumenFinanciero,
  saldoPendiente,
  totalEvento,
  type CategoriaGasto,
  type Gasto,
  type ReservaFinanzas,
} from "@/lib/finanzas";

/**
 * Finanzas del negocio en el teléfono — la pestaña que en la web vive
 * en /mi-negocio/[id]?tab=finanzas.
 *
 * Los números salen del MISMO resumenFinanciero() que el sitio (ver
 * src/lib/finanzas.ts): acá no se recalcula nada a mano. Lo único
 * propio del app es cómo se dibuja.
 *
 * Las tres cosas que un dueño hace desde el celular, que son las que
 * pasan fuera del escritorio: validar un adelanto que le acaba de
 * entrar, cerrar el cobro del evento el mismo día, y anotar un gasto
 * cuando lo paga. El análisis largo sigue estando mejor en la web.
 */

type Vista = "resumen" | "cobros" | "gastos";

export default function FinanzasNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [nombre, setNombre] = useState<string | null>(null);
  const [reservas, setReservas] = useState<ReservaFinanzas[] | null>(null);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [vista, setVista] = useState<Vista>("resumen");
  const [refrescando, setRefrescando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [gastoAbierto, setGastoAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    const [negocioRes, reservasRes, gastosRes] = await Promise.all([
      supabase.from("ranchos").select("nombre").eq("id", id).maybeSingle(),
      supabase
        .from("reservas")
        .select(
          "id, fecha, nombre, tipo_evento, invitados, estado, monto_total, monto_cobrado_final, deposito_monto, deposito_validado, deposito_pagado_en, evento_pagado, saldo_pagado_en",
        )
        .eq("rancho_id", id)
        .order("fecha", { ascending: false }),
      supabase
        .from("gastos_rancho")
        .select("id, fecha, concepto, categoria, monto, nota")
        .eq("rancho_id", id)
        .order("fecha", { ascending: false }),
    ]);

    setNombre((negocioRes.data?.nombre as string) ?? null);
    setReservas((reservasRes.data ?? []) as ReservaFinanzas[]);
    setGastos((gastosRes.data ?? []) as Gasto[]);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga al montar, sin librería de data-fetching en este proyecto
    cargar();
  }, [cargar]);

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const resumen = useMemo(
    () => resumenFinanciero({ reservas: reservas ?? [], gastos }),
    [reservas, gastos],
  );

  /** El adelanto entró (o se desmarca si fue un error). */
  async function marcarDeposito(reserva: ReservaFinanzas, recibido: boolean) {
    setOcupado(reserva.id);
    const { error } = await supabase
      .from("reservas")
      .update({
        deposito_validado: recibido,
        deposito_pagado_en: recibido ? new Date().toISOString() : null,
      })
      .eq("id", reserva.id)
      .eq("rancho_id", id);
    setOcupado(null);

    if (error) {
      Alert.alert("No se pudo guardar", error.message);
      return;
    }
    await cargar();
  }

  /**
   * Cierra el cobro del evento. Se pregunta el monto final porque casi
   * nunca es el cotizado: llegaron más invitados, se pasaron de hora.
   * Sin ese dato los números se despegan de la caja real.
   */
  function cobrarEvento(reserva: ReservaFinanzas) {
    Alert.prompt?.(
      "¿Cuánto cobraste?",
      `Cotizado: ${fmtColones(totalEvento(reserva))}. Dejalo vacío si cobraste eso mismo.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Registrar cobro",
          onPress: (valor?: string) => void registrarCobro(reserva, valor),
        },
      ],
      "plain-text",
      "",
      "numeric",
    );
    // Android no tiene Alert.prompt: ahí se cobra por el monto cotizado
    // y el ajuste fino queda para la web, que es donde se hace cuentas.
    if (!Alert.prompt) {
      Alert.alert(
        "Registrar el cobro",
        `Se va a registrar ${fmtColones(totalEvento(reserva))} como cobrado. Si el monto final fue otro, corregilo desde bookea.lat.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Registrar", onPress: () => void registrarCobro(reserva, undefined) },
        ],
      );
    }
  }

  async function registrarCobro(reserva: ReservaFinanzas, valor?: string) {
    const limpio = (valor ?? "").replace(/[^\d]/g, "");
    const montoFinal = limpio ? Number(limpio) : null;
    if (montoFinal !== null && (!Number.isFinite(montoFinal) || montoFinal < 0)) {
      Alert.alert("Monto inválido", "El monto cobrado no puede ser negativo.");
      return;
    }

    setOcupado(reserva.id);
    const update: Record<string, unknown> = {
      evento_pagado: true,
      saldo_pagado_en: new Date().toISOString(),
    };
    if (montoFinal !== null) update.monto_cobrado_final = montoFinal;

    const { error } = await supabase
      .from("reservas")
      .update(update)
      .eq("id", reserva.id)
      .eq("rancho_id", id);
    setOcupado(null);

    if (error) {
      Alert.alert("No se pudo guardar", error.message);
      return;
    }
    await cargar();
  }

  async function borrarGasto(gasto: Gasto) {
    Alert.alert("¿Borrar el gasto?", `${gasto.concepto} · ${fmtColones(gasto.monto)}`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("gastos_rancho")
            .delete()
            .eq("id", gasto.id)
            .eq("rancho_id", id);
          if (error) {
            Alert.alert("No se pudo borrar", error.message);
            return;
          }
          await cargar();
        },
      },
    ]);
  }

  if (reservas === null) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Finanzas" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Finanzas" subtitulo={nombre ?? undefined} />

      <View style={styles.pestanas}>
        {(
          [
            { id: "resumen" as const, label: "Resumen" },
            { id: "cobros" as const, label: "Cobros" },
            { id: "gastos" as const, label: "Gastos" },
          ]
        ).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setVista(p.id)}
            style={[styles.pestana, vista === p.id && styles.pestanaActiva]}
          >
            <Text style={[styles.pestanaTexto, vista === p.id && styles.pestanaTextoActiva]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} />}
      >
        {vista === "resumen" && (
          <>
            {/* El mes en curso: lo que entró, lo que salió y el neto. */}
            <View style={styles.tarjetaNeto}>
              <Text style={styles.netoRotulo}>Este mes</Text>
              <Text style={styles.netoMonto}>{fmtColones(resumen.netoEsteMes)}</Text>
              <View style={styles.netoDetalle}>
                <View style={styles.netoColumna}>
                  <Text style={styles.netoColumnaRotulo}>Entró</Text>
                  <Text style={styles.netoColumnaValor}>
                    {fmtColones(resumen.entroEsteMes)}
                  </Text>
                </View>
                <View style={styles.netoDivisor} />
                <View style={styles.netoColumna}>
                  <Text style={styles.netoColumnaRotulo}>Gastos</Text>
                  <Text style={styles.netoColumnaValor}>
                    {fmtColones(resumen.gastosEsteMes)}
                  </Text>
                </View>
              </View>
              <Text style={styles.netoDesglose}>
                Adelantos {fmtColones(resumen.entroEsteMesAdelantos)} · Saldos{" "}
                {fmtColones(resumen.entroEsteMesSaldos)}
              </Text>
            </View>

            {/* La misma separación sencilla que la web: ya cobrado /
                por cobrar / total. */}
            <View style={styles.tarjetasFila}>
              <Metrica
                rotulo="Ya cobrado (histórico)"
                valor={fmtColones(resumen.cobradoTotal)}
              />
              <Metrica
                rotulo="Por cobrar (total)"
                valor={fmtColones(resumen.porCobrarTotal)}
              />
            </View>
            <View style={styles.tarjetasFila}>
              <Metrica
                rotulo="Por cobrar (30 días)"
                valor={fmtColones(resumen.porCobrarProximos30)}
              />
              <Metrica
                rotulo="Vencido"
                valor={fmtColones(resumen.vencido)}
                alerta={resumen.vencido > 0}
              />
            </View>
            <View style={styles.tarjetasFila}>
              <Metrica
                rotulo="Facturación total"
                valor={fmtColones(resumen.totalComprometido)}
              />
              <Metrica rotulo="Eventos por venir" valor={String(resumen.eventosProximos30)} />
            </View>

            {/* Las semanas, como barras. La web usa un gráfico; acá una
                fila por semana se lee mejor en pantalla angosta. */}
            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Semana a semana</Text>
              {resumen.semanas.map((s) => {
                const alto = resumen.maximoSemanal > 0 ? s.entro / resumen.maximoSemanal : 0;
                const altoPorCobrar =
                  resumen.maximoSemanal > 0 ? s.porCobrar / resumen.maximoSemanal : 0;
                return (
                  <View key={s.clave} style={styles.semana}>
                    <Text style={[styles.semanaRango, s.esActual && styles.semanaActual]}>
                      {s.rango}
                    </Text>
                    <View style={styles.barras}>
                      <View style={[styles.barra, styles.barraEntro, { flex: Math.max(alto, 0.01) }]} />
                      <View
                        style={[
                          styles.barra,
                          styles.barraPorCobrar,
                          { flex: Math.max(altoPorCobrar, 0.01) },
                        ]}
                      />
                      <View style={{ flex: Math.max(2 - alto - altoPorCobrar, 0.01) }} />
                    </View>
                    <Text style={styles.semanaMonto}>{fmtColonesCorto(s.entro)}</Text>
                  </View>
                );
              })}
              <View style={styles.leyenda}>
                <View style={styles.leyendaItem}>
                  <View style={[styles.leyendaPunto, styles.barraEntro]} />
                  <Text style={styles.leyendaTexto}>Entró</Text>
                </View>
                <View style={styles.leyendaItem}>
                  <View style={[styles.leyendaPunto, styles.barraPorCobrar]} />
                  <Text style={styles.leyendaTexto}>Por cobrar</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {vista === "cobros" && (
          <>
            {/* Lo primero que hay que resolver: plata que el cliente
                dice haber mandado y el dueño no confirmó. */}
            {resumen.depositosSinValidar.length > 0 && (
              <View style={styles.bloque}>
                <Text style={styles.bloqueTitulo}>Adelantos por confirmar</Text>
                <Text style={styles.bloqueAyuda}>
                  El cliente ya lo transfirió. Confirmá que llegó a tu cuenta.
                </Text>
                {resumen.depositosSinValidar.map((r) => (
                  <FilaCobro
                    key={r.id}
                    reserva={r}
                    monto={Number(r.deposito_monto ?? 0)}
                    etiqueta="adelanto"
                    ocupado={ocupado === r.id}
                    accion="Ya me llegó"
                    onAccion={() => marcarDeposito(r, true)}
                  />
                ))}
              </View>
            )}

            {resumen.cobrosVencidos.length > 0 && (
              <View style={styles.bloque}>
                <Text style={[styles.bloqueTitulo, styles.tituloAlerta]}>Te deben</Text>
                <Text style={styles.bloqueAyuda}>
                  Eventos que ya pasaron con saldo sin cobrar.
                </Text>
                {resumen.cobrosVencidos.map((r) => (
                  <FilaCobro
                    key={r.id}
                    reserva={r}
                    monto={saldoPendiente(r)}
                    etiqueta="saldo"
                    ocupado={ocupado === r.id}
                    accion="Ya cobré"
                    onAccion={() => cobrarEvento(r)}
                  />
                ))}
              </View>
            )}

            <View style={styles.bloque}>
              <Text style={styles.bloqueTitulo}>Por cobrar</Text>
              {resumen.cobrosProximos.length === 0 ? (
                <Text style={styles.vacio}>No hay saldos pendientes por venir.</Text>
              ) : (
                resumen.cobrosProximos.map((r) => (
                  <FilaCobro
                    key={r.id}
                    reserva={r}
                    monto={saldoPendiente(r)}
                    etiqueta="saldo"
                    ocupado={ocupado === r.id}
                    accion="Ya cobré"
                    onAccion={() => cobrarEvento(r)}
                  />
                ))
              )}
            </View>
          </>
        )}

        {vista === "gastos" && (
          <View style={styles.bloque}>
            <View style={styles.bloqueEncabezado}>
              <Text style={styles.bloqueTitulo}>Tus gastos</Text>
              <Pressable style={styles.botonChico} onPress={() => setGastoAbierto(true)}>
                <Ionicons name="add" size={15} color="#ffffff" />
                <Text style={styles.botonChicoTexto}>Anotar</Text>
              </Pressable>
            </View>

            {gastos.length === 0 ? (
              <Text style={styles.vacio}>
                Todavía no anotaste gastos. Sin ellos, el panel dice cuánto
                facturaste — no cuánto ganaste.
              </Text>
            ) : (
              gastos.map((g) => (
                <Pressable key={g.id} style={styles.filaGasto} onLongPress={() => borrarGasto(g)}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.gastoConcepto} numberOfLines={1}>
                      {g.concepto}
                    </Text>
                    <Text style={styles.gastoDetalle}>
                      {aFecha(g.fecha).toLocaleDateString("es-CR", {
                        day: "numeric",
                        month: "short",
                      })}
                      {" · "}
                      {GASTO_LABEL[g.categoria] ?? g.categoria}
                    </Text>
                  </View>
                  <Text style={styles.gastoMonto}>−{fmtColones(Number(g.monto))}</Text>
                </Pressable>
              ))
            )}
            {gastos.length > 0 && (
              <Text style={styles.pistaBorrar}>Mantené presionado un gasto para borrarlo.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <ModalGasto
        visible={gastoAbierto}
        onCerrar={() => setGastoAbierto(false)}
        ranchoId={String(id)}
        onGuardado={async () => {
          setGastoAbierto(false);
          await cargar();
        }}
      />
    </View>
  );
}

/** Una métrica chica del resumen. */
function Metrica({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <View style={styles.metrica}>
      <Text style={styles.metricaRotulo}>{rotulo}</Text>
      <Text style={[styles.metricaValor, alerta && styles.metricaValorAlerta]}>{valor}</Text>
    </View>
  );
}

/** Una fila de cobro pendiente, con su acción. */
function FilaCobro({
  reserva,
  monto,
  etiqueta,
  accion,
  onAccion,
  ocupado,
}: {
  reserva: ReservaFinanzas;
  monto: number;
  etiqueta: string;
  accion: string;
  onAccion: () => void;
  ocupado: boolean;
}) {
  return (
    <View style={styles.filaCobro}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cobroNombre} numberOfLines={1}>
          {reserva.nombre ?? "Sin nombre"}
        </Text>
        <Text style={styles.cobroDetalle}>
          {aFecha(reserva.fecha).toLocaleDateString("es-CR", {
            day: "numeric",
            month: "short",
          })}
          {" · "}
          {fmtColones(monto)} de {etiqueta}
        </Text>
      </View>
      <Pressable style={styles.botonChico} disabled={ocupado} onPress={onAccion}>
        {ocupado ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.botonChicoTexto}>{accion}</Text>
        )}
      </Pressable>
    </View>
  );
}

/** La hoja para anotar un gasto. */
function ModalGasto({
  visible,
  onCerrar,
  ranchoId,
  onGuardado,
}: {
  visible: boolean;
  onCerrar: () => void;
  ranchoId: string;
  onGuardado: () => void;
}) {
  const hoy = claveFecha(new Date());
  const [fecha, setFecha] = useState(hoy);
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaGasto>("otro");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    const conceptoLimpio = concepto.trim();
    if (!conceptoLimpio) return setError("Escribí en qué gastaste.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return setError("La fecha va como 2026-07-31.");
    const montoNum = Number(monto.replace(/[^\d]/g, ""));
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return setError("El monto tiene que ser mayor a cero.");
    }

    setGuardando(true);
    const { error: err } = await supabase.from("gastos_rancho").insert({
      rancho_id: ranchoId,
      fecha,
      concepto: conceptoLimpio.slice(0, 120),
      categoria,
      monto: montoNum,
      nota: nota.trim() ? nota.trim().slice(0, 300) : null,
    });
    setGuardando(false);

    if (err) {
      setError("No se pudo guardar: " + err.message);
      return;
    }

    setConcepto("");
    setMonto("");
    setNota("");
    setCategoria("otro");
    setFecha(hoy);
    onGuardado();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <Pressable style={styles.hojaFondo} onPress={onCerrar}>
        <Pressable style={styles.hoja} onPress={(e) => e.stopPropagation()}>
          <View style={styles.hojaEncabezado}>
            <Text style={styles.hojaTitulo}>Anotar un gasto</Text>
            <Pressable onPress={onCerrar} hitSlop={10}>
              <Ionicons name="close" size={22} color={Colors.ink} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.three }}>
            <View style={styles.campo}>
              <Text style={styles.campoEtiqueta}>¿En qué gastaste?</Text>
              <TextInput
                value={concepto}
                onChangeText={setConcepto}
                placeholder="Pago al personal del sábado"
                placeholderTextColor={Colors.inkMuted}
                maxLength={120}
                style={styles.input}
              />
            </View>

            <View style={styles.campo}>
              <Text style={styles.campoEtiqueta}>Monto</Text>
              <TextInput
                value={monto}
                onChangeText={setMonto}
                placeholder="45000"
                placeholderTextColor={Colors.inkMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.campo}>
              <Text style={styles.campoEtiqueta}>Fecha</Text>
              <TextInput
                value={fecha}
                onChangeText={setFecha}
                placeholder="2026-07-31"
                placeholderTextColor={Colors.inkMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={styles.input}
              />
            </View>

            <View style={styles.campo}>
              <Text style={styles.campoEtiqueta}>Categoría</Text>
              <View style={styles.categorias}>
                {CATEGORIAS_GASTO.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategoria(c.id)}
                    style={[styles.categoria, categoria === c.id && styles.categoriaActiva]}
                  >
                    <Text
                      style={[
                        styles.categoriaTexto,
                        categoria === c.id && styles.categoriaTextoActiva,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.campo}>
              <Text style={styles.campoEtiqueta}>Nota (opcional)</Text>
              <TextInput
                value={nota}
                onChangeText={setNota}
                placeholder="Detalle que quieras recordar"
                placeholderTextColor={Colors.inkMuted}
                maxLength={300}
                style={styles.input}
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable style={styles.botonGuardar} disabled={guardando} onPress={guardar}>
              {guardando ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.botonGuardarTexto}>Guardar gasto</Text>
              )}
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: { backgroundColor: Colors.cream, flex: 1 },
  centro: { alignItems: "center", flex: 1, justifyContent: "center" },
  scroll: { gap: Spacing.three, padding: Spacing.three, paddingBottom: Spacing.six },

  pestanas: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  pestana: {
    borderColor: Colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 9,
  },
  pestanaActiva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pestanaTexto: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    textAlign: "center",
  },
  pestanaTextoActiva: { color: "#ffffff" },

  tarjetaNeto: {
    backgroundColor: Colors.navy,
    borderRadius: Radios.lg,
    padding: Spacing.four,
  },
  netoRotulo: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: Fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  netoMonto: {
    color: "#ffffff",
    fontFamily: Fonts.extraBold,
    fontSize: 32,
    letterSpacing: -0.9,
    marginTop: 4,
  },
  netoDetalle: {
    borderTopColor: "rgba(255,255,255,0.15)",
    borderTopWidth: 1,
    flexDirection: "row",
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
  },
  netoColumna: { flex: 1, gap: 2 },
  netoColumnaRotulo: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },
  netoColumnaValor: { color: "#ffffff", fontFamily: Fonts.extraBold, fontSize: 16 },
  netoDivisor: { backgroundColor: "rgba(255,255,255,0.15)", width: 1 },
  netoDesglose: {
    color: "rgba(255,255,255,0.65)",
    fontFamily: Fonts.medium,
    fontSize: 11.5,
    marginTop: 8,
    textAlign: "center",
  },

  tarjetasFila: { flexDirection: "row", gap: Spacing.three },
  metrica: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    padding: Spacing.three,
  },
  metricaRotulo: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 11 },
  metricaValor: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 16.5 },
  metricaValorAlerta: { color: Colors.danger },

  bloque: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: Radios.lg,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  bloqueEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bloqueTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 15 },
  tituloAlerta: { color: Colors.danger },
  bloqueAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17 },
  vacio: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: Spacing.two,
  },

  semana: { alignItems: "center", flexDirection: "row", gap: Spacing.two },
  semanaRango: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 11, width: 84 },
  semanaActual: { color: Colors.navy, fontFamily: Fonts.extraBold },
  barras: { flex: 1, flexDirection: "row", gap: 2, height: 16 },
  barra: { borderRadius: 3 },
  barraEntro: { backgroundColor: Colors.green },
  barraPorCobrar: { backgroundColor: Colors.sky },
  semanaMonto: {
    color: Colors.ink,
    fontFamily: Fonts.bold,
    fontSize: 11,
    textAlign: "right",
    width: 60,
  },
  leyenda: { flexDirection: "row", gap: Spacing.three, justifyContent: "center", marginTop: 4 },
  leyendaItem: { alignItems: "center", flexDirection: "row", gap: 5 },
  leyendaPunto: { borderRadius: 3, height: 9, width: 9 },
  leyendaTexto: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 11 },

  filaCobro: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  cobroNombre: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
  cobroDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  botonChico: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 12,
    flexDirection: "row",
    gap: 4,
    minWidth: 84,
    justifyContent: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  botonChicoTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 12 },

  filaGasto: {
    alignItems: "center",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  gastoConcepto: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13.5 },
  gastoDetalle: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 11.5, marginTop: 1 },
  gastoMonto: { color: Colors.danger, fontFamily: Fonts.extraBold, fontSize: 14 },
  pistaBorrar: {
    color: Colors.inkMuted,
    fontFamily: Fonts.medium,
    fontSize: 11,
    textAlign: "center",
  },

  hojaFondo: { backgroundColor: "rgba(10,16,32,0.45)", flex: 1, justifyContent: "flex-end" },
  hoja: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radios.xl,
    borderTopRightRadius: Radios.xl,
    maxHeight: "88%",
    padding: Spacing.three,
  },
  hojaEncabezado: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: Spacing.three,
  },
  hojaTitulo: { color: Colors.ink, fontFamily: Fonts.extraBold, fontSize: 17 },
  campo: { gap: 5 },
  campoEtiqueta: { color: Colors.ink, fontFamily: Fonts.bold, fontSize: 13 },
  input: {
    backgroundColor: Colors.cream,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
  },
  categorias: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  categoria: {
    borderColor: Colors.lineFuerte,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoriaActiva: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  categoriaTexto: { color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 12 },
  categoriaTextoActiva: { color: "#ffffff" },
  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    color: Colors.danger,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    padding: Spacing.two,
  },
  botonGuardar: {
    alignItems: "center",
    backgroundColor: Colors.sky,
    borderRadius: 12,
    paddingVertical: 14,
  },
  botonGuardarTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 14.5 },
});
