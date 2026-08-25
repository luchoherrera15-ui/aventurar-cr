-- ═══════════════════════════════════════════════════════════════════
-- LEALTAD — mensaje configurable en los hitos + aviso fijo cuando la
-- tarjeta cambia de diseño (0205)
--
-- ── 1. programa_lealtad.mensaje_hito ─────────────────────────────────
-- El texto que el DUEÑO configura en Marketing (máx 120 caracteres),
-- para mandarse SOLO en los mismos 3 momentos que ya usa el correo de
-- hitos (`hitoDelSaldo()`, src/lib/correo/sello-acreditado.ts): primer
-- sello, penúltimo, meta alcanzada. NUNCA en cada sello — ese camino ya
-- se apagó una vez por spam (ver el comentario de cabecera de ese
-- archivo) y esta columna no lo reabre.
--
-- ── 2. miembros.ultimo_hito_mensaje ──────────────────────────────────
-- El mensaje de ARRIBA, copiado acá cuando el hito de ESTE miembro
-- dispara. Es POR MIEMBRO y no por programa a propósito: cada cliente
-- llega a su hito en un momento distinto, y el campo del reverso del
-- pase (`tarjeta.ts`) necesita un valor propio por persona para que
-- `changeMessage` dispare el aviso en SU teléfono en el momento que le
-- toca a él, no a todo el programa junto.
--
-- ── 3. programa_lealtad.diseno_cambiado_en ───────────────────────────
-- Cuándo fue la ÚLTIMA vez que el dueño guardó un cambio de diseño
-- (colores, regalía, etc.). El texto del aviso ("La tarjeta de su pase
-- de lealtad de X acaba de cambiar") no es configurable — sale fijo,
-- construido en código (tarjeta.ts) a partir del nombre del negocio y
-- esta fecha. La fecha viaja en el VALOR del campo del reverso
-- justamente para que cada cambio de diseño sea un valor distinto al
-- anterior y `changeMessage` dispare de nuevo — un texto fijo sin nada
-- que cambie solo avisaría la primera vez.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

alter table public.programa_lealtad
  add column if not exists mensaje_hito text;

alter table public.programa_lealtad
  drop constraint if exists programa_lealtad_mensaje_hito_largo;
alter table public.programa_lealtad
  add constraint programa_lealtad_mensaje_hito_largo
  check (mensaje_hito is null or char_length(mensaje_hito) <= 120);

alter table public.programa_lealtad
  add column if not exists diseno_cambiado_en timestamptz;

alter table public.miembros
  add column if not exists ultimo_hito_mensaje text;

comment on column public.programa_lealtad.mensaje_hito is
  '0205: mensaje configurable (máx 120 caracteres) que se manda SOLO en los hitos de cada miembro (primer sello, penúltimo, meta) — nunca en cada sello. null = no se manda nada en los hitos.';
comment on column public.miembros.ultimo_hito_mensaje is
  '0205: copia del mensaje_hito del programa en el momento en que ESTE miembro llegó a su último hito. Alimenta el changeMessage del pase — cambia solo en cada hito real, nunca en un sello intermedio.';
comment on column public.programa_lealtad.diseno_cambiado_en is
  '0205: cuándo se guardó el último cambio de diseño de la tarjeta. Alimenta el aviso fijo "la tarjeta acaba de cambiar" — el texto no se guarda acá, se arma en tarjeta.ts a partir del nombre del negocio y esta fecha.';

notify pgrst, 'reload schema';
