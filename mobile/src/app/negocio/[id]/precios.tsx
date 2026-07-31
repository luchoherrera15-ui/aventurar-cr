import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BarraSuperior from "@/components/barra-superior";
import { supabase } from "@/lib/supabase";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

/**
 * Precios y descuentos del negocio — la pestaña "Precios" del panel de
 * la web (/mi-rancho/[id]?tab=precios).
 *
 * Lo que NO está acá porque ya vive en "Cobros y tarifas": las cuentas
 * de pago, el depósito, el cupo de eventos por día y las tarifas de
 * los negocios de servicio (que se guardan en `detalles`). Esta
 * pantalla es lo otro: los rangos por invitados de un LUGAR, sus
 * servicios adicionales, y los descuentos — códigos y promos por día.
 *
 * Cada lista se guarda con la misma estrategia que la web (borrar todo
 * e insertar de nuevo): son listas cortas, se editan enteras, y así no
 * hay que llevar la cuenta de qué fila cambió.
 */

type Tier = {
  /** Los que ya existen traen su id; los nuevos van sin él. */
  id?: string;
  min_invitados: string;
  max_invitados: string;
  precio: string;
};

type Servicio = {
  id?: string;
  nombre: string;
  precio: string;
  activo: boolean;
};

type Codigo = {
  id?: string;
  codigo: string;
  tipo: "porcentaje" | "monto_fijo";
  valor: string;
  activo: boolean;
};

type Promo = {
  id?: string;
  dias_semana: number[];
  porcentaje_descuento: string;
  etiqueta: string;
  activo: boolean;
};

const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type Seccion = "tarifas" | "descuentos";

export default function PreciosNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [nombre, setNombre] = useState<string | null>(null);
  const [esLugar, setEsLugar] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [seccion, setSeccion] = useState<Seccion>("tarifas");

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tarifaDiciembre, setTarifaDiciembre] = useState("");
  const [codigos, setCodigos] = useState<Codigo[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    const [ranchoRes, tiersRes, serviciosRes, codigosRes, promosRes] = await Promise.all([
      supabase
        .from("ranchos")
        .select("nombre, categoria, tarifa_diciembre_por_persona")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("precio_tiers")
        .select("id, min_invitados, max_invitados, precio")
        .eq("rancho_id", id)
        .order("min_invitados"),
      supabase
        .from("servicios_adicionales")
        .select("id, nombre, precio, activo")
        .eq("rancho_id", id)
        .order("nombre"),
      supabase
        .from("codigos_descuento")
        .select("id, codigo, tipo, valor, activo")
        .eq("rancho_id", id)
        .order("codigo"),
      supabase
        .from("promociones_dia")
        .select("id, dias_semana, porcentaje_descuento, etiqueta, activo")
        .eq("rancho_id", id),
    ]);

    const r = ranchoRes.data;
    setNombre((r?.nombre as string) ?? null);
    setEsLugar(r?.categoria === "lugares");
    setTarifaDiciembre(
      r?.tarifa_diciembre_por_persona ? String(r.tarifa_diciembre_por_persona) : "",
    );

    setTiers(
      (tiersRes.data ?? []).map((t) => ({
        id: t.id as string,
        min_invitados: String(t.min_invitados),
        max_invitados: String(t.max_invitados),
        precio: String(t.precio),
      })),
    );
    setServicios(
      (serviciosRes.data ?? []).map((s) => ({
        id: s.id as string,
        nombre: String(s.nombre),
        precio: String(s.precio),
        activo: s.activo !== false,
      })),
    );
    setCodigos(
      (codigosRes.data ?? []).map((c) => ({
        id: c.id as string,
        codigo: String(c.codigo),
        tipo: (c.tipo as "porcentaje" | "monto_fijo") ?? "porcentaje",
        valor: String(c.valor),
        activo: c.activo !== false,
      })),
    );
    setPromos(
      (promosRes.data ?? []).map((p) => ({
        id: p.id as string,
        dias_semana: (p.dias_semana as number[]) ?? [],
        porcentaje_descuento: String(p.porcentaje_descuento),
        etiqueta: String(p.etiqueta ?? ""),
        activo: p.activo !== false,
      })),
    );
    setCargado(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const num = (v: string): number | null => {
    const limpio = v.replace(/[^\d]/g, "");
    if (!limpio) return null;
    const n = Number(limpio);
    return Number.isFinite(n) ? n : null;
  };

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    setError(null);

    try {
      // ---- Los rangos por invitados y la tarifa de diciembre ----
      if (esLugar) {
        for (const t of tiers) {
          const min = num(t.min_invitados);
          const max = num(t.max_invitados);
          const precio = num(t.precio);
          if (min === null || max === null || precio === null) {
            setError("Cada rango necesita desde, hasta y precio.");
            return;
          }
          if (max < min) {
            setError(`El rango ${min}–${max} está al revés: el "hasta" es menor que el "desde".`);
            return;
          }
        }

        await supabase.from("precio_tiers").delete().eq("rancho_id", id);
        if (tiers.length > 0) {
          const { error: err } = await supabase.from("precio_tiers").insert(
            tiers.map((t) => ({
              rancho_id: id,
              min_invitados: num(t.min_invitados),
              max_invitados: num(t.max_invitados),
              precio: num(t.precio),
            })),
          );
          if (err) {
            setError("No se pudieron guardar los rangos: " + err.message);
            return;
          }
        }

        const { error: errRancho } = await supabase
          .from("ranchos")
          .update({ tarifa_diciembre_por_persona: num(tarifaDiciembre) })
          .eq("id", id);
        if (errRancho) {
          setError("No se pudo guardar la tarifa de diciembre: " + errRancho.message);
          return;
        }
      }

      // ---- Los servicios adicionales ----
      const serviciosLimpios = servicios.filter((s) => s.nombre.trim());
      await supabase.from("servicios_adicionales").delete().eq("rancho_id", id);
      if (serviciosLimpios.length > 0) {
        const { error: err } = await supabase.from("servicios_adicionales").insert(
          serviciosLimpios.map((s) => ({
            rancho_id: id,
            nombre: s.nombre.trim().slice(0, 120),
            precio: num(s.precio) ?? 0,
            activo: s.activo,
          })),
        );
        if (err) {
          setError("No se pudieron guardar los servicios: " + err.message);
          return;
        }
      }

      // ---- Los códigos ----
      const codigosLimpios = codigos.filter((c) => c.codigo.trim());
      await supabase.from("codigos_descuento").delete().eq("rancho_id", id);
      if (codigosLimpios.length > 0) {
        const { error: err } = await supabase.from("codigos_descuento").insert(
          codigosLimpios.map((c) => ({
            rancho_id: id,
            codigo: c.codigo.trim().toUpperCase(),
            tipo: c.tipo,
            valor: num(c.valor) ?? 0,
            activo: c.activo,
          })),
        );
        if (err) {
          setError(
            err.code === "23505"
              ? "Hay un código repetido — cada código debe ser único."
              : "No se pudieron guardar los códigos: " + err.message,
          );
          return;
        }
      }

      // ---- Las promos por día ----
      const promosLimpias = promos.filter((p) => p.dias_semana.length > 0);
      await supabase.from("promociones_dia").delete().eq("rancho_id", id);
      if (promosLimpias.length > 0) {
        const { error: err } = await supabase.from("promociones_dia").insert(
          promosLimpias.map((p) => ({
            rancho_id: id,
            dias_semana: p.dias_semana,
            porcentaje_descuento: num(p.porcentaje_descuento) ?? 0,
            etiqueta: p.etiqueta.trim().slice(0, 80) || "Promoción",
            activo: p.activo,
          })),
        );
        if (err) {
          setError("No se pudieron guardar las promociones: " + err.message);
          return;
        }
      }

      setMensaje("Listo, se guardó.");
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  if (!cargado) {
    return (
      <View style={styles.contenedor}>
        <BarraSuperior titulo="Precios" />
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo="Precios y descuentos" subtitulo={nombre ?? undefined} />

      <View style={styles.pestanas}>
        {(
          [
            { id: "tarifas" as const, label: esLugar ? "Tarifas" : "Servicios" },
            { id: "descuentos" as const, label: "Descuentos" },
          ]
        ).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setSeccion(p.id)}
            style={[styles.pestana, seccion === p.id && styles.pestanaActiva]}
          >
            <Text style={[styles.pestanaTexto, seccion === p.id && styles.pestanaTextoActiva]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {seccion === "tarifas" && (
          <>
            {esLugar ? (
              <>
                <View style={styles.bloque}>
                  <View style={styles.bloqueEncabezado}>
                    <Text style={styles.bloqueTitulo}>Precio por cantidad de invitados</Text>
                    <BotonAgregar
                      onPress={() =>
                        setTiers([...tiers, { min_invitados: "", max_invitados: "", precio: "" }])
                      }
                    />
                  </View>
                  <Text style={styles.bloqueAyuda}>
                    Un rango por fila. El cotizador busca el rango donde cae la
                    cantidad de invitados de la reserva.
                  </Text>

                  {tiers.length === 0 ? (
                    <Text style={styles.vacio}>
                      Sin rangos, tu salón no se puede cotizar solo.
                    </Text>
                  ) : (
                    tiers.map((t, i) => (
                      <View key={t.id ?? `nuevo-${i}`} style={styles.filaEditable}>
                        <View style={styles.filaCampos}>
                          <CampoChico
                            etiqueta="Desde"
                            value={t.min_invitados}
                            onChangeText={(v) => {
                              const copia = [...tiers];
                              copia[i] = { ...copia[i], min_invitados: v };
                              setTiers(copia);
                            }}
                          />
                          <CampoChico
                            etiqueta="Hasta"
                            value={t.max_invitados}
                            onChangeText={(v) => {
                              const copia = [...tiers];
                              copia[i] = { ...copia[i], max_invitados: v };
                              setTiers(copia);
                            }}
                          />
                          <CampoChico
                            etiqueta="Precio ₡"
                            ancho
                            value={t.precio}
                            onChangeText={(v) => {
                              const copia = [...tiers];
                              copia[i] = { ...copia[i], precio: v };
                              setTiers(copia);
                            }}
                          />
                        </View>
                        <BotonQuitar onPress={() => setTiers(tiers.filter((_, j) => j !== i))} />
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.bloque}>
                  <Text style={styles.bloqueTitulo}>Tarifa de diciembre</Text>
                  <Text style={styles.bloqueAyuda}>
                    Por persona, solo para diciembre. Dejalo vacío si cobrás igual
                    todo el año.
                  </Text>
                  <TextInput
                    value={tarifaDiciembre}
                    onChangeText={setTarifaDiciembre}
                    placeholder="15000"
                    placeholderTextColor={Colors.inkMuted}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </>
            ) : (
              <View style={styles.bloque}>
                <Text style={styles.bloqueAyuda}>
                  Las tarifas de tu servicio (por persona, por hora, por evento)
                  se configuran en “Cobros y tarifas”. Acá van los extras que el
                  cliente puede sumar a su reserva.
                </Text>
              </View>
            )}

            <View style={styles.bloque}>
              <View style={styles.bloqueEncabezado}>
                <Text style={styles.bloqueTitulo}>Servicios adicionales</Text>
                <BotonAgregar
                  onPress={() =>
                    setServicios([...servicios, { nombre: "", precio: "", activo: true }])
                  }
                />
              </View>
              <Text style={styles.bloqueAyuda}>
                Extras que el cliente elige al reservar: proyector, toldo, hora
                extra, lo que ofrezcas.
              </Text>

              {servicios.length === 0 ? (
                <Text style={styles.vacio}>Todavía no ofrecés extras.</Text>
              ) : (
                servicios.map((s, i) => (
                  <View key={s.id ?? `nuevo-${i}`} style={styles.filaEditable}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <TextInput
                        value={s.nombre}
                        onChangeText={(v) => {
                          const copia = [...servicios];
                          copia[i] = { ...copia[i], nombre: v };
                          setServicios(copia);
                        }}
                        placeholder="Proyector y pantalla"
                        placeholderTextColor={Colors.inkMuted}
                        style={styles.input}
                      />
                      <View style={styles.filaCampos}>
                        <CampoChico
                          etiqueta="Precio ₡"
                          ancho
                          value={s.precio}
                          onChangeText={(v) => {
                            const copia = [...servicios];
                            copia[i] = { ...copia[i], precio: v };
                            setServicios(copia);
                          }}
                        />
                        <View style={styles.switchFila}>
                          <Text style={styles.switchTexto}>Activo</Text>
                          <Switch
                            value={s.activo}
                            trackColor={{ true: Colors.navy }}
                            onValueChange={(v) => {
                              const copia = [...servicios];
                              copia[i] = { ...copia[i], activo: v };
                              setServicios(copia);
                            }}
                          />
                        </View>
                      </View>
                    </View>
                    <BotonQuitar
                      onPress={() => setServicios(servicios.filter((_, j) => j !== i))}
                    />
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {seccion === "descuentos" && (
          <>
            <View style={styles.bloque}>
              <View style={styles.bloqueEncabezado}>
                <Text style={styles.bloqueTitulo}>Códigos de descuento</Text>
                <BotonAgregar
                  onPress={() =>
                    setCodigos([
                      ...codigos,
                      { codigo: "", tipo: "porcentaje", valor: "", activo: true },
                    ])
                  }
                />
              </View>
              <Text style={styles.bloqueAyuda}>
                El cliente los escribe al reservar. No se listan en ningún lado:
                los repartís vos.
              </Text>

              {codigos.length === 0 ? (
                <Text style={styles.vacio}>Sin códigos activos.</Text>
              ) : (
                codigos.map((c, i) => (
                  <View key={c.id ?? `nuevo-${i}`} style={styles.filaEditable}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <TextInput
                        value={c.codigo}
                        onChangeText={(v) => {
                          const copia = [...codigos];
                          copia[i] = { ...copia[i], codigo: v.toUpperCase() };
                          setCodigos(copia);
                        }}
                        placeholder="BODA10"
                        placeholderTextColor={Colors.inkMuted}
                        autoCapitalize="characters"
                        style={styles.input}
                      />
                      <View style={styles.filaCampos}>
                        <Pressable
                          style={styles.selectorTipo}
                          onPress={() => {
                            const copia = [...codigos];
                            copia[i] = {
                              ...copia[i],
                              tipo: c.tipo === "porcentaje" ? "monto_fijo" : "porcentaje",
                            };
                            setCodigos(copia);
                          }}
                        >
                          <Text style={styles.selectorTipoTexto}>
                            {c.tipo === "porcentaje" ? "%" : "₡"}
                          </Text>
                          <Ionicons name="swap-horizontal" size={13} color={Colors.navy} />
                        </Pressable>
                        <CampoChico
                          etiqueta={c.tipo === "porcentaje" ? "Descuento %" : "Descuento ₡"}
                          ancho
                          value={c.valor}
                          onChangeText={(v) => {
                            const copia = [...codigos];
                            copia[i] = { ...copia[i], valor: v };
                            setCodigos(copia);
                          }}
                        />
                        <View style={styles.switchFila}>
                          <Switch
                            value={c.activo}
                            trackColor={{ true: Colors.navy }}
                            onValueChange={(v) => {
                              const copia = [...codigos];
                              copia[i] = { ...copia[i], activo: v };
                              setCodigos(copia);
                            }}
                          />
                        </View>
                      </View>
                    </View>
                    <BotonQuitar onPress={() => setCodigos(codigos.filter((_, j) => j !== i))} />
                  </View>
                ))
              )}
            </View>

            <View style={styles.bloque}>
              <View style={styles.bloqueEncabezado}>
                <Text style={styles.bloqueTitulo}>Promociones por día</Text>
                <BotonAgregar
                  onPress={() =>
                    setPromos([
                      ...promos,
                      {
                        dias_semana: [],
                        porcentaje_descuento: "",
                        etiqueta: "",
                        activo: true,
                      },
                    ])
                  }
                />
              </View>
              <Text style={styles.bloqueAyuda}>
                Descuento automático para los días flojos — se aplica solo, sin
                que el cliente escriba nada.
              </Text>

              {promos.length === 0 ? (
                <Text style={styles.vacio}>Sin promociones automáticas.</Text>
              ) : (
                promos.map((p, i) => (
                  <View key={p.id ?? `nuevo-${i}`} style={styles.promo}>
                    <View style={styles.bloqueEncabezado}>
                      <TextInput
                        value={p.etiqueta}
                        onChangeText={(v) => {
                          const copia = [...promos];
                          copia[i] = { ...copia[i], etiqueta: v };
                          setPromos(copia);
                        }}
                        placeholder="Martes de 20%"
                        placeholderTextColor={Colors.inkMuted}
                        style={[styles.input, { flex: 1 }]}
                      />
                      <BotonQuitar onPress={() => setPromos(promos.filter((_, j) => j !== i))} />
                    </View>

                    <View style={styles.dias}>
                      {DIAS_CORTO.map((d, dia) => {
                        const activo = p.dias_semana.includes(dia);
                        return (
                          <Pressable
                            key={d}
                            onPress={() => {
                              const copia = [...promos];
                              copia[i] = {
                                ...copia[i],
                                dias_semana: activo
                                  ? p.dias_semana.filter((x) => x !== dia)
                                  : [...p.dias_semana, dia].sort(),
                              };
                              setPromos(copia);
                            }}
                            style={[styles.dia, activo && styles.diaActivo]}
                          >
                            <Text style={[styles.diaTexto, activo && styles.diaTextoActivo]}>
                              {d}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.filaCampos}>
                      <CampoChico
                        etiqueta="Descuento %"
                        ancho
                        value={p.porcentaje_descuento}
                        onChangeText={(v) => {
                          const copia = [...promos];
                          copia[i] = { ...copia[i], porcentaje_descuento: v };
                          setPromos(copia);
                        }}
                      />
                      <View style={styles.switchFila}>
                        <Text style={styles.switchTexto}>Activa</Text>
                        <Switch
                          value={p.activo}
                          trackColor={{ true: Colors.navy }}
                          onValueChange={(v) => {
                            const copia = [...promos];
                            copia[i] = { ...copia[i], activo: v };
                            setPromos(copia);
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {mensaje && <Text style={styles.exito}>{mensaje}</Text>}

        <Pressable style={styles.botonGuardar} disabled={guardando} onPress={guardar}>
          {guardando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.botonGuardarTexto}>Guardar cambios</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function CampoChico({
  etiqueta,
  value,
  onChangeText,
  ancho,
}: {
  etiqueta: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Para el campo de plata, que necesita más espacio que "Desde". */
  ancho?: boolean;
}) {
  return (
    <View style={[styles.campoChico, ancho && { flex: 1.6 }]}>
      <Text style={styles.campoChicoEtiqueta}>{etiqueta}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        placeholderTextColor={Colors.inkMuted}
        style={styles.input}
      />
    </View>
  );
}

function BotonAgregar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.botonAgregar} onPress={onPress} hitSlop={6}>
      <Ionicons name="add" size={15} color="#ffffff" />
      <Text style={styles.botonAgregarTexto}>Agregar</Text>
    </Pressable>
  );
}

function BotonQuitar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Quitar"
      onPress={onPress}
      hitSlop={8}
      style={styles.botonQuitar}
    >
      <Ionicons name="trash-outline" size={16} color={Colors.danger} />
    </Pressable>
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
    gap: Spacing.two,
    justifyContent: "space-between",
  },
  bloqueTitulo: { color: Colors.ink, flex: 1, fontFamily: Fonts.extraBold, fontSize: 15 },
  bloqueAyuda: { color: Colors.inkSoft, fontFamily: Fonts.medium, fontSize: 12, lineHeight: 17 },
  vacio: {
    color: Colors.inkSoft,
    fontFamily: Fonts.medium,
    fontSize: 12.5,
    paddingVertical: Spacing.two,
  },

  filaEditable: {
    alignItems: "flex-start",
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  filaCampos: { alignItems: "flex-end", flex: 1, flexDirection: "row", gap: Spacing.two },
  campoChico: { flex: 1, gap: 3 },
  campoChicoEtiqueta: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 10.5 },
  input: {
    backgroundColor: Colors.cream,
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    color: Colors.ink,
    fontFamily: Fonts.medium,
    fontSize: 14,
    paddingHorizontal: Spacing.two,
    paddingVertical: 9,
  },
  switchFila: { alignItems: "center", flexDirection: "row", gap: 4 },
  switchTexto: { color: Colors.inkSoft, fontFamily: Fonts.semiBold, fontSize: 11 },
  selectorTipo: {
    alignItems: "center",
    borderColor: Colors.lineFuerte,
    borderRadius: Radios.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  selectorTipoTexto: { color: Colors.navy, fontFamily: Fonts.extraBold, fontSize: 14 },

  promo: {
    borderTopColor: Colors.line,
    borderTopWidth: 1,
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  dias: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  dia: {
    borderColor: Colors.lineFuerte,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  diaActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  diaTexto: { color: Colors.ink, fontFamily: Fonts.semiBold, fontSize: 11.5 },
  diaTextoActivo: { color: "#ffffff" },

  botonAgregar: {
    alignItems: "center",
    backgroundColor: Colors.navy,
    borderRadius: 12,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  botonAgregarTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 11.5 },
  botonQuitar: {
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    height: 36,
    justifyContent: "center",
    width: 36,
  },

  error: {
    backgroundColor: Colors.dangerLight,
    borderRadius: Radios.sm,
    color: Colors.danger,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    padding: Spacing.three,
  },
  exito: {
    backgroundColor: Colors.greenLight,
    borderRadius: Radios.sm,
    color: Colors.green,
    fontFamily: Fonts.bold,
    fontSize: 12.5,
    padding: Spacing.three,
  },
  botonGuardar: {
    alignItems: "center",
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
  },
  botonGuardarTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
});
