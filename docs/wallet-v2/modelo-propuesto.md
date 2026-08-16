# Modelo propuesto — Wallet V2

> **Actualización Fase 2B**: este diseño se implementó y se probó en
> local, tal como está descrito acá — sin desviaciones de fondo. Ver
> `fase-2b-resultado.md` para la matriz de migraciones reales
> (`0156`–`0165`) y la evidencia de cada prueba.

> Estado objetivo, resultado de las decisiones documentadas en
> `decisiones-tablas.md`. Es diseño, no migración — el SQL de acá es
> ilustrativo (pseudocódigo de alto nivel), no un archivo ejecutable.
> Ninguna columna, tabla ni política de esta página existe todavía.

## Vista general

| # | Tabla | Trato |
|---|---|---|
| 1 | `cuentas` | Sin cambios de esquema. Se cierra su **adopción** (prerrequisito de producto, no de base de datos) |
| 2 | `programa_lealtad` | Se amplía: +2 columnas |
| 3 | `miembros` | Se amplía: +2 columnas (recibe el saldo que hoy vive repetido en `pases_wallet`) |
| 4 | `pases_wallet` | Se amplía: +6 columnas, -2 columnas (se retira `saldo_cache`/`actualizado_en`, se mueven a `miembros`) |
| 5 | `transacciones_puntos` | Se amplía: +2 columnas, se amplía el `CHECK` de `tipo` |
| 6 | `registros_dispositivo` | Se amplía: +4 columnas |
| 7 | `recompensas`, `canjes`, `intentos_canje` | Sin cambios de esquema. Se corrige un RPC (`canjear_recompensa`) |
| 8 | `wallet_sync_pendiente` | **Tabla nueva** |
| 9 | Bucket `lealtad-branding` | **Nuevo** (Storage, no Postgres) — ejecución en Fase 6 |

Ninguna tabla se elimina en Fase 2. `cuentas_equipo` (confirmada como tabla
muerta) y `llave_idempotencia` (columna muerta) se documentan como deuda a
decidir, no se tocan todavía — ver `migracion-legacy.md`.

---

## 1. `cuentas`

Sin cambios de columnas. El trabajo es de producto: `/lealtad/nuevo/actions.ts`
debe crear la fila de `cuentas` en el mismo flujo que hoy solo crea
`ranchos`, replicando el patrón que el backfill de 0134 ya usó una vez.

---

## 2. `programa_lealtad` (+2)

```sql
alter table programa_lealtad
  add column if not exists diseno_version integer not null default 1,
  add column if not exists cuenta_id_confirmada boolean not null default false;
-- (cuenta_id_confirmada es temporal: true una vez que el backfill de cuenta_id
--  para este programa corrió y se verificó. Se retira en una migración de
--  limpieza posterior, no se queda para siempre — ver plan-migraciones.md)

create or replace function programa_lealtad_incrementar_diseno()
returns trigger as $$
begin
  if (new.pase_color_fondo, new.pase_color_sello, new.pase_logo_url,
      new.pase_banner_url, new.pase_sello_icono, new.pase_texto_reverso)
     is distinct from
     (old.pase_color_fondo, old.pase_color_sello, old.pase_logo_url,
      old.pase_banner_url, old.pase_sello_icono, old.pase_texto_reverso)
  then
    new.diseno_version := old.diseno_version + 1;
  end if;
  return new;
end;
$$ language plpgsql;
```

`cuenta_id` sigue nullable hasta que el backfill de producto (§1) esté
confirmado — no se fuerza `NOT NULL` en Fase 2.

---

## 3. `miembros` (+2)

```sql
alter table miembros
  add column if not exists saldo_cache integer not null default 0,
  add column if not exists saldo_actualizado_en timestamptz;
```

`pases_wallet.saldo_cache`/`actualizado_en` (ver abajo) se retiran una vez
migrados los datos existentes (3 filas hoy) — orden exacto en
`migracion-legacy.md`.

---

## 4. `pases_wallet` (+6, -2)

```sql
alter table pases_wallet
  add column if not exists update_tag bigint not null default 0,
  add column if not exists ultima_generacion_en timestamptz,
  add column if not exists google_revision text,
  add column if not exists google_ultimo_payload_hash text,
  add column if not exists apple_ultimo_status_registro integer,
  add column if not exists motivo_ultima_generacion text
    check (motivo_ultima_generacion is null or motivo_ultima_generacion in
      ('emision','saldo','diseno','pausa','reinstalacion'));

-- Retirar DESPUÉS del backfill a miembros (paso separado, ver plan-migraciones.md):
-- alter table pases_wallet drop column saldo_cache;
-- alter table pases_wallet drop column actualizado_en;
```

`serial_number`, `auth_token`, `activo`, `objeto_externo`: sin cambios —
ya cumplen lo que la Fase 0 y esta fase pedían verificar.

---

## 5. `transacciones_puntos` (+2, `CHECK` ampliado)

```sql
alter table transacciones_puntos
  add column if not exists unidad text
    check (unidad is null or unidad in ('sellos','puntos','colones','usos')),
  add column if not exists correlation_id uuid;

alter table transacciones_puntos
  drop constraint transacciones_puntos_tipo_check,
  add constraint transacciones_puntos_tipo_check check (tipo in (
    'ganado', 'ganado_reversado',
    'puntos_agregados', 'puntos_reversados',
    'cashback_pendiente', 'cashback_confirmado', 'cashback_canjeado', 'cashback_reversado',
    'canjeado', 'canjeado_reversado',
    'ajuste', 'expiracion'
  ));

alter table transacciones_puntos
  add column if not exists compra_base_colones bigint,
  add column if not exists basis_points integer check (basis_points is null or basis_points between 0 and 10000),
  add column if not exists moneda text check (moneda is null or moneda in ('CRC'));
```

`referencia` sigue siendo la columna de idempotencia real (§7 de
`decisiones-tablas.md`) — no se agrega una columna paralela.

---

## 6. `registros_dispositivo` (+4)

```sql
alter table registros_dispositivo
  add column if not exists ultimo_push_en timestamptz,
  add column if not exists ultimo_push_status integer,
  add column if not exists ultimo_error text,
  add column if not exists intentos_fallidos integer not null default 0;
```

---

## 7. `recompensas` / `canjes` / `intentos_canje`

Sin cambios de columnas. Cambio de comportamiento dentro de
`canjear_recompensa` (RPC, 0125): agregar la validación de
`uso_unico`/`max_por_cliente`/`max_global`/vigencia de **tarjeta**
(hoy en `canje.ts`, sin lock) al cuerpo de la función, bajo el mismo
`pg_advisory_xact_lock` que ya protege `stock_total`/`limite_por_cliente`
de la **recompensa**. Es una migración de función (`create or replace
function`), no de tabla.

---

## 8. `wallet_sync_pendiente` — tabla nueva

```sql
create table wallet_sync_pendiente (
  id                  uuid primary key default gen_random_uuid(),
  pase_id             uuid not null references pases_wallet(id) on delete cascade,
  motivo              text not null check (motivo in ('saldo','diseno','pausa','mensaje_promocional')),
  correlation_id      uuid not null,
  intentos            integer not null default 0,
  proximo_intento_en  timestamptz not null default now(),
  reclamado_por       text,
  reclamado_en        timestamptz,
  ultimo_error        text,
  creado_en           timestamptz not null default now(),
  completado_en       timestamptz
);

create unique index wallet_sync_pendiente_activo_idx
  on wallet_sync_pendiente (pase_id, motivo)
  where completado_en is null;

create index wallet_sync_pendiente_reclamable_idx
  on wallet_sync_pendiente (proximo_intento_en)
  where completado_en is null and reclamado_en is null;

-- RLS: igual que registros_dispositivo — habilitada, cero policies,
-- 100% service_role. Ningún rol de aplicación necesita leerla directo;
-- el panel consulta a través de una vista/RPC de solo lectura si hace
-- falta mostrar "sincronización pendiente" al dueño (Fase 9).
alter table wallet_sync_pendiente enable row level security;
```

Reemplaza, cuando se complete la migración (`plan-migraciones.md`), las
columnas `pase_en_pausa`/`pausa_avisada_en`/`pausa_error`,
`diseno_pendiente`/`diseno_avisado_en`/`diseno_error` de `pases_wallet` —
no antes de que `aviso-de-pausa.ts`/`aviso-de-diseno.ts` estén migrados a
leer/escribir esta tabla en vez de esas columnas (Fase 3).

---

## 9. Bucket `lealtad-branding`

Recurso de Supabase Storage, no de Postgres — se crea en Fase 6 junto con
el constructor visual. Documentado acá porque el modelo de datos
(`programa_lealtad.pase_logo_url`) debe pasar de guardar una URL completa
a guardar una **ruta** dentro de este bucket:

```sql
-- Cambio de significado, no de tipo de columna (sigue siendo text):
-- antes: "https://<proyecto>.supabase.co/storage/v1/object/public/ranchos-fotos/lealtad/logos/..."
-- después: "lealtad-branding/<cuenta_id>/logo-<hash>.<ext>"
-- La URL pública se deriva en el servidor al leer (una función, no una
-- columna generada — permite cambiar de CDN sin migración).
```

No se ejecuta en Fase 2 — se deja preparado para no tener que rediseñar
la columna dos veces.

---

## Lo que NO cambia

`personas`, `personas_negocio`, `personas_duplicados`,
`consentimientos_persona`, `sesiones_persona`: sin cambios — el inventario
confirmó que el modelo de identidad ya resuelve correctamente lo que
Wallet V2 necesita (persona global, permiso por negocio, fusión con RPC
robusto). `ranchos`: sin cambios de esquema — sigue siendo el directorio
público, ajeno a Wallet V2 salvo por la costura ya existente vía `cuentas`.
