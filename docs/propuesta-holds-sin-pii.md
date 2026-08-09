# PROPUESTA (sin aplicar) — cerrar la lectura anónima de `reservas`

> Estado: **NO APLICADO**. No se tocó ningún grant ni ninguna policy.
> Este documento es la propuesta que pediste antes de decidir.
> Verificado en producción el 2026-08-09 con `node scripts/auditar-fuga-holds.mjs`.

---

## 1. Qué policy permite el SELECT

Una sola, y sigue viva desde la migración 0006:

```sql
-- supabase/migrations/0006_fix_select_hold_temporal.sql:9-12
create policy "Cualquiera ve los holds temporales"
  on reservas for select
  to anon, authenticated
  using (estado = 'temporal');
```

Nació con un propósito legítimo y acotado — su propio encabezado lo dice:
*"Permite leer los holds temporales (sin datos personales todavía) para
que Supabase pueda devolver el ID justo después de crearlos"*. El
`.insert(...).select("id, expira_en")` del flujo de reserva necesita
permiso de lectura para poder devolver la fila que acaba de crear.

Convive con la política del dueño (0032), que es la que de verdad
protege el resto:

```sql
-- supabase/migrations/0032_rol_cliente.sql:114-120
create policy "El equipo ve todas las reservas" on reservas
  for select to authenticated
  using (is_admin()
         or rancho_id in (select id from ranchos where owner_id = auth.uid())
         or cliente_id = auth.uid());
```

**El problema es que las políticas de Postgres son PERMISIVAS y se
OR-ean.** La de 0006 no restringe columnas — restringe *filas*. Y el
`grant` sí es sobre la tabla entera.

## 2. Qué roles tienen GRANT SELECT sobre `reservas`

`anon` y `authenticated`, sobre **todas las columnas**, otorgado tres
veces (idempotente):

```sql
-- 0002_grants.sql:12 · 0009_admin_balance.sql:27 · 0025_fix_rls_reservas.sql:21
grant select, insert, update, delete on reservas to anon, authenticated;
```

No hay ningún `grant`/`revoke` por columna en las 109 migraciones.

## 3. ¿`anon` puede hacer `select=*` con solo la anon key?

**Sí. Verificado contra producción**, usando únicamente
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (que va en el bundle público del sitio):

```
GET /rest/v1/reservas?select=*&limit=3
→ HTTP 200 · devolvió 2 filas
```

## 4. Qué filas devuelve exactamente

Solo las de `estado = 'temporal'`: los holds de 10 minutos que se crean
al tocar una fecha en el calendario. Verificado por separado:

```
GET /rest/v1/reservas?select=id&estado=eq.confirmada  → 0 filas  ✅ la RLS tapa
```

O sea: **la exposición ocurre solamente para `estado='temporal'`**. Las
reservas confirmadas, pendientes, canceladas y bloqueadas siguen
protegidas.

## 5. Qué columnas sensibles quedan accesibles

Las **51 columnas** de la tabla. Probadas una por una, todas HTTP 200:

| Columna | ¿Alcanzable? |
|---|---|
| `nombre`, `contacto`, `correo`, `whatsapp` | ❌ sí |
| `cedula` | ❌ sí |
| `creado_por_ip` | ❌ sí |
| `notas`, `deposito_comprobante_url` | ❌ sí |

**Pero lo que hoy hay DE VERDAD en esas filas es menos grave de lo que
parece.** Medido en producción (conteos, sin leer ningún valor):

| | filas |
|---|---|
| holds vivos | 2 |
| …con `nombre` | **0** |
| …con `correo` | **0** |
| …con `whatsapp` | **0** |
| …con `cedula` | **0** |
| …con `creado_por_ip` | **2** |

La razón es de diseño y la verifiqué en el código: los datos personales
los escribe `completar_reserva_temporal` (RPC `security definer`,
0026→0032), que en la **misma sentencia** llena nombre/correo/whatsapp y
mueve el estado a `'pendiente'`. Cuando la fila tiene PII, ya dejó de
ser `'temporal'` y la política de 0006 deja de alcanzarla.

**Conclusión honesta sobre la severidad:**

- **Fuga real y activa hoy**: la **dirección IP** (en el sitio) o el
  **identificador de dispositivo** (en la app) de toda persona que esté
  reservando en ese momento, junto con qué negocio y qué fecha está
  mirando. Es dato personal bajo la Ley 8968. Severidad **media**.
- **Fuga latente**: las 51 columnas están alcanzables. El día que
  cualquier código nuevo escriba algo en una fila antes de sacarla de
  `'temporal'` — o que se agregue una columna sensible — pasa a ser
  fuga total **sin ningún aviso**. La Fase 2 agrega `tipo_reserva` a
  esta misma tabla, y por eso apareció.

*(Aparte, no es lectura: las políticas de UPDATE y DELETE de la 0025
también están abiertas sobre cualquier fila `'temporal'`, así que un
tercero puede pisar o borrar el hold de otra persona. Es un problema de
disponibilidad del embudo de reserva, no de privacidad. Lo menciono
porque se arregla en el mismo lugar; no está incluido en el parche.)*

## 6. Qué del flujo público depende de leer `reservas` desde el cliente

Revisado archivo por archivo. **Con la anon key (sin sesión), solo el
flujo de holds:**

| Dónde | Qué hace | Columnas que necesita |
|---|---|---|
| [reserva-actions.ts:96](src/app/eventos/reserva-actions.ts#L96) | crea el hold y lo lee de vuelta | `id`, `expira_en` |
| [reserva-actions.ts:55](src/app/eventos/reserva-actions.ts#L55) | borra holds vencidos | `rancho_id`, `fecha`, `estado`, `expira_en` |
| [reserva-actions.ts:67](src/app/eventos/reserva-actions.ts#L67) | busca los holds propios para liberarlos | `estado`, `creado_por_ip`, `rancho_id`, `expira_en` |
| [reserva-actions.ts:80](src/app/eventos/reserva-actions.ts#L80) | cuenta holds por IP (antibot) | `estado`, `creado_por_ip`, `expira_en` |
| [mobile reservar.tsx:227](mobile/src/app/rancho/[id]/reservar.tsx#L227) | idem, desde la app | `rancho_id`, `fecha`, `estado`, `expira_en`, `id` |

Todo lo demás que lee `reservas` lo hace **con sesión**: el panel del
dueño, `/cuenta`, la app, los crons (service key) y el admin. La
disponibilidad pública **no** lee la tabla: usa las vistas
`disponibilidad_rancho`, `disponibilidad_citas` y `disponibilidad_items`,
que corren con los permisos de su dueño y **no se ven afectadas** por
quitarle columnas a `anon`.

---

## 7. El parche propuesto (el más pequeño que cierra la fuga)

Dos piezas. No entrega la service key al navegador, no toca el
anti-doble-reserva y no toca las vistas de disponibilidad.

### Pieza 1 — permisos por columna para `anon`

Postgres no tiene RLS por columna, pero sí `GRANT` por columna. Es el
cambio más pequeño posible: la policy de 0006 se queda **igual**, y lo
que cambia es qué puede pedir `anon`.

```sql
-- Solo `anon`. `authenticated` NO se toca: el panel del dueño necesita
-- leer sus reservas completas y esa lectura ya la limita la RLS de 0032.
revoke select on reservas from anon;
grant select (id, rancho_id, fecha, estado, expira_en) on reservas to anon;
```

Con esas cinco columnas, el flujo público sigue entero: crear el hold y
leer `id`/`expira_en`, y borrar los vencidos (el `DELETE` necesita
`SELECT` sobre las columnas del `WHERE`, y las cuatro están).

### Pieza 2 — un RPC para lo único que se queda sin permiso

Las dos consultas antibot filtran por `creado_por_ip`, que es
precisamente el dato que estamos sacando de la vista de `anon`. Se
mueven a una función `security definer`, el mismo patrón que ya usan
`liberar_hold_temporal` (0017) y `completar_reserva_temporal` (0032):

```sql
create or replace function public.holds_propios(
  p_ip text,
  p_rancho_id uuid default null   -- null = de todos los negocios
)
returns table (id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select r.id
  from reservas r
  where r.estado = 'temporal'
    and r.creado_por_ip = p_ip
    and r.expira_en > now()
    and (p_rancho_id is null or r.rancho_id = p_rancho_id);
$$;

revoke execute on function public.holds_propios(text, uuid) from public;
grant execute on function public.holds_propios(text, uuid) to anon, authenticated;
```

Devuelve **solo ids**, y solo de los holds de esa misma IP: no permite
enumerar los de nadie más. La IP la pone el servidor (`obtenerIp()`),
nunca el navegador.

Y el cambio en el código, dos consultas por una llamada:

```ts
// src/app/eventos/reserva-actions.ts
const { data: propios } = await supabase.rpc("holds_propios", {
  p_ip: ip,
  p_rancho_id: ranchoId,
});
for (const propio of propios ?? []) {
  await supabase.rpc("liberar_hold_temporal", { p_id: propio.id, p_ip: ip });
}

const { data: activos } = await supabase.rpc("holds_propios", { p_ip: ip });
if ((activos?.length ?? 0) >= MAX_HOLDS_ACTIVOS_POR_IP) { /* … */ }
```

### Lo que este parche NO cierra (y por qué)

Un usuario **con sesión iniciada** (cualquiera, no hace falta ser dueño)
sigue pudiendo leer los holds vivos con todas sus columnas, porque la
policy de 0006 también aplica a `authenticated` y ahí no se pueden usar
permisos por columna sin romperle el panel al dueño.

Cerrarlo requiere que crear el hold pase por un RPC `security definer`
en vez de un `insert` directo — y **la app móvil ya instalada inserta
directo**, así que la policy no se puede quitar hasta que salga una
versión nueva. Queda como Fase B, con el orden: RPC nuevo → web → app →
recién ahí quitar la policy. Mientras tanto, la exposición pasa de "toda
la internet con la llave del bundle" a "usuarios registrados", que es la
diferencia que importa.

---

## 8. Las pruebas

`scripts/auditar-fuga-holds.mjs`, que ya está en el repo y **solo lee**
salvo que se le pase `--flujo`.

### A) Antes del parche, la fuga existe

```
$ node scripts/auditar-fuga-holds.mjs
A) select=*                → HTTP 200  ❌ PERMITIDO
   ⚠️  Devolvió 2 fila(s) AHORA MISMO. Columnas expuestas: (51)
B) columnas sensibles, una por una:
   ❌ nombre / contacto / correo / whatsapp / cedula
   ❌ creado_por_ip / notas / deposito_comprobante_url
  columnas PII alcanzables ........... 8 ❌
  flujo público roto ................. 0 ✅
→ exit 1
```

Ese es el resultado **real** de correrlo hoy contra producción.

La prueba no depende de que haya holds vivos: PostgREST responde 200 a
una columna permitida aunque no devuelva filas, y 4xx con *permission
denied for column* a una denegada. Por eso el script **no crea ningún
hold** para demostrar la fuga.

### B) Después del parche, `anon` no puede leer PII

El mismo comando debe dar:

```
  columnas PII alcanzables ........... 0 ✅
  flujo público roto ................. 0 ✅
→ exit 0
```

### C) El flujo público sigue funcionando

```
$ node scripts/auditar-fuga-holds.mjs --flujo
  crear hold + leer id/expira_en → HTTP 201  ✅
  borrar el hold vencido         → HTTP 204  ✅ limpio
```

Este es el único paso que **escribe**, y está detrás de la bandera a
propósito. Es inofensivo por construcción: usa la fecha `2099-12-31`
(ningún cliente real la va a pedir, así que no le quita el turno a nadie
por `unique_temporal_date`) y nace ya vencido, así que ninguna vista de
disponibilidad lo cuenta y se puede borrar enseguida.

**No lo corrí**: escribe en producción y pediste no avanzar hasta cerrar
la decisión.

---

## 9. Qué necesito de vos

1. ¿Aplico la Pieza 1 (permisos por columna)? Es reversible con
   `grant select on reservas to anon;`.
2. ¿Aplico la Pieza 2 (el RPC + el cambio en `reserva-actions.ts`)?
   Va junta con la 1: sin ella, el antibot de holds por IP deja de
   contar y el tope se vuelve inefectivo.
3. ¿Agendamos la Fase B (hold por RPC) para la próxima versión de la
   app, o la dejamos anotada?

Orden si decís que sí: correr el script (queda la evidencia del antes) →
pegar el SQL → deploy de la web con el cambio del RPC → correr el script
otra vez → `--flujo` para confirmar el alta.
