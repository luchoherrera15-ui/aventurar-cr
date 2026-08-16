# Auditoría inicial — Wallet (Apple + Google) de Bookea Lealtad

Síntesis de ocho auditorías de solo lectura (Fase 0) sobre el backend de Wallet: rutas y Web Service, generación/firma del `.pkpass`, APNs, Google Wallet, esquema de base de datos, variables de entorno, edge/cron/workers, y el recorrido completo de un sello. Ningún archivo de producción fue modificado durante estas auditorías. Ningún valor de secreto, certificado o llave aparece en este documento — solo nombres de variables, formato aparente y longitud.

---

## Resumen ejecutivo

**¿Qué tan sólido está el sistema hoy?** Bien construido en su núcleo — firma del pase, rutas de Apple, arquitectura de base de datos —, pero con un hueco real en la confiabilidad del aviso al teléfono cuando algo falla.

- Un sello acreditado en el mostrador **nunca se pierde**: el saldo vive en la base de datos y no depende de que el aviso a Apple/Google funcione.
- **El problema más grave**: si el aviso al teléfono falla, nadie se entera y nada lo reintenta solo — a diferencia de otras dos funciones del mismo sistema (avisos de pausa y de cambio de diseño), que sí tienen reintento automático. Esto explica el reclamo típico "el sello no aparece en mi tarjeta, pero en el mostrador sí está".
- **En Google específicamente** la base de datos marca el pase como "actualizado" en el mismo instante del sello, sin confirmar que el aviso a Google haya funcionado de verdad — el indicador que el panel usa para tranquilizar al negocio puede estar mintiendo justo cuando más se necesita.
- El panel de diagnóstico de credenciales de Apple puede mostrar "OK" con la configuración incompleta, y no existe ningún chequeo equivalente para Google: una falla total de configuración sería invisible hasta que un cliente se queje.
- Ya hubo dos incidentes reales en producción por un patrón de migraciones SQL mal armadas (columnas que terminaron sin crearse); el mismo patrón de riesgo sigue latente, sin incidente todavía, en dos migraciones más.
- **¿Algo urgente ahora mismo?** No hay brecha de seguridad activa ni pérdida de datos. Lo urgente es de cara al negocio: los reclamos de "no se actualiza mi tarjeta" van a seguir ocurriendo, y hoy no hay manera de diagnosticarlos ni de que el sistema se repare solo.

---

## 1. Rutas y Wallet Web Service

### Inventario

| Método | Ruta | Función | ¿Parte del contrato Apple? |
|---|---|---|---|
| `POST` | `/api/wallet/v1/devices/{deviceId}/registrations/{passTypeId}/{serial}` | Alta de dispositivo para push | Sí |
| `DELETE` | `/api/wallet/v1/devices/{deviceId}/registrations/{passTypeId}/{serial}` | Baja de dispositivo | Sí |
| `GET` | `/api/wallet/v1/devices/{deviceId}/registrations/{passTypeId}?passesUpdatedSince=` | Seriales cambiados para ese dispositivo | Sí |
| `GET` | `/api/wallet/v1/passes/{passTypeId}/{serial}` | Descarga del `.pkpass` más reciente | Sí |
| `POST` | `/api/wallet/v1/log` | Buzón de errores desde iOS | Sí |
| `GET` | `/api/pases/{ranchoId}` | Emisión inicial (botón "Agregar a Apple Wallet") | No — flujo de alta, no del Web Service |
| `GET` | `/api/pases-google/{ranchoId}` | Link firmado "Guardar en Google Wallet" | No aplica — Google no tiene protocolo dispositivo↔servidor |
| `GET` | `/api/lealtad/pases-en-pausa` | Cron interno de avisos masivos | No aplica — infraestructura interna |

Los cinco endpoints que exige Apple **están los cinco presentes** y bien mapeados.

### Confirmado mediante código

- Los cinco endpoints existen y coinciden 1:1 con el protocolo: `src/app/api/wallet/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts:24` (POST), `:74` (DELETE); `.../registrations/[passTypeId]/route.ts:21` (GET); `.../passes/[passTypeId]/[serial]/route.ts:39` (GET); `.../log/route.ts:18` (POST).
- `webServiceURL` se arma en `src/lib/wallet/generar.ts:352` como `${SITIO_URL}/api/wallet`; comparado contra las rutas reales, coincide exactamente con lo que Apple le agrega (`/v1/devices/...`) — **no hay duplicación `/v1/v1`**.
- `pass.webServiceURL` y `pass.authenticationToken` se escriben juntos o ninguno de los dos (`src/lib/wallet/tarjeta.ts:484-491`), como exige Apple.
- Registro (POST) y baja (DELETE) validan `Authorization: ApplePass <token>` vía `autenticarPase()` (`servicio.ts:56-93`), con comparación en tiempo constante (`igualSeguro`, `servicio.ts:31-41`) — `route.ts:27-30` y `:77-78`.
- La descarga (`GET /v1/passes/...`) exige la misma cabecera (`route.ts:45-46`).
- El registro **es idempotente**: `upsert(..., { onConflict: "device_library_id,serial_number" })` (`route.ts:51-59`) sobre la primary key real de `registros_dispositivo` (`0060_lealtad_wallet.sql:349`). Devuelve `201`/`200` según corresponda (`route.ts:44-49,71`).
- La ruta de "seriales modificados" **no exige** `Authorization` a propósito, tal como especifica Apple para esa llamada (`route.ts:11-16,21-67`); responde `204` sin novedades o `{serialNumbers, lastUpdated}` (`:40,53,60-66`) — sin cabeceras condicionales, porque esa mecánica pertenece al endpoint de descarga, no a este.
- `POST /v1/log` no valida nada y siempre responde `200` (`log/route.ts:18-31`), correcto según el contrato.
- **Ninguna de las cuatro rutas del Web Service depende de sesión de Bookea**: solo usan `createAdminClient()` y `autenticarPase`; la identidad la resuelve exclusivamente el `auth_token` del pase. Por contraste, `/api/pases/[ranchoId]` y `/api/pases-google/[ranchoId]` sí usan `cookies()`/`createClient()` — correcto, porque esas las navega el browser del cliente, no el protocolo de Apple.
- `registros_dispositivo` no tiene RLS ni `grant` (`0060_lealtad_wallet.sql:355-361`, "100% del servidor") — coherente con que las cuatro rutas corran con `createAdminClient()`.

### Confirmado mediante prueba

- `src/lib/wallet/servicio.test.ts` cubre `tokenDeCabecera()` (parseo de `Authorization: ApplePass <token>`) con variaciones de mayúsculas, espacios, esquemas ajenos y token faltante — la pieza de la que depende el `401` de las cuatro rutas autenticadas.
- No existe ningún `*.test.ts` bajo `src/app/api/wallet/**`, `src/app/api/pases/[ranchoId]` ni `src/app/api/pases-google/[ranchoId]`: la idempotencia del `upsert`, los códigos `200/201/204` y el flujo HTTP completo de cada endpoint no tienen prueba automatizada.

### Inferencia

- Las siete variables de entorno de Apple/Google están presentes en `.env.local` con el formato esperado — detalle completo y unificado en la **sección 6**; no se pudo confirmar el valor real en Vercel (fuera de alcance).
- `NEXT_PUBLIC_SITE_URL` no está definida en `.env.local` (cae al default `https://www.bookea.lat`); el comentario en `generar.ts:35-38` afirma que en Vercel sí está seteada, al ápex, pero eso no se pudo confirmar desde el repo.

### Problema encontrado

1. **`GET /v1/passes/{passTypeId}/{serial}` anuncia soporte de `If-Modified-Since` pero no lo implementa.** Pone `last-modified` en la respuesta (`route.ts:92`) pero nunca lee `If-Modified-Since` de la petición ni devuelve `304` en ningún punto del archivo. Cada consulta de un dispositivo redibuja imágenes, recalcula saldo y refirma con PKCS#7, incluso si nada cambió.
2. **Fragilidad en la normalización del host de `webServiceURL`.** El `replace` de `generar.ts:40-43` corrige `bookea.lat` → `www.bookea.lat` con un *lookahead* que no elimina una barra final. Si `NEXT_PUBLIC_SITE_URL` llegara a tener una barra final, el resultado sería `https://www.bookea.lat//api/wallet` (doble barra), horneado en cada `.pkpass` nuevo desde ese momento — silenciosamente, porque el iPhone acepta el pase igual y solo nunca completa el registro.
3. **Menor — condición de carrera cosmética en 200 vs 201.** El `select` que decide `yaEstaba` (`route.ts:44-49`) y el `upsert` (`:51-59`) son dos pasos separados; dos POST concurrentes para el mismo par podrían ambos devolver `201`. No hay duplicación de datos ni fallo funcional.

### Riesgo

- Punto 1: costo real de CPU/ancho de banda en cada refresco de pase, escalando con dispositivos activos, no con cambios reales. No es un riesgo de seguridad ni corrección, sí de eficiencia.
- Punto 2: si algún día `NEXT_PUBLIC_SITE_URL` queda mal configurada en Vercel, todos los pases emitidos desde ese momento quedan con `webServiceURL` roto — mudo, mismo síntoma que ya sufrió este archivo con el ápex sin `www`.
- Punto 3: sin impacto operacional — solo ruido en logs de auditoría.

### Corrección propuesta

1. Comparar `If-Modified-Since` contra `pases_wallet.actualizado_en` y devolver `304` sin cuerpo cuando no hubo cambios.
2. Normalizar `SITIO_URL` recortando cualquier barra final (`.replace(/\/+$/, "")`) antes de concatenar `/api/wallet`.
3. Baja prioridad: resolver el `select`+`upsert` como una sola operación o interpretar el resultado del propio `upsert`.

---

## 2. Generación y firma del .pkpass

### Confirmado mediante código

**Flujo completo, en orden:**

1. **Entrada pública** — `src/app/api/pases/[ranchoId]/route.ts:31-78`: identidad por cookie de persona o sesión Supabase (nunca por parámetro de URL, líneas 44-52), llama a `generarPaseDeLealtad` (54-58), responde `content-type: application/vnd.apple.pkpass` (73) y `content-disposition: attachment` (74).
2. **Entrada del Web Service** (refresco tras un push) — `.../wallet/v1/passes/[passTypeId]/[serial]/route.ts:39-96`: autentica (45), vuelve a llamar a `generarPaseDeLealtad` con la identidad del `miembro` dueño del pase (58-81), mismo MIME (89), y registra `ultima_descarga_en` **después** de responder, con `after()` (85; función en 22-34) — nunca bloquea la entrega.
3. **Generador** (`src/lib/wallet/generar.ts`): verifica credenciales (87-94), conexión admin (96-99), negocio (102-109) y programa (122-156); busca/afilia al miembro (176-231); saldo desde el ledger (245); próxima recompensa (249-260); resuelve serial/token (262-293, ver abajo); arma imágenes (295-313) y llama `construirPassJson` (328-353); llama `empaquetarPase` (357) dentro de un `try/catch` que traduce certificado vencido a un `motivo` en español (359-368).
4. **`pass.json`** (`src/lib/wallet/tarjeta.ts:418-507`): `passTypeIdentifier`/`teamIdentifier`/`serialNumber` (424-426); `webServiceURL` + `authenticationToken` juntos o ninguno (488-491).
5. **Empaquetado** (`src/lib/wallet/empaquetar.ts:14-53`): chequea vigencia del certificado ANTES de tocar nada (24-25), exige `pass.json` (27-29) e `icon.png` (32-34), construye `manifest.json` (36) y `signature` (37), zip plano sin carpetas (39-52).
6. **Firma** (`src/lib/wallet/firma.ts`): `credencialesDelEntorno()` (37-55) decodifica base64 → PEM (46); `construirManifest` (62-71) SHA-1 por archivo con `node-forge`; `firmarManifest` (81-110) PKCS#7 **detached** con certificado del pase + intermedio WWDR (91-92), `digestAlgorithm: sha256` (97); `certificadoVigente` (117-134) compara `ahora` contra `notBefore`/`notAfter`.
7. Registro de dispositivos y log — mismas rutas de la sección 1.
8. Push — `src/lib/wallet/apns.ts` (detalle en sección 3).

### Serial number y authentication token: SÍ son estables

`generar.ts:262-293` lee primero (`.maybeSingle()`, 266-271) y solo genera `randomUUID()`/`randomBytes(32)` (279, 281) en la rama de creación (273), nunca en regeneraciones posteriores. Respaldado por constraint real: `pases_wallet.serial_number text not null unique` (`0060:311`) y `unique(miembro_id, plataforma)` (`0060:320`). Mismo patrón línea por línea en `src/lib/wallet/google.ts:579-603`.

### El espejo del saldo y el push (por qué el sello nuevo SÍ llega, en el camino de citas)

`otorgarPuntos` (`src/lib/lealtad/motor.ts:121-168`, único lugar que hace `insert` en `transacciones_puntos`, línea 147) llama `refrescarPases` (49-110): actualiza `pases_wallet.saldo_cache`/`actualizado_en` de Apple (65-69) — el `.pkpass` real siempre se recalcula del ledger, esto es solo para el panel — y dispara `avisarCambioDePase` en `after()` (88-95). **Nota:** el camino del RPC de mostrador/escáner (el más usado) sigue un patrón distinto para el espejo de Google — ver la reconciliación en la sección 8/9.

### MIME, credenciales y certificado vencido

- MIME `application/vnd.apple.pkpass` confirmado en ambas rutas de entrada.
- Variables leídas por `credencialesDelEntorno()` (`firma.ts:38-42`): las cinco de Apple — inventario y formato completos en la **sección 6**. Si falta cualquiera, la función devuelve `null` (44) y `generar.ts:87-94` corta con `codigo: "sin_credenciales"` — sin excepción sin manejar.
- **Certificado vencido no falla en silencio**: `certificadoVigente` se evalúa antes de firmar (`empaquetar.ts:24-25`) y lanza un error con la fecha exacta; el `try/catch` de `generar.ts:356-368` lo traduce a una pantalla real, no un JSON crudo.

### Confirmado mediante prueba

- `firma.test.ts:74-125` — `certificadoVigente` con certificado vigente y con fecha adelantada (`vigente:false`, motivo con "venció").
- `firma.test.ts:163-168` — `empaquetarPase` con certificado vencido: `rejects.toThrow(/venció/)`, verificado que ocurre antes de producir archivos.
- `firma.test.ts:74-111` — firma PKCS#7 verificada con `openssl smime -verify` real, confirmada `detached`.
- `firma.test.ts:57-72` y `empaquetar.ts` (127-168) — SHA-1 del manifest, zip plano, manifest no autoincluido, falta de `icon.png` rechazada.
- **No hay prueba** que ejercite el camino de base de datos de `generar.ts:262-293` (leer-o-crear el serial/token contra Supabase real o mockeado); `cableado.test.ts` prueba `construirPassJson`/`tarjetaDesdeFila` con un serial fijo a mano, no la decisión de si ese serial es nuevo o reciclado.

### Inferencia

- El formato SHA-1/PKCS#7-SHA256 se toma del propio comentario del código y de que `openssl smime -verify` acepta la firma — no se contrastó contra documentación viva de Apple (fuera de alcance).
- `NEXT_PUBLIC_SITE_URL` no definida en `.env.local` — mismo hallazgo que sección 1.

### Problema encontrado

1. **La lectura del pase existente no filtra `activo = true`, contradiciendo el contrato documentado en la migración 0138.** `generar.ts:266-271` y `google.ts:579-584` no agregan `.eq("activo", true)`. La migración `0138_personas_identidad_raiz.sql:1197-1249` agregó la columna `activo` documentando explícitamente que quien busque "el pase de este miembro" debe filtrar por ella (comentario 1243-1246), y cambió el `unique(miembro_id, plataforma)` de tabla completa por un índice único **parcial** `where activo` (1240-1241) — precisamente para permitir filas heredadas `activo=false` tras una fusión de personas (1204). Si eso ocurriera, `.maybeSingle()` recibiría 2+ filas, devolvería `data: null`, el código entraría en la rama de creación e intentaría un `insert` que chocaría contra el índice parcial: `{ codigo:"error", motivo:"duplicate key..." }` — el cliente se queda sin poder (re)generar su pase. **Importante:** no existe hoy en `src/` ningún código que ejecute la fusión de personas descrita (columna `objeto_externo` sin uso en la aplicación) — es una bomba de tiempo, no un bug activo. Corroborado también por el reporte de esquema (sección 5) y por la observación independiente del recorrido completo (sección 8).
2. **Sin manejo de colisión al crear un pase por primera vez.** Dos pedidos casi simultáneos para un miembro sin pase (doble tap) pueden ambos pasar el `.maybeSingle()` con `null` e intentar `insert`; el segundo choca contra el `unique` y devuelve `{codigo:"error"}` en vez de releer la fila recién creada. No compromete el serial ya emitido, sí es una falla evitable de UX en el peor momento (mostrador).
3. **El segmento `passTypeId` de la URL del Web Service nunca se lee ni se valida.** `.../passes/[passTypeId]/[serial]/route.ts:39-43` tipa solo `serial`; `passTypeId` se ignora. No explotable hoy (el `auth_token` en tiempo constante protege el acceso), pero es un parámetro de la spec de Apple que queda sin validar.

### Riesgo

- Problema 1 (el más serio de esta sección): el día que se implemente la fusión de personas tal como el esquema ya la deja preparada, cualquier cliente fusionado con pase instalado se queda sin poder regenerarlo. El síntoma en logs ("duplicate key") confundiría el diagnóstico hacia certificados cuando el problema real es la falta del filtro `activo`.
- Problema 2: pérdida de conversión puntual, bajo impacto.
- Problema 3: bajo riesgo hoy; se volvería relevante solo si Bookea llegara a emitir pases bajo más de un Pass Type ID.

### Corrección propuesta

1. Agregar `.eq("activo", true)` en `generar.ts:266-271` y `google.ts:579-584`; considerar centralizar esta lectura en una función compartida (ya existe el patrón en `identidad.ts`) en vez de duplicar el fix.
2. Capturar el código `23505` (unique violation) en la rama de creación y releer la fila en vez de devolver error — mismo patrón que ya usa `motor.ts:155-161` para el ledger.
3. Validar `passTypeId` contra `credencialesDelEntorno()!.passTypeIdentifier` en la ruta del Web Service, devolviendo 401 si no coincide.

---

## 3. APNs

### Confirmado mediante código

- Envío por `node:http2` (no `fetch`) — `apns.ts:1`. Autenticación mTLS: `connect(HOST, { cert: cred.certificado, key: cred.llave })` (`apns.ts:46-49`), **no** JWT `.p8`.
- `cred.wwdr` y `cred.teamIdentifier` se cargan en `credencialesDelEntorno()` pero **`apns.ts` nunca los usa** — solo hoja y llave viajan en el handshake mTLS, a diferencia de `firma.ts:91-92`, donde el `.pkpass` sí lleva ambos certificados con una nota explícita del porqué. Sin nota equivalente en `apns.ts`.
- Headers (`apns.ts:99-117`): `apns-topic` = `passTypeIdentifier` (102, correcto — no bundle id); `apns-push-type: "background"` (105); `apns-priority: "5"` (106, correcto para background); `apns-expiration` = ahora + 6 horas (91, 115).
- Cuerpo: `peticion.end("{}")` (133) — sin diccionario `aps`, sin notificación visual, coincide con lo exigido para Wallet.
- **El push siempre se dispara después del commit, nunca antes ni en paralelo**: confirmado en los tres caminos que acreditan sello — RPC del mostrador (`escaner-actions.ts:172-206`, `lealtad-operar-actions.ts:106-137`) bajo `pg_advisory_xact_lock` transaccional (`0125_lealtad_operable.sql:316`), y el camino de citas (`motor.ts:147-166`) — el `after(() => avisarCambioDePase(...))` siempre viene después de `await` al RPC/insert y de revisar el resultado.
- Todos los llamadores usan `after()` de `next/server`, no `await` directo ni `void` suelto (documentado en el propio código: "un `void` suelto muere cuando Vercel congela la función al responder"). El request HTTP responde sin esperar APNs, pero no hay cola/outbox persistida — es un callback diferido dentro de la misma invocación serverless.
- **Manejo de errores por status**: `410` (token caducado) se junta en `caducados` (`apns.ts:67`) y el registro se borra de `registros_dispositivo` (`servicio.ts:264-266,206-208`). Cualquier otro status ≥300 se loguea con `console.warn` (status + cuerpo, `apns.ts:69-74`) pero **el registro no se borra** — reintentará indefinidamente en cada cambio de saldo. Fallos de conexión se capturan y devuelven `{ok:false, motivo}` (44-52, 76-77), logueados con `console.warn` (`servicio.ts:258-259,267-270`) y nunca propagados al llamador — el sello ya está acreditado.
- **No hay reintento propio con backoff**: la única "red de reintento" es la ventana de 6h de Apple, y solo para pushes que Apple sí aceptó (status 200). Si la conexión no se estableció, no hay reintento de ningún tipo.
- **No se captura `apns-id`** de la respuesta — `enviarUno` solo lee `HTTP2_HEADER_STATUS` (121-123).
- `POST /v1/log` recibe los errores que iOS reporta del lado del dispositivo y solo hace `console.warn` (`log/route.ts:18-31`) — único canal adicional de diagnóstico, no persistido.

### Confirmado mediante prueba

Ninguno. No existe `apns.test.ts`. `aviso-de-pausa.test.ts` y `aviso-de-diseno.test.ts` mockean el módulo entero (`vi.mock("./apns", ...)`); `servicio.test.ts` solo prueba `tokenDeCabecera`. Headers, cuerpo y manejo real de 410/400/403 no tienen prueba automatizada.

### Inferencia

- Que enviar solo la hoja (sin WWDR) funcione en producción es plausible (Apple ya conoce su propio intermedio), pero no está verificado ni documentado como decisión deliberada — a diferencia de `firma.ts:89-92`.
- El formato de `APPLE_PASS_TYPE_ID` (debería empezar con `pass.`) no se pudo verificar por valor; el código lo trata correctamente como topic.

### Problema encontrado

1. **Sin `apns-id` logueado** — imposible responder con precisión a soporte de Apple ante un patrón de fallos.
2. **Sin timeout explícito** en la conexión HTTP/2 ni en la petición individual; sin `maxDuration` declarado en las Server Actions que disparan el push. Si APNs no responde, el callback de `after()` puede morir cortado por el límite de plataforma sin dejar rastro.
3. **Sin verificación de vigencia del certificado antes del push** — `certificadoVigente()` solo se usa en la generación del `.pkpass` (`empaquetar.ts:24`), nunca en `apns.ts`. Un certificado vencido se manifiesta en el push como un fallo de handshake genérico, sin el mensaje claro que ya existe para el otro camino.
4. **Sin registro consultable de fallos de push** — todo termina en `console.warn`/`console.error`; el propio código admite que "nadie lo está mirando en el momento" (`servicio.ts:157`). El botón manual "Probar aviso" es el único lugar donde un humano ve el resultado real.
5. **Cobertura de pruebas nula** sobre el código que de verdad habla con Apple.

### Riesgo

- Certificado vencido o rechazo por certificado/topic (403): el fallo queda enterrado en logs que nadie revisa activamente en el camino automático — Wallet deja de actualizarse para TODOS los miembros sin ninguna alerta, hasta que un cliente reporte el síntoma.
- Sin `apns-id`, diagnosticar con soporte de Apple es más lento e impreciso.
- Sin timeout/`maxDuration`, una red degradada puede cortar el loop de avisos a mitad de camino para un miembro con varios dispositivos, sin log del corte.
- Tokens que fallan con 400/403 (no 410) permanecen indefinidamente reintentando — si el motivo real es un certificado/topic mal configurado (afecta a todos), esto amplifica reintentos inútiles sin que nada lo señale.

### Corrección propuesta

1. Leer y loguear `apns-id` de cada respuesta.
2. Agregar timeout explícito a la conexión y a cada request; considerar `maxDuration` explícito o mover el push a una ruta dedicada.
3. Reusar `certificadoVigente()` antes de empujar el push (o en un chequeo periódico aparte) para diferenciar "certificado vencido" de un fallo de red genérico.
4. Definir un canal de alerta real (no solo `console.warn`) para fallos sostenidos, por negocio/miembro.
5. Escribir `apns.test.ts` contra un servidor HTTP/2 de prueba local (no Apple real) para fijar el contrato de headers/cuerpo/status.
6. Confirmar de forma controlada (fuera de esta fase) si el WWDR debe viajar en el `connect()` de `apns.ts`, y documentar la decisión con el mismo nivel de detalle que `firma.ts:89-92`.

---

## 4. Google Wallet

**Archivo principal**: `src/lib/wallet/google.ts` (916 líneas).

### Confirmado mediante código

- Autenticación: cuenta de servicio desde `GOOGLE_WALLET_SA_KEY_B64` + `GOOGLE_WALLET_ISSUER_ID` (`google.ts:65-79`) — inventario completo en **sección 6**. Sin ambas, `credencialesGoogleDelEntorno()` devuelve `null` (verificado también por prueba, `google.test.ts:154-164`).
- JWT RS256 a mano con `node:crypto` (87-97), usado para el JWT-bearer de OAuth (107-116) y para el JWT `savetowallet` del link de alta (658-667).
- Token de acceso OAuth cacheado en variable de módulo, **solo se rellena en éxito** (101-132, línea 130) — en fallo no queda registro negativo.
- IDs deterministas sin tabla de mapeo: `idDeClase = "{issuerId}.negocio_{ranchoId}"`, `idDeObjeto = "{issuerId}.miembro_{miembroId}"` (139-145).
- **PATCH, no PUT/insert completo**: `asegurarRecurso` (427-447) hace `GET`; si 404, `POST` (crear); si existe, `PATCH` (443) — nunca `update` completo. El `GET` previo **no es un merge**, solo decide 404-vs-existe (432-439); el cuerpo del PATCH siempre se reconstruye desde cero.
- `textModulesData` se reconstruye completo a propósito (244-260, 348) — seguro porque esta función es la única dueña del array, y el parámetro `pausado` es tri-estado para poder borrar el módulo de pausa explícitamente.
- `messages[]` nunca se toca desde el refresco de saldo — solo lo escribe `enviarMensajeGoogle` vía `addMessage` (885-907), endpoint aparte del PATCH del objeto.
- **`heroImage` (banda del negocio) tiene un hueco real, autodocumentado por el propio código**: se agrega al PATCH solo `if (banda)` (349, con `banda = config.pase_banner_url ?? null`, 318). Si el dueño quita la banda, la clave se omite del PATCH y, como PATCH no toca lo que no se nombra, **el objeto de Google conserva la última banda para siempre** (comentario explícito en 314-317, sin resolver).
- `reviewStatus: "UNDER_REVIEW"` se manda siempre, incluso en updates de una clase ya aprobada (181) — verificado contra la documentación oficial: comportamiento correcto, no bug.
- `messageType: "TEXT_AND_NOTIFY"` (904) — verificado correcto contra la documentación (`TEXT` no notifica). El propio código deja constancia de que antes decía `"TEXT"`; el `git log` confirma el fix real: commit `014ef86` (15-ago-2026).
- `notifyPreference` no aparece en ningún lugar del código (grep sin resultados) — es un campo real de `LoyaltyObject` que permitiría notificar cambios de saldo sin `addMessage`; su ausencia es coherente con la intención declarada de que sellar no dispare push cada vez.
- **Manejo de 404**: en `asegurarRecurso`, dispara creación (433-439, correcto). En `refrescarPaseGoogleDeMiembro`, un 404 del PATCH se trata como "objeto huérfano" y no cuenta como fallo (811-814, 839-844) — no se reintenta. Mismo criterio en `enviarMensajeGoogle` (909-911).
- **Sin manejo diferenciado de 409, 429, 401 ni 403** en ningún punto — todo error ≥300 no-404 cae en el mismo `throw`/`console.warn` genérico (436, 441, 445, 814, 843, 910).
- **Sin timeout/`AbortController`** en ningún `fetch` de `llamarApi` (409-416) ni `tokenDeAcceso` (118-125).
- **Ventana de carrera (TOCTOU) en `asegurarRecurso`**: el `GET` y el `POST` no son atómicos (432-437). Dos altas casi simultáneas para el mismo negocio/miembro nuevo pueden ambas ver 404 e intentar `POST`; la perdedora recibe un error que el código trata igual que cualquier otro genérico, sin reintentar como PATCH.
- **La escritura del espejo `saldo_cache` (dentro de `google.ts`) solo ocurre si el PATCH entró** (`res.status < 300`, 831-837), con un comentario extenso (817-830) explicando por qué se revirtió el comportamiento anterior. **Esta garantía es real pero acotada al código de `google.ts` — no cubre el camino del RPC de mostrador/escáner, que escribe la misma columna por otra vía. Ver la reconciliación detallada en la sección 8 y la síntesis en la sección 9.**

### Confirmado mediante prueba

- `google.test.ts` cubre con pruebas reales: `idDeClase`/`idDeObjeto`, `firmarJwt` (firma verificable con llave pública, firma alterada detectada), `construirClase`/`construirObjeto` (forma del JSON, saldo, QR, meta de sellos, recorte al total, etiqueta por tipo), `credencialesGoogleDelEntorno` (variables faltantes, Base64 no-JSON, JSON válido).
- **Ninguna prueba ejercita la red real**: `llamarApi`, `tokenDeAcceso`, `asegurarRecurso`, `refrescarPaseGoogleDeMiembro`, `enviarMensajeGoogle` no tienen `fetch` mockeado (grep sin resultados de `fetch`/`nock`/`msw` en tests). `aviso-de-pausa.test.ts`/`aviso-de-diseno.test.ts` reemplazan `refrescarPaseGoogleDeMiembro` entero por `vi.fn()`.
- El bug histórico de `messageType: "TEXT"` no tenía ninguna prueba que lo detectara — la evidencia es el mensaje del commit corrector, no una prueba.

### Inferencia

- Que Google sincroniza los teléfonos automáticamente al hacer PATCH (sin push propio de nuestro lado) es la premisa de diseño del módulo (42-43), consistente con la documentación general pero no verificable desde este repo.
- El comportamiento exacto de Google al superar 10 mensajes en `messages[]` no se pudo confirmar (documentación no disponible); no hay manejo explícito en el código.
- El código HTTP exacto ante un `POST` de creación con `id` duplicado (¿409?) no se pudo confirmar contra documentación; la existencia de la ventana de carrera en sí sí es un hecho de código.

### Problema encontrado

1. **La banda (`heroImage`) removida por el dueño nunca se borra del pase de Android** — gap autodocumentado, no resuelto. Rompe la paridad con Apple, donde el `.pkpass` se regenera completo.
2. **Sin distinción de 401/403/409/429**: un error de credenciales revocadas, cuota agotada o conflicto de creación se ve igual en los logs.
3. **Ventana de carrera (TOCTOU)** en `asegurarRecurso`, sin manejo de la respuesta perdedora.
4. **Sin timeout en ningún `fetch`** hacia Google.
5. **La caché de token no recuerda fallos** — si la cuenta de servicio está rota, cada miembro de cada tanda repite el OAuth completo en vez de fallar rápido una sola vez.
6. **Sin cobertura de prueba de red** para auth, PATCH, 404, y el invariante "el espejo solo se escribe si el PATCH entró".
7. **(Reconciliado con sección 8)** El invariante del punto anterior, aunque correcto dentro de `google.ts`, no protege el camino del RPC de mostrador/escáner — ver detalle en secciones 8 y 9.

### Riesgo

- (1) Una imagen promocional vencida o incorrecta puede quedar mostrándose indefinidamente en el Android de un cliente después de que el dueño la quitó — justo la inconsistencia que el propio equipo ya trató de evitar con el patrón de `saldo_cache`.
- (2)+(5) Si el service account se revoca o vence, el síntoma es indistinguible de un error transitorio, y cada corrida del cron reintenta el OAuth completo por cada miembro — puede agotar cuota si el motivo original ya era 429.
- (3) Un negocio nuevo o un doble tap puede recibir una pantalla de error genérica en el momento de más fricción (el primer alta).
- (4) Una llamada colgada a Google puede reducir cuántas tandas procesa una corrida del cron de avisos, sin quedar registrado como "Google está lento".
- (6)+(7) Cualquier cambio futuro a `asegurarRecurso` o al invariante del espejo puede romperse en silencio; y hoy mismo el invariante ya tiene un hueco real en el camino más usado (ver sección 9).

### Corrección propuesta

1. Investigar un mecanismo de `heroImage` explícito/nulo (o `updateMask`) para poder limpiar la banda cuando se quita.
2. Separar 401/403 (credenciales rotas, cortar la corrida), 429 (backoff/circuit breaker), 409 en creación (releer y hacer PATCH).
3. `AbortController` con timeout (8-10s) en `llamarApi` y `tokenDeAcceso`.
4. Cachear también el fallo de `tokenDeAcceso` por una ventana corta.
5. Pruebas con `fetch` mockeado para `asegurarRecurso`, `refrescarPaseGoogleDeMiembro`, `enviarMensajeGoogle`.
6. Confirmar con Google el comportamiento al superar 10 mensajes.
7. Extender el invariante "el espejo solo se escribe si el PATCH entró" al camino del RPC — ver corrección propuesta en sección 9.

---

## 5. Esquema de base de datos

### Confirmado mediante código

**`programa_lealtad`**: `0060:25-35` (config por negocio). El `unique(rancho_id)` se elimina en `0134_cuentas_raiz_de_lealtad.sql:246`, pero `rancho_id` **sigue `not null`** — nunca se corrió el `drop not null` correspondiente (grep sin resultados). No es bug activo: un negocio "solo lealtad" se resuelve creando un `ranchos` oculto en `pendiente` (`src/lib/lealtad/alta-desde-solicitud.ts:78-129`), pero si algún día se implementa "cuenta sin rancho" (que `0134:78-89` deja como posible), chocará con este `not null`. Columnas agregadas después, todas con `add column if not exists` individual, en once migraciones distintas (0121 a 0152).

**`miembros`**: `0060:123-132`. `0138` agrega `persona_id` (350-351, 971-972), elimina el `unique(programa_id, cliente_id)` original (1038-1058) y lo reemplaza por `unique index (programa_id, persona_id)` (1060-1061) + `unique index parcial (programa_id, cliente_id) where cliente_id is not null` (1065-1066); `cliente_id` pasa a nullable con FK `on delete set null` (1071, 1078-1081) — borrar la cuenta ya no borra la membresía. RLS: select propia o del dueño, insert propio, update solo del negocio acotado a la columna `estado` (`0148:289-292`). **No existe policy de DELETE para nadie.**

**`pases_wallet`**: `0060:307-321` (`serial_number unique`, `unique(miembro_id, plataforma)`). `0138:1215-1241` agrega `activo` y `objeto_externo`, **elimina** el `unique(miembro_id, plataforma)` y lo reemplaza por índice único **parcial** `pases_wallet_vigente_idx ... where activo` — para tolerar filas históricas `activo=false` de una fusión de personas. Más columnas server-only en 0147, 0150, 0151. RLS: solo SELECT del propio pase; sin insert/update/delete para `authenticated` (coincide con "solo servidor").

**`registros_dispositivo`**: `0060:343-353`. PK compuesta `(device_library_id, serial_number)` — **many-to-many real**, coincide con el Apple PassKit Web Service (M:N genuino). RLS habilitada **sin ninguna policy ni grant** (355-360, "100% del servidor"), patrón repetido a propósito en `eventos_stripe` (`0143:106-110`). Verificado en uso real: `servicio.ts:191-207`, `aviso-de-pausa.ts:544-567`. Ninguna migración posterior la altera.

**`transacciones_puntos`** (ledger): `0060:166-189`, ampliada `0125:164-175` (`saldo_anterior`, `saldo_posterior`, `reversion_de`). RLS solo SELECT; **sin insert/update para nadie salvo `service_role`**.

**`recompensas`**: `0060:221-261`, ampliada `0125:89-117`. Policy pública original reemplazada por una que exige `activo`+vigencia+programa activo, con `grant select` por columna que excluye `sku`/`instrucciones` (`0148:379-443`).

**`canjes`** / **`intentos_canje`**: `0060:266-302`, `0125:185-203`, `0137_canje_seguro.sql` (`llave_idempotencia`). `intentos_canje` es tabla de auditoría separada para canjes rechazados, RLS solo SELECT del dueño.

**`personas` y familia** (`personas`, `personas_negocio`, `personas_duplicados`, `consentimientos_persona`, `sesiones_persona`) — todas de `0138_personas_identidad_raiz.sql`. `personas`: identidad raíz, `fusionada_en` (auto-referencia), RLS solo SELECT, sin insert/update/delete para nadie (todo vía RPC `security definer` o `service_role`). `sesiones_persona`: `revoke all` de `anon, authenticated` + `grant all` explícito a `service_role` (1698-1699) — 100% servidor, ni SELECT para el dueño de la sesión.

**Resto del módulo** (`solicitudes_lealtad`, `oferta_bienvenida`, `addons_negocio`, `consentimientos`, `ranchos.plan_lealtad`): ver detalle de migraciones en el reporte original; sin hallazgos adicionales relevantes a Wallet.

### El patrón de bug del "guard que solo revisa la primera columna"

**Incidente confirmado #1** — `0130_solicitud_de_alta.sql:17-65`: guard `if not exists (... column_name = 'negocio_nombre')` protegiendo 8 `add column` sin `if not exists` individual. `0154_completar_solicitudes_alta.sql:1-33` documenta el incidente real en producción (el bloque creció después de su primer despliegue; las 6 columnas nuevas nunca se aplicaron; error real: `Could not find the "meta_sellos" column`). Reparado dándole a cada columna su propio guard.

**Incidente confirmado #2 (variante)** — `0138:1275-1289` (sección 12, `clientes_negocio`): cada columna sí tenía `if not exists` propio, pero el bloque `do $$` entero era una transacción implícita — una sentencia fallida revertía TODO, incluida la columna sin motivo para fallar. `0153_completar_clientes_negocio_persona.sql:1-25` documenta el incidente real (`column "clientes_negocio.persona_id" does not exist`, reproducido en vivo).

**Riesgo latente, mismo patrón, sin incidente conocido todavía**: `0127_roles_de_colaboradores_lealtad.sql:27-51` (guard sobre `rol` protegiendo también `permisos_lealtad` + backfill) y `0129_negocios_de_lealtad_en_revision.sql:19-35` (guard sobre `lealtad_aprobado_en` protegiendo `lealtad_aprobado_por` + update). Ninguno de los dos ha sido "completado" por una migración posterior, lo que sugiere que no se les volvió a agregar columnas — pero la fragilidad estructural es idéntica a la de los dos incidentes ya ocurridos.

**Patrón seguro** (mayoría del módulo): 0125, 0132, 0135, 0136, 0137, 0141, 0145-0148, 0150-0152, 0154 — cada `add column` con su propio `if not exists`.

### Confirmado mediante prueba

Ninguna prueba automatizada verifica idempotencia de migraciones. La evidencia de los dos incidentes es la bitácora escrita por el propio equipo dentro de los comentarios de `0153`/`0154` (con el mensaje de error exacto de PostgREST) — no es una prueba automatizada, es un registro de incidente real. Los tests unitarios existentes (`aviso-de-pausa.test.ts`, `aviso-de-diseno.test.ts`, `cupo.test.ts`, `pausa.test.ts`) cubren lógica de aplicación sobre columnas ya creadas, no el comportamiento de la migración SQL en sí.

### Inferencia

- No se pudo confirmar si `0127`/`0129` ya sufrieron el mismo corte silencioso en la base de producción real — requeriría consultar `information_schema.columns` en vivo, fuera de alcance.
- El comportamiento de `service_role` (bypassa RLS) se apoya en la configuración de plataforma de Supabase, que no vive en estas migraciones — es la explicación estándar, marcada como inferencia por no ser código de este repo.
- No hay evidencia de degradación real por falta de limpieza por antigüedad en `registros_dispositivo` (solo tiene `created_at`, no "visto por última vez") — plausible pero no confirmado sin datos de producción.

### Problema encontrado

1. Bug de idempotencia confirmado y ya parcheado en `0130` (causó error real en producción).
2. Variante del mismo bug, confirmada y ya parcheada, en `0138` sección 12.
3. Riesgo latente sin incidente conocido en `0127` y `0129` — mismo guard-único-para-múltiples-columnas.
4. Tensión de diseño no activa: `programa_lealtad.rancho_id` sigue `not null` pese al objetivo declarado de permitir lealtad sin negocio en el marketplace.
5. Ausencias de policy (DELETE en `miembros`, INSERT/UPDATE en `canjes`/`transacciones_puntos` para `authenticated`) son intencionales y documentadas — se señalan solo porque un desarrollador nuevo podría malinterpretarlas como olvido.

### Riesgo

- Si se repite el patrón de `0130`/`0127`/`0129`: una migración editada después de su primer despliegue deja columnas sin crear en cualquier entorno donde el guard original ya esté satisfecho. El síntoma es un error de PostgREST en tiempo de ejecución (`Could not find the "X" column`), descubierto por un usuario en producción, no al desplegar. Para `0127` esto rompería el checklist de permisos de colaboradores de mostrador; para `0129`, la auditoría de quién aprobó un negocio para lealtad.
- Si el patrón afectara alguna vez a `pases_wallet` o `programa_lealtad` (hoy protegidas desde 0125 en adelante), el efecto sería pases de Wallet que no se generan o no se actualizan — el peor lugar posible para descubrirlo.

### Corrección propuesta

1. Reescribir `0127` y `0129` con el patrón de `0154`: cada `add column` con su propio `if not exists`, backfill protegido por su propio guard idempotente.
2. Agregar una migración "completar" nueva, no-op si el entorno ya está completo, para cerrar el riesgo sin apostar.
3. Documentar la convención (`docs/lealtad-arquitectura.md`) que prohíbe el guard único para múltiples `alter table`; opcionalmente un grep de CI que lo detecte.
4. Evaluar romper migraciones grandes en bloques pequeños desde el diseño (patrón ya adoptado desde 0146/0147/0150).
5. Documentar con `comment on table` (no solo en el comentario de la migración) que la ausencia de RLS/grants en `registros_dispositivo` es deliberada.

---

## 6. Variables de entorno

### Inventario unificado (las únicas 7 variables de Wallet que el código consume en todo el repo)

Confirmado por barrido exhaustivo de `process.env.*` en `src/`, `scripts/`, `.github/`, raíces del repo — sin más ocurrencias en `scripts/`, `.github/workflows/`, `vercel.json` ni `package.json`.

| Variable | Leída en | Presente en `.env.local` | Formato aparente | Longitud base64 | Longitud decodificada |
|---|---|---|---|---|---|
| `APPLE_PASS_CERT_B64` | `firma.ts:38` | sí | Base64 → PEM | 2992 | ~2244 bytes |
| `APPLE_PASS_KEY_B64` | `firma.ts:39` | sí | Base64 → PEM | 2316 | ~1736 bytes |
| `APPLE_WWDR_CERT_B64` | `firma.ts:40` | sí | Base64 → PEM | 2120 | ~1588 bytes |
| `APPLE_PASS_TYPE_ID` | `firma.ts:41` | sí | texto plano | — | 26 caracteres |
| `APPLE_TEAM_ID` | `firma.ts:42` | sí | alfanumérico corto | — | 10 caracteres |
| `GOOGLE_WALLET_ISSUER_ID` | `google.ts:66` | sí | numérico | — | 19 caracteres |
| `GOOGLE_WALLET_SA_KEY_B64` | `google.ts:67` | sí | Base64 → JSON de service account | 3144 | ~2357 caracteres |

*(Las dos longitudes por variable de certificado vienen de dos reportes distintos que midieron cosas complementarias — largo de la cadena Base64 y largo del contenido ya decodificado — y son aritméticamente consistentes entre sí: decodificado ≈ 0.75 × Base64. No hay contradicción real entre los reportes originales, solo unidades distintas, unificadas aquí.)*

`credencialesDelEntorno()` (Apple) exige las 5 a la vez (`firma.ts:44`); si falta cualquiera devuelve `null` y `generar.ts:87-94` corta con `codigo:"sin_credenciales"`. `credencialesGoogleDelEntorno()` exige las 2 a la vez (`google.ts:66-68`, verificado también por prueba). `apns.ts` reutiliza exactamente las credenciales de Apple — no existe ninguna variable `APNS_*` en el código; Apple Push no usa un token/llave `.p8` separado en esta implementación.

### Confirmado mediante código

- **El panel de diagnóstico da falsos positivos.** `src/app/lealtad/panel/[id]/lealtad-secciones.tsx:154-158` calcula `credencialesOk` chequeando solo 3 de las 5 variables de Apple (`APPLE_PASS_CERT_B64`, `APPLE_PASS_KEY_B64`, `APPLE_WWDR_CERT_B64`) — **no** verifica `APPLE_PASS_TYPE_ID` ni `APPLE_TEAM_ID`, aunque `firma.ts:44` sí las exige. Si esas dos faltan, el panel dice "OK" mientras ningún pase puede firmarse ni empujarse. Además, no hay ningún indicador equivalente para Google en ese componente (grep sin resultados).
- `.env.example` (versionado en git pese a que `.gitignore:34` matchea `.env*` — fue forzado al índice) **no documenta ninguna variable de Wallet**; solo Supabase, Resend, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, Stripe, `VISITAS_SALT`.
- `.env.local.example` (NO versionado, cae bajo `.gitignore:34`) documenta, en las líneas 18-29, nombres **distintos e incompatibles** con lo que el código lee hoy: `APPLE_PASS_CERT_P12_BASE64`, `APPLE_PASS_CERT_PASSWORD`, `APPLE_WWDR_CERT_BASE64`, `APNS_KEY_P8_BASE64`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` — ninguna de estas se lee en ningún lugar del código real. El comentario de `firma.ts:12-15` explica el origen: el diseño original usaba `.p12`+password y probablemente una llave APNs `.p8` independiente; el código migró a PEM+base64 con mTLS del mismo certificado del pase, pero este archivo de ejemplo (nunca versionado) se quedó con los nombres viejos.
- Existe un script suelto en la raíz del repo, `tmp-diag-apns.mjs` (ignorado por git vía `tmp-*.mjs`), que lee `.env.local` directamente y hace una conexión HTTP/2 mTLS real a `api.push.apple.com` con un push token hardcodeado — herramienta de diagnóstico manual, no parte del código de producción.

### Confirmado mediante prueba

`google.test.ts:148-168` manipula directamente `GOOGLE_WALLET_ISSUER_ID`/`GOOGLE_WALLET_SA_KEY_B64` para probar `credencialesGoogleDelEntorno()` — confirma por prueba automatizada los dos nombres exactos que usa Google Wallet. Para Apple, ningún test manipula las 5 variables ni confirma por prueba el bug del panel de diagnóstico (grep sin resultados en `firma.test.ts`/`cableado.test.ts`).

### Inferencia

- Es probable que las 7 variables reales estén también cargadas en Vercel producción, dado que `docs/lealtad-arquitectura.md:156-157` afirma "Apple Wallet ✅ en producción" / "Google Wallet ✅ en producción" — pero es la afirmación de un documento, no evidencia de código; el entorno real de Vercel no se pudo inspeccionar.
- `.env.local.example` parece un artefacto de trabajo personal de algún desarrollador (nunca subido a git) más que documentación oficial — inferido por su estado "untracked" combinado con nombres obsoletos.

### Problema encontrado

1. Panel de diagnóstico de Apple con falso positivo (3 de 5 variables chequeadas).
2. Panel sin ningún indicador para Google Wallet.
3. `.env.example` (el único template versionado) no documenta ninguna variable de Wallet.
4. `.env.local.example` documenta nombres de variables muertos/incompatibles con el código real.
5. Script suelto `tmp-diag-apns.mjs` en la raíz del repo con conexión mTLS real hardcodeada.

### Riesgo

- El punto 1 es el más serio de esta sección: alguien ve "Credenciales de Apple: OK", asume que Wallet funciona, y en realidad ningún pase puede emitirse ni actualizarse — se descubre solo cuando un cliente reporta el problema.
- El punto 2: un fallo de configuración de Google es completamente invisible en el panel.
- Los puntos 3 y 4 son el riesgo más directo de cara a una reconstrucción: quien se guíe por `.env.local.example` (que aparenta ser "la documentación de trabajo") programará contra nombres que el sistema real no usa.
- El punto 5: bajo impacto, pero si se ejecuta sin darse cuenta contra producción dispara un push real con un token hardcodeado probablemente inválido.

### Corrección propuesta

1. Extender `credencialesOk` a las 5 variables de Apple — o mejor, exportar desde `firma.ts` una función `credencialesConfiguradas(): boolean` reutilizada por el panel, para que los dos chequeos nunca se desincronicen.
2. Agregar al panel un indicador equivalente para Google, reutilizando `credencialesGoogleDelEntorno()`.
3. Actualizar `.env.example` con las 7 variables reales y su formato esperado, igual que ya se hace con Stripe.
4. Eliminar o corregir `.env.local.example` para reflejar los 7 nombres reales.
5. Mover `tmp-diag-apns.mjs` (y scripts similares `tmp-verify-registros.mjs`, `tmp-wallet-zero.mjs`) a `scripts/` o borrarlos antes de cualquier reconstrucción.

---

## 7. Edge Functions, cron y workers

### Confirmado mediante código

- **No existe `supabase/functions/`** en el repo — no hay Edge Functions relacionadas a Wallet/push/lealtad. Tampoco hay `pg_cron` en ninguna migración.
- **Único cron de Wallet/lealtad**: `.github/workflows/pases-en-pausa.yml:27-47` — cada 10 minutos (`cron: "*/10 * * * *"`) + `workflow_dispatch`, `curl GET .../api/lealtad/pases-en-pausa` con `Authorization: Bearer ${{ secrets.CRON_SECRET }}` (43-47), `concurrency: cancel-in-progress: false` (35-37, las corridas se encolan, no se pisan). El otro workflow (`recordatorio-horario.yml`) y los tres crons de `vercel.json` no tocan Wallet.
- `src/app/api/lealtad/pases-en-pausa/route.ts:57-66` ejecuta en paralelo (`Promise.all`) `sincronizarAvisoDePausa()` y `sincronizarAvisoDeDiseno()` — un solo disparador para dos mecanismos de barrido distintos, cada uno con su propia bandera + columna de error en `pases_wallet` (`pase_en_pausa`/`pausa_error` de `0147`; `diseno_pendiente`/`diseno_error` de `0150`).
- **Pausa y diseño SÍ implementan un patrón real de cola/outbox con reintento**: reclamo por `UPDATE` condicional antes de enviar (`aviso-de-pausa.ts:435-443`, `aviso-de-diseno.ts:275-283`), fallo vuelve a la bandera con motivo (`aviso-de-pausa.ts:500-523`, `aviso-de-diseno.ts:340-353`), la corrida siguiente reintenta automáticamente. `aviso-de-diseno.ts` reutiliza (no duplica) `entregarApple`/`leerPases`/`enGrupos` de `aviso-de-pausa.ts`.
- **El envío por CADA sello/canje individual NO pasa por ninguna cola**: se dispara inline vía `after()`, dentro del mismo request, sin persistencia. Tres puntos de entrada distintos llaman a `avisarCambioDePase` (`servicio.ts:104-134`): `escaner-actions.ts:206`, `lealtad-operar-actions.ts:137,323,373`, `motor.ts:88-95`. Si falla, solo `console.warn` (`servicio.ts:267-271`) — sin persistir "este pase quedó desincronizado", sin reintento posterior. Contrasta directamente con pausa/diseño.
- `/api/wallet/v1/log` (errores que Apple reporta desde el propio iPhone) tampoco persiste nada — solo `console.warn`; el propio comentario del archivo dice explícitamente que es "diagnóstico, no dato del negocio".
- **Triplicación de lógica**: tres caminos (`escaner-actions.ts`, `lealtad-operar-actions.ts`, `motor.ts`) repiten a mano el mismo par `after(avisarCambioDePase) + after(avisarSelloPorCorreo)`, en vez de una función compartida. El propio código documenta que esto ya produjo un bug real de paridad: el respaldo por correo faltaba en el camino del escáner hasta que se detectó (`escaner-actions.ts:208-214`).
- No hay ningún script en `scripts/` dedicado a diagnóstico de Wallet/APNs/Google — `scripts/limpiar-lealtad.mjs` es una utilidad de borrado para desarrollo, `scripts/estado-migraciones.mjs` solo lista si las migraciones están aplicadas.

### Confirmado mediante prueba

`aviso-de-pausa.test.ts` y `aviso-de-diseno.test.ts` (Vitest) mockean APNs y Google y verifican tandas, idempotencia, reanudabilidad y reintento — nunca contra red real (correcto para esta fase). **No hay ninguna prueba** que cubra el camino inline (`avisarCambioDePase` vía `after()`) bajo fallo de red.

### Inferencia

- Es probable, no verificado en runtime, que cuando `avisarCambioDePase` falla para un sello individual, el pase quede desactualizado hasta el próximo evento de negocio que dispare otro `after()` — sin mecanismo propio de reparación, salvo que el teléfono pregunte espontáneamente o Apple reintente un push ya aceptado dentro de su ventana de 6h (lo cual no cubre una conexión que ni siquiera llegó a establecerse).
- Es probable que el plan de Vercel sea "Hobby" (comentarios en `pases-en-pausa.yml:13-16` lo dan como motivo de usar GitHub Actions en vez de `vercel.json`), no confirmado desde el código.

### Problema encontrado

1. **Asimetría de resiliencia**: el envío por sello individual (el camino más frecuente) no tiene cola/outbox ni columna de error, mientras pausa y diseño sí.
2. Los errores que Apple reporta desde el teléfono se pierden en `console.warn` sin persistirse.
3. Triplicación de la lógica `after(avisar)+after(correo)` en tres archivos — ya causó un bug de paridad real.
4. `src/lib/cron-auth.ts:37` compara `CRON_SECRET` con `!==` (no timing-safe), a diferencia de `igualSeguro` (`servicio.ts:31-41`), que sí lo es para el token de Apple — inconsistencia de estándar interno en el mismo módulo. Ver también sección 11.

### Riesgo

- Si `avisarCambioDePase` falla de forma sistemática (certificado vencido, rotación mal hecha de la llave de Google), ningún pase se corrige solo hasta que el cliente fuerce un refresco (no garantizado por el sistema operativo) o alguien use manualmente "Probar aviso" en el panel. El negocio se entera por el cliente, no por el sistema.
- Un fallo prolongado sería indistinguible entre "un pase" y "todos los pases" fallando — no queda registro agregado, solo logs de Vercel de retención limitada.
- La triplicación de lógica aumenta la probabilidad de que un cuarto camino futuro repita el bug de paridad ya ocurrido.

### Corrección propuesta

1. Extender al camino de sello individual el mismo patrón de pausa/diseño: bandera + columna de error en `pases_wallet` (o una tabla de outbox genérica) que el cron existente (o uno nuevo) pueda reintentar.
2. Persistir lo que llega a `/api/wallet/v1/log` para poder alertar sobre fallos sistemáticos antes de que se acumulen reclamos.
3. Centralizar `after(avisarCambioDePase)+after(avisarSelloPorCorreo)` en una sola función compartida.
4. Unificar la comparación de `CRON_SECRET` a timing-safe, con el mismo criterio de `igualSeguro`.

---

## 8. El recorrido completo de "entregar sello → base de datos → Apple/Google → teléfono"

### Confirmado mediante código

**1. Punto de entrada.** Mostrador manual: `acreditarOperacion` (`lealtad-operar-actions.ts:93-163`, invocada desde `atencion-manual.tsx:141`). Escáner: `sumarSelloEscaneado` (`escaner-actions.ts:97-240`, invocada desde `escaner-panel.tsx:239`). Camino de citas (paralelo): `otorgarPuntos` (`motor.ts:121-168`).

**2. Qué escribe en la base.** Ambos caminos de mostrador delegan en el mismo RPC de Postgres: `db.rpc("acreditar_lealtad", …)` (`lealtad-operar-actions.ts:106-124`, `escaner-actions.ts:172-186`). El RPC (`0125_lealtad_operable.sql:288-413`) inserta en `transacciones_puntos` bajo `pg_advisory_xact_lock` (316, 385-405) — única fuente de verdad del saldo — y, **en la misma transacción**, actualiza el espejo: `update pases_wallet set saldo_cache = …, actualizado_en = now() where miembro_id = p_miembro_id` (407-409), **sin filtro de plataforma** — toca la fila de Apple y la de Google del mismo miembro por igual. Idéntico patrón en `canjear_recompensa` (529-531) y `revertir_movimiento` (591-593).

**3. Qué corre inmediatamente después, en el mismo request.** `after(() => avisarCambioDePase(miembroId))` (`lealtad-operar-actions.ts:137,323,373`; `escaner-actions.ts:206`), un segundo `after()` para el correo de respaldo, `revalidatePath` síncrono, y la función retorna `{ok:true,…}` al navegador.

**4. Dónde se llama a Apple/Google.** `avisarCambioDePase` (`servicio.ts:104-134`) lee los `pases_wallet` activos del miembro y bifurca: Apple vía `avisarSeriales` → `avisarPaseActualizado` (`apns.ts:36-83`, mTLS real a `api.push.apple.com`); Google vía `refrescarPaseGoogleDeMiembro` (`google.ts:726-850`, PATCH real a `walletobjects.googleapis.com`, 805-810).

**5. ¿Awaited o fire-and-forget?** Ninguna de las dos llamadas es `await`ed en el flujo de respuesta — van dentro de `after()`, que corre después de responder pero con ejecución garantizada por el runtime (`waitUntil`), a propósito para no frenar al empleado en el mostrador.

**6. Si falla el paso 4, ¿qué pasa con el sello?** Nunca se pierde ni queda ambiguo. El commit en `transacciones_puntos` ya ocurrió, síncrono, dentro del RPC, antes de intentar cualquier push. `avisarSeriales` y `refrescarPaseGoogleDeMiembro` atrapan cualquier excepción y solo hacen `console.warn` (`servicio.ts:267-271`, `google.ts:846-849`). **Nunca hay rollback del sello por un push fallido.**

**7. Rastro/auditoría en la base.** Existe una señal, pero agregada, no por-evento: `pases_wallet.actualizado_en` (lo bumpea el RPC, sin filtro de plataforma) vs `pases_wallet.ultima_descarga_en` (lo bumpea `GET /api/wallet/v1/passes/[passTypeId]/[serial]` **después** de servir el `.pkpass`, `route.ts:23-34,85`; migración `0151`). Comparados en `marketing-actions.ts:157-162` (`confirmadoEnTelefono`, **solo Apple**; para Google es explícitamente `null`, "sin mecanismo posible de confirmación", 158-159). Esto responde "¿el pase de este cliente está al día ahora?" pero **no** "¿a este sello (esta fila de `transacciones_puntos`) le llegó el push y le llegó bien?" — no hay `correlation_id` ni tabla de intentos de push; el único rastro por-intento es `console.warn`, efímero y no consultable desde la base.

### Nota de reconciliación entre reportes (Google)

El reporte de Google Wallet (sección 4) documenta, correctamente, que `google.ts:817-837` protege el espejo `saldo_cache` para que **solo se escriba si el PATCH a Google realmente entró** — y calificó esto como "correcto y verificado". Es cierto **dentro del código de `google.ts`**. Pero el recorrido completo del sello (este apartado) muestra que ese código de protección **no es el que corre en el camino más usado**: el RPC de mostrador/escáner/canje/reversión (`0125:407-409, 529-531, 591-593`) escribe `pases_wallet.saldo_cache`/`actualizado_en` de la fila de Google de forma **incondicional**, como parte del mismo commit del sello, sin esperar ni saber si el PATCH a Google después tuvo éxito. La protección de `google.ts` solo alcanza al camino de `motor.ts` (citas), que sí llama a `refrescarPaseGoogleDeMiembro` como parte del mismo flujo que escribe el espejo. **Conclusión reconciliada: el invariante "el espejo solo se escribe si el PATCH entró" es verdadero como código, pero falso como garantía del sistema** — el camino que más se usa en la práctica (mostrador y escáner) lo evade por completo, porque escribe el espejo directamente en SQL antes de que exista cualquier intento de PATCH.

### Confirmado mediante prueba

Ninguna prueba automatizada cubre el camino específico "`acreditar_lealtad` → `avisarCambioDePase` → push". `servicio.test.ts` solo prueba el parseo de la cabecera `Authorization`. `cableado.test.ts`, `google.test.ts`, `tarjeta.test.ts` prueban el contenido del pase (fila → pass.json/LoyaltyObject), no la entrega. Hay cobertura mockeada de los primitivos de push (`avisarPaseActualizado`, `refrescarPaseGoogleDeMiembro`) en `aviso-de-pausa.test.ts`, pero es para el barrido de pausa, no para el flujo de sellos.

### Inferencia

- Que iOS difiera o descarte la entrega del push en Low Power Mode o con actualización en segundo plano desactivada es comportamiento documentado de Apple, coherente con `apns-push-type: background` + `apns-priority: 5` (`apns.ts:103-115`) — no verificable desde este repo.
- Es posible que `.maybeSingle()` en la búsqueda del pase existente (`generar.ts:266-271`, `google.ts:579-584`, sin `.eq("activo", true)`) falle con "multiple rows" ante una fusión de personas — no confirmado como incidente real, ver también sección 2.

### Problema encontrado

1. **Sin reconciliación por lotes para saldo/sello**, a diferencia de pausa y diseño. El módulo ya tiene el patrón resuelto y probado (`sincronizarAvisoDePausa`/`sincronizarAvisoDeDiseno`, cada 10 min); para saldo/sello no existe ningún cron equivalente — el único intento de push es el `after()` disparado en el instante del sello.
2. **Inconsistencia real en el espejo de Google** (ver nota de reconciliación arriba): las tres RPC escriben el espejo de Google incondicionalmente, contradiciendo el invariante que `google.ts` documenta y protege — protección que solo aplica al camino de citas, no al camino de mostrador/escáner/canje/reversión, que es el que más se usa.

### Riesgo

- Clientes reportan "el sello no aparece" con el saldo ya correcto en la base y en el mostrador — erosiona confianza en el programa, sin forma de comprobar, sello por sello, si el push salió.
- Sin cron de reconciliación, un push de saldo perdido solo se resuelve por otro sello futuro, el poll periódico de iOS (fuera de control), o reinstalar el pase — exactamente el síntoma reportado.
- El bug de Google puede hacer que el equipo confíe en una señal ("actualizado") que no refleja el estado real del teléfono del cliente.

### Corrección propuesta

1. Agregar un cron de reconciliación de saldo/sello calcado de `aviso-de-pausa.ts`: barrer `pases_wallet` (Apple) donde `actualizado_en > ultima_descarga_en` hace más de N minutos y reintentar; para Google, reintentar `refrescarPaseGoogleDeMiembro` sobre pases con `actualizado_en` reciente sin confirmación equivalente.
2. En las tres RPC de `0125`, acotar el `update pases_wallet` a `plataforma = 'apple'` — el reflejo de Google debe quedar exclusivamente a cargo de `refrescarPaseGoogleDeMiembro`, que sí sabe cuándo el PATCH entró — o, si no se quiere tocar SQL todavía, dejar de usar `saldo_cache`/`actualizado_en` de Google como señal de confianza en el panel.
3. Persistir un rastro mínimo por intento de push (tabla o columnas: último status HTTP de APNs/Google y cuándo) para poder responder con precisión "¿a este sello le llegó?".
4. Añadir `.eq("activo", true)` a la búsqueda del pase existente (ya cubierto en sección 2, corrección 1).

### Conclusión sobre las hipótesis descartadas

Para llegar a las secciones 8 y 9 se evaluaron cinco hipótesis sobre por qué un pase no se actualiza solo: (a) serial/token inestables — **descartada por código** (identidad estable, reusada en cada regeneración). (b) el push nunca se dispara de verdad — **descartada por código** (wiring real desde la UI del mostrador hasta `after()`). (c) el push apunta a token/serial equivocado — **descartada por código** (cruce consistente por `serial_number` estable). (d) `actualizado_en` no se bumpea — **descartada por código** (las tres RPC lo bumpean sin filtro de plataforma). (e) es solo la demora/no-garantía documentada de Apple para push de baja prioridad — **parcialmente confirmada**: la configuración del código es coherente con esa limitación real, pero el hallazgo nuevo de esta auditoría es que **no hay ningún mecanismo de reconciliación que compense esa no-garantía** para el saldo (sí lo hay para pausa y diseño) — eso, más que la demora de Apple en sí, es la pieza corregible. Desarrollo completo en la sección 9.

---

## 9. Dónde se rompe la trazabilidad

El dueño del producto pidió el punto exacto en el que la información deja de poder seguirse en el recorrido "entregar sello → base de datos → Apple/Google → teléfono", y por qué un pase instalado a veces no se actualiza solo.

**El punto exacto es este:** entre el `after(() => avisarCambioDePase(miembroId))` que se agenda al final del RPC de acreditación (`lealtad-operar-actions.ts:137`, `escaner-actions.ts:206`, `motor.ts:88-95`) y el resultado real de la llamada a Apple/Google dentro de ese callback. Antes de ese punto, todo es trazable con precisión: el commit en `transacciones_puntos` es síncrono, transaccional, bajo `pg_advisory_xact_lock` (`0125:316`), y el propio RPC bumpea `pases_wallet.actualizado_en` en la misma transacción (`0125:407-409`). Después de ese punto, la única forma de saber qué pasó es un `console.warn` en los logs de Vercel (`servicio.ts:250-252,258-259,267-271`; `apns.ts:69-74`; `google.ts:814,843,847-849`) — efímero, no indexado por sello, no consultable desde la base de datos, y sin `apns-id` ni ningún identificador que permita correlacionar ese intento con la fila de `transacciones_puntos` que lo originó.

Tres factores de código, combinados, explican por qué el síntoma es intermitente y no un fallo total:

1. **No hay reintento propio, en ningún nivel, para este camino específico.** Si `avisarPaseActualizado`/`refrescarPaseGoogleDeMiembro` fallan (red caída, certificado por vencer, cuota de Google agotada, un teléfono con "actualización en segundo plano" desactivado sin siquiera llegar a establecer conexión), el error se atrapa y se descarta (`servicio.ts:267-271`, `google.ts:846-849`). El **único** mecanismo de reintento que existe en todo el sistema para este tipo de aviso es el que ya usan pausa y diseño (`aviso-de-pausa.ts`, `aviso-de-diseno.ts`, cron cada 10 min) — y ninguno de los dos cubre saldo/sello (confirmado por grep: ningún import de `avisarCambioDePase`/`avisarPaseActualizado` fuera de sus propios archivos y de `servicio.ts`/`motor.ts`/los tres puntos de acreditación). La ventana de reintento de 6 horas de Apple (`apns.ts:91,115`) solo protege pushes que **ya fueron aceptados** por APNs (status 200) — no cubre una conexión que nunca se estableció.
2. **El espejo `saldo_cache`/`actualizado_en` se escribe de forma optimista, antes de saber si el aviso funcionó — y para Google, incondicionalmente.** La reconciliación de la sección 8 lo muestra en detalle: `google.ts:817-837` protege ese invariante dentro de su propio código, pero el camino que de verdad se usa en el mostrador y el escáner (`0125:407-409, 529-531, 591-593`) escribe la misma columna directamente en SQL, en la misma transacción que el sello, sin ningún vínculo con el resultado real del PATCH que ocurre milisegundos después en otra llamada de red completamente separada. Esto significa que **la base de datos no tiene ninguna columna que diga la verdad sobre si el teléfono de Android recibió el cambio** — `actualizado_en` avanza pase lo que pase con Google.
3. **La única señal de confirmación real que existe (`ultima_descarga_en`) depende de que el propio dispositivo pida el pase — y solo existe para Apple.** `route.ts:85` (`.../wallet/v1/passes/.../`) la bumpea cuando el iPhone efectivamente descarga el `.pkpass` actualizado, pero eso ocurre en una request HTTP totalmente distinta, minutos u horas después del push original, sin ningún campo que la conecte con el sello específico que la disparó — solo permite responder "¿está al día *ahora*?", nunca "¿le llegó *esta* actualización?". Para Google, `marketing-actions.ts:158-159` es explícito: esa columna es `null` a propósito, "sin mecanismo posible de confirmación" — no hay ningún equivalente en el lado de Android.

**Por qué el síntoma es "a veces" y no "siempre":** la mayoría de los pushes sí llegan — la arquitectura del envío (headers, mTLS, PATCH correcto, todo confirmado en las secciones 2-4) es sólida y el commit del sello nunca depende de ella. El "a veces no se actualiza solo" ocurre en la intersección de dos eventos de baja probabilidad individual pero garantizados a largo plazo: (a) el intento de push/PATCH de ese sello específico falla (red, certificado, cuota, o el dispositivo simplemente no proceso un push en segundo plano de baja prioridad, que Apple explícitamente no garantiza), y (b) no hay ningún sello ni evento posterior que vuelva a disparar `avisarCambioDePase` para ese miembro en un tiempo razonable. Cuando (a) y (b) coinciden, el pase queda desactualizado de forma permanente hasta que el cliente lo fuerce manualmente (abrir la app Wallet, o reinstalar) o el negocio use "Probar aviso" — ningún proceso automático del sistema lo va a notar ni corregir, porque, como se documenta en la sección 3, "nadie lo está mirando en el momento" (`servicio.ts:157`).

---

## 10. Qué se puede conservar vs. qué hay que reconstruir

| Pieza | Veredicto | Por qué |
|---|---|---|
| Rutas del Web Service de Apple (5 endpoints) | **Conservar** | Los cinco existen, mapean 1:1 al contrato de Apple, autenticación en tiempo constante, registro idempotente con constraint real detrás. Gaps menores (sin `304`, `passTypeId` sin validar) son parches puntuales, no rediseño. |
| Generación y firma del `.pkpass` (`tarjeta.ts`, `empaquetar.ts`, `firma.ts`) | **Conservar** | PKCS#7 detached verificado con `openssl` real, SHA-1 de manifest correcto, certificado vencido manejado con mensaje claro antes de firmar, buena cobertura de prueba. |
| Patrón serial/token estable (leer-antes-de-crear) | **Reconstruir parcialmente** | El diseño es correcto (constraint de base de respaldo), pero falta el filtro `activo=true` que el propio esquema exige documentalmente (bomba de tiempo para fusión de personas) y manejo de colisión en creación concurrente. |
| Adaptador APNs (`apns.ts`) | **Reconstruir parcialmente** | mTLS y headers correctos, pero sin timeout, sin `apns-id` logueado, sin verificación de vigencia de certificado en el propio camino de push, sin ninguna prueba automatizada, y el uso del WWDR en el handshake no está documentado como decisión. |
| Adaptador Google Wallet (`google.ts`) | **Reconstruir parcialmente** | Núcleo (PATCH vs POST, `textModulesData`, `messages[]`, `reviewStatus`, `messageType`) correcto y bien probado. Pero: bug real y sin resolver de `heroImage` pegado, sin diferenciación de errores HTTP, sin timeout, ventana de carrera en creación, caché de token que no recuerda fallos. |
| Resiliencia del aviso por sello individual (`avisarCambioDePase` vía `after()`) | **Reconstruir** | Es la pieza central del problema descrito en la sección 9: sin cola, sin reintento, sin persistencia de fallo, sin correlación con el sello que lo originó. Es la asimetría más seria de todo el módulo frente a pausa/diseño, que sí funcionan bien. |
| Cola de avisos de pausa y de diseño (`aviso-de-pausa.ts`, `aviso-de-diseno.ts` + cron) | **Conservar** | Patrón de outbox real con reclamo atómico, columna de error, reintento automático cada 10 min, y buena cobertura de prueba. Es el modelo a copiar para el aviso de saldo/sello. |
| Invariante "el espejo de Google solo se escribe si el PATCH entró" | **Reconstruir** | Correcto como código dentro de `google.ts`, pero evadido por las tres RPC de `0125` en el camino más usado (mostrador/escáner/canje/reversión) — ver secciones 8 y 9. Hoy es una garantía falsa en la práctica. |
| Esquema de base de datos (tablas, RLS, constraints) | **Conservar** | Modelado correcto (M:N real en `registros_dispositivo`, índices únicos parciales bien pensados para fusión de personas, RLS coherente con "solo servidor" donde corresponde). |
| Migraciones `0127` y `0129` (patrón de guard único) | **Reconstruir parcialmente** | Mismo patrón que ya causó dos incidentes reales en producción (`0130`, `0138` sección 12); estas dos no han fallado todavía solo porque nadie les agregó columnas después — el riesgo estructural es idéntico. |
| Variables de entorno y su documentación | **Reconstruir** | Las 7 variables reales están bien y son consistentes con lo que el código lee; el problema es la documentación y el diagnóstico alrededor: panel con falso positivo, `.env.example` sin las variables, `.env.local.example` con nombres muertos. |
| Cobertura de pruebas de la capa de red (rutas HTTP, `apns.ts`, `fetch` de `google.ts`) | **Reconstruir** | Existe para el contenido de los pases y para los primitivos mockeados de pausa/diseño, pero no para nada que hable de verdad con Apple/Google/el propio Web Service — es la zona de mayor riesgo de regresión silenciosa. |

---

## 11. Riesgos de seguridad detectados

Sin nombrar ni exponer ningún valor de secreto — solo nombres de variables e inconsistencias de diseño.

1. **Comparación no timing-safe de `CRON_SECRET`.** `src/lib/cron-auth.ts:37` usa `!==` para comparar el secreto del cron, mientras que el mismo módulo usa `igualSeguro` (comparación en tiempo constante, `servicio.ts:31-41`) para el `auth_token` de los pases de Apple. Inconsistencia de estándar interno dentro del mismo módulo — explotabilidad práctica baja, pero es exactamente la clase de detalle que un ataque de temporización remoto podría aprovechar sobre un secreto de infraestructura.
2. **El `passTypeId` de la URL del Web Service de Apple nunca se valida contra el `passTypeIdentifier` real** (`.../wallet/v1/passes/[passTypeId]/[serial]/route.ts:39-43`). Mitigado hoy por el `auth_token` en tiempo constante, pero es un parámetro de la especificación de Apple sin verificar — quedaría expuesto si algún día se emitieran pases bajo más de un Pass Type ID.
3. **`.env.local.example` (archivo no versionado) documenta nombres de variables de un diseño de credenciales obsoleto** (certificado `.p12` con password, llave APNs `.p8` separada) que ya no corresponden a las variables reales que el código lee (PEM en base64 + mTLS con el mismo certificado del pase). Riesgo de que una reconstrucción futura programe, de buena fe, contra nombres de variables que no existen en el sistema real.
4. **`.env.example` (el único template de variables versionado en git) no documenta ninguna de las 7 variables de Wallet.** Un desarrollador nuevo no tiene forma, siguiendo la documentación oficial del repo, de saber que estas variables existen ni qué formato esperan.
5. **El panel de diagnóstico de credenciales de Apple puede reportar "OK" con la configuración incompleta** (`lealtad-secciones.tsx:154-158`, verifica 3 de 5 variables). No expone ningún secreto, pero es un falso positivo operacional sobre el estado de la configuración de credenciales — la clase de señal que, si existiera para todo, ayudaría a detectar antes una rotación de credenciales mal hecha.
6. **Script `tmp-diag-apns.mjs`, suelto en la raíz del repo (ignorado por git), lee `.env.local` y abre una conexión mTLS real contra `api.push.apple.com`** con un push token hardcodeado dentro del propio script. No es parte del código de producción y no viaja en el repositorio, pero conviene retirarlo o moverlo a `scripts/` con un guard explícito antes de cualquier reconstrucción, para reducir la superficie de herramientas ad-hoc que tocan credenciales reales.
7. **El handshake mTLS hacia APNs (`apns.ts:46-49`) no envía el certificado intermedio WWDR**, a diferencia de la firma del `.pkpass` (`firma.ts:91-92`), que sí lo incluye con una justificación explícita en el código. No hay evidencia de que esto sea un problema real (es plausible que Apple ya confíe en su propio intermedio), pero es una asimetría de la cadena de confianza TLS sin documentar como decisión deliberada — vale la pena confirmarla y dejar constancia, en vez de que quede como una omisión silenciosa.

No se encontró, en ninguno de los ocho reportes, evidencia de una llave o secreto expuesto en código, logs, o archivos versionados — los siete valores reales viven únicamente en `.env.local` (no versionado) y, según lo que el propio equipo documenta, en las variables de entorno de Vercel (no verificable desde este repo).
