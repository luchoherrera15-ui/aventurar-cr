-- ============================================================
-- 0200 — AFILIARSE SIN CUENTA CUANDO EL CONTACTO YA TIENE DUEÑO
--
-- Pedido del dueño, textual: «cuando solicitamos una tarjeta el sistema
-- nos pide un correo y un número de teléfono... si el correo ya está,
-- pide loguearse y eso es tedioso cuando ya vayan a otro cliente y ya
-- exista el correo. La idea de pedir eso es meramente para tener base
-- de datos de clientes.»
--
-- ------------------------------------------------------------
-- EL CHOQUE, Y POR QUÉ NO SE RESUELVE ABRIENDO EL PORTERO
-- ------------------------------------------------------------
-- Tiene razón en el objetivo: pedir correo y WhatsApp es para PODER
-- CONTACTAR, no para autenticar. Pero el portero de la 0138
-- (`alta_persona_por_qr`, el `requiere_prueba`) tampoco está de adorno:
-- si el contacto tecleado ya pertenece a una `persona_protegida()`
-- —tiene cuenta, un contacto probado o sellos en el ledger— dejar pasar
-- sería entregarle a un desconocido el pase de esa persona. Y con el
-- pase se va su regalía, porque el escáner del mostrador canjea contra
-- el pase (0137).
--
-- O sea que las dos posturas obvias están mal:
--   · dejar pasar → cualquiera se lleva los sellos ajenos escribiendo
--     un correo que se puede adivinar;
--   · seguir frenando → el cliente parado en la caja se va sin tarjeta,
--     que es exactamente lo que reportó el dueño.
--
-- ------------------------------------------------------------
-- LA SALIDA: OTRA IDENTIDAD, NO LA MISMA
-- ------------------------------------------------------------
-- Se puede tener las dos cosas si se deja de tratar el contacto
-- tecleado como una LLAVE y se lo trata como lo que el dueño dijo que
-- es: un DATO DE CONTACTO.
--
-- `alta_persona_local_por_qr` (abajo) crea una persona NUEVA, local de
-- este negocio, que:
--
--   · empieza en CERO sellos, como cualquier cliente nuevo;
--   · no lee, no fusiona y no le cuelga NADA a la identidad dueña del
--     correo — ni siquiera la busca;
--   · guarda el correo y el WhatsApp en el VÍNCULO con este negocio
--     (`personas_negocio.correo_declarado` / `.telefono_declarado`), no
--     en las columnas globales de `personas`, que son las que
--     deduplican. Por eso pueden repetirse sin romper la deduplicación,
--     y por eso el negocio SÍ tiene su base de datos de clientes.
--
-- Los tres casos que importan:
--   · DOS PERSONAS CON EL MISMO CORREO → dos fichas, dos tarjetas, dos
--     saldos. Ninguna ve la otra.
--   · QUIEN YA TIENE CUENTA Y SELLOS → su tarjeta no se toca. Se
--     recupera con el código del correo, que sigue siendo el camino que
--     la pantalla ofrece PRIMERO y en el botón lleno.
--   · UN DEDAZO → se lleva SU tarjeta en vez de quedarse sin ninguna.
--
-- ------------------------------------------------------------
-- ESTO NO ES `alta_por_mostrador` (0184)
-- ------------------------------------------------------------
-- La 0184 la teclea el DUEÑO con la persona enfrente, y por eso puede
-- rechazar cuando el contacto ya tiene dueño («a quien ya tiene ficha
-- se lo busca por nombre»). Acá teclea la PERSONA en su teléfono, sin
-- nadie que la mire, y rechazar es justamente el problema que se vino a
-- resolver. Distinto quién, distinto origen, distinta salida.
-- ============================================================


-- ------------------------------------------------------------
-- 1. `personas.solo_contacto` — la identidad que no reclama contactos
--
-- Una persona local no puede llenar `correo` ni `telefono`: esas
-- columnas tienen índice único global (0138) y es ESE único lo que hace
-- que la deduplicación de Bookea sea real. Escribir ahí un contacto que
-- ya es de otro sería, literalmente, el robo que esta migración evita.
--
-- Pero el check `personas_algun_identificador` de la 0138 exige que la
-- fila tenga al menos uno de los tres. Se ensancha para aceptar
-- exactamente este caso y NADA más: una fila sin identificadores es
-- válida SOLO si está marcada como local.
--
-- El bandera es explícita y no implícita («no tiene ninguno de los
-- tres») a propósito: quien lea la tabla dentro de un año tiene que
-- poder distinguir «identidad local a propósito» de «fila rota».
-- ------------------------------------------------------------

alter table public.personas
  add column if not exists solo_contacto boolean not null default false;

alter table public.personas
  drop constraint if exists personas_algun_identificador;
alter table public.personas
  add constraint personas_algun_identificador check (
    telefono is not null
    or correo is not null
    or cliente_id is not null
    -- La identidad LOCAL de un negocio: su contacto vive en el vínculo
    -- (`personas_negocio.*_declarado`), no acá. Ver la cabecera.
    or solo_contacto
  );

comment on column public.personas.solo_contacto is
  'true = identidad LOCAL de un negocio (0200): la persona escribió un '
  'contacto que ya pertenecía a otra identidad y eligió seguir sin '
  'cuenta. Su correo y su teléfono viven en personas_negocio como '
  'DECLARADOS, nunca en las columnas globales de esta tabla — no '
  'deduplican, no reclaman nada y no se pueden usar para entrar. '
  'persona_verificada() es siempre false para ellas al nacer.';


-- ------------------------------------------------------------
-- 2. El contacto declarado, en el VÍNCULO con el negocio
--
-- Va acá y no en `clientes_negocio` (que sería el lugar natural del
-- CRM) porque esa tabla tiene único parcial por (rancho_id, correo):
-- si el dueño del correo también es cliente de este negocio, el insert
-- chocaría y el dato se perdería justo en el caso que motivó todo esto.
-- `personas_negocio` no tiene ese único, y además ES la tabla que dice
-- «esta persona es de este negocio»: el contacto que le dio a ESE
-- negocio pertenece exactamente ahí.
--
-- Sin índice único, y es deliberado: dos personas distintas pueden
-- haber declarado el mismo correo en el mismo negocio. Eso no es un
-- error de datos — es el hecho que se está registrando.
-- ------------------------------------------------------------

alter table public.personas_negocio
  add column if not exists correo_declarado text;
alter table public.personas_negocio
  add column if not exists telefono_declarado text;

-- El mismo formato normalizado que exige `personas` (0138), para que
-- nadie meta "  Ana@X.com " por la puerta de atrás y el panel lo pinte
-- con espacios.
alter table public.personas_negocio
  drop constraint if exists personas_negocio_correo_declarado_formato;
alter table public.personas_negocio
  add constraint personas_negocio_correo_declarado_formato check (
    correo_declarado is null
    or (correo_declarado = btrim(lower(correo_declarado))
        and position('@' in correo_declarado) > 1
        and correo_declarado !~ '\s')
  );

alter table public.personas_negocio
  drop constraint if exists personas_negocio_telefono_declarado_formato;
alter table public.personas_negocio
  add constraint personas_negocio_telefono_declarado_formato check (
    telefono_declarado is null or telefono_declarado ~ '^[0-9]{8}$'
  );

comment on column public.personas_negocio.correo_declarado is
  'El correo que esta persona le dio a ESTE negocio cuando pidió su '
  'tarjeta y el contacto ya pertenecía a otra identidad (0200). Es un '
  'dato de contacto, NO una llave: no deduplica, no verifica y puede '
  'repetirse. Para el correo que sí identifica, ver personas.correo.';
comment on column public.personas_negocio.telefono_declarado is
  'Igual que correo_declarado, para el WhatsApp (0200).';


-- ------------------------------------------------------------
-- 3. `alta_persona_local_por_qr`
--
-- Hermana de `alta_persona_por_qr` (0138:1903): MISMO orden interno
-- —persona → vínculo → consentimiento → membresía— para que el trigger
-- `miembros_zexigir_respaldo` de la 0181 nunca la frene, y las mismas
-- validaciones de programa. Con tres diferencias, todas a propósito:
--
--   1. NO llama a `resolver_persona`. Crea la fila directo, sin buscar
--      por contacto: buscar sería el primer paso hacia fusionar, y
--      fusionar es exactamente lo que no puede pasar acá.
--   2. NO escribe el espejo de `consentimientos` (0082). Esa tabla está
--      indexada por CORREO a secas y la usan `/baja`, el webhook de
--      Resend y `acepta_marketing()`: anotar ahí «este correo aceptó
--      promos» cuando el correo es de un tercero sería atribuirle a esa
--      persona un permiso que nunca dio. El respaldo de la Ley 8968
--      igual queda en `consentimientos_persona`, contra ESTA persona y
--      con el texto exacto — que es lo que hay que poder demostrar.
--   3. NO hace cumplir el tope del paquete. Igual que la 0184: ese
--      chequeo vive en TypeScript, antes de llamar, porque «paquete
--      lleno» es un motivo de producto y esta función no conoce el plan
--      de la cuenta.
--
-- `origen = 'qr_tarjeta_local'` en las tres tablas: quien mire después
-- por qué hay dos fichas con el mismo correo tiene que poder verlo sin
-- adivinar.
-- ------------------------------------------------------------

create or replace function public.alta_persona_local_por_qr(
  p_programa uuid,
  p_correo text,
  p_telefono text,
  p_nombre text,
  p_consentimientos jsonb,
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
  v_miembro uuid;
  v_miembro_nuevo boolean := false;
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

  -- El nombre es OBLIGATORIO acá y no opcional como en la 0138: esta
  -- puerta crea una ficha que el negocio no va a poder cruzar con
  -- ninguna otra por contacto (justamente porque el contacto está
  -- repetido). Sin nombre, en el panel serían dos «Cliente sin datos»
  -- indistinguibles.
  if v_nombre is null then
    raise exception 'Hace falta el nombre' using errcode = '22023';
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

  -- ── LA PERSONA, LOCAL Y SIN CONTACTOS GLOBALES ─────────────────
  -- Sin `correo` ni `telefono`: esos son los que deduplican, y son de
  -- otra identidad. Sin `cliente_id`: no hay cuenta. Con
  -- `solo_contacto` en true, que es lo que hace legal a la fila y lo
  -- que la marca para siempre como lo que es.
  insert into personas (pais, nombre, origen, solo_contacto, ip_alta, user_agent_alta)
  values ('CR', v_nombre, 'qr_tarjeta_local', true, p_ip, left(p_user_agent, 400))
  returning id into v_persona;

  -- ── EL VÍNCULO, CON EL CONTACTO DECLARADO ──────────────────────
  insert into personas_negocio
    (persona_id, cuenta_id, rancho_id, origen, correo_declarado, telefono_declarado)
  values (v_persona, v_cuenta, v_rancho, 'qr_tarjeta_local', v_correo, v_tel);

  -- ── EL CONSENTIMIENTO ──────────────────────────────────────────
  -- Idéntico a la 0138: una fila por canal y por ámbito, y también se
  -- guarda el «no acepto». El correo y el teléfono que se archivan son
  -- los DECLARADOS —es lo que la persona leyó y firmó en esa pantalla—,
  -- lo cual es correcto como prueba aunque no identifiquen.
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
         v_version, v_texto, 'qr_tarjeta_local', p_ip, left(p_user_agent, 400));
    end loop;
  end loop;

  -- Nada de espejo en `consentimientos` (0082). Ver la cabecera: ese
  -- ledger es por correo a secas, y este correo es de otra persona.

  -- ── LA MEMBRESÍA ───────────────────────────────────────────────
  -- La persona es nueva por construcción, así que no puede existir ya.
  insert into miembros (programa_id, persona_id, cliente_id, estado)
  values (p_programa, v_persona, null, 'activa')
  returning id into v_miembro;
  v_miembro_nuevo := true;

  return jsonb_build_object(
    'estado', 'listo',
    'persona_id', v_persona,
    'miembro_id', v_miembro,
    'miembro_nuevo', v_miembro_nuevo,
    'solo_contacto', true
  );
end;
$$;

-- Igual que su hermana de la 0138: SOLO `service_role`. Esta función
-- crea identidades sin ninguna prueba de posesión —es su trabajo— así
-- que solo puede llamarla el servidor, que además comprueba el tope del
-- paquete antes. Expuesta a `anon` sería una fábrica de miembros.
revoke all on function public.alta_persona_local_por_qr(uuid, text, text, text, jsonb, inet, text)
  from public, anon, authenticated;
grant execute on function public.alta_persona_local_por_qr(uuid, text, text, text, jsonb, inet, text)
  to service_role;

comment on function public.alta_persona_local_por_qr(uuid, text, text, text, jsonb, inet, text) is
  'Alta por QR SIN reclamar el contacto (0200). Se llama solo cuando '
  'alta_persona_por_qr devolvió requiere_prueba y la persona eligió '
  'seguir sin cuenta: crea una identidad LOCAL con cero sellos y '
  'guarda su contacto en personas_negocio como declarado. Nunca lee '
  'ni fusiona la identidad dueña del contacto.';


-- ------------------------------------------------------------
-- 4. RLS y grants: ninguno nuevo hace falta
--
-- `personas` y `personas_negocio` no tienen ninguna política de
-- ESCRITURA para nadie desde la 0138 (la RLS niega por defecto): se
-- escriben solo con la llave de servicio, y esta función es SECURITY
-- DEFINER. Las dos columnas nuevas viven dentro de esas tablas y
-- heredan su lectura: `ve_persona()` sigue siendo por VÍNCULO, o sea
-- que un negocio ve el contacto declarado de SUS personas y de ninguna
-- otra — que es exactamente lo que el dueño pidió.
--
-- `solo_contacto` tampoco cambia `persona_verificada()` ni
-- `persona_protegida()`: una identidad local no tiene cuenta ni
-- contacto probado, así que las dos dan false al nacer y true en
-- cuanto junte sellos. Nadie va a poder reclamarla después sin prueba,
-- igual que cualquier otra.
-- ------------------------------------------------------------

notify pgrst, 'reload schema';
