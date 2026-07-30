-- ============================================================
-- 0065 — Gastos de la plataforma etiquetados por sección
--
-- El panel admin ahora lleva balances por sección (agendas/citas,
-- eventos, hospedajes). Los ingresos ya salen por sección vía la
-- vertical del negocio; esta migración deja etiquetar también cada
-- gasto: null = gasto general de la plataforma (hosting, dominio...),
-- que solo se cuenta en la vista "Todas".
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table gastos add column if not exists vertical text
  check (vertical in ('citas', 'eventos', 'hospedajes'));

create index if not exists gastos_vertical_idx on gastos (vertical);
