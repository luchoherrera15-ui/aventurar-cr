-- ============================================================
-- BOOKEA — Invitaciones en el catálogo de ejemplos (0074)
--
-- El creador con IA puede marcar una invitación para que aparezca
-- como ejemplo en la landing (/invitaciones#catalogo). Solo se
-- muestran las que además están 'activa', así que la política de
-- lectura pública de 0066 ya alcanza.
--
-- Lo que se publica NO es la invitación viva del cliente sino una
-- COPIA marcada `es_ejemplo`: así ningún visitante de la landing
-- puede meter confirmaciones falsas en la lista de invitados real
-- (la página esconde el RSVP en las copias).
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table invitaciones
  add column if not exists en_catalogo boolean not null default false,
  add column if not exists es_ejemplo boolean not null default false;

-- Índice parcial: la landing pide justo estas pocas filas.
create index if not exists invitaciones_catalogo_idx
  on invitaciones (created_at desc)
  where en_catalogo and estado = 'activa';
