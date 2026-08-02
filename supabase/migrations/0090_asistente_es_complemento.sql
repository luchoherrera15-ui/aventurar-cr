-- ============================================================
-- BOOKEA — El asistente pasa a ser un complemento de pago (0090)
--
-- Hasta hoy el asistente contestaba gratis, y quién lo tenía lo decidía
-- el propio código: `ranchos.asistente_activo` cuando el dueño lo
-- prendía, y si no, una regla general que lo encendía solo para la
-- categoría "Lugares" y unos slugs de piloto. O sea: cualquier negocio
-- nuevo de esa categoría empezaba a gastar tokens sin haber pagado
-- nada y sin que nadie lo decidiera.
--
-- Desde acá el asistente es un complemento por NEGOCIO, con el mismo
-- mecanismo que ya usa "Traé tu agenda" (0077):
--
--   `addons_negocio.addon` acepta ahora también 'asistente_ia'.
--
-- Por qué un complemento por negocio y no un rol en la cuenta: el rol
-- dice QUIÉN sos (admin, dueño, cliente — ver 0086) y una misma persona
-- puede tener tres negocios y pagarle el asistente a uno solo. Con un
-- rol se le encendería en los tres.
--
-- La seguridad la hereda de la 0077 y es la parte que importa: el dueño
-- solo tiene política de SELECT sobre `addons_negocio`. No hay política
-- de insert ni de update, así que la RLS le niega escribir — nadie se
-- regala el asistente desde el navegador. Solo la llave de servicio
-- activa, y eso hoy pasa por /admin/complementos.
--
-- CORTE: se lo quitamos a TODOS. Ningún negocio contesta a partir de
-- acá salvo los dos que se dejan encendidos por decisión del dueño de
-- Bookea (Rancho Las Torres y Rancho Don Luis). El interruptor personal
-- `ranchos.asistente_activo` NO se toca: sigue ahí y sigue mandando,
-- pero ahora es el segundo candado — primero hay que tener el
-- complemento.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El catálogo de complementos acepta el asistente
-- ------------------------------------------------------------

alter table addons_negocio drop constraint if exists addons_negocio_addon_check;
alter table addons_negocio add constraint addons_negocio_addon_check
  check (addon in ('agenda_ia', 'lealtad', 'asistente_ia'));

-- ------------------------------------------------------------
-- 2. Cortesía para los dos negocios que siguen con el asistente
--
-- Se busca por nombre porque los ids cambian entre entornos. Sin
-- vencimiento: son cortesía indefinida, no una prueba.
--
-- ANTES DE DAR ESTO POR BUENO, verificar que agarró exactamente dos
-- negocios y que son los correctos:
--
--   select r.nombre, a.addon, a.activo, a.vence_en, a.notas
--     from addons_negocio a
--     join ranchos r on r.id = a.rancho_id
--    where a.addon = 'asistente_ia';
--
-- Si agarró de más o de menos, se corrige desde /admin/complementos —
-- no hace falta tocar SQL.
-- ------------------------------------------------------------

insert into addons_negocio (rancho_id, addon, activo, vence_en, notas, activado_en)
select
  r.id,
  'asistente_ia',
  true,
  null,
  'Cortesía indefinida: ya lo usaba antes de que el asistente se cobrara.',
  now()
from ranchos r
where lower(r.nombre) like '%las torres%'
   or lower(r.nombre) like '%don luis%'
on conflict (rancho_id, addon) do update
  set activo = true,
      vence_en = null,
      notas = excluded.notas,
      activado_en = coalesce(addons_negocio.activado_en, excluded.activado_en);

-- Cualquier otro negocio que ya tuviera una fila de 'asistente_ia'
-- (no debería haber ninguna todavía) queda apagado: el corte es parejo.
update addons_negocio
   set activo = false
 where addon = 'asistente_ia'
   and rancho_id not in (
     select id from ranchos
      where lower(nombre) like '%las torres%'
         or lower(nombre) like '%don luis%'
   );

-- ------------------------------------------------------------
-- 3. Cuántos quedaron encendidos, para verlo al correr la migración
-- ------------------------------------------------------------

do $$
declare
  v_cuenta int;
begin
  select count(*) into v_cuenta
    from addons_negocio
   where addon = 'asistente_ia' and activo;
  raise notice 'Asistente IA activo en % negocio(s). Se esperaban 2 (Las Torres y Don Luis).', v_cuenta;
end $$;

notify pgrst, 'reload schema';
