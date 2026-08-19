
-- ─────────────────────────────────────────────────────────────────────
-- ACOMPAÑA A LA 0187 (lealtad fuera del marketplace).
--
-- Son TRES pasos SUELTOS: se pegan por separado, no todos de una.
-- Mismo criterio que docs/pegar-0170-pais.sql. Todo acá es de SOLO
-- LECTURA menos el PASO 2 y el PASO 3, que están marcados.
-- ─────────────────────────────────────────────────────────────────────


-- ── PASO 0 — ANTES de pegar la 0187. Solo lee, no cambia nada. ───────
--
-- Son EXACTAMENTE las filas que el backfill de la 0187 va a sacar del
-- directorio. Si en esta lista aparece un solo negocio de verdad del
-- marketplace, NO seguir: avisar y revisar el predicado.

select r.id,
       r.nombre,
       r.slug,
       r.created_at,
       r.vertical,
       r.plan_lealtad
  from public.ranchos r
 where r.estado = 'pendiente'
   and r.provincia is null
   and r.categoria = 'otros'
   and r.subcategoria is null
   and r.descripcion is null
   and r.contacto_whatsapp is null
   and r.precio_desde is null
   and r.capacidad_min is null
   and r.capacidad_max is null
   and r.foto_url is null
   and coalesce(r.fotos, '[]'::jsonb) = '[]'::jsonb
   and r.lealtad_aprobado_en is not null
   and not exists (select 1 from public.verificacion_proveedores v
                    where v.rancho_id = r.id)
   and exists (select 1 from public.solicitudes_lealtad s
                where s.rancho_id = r.id and s.negocio_nombre is not null)
 order by r.created_at;


-- ── PASO 1 — DESPUÉS de pegar la 0187: los que se escaparon ──────────
--
-- El predicado de arriba es a propósito ESTRECHO (todo con AND): deja
-- pasar negocios de lealtad a los que les falta alguna huella —porque
-- el enlace de la solicitud se escribe best-effort, o porque el dueño
-- entró a /mi-negocio y llenó la provincia. Esta consulta los saca a la
-- luz para mirarlos con nombre y apellido.
--
-- La columna `pista` dice por qué se sospecha. Lo que el dueño reconozca
-- como cliente de Lealtad se marca con el PASO 2, uno por uno. Lo que no
-- reconozca se deja como está: un predicado no debería decidir esto solo.

select r.id,
       r.nombre,
       r.slug,
       r.estado,
       r.provincia,
       r.plan_lealtad,
       r.created_at,
       concat_ws(' · ',
         case when exists (select 1 from public.solicitudes_lealtad s
                            where s.rancho_id = r.id
                              and s.negocio_nombre is not null)
              then 'solicitud de ALTA de lealtad' end,
         case when exists (select 1 from public.programa_lealtad pl
                            where pl.rancho_id = r.id)
              then 'tiene programa' end,
         case when r.plan_lealtad is not null then 'tiene paquete' end,
         case when r.provincia is null then 'sin provincia' end,
         case when not exists (select 1 from public.verificacion_proveedores v
                                where v.rancho_id = r.id)
              then 'sin cédula verificada' end
       ) as pista
  from public.ranchos r
 where r.en_marketplace
   and (
     exists (select 1 from public.solicitudes_lealtad s
              where s.rancho_id = r.id and s.negocio_nombre is not null)
     or exists (select 1 from public.programa_lealtad pl
                 where pl.rancho_id = r.id)
     or r.plan_lealtad is not null
   )
 order by r.estado, r.created_at;


-- ── PASO 2 — ESCRIBE. Uno por uno, con el nombre a la vista. ─────────
--
-- Va con la llave de servicio (el SQL Editor de Supabase la usa), así
-- que el candado de la 0187 lo deja pasar. Se corre SOLO para los ids
-- que salieron del PASO 1 y que el dueño reconoce.
--
--   update public.ranchos set en_marketplace = false where id = '…';
--
-- Y el camino de vuelta, por si se marcó de más:
--
--   update public.ranchos set en_marketplace = true  where id = '…';


-- ── PASO 3 — ESCRIBE, y solo si el PASO 1 mostró un 'aprobado'. ──────
--
-- Un negocio de lealtad que un admin YA publicó en el directorio por
-- error: aparece en el PASO 1 con `estado = 'aprobado'`. La 0187 NO lo
-- toca a propósito —sacar del directorio una ficha que hoy es pública
-- es lo único de todo esto con efecto hacia afuera (URL, SEO), y eso lo
-- decide una persona mirando el nombre, no un WHERE.
--
-- Si se decide sacarlo, van las dos cosas juntas: fuera del directorio
-- Y de vuelta a 'pendiente', porque un 'aprobado' invisible es un
-- estado que miente.
--
--   update public.ranchos
--      set en_marketplace = false,
--          estado = 'pendiente'
--    where id = '…';


-- ── COMPROBACIÓN — que el permiso de la columna quedó ────────────────
-- Tienen que salir las dos filas (anon y authenticated). Si falta
-- alguna, el header del sitio y la app revientan con 42501.

select grantee, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name   = 'ranchos'
   and column_name  = 'en_marketplace'
   and grantee in ('anon', 'authenticated');
