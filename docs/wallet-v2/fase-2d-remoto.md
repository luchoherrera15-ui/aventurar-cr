# Fase 2D — Despliegue remoto y sincronización real (Apple/Google Wallet)

> Documento vivo, igual que `fase-2c-resultado.md`. Cubre desde la
> inspección previa al despliegue hasta la demostración física en
> teléfonos reales. Ningún paso que escriba en remoto se ejecuta sin
> el gate humano correspondiente.

## Etapa 1 — Inspección final del repositorio

**Commit base**: `41131272a119d41dccd60a3ad19e48c174edd811` ("feat(lealtad): rediseño completo de la landing pública", 2026-08-16).

**Archivos identificados como Wallet V2** (59 archivos): las 11
migraciones `0156`-`0166`, 16 documentos de `docs/wallet-v2/`, 6
archivos de prueba de integración nuevos (`supabase/tests-integracion/`),
3 scripts de inspección remota de solo lectura, `wallet-doctor.ts`,
el módulo `src/lib/wallet/config/` completo (8 archivos), `src/lib/
lealtad/equipo-canonico.ts`, y cambios en `firma.ts`/`generar.ts`/
`google.ts`/`servicio.ts`/`lealtad-secciones.tsx`/`nuevo/actions.ts`/
`eslint.config.mjs`/`vitest.config.ts`/`package.json`/`.env.example`.

**Archivos ajenos identificados y EXCLUIDOS del commit**:
`referencia/bookea-cuenta-premium.html`, `referencia/cuenta bookea
nueva.html`, `referencia/panel cuenta negocio.html` (y el resto de
`referencia/`, ya trackeado) — material de referencia visual de otra
tarea, sin relación con Wallet V2. Confirmado por contenido (mockups
HTML de otras pantallas), no solo por nombre.

**Secretos**: escaneo preciso (JWT reales de 3 segmentos excluyendo el
demo público local, bloques `BEGIN ... KEY`/`BEGIN CERTIFICATE`) sobre
todos los archivos del commit — **cero coincidencias**. `.env.example`
revisado línea por línea: todas las variables nuevas terminan en `=`
sin valor.

**`.gitignore`**: `.env*` excluido en la raíz; `supabase/.gitignore`
excluye `.temp`, `.env.local`, `.env.keys` — confirmado, sin cambios
necesarios.

**Trabajo del usuario que podría sobrescribirse**: ninguno detectado —
`referencia/*.html` quedó intacto y sin tocar (nunca se hizo `git add`
sobre esos archivos).

### Commit

```
e716f41fac90f19d0beb159e44fc5c934b2b18d1
feat(loyalty): add Wallet V2 domain foundation and sync infrastructure
59 files changed, 10525 insertions(+), 42 deletions(-)
```

**No se hizo `git push`** — el remoto (`origin` →
`github.com/luchoherrera15-ui/aventurar-cr.git`, rama `main`) no se
tocó. Push solo si se pide explícitamente, después de confirmar
destino y rama.

## Etapa 2 — Historial de migraciones (solo lectura)

Reconfirmado con `scripts/drift-remoto.mjs` (mismo mecanismo de Fase
2C): **ninguna de las 11 migraciones (0156-0166) está aplicada en
remoto** — 9 objetos testigo verificados directamente más una
verificación puntual del índice de `0166`, los 11 en `false`.

Este proyecto sigue sin usar `supabase_migrations.schema_migrations`
(confirmado otra vez: la tabla no existe en remoto) — el estado se
confirma por objeto testigo, no por la tabla de control del CLI.

**Sin drift nuevo** desde el último chequeo de Fase 2C — mismo esquema,
mismas 14 tablas relevantes ya existentes, mismas 2 tablas nuevas
(`wallet_sincronizaciones`, `wallet_sync_pendiente`) todavía ausentes.

**Orden de aplicación** (sin cambios, ver `aplicacion-remota-fase-2b.md`):
0156 → 0157 → 0158 → 0159 → 0160 → 0161 → 0162 → 0163 → 0164 → 0165 → 0166.

## Etapa 3 — Backup y plan de recuperación

**Hallazgo real — sin backup gestionado confirmado**: se consultó
`GET /v1/projects/{ref}/database/backups` (Management API, solo
lectura) — respuesta real:

```
pitr_enabled: false
backups: []
walg_enabled: true
```

**No hay ningún backup administrado por Supabase confirmado disponible
hoy**, ni point-in-time recovery habilitado. `walg_enabled: true` indica
que la infraestructura de WAL-G existe a nivel de plataforma, pero la
lista de backups recuperables está vacía — no es evidencia de que un
backup restaurable exista.

**No pude crear un `pg_dump` real yo mismo**: `supabase db dump
--linked` requiere la contraseña directa de Postgres (protocolo wire,
no la Management API ni las llaves `anon`/`service_role`, que son
credenciales de otra naturaleza) — esa contraseña no está en
`.env.local` y, por regla de esta fase, no se pide por chat.

**Lo que sí se capturó, de solo lectura**:
- Snapshot de esquema completo (columnas, constraints, índices, RLS,
  triggers, grants de las 14 tablas relevantes) — ya documentado en
  `drift-remoto.md` de Fase 2C, reconfirmado sin cambios en la Etapa 2
  de arriba.
- Conteos agregados frescos, tomados en el momento de este documento
  (2026-08-17T00:00:13Z): 1 cuenta, 1 programa (sin `cuenta_id`
  enlazado), 2 miembros, 3 pases (2 Apple + 1 Google), 0 canjes, 0
  intentos de canje, 1 divergencia de saldo ya conocida (Google:
  `saldo_cache=0` vs. ledger real `=1`) — **idénticos** a los de Fase
  2C, sin cambios en el negocio real desde entonces.
- Commit exacto (`e716f41f...`), hora UTC, historial de migraciones —
  todo registrado arriba.

**Espacio y conectividad**: la Management API respondió con latencia
normal en las ~15 consultas de solo lectura de esta fase — sin
indicios de problemas de conectividad.

**Runbook de rollback**: existe (`aplicacion-remota-fase-2b.md`,
`rollback-fase-2b.md`) — actualizado en Fase 2C con `0166` y el
endurecimiento de FKs.

### Criterios de aborto — evaluados contra el estado real

| Criterio | ¿Se cumple hoy? |
|---|---|
| El remoto no termina en la migración esperada | No — termina donde se esperaba (pre-0156), confirmado |
| Drift bloqueante | No — cero drift nuevo |
| El backup falla | **Sí, parcialmente — no hay backup gestionado confirmado ni PITR habilitado** |
| Programas con ownership ambiguo | No — 0 casos (confirmado en preflight) |
| El backfill produciría una asociación insegura | No — 1 sola cuenta candidata por rancho, sin ambigüedad |
| Una migración pide eliminar columnas | No — 0156-0166 son aditivas o `ALTER ... ON DELETE` (sin `DROP COLUMN`) |
| Se necesita desactivar RLS | No — ninguna migración lo requiere |
| No existe conexión estable | No — conectividad confirmada |
| El entorno remoto no coincide con lo documentado | No — coincide exactamente con Fase 2C |

**Un criterio de aborto se cumple hoy: el backup.** No se avanza a la
Etapa 4 sin que el dueño decida cómo resolver esto — ver el Gate 1 más
abajo.

## Etapas 5-11 — Worker y adaptadores (local, sin gate — no tocan remoto)

Construido mediante un workflow de 10 agentes (4 de auditoría en
paralelo → 1 de diseño → 3 de construcción en paralelo → 1 del núcleo
del worker → 1 de revisión final), y **verificado de forma
independiente después** — no se dio por buena ninguna afirmación de
los agentes sin correr los comandos yo mismo.

### Hallazgos reales de la auditoría (Etapa 5, antes de escribir código)

- Las 5 rutas oficiales del Web Service de Apple **ya existen y están
  listas para producción** en su mayor parte — pero `pases_wallet.
  update_tag` (calculado y probado a nivel de base desde la Migración
  E) **nunca se lee en la ruta `passesUpdatedSince`**, que sigue
  filtrando por `actualizado_en`. Gap real, documentado, no corregido
  en esta pasada (no bloquea el worker: el push vacío ya hace que el
  teléfono vuelva a preguntar).
- `cron-auth.ts` (`autorizarCron`) compara el `Bearer` con `!==` de
  texto plano, **no con `crypto.timingSafeEqual`** — no timing-safe.
  Ya señalado en la auditoría de Fase 0; sigue sin corregirse (fuera
  del alcance de esta pasada, que reutiliza el mecanismo tal cual).
- El único runtime de trabajos programados en este repo es **Vercel +
  GitHub Actions cron**, nunca Supabase Edge Functions ni `pg_cron` —
  confirmado por los 5 cron routes existentes, todos con el mismo
  patrón `autorizarCron` primero. El worker de Wallet V2 se diseñó
  para ser el sexto consumidor de ese mismo patrón, no un runtime
  nuevo.
- Google: el PATCH de saldo ya es un merge-patch real (`refrescarPaseGoogleDeMiembro`
  solo envía `loyaltyPoints` y, condicionalmente, `textModulesData`/
  `heroImage` — nunca `barcode`/`classId`/`accountId`), así que la
  propiedad "no borrar campos" ya la garantiza el código existente sin
  tener que reimplementar nada.

### Qué se construyó (Etapas 6, 7, 10, 11)

Todo en archivos **nuevos** — cero archivos existentes modificados:

| Archivo | Qué hace |
|---|---|
| `src/lib/wallet/sync/tipos.ts` | Contrato compartido: `TrabajoSync`, `ResultadoSync`, `PlataformaSync`, `OperacionSync` |
| `src/lib/wallet/sync/adaptador-apple.ts` | Envuelve `entregarApple()` (ya existente en `aviso-de-pausa.ts`) — nunca reimplementa APNs ni la firma del pase |
| `src/lib/wallet/sync/adaptador-google.ts` | Envuelve `refrescarPaseGoogleDeMiembro()`/`enviarMensajeGoogle()` (ya existentes en `google.ts`) — nunca reimplementa el JWT ni el PATCH |
| `src/lib/wallet/sync/flags.ts` | Feature flags: Wallet V2 global, Apple V2, Google V2, worker de sync, lista de cuentas piloto — todo apagado por defecto |
| `src/lib/wallet/sync/worker.ts` | El núcleo: `barrerLeaseExpirada`, `reclamarLote`, `marcarResultado`, `calcularBackoffSeg` (backoff exponencial con jitter parejo), `ejecutarCicloDeSincronizacion` |
| `src/app/api/wallet/sincronizar/route.ts` | El endpoint interno — `autorizarCron` primero (mismo mecanismo que las 5 rutas de cron existentes), sin ningún parámetro de ID de trabajo, lote clampado a `LOTE_MAXIMO=20` |
| `.github/workflows/wallet-sincronizar.yml` | Cron cada 5 minutos, mismo patrón que `pases-en-pausa.yml` |
| `supabase/migrations/0167_wallet_v2_reclamo_atomico_sincronizacion.sql` | Dos funciones `security definer` (`wallet_barrer_lease_expirada`, `wallet_reclamar_sincronizaciones`), otorgadas solo a `service_role` — necesarias porque PostgREST no permite componer `UPDATE ... WHERE (SELECT ... FOR UPDATE SKIP LOCKED)` desde el cliente REST |

**Por qué apareció una migración nueva que no estaba en el plan
original**: el patrón `FOR UPDATE SKIP LOCKED` ya se había probado en
Fase 2C, pero solo con SQL crudo vía `docker exec ... psql` — un atajo
que existe nada más en la máquina de pruebas. El worker real corre en
Vercel y solo puede hablar con la base por `supabase-js`/PostgREST, así
que el reclamo tiene que vivir en una función de Postgres invocada por
RPC — el mismo camino que ya usa `wallet_encolar_sincronizacion`.

### Verificación independiente — y un bug real que atrapó

Los agentes reportaron "17/17" y "todo verde" en sus propios resúmenes.
**No se les creyó sin repetir los comandos yo mismo** — y eso encontró
un problema real que el reporte de los agentes no tenía:

**Hallazgo**: al correr `npm run test:wallet-v2-local` de forma
independiente, **4 de 67 pruebas fallaron** — no por un error en el
worker, sino porque Vitest corre archivos de prueba distintos **en
paralelo por defecto**, y el archivo nuevo
(`wallet-v2-worker-sincronizacion.test.ts`) limpia TODA la tabla
`wallet_sincronizaciones` en su `beforeEach` (a propósito, para no
depender de lo que hayan dejado otras pruebas) — eso funciona bien
en soledad, pero corriendo AL MISMO TIEMPO que
`wallet-v2-cola-sincronizacion.test.ts` (que encola filas reales en
esa misma tabla compartida), los dos archivos competían por las mismas
filas. Una carrera entre archivos, no un bug de ninguno de los dos por
separado.

**Corrección**: `fileParallelism: false` en `vitest.integration.config.ts`
— todos los archivos de esta suite comparten el mismo Postgres local
real (a propósito, no hay una base "por archivo"), así que correrlos
en paralelo entre sí nunca fue seguro; simplemente no se había notado
hasta que un archivo empezó a limpiar la tabla entera. Reconfirmado
**dos veces** después de la corrección: `7/7 archivos, 67/67 pruebas`,
estable.

**Resto de la validación, corrida por mí, no por los agentes**:

| Comando | Resultado |
|---|---|
| `npx supabase db reset` | exit 0 — aplica limpio hasta `0167` |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` (suite normal) | exit 0 — 2115/2115 pruebas, 101 archivos |
| `npm run test:wallet-v2-local` | exit 0 — 67/67 pruebas, 7 archivos (reconfirmado 2 veces) |
| `npm run lint` | exit 0 — 4 warnings preexistentes, 0 nuevos |
| `npm run build` | exit 0 — incluye `/api/wallet/sincronizar` como ruta dinámica |

**Revisión de seguridad, confirmada por lectura directa de los
archivos** (no solo el reporte del agente de revisión): ningún
`console.*` imprime un token, push token, llave o secreto —
`motivoSeguro()`/`sanitizarMotivo()` truncan y tapan cualquier corrida
de 24+ caracteres que parezca un secreto antes de que llegue a un log
o a `wallet_sincronizaciones.error`. Ningún archivo nuevo hace una
llamada de red real durante los tests — los mocks están un nivel por
encima del punto real donde `apns.ts`/`google.ts` hablan con la red,
así que `npx vitest run` nunca puede alcanzar `api.push.apple.com` ni
`googleapis.com`.

**Estado del worker: apagado por defecto** (`WALLET_V2_SYNC_ENABLED`
sin definir). El cron de GitHub Actions puede desplegarse sin riesgo —
responde 200 sin tocar la base ni la red hasta que se active
explícitamente (Etapa 12 en adelante, después del Gate 1).

## Etapa 9 — Diagnóstico por correlation_id (local, sin gate)

`supabase/migrations/0168_wallet_v2_diagnostico_correlacion.sql` — vista
`wallet_v2_diagnostico_sincronizacion`, solo `service_role` (mismo
patrón que `wallet_v2_reconciliacion_saldos`, 0159). Une, por
`correlation_id`/`pase_id`: el movimiento (`transacciones_puntos`), la
fila de sync (`wallet_sincronizaciones`, con su `estado` como el proxy
real de "APNs status" — no existe un código HTTP crudo guardado en
ningún lado), el pase (`update_tag`, `ultima_descarga_en` como el
"último .pkpass entregado"), y dispositivos (**solo** `count()` y
`max(created_at)` de `registros_dispositivo` — nunca `push_token`).

**Hallazgo real, no anticipado**: el camino normal (adaptador →
`ResultadoSync` → `marcarResultado`) ya sanitiza el error antes de
escribirlo (`motivoSeguro()`/`sanitizarMotivo()`), pero
`ejecutarCicloDeSincronizacion` tiene un `catch` para el caso de que un
adaptador lance una excepción sin atrapar, y ESE camino escribe
`e.message` crudo. La vista agrega su propia capa de saneo
(`regexp_replace`, mismo patrón que `motivoSeguro()`) como defensa en
profundidad — probado con una prueba que escribe un secreto simulado
directo en la tabla y confirma que la vista lo tapa mientras la tabla
cruda todavía lo tiene.

## Etapa 17 — Alertas (local, sin gate; sin enviar nada todavía)

`src/lib/wallet/sync/alertas.ts` — 9 funciones puras (nunca hacen red
ni abren conexión), más un agregador `evaluarAlertasWalletV2()`. Cubre
las 9 señales pedidas: jobs retryable acumulados (umbral 20), jobs
dead (umbral 1, sin cantidad "normal"), tasa de rechazo de APNs (20%
sobre una muestra mínima de 5, para no alertar con 1 de 1), Google
auth error (cualquier 401), certificado próximo a vencer (reusa
`validarApple()`, nunca reimplementa el parseo de PEM), secreto HMAC
faltante (solo alerta si YA hay pases con `auth_token_version >= 1`
dependiendo de él — su ausencia sola es un estado válido, ver Fase 2C),
registro Apple sin actividad (30 días sin registro ni descarga
confirmada), versión de pase divergente (`update_tag` vs. la versión
del último job exitoso), y payload de Google divergente (comparación
lista para cuando `pases_wallet.google_ultimo_payload_hash` — columna
que ya existe desde 0165 pero que ningún código escribe todavía — se
empiece a usar).

**No se conecta a ningún mecanismo de entrega en esta etapa** — el
repo ya tiene uno (`avisarAAdministradores()`, `src/lib/correo/
administradores.ts`, vía Resend) y el archivo documenta exactamente
cómo un futuro cron de alertas se conectaría, sin implementarlo.

## Verificación independiente (Etapas 9 y 17)

Igual que con el worker: no se le creyó al reporte del agente sin
correr los comandos yo mismo. Esta vez no hubo que corregir nada — dos
corridas seguidas de `npm run test:wallet-v2-local` dieron **8/8
archivos, 72/72 pruebas**, estable.

| Comando | Resultado |
|---|---|
| `npx supabase db reset` | exit 0 — aplica limpio hasta `0168` |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run` (suite normal) | exit 0 — 2153/2153 pruebas, 102 archivos |
| `npm run test:wallet-v2-local` | exit 0 — 72/72 pruebas, 8 archivos (2 corridas seguidas) |
| `npm run lint` | exit 0 — 4 warnings preexistentes, 0 nuevos |

Escaneo de secretos (mismo patrón que el resto de esta fase — JWT
reales excluyendo el demo local, bloques `BEGIN ... KEY`) sobre los 4
archivos nuevos: sin coincidencias.
