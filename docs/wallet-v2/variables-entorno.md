# Variables de entorno de Wallet — Fase 1

Fuente única de configuración para Apple Wallet y Google Wallet. Antes de
esta fase, `firma.ts` y `google.ts` leían `process.env` directamente y no
existía ninguna herramienta que validara el conjunto completo; el panel
de diagnóstico (`lealtad-secciones.tsx`) revisaba solo 3 de las 5
variables de Apple y ninguna de Google (auditoría de Fase 0, sección 6).

## La matriz

| Variable | Entorno | Obligatoria | Formato | Consumidores |
|---|---|---|---|---|
| `APPLE_PASS_CERT_B64` | Apple | Sí | Base64 → PEM | `src/lib/wallet/firma.ts`, `src/lib/wallet/config/apple.ts` |
| `APPLE_PASS_KEY_B64` | Apple | Sí | Base64 → PEM | `src/lib/wallet/firma.ts`, `src/lib/wallet/config/apple.ts` |
| `APPLE_WWDR_CERT_B64` | Apple | Sí | Base64 → PEM | `src/lib/wallet/firma.ts`, `src/lib/wallet/config/apple.ts` |
| `APPLE_PASS_TYPE_ID` | Apple | Sí | texto plano | `src/lib/wallet/firma.ts`, `src/lib/wallet/apns.ts` (como `apns-topic`) |
| `APPLE_TEAM_ID` | Apple | Sí | texto plano | `src/lib/wallet/firma.ts` |
| `GOOGLE_WALLET_ISSUER_ID` | Google | Sí | numérico | `src/lib/wallet/google.ts`, `src/lib/wallet/config/google.ts` |
| `GOOGLE_WALLET_SA_KEY_B64` | Google | Sí | Base64 → JSON | `src/lib/wallet/google.ts`, `src/lib/wallet/config/google.ts` |

No existe ninguna variable `APNS_*` separada: el push a Apple reutiliza
el mismo certificado del pase (mTLS), no una llave `.p8` independiente.
Confirmado por barrido exhaustivo de `process.env.*` en todo el repo
(`src/`, `scripts/`, `.github/`) — no hay más ocurrencias en ningún otro
lugar. `INVENTARIO_WALLET` en `src/lib/wallet/config/inventario.ts` es
la fuente de esta tabla en código: agregar una variable nueva se hace
ahí, no en un documento aparte que se desincronice.

## Los dos archivos de ejemplo, y por qué decían cosas distintas

- **`.env.example`** (versionado en git) no documentaba ninguna variable
  de Wallet. Ahora documenta las 7 reales, con su formato y una nota de
  qué corre `wallet:doctor` sobre ellas.
- **`.env.local.example`** (no versionado — cae bajo `.gitignore`, y
  probablemente era el archivo de trabajo personal de un desarrollador)
  documentaba nombres de una generación anterior del diseño de
  credenciales: `APPLE_PASS_CERT_P12_BASE64`, `APPLE_PASS_CERT_PASSWORD`,
  `APNS_KEY_P8_BASE64`, `APNS_KEY_ID`, `APNS_TEAM_ID`,
  `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` — ninguno de estos nombres existe
  en el código real. Ya se corrigió para reflejar los 7 nombres reales.

## El módulo de configuración (`src/lib/wallet/config/`)

- **`base64.ts`** — decodificador robusto. Detecta y reporta (sin
  "arreglar" en silencio): espacios/saltos de línea accidentales,
  retornos de carro de Windows, comillas envolventes, caracteres fuera
  del alfabeto Base64 (con la posición), truncamiento (longitud no
  múltiplo de 4), Base64 URL-safe vs. estándar, posible doble
  codificación, y si la re-codificación del resultado coincide con el
  valor normalizado. `=` y `==` de relleno se preservan siempre —
  nunca se recortan antes de decodificar. También valida la estructura
  de un PEM (pares BEGIN/END) y normaliza saltos de línea *literales*
  (`\n` de dos caracteres) solo cuando el valor no tiene ya saltos
  reales.
- **`apple.ts`** — validación profunda: certificado↔llave (compara el
  módulo RSA), certificado↔`APPLE_PASS_TYPE_ID` (compara contra el
  atributo UID del subject, OID `0.9.2342.19200300.100.1.1`, que es
  donde Apple graba el Pass Type ID — confirmado inspeccionando un
  certificado real, no supuesto), certificado↔`APPLE_TEAM_ID` (contra
  el atributo OU), cadena contra el WWDR provisto, vigencia (reusa
  `certificadoVigente` de `firma.ts` — no se duplica), y una firma de
  prueba que confirma que la mecánica no lanza. `hayCredencialesApple()`
  es la versión barata (solo presencia, sin decodificar) que usa el
  panel.
- **`google.ts`** — `validarGoogleOffline()` valida formato del Issuer
  ID y estructura del JSON de la cuenta de servicio (campos
  obligatorios, forma de PEM de la llave, forma de `client_email`).
  `validarGoogleRemoto()` hace una autenticación OAuth real y una
  lectura real (listar clases del Issuer, sin crear nada) para confirmar
  que la cuenta de servicio está autorizada como Developer — Google no
  expone un endpoint dedicado a esa pregunta, así que se infiere de un
  403 vs. 200 en una llamada de solo lectura.
- **`inventario.ts`** — la matriz de arriba, como dato.

`firma.ts` y `google.ts` ahora decodifican Base64 a través de
`diagnosticarBase64()` en vez de `Buffer.from` directo: si el valor no
decodifica limpio, `credencialesDelEntorno()`/`credencialesGoogleDelEntorno()`
siguen devolviendo `null` (mismo contrato de siempre — nunca lanzan),
pero ahora un `.env.local` mal pegado se detecta como "sin credenciales"
en vez de producir un PEM roto que falla tres capas más abajo con un
error críptico.

## `wallet:doctor`

```
npm run wallet:doctor -- --offline
npm run wallet:doctor -- --remote
```

`--offline`: formatos, certificado↔llave, certificado↔Pass Type ID,
certificado↔Team ID, cadena WWDR, vigencia, y que las rutas del Web
Service y las migraciones esperadas existan en el repo. Cero llamadas
de red, cero escritura — seguro de correr contra cualquier `.env.local`
en cualquier momento.

`--remote`: además, autenticación real contra Google + una lectura real
para confirmar autorización del Issuer, y una petición real a la URL
pública del Web Service de Apple (al endpoint sin autenticación de
"seriales modificados", que no registra ni modifica nada) para
confirmar que responde. Nunca crea, registra ni modifica ningún recurso
real de Apple o Google.

Nunca imprime un secreto: solo nombres de variables, presencia,
formato, longitudes y huellas SHA-256 truncadas a 12+8 caracteres.

## Reemplaza a

- El chequeo parcial de `lealtad-secciones.tsx` (ahora usa
  `hayCredencialesApple()`/`hayCredencialesGoogle()` — las mismas
  funciones que `wallet:doctor`, para que las dos superficies no puedan
  volver a decir cosas distintas).
- `tmp-diag-apns.mjs`, `tmp-verify-registros.mjs`, `tmp-wallet-zero.mjs`
  — scripts sueltos, no versionados, que uno de ellos abría una
  conexión mTLS real a `api.push.apple.com` con un push token
  hardcodeado. Se eliminaron: `wallet:doctor --remote` cubre esa
  necesidad de forma segura y repetible.

## Lo que esta fase NO hizo

No se tocó el esquema de base de datos, no se rotó ni regeneró ninguna
credencial, y no se resolvió la causa raíz encontrada en la Fase 0 (la
falta de reintento/outbox para el aviso de saldo individual) — eso es
FASE 3. Esta fase es estrictamente "saber con certeza si la
configuración está bien puesta", no "arreglar lo que la configuración
no explica".
