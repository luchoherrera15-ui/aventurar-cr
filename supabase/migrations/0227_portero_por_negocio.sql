-- ============================================================
--  EL PORTERO DEL ALTA POR QR, ACOTADO AL NEGOCIO — 1 sep 2026
-- ============================================================
--
-- Reporte del dueño: «tenemos un error al registrar una tarjeta si el
-- correo ya está repetido: si la cuenta ya existe pide loguearse y
-- pide demasiados pasos. Cada negocio tiene una base de datos
-- diferente: cuando una persona registra sus datos para un cliente no
-- tiene que ver nada con los logins de Bookea».
--
-- ------------------------------------------------------------
-- QUÉ ESTABA MAL, EXACTAMENTE
-- ------------------------------------------------------------
-- El portero de `alta_persona_por_qr` (0138) preguntaba
-- `persona_protegida()`, que es una pregunta GLOBAL: ¿esta persona
-- tiene cuenta de Bookea, un contacto verificado o sellos EN ALGÚN
-- LADO? Con que se cumpliera una, frenaba.
--
-- Pero el alta ocurre en UN negocio. Que María tenga sellos en Café
-- Aurora no le da nada que perder en Barbería Pro — y sin embargo,
-- parada en la caja de Barbería Pro, el portero la mandaba a probar
-- su identidad. Protegía un valor que en ese negocio no existe.
--
-- ------------------------------------------------------------
-- QUÉ CAMBIA Y QUÉ NO
-- ------------------------------------------------------------
-- La pregunta pasa a ser la correcta: ¿tiene movimientos EN ESTE
-- PROGRAMA? El ledger (`transacciones_puntos`) es donde vive el valor
-- de verdad — los sellos, los puntos y el saldo de una gift card—,
-- así que es la prueba exacta de «acá hay algo que perder».
--
--   · Correo repetido, negocio NUEVO  → entra derecho, sin login.
--     Es el caso que reportó el dueño y el más común de todos.
--   · Correo repetido, MISMO negocio, con sellos → sigue pidiendo
--     prueba. Ese es el robo que el portero existe para impedir: con
--     el pase se va la regalía, porque el mostrador canjea contra el
--     pase (0137).
--   · Correo repetido, mismo negocio, SIN movimientos → entra: no hay
--     saldo que entregarle a nadie por error.
--
-- ------------------------------------------------------------
-- LO QUE SE PIERDE, DICHO DE FRENTE
-- ------------------------------------------------------------
-- La 0138 también usaba este portero contra el CONSENTIMIENTO
-- FALSIFICADO: que nadie firme un permiso de marketing a nombre de un
-- contacto ajeno «protegido». Al acotarlo al negocio, un contacto
-- protegido pasa a comportarse como cualquier otro en los negocios
-- donde no tiene nada — o sea, como ya se comportaban TODOS los
-- contactos no protegidos, que son la mayoría.
--
-- Es una concesión real y acotada: se acepta el mismo riesgo que el
-- sistema ya aceptaba para casi todo el mundo, a cambio de sacar un
-- paso de la caja. El robo de SELLOS —el que cuesta plata— sigue
-- cerrado.
--
-- ------------------------------------------------------------
-- ⚠️ ESTE ARCHIVO REDEFINE LA FUNCIÓN ENTERA
-- ------------------------------------------------------------
-- Es una copia literal de la de la 0138 con el bloque del portero
-- cambiado, y nada más. Postgres no deja parchear medio cuerpo, así
-- que la única forma honesta es traerla entera: si mañana alguien
-- toca la 0138, ESTA es la que manda y hay que actualizarla acá.
--
-- `alta_persona_local_por_qr` (0200) no se toca: sigue siendo la
-- salida para quien igual choca con el portero y quiere una tarjeta
-- nueva de cero.

create or replace function public.alta_persona_por_qr(
  p_programa uuid,
  p_correo text,
  p_telefono text,
  p_nombre text,
  p_consentimientos jsonb,
  p_persona_probada uuid default null,
  p_cliente_id uuid default null,
  p_ip inet default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rancho uuid;
  v_cuenta uuid;
  v_activo boolean;
  v_correo text := public.normalizar_correo(p_correo);
  v_tel text := public.normalizar_telefono(p_telefono);
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_persona uuid;
  v_probada uuid := public.persona_vigente(p_persona_probada);
  v_miembro uuid;
  v_miembro_nuevo boolean := false;
  v_ficha uuid;
  v_canales text[];
  v_canal text;
  v_version text;
  v_ambito text;
  v_acepta boolean;
  v_texto text;
begin
  if v_correo is null and v_tel is null then
    raise exception 'Hace falta el WhatsApp o el correo' using errcode = '22023';
  end if;

  select p.rancho_id,
         p.cuenta_id,
         (coalesce(p.estado, case when p.activo then 'activo' else 'pausado' end) = 'activo')
    into v_rancho, v_cuenta, v_activo
    from programa_lealtad p where p.id = p_programa;

  if v_rancho is null and v_cuenta is null then
    raise exception 'El programa % no existe', p_programa using errcode = '22023';
  end if;
  if not v_activo then
    raise exception 'El programa no está activo' using errcode = '22023';
  end if;

  v_version := coalesce(p_consentimientos->>'version', 'qr-v1');
  v_canales := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(p_consentimientos->'canales') as t(x)),
    array['whatsapp', 'correo']
  );

  -- ── EL PORTERO, AHORA ACOTADO A ESTE NEGOCIO (0227) ───────────
  --
  -- Se mira ANTES de escribir una sola fila. Antes preguntaba
  -- `persona_protegida()`, que es GLOBAL: tener cuenta de Bookea, un
  -- contacto verificado o sellos EN CUALQUIER negocio alcanzaba para
  -- frenar el alta.
  --
  -- Eso frenaba el caso más común y más inocente que hay: María tiene
  -- sellos en Café Aurora, va a Barbería Pro —otro negocio, otra base
  -- de clientes— escribe su correo de siempre y el portero la manda a
  -- identificarse. En Barbería Pro NO TIENE NADA: no hay sellos que
  -- robar, no hay tarjeta que entregar por error. La prueba no
  -- protegía nada y solo costaba pasos en la caja.
  --
  -- Ahora la pregunta es la correcta: ¿esta persona tiene algo que
  -- perder EN ESTE PROGRAMA? Se mira el ledger de este programa, que
  -- es donde vive el valor —los sellos, los puntos y el saldo de una
  -- gift card—. Si no tiene movimientos acá, entra derecho.
  --
  -- Lo que NO cambia: quien SÍ tiene sellos en este mismo negocio
  -- sigue pidiendo prueba. Ese es el robo que el portero existe para
  -- impedir, y sigue impedido.
  if p_cliente_id is null and v_probada is null then
    select public.persona_vigente(id) into v_persona
      from personas
     where (v_correo is not null and correo = v_correo)
        or (v_tel is not null and telefono = v_tel)
     limit 1;

    if v_persona is not null and exists (
         select 1
           from transacciones_puntos t
           join miembros m on m.id = t.miembro_id
          where m.persona_id = v_persona
            and m.programa_id = p_programa
          limit 1
       ) then
      return jsonb_build_object(
        'estado', 'requiere_prueba',
        'persona_id', v_persona,
        'canal_sugerido',
          case when (select correo from personas where id = v_persona) is not null
               then 'correo' else 'whatsapp' end
      );
    end if;
    v_persona := null;
  end if;

  -- El QR pide los dos datos, pero se acepta con uno: un teléfono mal
  -- tecleado no puede costar el pase entero.
  v_persona := public.resolver_persona(
    p_cliente_id => p_cliente_id,
    p_correo     => p_correo,
    p_telefono   => p_telefono,
    p_nombre     => p_nombre,
    p_origen     => 'qr_tarjeta',
    p_ip         => p_ip,
    p_user_agent => p_user_agent
  );

  -- Si venía probada por cookie/sesión y el contacto resolvió a otra
  -- fila, son dos filas del mismo humano: queda anotado, no se fusiona
  -- sola (fusionar es destructivo y va con intención).
  if v_probada is not null and v_probada <> v_persona then
    insert into personas_duplicados (persona_a, persona_b, motivo)
    values (v_probada, v_persona, 'manual')
    on conflict do nothing;
  end if;

  if exists (select 1 from personas where id = v_persona and bloqueada_en is not null) then
    raise exception 'Esta identidad está bloqueada' using errcode = '22023';
  end if;

  -- Vínculo con el negocio.
  insert into personas_negocio (persona_id, cuenta_id, rancho_id, origen)
  values (v_persona, v_cuenta, v_rancho, 'qr_tarjeta')
  on conflict do nothing;

  update personas_negocio
     set ultimo_contacto = now()
   where persona_id = v_persona
     and cuenta_id is not distinct from v_cuenta
     and rancho_id is not distinct from v_rancho;

  -- La ficha del negocio: es por donde el dueño ve a su gente, con la
  -- RLS que la 0109 ya le dio. Se completa sin pisar nada escrito a
  -- mano, y solo con identificadores que estén libres en ese negocio
  -- (los únicos parciales de la 0109 son por negocio).
  --
  -- `to_regclass` porque la 0109 puede no estar pegada. El alta NO
  -- depende de esta tabla: la persona, el vínculo, los consentimientos
  -- y la membresía ya quedaron. Esto es el enlace con el CRM, y su
  -- ausencia no puede costar el pase que la persona vino a buscar.
  if v_rancho is not null and to_regclass('public.clientes_negocio') is not null then
    select id into v_ficha from clientes_negocio
     where rancho_id = v_rancho and persona_id = v_persona;

    if v_ficha is null and v_correo is not null then
      select id into v_ficha from clientes_negocio
       where rancho_id = v_rancho and correo = v_correo;
    end if;
    if v_ficha is null and v_tel is not null then
      select id into v_ficha from clientes_negocio
       where rancho_id = v_rancho and telefono = v_tel;
    end if;

    if v_ficha is null then
      insert into clientes_negocio (rancho_id, cliente_id, persona_id, correo, telefono,
                                    nombre, origen)
      values (v_rancho, p_cliente_id, v_persona, v_correo, v_tel, v_nombre, 'qr_tarjeta')
      on conflict do nothing
      returning id into v_ficha;
    else
      update clientes_negocio
         set persona_id = coalesce(persona_id, v_persona),
             correo = coalesce(correo, v_correo),
             telefono = coalesce(telefono, v_tel),
             nombre = coalesce(nombre, v_nombre),
             updated_at = now()
       where id = v_ficha;
    end if;
  end if;

  -- Una fila por canal y por ámbito. También se guarda el "no acepto":
  -- poder demostrar que la casilla se mostró y quedó sin marcar vale
  -- tanto como poder demostrar que se marcó.
  foreach v_canal in array v_canales loop
    if v_canal not in ('whatsapp', 'correo', 'sms') then
      continue;
    end if;

    foreach v_ambito in array array['negocio', 'bookea'] loop
      if (p_consentimientos->v_ambito) is null then
        continue;
      end if;
      v_acepta := coalesce((p_consentimientos->v_ambito->>'acepta')::boolean, false);
      v_texto := p_consentimientos->v_ambito->>'texto';
      if v_texto is null or char_length(v_texto) < 10 then
        raise exception 'Falta el texto exacto del consentimiento de %', v_ambito
          using errcode = '22023';
      end if;

      insert into consentimientos_persona
        (persona_id, ambito, cuenta_id, rancho_id, canal, estado, correo, telefono,
         texto_version, texto_exacto, origen, ip, user_agent)
      values
        (v_persona, v_ambito,
         case when v_ambito = 'negocio' then v_cuenta end,
         case when v_ambito = 'negocio' then v_rancho end,
         v_canal,
         case when v_acepta then 'aceptado' else 'revocado' end,
         v_correo, v_tel,
         v_version, v_texto, 'qr_tarjeta', p_ip, left(p_user_agent, 400));
    end loop;
  end loop;

  -- Espejo en el ledger viejo por correo (0082), para que `/baja`, el
  -- webhook de Resend y `acepta_marketing()` —que las campañas de hoy
  -- ya usan— sigan dando la misma respuesta sin reescribirlos.
  if v_correo is not null and 'correo' = any(v_canales) then
    if (p_consentimientos->'negocio') is not null and v_rancho is not null then
      insert into consentimientos (correo, cliente_id, rancho_id, estado, origen, detalle)
      values (v_correo, p_cliente_id, v_rancho,
              case when coalesce((p_consentimientos->'negocio'->>'acepta')::boolean, false)
                   then 'aceptado' else 'revocado' end,
              'qr_tarjeta', 'Espejo de consentimientos_persona (0138)');
    end if;
    if (p_consentimientos->'bookea') is not null then
      insert into consentimientos (correo, cliente_id, rancho_id, estado, origen, detalle)
      values (v_correo, p_cliente_id, null,
              case when coalesce((p_consentimientos->'bookea'->>'acepta')::boolean, false)
                   then 'aceptado' else 'revocado' end,
              'qr_tarjeta', 'Espejo de consentimientos_persona (0138)');
    end if;
  end if;

  -- La membresía. El tope del plan lo comprueba el servidor antes de
  -- llamar (`personas_activas_del_programa`), porque el mensaje de
  -- "plan lleno" es de producto, no de base.
  select id into v_miembro from miembros
   where programa_id = p_programa and persona_id = v_persona;

  if v_miembro is null then
    insert into miembros (programa_id, persona_id, cliente_id, estado)
    values (p_programa, v_persona, p_cliente_id, 'activa')
    on conflict do nothing
    returning id into v_miembro;

    if v_miembro is null then
      select id into v_miembro from miembros
       where programa_id = p_programa and persona_id = v_persona;
    else
      v_miembro_nuevo := true;
    end if;
  end if;

  update miembros set cliente_id = p_cliente_id
   where id = v_miembro and cliente_id is null and p_cliente_id is not null;

  return jsonb_build_object(
    'estado', 'listo',
    'persona_id', v_persona,
    'miembro_id', v_miembro,
    'miembro_nuevo', v_miembro_nuevo,
    'ficha_id', v_ficha,
    'verificada', public.persona_verificada(v_persona)
  );
end;
$$;

comment on function public.alta_persona_por_qr(uuid, text, text, text, jsonb, uuid, uuid, inet, text) is
  'Alta por QR. El portero de requiere_prueba mira si la persona tiene movimientos EN ESTE PROGRAMA (0227), no si está protegida globalmente: tener sellos en otro negocio no puede frenar el alta acá.';

notify pgrst, 'reload schema';
