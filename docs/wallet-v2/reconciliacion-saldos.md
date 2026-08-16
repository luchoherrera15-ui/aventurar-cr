# Reconciliación de saldos — Migración B (Wallet V2, Fase 2B/2C)

> **Actualización Fase 2C**: la Fase 2B dejó esto como "6/8 categorías
> probadas, 2 estructuralmente imposibles" — insuficiente como evidencia
> según el propio enunciado de Fase 2C. Esta actualización agrega, por
> categoría: qué constraint/trigger/FK la impide (si alguno), si era
> imposible antes o solo después de qué migración, y si puede existir
> en datos legacy de producción aunque el esquema actual ya la impida
> — comprobado contra el Supabase remoto real (solo lectura), no
> asumido. Ver la tabla completa más abajo.

> Expand, no contract: `miembros.saldo_cache`/`saldo_actualizado_en` se
> agregaron y se llenaron (recalculados desde `transacciones_puntos`,
> nunca copiados de `pases_wallet`). `pases_wallet.saldo_cache` sigue
> exactamente como estaba — ningún consumidor real fue cambiado para
> leer la columna nueva todavía. Esa es una fase futura (contract),
> explícitamente fuera de esta.

## Mecanismo

Dos vistas de solo lectura (`service_role`), recalculadas en cada
consulta — nunca una tabla que pueda quedar vieja:

- `public.wallet_v2_reconciliacion_saldos` — un miembro por fila.
- `public.wallet_v2_pases_sin_miembro` — pases sin fila de `miembros`.

## Las 8 categorías — tabla completa (Fase 2C)

El orden de la tabla es el orden real de evaluación del `case when` de
la vista (`0159`, confirmado leyendo la definición desplegada, no solo
el archivo de migración) — importa porque una fila puede cumplir más de
una condición y gana la primera que matchee.

| # | Categoría | Fixture creado | Resultado | Constraint/trigger/FK que la impide | ¿Imposible desde siempre o solo después de una migración? | ¿Puede existir en datos legacy de producción? |
|---|---|---|---|---|---|---|
| 1 | `saldo_imposible` | Ledger con una fila `ajuste = -5` sin ningún `ganado` previo (saldo -5) | ✅ clasifica `saldo_imposible` — máxima prioridad (bug de orden real encontrado y corregido en Fase 2B: un miembro con saldo negativo Y sin pase clasificaba antes como `miembro_sin_pase`, escondiendo el problema más grave) | **Ninguno.** No hay ningún `CHECK` en `transacciones_puntos` que impida que la suma de `puntos` de un miembro sea negativa — solo el propio `canjear_recompensa` valida el saldo ANTES de insertar, en su propio código, no la base | Nunca fue imposible a nivel de esquema, ni antes ni después de Wallet V2 — solo es imposible **por disciplina de las RPC** que hoy son el único camino de escritura real | **Comprobado contra remoto (solo lectura, Fase 2C): 0 miembros con saldo negativo hoy.** Sigue siendo teóricamente posible si algún día se escribe al ledger fuera de las 2 RPC (`acreditar_lealtad`/`canjear_recompensa`) — no hay una segunda barrera de base que lo impida |
| 2 | `pase_duplicado` | Se intentó crear 2 pases Apple **activos** para el mismo miembro | **Estructuralmente imposible** — rechazado por Postgres antes de que la vista pueda verlo | `pases_wallet_vigente_idx` (0138): único parcial `(miembro_id, plataforma) WHERE activo`. Antes de 0138 existía un `UNIQUE (miembro_id, plataforma)` de tabla completa, desde la creación misma de la tabla (0060) | **Imposible desde el primer día de la tabla (0060)** — 0138 solo lo relajó para permitir pases *inactivos* duplicados (herencia de fusión de personas), nunca duplicados activos | No hay ninguna ventana histórica sin protección — confirmado leyendo 0060 y 0138, no asumido. **Comprobado contra remoto: 0 miembros con más de un pase activo por plataforma** |
| 3 | `pase_sin_miembro` | Se intentó dejar un pase sin miembro | **Estructuralmente imposible** | `pases_wallet.miembro_id uuid not null references miembros(id) on delete cascade` — así desde la creación de la tabla en 0060; nunca se relajó (`grep` confirma que ninguna migración posterior le quitó el `NOT NULL` ni la FK) | **Imposible desde el primer día de la tabla (0060)** | Sin ventana histórica — **comprobado contra remoto: 0 pases sin miembro** |
| 4 | `miembro_sin_pase` | Miembro sin ninguna fila de `pases_wallet` | ✅ clasifica `miembro_sin_pase` — es un estado **normal y esperado** (un miembro recién afiliado, antes de agregar el pase a su teléfono), no un dato dañado | No aplica — es un estado válido del negocio, no un error | No aplica | Es el estado normal de cualquier miembro nuevo; no es "legacy dañado" |
| 5 | `plataformas_con_saldos_diferentes` | Miembro con ledger=7, pase Apple saldo_cache=7, pase Google saldo_cache=3 | ✅ clasifica `plataformas_con_saldos_diferentes` | Ninguno — es exactamente el tipo de drift que puede ocurrir hoy porque `pases_wallet.saldo_cache` se escribe por separado en cada fila, sin un origen único compartido hasta que exista `miembros.saldo_cache` (0159) | Posible desde siempre que existieron 2 plataformas por miembro; **0159 es justamente la migración que introduce la fuente de verdad única que lo vuelve irrelevante hacia adelante** | **Sí, y se confirmó un caso real**: el preflight de datos remotos (Fase 2C §8) encontró exactamente 1 miembro real con `pases_wallet.saldo_cache` (Google) desincronizado del ledger (`0` vs `1` recalculado) — ver `preflight-datos-remotos.md`. El backfill de `miembros.saldo_cache` (recalcula del ledger, no copia) lo corrige de una vez |
| 6 | `ledger_incompleto` | Miembro sin ninguna fila de ledger, pase con `saldo_cache=10` | ✅ clasifica `ledger_incompleto` | Ninguno — mismo origen que la categoría anterior: `saldo_cache` es una proyección que puede desincronizarse del ledger real, por diseño (es un caché, no la fuente de verdad) | Posible desde que existe `pases_wallet.saldo_cache` (0060) | Comprobado contra remoto: no se encontró ningún caso de este tipo específico hoy (el único drift real encontrado fue el de la fila 5, que es el mismo mecanismo pero con ledger no-vacío) |
| 7 | `coincide` | Miembro con ledger=5, pase Apple con `saldo_cache=5` | ✅ clasifica `coincide` — el estado sano, mayoría de los casos reales | No aplica | No aplica | Es el estado esperado; confirmado que es el estado de la inmensa mayoría de los datos reales (preflight: 1 sola discrepancia sobre 3 pases totales) |
| 8 | `requiere_decision` | Catch-all — cualquier combinación no cubierta arriba | No se forzó un caso artificial; es la rama de seguridad para lo no previsto | No aplica | No aplica | No se encontró ningún caso real clasificado acá contra producción (confirmado: el preflight no reporta ninguna fila en esta categoría) |

### Confirmación contra producción real (Fase 2C, solo lectura)

Además de los fixtures locales (que prueban que la vista clasifica
correctamente cada categoría cuando el dato existe), se corrió el
preflight de la sección 8 contra el Supabase remoto real para saber
**cuáles de estas categorías tienen algún caso real hoy**:

- `saldo_imposible`: 0 casos.
- `pase_duplicado`: 0 casos.
- `pase_sin_miembro`: 0 casos.
- `plataformas_con_saldos_diferentes` / `ledger_incompleto`: **1 caso real** (ver fila 5 arriba y `preflight-datos-remotos.md`) — no se corrigió automáticamente, queda reportado para que el backfill de 0159 lo resuelva al aplicarse.
- `coincide`: el resto (2 de 3 pases).
- `requiere_decision`: 0 casos.

No se modificó ninguna discrepancia encontrada — por instrucción
explícita de esta fase ("No modificar automáticamente una discrepancia
sin reportarla").

## Estado real en la base local (vacía, sin datos de producción)

```
select clasificacion, count(*) from wallet_v2_reconciliacion_saldos group by 1;
```

No se corrió contra producción en esta fase — la Fase 2B es
explícitamente local-only. El mecanismo está listo para correrse contra
producción (via `wallet:doctor` o un script equivalente) antes de
cualquier fase futura que cambie qué columna leen los consumidores
reales.

## Qué se escribió y qué no

- `miembros.saldo_cache` se escribió para el **100% de los miembros**
  (recalculado del ledger), incluidas las filas que la vista clasifica
  como discrepancia — es seguro porque *ningún código de producción lee
  esta columna todavía* (confirmado: `grep` en `src/` no encuentra
  ningún `.select` que la pida). El valor escrito es siempre el
  correcto según la fuente de verdad (el ledger); lo que puede estar
  "mal" es el `pases_wallet.saldo_cache` viejo, que esta migración NO
  toca ni corrige — solo lo deja visible en la vista de reconciliación
  para que una fase futura decida qué hacer antes de apagarlo.
- Ninguna discrepancia se sobrescribió en silencio: la vista queda
  como registro permanente y consultable, no como un log que se pierde.
