import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode as decodeBase64 } from "base64-arraybuffer";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { comprimirImagen, FOTO_DE_VITRINA } from "@/lib/comprimir-imagen";
import BarraSuperior from "@/components/barra-superior";
import PanelNav, { ALTO_PANEL_NAV } from "@/components/panel-nav";
import { useAuth } from "@/lib/auth-context";
import { etiquetaDuracion } from "@/lib/catalogo";
import { Colors, Fonts, Spacing } from "@/constants/theme";
import {
  CATALOGO_LABEL,
  fmtColones,
  type Categoria,
  type LugarServicio,
  type ModalidadServicio,
  type RanchoItem,
} from "@/lib/types";

const UNIDADES = ["por persona", "por unidad", "por hora", "por evento", "por día"];

/** Modalidad y lugar son DOS preguntas distintas (0117): cuánta gente
 *  entra en la sesión, y dónde se presta. Una clase grupal puede ser
 *  en línea, así que no pueden compartir una sola lista. */
const MODALIDADES: { valor: ModalidadServicio | ""; label: string }[] = [
  { valor: "", label: "Individual" },
  { valor: "grupal", label: "Grupal" },
  { valor: "recurso", label: "Por recurso" },
];

const LUGARES: { valor: LugarServicio | ""; label: string }[] = [
  { valor: "", label: "Presencial" },
  { valor: "online", label: "En línea" },
  { valor: "hibrido", label: "Híbrido" },
];

type Borrador = {
  nombre: string;
  descripcion: string;
  precio: string;
  unidad: string;
  tipo: "paquete" | "producto";
  grupo: string;
  duracionHoras: string;
  /** Citas mide en minutos, no en horas (0055). */
  duracionMinutos: string;
  /** Limpieza/preparación después de la cita (0061). */
  bufferMin: string;
  fotoUrl: string | null;
  minPorReserva: string;
  maxPorReserva: string;
  capacidadDia: string;
  esPaqueteBase: boolean;
  /** "" = sin declarar, que la base interpreta como individual. */
  modalidad: ModalidadServicio | "";
  lugarServicio: LugarServicio | "";
  cupoMinSesion: string;
  cupoMaxSesion: string;
  anticipacionMinHoras: string;
  anticipacionMaxDias: string;
  depositoServicio: string;
};

const VACIO: Borrador = {
  nombre: "",
  descripcion: "",
  precio: "",
  unidad: "",
  tipo: "paquete",
  grupo: "",
  duracionHoras: "",
  duracionMinutos: "",
  bufferMin: "",
  fotoUrl: null,
  minPorReserva: "1",
  maxPorReserva: "",
  capacidadDia: "",
  esPaqueteBase: false,
  modalidad: "",
  lugarServicio: "",
  cupoMinSesion: "",
  cupoMaxSesion: "",
  anticipacionMinHoras: "",
  anticipacionMaxDias: "",
  depositoServicio: "",
};

/**
 * Columnas que agregó una migración posterior a la 0035, agrupadas POR
 * MIGRACIÓN. Postgres nombra una sola columna desconocida por error,
 * así que soltarlas todas de golpe haría que una base con la 0061 pero
 * sin la 0117 perdiera en silencio el buffer y la duración: se
 * guardaría "bien" y el dueño vería su configuración desaparecer.
 */
const GRUPOS_OPCIONALES: readonly (readonly string[])[] = [
  ["duracion_minutos"], // 0055
  ["buffer_min"], // 0061
  ["es_paquete_base"], // 0067
  ["modalidad", "lugar_servicio", "cupo_min_sesion", "cupo_max_sesion"], // 0117
  ["anticipacion_min_horas", "anticipacion_max_dias", "deposito_servicio"], // 0118
];

type Fila = Record<string, unknown>;
type Respuesta = { data: unknown; error: { message: string } | null };

/**
 * Guarda y, si la base no tiene alguna migración, reintenta sin las
 * columnas de ESA migración. Cada vuelta suelta un grupo que todavía
 * estaba en la fila, así que el ciclo siempre avanza y termina.
 */
async function guardarTolerante(
  fila: Fila,
  intentar: (fila: Fila) => PromiseLike<Respuesta>,
): Promise<Respuesta> {
  const actual: Fila = { ...fila };

  for (let vuelta = 0; vuelta <= GRUPOS_OPCIONALES.length; vuelta++) {
    const res = await intentar(actual);
    if (!res.error) return res;

    const culpable = GRUPOS_OPCIONALES.find((grupo) =>
      grupo.some((c) => c in actual && res.error!.message.includes(c)),
    );
    if (!culpable) return res;
    for (const c of culpable) delete actual[c];
  }

  return intentar(actual);
}

function num(v: string): number | null {
  const limpio = v.trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function deItem(item: RanchoItem): Borrador {
  return {
    nombre: item.nombre,
    descripcion: item.descripcion ?? "",
    precio: item.precio === null ? "" : String(item.precio),
    unidad: item.unidad ?? "",
    tipo: item.tipo,
    grupo: item.grupo ?? "",
    duracionHoras: item.duracion_horas === null ? "" : String(item.duracion_horas),
    duracionMinutos: item.duracion_minutos ? String(item.duracion_minutos) : "",
    bufferMin: item.buffer_min ? String(item.buffer_min) : "",
    fotoUrl: item.foto_url,
    minPorReserva: String(item.min_por_reserva),
    maxPorReserva: item.max_por_reserva === null ? "" : String(item.max_por_reserva),
    capacidadDia: item.capacidad_dia === null ? "" : String(item.capacidad_dia),
    esPaqueteBase: item.es_paquete_base === true,
    modalidad: item.modalidad ?? "",
    lugarServicio: item.lugar_servicio ?? "",
    cupoMinSesion: item.cupo_min_sesion ? String(item.cupo_min_sesion) : "",
    cupoMaxSesion: item.cupo_max_sesion ? String(item.cupo_max_sesion) : "",
    // El 0 es válido en la anticipación mínima ("hasta el último
    // minuto"), así que acá no sirve el truthy que usan los cupos.
    anticipacionMinHoras:
      item.anticipacion_min_horas === null || item.anticipacion_min_horas === undefined
        ? ""
        : String(item.anticipacion_min_horas),
    anticipacionMaxDias: item.anticipacion_max_dias
      ? String(item.anticipacion_max_dias)
      : "",
    depositoServicio:
      item.deposito_servicio === null || item.deposito_servicio === undefined
        ? ""
        : String(item.deposito_servicio),
  };
}

/**
 * El catálogo del negocio, editable desde la app: paquetes con foto,
 * duración, sección, mínimos y cupo por día — lo mismo que el panel
 * web. Un "paquete" es la unidad grande (Estación de fotos 5 horas);
 * un "producto" es lo que se pide por cantidad (un plato, una silla).
 * Las políticas de la base limitan todo al dueño del negocio.
 */
export default function CatalogoNegocioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [nombreNegocio, setNombreNegocio] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("otros");
  /** Solo para la barra del panel: cómo se llama esto en cada vertical. */
  const [vertical, setVertical] = useState<string | null>(null);
  const [items, setItems] = useState<RanchoItem[] | null>(null);
  const [editando, setEditando] = useState<string | "nuevo" | null>(null);
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cargar = useCallback(async () => {
    const [ranchoRes, itemsRes] = await Promise.all([
      supabase.from("ranchos").select("nombre, categoria, vertical").eq("id", id).maybeSingle(),
      supabase
        .from("rancho_items")
        .select("*")
        .eq("rancho_id", id)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    if (ranchoRes.data) {
      setNombreNegocio(ranchoRes.data.nombre as string);
      setCategoria(ranchoRes.data.categoria as Categoria);
      setVertical((ranchoRes.data.vertical as string) ?? null);
    }
    setItems((itemsRes.data ?? []) as RanchoItem[]);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  function aFila(b: Borrador) {
    // Igual que en la web: el cupo por sesión solo existe si el
    // servicio es grupal, así lo guardado es siempre lo que se ve.
    const esGrupal = b.modalidad === "grupal";
    return {
      nombre: b.nombre.trim(),
      descripcion: b.descripcion.trim() || null,
      precio: num(b.precio),
      unidad: b.unidad.trim() || null,
      tipo: b.tipo,
      grupo: b.grupo.trim() || null,
      duracion_horas: num(b.duracionHoras),
      duracion_minutos: num(b.duracionMinutos),
      buffer_min: num(b.bufferMin) ?? 0,
      foto_url: b.fotoUrl,
      min_por_reserva: num(b.minPorReserva) ?? 1,
      max_por_reserva: num(b.maxPorReserva),
      capacidad_dia: num(b.capacidadDia),
      es_paquete_base: b.tipo === "paquete" && b.esPaqueteBase,
      modalidad: b.modalidad || null,
      lugar_servicio: b.lugarServicio || null,
      cupo_min_sesion: esGrupal ? num(b.cupoMinSesion) : null,
      cupo_max_sesion: esGrupal ? num(b.cupoMaxSesion) : null,
      anticipacion_min_horas: num(b.anticipacionMinHoras),
      anticipacion_max_dias: num(b.anticipacionMaxDias),
      deposito_servicio: num(b.depositoServicio),
    };
  }


  function validar(b: Borrador): string | null {
    if (!b.nombre.trim() || b.nombre.trim().length > 120) {
      return "El nombre es obligatorio (máximo 120 caracteres).";
    }
    const precio = num(b.precio);
    if (b.precio.trim() && (precio === null || precio < 0)) {
      return "El precio no puede ser negativo.";
    }
    const min = num(b.minPorReserva) ?? 1;
    const max = num(b.maxPorReserva);
    if (max !== null && max < min) {
      return "El máximo por reserva no puede ser menor que el mínimo.";
    }
    // Mismos rangos que los checks de la base, para no mandar un
    // insert que va a rebotar: duración 5..480 (0055), limpieza
    // 0..240 (0061) y cupo por sesión 1..999 (0117).
    const minutos = num(b.duracionMinutos);
    if (minutos !== null && (!Number.isInteger(minutos) || minutos < 5 || minutos > 480)) {
      return "La duración debe ser una cantidad de minutos entre 5 y 480.";
    }
    const buffer = num(b.bufferMin);
    if (buffer !== null && (!Number.isInteger(buffer) || buffer < 0 || buffer > 240)) {
      return "El tiempo de limpieza debe estar entre 0 y 240 minutos.";
    }
    const cupoMin = num(b.cupoMinSesion);
    const cupoMax = num(b.cupoMaxSesion);
    for (const [valor, cual] of [
      [cupoMin, "mínimo"],
      [cupoMax, "máximo"],
    ] as const) {
      if (valor !== null && (!Number.isInteger(valor) || valor < 1 || valor > 999)) {
        return `El ${cual} de personas por sesión debe estar entre 1 y 999.`;
      }
    }
    if (cupoMin !== null && cupoMax !== null && cupoMax < cupoMin) {
      return "El máximo de personas por sesión no puede ser menor que el mínimo.";
    }
    // Mismos rangos que rancho_items_anticipacion_check (0118). Estos
    // no son cosméticos: el RPC rechaza la cita que los incumple.
    const antMin = num(b.anticipacionMinHoras);
    if (antMin !== null && (!Number.isInteger(antMin) || antMin < 0 || antMin > 720)) {
      return "La anticipación mínima debe estar entre 0 y 720 horas (30 días).";
    }
    const antMax = num(b.anticipacionMaxDias);
    if (antMax !== null && (!Number.isInteger(antMax) || antMax < 1 || antMax > 365)) {
      return "El máximo hacia adelante debe estar entre 1 y 365 días.";
    }
    const adelanto = num(b.depositoServicio);
    if (adelanto !== null && (adelanto < 0 || adelanto > 10000000)) {
      return "El adelanto debe estar entre ₡0 y ₡10.000.000.";
    }
    return null;
  }

  async function subirFoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // Ver editar.tsx: el catálogo también es vitrina, se comprime
      // una sola vez y abajo, no dos.
      quality: 1,
    });
    if (res.canceled || !res.assets[0]) return;
    setSubiendoFoto(true);
    setError(null);
    try {
      // Mismo criterio que la web: 2560px / JPEG 0.9, porque es
      // vitrina. El picker ya trae las dimensiones del asset.
      const uri = await comprimirImagen(res.assets[0].uri, res.assets[0], FOTO_DE_VITRINA);
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
      const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${id}/catalogo/${Date.now()}-foto.${extension}`;
      const { error: errorSubida } = await supabase.storage
        .from("ranchos-fotos")
        .upload(path, decodeBase64(base64), {
          contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
          upsert: true,
        });
      if (errorSubida) {
        setError("No se pudo subir la foto: " + errorSubida.message);
        return;
      }
      const { data } = supabase.storage.from("ranchos-fotos").getPublicUrl(path);
      setBorrador((b) => ({ ...b, fotoUrl: data.publicUrl }));
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function guardar() {
    const invalido = validar(borrador);
    if (invalido) {
      setError(invalido);
      return;
    }
    setOcupado(true);
    setError(null);

    const fila = aFila(borrador);
    if (editando === "nuevo") {
      const maxOrden = Math.max(0, ...(items ?? []).map((i) => i.orden));
      const { data, error: err } = await guardarTolerante(fila, (f) =>
        supabase
          .from("rancho_items")
          .insert({ rancho_id: id, orden: maxOrden + 1, ...f })
          .select("*")
          .single(),
      );
      setOcupado(false);
      if (err) {
        setError("No se pudo guardar: " + err.message);
        return;
      }
      setItems((prev) => [...(prev ?? []), data as RanchoItem]);
    } else if (editando) {
      const { data, error: err } = await guardarTolerante(fila, (f) =>
        supabase
          .from("rancho_items")
          .update(f)
          .eq("id", editando)
          .eq("rancho_id", id)
          .select("*")
          .single(),
      );
      setOcupado(false);
      if (err) {
        setError("No se pudo guardar: " + err.message);
        return;
      }
      setItems((prev) =>
        (prev ?? []).map((i) => (i.id === editando ? (data as RanchoItem) : i)),
      );
    }
    setEditando(null);
    setBorrador(VACIO);
  }

  async function alternarActivo(item: RanchoItem) {
    const { data } = await supabase
      .from("rancho_items")
      .update({ activo: !item.activo })
      .eq("id", item.id)
      .eq("rancho_id", id)
      .select("*")
      .single();
    if (data) {
      setItems((prev) => (prev ?? []).map((i) => (i.id === item.id ? (data as RanchoItem) : i)));
    }
  }

  async function duplicar(item: RanchoItem) {
    const maxOrden = Math.max(0, ...(items ?? []).map((i) => i.orden));
    const copia: Record<string, unknown> = { ...item };
    delete copia.id;
    delete copia.created_at;
    copia.nombre = `${item.nombre} (copia)`.slice(0, 120);
    copia.orden = maxOrden + 1;
    const { data, error: err } = await supabase
      .from("rancho_items")
      .insert(copia)
      .select("*")
      .single();
    if (err) {
      setError("No se pudo duplicar: " + err.message);
      return;
    }
    setItems((prev) => [...(prev ?? []), data as RanchoItem]);
  }

  async function mover(item: RanchoItem, direccion: -1 | 1) {
    const lista = items ?? [];
    const idx = lista.findIndex((i) => i.id === item.id);
    const destino = idx + direccion;
    if (idx < 0 || destino < 0 || destino >= lista.length) return;
    const nuevo = [...lista];
    [nuevo[idx], nuevo[destino]] = [nuevo[destino], nuevo[idx]];
    setItems(nuevo);
    // Se renumera todo: es lo que las flechas del panel web hacen.
    for (let i = 0; i < nuevo.length; i++) {
      await supabase
        .from("rancho_items")
        .update({ orden: i + 1 })
        .eq("id", nuevo[i].id)
        .eq("rancho_id", id);
    }
  }

  function borrar(item: RanchoItem) {
    Alert.alert("Borrar del catálogo", `¿Borrar "${item.nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          const { error: err } = await supabase
            .from("rancho_items")
            .delete()
            .eq("id", item.id)
            .eq("rancho_id", id);
          if (err) {
            setError("No se pudo borrar: " + err.message);
            return;
          }
          setItems((prev) => (prev ?? []).filter((i) => i.id !== item.id));
        },
      },
    ]);
  }

  if (!session) {
    router.replace("/cuenta");
    return null;
  }

  const etiqueta = CATALOGO_LABEL[categoria];
  // Mismo corte que el panel web: en Citas el servicio se mide en
  // minutos y declara su modalidad; en Eventos nada de esto aparece.
  const esCitas = vertical === "citas";

  return (
    <View style={styles.contenedor}>
      <BarraSuperior titulo={etiqueta} subtitulo={nombreNegocio || undefined} />
      {items === null ? (
        <View style={styles.centro}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            gap: Spacing.three,
            padding: Spacing.four,
            // Libre para la barra del panel, que va fija abajo.
            paddingBottom: ALTO_PANEL_NAV + Spacing.four,
          }}
        >
          {error && <Text style={styles.error}>{error}</Text>}

          {items.length === 0 && editando === null && (
            <Text style={styles.vacio}>
              Todavía no agregaste nada a tu {etiqueta.toLowerCase()}. Lo que
              cargués acá se puede reservar directo desde tu página — el cliente
              elige fecha, arma su pedido y paga el depósito sin chatear.
            </Text>
          )}

          {items.map((item, idx) =>
            editando === item.id ? (
              <Formulario
                key={item.id}
                borrador={borrador}
                setBorrador={setBorrador}
                subiendoFoto={subiendoFoto}
                subirFoto={subirFoto}
                ocupado={ocupado}
                textoBoton="Guardar cambios"
                esCitas={esCitas}
                onGuardar={guardar}
                onCancelar={() => {
                  setEditando(null);
                  setBorrador(VACIO);
                }}
              />
            ) : (
              <View key={item.id} style={[styles.fila, !item.activo && { opacity: 0.5 }]}>
                {item.foto_url && (
                  <Image
                    source={{ uri: item.foto_url }}
                    style={styles.filaFoto}
                    contentFit="cover"
                    alt={item.nombre}
                  />
                )}
                <View style={styles.filaCuerpo}>
                  <Text style={styles.filaNombre}>
                    {item.nombre}
                    {!item.activo ? "  · Pausado" : ""}
                  </Text>
                  {item.grupo && <Text style={styles.filaGrupo}>{item.grupo}</Text>}
                  <Text style={styles.filaPrecio}>
                    {item.precio !== null ? fmtColones(item.precio) : "A cotizar"}
                    {item.precio !== null && item.unidad ? ` ${item.unidad}` : ""}
                    {etiquetaDuracion(item.duracion_horas)
                      ? ` · ${etiquetaDuracion(item.duracion_horas)}`
                      : ""}
                    {item.capacidad_dia !== null ? ` · hasta ${item.capacidad_dia}/día` : ""}
                    {item.es_paquete_base === true ? " · sustituye la tarifa base" : ""}
                  </Text>
                  <View style={styles.acciones}>
                    <Accion texto="↑" deshabilitado={idx === 0} onPress={() => mover(item, -1)} />
                    <Accion
                      texto="↓"
                      deshabilitado={idx === items.length - 1}
                      onPress={() => mover(item, 1)}
                    />
                    <Accion
                      texto="Editar"
                      onPress={() => {
                        setEditando(item.id);
                        setBorrador(deItem(item));
                        setError(null);
                      }}
                    />
                    <Accion texto="Duplicar" onPress={() => duplicar(item)} />
                    <Accion
                      texto={item.activo ? "Pausar" : "Activar"}
                      onPress={() => alternarActivo(item)}
                    />
                    <Accion texto="Borrar" peligro onPress={() => borrar(item)} />
                  </View>
                </View>
              </View>
            ),
          )}

          {editando === "nuevo" ? (
            <Formulario
              borrador={borrador}
              setBorrador={setBorrador}
              subiendoFoto={subiendoFoto}
              subirFoto={subirFoto}
              ocupado={ocupado}
              textoBoton="Agregar"
              esCitas={esCitas}
              onGuardar={guardar}
              onCancelar={() => {
                setEditando(null);
                setBorrador(VACIO);
              }}
            />
          ) : (
            editando === null && (
              <Pressable
                style={styles.botonPrimario}
                onPress={() => {
                  setEditando("nuevo");
                  setBorrador(VACIO);
                  setError(null);
                }}
              >
                <Text style={styles.botonPrimarioTexto}>
                  + Agregar a tu {etiqueta.toLowerCase()}
                </Text>
              </Pressable>
            )
          )}
          <View style={{ height: Spacing.six }} />
        </ScrollView>
      )}

      <PanelNav
        negocioId={String(id)}
        activa="catalogo"
        mostrarCatalogo
        etiquetaCatalogo={vertical === "citas" ? "Servicios" : "Catálogo"}
      />
    </View>
  );
}

function Accion({
  texto,
  onPress,
  deshabilitado,
  peligro,
}: {
  texto: string;
  onPress: () => void;
  deshabilitado?: boolean;
  peligro?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      style={[styles.accion, deshabilitado && { opacity: 0.3 }]}
    >
      <Text style={[styles.accionTexto, peligro && { color: Colors.danger }]}>{texto}</Text>
    </Pressable>
  );
}

function Formulario({
  borrador,
  setBorrador,
  subiendoFoto,
  subirFoto,
  ocupado,
  textoBoton,
  esCitas,
  onGuardar,
  onCancelar,
}: {
  borrador: Borrador;
  setBorrador: (fn: (b: Borrador) => Borrador) => void;
  subiendoFoto: boolean;
  subirFoto: () => void;
  ocupado: boolean;
  textoBoton: string;
  /** Vertical de Citas: duración en minutos, modalidad y cupo. */
  esCitas: boolean;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const set = (campo: keyof Borrador) => (v: string) =>
    setBorrador((b) => ({ ...b, [campo]: v }));

  return (
    <View style={styles.form}>
      <View style={styles.chipsFila}>
        {(
          [
            ["paquete", "Paquete (con foto)"],
            ["producto", "Producto por cantidad"],
          ] as const
        ).map(([valor, texto]) => (
          <Pressable
            key={valor}
            onPress={() => setBorrador((b) => ({ ...b, tipo: valor }))}
            style={[styles.chip, borrador.tipo === valor && styles.chipActivo]}
          >
            <Text
              style={[styles.chipTexto, borrador.tipo === valor && styles.chipTextoActivo]}
            >
              {texto}
            </Text>
          </Pressable>
        ))}
      </View>

      <Campo label="Nombre" valor={borrador.nombre} onCambiar={set("nombre")} placeholder="Ej. Estación 1 de fotos" />
      <Campo
        label="Descripción (opcional)"
        valor={borrador.descripcion}
        onCambiar={set("descripcion")}
        placeholder="Qué incluye exactamente."
        multiline
      />

      <View>
        <Text style={styles.campoLabel}>Foto (recomendada para paquetes)</Text>
        <View style={styles.fotoFila}>
          {borrador.fotoUrl && (
            <Image
              source={{ uri: borrador.fotoUrl }}
              style={styles.fotoMini}
              contentFit="cover"
              alt=""
            />
          )}
          <Pressable style={styles.botonSecundario} onPress={subirFoto} disabled={subiendoFoto}>
            <Text style={styles.botonSecundarioTexto}>
              {subiendoFoto ? "Subiendo..." : borrador.fotoUrl ? "Cambiar foto" : "Subir foto"}
            </Text>
          </Pressable>
          {borrador.fotoUrl && (
            <Pressable onPress={() => setBorrador((b) => ({ ...b, fotoUrl: null }))}>
              <Text style={[styles.accionTexto, { color: Colors.danger }]}>Quitar</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.dosColumnas}>
        <Campo
          label="Precio ₡ (vacío = a cotizar)"
          valor={borrador.precio}
          onCambiar={set("precio")}
          placeholder="85000"
          numerico
          mitad
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.campoLabel}>Se cobra</Text>
          <View style={styles.chipsEnvueltos}>
            {["", ...UNIDADES].map((u) => (
              <Pressable
                key={u || "ninguna"}
                onPress={() => setBorrador((b) => ({ ...b, unidad: u }))}
                style={[styles.chipMini, borrador.unidad === u && styles.chipActivo]}
              >
                <Text
                  style={[styles.chipMiniTexto, borrador.unidad === u && styles.chipTextoActivo]}
                >
                  {u || "—"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {esCitas && (
        <>
          <View style={styles.dosColumnas}>
            <Campo
              label="Duración (minutos)"
              valor={borrador.duracionMinutos}
              onCambiar={set("duracionMinutos")}
              placeholder="30"
              numerico
              mitad
            />
            {/* El buffer del motor pro (0061): limpiar la silla,
                acomodar la cabina. La franja ocupa duración + esto. */}
            <Campo
              label="Limpieza después (min)"
              valor={borrador.bufferMin}
              onCambiar={set("bufferMin")}
              placeholder="0"
              numerico
              mitad
            />
          </View>

          <View>
            <Text style={styles.campoLabel}>Modalidad</Text>
            <View style={styles.chipsEnvueltos}>
              {MODALIDADES.map((m) => (
                <Pressable
                  key={m.valor || "individual"}
                  onPress={() => setBorrador((b) => ({ ...b, modalidad: m.valor }))}
                  style={[styles.chipMini, borrador.modalidad === m.valor && styles.chipActivo]}
                >
                  <Text
                    style={[
                      styles.chipMiniTexto,
                      borrador.modalidad === m.valor && styles.chipTextoActivo,
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.campoLabel}>Dónde se presta</Text>
            <View style={styles.chipsEnvueltos}>
              {LUGARES.map((l) => (
                <Pressable
                  key={l.valor || "presencial"}
                  onPress={() => setBorrador((b) => ({ ...b, lugarServicio: l.valor }))}
                  style={[styles.chipMini, borrador.lugarServicio === l.valor && styles.chipActivo]}
                >
                  <Text
                    style={[
                      styles.chipMiniTexto,
                      borrador.lugarServicio === l.valor && styles.chipTextoActivo,
                    ]}
                  >
                    {l.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {borrador.modalidad === "grupal" && (
            <View>
              <View style={styles.dosColumnas}>
                <Campo
                  label="Personas mínimas"
                  valor={borrador.cupoMinSesion}
                  onCambiar={set("cupoMinSesion")}
                  placeholder="Sin mínimo"
                  numerico
                  mitad
                />
                <Campo
                  label="Personas máximas"
                  valor={borrador.cupoMaxSesion}
                  onCambiar={set("cupoMaxSesion")}
                  placeholder="20"
                  numerico
                  mitad
                />
              </View>
              {/* Honestidad con el dueño: esto queda anotado, todavía
                  no cambia cómo se reserva. */}
              <Text style={styles.notaAyuda}>
                Por ahora esto queda anotado en la ficha del servicio: la agenda sigue
                tomando una reserva a la vez. Las clases con cupo compartido llegan más
                adelante.
              </Text>
            </View>
          )}

          {/* Política de reserva (0118). A diferencia del cupo, esto
              SÍ se hace cumplir: el motor rechaza la cita que no la
              respete, venga de la web o de acá. */}
          <View style={styles.dosColumnas}>
            <Campo
              label="Anticipación mínima (horas)"
              valor={borrador.anticipacionMinHoras}
              onCambiar={set("anticipacionMinHoras")}
              placeholder="Sin mínimo"
              numerico
              mitad
            />
            <Campo
              label="Se reserva hasta (días)"
              valor={borrador.anticipacionMaxDias}
              onCambiar={set("anticipacionMaxDias")}
              placeholder="Sin tope"
              numerico
              mitad
            />
          </View>

          <View>
            <Campo
              label="Adelanto de este servicio ₡"
              valor={borrador.depositoServicio}
              onCambiar={set("depositoServicio")}
              placeholder="Vacío = el adelanto general del negocio"
              numerico
            />
            <Text style={styles.notaAyuda}>
              Estas tres reglas sí se aplican al reservar: una cita que no las cumpla
              se rechaza, venga de la web o de la app.
            </Text>
          </View>
        </>
      )}

      <View style={styles.dosColumnas}>
        {!esCitas && (
          <Campo
            label="Horas que incluye"
            valor={borrador.duracionHoras}
            onCambiar={set("duracionHoras")}
            placeholder="5"
            numerico
            mitad
          />
        )}
        <Campo
          label="Sección (opcional)"
          valor={borrador.grupo}
          onCambiar={set("grupo")}
          placeholder="Estaciones, Extras..."
          mitad
        />
      </View>

      <View style={styles.dosColumnas}>
        <Campo
          label="Mínimo por reserva"
          valor={borrador.minPorReserva}
          onCambiar={set("minPorReserva")}
          placeholder="1"
          numerico
          mitad
        />
        <Campo
          label="Máximo (vacío = sin tope)"
          valor={borrador.maxPorReserva}
          onCambiar={set("maxPorReserva")}
          placeholder=""
          numerico
          mitad
        />
      </View>

      <Campo
        label="¿Cuántos podés atender por día? (vacío = sin límite)"
        valor={borrador.capacidadDia}
        onCambiar={set("capacidadDia")}
        placeholder="Ej. 2 — si tenés 2 estaciones"
        numerico
      />

      {/* Un paquete puede SUSTITUIR la tarifa base del cotizador: el
          cliente que elige "Montaje premium" paga el premium, no
          base + premium (0067). */}
      {borrador.tipo === "paquete" && (
        <Pressable
          onPress={() =>
            setBorrador((b) => ({ ...b, esPaqueteBase: !b.esPaqueteBase }))
          }
          style={[styles.checkFila, borrador.esPaqueteBase && styles.checkFilaActiva]}
        >
          <Text style={styles.checkMarca}>{borrador.esPaqueteBase ? "✓" : ""}</Text>
          <Text style={styles.checkTexto}>
            <Text style={{ fontFamily: Fonts.bold }}>
              Este paquete sustituye la tarifa base.
            </Text>{" "}
            Al elegirlo, el cliente paga el precio del paquete en lugar de tu
            tarifa por evento (no se suman), y sus horas incluidas mandan para
            la hora extra.
          </Text>
        </Pressable>
      )}

      <View style={styles.chipsFila}>
        <Pressable
          style={[styles.botonPrimario, { flex: 1 }, (ocupado || subiendoFoto) && { opacity: 0.5 }]}
          disabled={ocupado || subiendoFoto || !borrador.nombre.trim()}
          onPress={onGuardar}
        >
          <Text style={styles.botonPrimarioTexto}>{ocupado ? "Guardando..." : textoBoton}</Text>
        </Pressable>
        <Pressable style={[styles.botonSecundario, { flex: 1 }]} onPress={onCancelar}>
          <Text style={styles.botonSecundarioTexto}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Campo({
  label,
  valor,
  onCambiar,
  placeholder,
  numerico,
  multiline,
  mitad,
}: {
  label: string;
  valor: string;
  onCambiar: (v: string) => void;
  placeholder: string;
  numerico?: boolean;
  multiline?: boolean;
  mitad?: boolean;
}) {
  return (
    <View style={mitad ? { flex: 1 } : undefined}>
      <Text style={styles.campoLabel}>{label}</Text>
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        placeholder={placeholder}
        placeholderTextColor={Colors.inkSoft}
        keyboardType={numerico ? "decimal-pad" : "default"}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 64, textAlignVertical: "top" }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.cream },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: Colors.danger, fontSize: 13, fontFamily: Fonts.medium },
  vacio: {
    backgroundColor: Colors.cream2,
    borderRadius: 14,
    padding: Spacing.four,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
  },
  fila: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.line,
    overflow: "hidden",
  },
  filaFoto: { width: "100%", height: 120 },
  filaCuerpo: { padding: Spacing.three, gap: 3 },
  filaNombre: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.ink },
  filaGrupo: { fontSize: 11.5, color: Colors.inkSoft, fontFamily: Fonts.medium },
  filaPrecio: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.navy },
  acciones: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  accion: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  accionTexto: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.ink },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.sky,
    padding: Spacing.four,
    gap: Spacing.three,
  },
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
  dosColumnas: { flexDirection: "row", gap: Spacing.three },
  checkFila: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
    backgroundColor: Colors.cream2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: Spacing.three,
  },
  checkFilaActiva: { borderColor: Colors.sky },
  checkMarca: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    textAlign: "center",
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.accent,
    overflow: "hidden",
  },
  checkTexto: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.ink,
    fontFamily: Fonts.regular,
  },
  notaAyuda: {
    marginTop: 6,
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.inkSoft,
    fontFamily: Fonts.regular,
  },
  fotoFila: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  fotoMini: { width: 56, height: 56, borderRadius: 10 },
  chipsFila: { flexDirection: "row", gap: 8 },
  chipsEnvueltos: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  chipMini: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  chipMiniTexto: { fontSize: 11.5, fontFamily: Fonts.medium, color: Colors.inkSoft },
  chipActivo: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTexto: { fontSize: 12.5, fontFamily: Fonts.bold, color: Colors.inkSoft },
  chipTextoActivo: { color: "#ffffff" },
  botonPrimario: {
    backgroundColor: Colors.sky,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  botonPrimarioTexto: { color: "#ffffff", fontSize: 13.5, fontFamily: Fonts.bold },
  botonSecundario: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.cream2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  botonSecundarioTexto: { color: Colors.ink, fontSize: 13, fontFamily: Fonts.bold },
});
