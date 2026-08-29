# Auditoría de seguridad — 29 ago 2026

> Pedido del dueño: «revisá todo el tema de seguridad e intentá hackearla vos
> mismo». Esto es el resultado. Me hice pasar por un atacante con lo único que
> un atacante tiene de verdad: **la `anon key`, que viaja pública en el bundle
> del cliente** (eso es por diseño de Supabase — la seguridad NO depende de
> ocultarla, depende de RLS, grants y checks de autorización).
>
> Método: (1) ataque EN VIVO contra la base de producción con la anon key
> (solo lecturas + una escritura auto-contenida que borré); (2) auditoría
> estática del código con verificación adversarial. **No se dejó ningún dato de
> prueba en la base.**
>
> **La respuesta corta: sí, pude entrar.** La mayor parte del sitio está bien
> cerrada (las tablas privadas —perfiles, mensajes, solicitudes, agentes,
> cobros— dan `permission denied` al anónimo, y el atajo del proxy es correcto).
> Pero hay **hoyos reales**, varios confirmados en vivo. Van por severidad.

## Leyenda

- 🔴 **CRÍTICA / ALTA** · explotable, impacto serio
- 🟠 **MEDIA** · explotable con condiciones o impacto acotado
- 🟡 **BAJA** · defensa en profundidad / fuga menor
- ✅ **confirmado EN VIVO** (lo hice con la anon key) · 🧪 confirmado por análisis del esquema

---

## 🔴 1. Un anónimo puede escribir las columnas de plata de `reservas` y secuestrar reservas ajenas 🧪

**Dónde:** `supabase/migrations/0109_scheduling_y_crm.sql:174` + el grant de tabla de `0025:21`.

**El ataque:** la policy de UPDATE para `anon` sobre `reservas` solo revisa el
`estado` (`temporal`→`pendiente`) en su `WITH CHECK`, pero el grant es de tabla
completa (`grant ... update on reservas to anon`). En Postgres el `WITH CHECK`
**no limita columnas** — eso solo lo hace un grant por columna, que acá no
existe. Los holds se crean con `estado='temporal'` y `tipo_reserva=null`, justo
la rama que la policy deja pasar. Con la anon key:

1. `GET /rest/v1/reservas?estado=eq.temporal&select=id` → lista holds vivos de cualquiera (la policy de SELECT tampoco ata la fila al creador).
2. `PATCH /rest/v1/reservas?id=eq.<id>` con `{"deposito_validado":true,"evento_pagado":true,"monto_total":0,"estado":"pendiente"}` → **escribe**.

**Impacto:** (a) marcar el propio depósito como validado **sin pagar**
(`deposito_validado` alimenta el libro económico del dueño); (b) pisar/corromper
el hold en curso de otra persona; (c) crear reservas `pendiente` en masa por la
API saltándose el antibot, que solo vive en la server action, no en la base.

**Arreglo (migración):** borrar la policy de UPDATE de `anon` (la finalización
real va por la RPC `completar_reserva_temporal`, que es `security definer` y
salta RLS) y `revoke update on reservas from anon`. Acotar el INSERT de anon a
`estado='temporal'` únicamente.

---

## 🔴 2. El monto y la comisión de la reserva los pone el cliente (mass assignment) 🧪

**Dónde:** `src/app/eventos/reserva-actions.ts:256` (y el descuento en `:279`).

**El ataque:** la server action de reservar toma el `monto_total` / base de
comisión desde el payload del cliente sin recalcularlo contra el precio de la
base. Un cliente puede mandar el monto que quiera (incluido lo que Bookea
devenga de comisión). El descuento (`:279`) es 100% del cliente: se ignora la
validación de `redimir_codigo_descuento`.

**Regla del repo que esto viola:** «el precio del pedido lo pone la BASE, no
TypeScript» ([[roles-y-precio-en-la-base]]).

**Arreglo:** recalcular monto, base de comisión y descuento **en el servidor**
desde el precio del negocio y el código validado; nunca confiar en el número del
cliente.

---

## 🔴 3. Cualquier usuario autenticado puede borrar/sobrescribir las fotos de CUALQUIER negocio 🧪

**Dónde:** `supabase/migrations/0011_...sql:148-158` (bucket `ranchos-fotos`).

**El ataque:** las policies de UPDATE y DELETE sobre `storage.objects` del bucket
`ranchos-fotos` usan solo `using (bucket_id = 'ranchos-fotos')` sin atar el
objeto a su dueño. Cualquier cuenta registrada puede borrar o reemplazar las
fotos de todos los negocios. **En vivo confirmé que el bucket es enumerable por
el anónimo** (`storage.from('ranchos-fotos').list()` devuelve los objetos), así
que un atacante ni siquiera tiene que adivinar rutas. ✅ (enumeración)

**Arreglo:** que las policies de UPDATE/DELETE exijan que la ruta del objeto
pertenezca a un negocio del `auth.uid()` (patrón `owner`/carpeta por dueño).

---

## 🔴 4. XSS almacenado con `javascript:` en los enlaces del negocio 🧪

**Dónde:** `src/app/eventos/[id]/portal-secciones.tsx:556`.

**El ataque:** los enlaces de redes/sitio web del negocio se pintan sin filtrar
el protocolo. La normalización que hace la server action se puede saltar
escribiendo directo por la API (RLS permite al dueño escribir su fila), dejando
un `href="javascript:..."`. Cuando otra persona visita la ficha y toca el
enlace, se ejecuta el script.

**Arreglo:** validar el protocolo al RENDERIZAR (permitir solo `https:`/`http:`/
`mailto:`), no solo al guardar. Es la misma lección de las invitaciones.

---

## 🔴 5. La tabla `invitaciones` es enumerable por el anónimo — con direcciones de casa ✅

**Dónde:** `supabase/migrations/0066_invitaciones_digitales.sql:60`.

**El ataque:** confirmado EN VIVO — `select * from invitaciones` con la anon key
devuelve todas las invitaciones con `titulo`, `anfitriones`, `fecha_evento`,
`hora`, `lugar_nombre`, **`direccion`** y `html_personalizado`. O sea: nombres,
fechas y **la dirección de la casa** donde es cada evento privado de cada
cliente, leíble por cualquiera. Es una fuga de datos personales.

**Arreglo:** RLS en `invitaciones` que solo deje leer la fila por su `slug`
(acceso por link, no listado) o por el dueño; nunca un `select` de la tabla
entera. La página `/i/[slug]` ya entra por slug, así que no necesita listar.

---

## 🟠 6. Endpoint de estadísticas de citas sin autenticación (BOLA) ✅

**Dónde:** `src/app/api/citas/[id]/stats/route.ts:46`.

**El ataque:** confirmado EN VIVO — `GET /api/citas/<id>/stats` **sin ninguna
cookie** devuelve `{citasTotales, clientesAtendidos, citasPorMiembro:{...}}` de
cualquier negocio. Fuga cross-negocio de métricas operativas (OWASP API1 / BOLA).

**Arreglo:** exigir sesión y verificar que quien pide es dueño/colaborador de ese
negocio antes de responder.

---

## 🟠 7. Otros hallazgos MEDIA (del análisis estático, sin explotar en vivo)

| # | Dónde | Qué |
|---|---|---|
| 7a | `0144_bucket_comprobantes_publico.sql:37` | Comprobantes de pago (datos bancarios) en bucket **público** con URLs permanentes: quien tenga la URL la abre para siempre, sin sesión. |
| 7b | `src/app/i/[slug]/invitacion-vista.tsx:484` | `html_personalizado` se renderiza sin sanitizar y **ejecuta JS** (script por SSR + handlers inline) para quien abre la invitación. |
| 7c | `src/app/auth/callback/route.ts:20` | Open redirect en el callback de OAuth: el guard contra `//` se evade con `\` o tab. |
| 7d | `src/app/eventos/reserva-actions.ts:200` | Se puede confirmar una reserva (bloquear la fecha) sin depósito ni comprobante. |
| 7e | `src/app/api/invitaciones/refinar-prompt/route.ts:41` | Cualquier cuenta registrada puede agotar el presupuesto de IA (denial-of-wallet): sin límite por usuario. |
| 7f | `0068_espacios_y_albumes.sql:139` | Bucket `albumes` enumerable (confirmado en vivo ✅) + subida anónima ilimitada. |

---

## 🟡 8. Hallazgos BAJA

- `0107_visitas_pagina.sql:72` — `visitas_pagina_resumen` es `security definer` concedida a `anon`: revela el tráfico de cualquier negocio.
- `src/app/api/citas/[id]/asistencia/route.ts:136` — un colaborador con `acreditar:false` igual otorga puntos de lealtad (bypass del checklist 0127).
- `0068_...:101` — `album_fotos` con `select using(true)` expone fotos de álbumes en borrador/archivados.

---

## Refutado (no explotable)

- **Auto-destacarse en el directorio** (`destacado_orden`): probé en vivo el
  `UPDATE` de `ranchos` con la anon key → **`permission denied`**. El anónimo no
  puede escribir `ranchos`. (El grant amplio del hallazgo no aplica a `anon`.)

---

## Lo que está BIEN (para que conste)

- Tablas privadas (perfiles, mensajes, solicitudes_lealtad, agentes_lealtad,
  addons_negocio, rancho_colaboradores) → `permission denied` al anónimo. ✅
- Las columnas de cobro de `ranchos` (SINPE/cuenta) → el anónimo recibe
  `permission denied` al pedirlas (grant columna-por-columna correcto). ✅
- El atajo del proxy («sin cookie no llamo a Supabase») y el check de admin por
  rol en `perfiles` (no por `user_metadata`) → correctos. ✅
- Sin secretos hardcodeados; `service_role` solo en rutas de servidor. ✅

---

## Plan de arreglo propuesto (por orden)

1. **Migración RLS/storage** que cierra 1, 3, 5, 7a, 7f, 8 (policies y grants).
2. **Fixes de código** (locales, sin desplegar) para 2, 4, 6, 7b, 7c, 7d, 7e.
3. Re-probar cada uno con los mismos scripts de ataque.

**Las migraciones tocan producción**, así que — por la regla de la casa — no las
aplico sin tu OK. Decime **«arreglá la seguridad»** y empiezo por la migración y
los fixes de código (locales), y te muestro cada hoyo cerrado con la prueba de
ataque fallando.
