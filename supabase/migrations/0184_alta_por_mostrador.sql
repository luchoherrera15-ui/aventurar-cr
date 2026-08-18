
-- ============================================================
-- 0184 — ALTA A MANO DESDE EL MOSTRADOR
--
-- Pedido del dueño, textual: quiere empezar a afiliar a mano, HOY, a
-- clientes reales que van a quedar funcionando PARA SIEMPRE — no es un
-- script de una vez, es una puerta más del producto.
--
-- ------------------------------------------------------------
-- POR QUÉ ES UNA FUNCIÓN NUEVA Y NO SE REUSA `alta_persona_por_qr`
-- ------------------------------------------------------------
-- `alta_persona_por_qr` (0138:1903) hace exactamente lo que hace falta
-- —persona → vínculo → consentimiento → membresía, en una transacción—
-- pero está cableada a dos mentiras si la llama el mostrador:
--   · `origen => 'qr_tarjeta'` en tres inserts, cuando en realidad
--     tecleó el dueño; rompe la trazabilidad que la 0181 se tomó el
--     trabajo de poder distinguir (`personas_negocio.origen`).
--   · el texto de consentimiento que exige (`p_consentimientos->negocio
--     ->texto`) está pensado para una PERSONA leyendo una pantalla y
--     marcando su propia casilla — acá es el negocio preguntando de
--     viva voz. `textoConsentimientoMostrador` / `mostrador-v1`
--     (src/lib/lealtad/personas.ts:243-250) ya existen para decir la
--     verdad distinta, y hoy solo se usan para REGULARIZAR una ficha
--     vieja (`completarDatosDelCliente`), nunca para crear una nueva.
--
-- La pieza reusable de verdad es `resolver_persona` (0138:780), que es
-- genérica y acepta `p_origen` por parámetro. Esta función es la
-- hermana de `alta_persona_por_qr`: MISMO orden interno (así el
-- trigger `miembros_zexigir_respaldo` de la 0181 nunca la frena),
-- otro origen, otro texto, y SIN el portero de `requiere_prueba` — ver
-- por qué abajo.
--
-- ------------------------------------------------------------
-- POR QUÉ NO HAY PORTERO DE `requiere_prueba`, Y QUÉ LO REEMPLAZA
-- ------------------------------------------------------------
-- El portero del QR (0138:1961-1981) protege contactos de personas
-- `persona_protegida()` de un DESCONOCIDO probando datos ajenos por
-- internet. Acá quien teclea es el dueño con la persona enfrente — ese
-- riesgo no existe.
--
-- Pero SÍ existe otro: que el correo/WhatsApp tecleado YA sea de
-- alguien más (un cliente de otro negocio, alguien con cuenta de
-- Bookea). `resolver_persona` fusionaría feliz —es su trabajo— y esta
-- puerta le colgaría a un tercero un consentimiento y una membresía de
-- ESTE negocio sin que esa persona haya dicho ni sí ni no acá. Por eso
-- esta función RECHAZA (no fusiona) apenas el contacto ya pertenece a
-- alguien: "Agregar cliente" es solo para gente nueva en Bookea
-- enteramente. A quien ya tiene ficha se lo busca por nombre (la
-- puerta que ya existe), no se lo vuelve a dar de alta.
--
-- El chequeo va ACÁ, adentro de la transacción, y no en TypeScript
-- antes de llamar: así dos cajeros tecleando al mismo cliente nuevo a
-- la misma vez no pueden colarse los dos por una carrera. TypeScript
-- SÍ repite el mismo chequeo antes de llamar (mismo criterio que
-- `completarDatosDelCliente`, personas.ts/lealtad-operar-actions.ts)
-- para poder avisarle al cajero sin gastar el viaje al RPC — la misma
-- filosofía que ya declaran `normalizarCorreo`/`normalizarTelefonoCR`
-- en personas.ts:63-71: la base manda, TypeScript repite para avisar
-- antes.
--
-- ------------------------------------------------------------
-- QUÉ NO HACE
-- ------------------------------------------------------------
-- No hace cumplir el tope de clientes del paquete (`cupo.ts`) — ESE
-- chequeo queda en TypeScript, antes de llamar acá, exactamente con el
-- mismo criterio que `altaPorQr` (personas.ts:863-880): el motivo de
-- "paquete lleno" es de producto, no de base, y esta función no conoce
-- el plan de la cuenta.
-- ============================================================

-- ------------------------------------------------------------
-- `clientes_negocio.origen` TODAVÍA NO CONOCÍA 'mostrador'
-- ------------------------------------------------------------
-- El check de esa columna (fijado en la 0138 y reafirmado en la 0153)
-- solo aceptaba 'crm', 'qr_tarjeta', 'lealtad', 'reserva', 'importacion'.
-- Sin ensancharlo acá, el insert de más abajo (línea ~183) revienta el
-- check CADA VEZ que se afilia a alguien genuinamente nuevo —el caso
-- central de este pedido— y la transacción entera se deshace (persona,
-- vínculo y consentimiento incluidos), porque todo corre en una sola
-- función. Mismo patrón exacto que ya usaron la 0138 y la 0153 para
-- este mismo constraint: drop + add con la lista completa.
do $$
begin
  execute 'alter table public.clientes_negocio drop constraint if exists clientes_negocio_origen_check';
  execute 'alter table public.clientes_negocio add constraint clientes_negocio_origen_check check (origen in (''crm'', ''qr_tarjeta'', ''lealtad'', ''reserva'', ''importacion'', ''mostrador''))';
end $$;

create or replace function public.alta_persona_por_mostrador(
  p_programa uuid,
  p_correo text,
  p_telefono text,
  p_nombre text,
  p_acepta boolean,
  p_texto_consentimiento text,
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
  v_tel    text := public.normalizar_telefono(p_telefono);
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_existente uuid;
  v_persona uuid;
  v_miembro uuid;
  v_miembro_nuevo boolean := false;
  v_ficha uuid;
begin
  if v_correo is null and v_tel is null then
    raise exception 'Hace falta el WhatsApp o el correo' using errcode = '22023';
  end if;
  if v_nombre is null then
    raise exception 'Hace falta el nombre' using errcode = '22023';
  end if;
  if p_texto_consentimiento is null or char_length(p_texto_consentimiento) < 10 then
    raise exception 'Falta el texto del consentimiento' using errcode = '22023';
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

  -- ── RECHAZO DE DUPLICADOS (ver cabecera) ──────────────────────────
  -- Se mira ANTES de escribir una fila, igual que el portero del QR.
  -- Devuelve QUÉ campo chocó, para que la pantalla lo pueda señalar
  -- (mismo criterio que completarDatosDelCliente:677-686, que separa
  -- el aviso de correo del de WhatsApp).
  if v_correo is not null then
    select public.persona_vigente(id) into v_existente from personas where correo = v_correo;
    if v_existente is not null then
      return jsonb_build_object('estado', 'duplicado', 'campo', 'correo', 'persona_id', v_existente);
    end if;
  end if;

  if v_tel is not null then
    select public.persona_vigente(id) into v_existente
      from personas where pais = 'CR' and telefono = v_tel;
    if v_existente is not null then
      return jsonb_build_object('estado', 'duplicado', 'campo', 'whatsapp', 'persona_id', v_existente);
    end if;
  end if;

  -- No hay portero de identidad protegida: acá SIEMPRE se crea una
  -- persona nueva (el paso de arriba ya descartó que exista una).
  v_persona := public.resolver_persona(
    p_correo     => p_correo,
    p_telefono   => p_telefono,
    p_nombre     => p_nombre,
    p_origen     => 'mostrador',
    p_ip         => p_ip,
    p_user_agent => p_user_agent
  );

  -- Vínculo con el negocio.
  insert into personas_negocio (persona_id, cuenta_id, rancho_id, origen)
  values (v_persona, v_cuenta, v_rancho, 'mostrador')
  on conflict do nothing;

  update personas_negocio
     set ultimo_contacto = now()
   where persona_id = v_persona
     and cuenta_id is not distinct from v_cuenta
     and rancho_id is not distinct from v_rancho;

  -- La ficha del negocio (CRM, 0109) — opcional, igual que en el QR:
  -- si la 0109 no está pegada, `to_regclass` la salta sin tumbar el
  -- alta. No hay `on conflict` porque las llaves únicas de esta tabla
  -- son (rancho_id, correo) y (rancho_id, telefono), no persona_id:
  -- se pregunta antes, igual que `alta_persona_por_qr` (0138:2028-2055).
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
      insert into clientes_negocio (rancho_id, persona_id, correo, telefono, nombre, origen)
      values (v_rancho, v_persona, v_correo, v_tel, v_nombre, 'mostrador')
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

  -- El respaldo (Ley 8968). Una fila por canal, SIEMPRE se escribe —
  -- aceptada o revocada — igual que el QR y que completarDatosDelCliente.
  -- Un solo ámbito ('negocio'): acá no hay consentimiento de plataforma
  -- que pedir, es el negocio preguntando por sus propias promociones.
  insert into consentimientos_persona
    (persona_id, ambito, cuenta_id, rancho_id, canal, estado, correo, telefono,
     texto_version, texto_exacto, origen, ip, user_agent)
  select v_persona, 'negocio', v_cuenta, v_rancho, canal,
         case when p_acepta then 'aceptado' else 'revocado' end,
         v_correo, v_tel, 'mostrador-v1', p_texto_consentimiento, 'mostrador',
         p_ip, left(p_user_agent, 400)
    from unnest(array['whatsapp', 'correo']) as canal;

  -- La membresía. Recién acá, al final — el trigger de la 0181 ya tiene
  -- vínculo y consentimiento escritos para satisfacerse.
  select id into v_miembro from miembros
   where programa_id = p_programa and persona_id = v_persona;

  if v_miembro is null then
    insert into miembros (programa_id, persona_id, estado)
    values (p_programa, v_persona, 'activa')
    on conflict do nothing
    returning id into v_miembro;

    if v_miembro is null then
      select id into v_miembro from miembros
       where programa_id = p_programa and persona_id = v_persona;
    else
      v_miembro_nuevo := true;
    end if;
  end if;

  return jsonb_build_object(
    'estado', 'listo',
    'persona_id', v_persona,
    'miembro_id', v_miembro,
    'miembro_nuevo', v_miembro_nuevo,
    'ficha_id', v_ficha
  );
end;
$$;

-- Solo el servidor. El panel siempre llama con la llave de servicio
-- (createAdminClient()), igual que el resto de las funciones de
-- creación de identidad de la 0138.
revoke all on function public.alta_persona_por_mostrador(
  uuid, text, text, text, boolean, text, inet, text
) from public, anon, authenticated;
grant execute on function public.alta_persona_por_mostrador(
  uuid, text, text, text, boolean, text, inet, text
) to service_role;

comment on function public.alta_persona_por_mostrador is
  'Alta a mano desde el mostrador (0184), hermana de alta_persona_por_qr '
  '(0138). Mismo orden interno (persona → vínculo → consentimiento → '
  'membresía) para satisfacer miembros_zexigir_respaldo (0181), pero con '
  'origen=mostrador, texto/versión mostrador-v1, y SIN portero de '
  'requiere_prueba: en su lugar rechaza (estado=duplicado) si el '
  'contacto ya es de una persona existente — esta puerta es solo para '
  'gente nueva en Bookea. El tope del paquete (cupo.ts) lo comprueba '
  'quien llama, ANTES de este RPC — igual que altaPorQr.';
