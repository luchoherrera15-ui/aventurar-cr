# ERD — Wallet V2

> **Actualización Fase 2B**: implementado tal cual. `WALLET_SYNC_PENDIENTE`
> se llama, en el esquema real, `wallet_sincronizaciones` — ver
> `fase-2b-resultado.md`.

> Estado propuesto. Las tablas marcadas `NUEVA` no existen todavía; el
> resto ya existe y solo gana columnas (ver `modelo-propuesto.md` para el
> detalle exacto). `ranchos` se incluye por la costura con `cuentas`, no
> porque Wallet V2 la modifique.

```mermaid
erDiagram
    RANCHOS ||--o| CUENTAS : "costura opcional (rancho_id, unique, on delete set null)"
    CUENTAS ||--o{ PROGRAMA_LEALTAD : "cuelga de (cuenta_id, nullable hoy — ver decisiones-tablas.md §2)"
    RANCHOS ||--o{ PROGRAMA_LEALTAD : "cuelga de (rancho_id, NOT NULL, siempre poblado)"
    PROGRAMA_LEALTAD ||--o{ MIEMBROS : "afilia"
    PERSONAS ||--o{ MIEMBROS : "identidad real"
    PERSONAS ||--o{ PERSONAS_NEGOCIO : "permiso por negocio"
    MIEMBROS ||--o{ PASES_WALLET : "instancia por plataforma"
    PASES_WALLET ||--o{ REGISTROS_DISPOSITIVO : "M:N vía serial_number"
    MIEMBROS ||--o{ TRANSACCIONES_PUNTOS : "ledger"
    TRANSACCIONES_PUNTOS |o--o| TRANSACCIONES_PUNTOS : "reversion_de"
    PROGRAMA_LEALTAD ||--o{ RECOMPENSAS : "catálogo"
    MIEMBROS ||--o{ CANJES : "consume"
    RECOMPENSAS ||--o{ CANJES : "paga"
    CANJES |o--|| TRANSACCIONES_PUNTOS : "transaccion_id (1:1)"
    MIEMBROS ||--o{ INTENTOS_CANJE : "auditoría, incluidos rechazos"
    PASES_WALLET ||--o{ WALLET_SYNC_PENDIENTE : "NUEVA — pendientes de sincronizar"

    RANCHOS {
        uuid id PK
        uuid owner_id FK "auth.users, on delete cascade"
        text estado
        text plan_lealtad "respaldo de transición, no fuente de verdad"
    }
    CUENTAS {
        uuid id PK
        uuid owner_id FK "auth.users"
        uuid rancho_id FK "unique, nullable"
        text plan "fuente de verdad del plan desde 0134"
    }
    PROGRAMA_LEALTAD {
        uuid id PK
        uuid rancho_id FK "NOT NULL"
        uuid cuenta_id FK "nullable — ver §2 decisiones-tablas.md"
        text modo "sellos, puntos, cashback..."
        jsonb beneficio
        text pase_color_fondo
        text pase_logo_url "pasa a ser RUTA de storage, no URL completa"
        int diseno_version "NUEVA columna"
        boolean cuenta_id_confirmada "NUEVA, temporal"
    }
    PERSONAS {
        uuid id PK
        text telefono "único parcial normalizado"
        text correo "único parcial normalizado"
        uuid cliente_id FK "auth.users, nullable, on delete set null"
        uuid fusionada_en FK "auto-referencia"
    }
    PERSONAS_NEGOCIO {
        uuid persona_id FK
        uuid rancho_id FK "nullable"
        uuid cuenta_id FK "nullable"
    }
    MIEMBROS {
        uuid id PK
        uuid programa_id FK
        uuid persona_id FK "llave real desde 0138"
        uuid cliente_id FK "nullable, on delete set null"
        text estado "activa, pausada, cancelada"
        int saldo_cache "NUEVA — se mueve acá desde pases_wallet"
        timestamptz saldo_actualizado_en "NUEVA"
    }
    PASES_WALLET {
        uuid id PK
        uuid miembro_id FK
        text plataforma "apple | google"
        text serial_number UK
        text auth_token
        boolean activo
        text objeto_externo "Object ID de Google, sobrevive fusiones"
        bigint update_tag "NUEVA"
        text google_revision "NUEVA"
        text motivo_ultima_generacion "NUEVA"
    }
    REGISTROS_DISPOSITIVO {
        text device_library_id PK
        text serial_number PK
        text push_token
        timestamptz ultimo_push_en "NUEVA"
        int ultimo_push_status "NUEVA"
        int intentos_fallidos "NUEVA"
    }
    TRANSACCIONES_PUNTOS {
        uuid id PK
        uuid miembro_id FK
        text tipo "ampliado — ver modelo-propuesto.md §5"
        int puntos
        int saldo_anterior
        int saldo_posterior
        text referencia "idempotencia real, único parcial"
        uuid reversion_de FK "auto-referencia"
        text unidad "NUEVA"
        uuid correlation_id "NUEVA"
        bigint compra_base_colones "NUEVA, cashback"
        int basis_points "NUEVA, cashback"
    }
    RECOMPENSAS {
        uuid id PK
        uuid programa_id FK
        int costo_puntos
        int stock_total "contado bajo lock, no decrementado"
        int limite_por_cliente
    }
    CANJES {
        uuid id PK
        uuid miembro_id FK
        uuid recompensa_id FK
        uuid transaccion_id FK "1:1 con el ledger"
        text estado "pendiente, entregado, anulado"
        uuid entregado_por FK "auth.users"
    }
    INTENTOS_CANJE {
        uuid id PK
        uuid miembro_id FK
        boolean aprobado
        text motivo
    }
    WALLET_SYNC_PENDIENTE {
        uuid id PK "NUEVA TABLA"
        uuid pase_id FK
        text motivo "saldo, diseno, pausa, mensaje_promocional"
        uuid correlation_id
        int intentos
        timestamptz proximo_intento_en
        text reclamado_por
        text ultimo_error
        timestamptz completado_en
    }
```

## Lectura del diagrama

- **Dos padres de `programa_lealtad`** (`rancho_id` siempre, `cuenta_id` a
  veces) son intencionalmente ambos visibles — es el hallazgo central de
  la Fase 2A, no un error de diagramación. Cualquier código nuevo debe
  tratar `cuenta_id` como opcional hasta que el backfill de producto se
  confirme.
- `PASES_WALLET` ya no tiene columna de saldo en este diagrama — se
  movió a `MIEMBROS` (§4 de `decisiones-tablas.md`).
- `WALLET_SYNC_PENDIENTE` es la única entidad nueva de todo el diagrama.
- `REGISTROS_DISPOSITIVO` se dibuja M:N con `PASES_WALLET` a través de
  `serial_number` (no hay FK de objeto directa en el modelo actual, es
  una relación por valor — se mantiene así, ya funciona).
