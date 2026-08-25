import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radios, Spacing, Sombras, Tipo } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useModoPedido } from "@/lib/modo-pedido";
import { cargarDetalleRestaurante, type DetalleRestaurante } from "@/lib/food-datos";
import { cargarFavoritosIds } from "@/lib/food-datos";
import { CRC, fechaCorta, horaCorta, type FoodFranja, type FoodMenuItem } from "@/lib/food-tipos";
import { alternarFavorito, crearPedido, reservarFranja } from "@/lib/food-acciones";
import SelectorModo from "@/components/selector-modo";

/**
 * La ficha del restaurante — espejo de /food/restaurante/[slug] en
 * /web (page.tsx + reservar-form.tsx): menú real, franjas agrupadas
 * por fecha, y la MISMA regla de negocio (cupo, franja vigente,
 * descuento) resuelta del lado del servidor vía el puente HTTP —
 * acá solo se elige franja y cantidad, nunca se calcula el descuento.
 *
 * "Mesa" / "To Go" (0207) comparten esta MISMA pantalla: el selector
 * de arriba no navega a otro lado, solo cambia si se ve la reserva por
 * franja de siempre o el menú se vuelve pedible con carrito.
 */
export default function RestauranteDetalle() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { modo } = useModoPedido();
  const scrollRef = useRef<ScrollView>(null);
  const [detalle, setDetalle] = useState<DetalleRestaurante | null>(null);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [favorito, setFavorito] = useState<boolean | undefined>(undefined);

  const [franjaId, setFranjaId] = useState<string | null>(null);
  const [personas, setPersonas] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [reservando, setReservando] = useState(false);

  // ── Carrito de "To Go" (0207) — vive solo en esta pantalla, se
  // pierde al salir a propósito (no hay pedido a medio armar guardado
  // en ningún lado, mismo criterio simple que el resto de v1). ───────
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [horaRetiro, setHoraRetiro] = useState("");
  const [notasPedido, setNotasPedido] = useState("");
  const [confirmandoPedido, setConfirmandoPedido] = useState(false);
  const [errorPedido, setErrorPedido] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let vigente = true;
    cargarDetalleRestaurante(slug).then((d) => {
      if (!vigente) return;
      if (!d) {
        setNoEncontrado(true);
        return;
      }
      setDetalle(d);
    });
    return () => {
      vigente = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!session || !detalle) return;
    let vigente = true;
    cargarFavoritosIds(session.user.id).then((ids) => {
      if (vigente) setFavorito(ids.has(detalle.negocio.id));
    });
    return () => {
      vigente = false;
    };
  }, [session, detalle]);

  const porFecha = useMemo(() => {
    const mapa = new Map<string, FoodFranja[]>();
    for (const f of detalle?.franjas ?? []) {
      const lista = mapa.get(f.fecha) ?? [];
      lista.push(f);
      mapa.set(f.fecha, lista);
    }
    return [...mapa.entries()];
  }, [detalle]);

  const itemsPorId = useMemo(() => {
    const mapa = new Map<string, FoodMenuItem>();
    if (!detalle) return mapa;
    for (const lista of detalle.itemsPorCategoria.values()) {
      for (const item of lista) mapa.set(item.id, item);
    }
    return mapa;
  }, [detalle]);

  const itemsCarrito = useMemo(
    () =>
      Object.entries(cantidades)
        .map(([id, cantidad]) => {
          const item = itemsPorId.get(id);
          if (!item || cantidad <= 0) return null;
          return { id, nombre: item.nombre, precio: item.precio, cantidad, subtotal: item.precio * cantidad };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [cantidades, itemsPorId],
  );
  const totalCarrito = itemsCarrito.reduce((s, i) => s + i.subtotal, 0);
  const cantidadCarrito = itemsCarrito.reduce((s, i) => s + i.cantidad, 0);

  const hayMenu = itemsPorId.size > 0;
  const puedeTogo = !!detalle?.negocio.acepta_para_llevar && hayMenu;

  const franjaElegida = detalle?.franjas.find((f) => f.id === franjaId) ?? null;
  const cupoDisponible = franjaElegida ? franjaElegida.capacidad - franjaElegida.reservado : 0;

  async function tocarFavorito() {
    if (!session || !detalle) {
      router.push("/?tab=perfil");
      return;
    }
    const anterior = favorito;
    setFavorito(!anterior);
    const r = await alternarFavorito(session.user.id, detalle.negocio.id);
    if (!r.ok) setFavorito(anterior);
  }

  async function reservar() {
    if (!franjaId) {
      setError("Elegí un horario.");
      return;
    }
    setError(null);
    setReservando(true);
    const r = await reservarFranja(franjaId, personas);
    setReservando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/reserva/${r.reservaId}`);
  }

  function cambiarCantidad(itemId: string, delta: number) {
    setCantidades((prev) => {
      const actual = prev[itemId] ?? 0;
      const nueva = Math.max(0, Math.min(50, actual + delta));
      if (nueva === 0) {
        const { [itemId]: _quitado, ...resto } = prev;
        return resto;
      }
      return { ...prev, [itemId]: nueva };
    });
  }

  async function confirmarPedido() {
    if (!detalle || itemsCarrito.length === 0) return;
    setErrorPedido(null);
    setConfirmandoPedido(true);
    const r = await crearPedido(
      detalle.negocio.id,
      itemsCarrito.map((i) => ({ menuItemId: i.id, cantidad: i.cantidad })),
      horaRetiro.trim() || null,
      notasPedido.trim() || null,
    );
    setConfirmandoPedido(false);
    if (!r.ok) {
      setErrorPedido(r.error);
      return;
    }
    setCheckoutAbierto(false);
    setCantidades({});
    router.push(`/pedido/${r.pedidoId}`);
  }

  if (noEncontrado) {
    return (
      <View style={[styles.centro, { paddingTop: insets.top }]}>
        <Text style={Tipo.titulo2}>No encontramos este restaurante.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: Spacing.three }}>
          <Text style={styles.enlace}>← Volver</Text>
        </Pressable>
      </View>
    );
  }

  if (!detalle) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const { negocio, direccion, categorias, itemsPorCategoria } = detalle;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.canvas }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: modo === "togo" && cantidadCarrito > 0 ? 92 : Spacing.six }}
      >
        <View style={styles.heroContenedor}>
          {negocio.foto_portada_url ? (
            <Image source={{ uri: negocio.foto_portada_url }} style={styles.hero} resizeMode="cover" />
          ) : (
            <View style={[styles.hero, styles.heroVacio]}>
              <Ionicons name="restaurant-outline" size={44} color="rgba(255,255,255,0.4)" />
            </View>
          )}
          <Pressable onPress={() => router.back()} style={[styles.botonAtras, { top: insets.top + 10 }]} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={Colors.ink} />
          </Pressable>
          <Pressable onPress={tocarFavorito} style={[styles.botonFavorito, { top: insets.top + 10 }]} hitSlop={8}>
            <Ionicons
              name={favorito ? "heart" : "heart-outline"}
              size={19}
              color={favorito ? Colors.accent : Colors.inkSoft}
            />
          </Pressable>
        </View>

        <View style={styles.cuerpo}>
          <Text style={Tipo.titulo1}>{negocio.nombre}</Text>
          {direccion && (
            <View style={styles.filaMeta}>
              <Ionicons name="location-outline" size={14} color={Colors.inkSoft} />
              <Text style={styles.metaTexto}>{direccion}</Text>
            </View>
          )}
          {negocio.descripcion && <Text style={[Tipo.cuerpo, { marginTop: Spacing.two }]}>{negocio.descripcion}</Text>}

          <View style={{ marginTop: Spacing.four, alignItems: "flex-start" }}>
            <SelectorModo />
          </View>

          {modo === "mesa" ? (
            <>
              <Text style={[Tipo.titulo2, { marginTop: Spacing.four }]}>Reservá tu mesa</Text>
              {porFecha.length === 0 ? (
                <Text style={[styles.metaTexto, { marginTop: Spacing.two }]}>No hay horarios disponibles por ahora.</Text>
              ) : (
                <View style={{ marginTop: Spacing.three, gap: Spacing.three }}>
                  {porFecha.map(([fecha, lista]) => (
                    <View key={fecha}>
                      <Text style={styles.etiquetaFecha}>{fechaCorta(fecha)}</Text>
                      <View style={styles.filaChipsHora}>
                        {lista.map((f) => {
                          const disponible = f.capacidad - f.reservado;
                          const agotada = disponible <= 0;
                          const elegida = franjaId === f.id;
                          return (
                            <Pressable
                              key={f.id}
                              disabled={agotada}
                              onPress={() => {
                                setFranjaId(f.id);
                                setError(null);
                                // El bug real: `personas` arrancaba en 2 y no se
                                // reajustaba al cambiar de franja. Con una franja
                                // de 1 solo lugar (el caso típico de un horario
                                // con descuento casi agotado), el botón
                                // "Reservar" quedaba deshabilitado sin ningún
                                // aviso — parecía que tocar el botón no hacía
                                // nada.
                                setPersonas((p) => Math.min(p, disponible));
                              }}
                              style={[styles.chipHora, elegida && styles.chipHoraElegida, agotada && styles.chipHoraAgotada]}
                            >
                              <Text style={[styles.chipHoraTexto, elegida && styles.chipHoraTextoElegido]}>{horaCorta(f.hora)}</Text>
                              <Text style={[styles.chipHoraDescuento, elegida && styles.chipHoraDescuentoElegido]}>
                                {f.descuento_porcentaje > 0 ? `${f.descuento_porcentaje}% OFF` : "Sin descuento"}
                              </Text>
                              {!agotada && (
                                <Text style={[styles.chipHoraCupo, elegida && styles.chipHoraCupoElegido]}>{disponible} lugares</Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {franjaElegida && (
                <View
                  style={styles.tarjetaReserva}
                  // Elegir un horario con descuento tenía que "llevar" a la
                  // reserva y no dejarla escondida más abajo en la misma
                  // pantalla: en vez de una pantalla nueva (que duplicaría
                  // toda la lógica de cupo/franja que ya vive acá), se
                  // desliza sola hasta esta tarjeta apenas aparece — el
                  // mismo efecto de "cambiar de pestaña" sin repetir estado.
                  onLayout={(e) => {
                    const y = e.nativeEvent.layout.y;
                    scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing.four), animated: true });
                  }}
                >
                  <View style={styles.filaEntrePersonas}>
                    <Text style={styles.tarjetaReservaTexto}>{fechaCorta(franjaElegida.fecha)} · {horaCorta(franjaElegida.hora)}</Text>
                    {franjaElegida.descuento_porcentaje > 0 && (
                      <View style={styles.badgeDescuento}>
                        <Text style={styles.badgeDescuentoTexto}>Tu descuento: {franjaElegida.descuento_porcentaje}%</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.label}>¿Cuántas personas?</Text>
                  <View style={styles.contadorFila}>
                    <Pressable
                      onPress={() => setPersonas((p) => Math.max(1, p - 1))}
                      style={styles.contadorBoton}
                    >
                      <Ionicons name="remove" size={18} color={Colors.navy} />
                    </Pressable>
                    <Text style={styles.contadorTexto}>{personas}</Text>
                    <Pressable
                      onPress={() => setPersonas((p) => Math.min(30, cupoDisponible || 30, p + 1))}
                      style={styles.contadorBoton}
                    >
                      <Ionicons name="add" size={18} color={Colors.navy} />
                    </Pressable>
                  </View>

                  {!session ? (
                    <Pressable onPress={() => router.push("/?tab=perfil")} style={{ marginTop: Spacing.two }}>
                      <Text style={styles.enlace}>Iniciá sesión para confirmar tu reserva →</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={reservando || personas < 1 || personas > cupoDisponible}
                      onPress={reservar}
                      style={[styles.botonReservar, (reservando || personas > cupoDisponible) && { opacity: 0.5 }]}
                    >
                      {reservando ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.botonReservarTexto}>Reservar {horaCorta(franjaElegida.hora)}</Text>
                      )}
                    </Pressable>
                  )}
                  {error && <Text style={styles.error}>{error}</Text>}
                </View>
              )}
            </>
          ) : !puedeTogo ? (
            <View style={styles.avisoTogo}>
              <Ionicons name="bag-handle-outline" size={22} color={Colors.inkMuted} />
              <Text style={styles.avisoTogoTexto}>
                {hayMenu
                  ? "Este restaurante no ofrece pedidos para llevar por ahora."
                  : "Este restaurante todavía no cargó su menú para pedidos para llevar."}
              </Text>
            </View>
          ) : (
            <Text style={[styles.metaTexto, { marginTop: Spacing.three }]}>
              Elegí los platos y armá tu pedido — se paga al retirar en el restaurante.
            </Text>
          )}

          {categorias.length > 0 && (
            <>
              <Text style={[Tipo.titulo2, { marginTop: Spacing.five }]}>Menú</Text>
              <View style={{ marginTop: Spacing.three, gap: Spacing.four }}>
                {categorias.map((cat) => {
                  const items = itemsPorCategoria.get(cat.id) ?? [];
                  if (items.length === 0) return null;
                  return (
                    <View key={cat.id}>
                      <Text style={styles.etiquetaCategoria}>{cat.nombre}</Text>
                      <View style={{ marginTop: Spacing.two, gap: Spacing.two }}>
                        {items.map((item) => {
                          const cantidadItem = cantidades[item.id] ?? 0;
                          const pedible = modo === "togo" && puedeTogo;
                          return (
                            <View key={item.id} style={styles.filaItem}>
                              {item.foto_url ? (
                                <Image source={{ uri: item.foto_url }} style={styles.itemFoto} resizeMode="cover" />
                              ) : (
                                <View style={[styles.itemFoto, styles.itemFotoVacia]}>
                                  <Ionicons name="restaurant-outline" size={18} color="rgba(22,41,94,0.35)" />
                                </View>
                              )}
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.itemNombre}>{item.nombre}</Text>
                                {item.descripcion && (
                                  <Text style={styles.itemDescripcion} numberOfLines={2}>{item.descripcion}</Text>
                                )}
                                <Text style={styles.itemPrecio}>{CRC.format(item.precio)}</Text>
                              </View>
                              {pedible && (
                                <View style={styles.contadorMiniFila}>
                                  <Pressable
                                    onPress={() => cambiarCantidad(item.id, -1)}
                                    disabled={cantidadItem === 0}
                                    style={[styles.contadorMiniBoton, cantidadItem === 0 && { opacity: 0.35 }]}
                                  >
                                    <Ionicons name="remove" size={14} color={Colors.navy} />
                                  </Pressable>
                                  <Text style={styles.contadorMiniTexto}>{cantidadItem}</Text>
                                  <Pressable
                                    onPress={() => cambiarCantidad(item.id, 1)}
                                    style={styles.contadorMiniBoton}
                                  >
                                    <Ionicons name="add" size={14} color={Colors.navy} />
                                  </Pressable>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {modo === "togo" && cantidadCarrito > 0 && (
        <View style={[styles.barraCarrito, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable style={styles.botonVerPedido} onPress={() => setCheckoutAbierto(true)}>
            <Text style={styles.botonVerPedidoTexto}>
              Ver pedido · {cantidadCarrito} {cantidadCarrito === 1 ? "plato" : "platos"}
            </Text>
            <Text style={styles.botonVerPedidoTotal}>{CRC.format(totalCarrito)}</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={checkoutAbierto}
        transparent
        animationType="slide"
        onRequestClose={() => setCheckoutAbierto(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCheckoutAbierto(false)} />
          <View style={[styles.modalHoja, { paddingBottom: insets.bottom + Spacing.four }]}>
            <Text style={Tipo.titulo2}>Tu pedido</Text>
            <ScrollView style={{ maxHeight: 220, marginTop: Spacing.three }}>
              {itemsCarrito.map((it) => (
                <View key={it.id} style={styles.filaCarrito}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.filaCarritoNombre} numberOfLines={1}>{it.cantidad}× {it.nombre}</Text>
                  </View>
                  <Text style={styles.filaCarritoPrecio}>{CRC.format(it.subtotal)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.filaTotal}>
              <Text style={styles.filaTotalLabel}>Total a pagar al retirar</Text>
              <Text style={styles.filaTotalValor}>{CRC.format(totalCarrito)}</Text>
            </View>

            <Text style={[styles.label, { marginTop: Spacing.three }]}>¿A qué hora pasás a retirar?</Text>
            <TextInput
              value={horaRetiro}
              onChangeText={setHoraRetiro}
              placeholder="Lo antes posible"
              placeholderTextColor={Colors.inkMuted}
              style={styles.inputCheckout}
            />

            <Text style={[styles.label, { marginTop: Spacing.two }]}>Notas para el restaurante (opcional)</Text>
            <TextInput
              value={notasPedido}
              onChangeText={setNotasPedido}
              placeholder="Sin cebolla, alergias, etc."
              placeholderTextColor={Colors.inkMuted}
              style={[styles.inputCheckout, styles.inputCheckoutMultilinea]}
              multiline
              maxLength={200}
            />

            {errorPedido && <Text style={styles.error}>{errorPedido}</Text>}

            {!session ? (
              <Pressable
                onPress={() => {
                  setCheckoutAbierto(false);
                  router.push("/?tab=perfil");
                }}
                style={{ marginTop: Spacing.three }}
              >
                <Text style={styles.enlace}>Iniciá sesión para confirmar tu pedido →</Text>
              </Pressable>
            ) : (
              <Pressable
                disabled={confirmandoPedido || itemsCarrito.length === 0}
                onPress={confirmarPedido}
                style={[styles.botonReservar, { marginTop: Spacing.three }, confirmandoPedido && { opacity: 0.6 }]}
              >
                {confirmandoPedido ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botonReservarTexto}>Confirmar pedido</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.two },
  heroContenedor: { aspectRatio: 16 / 10, backgroundColor: Colors.heroOscuro },
  hero: { width: "100%", height: "100%" },
  heroVacio: { alignItems: "center", justifyContent: "center" },
  botonAtras: {
    position: "absolute",
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  botonFavorito: {
    position: "absolute",
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  cuerpo: { padding: Spacing.four },
  filaMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  metaTexto: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.inkSoft },
  avisoTogo: {
    marginTop: Spacing.four,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    padding: Spacing.three,
    ...Sombras.tarjeta,
  },
  avisoTogoTexto: { flex: 1, fontFamily: Fonts.medium, fontSize: 12.5, color: Colors.inkSoft, lineHeight: 17 },
  etiquetaFecha: { fontFamily: Fonts.extraBold, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: Colors.inkSoft, marginBottom: 8 },
  filaChipsHora: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chipHora: {
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    borderRadius: Radios.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 92,
  },
  chipHoraElegida: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipHoraAgotada: { opacity: 0.4 },
  chipHoraTexto: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.ink },
  chipHoraTextoElegido: { color: "#fff" },
  chipHoraDescuento: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.accentDark, marginTop: 2 },
  chipHoraDescuentoElegido: { color: "rgba(255,255,255,0.85)" },
  chipHoraCupo: { fontFamily: Fonts.medium, fontSize: 10.5, color: Colors.inkMuted, marginTop: 2 },
  chipHoraCupoElegido: { color: "rgba(255,255,255,0.7)" },
  tarjetaReserva: {
    marginTop: Spacing.three,
    backgroundColor: Colors.cream2,
    borderRadius: Radios.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  filaEntrePersonas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  tarjetaReservaTexto: { fontFamily: Fonts.bold, fontSize: 13.5, color: Colors.ink },
  badgeDescuento: { backgroundColor: Colors.accent, borderRadius: Radios.md, paddingHorizontal: 10, paddingVertical: 5 },
  badgeDescuentoTexto: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 12.5 },
  label: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.ink, marginTop: Spacing.two },
  contadorFila: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
  contadorBoton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  contadorTexto: { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.ink, minWidth: 24, textAlign: "center" },
  botonReservar: {
    marginTop: Spacing.two,
    backgroundColor: Colors.accent,
    borderRadius: Radios.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonReservarTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 15 },
  enlace: { color: Colors.navy, fontFamily: Fonts.bold, fontSize: 13.5 },
  error: { color: Colors.danger, fontFamily: Fonts.bold, fontSize: 12.5, marginTop: 4 },
  etiquetaCategoria: { fontFamily: Fonts.extraBold, fontSize: 15, color: Colors.ink },
  filaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    backgroundColor: Colors.surface,
    borderRadius: Radios.md,
    padding: Spacing.three,
    ...Sombras.tarjeta,
  },
  itemFoto: { width: 56, height: 56, borderRadius: Radios.md, backgroundColor: Colors.blueLight },
  itemFotoVacia: { alignItems: "center", justifyContent: "center" },
  itemNombre: { fontFamily: Fonts.bold, fontSize: 13.5, color: Colors.ink },
  itemDescripcion: { fontFamily: Fonts.medium, fontSize: 11.5, color: Colors.inkSoft, marginTop: 2 },
  itemPrecio: { fontFamily: Fonts.extraBold, fontSize: 13.5, color: Colors.navy, marginTop: 4 },
  contadorMiniFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  contadorMiniBoton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  contadorMiniTexto: { fontFamily: Fonts.extraBold, fontSize: 14, color: Colors.ink, minWidth: 16, textAlign: "center" },
  barraCarrito: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.four,
    paddingTop: 12,
    ...Sombras.flotante,
  },
  botonVerPedido: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.accent,
    borderRadius: Radios.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: 14,
  },
  botonVerPedidoTexto: { color: "#fff", fontFamily: Fonts.bold, fontSize: 14 },
  botonVerPedidoTotal: { color: "#fff", fontFamily: Fonts.extraBold, fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,11,14,0.45)" },
  modalHoja: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radios.xl,
    borderTopRightRadius: Radios.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    ...Sombras.flotante,
  },
  filaCarrito: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
  filaCarritoNombre: { fontFamily: Fonts.medium, fontSize: 13.5, color: Colors.ink },
  filaCarritoPrecio: { fontFamily: Fonts.bold, fontSize: 13.5, color: Colors.ink },
  filaTotal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  filaTotalLabel: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.inkSoft },
  filaTotalValor: { fontFamily: Fonts.extraBold, fontSize: 18, color: Colors.navy },
  inputCheckout: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radios.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 11,
    fontSize: 14,
    color: Colors.ink,
    backgroundColor: Colors.canvas,
    fontFamily: Fonts.medium,
  },
  inputCheckoutMultilinea: { minHeight: 56, textAlignVertical: "top" },
});
