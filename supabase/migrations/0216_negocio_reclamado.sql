-- ════════════════════════════════════════════════════════════════════
--  ¿EL DUEÑO YA RECLAMÓ SU NEGOCIO?
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (26 ago 2026): «una leyenda de Verificado y de Info
-- Pública. Este será el card que tengan los negocios que ingresamos en
-- el seed, reales, pero que aún su dueño no los reclama».
--
-- ── SON DOS PREGUNTAS DISTINTAS, NO UNA ESCALA ──────────────────────
--
-- `verificado` (0214) responde: ¿los datos son ciertos?
-- `reclamado`  (esta)         responde: ¿los administra su dueño?
--
-- No son el mismo eje ni uno es «más» que el otro. Un negocio que
-- nosotros sembramos con información pública real tiene datos ciertos
-- y NO tiene dueño adentro. Uno que se registró solo tiene dueño
-- adentro y todavía nadie le comprobó nada.
--
-- Meterlas en una sola columna de estados («nuevo → info pública →
-- verificado») las volvería una escalera, y el día que un negocio
-- reclamado pierda la verificación no habría escalón donde ponerlo.
--
-- ── QUÉ CAMBIA EN LA TARJETA ────────────────────────────────────────
--
--   verificado y NO reclamado  →  «Info pública»
--   verificado y sí reclamado  →  «Verificado»
--   sin verificar              →  lo de siempre («Nuevo» o nada)
--
-- Es una distinción HONESTA, y esa es la razón de fondo. Cuando
-- sembramos un negocio con su información pública, lo que podemos
-- afirmar es que los datos son reales — no que el negocio esté
-- atendiendo por acá ni que alguien de adentro esté mirando las
-- reservas. Decir «Verificado» ahí promete de más.
--
-- ── EL DEFAULT ES `true`, Y ES AL REVÉS DE LO QUE PARECE ────────────
--
-- El camino normal de alta es una persona publicando SU negocio: nace
-- reclamado. Los que no lo están son la excepción —los que sembramos
-- nosotros— y esos lo dicen explícitamente en su script de seed.
--
-- Con el default en `false` pasaría lo contrario: cada dueño que se
-- registre solo aparecería como «no reclamado» hasta que alguien se
-- acuerde de marcarlo, o sea que la mayoría estaría mal etiquetada.

alter table public.ranchos
  add column if not exists reclamado boolean not null default true;

comment on column public.ranchos.reclamado is
  'Su dueño real lo administra. false = lo sembramos nosotros con información pública y todavía nadie lo reclamó. Ver 0216.';

-- ── LOS QUE HOY NO ESTÁN RECLAMADOS ─────────────────────────────────
--
-- Los tres negocios publicados están a nombre de la cuenta interna de
-- Bookea (luchoherrera15@gmail.com), no de su dueño real: Rancho Las
-- Torres, SILENCE BARBER SHOP y Glow Nails Studio. Los tres se
-- sembraron desde `scripts/seed-*.mjs`.
--
-- Se marcan por el DUEÑO y no por una lista de slugs a mano: la
-- pregunta que importa es «¿hay alguien de afuera adentro?», y una
-- lista escrita a dedo se desactualiza sin avisar.

update public.ranchos r
set reclamado = false
from public.perfiles p
where p.id = r.owner_id
  and p.email = 'luchoherrera15@gmail.com';

-- ── EL PERMISO DE LECTURA ───────────────────────────────────────────
--
-- ⚠️ SIN ESTO EL MARKETPLACE SE APAGA. `ranchos` tiene permisos POR
-- COLUMNA: pedir una columna sin grant hace que Postgres RECHACE LA
-- CONSULTA ENTERA con «permission denied», y las listas quedan vacías
-- sin un solo error a la vista. Pasó con `verificado` — ver la 0215.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ranchos' and column_name = 'reclamado'
  ) then
    execute 'grant select (reclamado) on table public.ranchos to anon';
    execute 'grant select (reclamado) on table public.ranchos to authenticated';
  end if;
end $$;

-- ── QUIÉN PUEDE ESCRIBIRLO ──────────────────────────────────────────
--
-- El mismo candado que `verificado`, por el mismo motivo: las políticas
-- de `ranchos` dejan al dueño editar su fila, y «ya me reclamé» no es
-- algo que uno se conceda solo. El trigger de la 0214 se reemplaza por
-- uno que cuida las DOS columnas.

create or replace function public.ranchos_verificado_solo_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verificado is distinct from old.verificado and not public.is_admin() then
    raise exception 'Solo un administrador de Bookea puede verificar un negocio.'
      using errcode = '42501';
  end if;
  if new.reclamado is distinct from old.reclamado and not public.is_admin() then
    raise exception 'Solo un administrador de Bookea puede marcar un negocio como reclamado.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
