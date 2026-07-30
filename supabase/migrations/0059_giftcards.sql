-- ============================================================
-- BOOKEA — Giftcards por negocio (0059)
--
-- Fase 1 del sistema de tickets internos: cada negocio puede vender
-- giftcards de un monto que el beneficiario canjea en el local (o,
-- más adelante, contra una reserva en línea). El código es único en
-- toda la plataforma para poder canjearlo sin decir de qué negocio es.
--
--  - `monto` es lo comprado; `saldo` lo que queda por canjear (los
--    canjes parciales restan de ahí).
--  - Estados: activa → canjeada (saldo 0) · vencida (pasó vence_en).
--  - Fase 1 sin pasarela: las ventas las registra el negocio (o el
--    equipo de Bookea) y el canje es presencial.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists giftcards (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  codigo text not null unique check (char_length(codigo) between 6 and 24),
  monto numeric not null check (monto > 0),
  saldo numeric not null check (saldo >= 0),
  comprador_id uuid references auth.users(id) on delete set null,
  comprador_nombre text,
  comprador_correo text,
  beneficiario_nombre text,
  mensaje text check (mensaje is null or char_length(mensaje) <= 300),
  estado text not null default 'activa' check (estado in ('activa', 'canjeada', 'vencida')),
  vence_en date,
  canjeada_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists giftcards_rancho_idx on giftcards (rancho_id, created_at desc);
create index if not exists giftcards_comprador_idx on giftcards (comprador_id);

alter table giftcards enable row level security;

-- El dueño del negocio (o un admin) ve sus ventas.
drop policy if exists "El dueño ve las giftcards de su negocio" on giftcards;
create policy "El dueño ve las giftcards de su negocio" on giftcards
  for select to authenticated
  using (
    exists (
      select 1 from ranchos r
      where r.id = rancho_id
        and (r.owner_id = auth.uid() or is_admin())
    )
  );

-- Quien compró la suya la ve en su cuenta.
drop policy if exists "El comprador ve sus giftcards" on giftcards;
create policy "El comprador ve sus giftcards" on giftcards
  for select to authenticated
  using (comprador_id = auth.uid());

grant select on giftcards to authenticated;

-- Sin políticas de insert/update para usuarios: en la fase 1 las
-- ventas y canjes entran por el servidor (service role). La pasarela
-- de pago del cliente llegará con su propia migración.
