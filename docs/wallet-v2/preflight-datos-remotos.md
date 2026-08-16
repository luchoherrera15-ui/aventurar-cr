# Preflight de datos remotos — Wallet V2 (Fase 2C, sección 8)

> Conteos y relaciones de solo lectura, vía `scripts/preflight-remoto.mjs`
> (misma base de solo lectura que `drift-remoto.mjs` —
> `BEGIN TRANSACTION READ ONLY; ...; COMMIT;`, probado antes contra
> local). No se imprime PII: sin nombres, correos, teléfonos, tokens,
> push tokens ni seriales completos. Los IDs de fila que aparecen en
> hallazgos de conflicto están truncados a 8 caracteres — alcanza para
> correlacionar entre las tablas de esta misma corrida, no para
> reconstruir un UUID real ni buscarlo en la base.

## Conteos base

| Métrica | Valor | Clasificación |
|---|---|---|
| Cuentas | 1 | Dato válido |
| Programas de lealtad | 1 | Dato válido |
| Programas con `cuenta_id` NULL | 1 | **Dato legacy** — el único programa real todavía no está enlazado a su cuenta (esperado; coincide con lo ya documentado en `plan-migraciones.md`: "hoy sería 0%"). Se resuelve con el backfill de 0157 |
| Programas con `cuenta_id` presente | 0 | — |
| Miembros | 2 | Dato válido |
| Pases Apple | 2 | Dato válido |
| Pases Google | 1 | Dato válido |
| Miembros con más de un pase en la misma plataforma | 0 | Dato válido — nada que reconciliar |
| Pases sin miembro | 0 | Dato válido (estructuralmente imposible hoy, `miembro_id NOT NULL`; se confirmó igual, no se asumió) |
| Miembros sin programa | 0 | Dato válido (misma razón) |
| Movimientos del ledger sin miembro | 0 | Dato válido |
| Canjes | 0 | Dato válido |
| Intentos de canje | 0 | Dato válido |
| Registros de dispositivo Apple | 1 | Dato válido |
| Registros Apple huérfanos (serial sin pase) | 0 | Dato válido |
| Seriales con más de un dispositivo registrado | 0 | Dato válido |
| Programas con dos o más cuentas candidatas (ambigüedad de backfill) | 0 | Dato válido — confirma que `cuentas.rancho_id UNIQUE` se cumple en los datos reales, no solo en el constraint |
| Colaboradores (`rancho_colaboradores`, legacy) | 1 | Dato legacy — pendiente de 0158 |
| Colaboradores sin cuenta enlazable | 0 | Dato válido — el único colaborador ya tiene una cuenta con el mismo `rancho_id` disponible para enlazar |
| Filas en `cuentas_equipo` (canónico) | 1 | Dato válido |
| Conflictos de ownership (`cuentas.owner_id` ≠ `ranchos.owner_id`) | 0 | Dato válido |

## Hallazgo real: 1 saldo divergente

```
miembro_id (truncado): 4ba6baf0
plataforma: google
saldo_cache actual (en pases_wallet): 0
saldo real recalculado del ledger:    1
```

**Clasificación: Dato ambiguo — investigado, no corregido automáticamente**
(por instrucción explícita de esta fase: "No modificar automáticamente
una discrepancia sin reportarla").

**Qué significa**: hoy el saldo que ve el pase de Google de este
miembro (`saldo_cache = 0`) no coincide con la suma real de su ledger
(`transacciones_puntos` suma 1). Es el mismo tipo de drift que
`migracion-legacy.md` ya anticipaba como posible entre `pases_wallet`
de Apple y Google del mismo miembro — y es exactamente lo que la
migración 7 del plan (backfill de `miembros.saldo_cache`) corrige,
porque **recalcula desde el ledger** en vez de copiar el valor viejo.

**No es bloqueante para aplicar 0159 + el backfill** — al contrario, es
la evidencia de que el backfill hace falta y de que su diseño (recalcular,
no copiar) es el correcto para este caso concreto. Si el backfill
hubiera copiado `pases_wallet.saldo_cache` tal cual, este miembro habría
arrancado la Fase 3 con un saldo incorrecto (0 en vez de 1).

**Contexto adicional, no verificable por esta consulta**: los datos
reales de Wallet V2 en producción hoy son, según la memoria del
proyecto, datos de demo/prueba (negocio Steph Nails) — no hay manera de
confirmar por SQL si la divergencia viene de una prueba manual sin
ledger correspondiente o de un bug real; por eso se reporta como
hallazgo y no se descarta como "solo es demo".

## Resumen de clasificación

- **Dato válido**: la inmensa mayoría — 0 huérfanos, 0 ambigüedades, 0
  conflictos de ownership, 0 miembros con passes duplicados por
  plataforma.
- **Dato legacy**: el programa sin `cuenta_id` enlazado y el colaborador
  todavía en `rancho_colaboradores` — ambos ya tienen su migración de
  backfill diseñada (0157, 0158) y no requieren intervención manual
  antes de aplicar.
- **Dato ambiguo**: el único caso es el saldo divergente de arriba —
  reportado, no corregido, resuelto por diseño en el backfill de saldo
  (no en esta fase).
- **Dato huérfano**: ninguno encontrado.
- **Dato incompatible con la migración**: ninguno encontrado — el
  volumen real (1 cuenta, 1 programa, 2 miembros, 3 pases, 0 canjes) es
  lo bastante chico como para que cualquier migración de este lote
  corra en menos de un segundo, y lo bastante simple como para no
  ocultar ningún caso de los 8 de `reconciliacion-saldos.md` salvo el ya
  reportado arriba.
