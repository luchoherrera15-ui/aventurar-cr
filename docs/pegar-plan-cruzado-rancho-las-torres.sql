
-- ════════════════════════════════════════════════════════════════
-- LA FILA CRUZADA — Rancho Las Torres tiene el paquete en dos lados
-- ════════════════════════════════════════════════════════════════
--
-- QUÉ PASA HOY
-- ────────────
-- El paquete de Lealtad se guarda en dos columnas y la que manda es la
-- primera (src/lib/lealtad/cuenta.ts → planEfectivo = cuenta ?? rancho):
--
--     cuentas.plan          = 'basico'     ← LA QUE MANDA
--     ranchos.plan_lealtad  = null         ← el espejo, vacío
--
-- O sea que Rancho Las Torres está OPERANDO con «Básico», que es un
-- paquete RETIRADO: no se vende desde la 0141, no tiene precio
-- (`precioMensual: null`, o sea que /admin/finanzas no le espera ni un
-- colón) y lleva `SIN_TOPES` — clientes, tarjetas y equipo ilimitados.
-- Le faltan, eso sí, cuatro capacidades que HOY trae hasta el paquete
-- más barato: personalizar la tarjeta, el póster con QR, el modo
-- mostrador y el equipo con permisos.
--
-- QUÉ SE ROMPE SI NO SE PEGA NADA
-- ────────────────────────────────
-- Nada se cae. Con los arreglos de esta pasada, /admin/complementos ya
-- muestra el paquete EFECTIVO («Básico», no «Sin plan») y marca la fila
-- como «dato cruzado», y mover el desplegable ya escribe las DOS
-- columnas, así que el cruce se arregla solo la próxima vez que alguien
-- le cambie el paquete. Lo que queda mientras tanto es un negocio con
-- un paquete que ya no se vende y una fila que se lee raro en cualquier
-- consulta que mire `ranchos.plan_lealtad` a mano.
--
-- Y con la 0175 pegada esto no puede volver a nacer: los dos triggers
-- del espejo mantienen las dos columnas iguales venga el update de donde
-- venga. Pero la 0175 NO repara lo que ya está cruzado — repararlo es
-- elegir un paquete, y eso no lo decide una migración.
--
-- ────────────────────────────────────────────────────────────────
-- OPCIÓN A — DEJARLE «BÁSICO» Y SOLO EMPAREJAR EL ESPEJO
-- ────────────────────────────────────────────────────────────────
-- Es la opción SEGURA y la recomendada si no hay una decisión comercial
-- tomada: NO le cambia el paquete al negocio. El paquete efectivo ya es
-- 'basico'; lo único que hace es que el espejo lo diga también, así que
-- después de correrlo Rancho Las Torres puede exactamente lo mismo que
-- podía antes. Cero riesgo.
--
-- Está escrito para TODAS las filas cruzadas, no solo para esta: si
-- apareciera otra, la empareja con el mismo criterio (manda la cuenta) y
-- sin decidir nada por nadie.

update ranchos r
   set plan_lealtad = c.plan
  from cuentas c
 where c.rancho_id = r.id
   and r.plan_lealtad is distinct from c.plan;

-- Para ver cómo quedó (debería devolver CERO filas):
select r.slug, r.nombre, r.plan_lealtad as espejo, c.plan as raiz
  from cuentas c
  join ranchos r on r.id = c.rancho_id
 where c.plan is distinct from r.plan_lealtad;


-- ────────────────────────────────────────────────────────────────
-- OPCIÓN B — MOVERLO A UN PAQUETE DEL CATÁLOGO DE HOY
-- ════════════════════════════════════════════════════════════════
-- ⚠️ ESTO SÍ LE CAMBIA LO QUE PUEDE HACER AL NEGOCIO. No lo corras sin
-- haberlo decidido.
--
-- Rancho Las Torres es un negocio real y funcionando, y el código NO
-- puede saber qué paquete le corresponde: no hay factura, no hay
-- suscripción de Stripe y `basico` no tiene precio, así que no se puede
-- deducir ni de lo que paga. Es una decisión comercial.
--
-- Lo único que el código sí puede decir es a qué se parece cada opción:
--
--   'ilimitado'  Lo más cercano a lo que tiene hoy: sigue sin topes de
--                clientes ni de tarjetas, y ADEMÁS gana las cuatro
--                capacidades que le faltan más cercanía y diseño a
--                medida. Nadie pierde nada. Cuesta $89/mes.
--   'impulso'    Le PONE topes que hoy no tiene: 1.150 clientes, 5
--                tarjetas, 10 del equipo. $42/mes.
--   'arranque'   Topes bastante más chicos: 200 clientes, 2 tarjetas.
--                $12/mes. Si ya tiene más de 200 clientes con pase, la
--                puerta de Wallet empieza a rebotar altas nuevas.
--
-- Antes de elegir, ver cuánto ocupa hoy. (`persona_id` es de la 0138 y
-- las membresías viejas lo tienen en null, así que se cuenta por
-- persona cuando está y por usuario cuando no — que es lo que hace
-- `personasActivasDe`, src/lib/lealtad/cupo.ts. Las pausadas y las
-- canceladas NO ocupan lugar.)
--
-- select r.nombre,
--        count(distinct coalesce(m.persona_id::text, m.cliente_id::text))
--          filter (where m.estado = 'activa') as clientes_con_pase,
--        count(distinct p.id)                 as tarjetas
--   from ranchos r
--   left join programa_lealtad p on p.rancho_id = r.id
--   left join miembros m         on m.programa_id = p.id
--  where r.slug = 'rancholastorres'
--  group by r.nombre;
--
-- Y RECIÉN AHÍ, cambiando 'ilimitado' por lo que se haya decidido.
-- Basta escribir la CUENTA: con la 0175 pegada, el trigger copia el
-- valor al negocio solo. (Sin la 0175, descomentar también el segundo
-- update — si no, quedan cruzadas otra vez, al revés.)
--
-- update cuentas
--    set plan = 'ilimitado'
--  where rancho_id = (select id from ranchos where slug = 'rancholastorres');
--
-- update ranchos
--    set plan_lealtad = 'ilimitado'
--  where slug = 'rancholastorres';
--
-- Ojo: esto NO deja fila en `historial_plan_lealtad` (0173). Un cambio
-- de paquete pegado a mano no tiene autor ni concepto, así que la
-- bitácora no va a poder explicar de dónde salió. Si el cambio importa
-- para el cuadre de ingresos, conviene hacerlo desde
-- /admin/complementos —el desplegable ya escribe las dos columnas y
-- además pide decir si es venta, regalía o corrección— en vez de acá.
