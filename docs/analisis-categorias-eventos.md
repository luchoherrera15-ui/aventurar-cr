# Análisis por categoría — vertical de EVENTOS (todo menos Lugares)

Cómo se configura y se reserva hoy cada categoría de servicios, qué ofrece
normalmente ese rubro en el mercado, y qué brechas concretas hay.

**Fuentes de código leídas:** `src/app/mi-rancho/types.tsx` (taxonomía,
`RanchoItem`, `CATALOGO_LABEL`), `src/app/mi-rancho/campos-servicio.ts`
(campos de `detalles` por categoría), `src/lib/cotizador-servicio.ts`
(modalidades de cobro), `src/app/eventos/[id]/reserva-servicio.tsx` (flujo
de reserva), `src/app/eventos/cotizacion-actions.ts` (acción del servidor),
migraciones `0035`, `0049`, `0050`, `0051` (catálogo, cupos, inventario
por día, `crear_reserva_servicio`).

## Las piezas que YA existen (resumen)

Todo proveedor no-Lugar cuenta hoy con:

| Pieza | Dónde vive | Qué hace |
|---|---|---|
| Modalidad de cobro | `ranchos.detalles.modalidad_cobro` | `por_persona`, `por_hora`, `por_evento`, `por_paquete`, `por_dia`, `por_unidad` |
| Tarifas | `detalles.tarifa_persona/hora/evento/dia`, `hora_extra`, `duracion_horas` (horas incluidas), `minimo_personas`, `horas_minimas`, `costo_traslado` | Alimentan la cotización en vivo del formulario (y el servidor la recalcula de la base) |
| Catálogo | `rancho_items` | Nombre, descripción, precio, unidad libre, foto, `grupo` (secciones), `tipo` paquete/producto, `min/max_por_reserva`, `capacidad_dia` (inventario por fecha vía la vista `disponibilidad_items`), `duracion_horas` |
| Cupo de agenda | `ranchos.eventos_por_dia` | Cuántos eventos atiende por día; el calendario tacha los días llenos |
| Depósito | `deposito_reserva` + SINPE/cuenta | Si hay depósito y cuenta de cobro, la reserva exige comprobante |
| Logística | `detalles.zonas`, `anticipacion_dias`, `costo_traslado` | Cobertura por provincia, anticipación mínima, traslado fijo |
| Reserva atómica | `crear_reserva_servicio` (0051) | Relee precios de la base, valida mínimos/máximos e inventario del día, crea reserva `pendiente` + `reserva_items` + chat con resumen |

**El flujo del cliente (igual para todas las categorías):** portal público →
1) calendario (bloquea pasado, anticipación y días con cupo lleno), 2) "Armá
tu servicio" si hay modalidad+tarifa configurada (cotiza en vivo), 3) catálogo
con contadores y "queda N" por `capacidad_dia`, 4) depósito SINPE/transferencia
+ comprobante si aplica, 5) datos del evento → reserva **pendiente** + chat
con el pedido resumido + correo. **El dueño** en `/mi-rancho`: aprueba o
rechaza (el trigger 0049 protege el cupo), ve comprobante y montos, administra
catálogo (grupos, fotos, cupos), finanzas y agenda.

---

## 1. Alimentación (catering, parrilladas, queques, barras de café/matcha/cócteles, food trucks…)

**Qué ofrece el mercado.** Un catering vende menús **por persona** (3 tiempos
o buffet) que incluyen vajilla, montaje, chef y meseros, con mínimos de 20–80
personas y estaciones temáticas como upgrade; la degustación previa es parte
del cierre de venta. Las parrilladas se venden por persona con cortes +
guarniciones + parrillero incluido. Las barras (café, matcha, cócteles) se
venden **por bloque de horas** con un estimado de 3–4 bebidas por persona,
barista/bartender y máquina incluidos, y cargos por hora extra y traslado.

**(a) Configuración con las piezas de hoy.**
- Catering/parrillada: `modalidad_cobro: por_persona` + `tarifa_persona` +
  `minimo_personas` (ej. 20). Catálogo como **menú virtual**: grupos
  "Entradas", "Platos fuertes", "Postres" con ítems tipo `producto` (precio
  por unidad para extras) y "Estaciones" como `paquete` con foto y
  `capacidad_dia`. Booleanos de `detalles`: `incluye_personal`,
  `incluye_vajilla`, `incluye_montaje`, `hace_degustacion`, `dietas`.
- Barras: `por_evento` + `tarifa_evento` + `duracion_horas` (ej. 2 h) +
  `hora_extra`; el menú de bebidas va como grupo de productos y los tamaños
  de barra como paquetes.

**(b) Flujo hoy.** El cliente pone cuántas personas y ve
`tarifa × max(personas, mínimo)` al instante; suma extras del menú; paga
depósito. El dueño aprueba, y su cupo (`eventos_por_dia`, ej. 3 servicios el
mismo sábado) se respeta solo.

**(c) Brechas.**
1. **No hay "menú incluido con elección de N"**: el paquete por persona real
   es "elegí 2 platos fuertes y 1 postre entre estos". Hoy todo ítem del menú
   suma precio; no se puede marcar un grupo como *incluido en la tarifa,
   elegí hasta N sin costo*. Recomendación: campo `elecciones_incluidas` por
   grupo (o `precio: 0` + tope de selección por grupo) para que el menú
   virtual arme el paquete sin doble cobro.
2. **Ítems "por persona" no se multiplican por invitados**: si una estación
   de ceviche vale ₡1.500 por persona, el cliente tendría que poner 80 en el
   contador. Recomendación: unidad normalizada `por persona` que multiplique
   automáticamente por los invitados ya digitados.
3. **La degustación no se agenda**: `hace_degustacion` es solo un texto del
   portal. Recomendación de segunda fase: cita de degustación (la vertical
   de Citas ya tiene la mecánica de horas).

## 2. Animación (DJ/discomóvil, grupos musicales, mariachis, animadores, inflables, magos…)

**Qué ofrece el mercado.** El paquete estándar de DJ/discomóvil es **4 horas**
de DJ + sonido, escalado por montaje: básico (sonido), medio (+ luces de
pista, láser, humo) y premium (+ pantalla, cabina, MC/animación), con hora
extra tarifada. Grupos y mariachis venden por tanda/horas con repertorio; la
animación infantil vende shows de 1–2 h con personajes y pintacaritas; los
inflables se alquilan por día.

**(a) Configuración con las piezas de hoy.**
- DJ: `por_paquete` + `tarifa_evento` (paquete base 4 h) + `duracion_horas: 4`
  + `hora_extra`. Los montajes alternativos (luces/premium) como ítems
  `paquete` del catálogo, y extras (máquina de humo, chispas frías, karaoke)
  como `producto`. `detalles.equipo`, `repertorio`, `demo_url`,
  `requiere_electricidad` completan el perfil.
- Animadores: `por_evento` con horas incluidas + catálogo de shows; inflables
  con `por_dia` + `capacidad_dia` por inflable.

**(b) Flujo hoy.** El cliente ve "Paquete base ₡X — incluye 4 horas", suma
horas extra con stepper, agrega extras del catálogo y paga el depósito.
`eventos_por_dia: 2` permite matiné + noche sin chocar el trigger de cupo.

**(c) Brechas.**
1. **Paquete del catálogo vs. tarifa base se pisan**: si el DJ publica sus
   3 montajes como ítems `paquete`, el cotizador igual suma la
   `tarifa_evento` del jsonb — el cliente que elige "Montaje premium" paga
   base + paquete. Hoy el workaround es dejar la tarifa base como el paquete
   básico y poner los otros como "upgrade" con el diferencial de precio.
   Recomendación: permitir que un ítem `paquete` **sustituya** la tarifa base
   (flag `es_paquete_base`), heredando sus `duracion_horas` para la hora extra.
2. **No hay hora del evento**: la reserva es solo fecha (`reservas.fecha` es
   `date`). Con `eventos_por_dia: 2`, dos clientes pueden reservar el mismo
   sábado los dos "de noche". Recomendación: campo hora de inicio (+ duración
   ya conocida por las horas del paquete) — reutilizando la idea de
   `horarios_bloques` que ya existe para Lugares — y que el cupo del día se
   valide por franja.
3. `hora_extra` solo funciona con `por_evento/por_paquete`; un grupo musical
   que cobra por tanda no puede ofrecer "tanda adicional" cotizada, salvo
   como ítem del catálogo (aceptable, conviene documentárselo al proveedor).

## 3. Organización (wedding/event planners, fotógrafos, photo booth, producción audiovisual, invitaciones…)

**Qué ofrece el mercado.** Los wedding planners venden tres paquetes:
**coordinación del día B** (entra 4–6 semanas antes, dirige el día),
**parcial** (últimos meses, proveedores faltantes + montaje) y **completa**
(de la A a la Z, presupuesto y diseño), con precios claramente escalonados;
los organizadores corporativos suman producción, logística y staff. El photo
booth estándar: **por horas (mínimo 2–3)** con asistente, props, impresiones
ilimitadas y galería digital incluidos; cobran extra el traslado lejano, el
backdrop personalizado y la hora adicional. Fotógrafos venden por horas de
cobertura con entregables digitales.

**(a) Configuración con las piezas de hoy.**
- Planner: `modalidad_cobro: por_unidad` — el precio ES el catálogo: tres
  ítems `paquete` (Día B / Parcial / Completa) con `max_por_reserva: 1` y
  descripción larga de qué incluye cada uno. `eventos_por_dia: 1` (un solo
  evento coordinado por día). Depósito como anticipo de agenda.
- Photo booth: `por_hora` + `tarifa_hora` + `horas_minimas: 2` +
  `costo_traslado`; la segunda estación como `paquete` con `capacidad_dia`
  (el inventario real de cabinas) y extras (libro de firmas, props premium,
  backdrop) como `producto`.
- Fotógrafo/producción: `por_hora` + `horas_minimas`, o paquetes de cobertura
  en el catálogo; `portafolio_url` y booleanos de entrega en `detalles`.

**(b) Flujo hoy.** El planner recibe la reserva con el paquete elegido y el
chat abierto para la consulta inicial; el photo booth cotiza horas × tarifa
en vivo y su `capacidad_dia` evita vender 3 cabinas teniendo 2.

**(c) Brechas.**
1. **`por_unidad` no muestra paso de cotización** (a propósito) — correcto
   para planners, pero el `precio_desde` del directorio es lo único que
   comunica el precio antes de abrir el catálogo. Ninguna brecha de datos,
   sí de UX: conviene que el portal destaque los paquetes arriba.
2. **Los servicios de meses (planners) se agendan como un día**: la fecha
   reservada es la boda, pero el trabajo empieza meses antes; no hay forma
   de bloquear "solo acepto 2 bodas por mes". Recomendación: cupo mensual
   opcional (`eventos_por_mes`) para subcategorías de coordinación.
3. **Sin hora/franja** (igual que animación): dos photo booths el mismo día
   pueden ser el mismo horario. Misma recomendación de hora de inicio.
4. Para invitaciones/promocionales existe `minimo_pedido` en `detalles` pero
   **no se valida al reservar** — el mínimo real hoy es `min_por_reserva` por
   ítem (sí validado en 0051). Recomendación: usar `min_por_reserva` como
   fuente de verdad y retirar el campo duplicado, o validar `minimo_pedido`
   en `crear_reserva_servicio`.

## 4. Decoración (decoración de eventos e infantil, floristerías, toldos, sillas/mesas, manteles, tarimas…)

**Qué ofrece el mercado.** Dos modelos: **decoración como servicio** (arcos
orgánicos de globos ₡100–165 mil con montaje incluido, backdrops, montajes
temáticos completos) y **alquiler de inventario** (sillas, mesas por tamaño,
toldos 3×3/6×5/6×9, mantelería) con transporte + montaje + desmontaje, tiempo
de alquiler de 24 h o fin de semana, y depósito de garantía reembolsable.

**(a) Configuración con las piezas de hoy.**
- Decorador: `por_unidad` con catálogo por grupos ("Arcos y fondos" como
  paquetes con foto — la foto vende el diseño —, "Centros de mesa" como
  productos), `incluye_montaje/desmontaje`, `capacidad_dia` en los montajes
  grandes (solo se hacen 2 por día).
- Alquiler: `por_unidad` puro — el inventario ES el catálogo, cada ítem con
  precio por unidad, `min_por_reserva` (ej. mínimo 10 sillas) y
  `capacidad_dia` = el stock real (200 sillas, 6 toldos): la vista
  `disponibilidad_items` pinta "queda N" por fecha, que es exactamente el
  problema #1 de un alquiler (sobrevender el stock de un sábado).
  `deposito_garantia` y `tiempo_alquiler` en `detalles`.

**(b) Flujo hoy.** El cliente arma el pedido con contadores (10 sillas, 2
toldos…), el total se suma en vivo, y 0051 rechaza la reserva si otra fecha
igual ya agotó el stock del día. El dueño ve el pedido línea por línea.

**(c) Brechas.**
1. **El alquiler multi-día no bloquea inventario**: `capacidad_dia` solo se
   valida contra `p_fecha`; un alquiler de viernes a domingo deja el stock
   "libre" sábado y domingo. La modalidad `por_dia` cotiza días × tarifa pero
   no extiende la reserva. Recomendación: `fecha_fin` opcional en la reserva
   de servicios y que 0051/`disponibilidad_items` cuenten el rango.
2. **Depósito de garantía ≠ depósito de reserva**: `deposito_garantia`
   (reembolsable, contra daños) es solo informativo; el único cobro real es
   `deposito_reserva`. Recomendación: mostrarlo en el resumen de pago del
   portal para que no aparezca sorpresivamente en el chat.
3. **Sin monto mínimo de pedido**: `ranchos.monto_minimo` existe (0018) pero
   el flujo de servicios no lo valida; a un alquiler no le sirve un pedido de
   ₡3.000 con flete de 40 km. Recomendación: validar `monto_minimo` contra el
   total del pedido en `crear_reserva_servicio`.

## 5. Otros servicios (revelaciones de sexo, transporte, seguridad, baños portátiles, plantas eléctricas)

**Qué ofrece el mercado.** Revelaciones: paquetes evento-corto (cañones de
humo/confeti rosa o celeste, globo gigante, coordinación de la sorpresa) +
unidades extra de cañones. Transporte: buseta **con conductor por evento**
(bloque de horas con esperas incluidas) más hora adicional; contratación por
capacidad (15/28/42 pasajeros). Baños y plantas: alquiler por día/evento con
entrega e instalación.

**(a) Configuración con las piezas de hoy.** La categoría tiene las 4
modalidades (`por_evento/hora/dia/unidad`) — cubre los cuatro rubros:
revelación `por_paquete` + extras en catálogo; transporte `por_unidad` con
cada buseta como `paquete` (precio por viaje/bloque, `capacidad_dia` = flota
real) y "hora adicional" como producto; baños/plantas `por_dia` +
`capacidad_dia` = unidades disponibles. `que_incluye` y
`capacidad_cantidad` en `detalles` explican el alcance.

**(b) Flujo hoy.** Igual al resto: fecha → paquete/unidades → depósito →
pendiente + chat. Para flotas (busetas, baños) el inventario por fecha ya
está resuelto por `disponibilidad_items`.

**(c) Brechas.**
1. **Trayectos/distancia**: transporte cobra por ruta y `costo_traslado` es
   un fijo único. Hoy el chat lo resuelve; a futuro, traslado por provincia
   (la lista `zonas` ya existe, solo falta asociarle montos).
2. **Ítems por día**: un ítem no puede decir "este precio es por día de
   alquiler" de forma estructurada (la `unidad` es texto libre) — se liga a
   la brecha multi-día de Decoración.
3. Es la categoría cajón: cuando un rubro crezca (ej. transporte), moverlo a
   subcategoría con campos propios como ya se hizo con las barras (0021).

## Brechas transversales (las 5 que más pagan)

1. **Hora y franja del evento**: `reservas.fecha` es solo fecha; todo el
   cupo (`eventos_por_dia`, `capacidad_dia`) asume que dos eventos del mismo
   día no chocan en horario. Es la brecha #1 para DJ, photo booth y barras.
2. **Paquete del catálogo como base de cobro** (`es_paquete_base`): hoy
   `por_paquete` usa una tarifa única del jsonb y los ítems `paquete` del
   catálogo siempre SUMAN; elegir montaje básico/medio/premium sin doble
   cobro es el patrón real de DJ, photo booth y planners.
3. **Menú incluido con elección de N** para catering (por persona + "elegí
   2 platos de este grupo"), y multiplicación automática de ítems con unidad
   "por persona".
4. **Rango de fechas para alquileres** (decoración, toldos, baños, plantas):
   `fecha_fin` y conteo de inventario por rango.
5. **Validar `monto_minimo` del negocio en `crear_reserva_servicio`** — la
   columna existe desde 0018 y el flujo de servicios la ignora.

## Fuentes (investigación de mercado)

- DJ/discomóvil CR: [ineventos.com/cr-en/djs](https://www.ineventos.com/cr-en/djs), [fiestaencasacr.com](https://fiestaencasacr.com/), [goldenbeatsdiscomo](https://goldenbeatsdiscomo.wixsite.com/costarica)
- Catering: [seviaraprecocinados.com](https://www.seviaraprecocinados.com/post/que-incluye-servicio-catering-bodas-profesional), [vows.com.mx](https://www.vows.com.mx/blog/catering-boda-mexico), [meseros.com.mx](https://meseros.com.mx/producto/banquetes/)
- Photo booth: [mihiphotobooth.com](https://www.mihiphotobooth.com/what-comes-with-a-photo-booth-rental/), [pixilated.com](https://pixilated.com/blogs/main-blog/photo-booth-rental-cost-and-whats-included)
- Wedding planner: [bodas.com.mx](https://www.bodas.com.mx/articulos/cuanto-cuesta-un-wedding-planner-y-que-incluyen-sus-servicios--c10228), [weddingplannerenmadrid.es](https://www.weddingplannerenmadrid.es/organizacion-bodas-madrid/organizaci%C3%B3n-parcial-boda/), [mynaturalwedding.com](https://mynaturalwedding.com/es/elegir-paquetes-planificacion-bodas/)
- Coffee/matcha bar: [emcebar.org.mx](https://www.emcebar.org.mx/evento-cafe/), [glasshousecoffeecart.com](https://www.glasshousecoffeecart.com/matcha-catering), [cupacabana.com](https://cupacabana.com/matcha-catering/)
- Parrilladas: [eventoshighclass.com](https://eventoshighclass.com/costo-de-servicio/costo-de-parrillada-para-fiestas), [amparrilleros.mx](https://amparrilleros.mx/servicio-de-catering/)
- Alquiler mobiliario CR: [jmeventos.com](https://www.jmeventos.com/mobiliario/), [alquileresgmcr.com](https://www.alquileresgmcr.com/), [kolibrieventos.com](https://www.kolibrieventos.com/alquiler-de-sillas-y-mesas/)
- Decoración con globos (CR): [happytowncr.com](https://www.happytowncr.com/producto/decoracion-arco-organico/), [teleglobo.es](https://www.teleglobo.es/arcos-de-globos/)
- Revelaciones: [polvosholifiestas.com](https://polvosholifiestas.com/gender-reveal/canones-humo), [luminososfluorescentes.com](https://luminososfluorescentes.com/es/baby-shower/gender-reveal/canones-humo-colores)
- Transporte de invitados: [buseando.es](https://www.buseando.es/eventos/alquiler-autobus-autocar-minibus-boda), [travidi.com](https://travidi.com/servicios/transporte-para-eventos/transporte-de-invitados/)
