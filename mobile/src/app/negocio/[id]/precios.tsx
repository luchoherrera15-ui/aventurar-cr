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
import { cargarTiersPorTemporada, type FilaPrecioTier } from "@/lib/precio-tiers";
import type { ModalidadPrecioLugar, Rancho, TemporadaPrecio } from "@/lib/types";
import { Colors, Fonts, Radios, Spacing } from "@/constants/theme";

/**
 * Precios y descuentos del negocio — la pestaña "Precios" del panel de
 * la web (/mi-negocio/[id]?tab=precios).
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
 *
 * DICIEMBRE (0099): ese mes tiene su propia lista de precios, con la
 * misma forma que la del resto del año — rangos aparte para los lugares
 * que cobran por invitados, y un precio por hora / por evento aparte
 * para los otros dos modos. Dejarlo todo vacío = diciembre se cobra
 * igual que siempre. La modalidad de cobro NO se elige acá (eso sigue
 * siendo del panel web): esta pantalla solo la lee para mostrar el
 * campo de diciembre que corresponde.
 */

type Tier = {
  /** Los que ya existen traen su id; los nuevos van sin él. */
  id?: string;
  min_invitados: string;
  max_invitados: string;
  precio: string;
};

const TIER_VACIO: Tier = { min_invitados: "", max_invitados: "", precio: "" };

/** Los enteros que escribe el dueño: solo dígitos, vacío = sin dato. */
function num(v: string): number | null {
  const limpio = v.replace(/[^\d]/g, "");
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function aTier(fila: FilaPrecioTier): Tier {
  return {
    id: fila.id,
    min_invitados: String(fila.min_invitados),
    max_invitados: String(fila.max_invitados),
    precio: String(fila.precio),
  };
}

/**
 * El primer problema de una lista de rangos, o null si está bien. La
 * etiqueta dice de cuál de las dos listas se está hablando, que si no
 * el dueño no sabe cuál corregir.
 */
function problemaDeRangos(tiers: Tier[], etiqueta: string): string | null {
  for (const t of tiers) {
    const min = num(t.min_invitados);
    const max = num(t.max_invitados);
    const precio = num(t.precio);
    if (min === null || max === null || precio === null) {
      return `Cada rango ${etiqueta} necesita desde, hasta y precio.`;
    }
    if (max < min) {
      return `El rango ${etiqueta} ${min}–${max} está al revés: el "hasta" es menor que el "desde".`;
    }
  }
  return null;
}

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
  tipo: "porcentaje" | "precio_fijo";
  porcentaje_descuento: string;
  precio_fijo: string;
  personas_max: string;
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
  const [tiersDiciembre, setTiersDiciembre] = useState<Tier[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tarifaDiciembre, setTarifaDiciembre] = useState("");
  const [precioHoraDiciembre, setPrecioHoraDiciembre] = useState("");
  const [precioFijoDiciembre, setPrecioFijoDiciembre] = useState("");
  /** Cómo cobra este lugar; acá solo se lee (se elige en el panel web). */
  const [modalidad, setModalidad] = useState<ModalidadPrecioLugar>("rango_personas");
  /** false = la migración 0099 todavía no corrió en esta base: la
   *  pantalla sigue funcionando como antes, sin lo de diciembre. */
  const [soportaDiciembre, setSoportaDiciembre] = useState(false);
  const [codigos, setCodigos] = useState<Codigo[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    const [ranchoRes, tiersPorTemporada, serviciosRes, codigosRes, promosRes] = await Promise.all([
      // `*` a propósito: los campos de diciembre los agrega la 0099 y
      // pedirlos por nombre rompería la pantalla entera en una base sin
      // migrar. Con `*` simplemente no vienen, y se ve el editor de antes.
      supabase.from("ranchos").select("*").eq("id", id).maybeSingle(),
      cargarTiersPorTemporada(id),
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
        .select("id, dias_semana, tipo, porcentaje_descuento, precio_fijo, personas_max, etiqueta, activo")
        .eq("rancho_id", id),
    ]);

    const r = (ranchoRes.data ?? null) as Partial<Rancho> | null;
    setNombre(r?.nombre ?? null);
    setEsLugar(r?.categoria === "lugares");
    setModalidad(r?.modalidad_precio_lugar ?? "rango_personas");
    setTarifaDiciembre(
      r?.tarifa_diciembre_por_persona ? String(r.tarifa_diciembre_por_persona) : "",
    );
    setPrecioHoraDiciembre(r?.precio_hora_diciembre ? String(r.precio_hora_diciembre) : "");
    setPrecioFijoDiciembre(r?.precio_fijo_diciembre ? String(r.precio_fijo_diciembre) : "");
    // Las columnas de la 0099 van todas juntas: si la fila del rancho ya
    // trae las suyas y los rangos aceptan `temporada`, hay diciembre.
    setSoportaDiciembre(
      tiersPorTemporada.soportaTemporada && !!r && "precio_fijo_diciembre" in r,
    );

    setTiers(tiersPorTemporada.normales.map(aTier));
    setTiersDiciembre(tiersPorTemporada.diciembre.map(aTier));
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
        tipo: (p.tipo as "porcentaje" | "precio_fijo") ?? "porcentaje",
        porcentaje_descuento: p.porcentaje_descuento !== null ? String(p.porcentaje_descuento) : "",
        precio_fijo: p.precio_fijo !== null ? String(p.precio_fijo) : "",
        personas_max: p.personas_max !== null ? String(p.personas_max) : "",
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

  /** Una fila de `precio_tiers` lista para insertar. */
  function aFila(t: Tier, temporada: TemporadaPrecio) {
    return {
      rancho_id: id,
      min_invitados: num(t.min_invitados),
      max_invitados: num(t.max_invitados),
      precio: num(t.precio),
      ...(soportaDiciembre ? { temporada } : {}),
    };
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    setError(null);

    try {
      // ---- Los rangos por invitados (todo el año + diciembre) ----
      if (esLugar) {
        const problema =
          problemaDeRangos(tiers, "de todo el año") ??
          (soportaDiciembre ? problemaDeRangos(tiersDiciembre, "de diciembre") : null);
        if (problema) {
          setError(problema);
          return;
        }

        // Las dos listas viven en la misma tabla, separadas por
        // `temporada`, así que se reemplazan de una sola vez. Sin la
        // 0099 corrida no se manda la columna: se guarda como antes.
        const filas = [
          ...tiers.map((t) => aFila(t, "normal")),
          ...(soportaDiciembre ? tiersDiciembre.map((t) => aFila(t, "diciembre")) : []),
        ];

        await supabase.from("precio_tiers").delete().eq("rancho_id", id);
        if (filas.length > 0) {
          const { error: err } = await supabase.from("precio_tiers").insert(filas);
          if (err) {
            setError("No se pudieron guardar los rangos: " + err.message);
            return;
          }
        }

        // Los precios de diciembre que no son rangos. La modalidad y los
        // precios de todo el año NO se tocan acá: se editan en el panel web.
        const { error: errRancho } = await supabase
          .from("ranchos")
          .update({
            tarifa_diciembre_por_persona: num(tarifaDiciembre),
            ...(soportaDiciembre
              ? {
                  precio_hora_diciembre: num(precioHoraDiciembre),
                  precio_fijo_diciembre: num(precioFijoDiciembre),
                }
              : {}),
          })
          .eq("id", id);
        if (errRancho) {
          setError("No se pudieron guardar los precios de diciembre: " + errRancho.message);
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
      for (const p of promosLimpias) {
        const invalida =
          p.tipo === "porcentaje"
            ? !(num(p.porcentaje_descuento) && num(p.porcentaje_descuento)! > 0)
            : !(num(p.precio_fijo) && num(p.precio_fijo)! > 0);
        if (invalida) {
          setError(
            p.tipo === "porcentaje"
              ? "Cada promoción por día necesita un % de descuento mayor a 0."
              : "Cada promoción de precio fijo necesita un monto mayor a 0.",
          );
          return;
        }
      }
      await supabase.from("promociones_dia").delete().eq("rancho_id", id);
      if (promosLimpias.length > 0) {
        const { error: err } = await supabase.from("promociones_dia").insert(
          promosLimpias.map((p) => ({
            rancho_id: id,
            dias_semana: p.dias_semana,
            tipo: p.tipo,
            porcentaje_descuento: p.tipo === "porcentaje" ? (num(p.porcentaje_descuento) ?? 0) : null,
            precio_fijo: p.tipo === "precio_fijo" ? num(p.precio_fijo) : null,
            personas_max: p.tipo === "precio_fijo" ? num(p.personas_max) : null,
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
                <BloqueRangos
                  titulo="Precio por cantidad de invitados"
                  ayuda="Un rango por fila. El cotizador busca el rango donde cae la cantidad de invitados de la reserva."
                  vacio="Sin rangos, tu salón no se puede cotizar solo."
                  tiers={tiers}
                  onChange={setTiers}
                />

                {/* Diciembre: la misma forma de cobrar, con otros números.
                    Vacío = ese mes se cobra igual que el resto del año. */}
                {soportaDiciembre && modalidad === "rango_personas" && (
                  <BloqueRangos
                    titulo="Precios de diciembre"
                    ayuda="Los rangos que cobrás solo en diciembre. Si dejás esta lista vacía, diciembre se cobra con los precios de arriba."
                    vacio="Diciembre se cobra igual que el resto del año."
                    tiers={tiersDiciembre}
                    onChange={setTiersDiciembre}
                  />
                )}

                {modalidad === "rango_personas" && (
                  <View style={styles.bloque}>
                    <Text style={styles.bloqueTitulo}>Tarifa de diciembre por persona</Text>
                    <Text style={styles.bloqueAyuda}>
                      {soportaDiciembre
                        ? "La forma vieja de cobrar diciembre: un precio por persona. Solo se usa si no cargaste rangos de diciembre arriba. Dejala vacía si cobrás igual todo el año."
                        : "Por persona, solo para diciembre. Dejalo vacío si cobrás igual todo el año."}
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
                )}

                {soportaDiciembre && modalidad === "hora" && (
                  <View style={styles.bloque}>
                    <Text style={styles.bloqueTitulo}>Precio por hora en diciembre</Text>
                    <Text style={styles.bloqueAyuda}>
                      Lo que cobrás por hora solo en diciembre. Dejalo vacío y ese
                      mes se cobra con tu precio por hora de siempre.
                    </Text>
                    <TextInput
                      value={precioHoraDiciembre}
                      onChangeText={setPrecioHoraDiciembre}
                      placeholder="25000"
                      placeholderTextColor={Colors.inkMuted}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </View>
                )}

                {soportaDiciembre && modalidad === "fijo" && (
                  <View style={styles.bloque}>
                    <Text style={styles.bloqueTitulo}>Precio del evento en diciembre</Text>
                    <Text style={styles.bloqueAyuda}>
                      El monto fijo del alquiler solo en diciembre. Dejalo vacío y
                      ese mes se cobra con tu precio de siempre.
                    </Text>
                    <TextInput
                      value={precioFijoDiciembre}
                      onChangeText={setPrecioFijoDiciembre}
                      placeholder="350000"
                      placeholderTextColor={Colors.inkMuted}
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </View>
                )}
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
                        tipo: "porcentaje",
                        porcentaje_descuento: "",
                        precio_fijo: "",
                        personas_max: "",
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

                    <View style={styles.filaTipoPromo}>
                      {(["porcentaje", "precio_fijo"] as const).map((t) => {
                        const activo = p.tipo === t;
                        return (
                          <Pressable
                            key={t}
                            onPress={() => {
                              const copia = [...promos];
                              copia[i] = { ...copia[i], tipo: t };
                              setPromos(copia);
                            }}
                            style={[styles.tipoPromo, activo && styles.tipoPromoActivo]}
                          >
                            <Text style={[styles.tipoPromoTexto, activo && styles.tipoPromoTextoActivo]}>
                              {t === "porcentaje" ? "% de descuento" : "Precio fijo (₡)"}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <View style={styles.filaCampos}>
                      {p.tipo === "porcentaje" ? (
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
                      ) : (
                        <>
                          <CampoChico
                            etiqueta="Precio fijo ₡"
                            ancho
                            value={p.precio_fijo}
                            onChangeText={(v) => {
                              const copia = [...promos];
                              copia[i] = { ...copia[i], precio_fijo: v };
                              setPromos(copia);
                            }}
                          />
                          <CampoChico
                            etiqueta="Máx. personas"
                            value={p.personas_max}
                            onChangeText={(v) => {
                              const copia = [...promos];
                              copia[i] = { ...copia[i], personas_max: v };
                              setPromos(copia);
                            }}
                          />
                        </>
                      )}
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
                    {p.tipo === "precio_fijo" && (
                      <Text style={styles.bloqueAyuda}>
                        Sin máximo de personas, aplica para cualquier cantidad de invitados.
                      </Text>
                    )}
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

/**
 * Una lista editable de rangos "desde–hasta → precio". Se usa dos
 * veces: los precios de todo el año y los de diciembre (0099).
 */
function BloqueRangos({
  titulo,
  ayuda,
  vacio,
  tiers,
  onChange,
}: {
  titulo: string;
  ayuda: string;
  /** Qué decir cuando la lista está vacía. */
  vacio: string;
  tiers: Tier[];
  onChange: (tiers: Tier[]) => void;
}) {
  const editar = (i: number, campo: keyof Tier, valor: string) => {
    const copia = [...tiers];
    copia[i] = { ...copia[i], [campo]: valor };
    onChange(copia);
  };

  return (
    <View style={styles.bloque}>
      <View style={styles.bloqueEncabezado}>
        <Text style={styles.bloqueTitulo}>{titulo}</Text>
        <BotonAgregar onPress={() => onChange([...tiers, { ...TIER_VACIO }])} />
      </View>
      <Text style={styles.bloqueAyuda}>{ayuda}</Text>

      {tiers.length === 0 ? (
        <Text style={styles.vacio}>{vacio}</Text>
      ) : (
        tiers.map((t, i) => (
          <View key={t.id ?? `nuevo-${i}`} style={styles.filaEditable}>
            <View style={styles.filaCampos}>
              <CampoChico
                etiqueta="Desde"
                value={t.min_invitados}
                onChangeText={(v) => editar(i, "min_invitados", v)}
              />
              <CampoChico
                etiqueta="Hasta"
                value={t.max_invitados}
                onChangeText={(v) => editar(i, "max_invitados", v)}
              />
              <CampoChico
                etiqueta="Precio ₡"
                ancho
                value={t.precio}
                onChangeText={(v) => editar(i, "precio", v)}
              />
            </View>
            <BotonQuitar onPress={() => onChange(tiers.filter((_, j) => j !== i))} />
          </View>
        ))
      )}
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

  filaTipoPromo: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.two },
  tipoPromo: {
    borderColor: Colors.lineFuerte,
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tipoPromoActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  tipoPromoTexto: { color: Colors.inkSoft, fontFamily: Fonts.bold, fontSize: 11.5 },
  tipoPromoTextoActivo: { color: "#ffffff" },

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
    backgroundColor: Colors.sky,
    borderRadius: 12,
    paddingVertical: 15,
  },
  botonGuardarTexto: { color: "#ffffff", fontFamily: Fonts.bold, fontSize: 15 },
});
