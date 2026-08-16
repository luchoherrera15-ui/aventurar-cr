# Decisiones de diseño — Wallet V2

> **Actualización Fase 2B**: implementado en local exactamente según
> estas decisiones. La única precisión que la implementación agregó al
> diseño: el nombre final de la tabla de sincronización cambió de
> `wallet_sync_pendiente` (§6, tachado por el dueño en la revisión) a
> `wallet_sincronizaciones` — ver `fase-2b-resultado.md`.

> Fase 2A: diseño, no ejecución. Ninguna decisión de este documento se aplicó
> todavía a la base de datos. Se apoya en `docs/wallet-v2/modelo-existente.md`
> (inventario con evidencia real) y en `docs/wallet-v2/auditoria-inicial.md`
> (Fase 0).

## Principio rector

El inventario de Fase 2A confirmó algo que cambia el enfoque completo: el
esquema actual de lealtad (`programa_lealtad`, `miembros`, `pases_wallet`,
`registros_dispositivo`, `transacciones_puntos`, `recompensas`, `canjes`) está
**bien diseñado en su núcleo** — ledger inmutable con idempotencia real,
identidad de persona correctamente separada del permiso por negocio, relación
dispositivo↔pase genuinamente many-to-many, RLS consistente. Los problemas que
aparecieron (Fase 0 y Fase 2A) son de **adopción incompleta** y **piezas que
faltan**, no de arquitectura equivocada.

Por eso la decisión de fondo de este documento es: **Wallet V2 evoluciona las
tablas en español que ya existen, en vez de crear un juego paralelo de tablas
en inglés** (`loyalty_program`, `pass_template`, etc.). Crear una segunda
familia de tablas para el mismo concepto sería exactamente la duplicación que
la Fase 2A pide evitar, y rompería la única convención de nombres que el
repositorio mantiene sin excepción (español, sin excepción, en 155+
migraciones). El vocabulario en inglés del enunciado original se usa acá
**solo como referencia conceptual** para mapear contra lo real.

---

## 1. Vocabulario definitivo (mapeo concepto → tabla real)

| Concepto | Tabla/mecanismo real | Estado |
|---|---|---|
| Negocio | `cuentas` (0134), con costura opcional a `ranchos` para el directorio público | Existe. **Adopción incompleta** — ver §2 |
| Programa de lealtad | `programa_lealtad` | Existe |
| Plantilla / diseño | Embebido en `programa_lealtad` (columnas `pase_*`) | Existe, 1:1. No se separa — ver §3 |
| Miembro (cliente afiliado) | `miembros`, identidad real en `personas` | Existe |
| Cuenta de lealtad (saldo) | Se fusiona en `miembros` (mover el saldo cacheado ahí) | **No se crea tabla nueva** — ver §4 |
| Instancia Wallet (por plataforma) | `pases_wallet` | Existe — ya modela exactamente esto |
| Plataforma Wallet | Columna `pases_wallet.plataforma` (`apple`\|`google`) | Existe |
| Movimiento | `transacciones_puntos` | Existe. Se amplía el dominio de `tipo` — ver §7 |
| Recompensa | `recompensas` | Existe |
| Canje | `canjes` + `intentos_canje` | Existe |
| Dispositivo Apple | `registros_dispositivo` (fila = device × pase) | Existe — ya es many-to-many real |
| Registro Apple | Misma tabla que dispositivo — no son capas separadas | — |
| Evento de sincronización / intento | **Tabla nueva única**: `wallet_sync_pendiente` | Genuinamente nuevo — ver §5 |

**Regla de nomenclatura que esto obliga**: la palabra "pase" en el código y en
la conversación con el dueño sigue significando tres cosas distintas según
contexto (el programa completo, la plantilla visual, la instancia en el
teléfono de un cliente) — igual que hoy. Este documento usa **programa**,
**plantilla** (aunque viva embebida) y **pase de un miembro** para
desambiguar donde haga falta, sin renombrar columnas reales todavía.

---

## 2. La entidad de negocio: `cuentas`, no una tabla `business` nueva

Confirmado en el inventario (§1 de `modelo-existente.md`): `cuentas` fue
creada en 0134 explícitamente como la raíz de negocio para módulos como
Lealtad, con dueño propio, equipo con roles granulares, y una costura
*opcional* a `ranchos` (`rancho_id uuid unique ... on delete set null` —
`null` es un negocio que existe solo en Lealtad, sin publicarse en el
directorio). Es exactamente lo que Wallet V2 necesita: un negocio de
Lealtad no tiene por qué querer aparecer en el marketplace.

**El problema real no es la tabla — es que el alta activa no la usa.**
`/lealtad/nuevo/actions.ts` sigue creando la identidad del negocio como una
fila de `ranchos` con `estado:'pendiente'`, sin tocar `cuentas`. Confirmado
con datos: el único `programa_lealtad` de producción tiene `cuenta_id` NULL
pese a existir una `cuenta` con el mismo `rancho_id`.

**Decisión**: no crear `business`. `cuentas` es la entidad. **Prerrequisito
de Fase 2B**: cerrar el alta (`/lealtad/nuevo/actions.ts`) para que cree la
`cuenta` igual que hace el backfill histórico de 0134, y hacer `cuenta_id`
`NOT NULL` en `programa_lealtad` recién cuando ese backfill esté confirmado
al 100% — no antes. Hasta entonces, todo código nuevo de Wallet V2 debe leer
el plan/la identidad con el mismo patrón de fallback que ya usa
`src/lib/lealtad/cuenta.ts` (`cuenta_id` si existe, si no `rancho_id`).

---

## 3. `programa_lealtad` y "plantilla": ¿1:1 o 1:N?

El programa hoy mezcla, en la misma fila, dos cosas conceptualmente
distintas: la **mecánica** (`modo`, `puntos_por_visita`, `beneficio` jsonb,
reglas de 0136) y la **apariencia** (`pase_color_fondo`, `pase_logo_url`,
`pase_banner_url`, `pase_sello_icono`, `pase_texto_reverso`). Es 1:1 porque
son columnas de la misma fila.

**Argumentos a favor de separar** (`pass_template` aparte): permitiría
versionar el diseño sin tocar la mecánica, y "cambiar el diseño no crea un
programa nuevo" quedaría garantizado por construcción en vez de por
disciplina.

**Argumentos en contra, con evidencia**: (a) hoy "cambiar el diseño no crea
un programa nuevo" **ya se cumple** — es un `UPDATE` de columnas sobre la
misma fila, no un INSERT; separar la tabla no resuelve nada que esté roto.
(b) No hay ninguna evidencia en el inventario de que un negocio necesite
**más de una plantilla activa por programa** — el catálogo de planes ni
siquiera tiene un límite `max_plantillas` hoy porque el concepto no existe
como algo distinto de "el programa tiene un diseño". (c) Separar ahora,
sin un caso de uso real, es exactamente la fragmentación de una tabla de
una fila que la Fase 2A pide evitar.

**Decisión**: **no separar `pass_template` todavía.** Se mantiene 1:1
embebido en `programa_lealtad`. Se agrega un campo de versionado ligero,
`diseno_version integer not null default 1` (se incrementa por trigger cada
vez que cambia cualquier columna `pase_*`), para que el mecanismo de
sincronización (§5) pueda distinguir "cambió el saldo" de "cambió el
diseño" sin ambigüedad — que es el problema real que motivaba pedir una
tabla aparte, resuelto con una columna. Si en el futuro un plan superior
vende de verdad "varias plantillas para el mismo programa" (no está en el
catálogo actual), ahí sí se justifica extraer la tabla — con datos reales
de demanda, no de forma anticipada.

---

## 4. `miembros` y el saldo: no se crea `loyalty_account`

`miembros` ya es exactamente "un cliente afiliado a un programa" —
`programa_id` + `persona_id` únicos juntos, con `cliente_id` opcional. El
inventario encontró un problema real y concreto: el saldo cacheado
(`saldo_cache`) vive hoy en `pases_wallet`, **una vez por plataforma** — si
un miembro tiene pase Apple y pase Google, hay DOS columnas `saldo_cache`
que deben mantenerse sincronizadas a mano en cada escritura. Es
exactamente el "no duplicar sin estrategia explícita" que la Fase 2A
advierte, aplicado al saldo en vez de al teléfono/correo.

**Decisión**: mover `saldo_cache`/`actualizado_en` a `miembros` (una vez
por miembro, no por plataforma). `pases_wallet` deja de tener su propia
columna de saldo — cuando haga falta mostrarlo (depurar un pase puntual),
se lee por join a `miembros`. Esto no es crear una tabla `loyalty_account`
nueva: es reconocer que `miembros` **ya es** esa tabla y quitarle al
`pases_wallet` una responsabilidad que nunca debió tener repetida.

`transacciones_puntos` sigue siendo la única fuente de verdad; `miembros`
sigue siendo proyección, igual que hoy — solo cambia DÓNDE vive la
proyección.

---

## 5. `member_pass` y `wallet_platform_instance`: ya son la misma tabla

`pases_wallet` (fila = miembro × plataforma, `serial_number` único,
`auth_token` estable, `activo`, `objeto_externo` para sobrevivir fusiones
de persona) **ya cumple las dos responsabilidades** que el vocabulario
original separaba en dos capas. No hay nada que una tabla `member_pass` y
otra `wallet_platform_instance` resolverían por separado que esta tabla no
resuelva junta. Confirmado que soporta los ocho casos que pedía el
enunciado: Apple solamente, Google solamente, ambas, ninguna todavía
(fila no existe hasta la primera emisión), reinstalaciones (mismo
serial/token, ver Fase 0 §2), varios dispositivos Apple (relación M:N real
vía `registros_dispositivo`), cambio de teléfono (nuevo `device_library_id`
registrado, el pase no cambia), eliminación (`DELETE /v1/devices/...`
borra el registro, el pase queda `activo` pero sin dispositivo).

**Decisión**: no crear ninguna tabla nueva. `pases_wallet` es
`member_pass` y `wallet_platform_instance` a la vez, y seguir llamándola
así.

---

## 6. `wallet_outbox_event` + `wallet_sync_job`: se fusionan en UNA tabla nueva

Esta es la única pieza genuinamente nueva del diseño.

**Lo que ya existe y funciona**: pausa (`aviso-de-pausa.ts`) y cambio de
diseño (`aviso-de-diseno.ts`) ya implementan un patrón real de cola con
reintento — pero como **columnas de bandera directamente en
`pases_wallet`** (`pase_en_pausa`/`pausa_avisada_en`/`pausa_error`,
`diseno_pendiente`/`diseno_avisado_en`/`diseno_error`), sin tabla de
outbox separada. Funciona porque cada tipo de aviso es autocontenido: una
bandera, reclamada con `UPDATE ... WHERE bandera AND NOT reclamado`, y una
columna de error si falla.

**Lo que falta, confirmado por la Fase 0**: el camino de saldo/sello (el
más usado) no tiene ningún equivalente — el aviso se dispara una vez,
inline, sin persistir nada si falla. Además, ni pausa ni diseño guardan
**historial de intentos** (cuántas veces, cuándo fue el próximo intento,
quién lo procesó) — solo el último estado. Eso es exactamente lo que el
enunciado pide separar en "evento" vs "intento".

**Por qué UNA tabla y no dos**: crear `wallet_outbox_event` (el hecho de
dominio) y `wallet_sync_job` (el intento por plataforma) como tablas
separadas duplicaría, en la práctica, exactamente el mismo par
`programa/pase → apple, google` que hoy vive en columnas espejadas de
`pases_wallet`. El enunciado mismo advierte "no mantener dos colas con
responsabilidades idénticas" y pide simplificar si no hace falta la
separación. Con el volumen de este sistema (una fila de `programa_lealtad`
en producción hoy), la separación agrega dos tablas para modelar una
relación 1:1 en la práctica (un evento de saldo casi siempre genera como
máximo dos intentos: uno por plataforma que el miembro tenga activa).

**Decisión — tabla nueva `wallet_sync_pendiente`**, que reemplaza tanto el
patrón de columnas de pausa/diseño como el hueco de saldo, con una fila por
`(pase_id, motivo)` pendiente de sincronizar:

```
wallet_sync_pendiente
  id                uuid PK default gen_random_uuid()
  pase_id           uuid NOT NULL FK pases_wallet(id) on delete cascade
  motivo            text NOT NULL CHECK in ('saldo','diseno','pausa','mensaje_promocional')
  correlation_id    uuid NOT NULL   -- enlaza con la transacción/evento que lo originó
  intentos          integer NOT NULL default 0
  proximo_intento_en timestamptz NOT NULL default now()
  reclamado_por     text            -- worker id/lease, null = libre
  reclamado_en      timestamptz
  ultimo_error      text            -- sanitizado, nunca el payload crudo
  creado_en         timestamptz NOT NULL default now()
  completado_en     timestamptz     -- null = pendiente; not null = éxito, fila se archiva/borra
  unique (pase_id, motivo) where completado_en is null   -- no duplica trabajo pendiente del mismo tipo
```

Un `UPDATE ... transacciones_puntos` que cambia el saldo hace `INSERT ...
ON CONFLICT (pase_id, motivo) WHERE completado_en IS NULL DO UPDATE SET
proximo_intento_en = now()` — si ya había un sync pendiente de saldo para
ese pase, no se duplica, simplemente se "adelanta" el reintento. El worker
(cron, mismo mecanismo que ya usa `pases-en-pausa.yml`) reclama filas con
`proximo_intento_en <= now() AND reclamado_en is null`, las procesa, y
en éxito pone `completado_en = now()` (se archivan/borran periódicamente);
en fallo incrementa `intentos`, calcula backoff, y libera el reclamo.

Esto responde directamente al hallazgo más grave de la Fase 0 (sección 9,
"dónde se rompe la trazabilidad"): con esta tabla, la pregunta "¿a este
sello le llegó el push?" se contesta con una consulta, no con logs
efímeros.

---

## 7. Ledger inmutable (`transacciones_puntos`)

Ya es un ledger real: `saldo_anterior`/`saldo_posterior`, `reversion_de`,
índice único parcial `(miembro_id, referencia)` para idempotencia,
`pg_advisory_xact_lock` para concurrencia. Se amplía, no se sustituye:

**Ampliar el dominio de `tipo`** de `('ganado','canjeado','ajuste')` a:

```
'ganado', 'ganado_reversado',
'puntos_agregados', 'puntos_reversados',
'cashback_pendiente', 'cashback_confirmado', 'cashback_canjeado', 'cashback_reversado',
'canjeado', 'canjeado_reversado',
'ajuste', 'expiracion'
```

(los tipos actuales se preservan tal cual para no romper `motor.ts` ni las
filas existentes — se agregan los nuevos, ninguno se renombra).

**Agregar columnas** que el enunciado pide y que hoy no están explícitas:
`unidad text` (`'sellos'|'puntos'|'colones'|'usos'`, ya existe como
concepto en `UNIDAD_SALDO` de `tipos-tarjeta.ts` pero no como columna del
ledger), `correlation_id uuid` (para enlazar con `wallet_sync_pendiente`),
`idempotency_key` — **ya existe**, es la columna `referencia` con su índice
único parcial; no se crea una columna paralela, se documenta que
`referencia` cumple ese rol (evitar el error real que ya cometió la 0137
con `llave_idempotencia`, una columna de idempotencia muerta porque nadie
la conectó — ver Fase 2A §5 del inventario).

**Saldo: ledger como fuente + `miembros.saldo_cache` como proyección** (no
solo ledger, no solo proyección) — es el patrón que ya funciona hoy,
confirmado por el propio comentario de `motor.ts`. Se mantiene. El único
cambio es DÓNDE vive la proyección (§4).

**Invariantes que ya se cumplen y no hay que reconstruir**: sellos
duplicados y doble clic → índice único de `referencia` + advisory lock
(Fase 2A §5 del inventario, mecanismo verificado línea por línea). Edición
silenciosa del historial → imposible, no hay `UPDATE`/`DELETE` grant para
nadie fuera de `service_role`, y ni siquiera el RPC actualiza una fila ya
insertada. Dos canjes del mismo beneficio → cubierto por el mismo
mecanismo de `referencia`.

**Gap real a cerrar (no a rediseñar)**: las reglas de nivel-tarjeta
(`uso_unico`, `max_por_cliente`, `max_global`, vigencia/horario de 0136)
se validan hoy en TypeScript, **antes** del RPC y **sin lock** — ver
Fase 2A §5. Wallet V2 debe mover esa validación **dentro** de
`canjear_recompensa`, bajo el mismo `pg_advisory_xact_lock` que ya protege
`stock_total`/`limite_por_cliente`. Es una migración de la función RPC, no
un cambio de tabla.

---

## 8. Cashback sin errores monetarios

No existe hoy ningún camino de cashback implementado (el `tipo='cashback'`
de `programa_lealtad.modo` existe como valor de catálogo, pero el ledger
solo tiene `ganado/canjeado/ajuste` — cashback como mecánica de dinero real
es net-new). Diseño:

- **Monto**: `bigint`, en la unidad **menor** de la moneda (colones enteros
  — CRC no tiene fracción menor en la práctica de este sistema, así que
  "unidad menor" = 1 colón, no céntimos; se documenta explícito para que
  nadie multiplique por 100 pensando en centavos).
- **Moneda**: `moneda text NOT NULL CHECK in ('CRC')` por ahora — mismo
  patrón defensivo que `giftcard.moneda` ya usa en `tipos-tarjeta.ts`
  (`CRC`|`USD`), ampliable el día que haga falta.
- **Porcentaje**: `basis_points integer NOT NULL CHECK (0..10000)` — nunca
  `numeric`/`float`. 500 = 5.00%.
- **Redondeo explícito**: `round(compra_base_colones * basis_points /
  10000.0)` con redondeo bancario (`round half to even`) documentado en el
  código, no dejado a la conversión implícita de Postgres.
- **Ejemplo pedido**: compra de ₡10 000, cashback 5% (500 bps) → `10000 *
  500 / 10000 = 500` → **₡500 exactos**, sin fracción. Con una compra de
  ₡10 333 y 5%: `10333 * 500 / 10000 = 516.65` → redondeo bancario a
  **₡517** (517 es impar más cercano hacia par... en este caso `516.65`
  redondea a `517` por ser el más cercano; el caso ".5 exacto" —ej. ₡10
  000 con 5.05%→ `505.0`— es donde "redondeo bancario" realmente decide,
  yendo al par más cercano). Se calcula **siempre en el servidor**, dentro
  del mismo RPC que inserta la transacción — nunca confiar en un monto que
  llegue del cliente.
- **Estados**: `cashback_pendiente → cashback_confirmado →
  cashback_canjeado`, con `cashback_reversado` disponible desde cualquiera
  de los tres (son 4 de los valores nuevos de `tipo` en §7, no una tabla
  aparte — cada transición es una fila nueva en el ledger, nunca un
  `UPDATE` de la fila anterior).
- **Compra base obligatoria**: columna `compra_base_colones bigint NOT
  NULL` en la transacción de tipo `cashback_pendiente` — sin ella no se
  puede auditar de dónde salió el monto.
- **Límites**: por movimiento (`tope_por_compra` — ya existe el patrón en
  `ConfigCashback.topePorCompra` de `tipos-tarjeta.ts`, se reutiliza el
  mismo campo) y por período (nuevo, si el negocio lo pide — no hay
  evidencia de demanda hoy, se deja como capacidad de plan futura, no como
  columna que nadie llena).

---

## 9. Recompensas y canjes

`recompensas` + `canjes` + `intentos_canje` ya cubren, con evidencia de
código citada en el inventario (Fase 2A §5), casi todo lo que pide el
enunciado: costo fijo en sellos/puntos, meta automática (la más barata
activa, sin campo persistido), vigencia en dos capas, inventario real
(`stock_total` contado bajo lock, no decrementado), límite por cliente,
repetibilidad (`limite_por_cliente` null vs 1), reversión completa
(`revertir_movimiento`, con guarda de saldo negativo desde 0139), y actor
(`canjes.entregado_por`).

**No se crean `loyalty_reward` ni `loyalty_redemption` nuevas** — son
`recompensas` y `canjes` con un solo ajuste real pendiente: **mover la
validación de reglas de nivel-tarjeta dentro del RPC bajo lock** (§7,
mismo gap). El "código o comprobante de canje" que el enunciado pide ya
existe conceptualmente como el QR/código de barras fijo del pase — no se
inventa un código de canje aparte, porque el sistema ya resolvió esa
necesidad de otra forma (el pase mismo es el comprobante).

**Deuda a decidir, no a resolver en Fase 2A** (queda en la lista de
preguntas para el dueño): `llave_idempotencia` (0137) es una columna
muerta — nadie le escribe nada, el mecanismo real de idempotencia es
`transacciones_puntos_referencia_unica`. Wallet V2 puede: (a) dejarla
muerta y documentarla como tal, o (b) retirarla en una migración de
limpieza. No se toca en Fase 2A.

---

## 10. Personalización (preparación de modelo, sin constructor visual)

Se documenta la decisión de almacenamiento, no se construye la interfaz
(eso es Fase 6). Del inventario (Fase 2A §6): hoy hay **dos buckets**
sirviendo el mismo dato lógico (`ranchos-fotos` desde el panel,
`comprobantes` desde el alta pública), ambos con URLs públicas
permanentes, ninguno con RLS que valide dueño real del objeto, y sin
revalidación de tipo MIME en el servidor.

**Decisión**: un bucket propio y nuevo, `lealtad-branding`, público de
solo-lectura, con política de escritura que exija
`storage.foldername(name)[1] = auth.uid()::text` (la carpeta = el dueño,
verificado por RLS de Storage, no por convención de la app como hoy).
`comprobantes` deja de usarse para logos — vuelve a ser exclusivamente
documentos de pago. La migración de los 2 buckets actuales a este uno
nuevo es trabajo de Fase 6, no de esta fase.

**Qué se guarda como qué**:
- Preset de color (1 de 8) → un id de texto (`PALETAS` ya vive en código,
  se sigue así — no se duplica en la base).
- Color personalizado / texto / meta / recompensa / términos / vigencia →
  columnas ya existentes de `programa_lealtad` (§3), sin cambios.
- Logo / imagen principal → **ruta de Storage** guardada
  (`lealtad-branding/<cuenta_id>/logo-<hash>.<ext>`), no la URL completa
  — la URL pública se deriva en el servidor al leer, así que cambiar de
  dominio/CDN el día de mañana no exige tocar filas. El hash en el nombre
  sirve de invalidación de caché natural (subir un logo nuevo = ruta
  nueva = no hay que purgar CDN).
- **Nunca URLs firmadas de corta duración como referencia permanente** —
  regla explícita que ya casi se viola hoy (Google descarga la URL en el
  momento de crear/actualizar el objeto; si fuera firmada y expirara,
  Google se queda con una copia vieja o falla la creación).
- Apple recibe el asset **procesado y embebido dentro del `.pkpass`**
  (como ya hace `imagenes.ts` con sharp) — sin cambios de fondo, solo
  pasa a leer del bucket nuevo.
- Google sigue recibiendo una URL pública estable — sin cambios de fondo,
  mismo comentario.

---

## 11. Identidad Apple

**Campos ya cubiertos por `pases_wallet` + `firma.ts`/`generar.ts`** (Fase
0 y Fase 2A confirmaron esto con evidencia): `passTypeIdentifier` (config
de entorno, no por fila), `serialNumber` estable (`pases_wallet.id` o
`serial_number`, leído antes de crear — Fase 0 §2), `authenticationToken`
estable (`auth_token`), estado (`activo`), versión (falta — ver abajo).

**Lo que falta y se agrega**: `update_tag bigint NOT NULL default 0`
(se incrementa en cada cambio real de contenido — saldo o diseño —, es lo
que permite al futuro endpoint de "seriales modificados" responder con
precisión sin recalcular nada); `ultima_generacion_en timestamptz`; se
retira la ambigüedad de "última modificación" actual (`actualizado_en`
mezclaba esto con el saldo — con el saldo movido a `miembros`, §4,
`pases_wallet.actualizado_en` pasa a significar solo "última vez que este
pase específico cambió de versión").

**Protección de `authenticationToken` — la decisión pedida explícitamente**:

| Opción | Cómo funciona | Evaluación |
|---|---|---|
| Token aleatorio, almacenado cifrado | `randomBytes(32)` al crear, cifrado con una llave de aplicación antes de guardar en `auth_token_cifrado`, descifrado solo cuando se necesita comparar | El servidor SIEMPRE necesita el valor real para compararlo contra el header `Authorization: ApplePass <token>` en cada llamada del Web Service — cifrar no evita tener que descifrar en cada request, y agrega una llave más que proteger y rotar |
| Token derivado por HMAC + secreto versionado | `token = HMAC-SHA256(secreto_version_N, miembro_id + serial + plataforma)` — no se guarda el token, se **recalcula** en cada verificación | Recuperable sin guardar nada sensible en la fila; rotar el secreto invalida TODOS los tokens a la vez (no hay forma de rotar uno solo) — mal fit para "un cliente reporta que su pase dejó de autenticar" |

**Decisión**: **token aleatorio, comparado en tiempo constante contra el
valor guardado en claro en `auth_token`** — que es exactamente lo que el
código ya hace hoy (`igualSeguro`, confirmado en Fase 0). No se cambia a
cifrado ni a HMAC. Motivo explícito: el propio enunciado advierte "no
almacenar únicamente un hash si el servidor necesita volver a generar
exactamente el mismo token" — un HMAC derivado SÍ permite regenerarlo,
pero el costo de rotación total del secreto ante cualquier incidente
puntual es peor que el riesgo que resuelve. El token no es una contraseña
reusada entre servicios ni protege dinero directamente — protege
"quién puede pedir el `.pkpass` de este pase", y ya vive en una tabla sin
RLS para ningún rol fuera de `service_role` (Fase 2A §3), con longitud de
32 bytes aleatorios. El riesgo real de guardarlo en claro es un volcado de
base de datos completo — escenario donde `SUPABASE_SERVICE_ROLE_KEY`
también estaría comprometida, y en ese escenario cifrar el token con una
llave que vive en el mismo entorno no añade protección real.

**`apple_device` y `apple_registration`**: ya son `registros_dispositivo`
(§5, Fase 2A). Se amplía con las columnas de trazabilidad que la Fase 0
pidió y que hoy no existen: `ultimo_push_en timestamptz`,
`ultimo_push_status integer`, `ultimo_error text`, `intentos_fallidos
integer NOT NULL default 0`. El `pushToken` sigue perteneciendo a la fila
del registro (dispositivo × pase), nunca a un usuario de Bookea — ya es
así hoy, se mantiene.

---

## 12. Identidad Google

Cubierto por `pases_wallet` (`objeto_externo` = Object ID, sobrevive
fusiones) + variables de entorno (Issuer ID, ver `docs/wallet-v2/variables-entorno.md`).
IDs deterministas por diseño (`idDeClase`/`idDeObjeto`, Fase 0 §4) — nunca
cambian entre actualizaciones, confirmado.

**Se agrega**: `google_revision text` (el `reviewStatus` que Google
devuelve — hoy no se persiste), `google_ultimo_payload_hash text` (hash
del último cuerpo de PATCH confirmado — permite un chequeo barato de "¿hay
algo nuevo que mandar?" antes de golpear la API), y las mismas columnas de
trazabilidad de intento que Apple (`ultimo_push_en`... ya cubiertas por
§6, la tabla `wallet_sync_pendiente`, así que no se duplican en
`pases_wallet` — el intento vive en la tabla de sync, el estado
CONFIRMADO vive en `pases_wallet`).

La Class representa configuración compartida (branding del negocio); el
Object representa estado individual (saldo, progreso) — confirmado contra
la documentación oficial en la Fase 0, sin excepciones encontradas.

---

## 13. Resumen de la tabla nueva

Solo **una** tabla genuinamente nueva en todo este diseño:
`wallet_sync_pendiente` (§6). Todo lo demás son columnas agregadas a
tablas que ya existen. Esto es deliberado y es la respuesta directa a la
pregunta rectora de la Fase 2A: de las 13 tablas que el enunciado original
proponía, **12 ya existen con otro nombre y se amplían; 1 es
genuinamente nueva.**
