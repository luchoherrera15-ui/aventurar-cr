-- ════════════════════════════════════════════════════════════════════
--  LA PREGUNTA ERA OTRA: `reclamado` → `info_publica`
-- ════════════════════════════════════════════════════════════════════
--
-- La 0216 modeló mal el sello, y esto lo corrige.
--
-- ── QUÉ ENTENDÍ MAL ─────────────────────────────────────────────────
--
-- Puse `reclamado`, o sea «¿el dueño tiene la cuenta y lo administra?».
-- Con eso, los tres negocios publicados quedaron en «Info pública»,
-- porque los tres están todavía bajo la cuenta interna de Bookea.
--
-- El dueño lo corrigió: «esos ambos ponelos en VERIFICADO, y el rancho
-- también. Todos los que los cree una persona y no sean sembrados por
-- vos son VERIFICADOS».
--
-- La pregunta no es de QUIÉN ES LA CUENTA. Es SI HAY UNA PERSONA
-- DETRÁS. Glow Nails mandó sus fotos y su lista de precios; SILENCE y
-- Rancho Las Torres son negocios reales con gente real atrás. Que la
-- cuenta siga siendo nuestra es un trámite pendiente, no una duda sobre
-- si el negocio existe — y el sello habla de lo segundo.
--
-- «Info pública» queda para lo que de verdad lo es: una ficha armada
-- con datos de fuentes públicas, sin que nadie de ese negocio haya
-- participado. Hoy no hay ninguna, y está bien que el estado exista
-- vacío: es el que va a hacer falta el día que se carguen negocios en
-- volumen desde directorios públicos.
--
-- ── POR QUÉ SE RENOMBRA EN VEZ DE SOLO CAMBIAR LOS DATOS ────────────
--
-- Se podría haber puesto `reclamado = true` en los tres y listo. Pero
-- entonces la columna se llamaría «reclamado» y querría decir otra
-- cosa, y el próximo que la lea va a creer que dice si el dueño entró.
--
-- Un nombre que miente es exactamente lo que causó este error. Se
-- arregla el nombre.
--
-- ── Y SE INVIERTE, QUE NO ES UN DETALLE ─────────────────────────────
--
-- `info_publica` con default `false` deja el caso normal —un negocio
-- real, con gente atrás— sin tener que marcar nada. La excepción es la
-- que se declara. Al revés, cada negocio nuevo nacería necesitando que
-- alguien se acuerde de marcarlo, y el que se olvide sale con el sello
-- flojo sin que nadie lo note.

alter table public.ranchos
  add column if not exists info_publica boolean not null default false;

comment on column public.ranchos.info_publica is
  'La ficha se armó con datos de fuentes públicas y NADIE de ese negocio participó. false (lo normal) = hay una persona real detrás. Junto con `verificado` decide el sello de la tarjeta. Ver 0217.';

-- Nadie queda como «info pública»: los tres negocios publicados tienen
-- gente real atrás. El default ya es `false`, así que no hace falta un
-- update — se deja dicho para que la ausencia no se lea como olvido.

-- ── FUERA LA COLUMNA VIEJA ──────────────────────────────────────────
--
-- Vivió unas horas y nunca llegó a significar lo que su nombre decía.
-- Dejarla «por si acaso» sería dejar dos columnas que responden
-- parecido y que se van a contradecir la primera vez que alguien
-- escriba una y no la otra.

alter table public.ranchos drop column if exists reclamado;

-- ── EL PERMISO DE LECTURA ───────────────────────────────────────────
--
-- ⚠️ SIN ESTO EL MARKETPLACE SE APAGA. `ranchos` tiene permisos POR
-- COLUMNA: pedir una sin grant hace que Postgres RECHACE LA CONSULTA
-- ENTERA y las listas quedan vacías, sin un error a la vista. Ver 0215.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ranchos' and column_name = 'info_publica'
  ) then
    execute 'grant select (info_publica) on table public.ranchos to anon';
    execute 'grant select (info_publica) on table public.ranchos to authenticated';
  end if;
end $$;

-- ── EL CANDADO, AHORA SOBRE LA COLUMNA QUE QUEDA ────────────────────
--
-- Mismo motivo que `verificado`: las políticas de `ranchos` dejan al
-- dueño editar su fila, y de qué fuente salieron los datos de su ficha
-- no es algo que él decida.

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
  if new.info_publica is distinct from old.info_publica and not public.is_admin() then
    raise exception 'Solo un administrador de Bookea puede cambiar el origen de los datos de un negocio.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
