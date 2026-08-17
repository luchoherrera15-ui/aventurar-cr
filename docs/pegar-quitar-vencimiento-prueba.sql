
-- ════════════════════════════════════════════════════════════════
-- EL PAQUETE GRATIS DEJA DE VENCER — para los que YA existen
-- ════════════════════════════════════════════════════════════════
--
-- El catálogo ya no le pone fecha de corte al paquete gratis, así que
-- las altas NUEVAS nacen sin vencimiento. Pero los negocios que se
-- dieron de alta ANTES tienen la fecha escrita en su fila, y quien la
-- hace cumplir es la base:
--
--     tiene_addon()  →  and (a.vence_en is null or a.vence_en > now())
--
-- O sea que sin esto, a esos negocios se les apagaría el programa el
-- día que decía la fecha vieja, aunque la pantalla diga otra cosa.
--
-- `null` en esa columna significa «para siempre», que es exactamente
-- lo que se quiere ahora.
--
-- Se puede pegar dos veces sin problema: la segunda no encuentra nada
-- que cambiar.

update addons_negocio a
   set vence_en = null
  from ranchos r
 where a.rancho_id = r.id
   and a.addon = 'lealtad'
   and a.vence_en is not null
   and coalesce(r.plan_lealtad, 'prueba') = 'prueba';

-- Para ver a quién le tocó:
select r.nombre, a.vence_en
  from addons_negocio a
  join ranchos r on r.id = a.rancho_id
 where a.addon = 'lealtad'
   and coalesce(r.plan_lealtad, 'prueba') = 'prueba';
