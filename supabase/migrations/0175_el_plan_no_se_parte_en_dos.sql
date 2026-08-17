-- ============================================================
-- BOOKEA — el paquete de Lealtad deja de vivir en dos verdades (0175)
--
-- El paquete de un negocio se guarda en DOS columnas:
--
--     cuentas.plan          (0134)  ← LA RAÍZ
--     ranchos.plan_lealtad  (0124)  ← el espejo de la transición
--
-- y quien decide cuál manda es `planEfectivo` en
-- src/lib/lealtad/cuenta.ts:
--
--     planEfectivo = cuentas.plan ?? ranchos.plan_lealtad
--
-- O sea que la CUENTA gana. Pero hasta hoy la escritura era asimétrica
-- —el webhook de Stripe escribía las dos, el desplegable del admin y la
-- aprobación por SINPE escribían solo el rancho— y eso ya se estaba
-- viendo en producción: un negocio con `cuentas.plan = 'basico'` y
-- `ranchos.plan_lealtad = null`. El admin mostraba «Sin plan», el
-- negocio operaba con «Básico», y mover el desplegable no lo corregía.
--
-- ------------------------------------------------------------
-- POR QUÉ LA GARANTÍA VA ACÁ Y NO SOLO EN TYPESCRIPT
-- ------------------------------------------------------------
-- El código ya se arregló: hay UNA función que escribe las dos
-- (`aplicarPlanDeLealtad`, src/lib/lealtad/aplicar-plan.ts) y las cuatro
-- puertas la llaman. Pero eso es una PROMESA —«acordate de usar esta
-- función»— y la promesa se rompe sola: con el update pegado a mano en
-- el SQL Editor, con un script de siembra, con la quinta puerta que
-- alguien agregue el mes que viene. Esto es una GARANTÍA: escribir
-- cualquiera de las dos columnas arrastra a la otra, venga de donde
-- venga.
--
-- ------------------------------------------------------------
-- LO QUE ESTA MIGRACIÓN NO HACE
-- ------------------------------------------------------------
-- NO repara las filas que ya están cruzadas. A propósito.
--
-- Reparar automáticamente significa ELEGIR un paquete, y elegirlo mal
-- le cambia a un negocio real qué puede hacer y cuánto le cabe. La fila
-- cruzada de hoy es de un negocio funcionando, y la decisión es del
-- dueño de Bookea, no de una migración. El SQL para arreglarla —con las
-- dos opciones y qué implica cada una— está en
-- docs/pegar-plan-cruzado-rancho-las-torres.sql.
--
-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
-- No hay tablas nuevas, así que no hay políticas nuevas que escribir.
-- Y el candado de QUIÉN puede mover un paquete no cambia: lo siguen
-- poniendo los triggers `ranchos_proteger_plan_lealtad` y
-- `cuentas_proteger_plan` de la 0148, que son BEFORE y corren ANTES que
-- el espejo. O sea: quien no podía cambiar el paquete sigue sin poder,
-- y el espejo solo se entera de los cambios que ya pasaron el candado.
--
-- Las funciones van `security definer` con `search_path = ''` —el mismo
-- patrón de la 0134 y la 0148— porque el espejo tiene que poder escribir
-- la otra tabla aunque la RLS de la sesión no la alcance. No abren nada:
-- lo único que hacen es copiar un valor que la base ya aceptó.
--
-- Aditiva e idempotente: se puede pegar dos veces. Tolerante a que
-- falten migraciones anteriores — cada bloque avisa por NOTICE y se
-- salta lo suyo en vez de cortar el pegado a la mitad.
-- ============================================================


-- ============================================================
-- 1. LA CUENTA NUEVA ADOPTA EL PAQUETE DEL NEGOCIO QUE ENLAZA
-- ============================================================
-- Una cuenta puede nacer SIN paquete (`plan` es nullable) y enlazada a
-- un rancho que sí tiene uno. Sin esto, el espejo del punto 2 miraría
-- ese null y le borraría el paquete al negocio: una fila nueva en una
-- tabla auxiliar degradando a un cliente que paga.
--
-- Va en un BEFORE INSERT que toca `new` y no en un UPDATE posterior a
-- propósito: un segundo UPDATE despertaría el candado de la 0148 y
-- haría fallar el INSERT entero para cualquier sesión que no sea admin.
create or replace function public.cuentas_plan_adopta_del_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn_adopta$
begin
  select r.plan_lealtad into new.plan
    from public.ranchos r
   where r.id = new.rancho_id;
  return new;
end;
$fn_adopta$;


-- ============================================================
-- 2. EL ESPEJO, EN LAS DOS DIRECCIONES
-- ============================================================
-- Se copia SIEMPRE, incluido el null.
--
-- El null importa y no es un detalle: si el espejo copiara solo los
-- valores no nulos, una BAJA escrita en una de las dos columnas la
-- dejaría en null mientras la otra conserva el paquete viejo — y como
-- `planEfectivo` es un `??`, el paquete viejo volvería a ganar. La baja
-- se desharía sola, en silencio, y el negocio seguiría con capacidades
-- que ya no le tocan.
--
-- El `is distinct from` del WHERE es lo que corta la recursión: la
-- cuenta escribe el rancho, el rancho intenta escribir la cuenta, ya son
-- iguales, cero filas, se acabó. Dos saltos y para.

create or replace function public.cuentas_plan_al_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn_espejo_cuenta$
begin
  if new.rancho_id is null then
    return null; -- Lealtad sin marketplace: no hay espejo que mantener
  end if;

  -- Se acaba de ENLAZAR una cuenta sin paquete a un negocio que quizá
  -- tiene uno: la cuenta adopta, no borra. (En el INSERT esto ya lo
  -- resolvió el trigger de arriba.)
  if tg_op = 'UPDATE'
     and new.plan is null
     and old.rancho_id is distinct from new.rancho_id then
    update public.cuentas c
       set plan = r.plan_lealtad
      from public.ranchos r
     where c.id = new.id
       and r.id = new.rancho_id
       and c.plan is distinct from r.plan_lealtad;
    return null;
  end if;

  update public.ranchos
     set plan_lealtad = new.plan
   where id = new.rancho_id
     and plan_lealtad is distinct from new.plan;

  return null;
end;
$fn_espejo_cuenta$;


create or replace function public.ranchos_plan_a_la_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn_espejo_rancho$
begin
  update public.cuentas
     set plan = new.plan_lealtad
   where rancho_id = new.id
     and plan is distinct from new.plan_lealtad;
  return null;
end;
$fn_espejo_rancho$;


-- ============================================================
-- 3. Colgar los triggers (solo si las tablas existen)
-- ============================================================
do $trg_espejo$
begin
  if to_regclass('public.ranchos') is null then
    raise notice 'AVISO 0175: falta ranchos. No se pone el espejo del paquete.';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ranchos'
       and column_name = 'plan_lealtad'
  ) then
    raise notice 'AVISO 0175: ranchos no tiene plan_lealtad (0124). Se salta el espejo.';
    return;
  end if;

  if to_regclass('public.cuentas') is null then
    raise notice 'AVISO 0175: falta cuentas (0134). Sin la raíz no hay dos columnas que cruzar — se salta el espejo. Volver a pegar esta migración DESPUÉS de la 0134.';
    return;
  end if;

  -- ── La cuenta nueva adopta ──────────────────────────────────────
  execute 'drop trigger if exists cuentas_plan_adopta_del_negocio on public.cuentas';
  execute 'create trigger cuentas_plan_adopta_del_negocio '
       || 'before insert on public.cuentas '
       || 'for each row when (new.plan is null and new.rancho_id is not null) '
       || 'execute function public.cuentas_plan_adopta_del_negocio()';

  -- ── Cuenta → negocio ────────────────────────────────────────────
  -- `update of plan, rancho_id`: también cuando se ENLAZA una cuenta a
  -- un negocio, que es el otro momento en que las dos columnas se
  -- encuentran por primera vez.
  execute 'drop trigger if exists cuentas_plan_al_negocio on public.cuentas';
  execute 'create trigger cuentas_plan_al_negocio '
       || 'after insert or update of plan, rancho_id on public.cuentas '
       || 'for each row execute function public.cuentas_plan_al_negocio()';

  -- ── Negocio → cuenta ────────────────────────────────────────────
  -- El `when` con `is distinct from` hace que el trigger ni se despierte
  -- cuando el dueño guarda el nombre, la foto o el horario de su
  -- negocio. Solo cuando la columna del dinero cambia de valor.
  execute 'drop trigger if exists ranchos_plan_a_la_cuenta on public.ranchos';
  execute 'create trigger ranchos_plan_a_la_cuenta '
       || 'after update of plan_lealtad on public.ranchos '
       || 'for each row when (old.plan_lealtad is distinct from new.plan_lealtad) '
       || 'execute function public.ranchos_plan_a_la_cuenta()';
end
$trg_espejo$;


do $comentario$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ranchos'
       and column_name = 'plan_lealtad'
  ) then
    execute $c$comment on column public.ranchos.plan_lealtad is
      'Plan del modulo de Lealtad (0124, 0131, 0133, 0141). ESPEJO de '
      'cuentas.plan (0134), que es la raiz: la 0175 los mantiene iguales '
      'con un trigger en las dos direcciones. Para los negocios SIN fila '
      'en cuentas —la mayoria— esta columna es la unica verdad. El '
      'catalogo con precios, topes y capacidades vive en '
      'src/lib/lealtad/planes.ts, no en la base: es producto de Bookea, '
      'igual para todos.'$c$;
  end if;
end
$comentario$;


-- ------------------------------------------------------------
-- COMPROBAR QUE QUEDÓ (pegar aparte, después)
-- ------------------------------------------------------------
-- Los tres triggers:
--
-- select tgname, tgrelid::regclass as tabla, tgenabled
--   from pg_trigger
--  where tgname in ('cuentas_plan_adopta_del_negocio',
--                   'cuentas_plan_al_negocio',
--                   'ranchos_plan_a_la_cuenta');
-- -- Esperado: 3 filas, tgenabled = 'O'.
--
-- Y quién sigue cruzado (esto NO lo arregla la migración):
--
-- select r.slug, r.plan_lealtad as espejo, c.plan as raiz
--   from cuentas c
--   join ranchos r on r.id = c.rancho_id
--  where c.plan is distinct from r.plan_lealtad;
-- -- Esperado hoy: 1 fila (rancholastorres). Ver
-- -- docs/pegar-plan-cruzado-rancho-las-torres.sql.
