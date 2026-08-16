-- ============================================================
-- WALLET V2 — Migración E: identidad Apple (versión de token) +
-- identidad Google (revisión, hash de payload)
-- ============================================================

-- ------------------------------------------------------------
-- Apple: versión del authenticationToken.
--
-- null/0  = LEGACY. El token real sigue siendo el valor guardado en
--           `auth_token`, tal cual funciona hoy. No se toca ni un
--           pase existente — "no cambiar el token de un pase ya
--           instalado" es una regla dura de esta fase.
-- 1       = HMAC v1. El token NO se guarda en claro: se recalcula al
--           vuelo con HMAC-SHA256(APPLE_PASS_AUTH_SECRET_V1,
--           passTypeIdentifier + ":" + serialNumber) — ver
--           src/lib/wallet/config/auth-token.ts. `auth_token` queda
--           NULL para estos pases: no hay nada sensible que guardar.
-- ------------------------------------------------------------
alter table pases_wallet
  add column if not exists auth_token_version integer not null default 0
    check (auth_token_version >= 0);

-- Los pases existentes son, por definición, legacy — backfill
-- explícito y no solo el DEFAULT, para que quede documentado en el
-- propio dato por qué son 0 y no "todavía no se sabe".
update pases_wallet set auth_token_version = 0 where auth_token_version is null;

comment on column pases_wallet.auth_token_version is
  'Wallet V2 — 0 = legacy (auth_token guardado en claro, como '
  'siempre). >=1 = HMAC versionado, recalculado al vuelo, nunca '
  'guardado (ver src/lib/wallet/config/auth-token.ts). Nunca se '
  'migra un pase existente de 0 a otro valor automáticamente.';

-- `auth_token` pasa a ser NULLABLE: los pases HMAC (version >= 1) no
-- guardan nada ahí — "no guardar el token derivado en claro" es una
-- regla dura de esta fase, y no hay ninguna otra razón para que la
-- columna siga exigiendo un valor. Los pases legacy (version = 0, el
-- 100% de los reales hoy) siguen escribiéndola exactamente igual que
-- siempre; el CHECK de abajo es lo que impide que un pase legacy
-- quede sin su token real por error.
alter table pases_wallet alter column auth_token drop not null;

alter table pases_wallet drop constraint if exists pases_wallet_token_coherente;
alter table pases_wallet add constraint pases_wallet_token_coherente
  check (
    (auth_token_version = 0 and auth_token is not null)
    or (auth_token_version >= 1)
  );

-- ------------------------------------------------------------
-- Google: revisión remota + hash del último payload confirmado.
-- ------------------------------------------------------------
alter table pases_wallet
  add column if not exists google_revision text,
  add column if not exists google_ultimo_payload_hash text,
  add column if not exists ultima_generacion_en timestamptz,
  add column if not exists motivo_ultima_generacion text
    check (motivo_ultima_generacion is null or motivo_ultima_generacion in
      ('emision', 'saldo', 'diseno', 'pausa', 'reinstalacion'));

comment on column pases_wallet.google_ultimo_payload_hash is
  'Wallet V2 — SHA-256 del último cuerpo de PATCH CONFIRMADO por '
  'Google (sobre JSON canónico, claves ordenadas). Es un chequeo '
  'barato de "¿hay algo nuevo que mandar?", NUNCA una prueba de que '
  'Google lo recibió — esa confirmación es la respuesta HTTP o una '
  'lectura posterior de la API (Fase 4), no este hash local.';
