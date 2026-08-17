-- ============================================================
-- 0181 — NADIE SE AFILIA SIN DEJAR SUS DATOS
--
-- Pedido del dueño, textual: «NECESITAMOS SABER QUIÉN SE REGISTRA,
-- TENER UN CONTROL COMPLETO DE A QUIÉN SE LE ENTREGAN SELLOS».
--
-- ------------------------------------------------------------
-- QUÉ PASÓ, MEDIDO CONTRA PRODUCCIÓN
-- ------------------------------------------------------------
-- De 5 miembros de lealtad, 3 no tenían fila en `personas_negocio` ni
-- en `consentimientos_persona`. O sea: tres personas con tarjeta y con
-- sellos a las que el negocio, según su propio modelo de permisos
-- (0138:327 — «un negocio ve a una persona solo si tiene fila acá»), ni
-- siquiera debería poder ver. Y sin el respaldo que exige la Ley 8968.
--
-- La causa: hay TRES puertas que crean miembros y solo UNA escribe esas
-- dos filas.
--
--   · `alta_persona_por_qr` (0138:1903) — el formulario del póster.
--     Escribe persona, vínculo, consentimiento y membresía en UNA
--     transacción. Esta está bien y es el modelo a copiar.
--   · `generar.ts:227` — el botón «Agregar a Apple Wallet».
--     `insert into miembros` a secas.
--   · `google.ts:558` — el botón de Google Wallet. Idéntico.
--
-- Las dos últimas son rutas GET públicas cuyo único parámetro es el id
-- del negocio. El trigger `miembros_persona` (0138:1001) les resolvía
-- una persona desde `auth.users` y el alta quedaba hecha: sin nombre
-- (no hay `perfiles`), sin correo (la sesión anónima del chat flotante
-- lo tiene vacío), sin vínculo y sin consentimiento.
--
-- ------------------------------------------------------------
-- POR QUÉ ESTO VA EN LA BASE Y NO SOLO EN TYPESCRIPT
-- ------------------------------------------------------------
-- El arreglo de TypeScript ya está puesto: las dos rutas comprueban la
-- afiliación antes de llamar al generador (`personas.ts`,
-- `afiliacionDeQuienPide`). Eso cierra las tres puertas que existen HOY.
--
-- Este trigger cierra las que se abran MAÑANA. Es la diferencia entre
-- «ningún llamador actual escribe mal» y «la base no acepta que se
-- escriba mal»: la primera se rompe la próxima vez que alguien agregue
-- un cuarto camino —una importación, un seed, un panel de admin— y no
-- se acuerde de las dos filas. Y se rompería en silencio, exactamente
-- como se rompió esta vez.
--
-- ------------------------------------------------------------
-- QUÉ NO HACE
-- ------------------------------------------------------------
-- No toca ninguna fila existente. Los 3 miembros que ya están mal
-- SIGUEN ESTANDO MAL después de correr esto, a propósito: apagarles la
-- tarjeta sería quitarles sellos que ganaron. Se regularizan a mano,
-- con el SQL comentado de `docs/regularizar-afiliaciones-sin-datos.sql`
-- o desde el panel («Completar datos» en la ficha del cliente).
--
-- Es `before insert` y NO `before update`: mover el estado de una
-- membresía vieja a 'pausada' no puede fallar por una fila que le falta
-- desde antes de que esta regla existiera.
-- ============================================================


-- ------------------------------------------------------------
-- 1. El portero de `miembros`
--
-- Corre DESPUÉS de `miembros_persona` (0138:1001), que es el que
-- resuelve `persona_id` cuando viene null. El orden entre triggers del
-- mismo evento en Postgres es alfabético por nombre, y
-- `miembros_persona` < `miembros_zexigir_respaldo`: por eso el nombre
-- lleva la z. Sin ese orden, este trigger vería `persona_id` en null en
-- el alta por cuenta y rebotaría a todo el mundo.
-- ------------------------------------------------------------

create or replace function public.miembros_exigir_respaldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho uuid;
  v_cuenta uuid;
begin
  -- Sin persona no hay a quién exigirle respaldo, y además es un estado
  -- que `miembros_persona` ya rebotó con su propio mensaje. Que la
  -- excepción la tire el trigger que sabe explicarla.
  if new.persona_id is null then
    return new;
  end if;

  select p.rancho_id, p.cuenta_id
    into v_rancho, v_cuenta
    from programa_lealtad p
   where p.id = new.programa_id;

  -- El programa cuelga de una cuenta, de un rancho o de las dos (0134).
  -- Si no cuelga de nada, no hay negocio contra el cual comprobar el
  -- vínculo: es una fila rota que no debería existir, y frenar acá con
  -- un mensaje raro solo taparía el problema de más arriba.
  if v_rancho is null and v_cuenta is null then
    return new;
  end if;

  -- ── EL VÍNCULO ────────────────────────────────────────────────
  -- `personas_negocio` ES el permiso del negocio para ver a esta
  -- persona (0138:327). Una membresía sin vínculo es una tarjeta que el
  -- dueño no tiene derecho a mirar — y que, sin embargo, le aparece en
  -- la lista, porque el panel lee con la llave de servicio.
  --
  -- El OR y no el AND: `alta_persona_por_qr` escribe las columnas que
  -- el programa tenga (0138:2009), así que un programa de solo-cuenta
  -- deja `rancho_id` en null y al revés. Exigir las dos rebotaría al
  -- camino bueno.
  if not exists (
    select 1 from personas_negocio pn
     where pn.persona_id = new.persona_id
       and ((v_cuenta is not null and pn.cuenta_id = v_cuenta)
         or (v_rancho is not null and pn.rancho_id = v_rancho))
  ) then
    raise exception
      'Esta persona no tiene vínculo con el negocio: no se puede afiliar sin pasar por el alta'
      using errcode = '23514',
            hint = 'Usá alta_persona_por_qr, que escribe vínculo y consentimiento en la misma transacción.';
  end if;

  -- ── EL CONSENTIMIENTO ─────────────────────────────────────────
  -- Cualquier fila de ámbito 'negocio' sirve, aceptada O revocada: lo
  -- que la Ley 8968 pide poder demostrar es que la casilla se MOSTRÓ,
  -- no que se marcó (0138:2058). Un «no quiero promos» documentado es
  -- respaldo; el vacío no es nada.
  if not exists (
    select 1 from consentimientos_persona c
     where c.persona_id = new.persona_id
       and c.ambito = 'negocio'
       and ((v_cuenta is not null and c.cuenta_id = v_cuenta)
         or (v_rancho is not null and c.rancho_id = v_rancho))
  ) then
    raise exception
      'Esta persona no tiene consentimiento registrado para este negocio'
      using errcode = '23514',
            hint = 'Usá alta_persona_por_qr, que escribe vínculo y consentimiento en la misma transacción.';
  end if;

  return new;
end;
$$;

comment on function public.miembros_exigir_respaldo() is
  'Portero de miembros (0181): ninguna afiliación nueva sin fila en '
  'personas_negocio (el permiso del negocio) y en consentimientos_persona '
  '(el respaldo de la Ley 8968). Solo INSERT: las membresías anteriores '
  'a esta regla no se tocan.';

drop trigger if exists miembros_zexigir_respaldo on public.miembros;
create trigger miembros_zexigir_respaldo
  before insert on public.miembros
  for each row execute function public.miembros_exigir_respaldo();


-- ------------------------------------------------------------
-- 2. Por dónde entró cada persona: `personas_negocio.origen` ya existe
--    (0138:299), pero el alta a mano del mostrador todavía no era un
--    valor previsto. Se documenta el vocabulario para que no aparezcan
--    quince maneras de escribir lo mismo.
--
-- No se agrega un check: la columna ya tiene el suyo (largo 1..40) y
-- cerrarla ahora rompería cualquier importación vieja con un origen que
-- no está en esta lista. El vocabulario es una convención, y como tal
-- va en un comentario.
-- ------------------------------------------------------------

comment on column public.personas_negocio.origen is
  'Por dónde entró el vínculo. Vocabulario: qr_tarjeta (el póster), '
  'mostrador (el cajero completó la ficha a mano, 0181), importacion, '
  'admin, cita.';


-- ------------------------------------------------------------
-- 3. La consulta de control, para el dueño
--
-- Contesta de una sola mirada la pregunta del pedido: ¿de quién NO
-- sabemos quién es? Se deja como vista y no como consulta suelta en un
-- documento porque es la que hay que volver a correr después de cada
-- limpieza, y una vista no se copia mal.
--
-- `security_invoker` para que la vista respete la RLS de quien la
-- consulta y no se convierta en una puerta trasera a `personas`: quien
-- la mire ve lo que ya podía ver.
-- ------------------------------------------------------------

create or replace view public.vista_afiliaciones_incompletas
with (security_invoker = true)
as
select
  m.id                as miembro_id,
  m.programa_id,
  pl.rancho_id,
  pl.cuenta_id,
  m.persona_id,
  m.created_at        as afiliado_en,
  pe.nombre           as nombre_persona,
  (pe.correo is not null or pe.telefono is not null) as tiene_contacto,
  exists (
    select 1 from personas_negocio pn
     where pn.persona_id = m.persona_id
       and ((pl.cuenta_id is not null and pn.cuenta_id = pl.cuenta_id)
         or (pl.rancho_id is not null and pn.rancho_id = pl.rancho_id))
  ) as tiene_vinculo,
  exists (
    select 1 from consentimientos_persona c
     where c.persona_id = m.persona_id
       and c.ambito = 'negocio'
       and ((pl.cuenta_id is not null and c.cuenta_id = pl.cuenta_id)
         or (pl.rancho_id is not null and c.rancho_id = pl.rancho_id))
  ) as tiene_consentimiento,
  coalesce((select sum(t.puntos) from transacciones_puntos t
             where t.miembro_id = m.id), 0) as saldo
from miembros m
join programa_lealtad pl on pl.id = m.programa_id
left join personas pe on pe.id = m.persona_id;

comment on view public.vista_afiliaciones_incompletas is
  'Una fila por membresía con las tres condiciones del alta completa '
  '(0181). Filtrar por nombre_persona is null / tiene_vinculo = false / '
  'tiene_consentimiento = false para ver qué hay que regularizar. El '
  'saldo va al lado a propósito: dice cuántos sellos se le quitarían a '
  'esa persona si a alguien se le ocurriera borrarla.';

-- La vista hereda la RLS de las tablas de abajo (security_invoker), así
-- que el grant a `authenticated` no expone nada nuevo: el dueño ve las
-- membresías de sus programas y el admin ve todas.
grant select on public.vista_afiliaciones_incompletas to authenticated, service_role;
