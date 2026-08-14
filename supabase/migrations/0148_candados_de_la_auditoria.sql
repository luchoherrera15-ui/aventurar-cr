
-- ============================================================
-- BOOKEA — Los candados que la auditoría encontró abiertos (0148)
--
-- Seis agujeros de la base más la reja del corte. Ninguno es una
-- capacidad nueva: todo lo de acá CIERRA algo que hoy está abierto, y
-- nada de acá le quita a nadie algo que hoy pueda hacer legítimamente.
--
-- Se comprobó uno por uno contra el código antes de escribir el
-- arreglo. Lo que cada bloque cierra, y por qué, va escrito arriba de
-- cada bloque.
--
-- ------------------------------------------------------------
-- EL HILO QUE UNE A CASI TODOS
-- ------------------------------------------------------------
-- `ranchos`, `cuentas`, `miembros`, `programa_lealtad` y `recompensas`
-- tienen políticas de escritura para el DUEÑO —tiene que poder editar
-- su negocio— y los `grant` que las acompañan son de TABLA ENTERA. Una
-- política dice QUIÉN; el grant dice QUÉ COLUMNAS. Cuando el grant es
-- de tabla, "editar mi negocio" incluye editar la columna que dice
-- cuánto paga y la que dice de quién es cada cliente.
--
-- El repo ya tenía las dos formas correctas de cerrar eso y acá se
-- usan las dos, sin inventar una tercera:
--   · grant por columna — `grant update (rol, permisos_lealtad)` (0127)
--     y `grant update (estado, atendida_por, atendida_en)` (0126);
--   · trigger que exige admin o llave de servicio —
--     `ranchos_proteger_aprobacion_lealtad` (0129).
--
-- ------------------------------------------------------------
-- NADA DE ESTO ROMPE EL PRODUCTO, Y SE VERIFICÓ ASÍ
-- ------------------------------------------------------------
-- Todas las escrituras de plan, paquete y recompensa del código pasan
-- por la LLAVE DE SERVICIO (`createAdminClient`), que salta la RLS y
-- para la que `auth.uid()` es null — que es justo la puerta que los
-- triggers de acá dejan abierta:
--   · asignarPlanLealtad y aprobar solicitudes → admin + service key
--     (src/app/admin/(dashboard)/complementos/plan-actions.ts)
--   · el webhook de Stripe → service key
--     (src/lib/pagos/puerta-supabase.ts)
--   · el alta desde solicitud → service key
--     (src/lib/lealtad/alta-desde-solicitud.ts)
--
-- Aditiva e idempotente: se puede pegar dos veces. Tolerante a que
-- falte una migración anterior — cada bloque avisa por NOTICE y se
-- salta lo suyo en vez de cortar el pegado a la mitad.
-- ============================================================


-- ============================================================
-- A1 — EL PLAN NO SE LO PONE EL DUEÑO
-- ============================================================
-- La 0008 da `grant insert, update on ranchos to authenticated` (tabla
-- entera) con política `owner_id = auth.uid()`. Hay tres triggers que
-- protegen columnas: `estado` (0008), `owner_id` (0116) y
-- `lealtad_aprobado_*` (0129). Ninguno cubre `plan_lealtad`.
--
-- O sea: el dueño saca su token del navegador y manda
--   PATCH /rest/v1/ranchos?id=eq.<el suyo>   {"plan_lealtad":"empresa"}
-- y el CHECK de la 0133 lo acepta, porque 'empresa' es un valor válido
-- —hay filas viejas con planes retirados y por eso la lista es ancha—.
-- Se queda con clientes, tarjetas y equipo ilimitados, los ocho tipos
-- de tarjeta, y `precioMensual: null`, que además lo saca del cuadre
-- de /admin/finanzas: cobra cero y no aparece como deuda.
--
-- Lo mismo con `cuentas.plan` (0134): política `gestiona_cuenta(id)` y
-- `grant select, insert, update, delete on cuentas` de tabla entera.
--
-- El arreglo es el patrón de la 0129, calcado: llave de servicio o
-- admin pasan; cualquier otra sesión se estrella.

create or replace function public.ranchos_proteger_plan_lealtad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn_plan_rancho$
begin
  if auth.uid() is null then
    return new; -- service_role: el servidor decide (webhook de pagos, admin)
  end if;
  if exists (select 1 from public.perfiles p
              where p.id = auth.uid() and p.rol = 'admin') then
    return new;
  end if;
  raise exception 'El plan de Lealtad lo asigna Bookea, no se cambia desde el panel. Escribinos y lo movemos.'
    using errcode = '42501';
end;
$fn_plan_rancho$;

-- `before update of plan_lealtad` + el `when`: el trigger ni se
-- despierta cuando el dueño guarda el nombre, la foto o el horario de
-- su negocio. Solo cuando la columna del dinero cambia de valor.
do $trg_plan_rancho$
begin
  if to_regclass('public.ranchos') is null then
    raise notice 'AVISO 0148 (A1): falta ranchos. No se pone el candado del plan.';
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'ranchos'
       and column_name = 'plan_lealtad'
  ) then
    raise notice 'AVISO 0148 (A1): ranchos no tiene plan_lealtad (0124). Se salta el candado.';
    return;
  end if;

  execute 'drop trigger if exists ranchos_proteger_plan_lealtad on public.ranchos';
  execute 'create trigger ranchos_proteger_plan_lealtad '
       || 'before update of plan_lealtad on public.ranchos '
       || 'for each row when (old.plan_lealtad is distinct from new.plan_lealtad) '
       || 'execute function public.ranchos_proteger_plan_lealtad()';
end
$trg_plan_rancho$;


create or replace function public.cuentas_proteger_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn_plan_cuenta$
begin
  if auth.uid() is null then
    return new; -- service_role
  end if;
  if exists (select 1 from public.perfiles p
              where p.id = auth.uid() and p.rol = 'admin') then
    return new;
  end if;
  raise exception 'El paquete de Lealtad lo asigna Bookea, no se cambia desde el panel. Escribinos y lo movemos.'
    using errcode = '42501';
end;
$fn_plan_cuenta$;

do $trg_plan_cuenta$
begin
  if to_regclass('public.cuentas') is null then
    raise notice 'AVISO 0148 (A1): falta cuentas (0134). No se pone el candado del paquete.';
    return;
  end if;

  execute 'drop trigger if exists cuentas_proteger_plan on public.cuentas';
  execute 'create trigger cuentas_proteger_plan '
       || 'before update of plan on public.cuentas '
       || 'for each row when (old.plan is distinct from new.plan) '
       || 'execute function public.cuentas_proteger_plan()';
end
$trg_plan_cuenta$;


-- ============================================================
-- A2 — LOS COMPROBANTES DE PAGO VUELVEN A SER DE SU DUEÑO
-- ============================================================
-- La 0011 había cerrado esto: su política era
--   using (bucket_id = 'comprobantes' and puede_ver_comprobante(name))
-- o sea admin, o el dueño del negocio de esa reserva.
--
-- La 0144 —nuestra, de esta misma semana— la redeclaró para poder
-- pegarla sobre cualquier base y en el camino se le cayó el filtro:
-- quedó `using (bucket_id = 'comprobantes')`. Con eso, CUALQUIER cuenta
-- con sesión firma una URL de cualquier archivo del bucket: capturas de
-- SINPE con el nombre, el teléfono y el número de cuenta de cada
-- negocio que pagó. No es una política nueva que falte: es una que
-- existía y se perdió. Acá vuelve, palabra por palabra.
--
-- QUÉ NO SE TOCA, Y POR QUÉ
-- El bucket SIGUE PÚBLICO. Se evaluó volverlo privado y servir todo por
-- URL firmada, y NO se puede sin romper los pases:
--   · `bajarImagen` en src/lib/wallet/generar.ts hace `fetch(url)` PELADO
--     —sin sesión, sin llave— para hornear el logo dentro del .pkpass;
--   · Google Wallet recibe `programLogo`/`heroImage` como URL y la baja
--     desde SUS servidores (src/lib/wallet/google.ts), donde no hay
--     forma de mandarle una sesión nuestra;
--   · `esUrlDeNuestroStorage` valida la ruta /object/public/... y sus
--     tests rechazan expresamente las firmadas (src/lib/storage-publico.test.ts).
-- Un bucket privado dejaría a los pases sin logo EN SILENCIO: sin error
-- de build, sin excepción, solo la tarjeta en blanco en el teléfono del
-- cliente. Cerrar las políticas sí se puede y es lo que se hace acá.
--
-- Que un archivo sea alcanzable con su link (una ruta con timestamp) no
-- es lo mismo que poder ENUMERAR la carpeta entera con la llave anónima
-- ni firmar cualquier objeto con una cuenta cualquiera. Eso es lo que
-- se cierra.

do $a2_select$
begin
  if to_regprocedure('public.puede_ver_comprobante(text)') is null then
    -- Sin el helper de la 0011 no hay forma de saber de quién es cada
    -- archivo: se cierra a admin, que es el lado seguro.
    raise notice 'AVISO 0148 (A2): falta puede_ver_comprobante (0011). La lectura queda solo para admin.';
    execute $p$drop policy if exists "El equipo puede ver los comprobantes" on storage.objects$p$;
    execute $p$create policy "El equipo puede ver los comprobantes"
      on storage.objects for select
      to authenticated
      using (bucket_id = 'comprobantes' and public.is_admin())$p$;
    return;
  end if;

  execute $p$drop policy if exists "El equipo puede ver los comprobantes" on storage.objects$p$;
  execute $p$create policy "El equipo puede ver los comprobantes"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'comprobantes' and public.puede_ver_comprobante(name))$p$;
end
$a2_select$;

-- LA SUBIDA ANÓNIMA SE ACOTA A LAS CUATRO CARPETAS QUE EL PRODUCTO USA
--
-- Sigue siendo anónima a propósito: en /lealtad/nuevo y en la reserva
-- de eventos, quien sube su comprobante TODAVÍA NO TIENE CUENTA — pedir
-- sesión ahí sería pedirle que se registre antes de poder pagar.
--
-- Lo que se le quita es escribir en la raíz del bucket y en cualquier
-- carpeta inventada. Las cuatro rutas salen del código, no de una
-- suposición:
--   solicitudes-lealtad/  → wizard-alta.tsx y formulario-solicitud.tsx
--   logos-negocio/        → el logo del pase, wizard-alta.tsx
--   pedidos-invitacion/   → opciones-pago.tsx
--   AAAA-MM-DD/           → la reserva de eventos, web y app móvil
--                           (booking-calendar.tsx, mobile reservar.tsx)
drop policy if exists "Cualquiera puede subir un comprobante" on storage.objects;
create policy "Cualquiera puede subir un comprobante"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'comprobantes'
    and (
      name like 'solicitudes-lealtad/%'
      or name like 'logos-negocio/%'
      or name like 'pedidos-invitacion/%'
      or name ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/'
    )
  );

-- Y un techo de tamaño, que hoy no existe: sin esto, la puerta anónima
-- es un disco duro gratis. 10 MB deja pasar todo lo que el producto
-- sube de verdad —el navegador ya rechaza arriba de 8 MB y encima
-- comprime antes de mandar (src/lib/comprimir-imagen.ts)— y corta la
-- subida de un archivo de 2 GB.
--
-- NO se restringe el tipo MIME: el comprobante de una invitación acepta
-- PDF (`accept="image/*,application/pdf"`) y un navegador que mande
-- `application/octet-stream` quedaría afuera sin que nadie entienda por
-- qué. El tamaño alcanza para lo que se quiere evitar.
do $a2_bucket$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'storage' and table_name = 'buckets'
       and column_name = 'file_size_limit'
  ) then
    raise notice 'AVISO 0148 (A2): storage.buckets sin file_size_limit. Se salta el techo de tamano.';
    return;
  end if;

  update storage.buckets
     set file_size_limit = 10485760
   where id = 'comprobantes'
     and (file_size_limit is null or file_size_limit > 10485760);
end
$a2_bucket$;


-- ============================================================
-- A3 — `miembros`: solo se puede tocar el ESTADO
-- ============================================================
-- La 0125 le dio al negocio poder pausar una membresía y cerró el
-- QUIÉN con `gestiona_rancho()`, pero el grant quedó de tabla entera.
-- Con eso, cualquiera que gestione el negocio —incluido un colaborador
-- con todo el checklist en false— puede reescribir `persona_id`,
-- `cliente_id` o `programa_id` de una fila.
--
-- Reescribir `cliente_id` RE-PARENTA el historial de otra persona: el
-- pase, el ledger y los sellos que ya juntó pasan a colgar de otra
-- cuenta. No es un dato que se corrija: es la identidad del cliente.
--
-- El QUIÉN de la política se deja como está (no se debilita nada); lo
-- que se cierra es el QUÉ, con el mismo `grant` por columna de la 0126
-- y la 0127.
do $a3_miembros$
begin
  if to_regclass('public.miembros') is null then
    raise notice 'AVISO 0148 (A3): falta miembros (0060). No se acota el grant.';
    return;
  end if;

  -- El `revoke` primero: `grant update (estado)` NO reemplaza a un
  -- grant de tabla, se suma. Sin revocar, esto no cerraría nada.
  execute 'revoke update on public.miembros from authenticated';
  execute 'grant update (estado) on public.miembros to authenticated';
end
$a3_miembros$;


-- ============================================================
-- A4 — un programa no se puede colgar de la cuenta del vecino
-- ============================================================
-- La política de la 0060 valida `rancho_id` y nada más — es de cuando
-- `rancho_id` era el único padre. La 0134 agregó `cuenta_id` y no entró
-- en el `with check`.
--
-- Con eso, el dueño de un negocio apunta SU programa a la cuenta de un
-- competidor y le empieza a consumir el cupo del paquete (0142): le
-- llena los asientos de clientes con miembros que no son suyos hasta
-- que el competidor no puede inscribir a nadie más en su mostrador.
--
-- Se redeclara la política con el `using` IDÉNTICO —quien podía editar
-- su programa lo sigue pudiendo editar— y el `with check` extendido:
-- si se le pone cuenta, tiene que ser una que la persona gestione.
-- `gestiona_cuenta` es la misma función que gobierna `cuentas` (0134):
-- security definer, así que no arrastra la RLS de `cuentas` adentro de
-- la política.
do $a4_programa$
begin
  if to_regclass('public.programa_lealtad') is null then
    raise notice 'AVISO 0148 (A4): falta programa_lealtad (0060). Se salta.';
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programa_lealtad'
       and column_name = 'cuenta_id'
  ) or to_regprocedure('public.gestiona_cuenta(uuid)') is null then
    raise notice 'AVISO 0148 (A4): falta cuenta_id o gestiona_cuenta (0134). Se deja la politica de la 0060.';
    return;
  end if;

  execute $p$drop policy if exists "El dueño administra su programa" on public.programa_lealtad$p$;
  execute $p$create policy "El dueño administra su programa" on public.programa_lealtad
    for all to authenticated
    using (
      exists (
        select 1 from public.ranchos r
        where r.id = rancho_id and (r.owner_id = auth.uid() or public.is_admin())
      )
    )
    with check (
      exists (
        select 1 from public.ranchos r
        where r.id = rancho_id and (r.owner_id = auth.uid() or public.is_admin())
      )
      and (cuenta_id is null or public.gestiona_cuenta(cuenta_id))
    )$p$;
end
$a4_programa$;


-- ============================================================
-- A5 — lo público es lo que está EN LA VITRINA, no el depósito
-- ============================================================
-- `recompensas` y `paquetes_afiliacion` tienen `using (true)` para
-- `anon` desde la 0060. Eso no muestra "las recompensas del negocio":
-- muestra TODAS las de TODOS los negocios, incluidas las inactivas, las
-- de programas en borrador, las vencidas y las que todavía no arrancan
-- —el catálogo de la promoción del mes que viene, legible por cualquiera
-- antes de lanzarla— más `sku` e `instrucciones`, que son el texto
-- interno para el personal ("cobrar 0 y anotar en la comanda").
--
-- QUÉ NECESITA VER UN ANÓNIMO DE VERDAD: nada por esta puerta. Se
-- revisó cada lector de `recompensas` del repo y TODOS usan la llave de
-- servicio, que no pasa por RLS:
--   · /tarjeta/[slug] (la página del QR del mostrador) — createAdminClient
--   · /citas/[slug]                                    — createAdminClient
--   · los dos generadores de pases (generar.ts, google.ts) — createAdminClient
--   · el panel y el póster                             — createAdminClient
-- El dueño que edita sus recompensas desde el navegador entra por su
-- propia política ("El dueño administra sus recompensas", que es FOR
-- ALL y por lo tanto también cubre el SELECT), así que sigue viendo las
-- inactivas y las vencidas en su panel.
--
-- `paquetes_afiliacion` no tiene NI UN lector en todo el repo.
--
-- Aun así se deja pasar lo que un anónimo miraría si algún día la
-- página pública dejara de usar la llave de servicio: la recompensa
-- ACTIVA, VIGENTE HOY y de un programa activo. Cerrarlo del todo sería
-- fácil y sería una trampa para el próximo que escriba esa pantalla.
do $a5_recompensas$
declare
  v_cols text;
begin
  if to_regclass('public.recompensas') is null then
    raise notice 'AVISO 0148 (A5): falta recompensas (0060). Se salta.';
    return;
  end if;

  execute $p$drop policy if exists "Recompensas visibles para todos" on public.recompensas$p$;
  execute $p$drop policy if exists "Solo las recompensas vigentes son publicas" on public.recompensas$p$;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'recompensas'
       and column_name = 'vigencia_desde'
  ) then
    -- El día se calcula en hora de Costa Rica, igual que el RPC de
    -- canje (0125): con UTC, una recompensa que vence hoy se apagaría a
    -- las 6 de la tarde.
    execute $p$create policy "Solo las recompensas vigentes son publicas" on public.recompensas
      for select to anon, authenticated
      using (
        activo
        and (vigencia_desde is null
             or vigencia_desde <= (now() at time zone 'America/Costa_Rica')::date)
        and (vigencia_hasta is null
             or vigencia_hasta >= (now() at time zone 'America/Costa_Rica')::date)
        and exists (
          select 1 from public.programa_lealtad p
          where p.id = programa_id and p.activo
        )
      )$p$;
  else
    -- Base sin la 0125: no hay vigencia que mirar, queda el `activo`.
    execute $p$create policy "Solo las recompensas vigentes son publicas" on public.recompensas
      for select to anon, authenticated
      using (
        activo
        and exists (
          select 1 from public.programa_lealtad p
          where p.id = programa_id and p.activo
        )
      )$p$;
  end if;

  -- `sku` e `instrucciones` fuera del alcance de la llave anónima. Una
  -- política filtra FILAS y no columnas; lo que filtra columnas es el
  -- grant, igual que en la 0126 y la 0127.
  --
  -- La lista se arma leyendo la tabla y no a mano: así una base que va
  -- una migración atrás (sin `tipo`, sin `stock_total`) no se queda con
  -- un grant que nombra columnas que no existen. `authenticated` NO se
  -- toca: el dueño guarda su recompensa con `.select("*")` desde el
  -- navegador (pases-actions.ts) y necesita las dos columnas.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'recompensas'
     and column_name not in ('sku', 'instrucciones');

  if v_cols is not null then
    execute 'revoke select on public.recompensas from anon';
    execute 'grant select (' || v_cols || ') on public.recompensas to anon';
  end if;
end
$a5_recompensas$;

do $a5_paquetes$
begin
  if to_regclass('public.paquetes_afiliacion') is null then
    raise notice 'AVISO 0148 (A5): falta paquetes_afiliacion (0060). Se salta.';
    return;
  end if;

  execute $p$drop policy if exists "Paquetes visibles para todos" on public.paquetes_afiliacion$p$;
  execute $p$drop policy if exists "Solo los paquetes activos son publicos" on public.paquetes_afiliacion$p$;
  execute $p$create policy "Solo los paquetes activos son publicos" on public.paquetes_afiliacion
    for select to anon, authenticated
    using (
      activo
      and exists (
        select 1 from public.programa_lealtad p
        where p.id = programa_id and p.activo
      )
    )$p$;
end
$a5_paquetes$;


-- ============================================================
-- A6 — `pin_valido()` no comprobaba quién pregunta
-- ============================================================
-- Su hermana `fijar_pin_colaborador` (0137) arranca con
-- `if not gestiona_rancho(...) then raise`. `pin_valido` no comprueba
-- NADA y está concedida a `authenticated`: cualquiera con cuenta puede
-- probar los 10.000 PINes de cuatro dígitos de cualquier colaborador de
-- cualquier negocio, sin límite y sin dejar rastro.
--
-- Impacto HOY: cero. Se buscó en todo el repo y no la llama nadie —el
-- PIN todavía no se usa en ninguna pantalla—. Pero está viva, y el día
-- que el mostrador la use ya va a estar cerrada.
--
-- Dos candados, no uno:
--   1. el gate adentro (el patrón de `fijar_pin_colaborador`): la
--      comprueba el propio colaborador o quien gestiona el negocio;
--   2. el EXECUTE sale de `authenticated` y queda en `service_role`,
--      como los tres RPC de la 0125 — la identidad se comprueba en el
--      servidor ANTES de invocar.
--
-- De paso se corrige el `search_path`: `crypt()` vive en el esquema
-- `extensions` en Supabase (pgcrypto viene preinstalado ahí, así que el
-- `create extension if not exists` de la 0137 no lo movió a `public`), y
-- con `search_path = public` a secas la función no lo encontraría.
create or replace function public.pin_valido(
  p_rancho uuid,
  p_usuario uuid,
  p_pin text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $fn_pin$
begin
  -- auth.uid() null = llave de servicio: el servidor ya comprobó quién
  -- pregunta antes de llegar acá.
  if auth.uid() is not null
     and p_usuario is distinct from auth.uid()
     and not public.gestiona_rancho(p_rancho) then
    raise exception 'Sin permiso para comprobar ese PIN.'
      using errcode = '42501';
  end if;

  return exists (
    select 1 from public.rancho_colaboradores c
    where c.rancho_id = p_rancho
      and c.usuario_id = p_usuario
      and c.pin_hash is not null
      and c.pin_hash = crypt(p_pin, c.pin_hash)
  );
end;
$fn_pin$;

revoke all on function public.pin_valido(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.pin_valido(uuid, uuid, text) to service_role;


-- ============================================================
-- T3 — EL CORTE PASA DE INTERRUPTOR A REJA
-- ============================================================
-- La 0146 lo dejó escrito y pendiente: `pausarProgramasEn` marca
-- `pausado_por_cobro = true` y pausa el programa, pero la 0125 le da al
-- dueño el UPDATE sobre su propio programa y NADA limpia esa bandera.
-- Un clic en «Reanudar» desde su panel y vuelve a operar; y Stripe no
-- avisa nunca más por una suscripción ya cancelada, así que el corte no
-- se repite. Un corte, un clic, gratis para siempre.
--
-- La decisión del dueño de Bookea, textual: «todo deja de funcionar
-- hasta que renueven». Acá está la reja.
--
-- SE BLOQUEAN DOS COSAS, NO UNA. Negar solo el «reanudar» no alcanza:
-- el dueño pondría `pausado_por_cobro = false` con un PATCH y después
-- reanudaría como si nada. Mientras la marca esté puesta, ni se
-- reactiva el programa ni se borra la marca — y las dos cosas juntas
-- son lo único que hace que la única salida sea renovar.
--
-- LO QUE SIGUE PUDIENDO HACER EL DUEÑO CON EL PROGRAMA CORTADO: todo lo
-- demás. Cambiar el nombre, los colores, el texto del reverso, las
-- recompensas. El trigger es `before update OF estado, activo,
-- pausado_por_cobro`: si esas tres columnas no están en el SET, ni se
-- despierta. No se le apaga el panel, se le apaga la operación.
--
-- EL MENSAJE ES PARTE DEL ARREGLO. Un dueño que no entiende por qué el
-- botón no responde llama a soporte, y eso cuesta más que el mes que
-- dejó de pagar. El texto dice qué pasa Y cómo se destraba, y sale tal
-- cual en pantalla: `traducir()` en pases-actions.ts arma
-- «No se pudo ... : <mensaje de Postgres>».
create or replace function public.programa_reja_del_corte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn_corte$
begin
  if auth.uid() is null then
    return new; -- service_role: el webhook de Stripe reanuda al renovar
  end if;
  if exists (select 1 from public.perfiles p
              where p.id = auth.uid() and p.rol = 'admin') then
    return new; -- Bookea puede destrabar a mano (cortesía, error de cobro)
  end if;

  if new.pausado_por_cobro is distinct from old.pausado_por_cobro then
    raise exception 'Este programa está en pausa por falta de pago y la marca no se quita desde el panel: se levanta sola al renovar el paquete de Lealtad.'
      using errcode = '42501';
  end if;

  -- El estado EFECTIVO, con el mismo criterio del RPC de acumulación
  -- (0125) y de estadoDelPrograma en reglas.ts: la columna `estado`
  -- manda y, si está en null, se deriva del booleano `activo`. Sin
  -- esto, `set activo = true` con `estado` en null pasaría de largo.
  if coalesce(new.estado, case when new.activo then 'activo' else 'pausado' end) = 'activo' then
    raise exception 'Tu programa está en pausa porque el paquete de Lealtad no está al día. Renovalo desde el panel, en Plan, y se reactiva solo con todos los sellos y clientes intactos.'
      using errcode = '42501';
  end if;

  return new;
end;
$fn_corte$;

do $trg_corte$
begin
  if to_regclass('public.programa_lealtad') is null then
    raise notice 'AVISO 0148 (T3): falta programa_lealtad (0060). No se pone la reja.';
    return;
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programa_lealtad'
       and column_name = 'pausado_por_cobro'
  ) or not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'programa_lealtad'
       and column_name = 'estado'
  ) then
    raise notice 'AVISO 0148 (T3): faltan pausado_por_cobro (0146) o estado (0125). No se pone la reja.';
    return;
  end if;

  -- El `when (old.pausado_por_cobro)` es lo que hace que esto no le
  -- cueste nada al 99% de los programas: la función ni se llama si la
  -- fila no viene de un corte.
  execute 'drop trigger if exists programa_reja_del_corte on public.programa_lealtad';
  execute 'create trigger programa_reja_del_corte '
       || 'before update of estado, activo, pausado_por_cobro on public.programa_lealtad '
       || 'for each row when (old.pausado_por_cobro) '
       || 'execute function public.programa_reja_del_corte()';
end
$trg_corte$;


-- ------------------------------------------------------------
-- Que PostgREST se entere ya
-- ------------------------------------------------------------
-- Los `grant` por columna de A3 y A5 son lo que más necesita esto:
-- PostgREST cachea los permisos y, sin el aviso, seguiría contestando
-- con los de antes hasta el próximo reinicio. Mismo cierre que la 0068.
notify pgrst, 'reload schema';


-- ============================================================
-- COMPROBACIÓN — para correr después de pegar
-- ============================================================
-- Nada de acá cambia datos; son preguntas. Copiar el bloque que
-- interese, quitarle los guiones y correrlo en el SQL Editor.
--
-- ── A1: los dos candados del plan ───────────────────────────
-- select tgname, tgrelid::regclass as tabla, tgenabled
--   from pg_trigger
--  where tgname in ('ranchos_proteger_plan_lealtad', 'cuentas_proteger_plan');
-- -- Esperado: 2 filas, tgenabled = 'O'.
--
-- ── A2: las dos políticas del bucket ────────────────────────
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies
--  where schemaname = 'storage' and tablename = 'objects'
--    and policyname in ('El equipo puede ver los comprobantes',
--                       'Cualquiera puede subir un comprobante');
-- -- Esperado: el SELECT nombra puede_ver_comprobante; el INSERT nombra
-- -- las cuatro carpetas. Y el bucket SIGUE público (a propósito):
-- select id, public, file_size_limit from storage.buckets where id = 'comprobantes';
-- -- Esperado: public = true, file_size_limit = 10485760.
--
-- ── A3: `miembros` solo por columna ─────────────────────────
-- select column_name
--   from information_schema.column_privileges
--  where table_schema = 'public' and table_name = 'miembros'
--    and grantee = 'authenticated' and privilege_type = 'UPDATE';
-- -- Esperado: UNA fila, `estado`. Si aparecen cliente_id, persona_id o
-- -- programa_id, el revoke no corrió.
--
-- ── A4: cuenta_id dentro del with check ─────────────────────
-- select with_check from pg_policies
--  where tablename = 'programa_lealtad'
--    and policyname = 'El dueño administra su programa';
-- -- Esperado: el texto menciona gestiona_cuenta.
--
-- ── A5: lo público, y las dos columnas internas ─────────────
-- select tablename, policyname, qual from pg_policies
--  where tablename in ('recompensas', 'paquetes_afiliacion') and cmd = 'SELECT';
-- select column_name
--   from information_schema.column_privileges
--  where table_schema = 'public' and table_name = 'recompensas'
--    and grantee = 'anon' and privilege_type = 'SELECT'
--    and column_name in ('sku', 'instrucciones');
-- -- Esperado: CERO filas en la segunda.
--
-- ── A6: quién puede llamar pin_valido ───────────────────────
-- select proname, proacl from pg_proc
--  where pronamespace = 'public'::regnamespace and proname = 'pin_valido';
-- -- Esperado: solo service_role (y el dueño de la función) con EXECUTE.
--
-- ── T3: la reja, y a quién le aplica hoy ────────────────────
-- select tgname, tgenabled from pg_trigger where tgname = 'programa_reja_del_corte';
-- select id, nombre, estado, activo, pausado_por_cobro
--   from programa_lealtad where pausado_por_cobro;
-- -- Esos son los que NO pueden despausarse hasta renovar. Si hay alguno
-- -- que se cortó por error, se destraba con la llave de servicio o
-- -- desde una sesión de admin — las dos puertas que el trigger deja.
