# Runbook de aplicación remota — Wallet V2 (0156-0166)

> **Este documento es un plan. No se ejecutó nada de esto contra
> remoto.** Se escribe en Fase 2C, junto con el resto del
> endurecimiento, para que la aplicación futura (cuando el dueño la
> autorice) tenga un procedimiento escrito en vez de improvisarse.
> Cubre 11 migraciones: las 10 de Fase 2B (0156-0165, ya endurecidas
> en Fase 2C) más `0166`, que corrige un bug real **ya en producción
> hoy** (independiente de Wallet V2 — ver `fase-2c-resultado.md` §10).

## Antes

| Ítem | Estado / instrucción |
|---|---|
| Backup disponible | Confirmar que Supabase tiene un backup/PITR reciente (panel de Supabase → Database → Backups) antes de empezar. No se verificó desde acá — es solo lectura de metadata de esquema, no de la configuración de backups del proyecto |
| Estado de migraciones | Confirmado en Fase 2C (`drift-remoto.md` §2): ninguna de 0156-0166 está aplicada en remoto. Este proyecto no usa `supabase db push` — el dueño pega cada migración a mano en el SQL Editor (`estado-migraciones.mjs` es el mecanismo de verificación, no la tabla de control del CLI) |
| Commit exacto | Registrar el hash de `git rev-parse HEAD` en el momento real de aplicar — este documento se escribió sobre working tree sin commitear todavía (Fase 2C no hace commits sin que se pida). No hardcodear un hash acá que quedaría desactualizado |
| Build exacto | `npm run build` debe terminar en `exit 0` inmediatamente antes de aplicar — ver sección 13 de `fase-2c-resultado.md` para la corrida más reciente |
| Conteos preflight | Ya tomados en Fase 2C, solo lectura (`preflight-datos-remotos.md`): 1 cuenta, 1 programa (sin `cuenta_id` enlazado), 2 miembros, 3 pases (2 Apple + 1 Google), 0 canjes, 0 intentos_canje, 1 divergencia de saldo conocida (se resuelve con el backfill de 0159) |
| Ventana recomendada | Volumen mínimo (preflight de arriba) y tiempo medido en el ensayo local (`fase-2c-resultado.md` §9): **2.98 s** para las 11 migraciones completas contra datos con la misma forma. No se necesita una ventana de mantenimiento larga — alcanza con evitar aplicar durante un canje real en curso (hoy, 0 canjes reales, así que cualquier momento sirve) |
| Responsable | El dueño (luchoherrera15@gmail.com), que es quien pega las migraciones hoy — sin cambios de proceso en esta fase |
| Criterios de abortar | Cualquier migración de la lista de abajo que termine con error se aborta ahí — no se continúa "a ver si la siguiente sí". Ver "Qué hacer si una migración falla" |

## Durante

**Orden exacto** (no cambia — cada migración depende de que la
anterior haya corrido):

```
0156_wallet_v2_alta_cuenta_lealtad.sql
0157_wallet_v2_backfill_cuenta_id.sql
0158_wallet_v2_equipo_canonico_y_ownership.sql
0159_wallet_v2_saldo_canonico_miembros.sql
0160_wallet_v2_ledger_y_concurrencia_canje.sql   (incluye el endurecimiento de FKs, Fase 2C)
0161_wallet_v2_sincronizaciones.sql
0162_wallet_v2_encolar_desde_movimientos.sql
0163_wallet_v2_identidad_apple_google.sql
0164_wallet_v2_update_tag_monotonico.sql
0165_wallet_v2_proteger_columnas_internas.sql    (incluye la protección de INSERT, Fase 2C)
0166_wallet_v2_revertir_movimiento_unique_real.sql
```

**Método de aplicación**: igual que las 155 anteriores — pegar cada
archivo, en orden, en el SQL Editor de Supabase (`scripts/aplicar-
migracion.mjs` es la alternativa ya existente en el repo si se prefiere
por la Management API; ninguna de las dos es nueva de esta fase). Cada
archivo es idempotente donde corresponde (`if not exists`), pero no
está pensado para reintentarse a ciegas tras un error — ver abajo.

**Timeout**: ninguna de las 11 migraciones toca más de unas pocas
filas reales (preflight de arriba) — no se espera ningún timeout. Si
alguna tardara más de 30 segundos, es señal de que algo no está como
se documentó acá (ver "abortar").

**Locks esperados**: `ALTER TABLE` toma un lock breve (`ACCESS
EXCLUSIVE` para agregar columnas/constraints) — con el volumen real de
hoy, del orden de milisegundos. `0160`/`0166` agregan índices con
`CREATE UNIQUE INDEX IF NOT EXISTS` (no `CONCURRENTLY`, porque corren
dentro de la migración y la tabla es minúscula) — mismo criterio que
el resto del repo.

**Consultas de progreso** (correr entre migración y migración, de
solo lectura):

```sql
-- ¿Qué tabla/columna se agregó en el último paso?
select column_name from information_schema.columns
 where table_name = 'programa_lealtad' order by ordinal_position;

-- ¿El trigger de inmutabilidad ya existe?
select tgname from pg_trigger where tgrelid = 'transacciones_puntos'::regclass and not tgisinternal;
```

**Validación después de cada bloque** (no solo al final):

- Después de `0156`: `select proname from pg_proc where proname = 'alta_cuenta_lealtad';` → debe existir.
- Después de `0157`: `select count(*) from programa_lealtad where cuenta_id is null;` → debería bajar a 0 (hoy hay 1 programa sin enlazar).
- Después de `0159`: `select miembro_id, clasificacion from wallet_v2_reconciliacion_saldos where clasificacion not in ('coincide','miembro_sin_pase');` → revisar cualquier fila que aparezca (hoy se espera 1, la divergencia ya conocida — ver `preflight-datos-remotos.md`).
- Después de `0160`: `select tgname from pg_trigger where tgrelid = 'transacciones_puntos'::regclass and not tgisinternal;` → debe listar `transacciones_puntos_inmutable_trg`.
- Después de `0165`: intentar (con una sesión real, no `service_role`) un `UPDATE programa_lealtad SET diseno_version = 999` como el dueño real de un programa → la fila debe volver con el valor viejo, no 999.
- Después de `0166`: `select indexname from pg_indexes where indexname = 'transacciones_puntos_reversion_de_unica_idx';` → debe existir.

**Qué hacer si una migración falla**: parar ahí — no seguir con la
siguiente. Las migraciones 1-6 del lote (0156-0161) son aditivas
(`ADD COLUMN`/`CREATE TABLE`) y no rompen nada que ya esté corriendo si
se detienen a mitad de camino; el sistema sigue funcionando exactamente
como antes de empezar. Revisar el mensaje de error contra lo
documentado en cada archivo (cada uno tiene comentarios explicando su
razón de ser) antes de reintentar. No "arreglar a mano" datos en
producción para que una migración pase — si una migración falla por
datos inesperados, es evidencia de un caso no previsto (como el
hallazgo de `saldo_imposible` de Fase 2B) y hay que entenderlo antes de
continuar, no forzarlo.

## Después

Confirmar, en este orden:

1. **Conteos**: repetir el preflight de solo lectura
   (`scripts/preflight-remoto.mjs`) y comparar contra el "antes" — los
   únicos cambios esperados son `programas_cuenta_id_null: 0` (era 1) y
   la divergencia de saldo resuelta.
2. **Backfill**: `cuenta_id_confirmada = true` en el programa real;
   `cuentas_equipo` con el colaborador legacy migrado, rol
   `'colaborador'` (nunca `'administrador'`).
3. **RLS**: policies de las 16 tablas relevantes siguen listadas igual
   que en `drift-remoto.md` §6, más las de `wallet_sincronizaciones`
   (nueva, 100% `service_role`).
4. **Alta**: probar `alta_cuenta_lealtad` con un negocio de prueba
   real (no de producción) para confirmar que el flujo de alta sigue
   funcionando end-to-end contra el esquema ya migrado.
5. **Cuenta / Equipo**: confirmar que el panel de Lealtad de un negocio
   real sigue cargando (lectura, sin modificar nada).
6. **Ledger**: confirmar que `transacciones_puntos_inmutable_trg`
   rechaza un `UPDATE`/`DELETE` de prueba (con una fila de prueba
   creada y no una real).
7. **Canje**: sin canjes reales hoy — no hay nada que reverificar en
   datos existentes; confirmar que el flujo de canje sigue disponible
   en el panel.
8. **Sync jobs**: `select count(*) from wallet_sincronizaciones;` → 0
   esperado (el worker no existe todavía, nada las procesa, pero deben
   empezar a encolarse cuando alguien acredite/canjee/revierta).
9. **Update tags**: sin cambios esperados hasta el primer movimiento
   real posterior a la migración.
10. **Logs**: revisar los logs de Supabase (Database → Logs) por
    cualquier error inesperado en los minutos posteriores — ninguno
    debería aparecer si las validaciones de arriba pasaron.

## Rollback

Separado por tipo, como pide el enunciado — **no se presenta `DROP
COLUMN` como rollback seguro una vez que producción haya escrito datos
nuevos** (el `saldo_cache`/`diseno_version`/etc. de un miembro/programa
tocado después de la migración se perdería con un `DROP COLUMN`):

- **Rollback de código**: revertir el commit que cambia
  `src/app/lealtad/nuevo/actions.ts` (usa `alta_cuenta_lealtad`) y
  cualquier otro archivo de `src/` que empiece a leer columnas nuevas
  — vuelve al comportamiento anterior sin tocar el esquema.
- **Rollback de función**: `CREATE OR REPLACE FUNCTION` con el cuerpo
  anterior — el repo ya versiona el SQL previo de `canjear_recompensa`
  (migración 0125/0137) y de `revertir_movimiento` (0125/0139) en sus
  propios archivos de migración, así que "rollback de función" es
  volver a aplicar ese cuerpo, sin necesitar una migración inversa
  especial.
- **Desactivación mediante feature flag**: no aplica todavía — Wallet
  V2 no introdujo un flag de "encendido/apagado" (ver
  `migracion-legacy.md`, "por qué NO hace falta un feature flag
  general"). El único corte real es de código (arriba).
- **Migración compensatoria**: mientras nadie haya escrito dato nuevo
  en las columnas agregadas, `DROP COLUMN`/`DROP TABLE` de lo que cada
  migración creó es seguro y reversible — documentado migración por
  migración en `fase-2b-resultado.md` (tabla de rollback) y ahora
  también en `rollback-fase-2b.md`. Una vez que SÍ hay dato nuevo
  escrito, la migración compensatoria deja de ser "borrar la columna"
  y pasa a ser una decisión de producto (¿se puede perder ese dato?) —
  no se automatiza acá.
- **Restauración desde backup**: último recurso, solo si algo de lo de
  arriba no alcanza — implica perder cualquier escritura real ocurrida
  entre la migración y la restauración, no solo la de Wallet V2.

**Ninguna corrección de estas categorías se ejecutó** — este documento
es el plan, no la acción.
