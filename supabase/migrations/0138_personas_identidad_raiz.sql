
-- ============================================================
-- BOOKEA — PERSONAS: la identidad raíz de la plataforma (0138)
--
-- ── EL PEDIDO ────────────────────────────────────────────────────────
--
-- Alguien escanea el QR del póster de una barbería, deja su WhatsApp y
-- su correo, acepta los consentimientos y se lleva el pase a Wallet.
-- Nunca crea una cuenta, nunca pone una contraseña, nunca abre el
-- buzón a copiar un código de 6 dígitos.
--
-- Hoy eso es imposible por UNA línea:
--   `miembros.cliente_id uuid not null references auth.users(id)` (0060:126).
-- Toda la lealtad cuelga de una cuenta de Supabase. Sin cuenta no hay
-- miembro; sin miembro no hay pase.
--
-- ── LA DECISIÓN ──────────────────────────────────────────────────────
--
-- La PERSONA deja de ser `auth.users` y pasa a ser una fila de
-- `personas`, propia de Bookea, cuya llave son sus CONTACTOS reales:
-- el teléfono normalizado a 8 dígitos y el correo en minúsculas —
-- exactamente la identidad canónica que el repo ya definió en
-- `src/lib/crm-citas.ts` (`claveCliente`: cliente_id → correo →
-- teléfono → nombre).
--
-- `auth.users` pasa a ser un ENRIQUECIMIENTO opcional de esa persona
-- (`personas.cliente_id`, nullable). Quien abre cuenta gana sesión,
-- app móvil y "mis tarjetas"; quien no la abre sigue siendo la MISMA
-- persona, con el mismo saldo y el mismo pase.
--
-- El aislamiento por negocio NO vive en la identidad: vive en el
-- VÍNCULO (`personas_negocio`). El negocio ve a una persona si y solo
-- si tiene fila de vínculo con ella. Bookea (admin) ve todos los
-- vínculos, y ahí está el cruce entre negocios que se pidió.
--
-- ── DECLARADO vs PROBADO (lo que impide el robo de sellos) ───────────
--
-- Un dato TECLEADO no es identidad: cualquiera escribe el número del
-- vecino. Por eso cada contacto tiene su propio estado de
-- verificación, y la regla es una sola:
--
--   Entrar es libre. RECLAMAR UNA IDENTIDAD PROTEGIDA exige prueba.
--
-- Una persona está PROTEGIDA cuando tiene cuenta de Bookea, o algún
-- contacto verificado, o ya tiene movimientos en el ledger (o sea,
-- sellos que valen algo). Si el alta por QR cae sobre una persona
-- protegida y quien la pide no trae prueba (cookie de esta misma
-- persona, sesión de Supabase, u OTP recién verificado), el RPC NO
-- escribe NADA: devuelve `requiere_prueba` y la pantalla pide
-- confirmar el correo o el WhatsApp.
--
-- Eso cierra los dos abusos que importan:
--   · robo de sellos — la tarjeta con valor no se entrega sin prueba;
--   · consentimiento falsificado — nadie firma un permiso a nombre de
--     un contacto ajeno que ya está protegido, que es peor que no
--     tener consentimiento.
-- Y la persona honesta casi nunca lo paga: la cookie del alta, la
-- sesión de Bookea y presentar el pase en el mostrador verifican
-- gratis, sin gastar un mensaje.
--
-- ── LO QUE ESTA MIGRACIÓN NO ROMPE ───────────────────────────────────
--
-- Los miembros que ya existen conservan su fila, su id, su
-- `cliente_id`, su saldo, su serial y su pase; el backfill les agrega
-- la persona. El insert que hoy hacen `src/lib/wallet/generar.ts:138`
-- y `google.ts:336` —solo `{programa_id, cliente_id, estado}`— SIGUE
-- FUNCIONANDO sin tocar una línea de TypeScript, porque un trigger
-- resuelve la persona. La app móvil no lee ninguna tabla de lealtad
-- (verificado) y ninguna de sus tablas se toca.
--
-- Aditiva e idempotente. Correrla dos veces es seguro.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Normalizadores: UNA sola definición de "el mismo contacto"
--
-- Espejo exacto de `normalizarCorreo` / `normalizarTelefono`
-- (src/lib/crm-citas.ts:81-90). Van en la base y no solo en
-- TypeScript porque los índices únicos, los triggers y los RPC tienen
-- que agrupar IGUAL que el servidor: si la base dijera que
-- "8888-8888" y "+506 8888 8888" son personas distintas, el cruce
-- entre negocios sería mentira desde el primer día.
--
-- `immutable` a propósito: así se pueden usar en checks e índices.
-- ------------------------------------------------------------

-- `crypt()` y `gen_salt()` (sección 13, los códigos de verificación)
-- salen de acá. Viene con la 0001, pero declararlo cuesta nada y evita
-- que esta migración dependa de que otra se haya pegado antes.
create extension if not exists pgcrypto;

create or replace function public.normalizar_correo(p_correo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when position('@' in btrim(lower(coalesce(p_correo, '')))) > 1
     and btrim(lower(coalesce(p_correo, ''))) !~ '\s'
    then btrim(lower(coalesce(p_correo, '')))
    else null
  end;
$$;

-- Últimos 8 dígitos: el formato local varía ("8888-8888",
-- "+506 8888 8888", "506 8888 8888") y el número nacional siempre son
-- 8. Menos de 8 dígitos no es un teléfono, es un dedazo → null.
create or replace function public.normalizar_telefono(p_tel text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g')) >= 8
    then right(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), 8)
    else null
  end;
$$;

create or replace function public.normalizar_canal(p_tipo text, p_valor text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'correo'   then public.normalizar_correo(p_valor)
    when 'whatsapp' then public.normalizar_telefono(p_valor)
    else null
  end;
$$;

grant execute on function public.normalizar_correo(text) to authenticated, service_role;
grant execute on function public.normalizar_telefono(text) to authenticated, service_role;
grant execute on function public.normalizar_canal(text, text) to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. personas — la identidad raíz
--
-- Sin `not null` en ningún identificador por separado, pero con la
-- exigencia de que haya AL MENOS UNO (misma forma que
-- `clientes_negocio_algun_id`, 0109:777). Una fila sin ningún
-- contacto no es una persona: es basura que nadie va a poder volver a
-- encontrar.
--
-- La verificación es una PROPIEDAD del contacto, no una llave: el
-- índice único es estricto (un correo, una persona) para que la
-- deduplicación global —lo que el dueño pidió— sea real. Lo que la
-- verificación decide es quién puede RECLAMAR esa fila.
-- ------------------------------------------------------------

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),

  -- País del teléfono. Hoy todo es 'CR' y la normalización a 8
  -- dígitos es la del plan nacional; la columna existe para que el
  -- día que entre un número de otro país el índice único no lo
  -- confunda con uno tico que termine igual.
  pais text not null default 'CR' check (pais ~ '^[A-Z]{2}$'),

  -- Los dos contactos que pide el QR, ya normalizados por quien
  -- escribe; el check lo hace cumplir para que nadie meta
  -- "  Ana@X.com " por la puerta de atrás y rompa la deduplicación.
  telefono text check (telefono is null or telefono ~ '^[0-9]{8}$'),
  correo text check (
    correo is null
    or (correo = btrim(lower(correo)) and position('@' in correo) > 1 and correo !~ '\s')
  ),

  -- Cuándo y cómo se PROBÓ cada contacto. null = declarado (tecleado).
  correo_verificado_en timestamptz,
  telefono_verificado_en timestamptz,
  metodo_verificacion text check (
    metodo_verificacion is null
    or metodo_verificacion in
       ('otp_correo', 'otp_whatsapp', 'sesion_bookea', 'pase_presentado', 'admin')
  ),

  -- El nombre NO es identidad (dos "María Rodríguez" no son la misma
  -- persona). Es para saludarla en el pase y en el mostrador.
  nombre text check (nombre is null or char_length(btrim(nombre)) between 1 and 120),

  -- ── EL ENRIQUECIMIENTO ────────────────────────────────────────
  -- La cuenta de Bookea, SI la tiene. `on delete set null` y no
  -- `cascade`: si alguien borra su cuenta (0042), la persona y su
  -- historial de lealtad con los negocios NO desaparecen — deja de
  -- tener sesión, nada más.
  cliente_id uuid references auth.users(id) on delete set null,

  -- De dónde salió: 'qr_tarjeta', 'cuenta', 'reserva', 'crm',
  -- 'importacion', 'panel'. Sirve para medir cuánto aporta el póster.
  origen text not null default 'desconocido' check (char_length(origen) between 1 and 40),

  -- Para investigar abuso: veinte altas en diez minutos desde la
  -- misma IP no son veinte clientes.
  ip_alta inet,
  user_agent_alta text check (user_agent_alta is null or char_length(user_agent_alta) <= 400),

  -- La perdedora de una fusión NUNCA se borra: queda apuntando a la
  -- ganadora. Un serial de pase viejo, una cookie de sesión o una
  -- fila de auditoría que todavía la referencian siguen resolviendo a
  -- la persona correcta en vez de romperse.
  fusionada_en uuid references public.personas(id) on delete set null,

  -- Abuso confirmado (bots, farmeo). No se borra: se apaga.
  bloqueada_en timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint personas_algun_identificador check (
    telefono is not null or correo is not null or cliente_id is not null
  ),
  constraint personas_verificacion_coherente check (
    (correo_verificado_en is null and telefono_verificado_en is null)
    or metodo_verificacion is not null
  )
);

-- Por si la tabla ya existía de una corrida anterior a medio camino.
alter table public.personas add column if not exists correo_verificado_en timestamptz;
alter table public.personas add column if not exists telefono_verificado_en timestamptz;
alter table public.personas add column if not exists metodo_verificacion text;
alter table public.personas add column if not exists ip_alta inet;
alter table public.personas add column if not exists user_agent_alta text;
alter table public.personas add column if not exists fusionada_en uuid references public.personas(id) on delete set null;
alter table public.personas add column if not exists bloqueada_en timestamptz;

-- Las tres llaves de deduplicación. Parciales porque en Postgres los
-- NULL no colisionan entre sí: sin el `where`, mil personas sin
-- correo convivirían felices —que es justo lo que se quiere— pero dos
-- con el mismo correo también, que es lo que no se quiere.
create unique index if not exists personas_telefono_idx
  on public.personas (pais, telefono) where telefono is not null;
create unique index if not exists personas_correo_idx
  on public.personas (correo) where correo is not null;
create unique index if not exists personas_cuenta_idx
  on public.personas (cliente_id) where cliente_id is not null;
create index if not exists personas_fusion_idx
  on public.personas (fusionada_en) where fusionada_en is not null;
create index if not exists personas_ip_idx
  on public.personas (ip_alta, created_at desc) where ip_alta is not null;

create or replace function public.personas_tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists personas_updated_at on public.personas;
create trigger personas_updated_at
  before update on public.personas
  for each row execute function public.personas_tocar_updated_at();

alter table public.personas enable row level security;

comment on table public.personas is
  'La identidad raíz de Bookea (0138). La llave son los contactos '
  '(teléfono a 8 dígitos y correo en minúsculas), no la cuenta: '
  '`cliente_id` es un enriquecimiento opcional. El aislamiento por '
  'negocio vive en `personas_negocio`, no acá.';


-- ------------------------------------------------------------
-- 3. personas_negocio — el vínculo, y por lo tanto el permiso
--
-- Contesta las dos preguntas que importan:
--   · "¿qué personas son mías?"      → filas de MI negocio
--   · "¿en cuántos negocios está?"   → filas de esa persona (solo admin)
--
-- Va SEPARADA de `clientes_negocio` (0109) a propósito, aunque las dos
-- hablen de "el cliente de un negocio". `clientes_negocio` son NOTAS
-- del dueño —las escribe y las borra él, y con tipos de negocio como
-- 'consultorio' pueden traer datos de salud—. El vínculo es un hecho
-- de la plataforma y el respaldo del consentimiento: si el dueño borra
-- una ficha, no puede llevarse por delante la prueba de que esa
-- persona aceptó recibirle promociones.
--
-- Cuelga de las DOS raíces que hoy conviven (0134): `cuentas` para
-- Lealtad y `ranchos` para el marketplace. Al menos una.
-- ------------------------------------------------------------

create table if not exists public.personas_negocio (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,

  cuenta_id uuid references public.cuentas(id) on delete cascade,
  rancho_id uuid references public.ranchos(id) on delete cascade,

  origen text not null default 'qr_tarjeta' check (char_length(origen) between 1 and 40),

  -- Cuándo entró y cuándo se le vio por última vez. El segundo lo
  -- refresca el servidor en cada alta/escaneo: sirve para "clientes
  -- dormidos" sin recorrer el ledger.
  primer_contacto timestamptz not null default now(),
  ultimo_contacto timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint personas_negocio_algun_negocio check (
    cuenta_id is not null or rancho_id is not null
  )
);

create unique index if not exists personas_negocio_cuenta_idx
  on public.personas_negocio (persona_id, cuenta_id) where cuenta_id is not null;
create unique index if not exists personas_negocio_rancho_idx
  on public.personas_negocio (persona_id, rancho_id) where rancho_id is not null;
create index if not exists personas_negocio_persona_idx
  on public.personas_negocio (persona_id);
create index if not exists personas_negocio_por_cuenta_idx
  on public.personas_negocio (cuenta_id) where cuenta_id is not null;
create index if not exists personas_negocio_por_rancho_idx
  on public.personas_negocio (rancho_id) where rancho_id is not null;

alter table public.personas_negocio enable row level security;

comment on table public.personas_negocio is
  'El vínculo persona↔negocio (0138). ES el permiso: un negocio ve a '
  'una persona solo si tiene fila acá. Lo escribe únicamente el '
  'servidor — el dueño no puede borrar el respaldo de un consentimiento.';


-- ------------------------------------------------------------
-- 3.bis  miembros.persona_id, ACÁ y no en la sección 9
--
-- La columna se declara antes de tiempo por una razón concreta:
-- `persona_protegida` (sección 4) es `language sql`, y a las funciones
-- SQL Postgres les valida el cuerpo AL CREARLAS —a diferencia de las
-- plpgsql, que no—. Como esa función consulta `miembros.persona_id`,
-- declararla antes de que la columna exista rompe la migración entera
-- con «42703: column m.persona_id does not exist».
--
-- El resto del trabajo sobre `miembros` (el trigger, el backfill, los
-- índices, soltar el not null) sigue en la sección 9, donde se lee
-- junto. Acá va solo la columna, que es lo que las funciones necesitan
-- para poder existir. El `if not exists` hace que la repetición de la
-- sección 9 no moleste.
-- ------------------------------------------------------------

alter table public.miembros
  add column if not exists persona_id uuid references public.personas(id) on delete restrict;


-- ------------------------------------------------------------
-- 4. Los helpers de acceso y de confianza
--
-- Acá hay un ciclo real de RLS y hay que cortarlo con cuidado:
--   · la política de `personas` necesita mirar `personas_negocio`;
--   · la política de `personas_negocio` necesita mirar `personas`.
-- Si las dos consultaran sujetas a RLS, Postgres cortaría por
-- recursión infinita — el mismo problema que documentan `is_admin()`
-- (0008:23) y `es_colaborador_rancho()` (0116:66). Las funciones de
-- abajo son SECURITY DEFINER y SALTAN la RLS, cortando el ciclo.
--
-- Y la regla del repo se mantiene (contra-molde de 0116:143): la
-- función se usa desde las políticas de las OTRAS tablas; dentro de la
-- política de su propia tabla se comparan las columnas a mano.
-- ------------------------------------------------------------

/** La persona vigente después de las fusiones. */
create or replace function public.persona_vigente(p_persona uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actual uuid := p_persona;
  v_siguiente uuid;
  v_saltos int := 0;
begin
  if p_persona is null then return null; end if;
  loop
    select fusionada_en into v_siguiente from personas where id = v_actual;
    exit when v_siguiente is null or v_saltos >= 8;  -- tope anti-ciclo
    v_actual := v_siguiente;
    v_saltos := v_saltos + 1;
  end loop;
  return v_actual;
end;
$$;

/** La persona que corresponde a la sesión actual, si tiene cuenta. */
create or replace function public.mi_persona()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
    from personas p
   where auth.uid() is not null and p.cliente_id = auth.uid()
   limit 1;
$$;

/** ¿Esta persona probó algún canal? Tener cuenta cuenta: para entrar
 *  a Bookea hubo que leer un código en ese buzón. */
create or replace function public.persona_verificada(p_persona uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from personas p
     where p.id = p_persona
       and (p.cliente_id is not null
            or p.correo_verificado_en is not null
            or p.telefono_verificado_en is not null)
  );
$$;

/**
 * ¿Esta persona tiene algo que valga la pena robar?
 *   · cuenta de Bookea, o
 *   · un contacto probado, o
 *   · movimientos en el ledger (sellos que valen un regalo).
 * Si está protegida, nadie la reclama sin prueba de posesión.
 */
create or replace function public.persona_protegida(p_persona uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.persona_verificada(p_persona)
     or exists (
       select 1
         from transacciones_puntos t
         join miembros m on m.id = t.miembro_id
        where m.persona_id = p_persona
        limit 1
     );
$$;

/**
 * ¿Quien llama puede ver a esta persona?
 *   · el admin de plataforma (Bookea ve el cruce);
 *   · ella misma, si abrió cuenta;
 *   · cualquier negocio que TENGA VÍNCULO con ella.
 * Ese último renglón es todo el modelo de permisos: el negocio no ve
 * "las personas", ve "sus personas".
 */
create or replace function public.ve_persona(p_persona uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_persona is not null
     and auth.uid() is not null
     and (
       public.is_admin()
       or exists (
         select 1 from personas p
          where p.id = p_persona and p.cliente_id = auth.uid()
       )
       or exists (
         select 1 from personas_negocio v
          where v.persona_id = p_persona
            and (
              public.gestiona_rancho(v.rancho_id)
              or public.pertenece_a_cuenta(v.cuenta_id)
            )
       )
     );
$$;

revoke all on function public.persona_vigente(uuid) from public, anon;
revoke all on function public.mi_persona() from public, anon;
revoke all on function public.persona_verificada(uuid) from public, anon;
revoke all on function public.persona_protegida(uuid) from public, anon;
revoke all on function public.ve_persona(uuid) from public, anon;
grant execute on function public.persona_vigente(uuid) to authenticated, service_role;
grant execute on function public.mi_persona() to authenticated, service_role;
grant execute on function public.persona_verificada(uuid) to authenticated, service_role;
grant execute on function public.persona_protegida(uuid) to authenticated, service_role;
grant execute on function public.ve_persona(uuid) to authenticated, service_role;


-- ------------------------------------------------------------
-- 5. RLS de personas y del vínculo
--
-- ESCRITURA: ninguna política, para nadie. La RLS niega por defecto,
-- o sea que `personas` y `personas_negocio` solo se escriben con la
-- service key o por los RPC `security definer` de más abajo. Es
-- deliberado: si el navegador pudiera escribir directo, cualquiera
-- podría reclamar el correo de otra persona y heredarle los pases.
-- ------------------------------------------------------------

drop policy if exists "Cada quien ve a las personas que le tocan" on public.personas;
create policy "Cada quien ve a las personas que le tocan" on public.personas
  for select to authenticated
  using (public.ve_persona(id));

grant select on public.personas to authenticated;
grant all on public.personas to service_role;

-- Acá SÍ se comparan las columnas a mano: llamar a `ve_persona` desde
-- la política de `personas_negocio` sería entrar a `personas_negocio`
-- desde su propia política.
drop policy if exists "El negocio ve sus vínculos" on public.personas_negocio;
create policy "El negocio ve sus vínculos" on public.personas_negocio
  for select to authenticated
  using (
    public.is_admin()
    or public.gestiona_rancho(rancho_id)
    or public.pertenece_a_cuenta(cuenta_id)
    or persona_id = public.mi_persona()
  );

grant select on public.personas_negocio to authenticated;
grant all on public.personas_negocio to service_role;


-- ------------------------------------------------------------
-- 6. Consentimientos POR PERSONA, separados por ámbito y por canal
--
-- Ledger, nunca un flag mutable — mismo criterio que `consentimientos`
-- (0082) y que el ledger de puntos (0060). El estado vigente es la
-- ÚLTIMA fila de cada (persona, ámbito, negocio, canal).
--
-- SEPARADOS DE VERDAD:
--   ambito='negocio' → "quiero promos de ESTA barbería"
--   ambito='bookea'  → "quiero novedades de Bookea"
-- Dos casillas distintas en la pantalla, dos filas distintas acá. Que
-- el negocio te mande promos no le da a Bookea permiso de escribirte,
-- ni al revés; y darse de baja de un negocio no te saca de la
-- plataforma.
--
-- POR CANAL: WhatsApp, correo y SMS se aceptan por separado. En Costa
-- Rica el WhatsApp es el canal caro (una queja cuesta el número) y el
-- correo el barato; meterlos en la misma casilla obliga a tratar a los
-- dos con la regla del más estricto.
--
-- LA PRUEBA: fecha, IP, user-agent y EL TEXTO EXACTO que la persona
-- vio y aceptó, no un identificador de versión que mañana apunte a
-- otro texto. Eso es lo que la Ley 8968 pide poder demostrar, y es
-- imposible de reconstruir después de cambiar el copy de la página.
--
-- SOBRE LA IP: la 0113 estableció que las IP se guardan como HMAC y
-- nunca en claro. Esa regla es para RATE LIMITING, donde solo hace
-- falta comparar. Acá la IP es PRUEBA: un HMAC no le sirve a nadie
-- ante un reclamo. Por eso va en claro, pero la columna NO se le
-- concede a `authenticated` (ver el grant por columna): el negocio ve
-- que la persona aceptó, cuándo y qué texto; la IP la ve el servidor.
-- ------------------------------------------------------------

create table if not exists public.consentimientos_persona (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,

  ambito text not null check (ambito in ('bookea', 'negocio')),
  cuenta_id uuid references public.cuentas(id) on delete cascade,
  rancho_id uuid references public.ranchos(id) on delete cascade,

  canal text not null check (canal in ('whatsapp', 'correo', 'sms')),
  estado text not null check (estado in ('aceptado', 'revocado')),

  -- Foto del dato sobre el que se dio el permiso.
  correo text,
  telefono text,

  -- Versión del texto (para agrupar) Y el texto literal (para probar).
  texto_version text not null check (char_length(texto_version) between 1 and 40),
  texto_exacto text not null check (char_length(texto_exacto) between 10 and 4000),

  -- Por dónde entró: 'qr_tarjeta', 'link_baja', 'panel', 'mostrador',
  -- 'admin', 'importacion'.
  origen text not null check (char_length(origen) between 1 and 40),

  ip inet,
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),

  created_at timestamptz not null default now(),

  -- Un consentimiento de plataforma no puede tener negocio, y uno de
  -- negocio no puede no tenerlo. Sin este check, una fila ambigua haría
  -- que la misma persona apareciera aceptando y no aceptando a la vez.
  constraint consentimientos_persona_ambito_coherente check (
    (ambito = 'bookea' and cuenta_id is null and rancho_id is null)
    or (ambito = 'negocio' and (cuenta_id is not null or rancho_id is not null))
  )
);

-- El vigente se busca de lo más nuevo a lo más viejo. El id desempata:
-- dos filas del mismo milisegundo (un alta y una baja a la vez) tienen
-- que ordenar igual siempre, o SQL y el servidor elegirían ganadores
-- distintos (misma razón que 0082:71).
create index if not exists consentimientos_persona_vigente_idx
  on public.consentimientos_persona
     (persona_id, ambito, canal, cuenta_id, rancho_id, created_at desc, id desc);
create index if not exists consentimientos_persona_cuenta_idx
  on public.consentimientos_persona (cuenta_id) where cuenta_id is not null;
create index if not exists consentimientos_persona_rancho_idx
  on public.consentimientos_persona (rancho_id) where rancho_id is not null;

alter table public.consentimientos_persona enable row level security;

drop policy if exists "Cada quien lee los consentimientos que le tocan"
  on public.consentimientos_persona;
create policy "Cada quien lee los consentimientos que le tocan"
  on public.consentimientos_persona
  for select to authenticated
  using (
    public.is_admin()
    or (ambito = 'negocio'
        and (public.gestiona_rancho(rancho_id) or public.pertenece_a_cuenta(cuenta_id)))
    or persona_id = public.mi_persona()
  );

-- GRANT POR COLUMNA (mismo mecanismo que 0127:76 con `rol`): se
-- conceden todas MENOS `ip` y `user_agent`. La RLS filtra filas, no
-- columnas; esto filtra columnas. No se da el grant de tabla completo,
-- porque un grant amplio le ganaría al de columnas.
grant select (
  id, persona_id, ambito, cuenta_id, rancho_id, canal, estado,
  correo, telefono, texto_version, texto_exacto, origen, created_at
) on public.consentimientos_persona to authenticated;
grant all on public.consentimientos_persona to service_role;

/**
 * ¿Se le puede escribir a esta persona por este canal, para este
 * negocio? Una sola función, para que la web, la app y los jobs
 * respondan siempre igual (mismo criterio que `acepta_marketing`, 0082).
 *
 * Precedencia, de más fuerte a más débil:
 *   correo suprimido (rebote/queja)     → NO
 *   última fila de plataforma revocada  → NO   (se bajó de todo)
 *   última fila del negocio revocada    → NO
 *   última fila del negocio aceptada    → SÍ
 *   sin filas                           → NO
 *
 * OJO: el default es NO, al revés que `acepta_marketing` (0082), que
 * asume interés legítimo porque toda dirección vieja llegó por una
 * reserva. Acá no aplica: esta gente entró por un QR donde la casilla
 * se le mostró explícitamente. Si no la marcó, no la marcó.
 */
create or replace function public.persona_acepta(
  p_persona uuid,
  p_canal text,
  p_cuenta uuid default null,
  p_rancho uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_correo text;
  v_estado text;
begin
  if p_persona is null or p_canal is null then
    return false;
  end if;

  -- Rebotes duros y quejas de spam (0082): insistirle a un buzón que
  -- rebota quema la reputación del dominio entero.
  if p_canal = 'correo' then
    select pe.correo into v_correo from personas pe where pe.id = p_persona;
    if v_correo is not null
       and exists (select 1 from supresiones_correo s where s.correo = v_correo) then
      return false;
    end if;
  end if;

  -- Plataforma: si se bajó de todo, se bajó de todo.
  select c.estado into v_estado
    from consentimientos_persona c
   where c.persona_id = p_persona and c.ambito = 'bookea' and c.canal = p_canal
   order by c.created_at desc, c.id desc
   limit 1;
  if v_estado = 'revocado' then
    return false;
  end if;

  -- Sin negocio, la pregunta era por la plataforma.
  if p_cuenta is null and p_rancho is null then
    return coalesce(v_estado = 'aceptado', false);
  end if;

  select c.estado into v_estado
    from consentimientos_persona c
   where c.persona_id = p_persona
     and c.ambito = 'negocio'
     and c.canal = p_canal
     and (
       (p_cuenta is not null and c.cuenta_id = p_cuenta)
       or (p_rancho is not null and c.rancho_id = p_rancho)
     )
   order by c.created_at desc, c.id desc
   limit 1;

  return coalesce(v_estado = 'aceptado', false);
end;
$$;

revoke all on function public.persona_acepta(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.persona_acepta(uuid, text, uuid, uuid)
  to authenticated, service_role;


-- ------------------------------------------------------------
-- 7. Duplicados detectados — la deuda que NO se esconde
--
-- Caso real e inevitable: la señora escanea y deja solo el teléfono.
-- Tres meses después deja el correo en otro negocio. Los dos datos,
-- por separado, ya crearon dos filas. Cuando el resolver descubre que
-- un contacto nuevo pertenece a OTRA persona, no fusiona solo —una
-- casa con un teléfono compartido no es una sola persona—: deja el par
-- anotado acá para que un humano lo resuelva.
--
-- Anotarlo es exactamente lo que evita el escenario que se quiere
-- evitar: datos irreconciliables descubiertos seis meses tarde.
-- ------------------------------------------------------------

create table if not exists public.personas_duplicados (
  id uuid primary key default gen_random_uuid(),
  persona_a uuid not null references public.personas(id) on delete cascade,
  persona_b uuid not null references public.personas(id) on delete cascade,
  motivo text not null check (motivo in ('correo_de_otra', 'telefono_de_otro', 'manual')),
  resuelto boolean not null default false,
  created_at timestamptz not null default now(),
  constraint personas_duplicados_distintas check (persona_a <> persona_b)
);

-- `least/greatest` para que (A,B) y (B,A) sean el MISMO par pendiente.
create unique index if not exists personas_duplicados_par_idx
  on public.personas_duplicados (least(persona_a, persona_b), greatest(persona_a, persona_b))
  where not resuelto;

alter table public.personas_duplicados enable row level security;

-- Solo el admin: un par de duplicados es información de CRUCE entre
-- negocios, justo lo que ningún negocio debe ver.
drop policy if exists "Solo el admin ve los duplicados" on public.personas_duplicados;
create policy "Solo el admin ve los duplicados" on public.personas_duplicados
  for select to authenticated
  using (public.is_admin());

grant select on public.personas_duplicados to authenticated;
grant all on public.personas_duplicados to service_role;


-- ------------------------------------------------------------
-- 8. resolver_persona — el corazón de todo
--
-- "Dame la persona que tiene estos contactos; si no existe, creála."
-- Es la ÚNICA puerta de creación de identidad, y por eso la usan el
-- alta del QR, los triggers de `miembros` y `clientes_negocio`, y el
-- backfill de esta misma migración: si mañana cambia el criterio, se
-- cambia en un solo lugar.
--
-- Orden de búsqueda = orden de confianza de `claveCliente`
-- (src/lib/crm-citas.ts): cuenta → correo → teléfono.
--
-- ENRIQUECE PERO NO PISA: si la persona encontrada ya tiene un correo
-- distinto, ese correo NO se toca. Sobrescribir el contacto de alguien
-- con el dato de un formulario público es exactamente cómo se
-- secuestra una identidad.
-- ------------------------------------------------------------

create or replace function public.resolver_persona(
  p_cliente_id uuid default null,
  p_correo text default null,
  p_telefono text default null,
  p_nombre text default null,
  p_origen text default 'desconocido',
  p_pais text default 'CR',
  p_ip inet default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correo text := public.normalizar_correo(p_correo);
  v_tel    text := public.normalizar_telefono(p_telefono);
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
  v_id     uuid;
  v_otra   uuid;
  v_choque uuid;
  v_cuenta uuid;
  v_fila   personas%rowtype;
begin
  -- Si viene una cuenta y no vinieron contactos, se sacan de ella. Así
  -- el trigger de `miembros` funciona con solo el `cliente_id` que hoy
  -- manda `generar.ts`, sin cambiar una línea de TypeScript.
  if p_cliente_id is not null and (v_correo is null or v_tel is null or v_nombre is null) then
    select coalesce(v_correo, public.normalizar_correo(u.email)),
           coalesce(v_tel, public.normalizar_telefono(u.raw_user_meta_data->>'whatsapp')),
           coalesce(v_nombre,
                    nullif(btrim(coalesce(pf.nombre, u.raw_user_meta_data->>'nombre', '')), ''))
      into v_correo, v_tel, v_nombre
      from auth.users u
      left join perfiles pf on pf.id = u.id
     where u.id = p_cliente_id;
  end if;

  if p_cliente_id is null and v_correo is null and v_tel is null then
    raise exception 'Hace falta al menos un contacto (correo o teléfono) o una cuenta'
      using errcode = '22023';
  end if;

  -- 1) Por cuenta (identidad fuerte).
  if p_cliente_id is not null then
    select id into v_id from personas where cliente_id = p_cliente_id;
  end if;

  -- 2) Por correo.
  if v_id is null and v_correo is not null then
    select id into v_id from personas where correo = v_correo;
  end if;

  -- 3) Por teléfono.
  if v_id is null and v_tel is not null then
    select id into v_id from personas where pais = p_pais and telefono = v_tel;
  end if;

  -- Si la encontrada fue absorbida por una fusión, se sigue a la viva.
  if v_id is not null then
    v_id := public.persona_vigente(v_id);
  end if;

  -- 3.bis) DOS CUENTAS NO SON UNA PERSONA. Si la fila encontrada por
  -- contacto ya pertenece a OTRA cuenta de Bookea, no se reutiliza:
  -- una casa con un solo teléfono, o una pareja que comparte correo,
  -- son dos cuentas distintas y tienen que seguir siéndolo. Se anota
  -- el par como posible duplicado y se le hace fila propia.
  --
  -- Sin esta rama, el backfill fundiría a dos socios de un mismo
  -- programa en una sola persona y el índice único nuevo
  -- (programa_id, persona_id) no se podría ni crear.
  if v_id is not null and p_cliente_id is not null then
    select cliente_id into v_cuenta from personas where id = v_id;
    if v_cuenta is not null and v_cuenta <> p_cliente_id then
      v_choque := v_id;
      v_id := null;
      if v_correo is not null
         and exists (select 1 from personas where id = v_choque and correo = v_correo) then
        v_correo := null;
      end if;
      if v_tel is not null
         and exists (select 1 from personas where id = v_choque and telefono = v_tel) then
        v_tel := null;
      end if;
    end if;
  end if;

  -- 4) No existe: se crea. El `on conflict do nothing` cubre la
  --    carrera de dos escaneos simultáneos del mismo QR; si perdió la
  --    carrera, se vuelve a buscar y se sigue por la rama de enriquecer.
  if v_id is null then
    insert into personas (pais, telefono, correo, nombre, cliente_id, origen,
                          ip_alta, user_agent_alta)
    values (p_pais, v_tel, v_correo, v_nombre, p_cliente_id,
            coalesce(p_origen, 'desconocido'), p_ip, left(p_user_agent, 400))
    on conflict do nothing
    returning id into v_id;

    if v_id is not null then
      if v_choque is not null then
        insert into personas_duplicados (persona_a, persona_b, motivo)
        values (v_id, v_choque,
                case when v_correo is null then 'correo_de_otra' else 'telefono_de_otro' end)
        on conflict do nothing;
      end if;
      return v_id;
    end if;

    if v_correo is not null then
      select id into v_id from personas where correo = v_correo;
    end if;
    if v_id is null and v_tel is not null then
      select id into v_id from personas where pais = p_pais and telefono = v_tel;
    end if;
    if v_id is null and p_cliente_id is not null then
      select id into v_id from personas where cliente_id = p_cliente_id;
    end if;
    if v_id is null then
      raise exception 'No se pudo resolver la persona' using errcode = '40001';
    end if;
    v_id := public.persona_vigente(v_id);
  end if;

  -- 5) Enriquecer los huecos, sin pisar nada que ya esté puesto.
  select * into v_fila from personas where id = v_id;

  if v_correo is not null and v_fila.correo is null then
    select id into v_otra from personas where correo = v_correo and id <> v_id;
    if v_otra is null then
      update personas set correo = v_correo where id = v_id;
    else
      -- El correo ya es de otra fila: mismo humano en dos filas, o dos
      -- humanos. No se decide acá.
      insert into personas_duplicados (persona_a, persona_b, motivo)
      values (v_id, v_otra, 'correo_de_otra')
      on conflict do nothing;
    end if;
  end if;

  if v_tel is not null and v_fila.telefono is null then
    select id into v_otra from personas
     where pais = p_pais and telefono = v_tel and id <> v_id;
    if v_otra is null then
      update personas set telefono = v_tel, pais = p_pais where id = v_id;
    else
      insert into personas_duplicados (persona_a, persona_b, motivo)
      values (v_id, v_otra, 'telefono_de_otro')
      on conflict do nothing;
    end if;
  end if;

  if p_cliente_id is not null and v_fila.cliente_id is null then
    select id into v_otra from personas where cliente_id = p_cliente_id and id <> v_id;
    if v_otra is null then
      -- El momento en que la persona del QR "asciende" a cuenta de
      -- Bookea: la misma fila, ahora con sesión. Sus pases y su saldo
      -- ya estaban ahí. Y su correo queda PROBADO: para entrar a
      -- Bookea hubo que leer un código de 6 dígitos en ese buzón.
      update personas
         set cliente_id = p_cliente_id,
             correo_verificado_en = coalesce(correo_verificado_en, now()),
             metodo_verificacion = coalesce(metodo_verificacion, 'sesion_bookea')
       where id = v_id;
    end if;
  end if;

  if v_nombre is not null and v_fila.nombre is null then
    update personas set nombre = v_nombre where id = v_id;
  end if;

  return v_id;
end;
$$;

-- Solo el servidor. NO se le concede a `anon` a propósito: un RPC de
-- creación de identidad abierto al navegador es a la vez un oráculo de
-- enumeración de correos y un generador infinito de filas. El alta
-- pública entra por una server action con `createAdminClient()`, que
-- es donde ya viven Turnstile y el rate limiting.
revoke all on function public.resolver_persona(uuid, text, text, text, text, text, inet, text)
  from public, anon, authenticated;
grant execute on function public.resolver_persona(uuid, text, text, text, text, text, inet, text)
  to service_role;


-- ------------------------------------------------------------
-- 9. miembros: la persona pasa a ser la llave; la cuenta, opcional
-- ------------------------------------------------------------

alter table public.miembros
  add column if not exists persona_id uuid references public.personas(id) on delete restrict;

-- `on delete restrict` y no `cascade`: borrar una persona con
-- membresías vivas tiene que doler. Si de verdad hay que borrarla, se
-- fusiona primero o se borran sus membresías a mano, con intención.

-- El trigger que hace que NADA del código actual se rompa: los inserts
-- de `generar.ts:138` y `google.ts:336` siguen mandando solo
-- `{programa_id, cliente_id, estado}` y la persona se resuelve sola.
create or replace function public.miembros_resolver_persona()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.persona_id is null then
    if new.cliente_id is null then
      raise exception 'Un miembro necesita persona_id o cliente_id' using errcode = '23502';
    end if;
    new.persona_id := public.resolver_persona(
      p_cliente_id => new.cliente_id,
      p_origen => 'lealtad'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists miembros_persona on public.miembros;
create trigger miembros_persona
  before insert or update on public.miembros
  for each row execute function public.miembros_resolver_persona();

-- ── Backfill ────────────────────────────────────────────────────────
-- Se resuelve cliente por cliente y no con un INSERT masivo porque el
-- resolver ya sabe enlazar con personas que existan por correo o por
-- teléfono, detectar duplicados y no pisar datos. Un INSERT ... SELECT
-- tendría que reimplementar las tres cosas y se desviaría del criterio.
do $$
declare
  r record;
begin
  for r in
    select distinct cliente_id
      from public.miembros
     where persona_id is null and cliente_id is not null
  loop
    update public.miembros
       set persona_id = public.resolver_persona(p_cliente_id => r.cliente_id,
                                                p_origen => 'cuenta')
     where cliente_id = r.cliente_id and persona_id is null;
  end loop;
end;
$$;

-- La llave nueva. Antes hay que soltar la vieja: con `cliente_id`
-- nullable, `unique (programa_id, cliente_id)` deja de proteger nada
-- (en Postgres los NULL no colisionan) y mil altas anónimas del mismo
-- programa entrarían todas.
--
-- Se borra por NOMBRE y, por si en algún entorno quedó con otro,
-- también por FORMA: cualquier constraint unique de `miembros` sobre
-- exactamente (programa_id, cliente_id). Adivinar el nombre y fallar en
-- silencio es justo el tipo de diferencia que hace que producción no se
-- parezca a lo que uno probó.
alter table public.miembros drop constraint if exists miembros_programa_id_cliente_id_key;

do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'miembros' and con.contype = 'u'
       and (select array_agg(att.attname::text order by att.attname::text)
              from unnest(con.conkey) k
              join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k)
           = array['cliente_id', 'programa_id']
  loop
    execute format('alter table public.miembros drop constraint %I', c.conname);
  end loop;
end;
$$;

create unique index if not exists miembros_programa_persona_idx
  on public.miembros (programa_id, persona_id);

-- Se conserva la unicidad por cuenta como red de seguridad para los
-- miembros que sí tienen sesión.
create unique index if not exists miembros_programa_cuenta_idx
  on public.miembros (programa_id, cliente_id) where cliente_id is not null;

create index if not exists miembros_persona_idx on public.miembros (persona_id);

-- Ahora sí: la cuenta deja de ser obligatoria.
alter table public.miembros alter column cliente_id drop not null;

-- Y deja de ser una guillotina. Hoy `on delete cascade` significa que
-- borrar la cuenta (0042) se lleva membresía → ledger → canjes → pases.
-- Para alguien que se afilió por QR y abrió cuenta DESPUÉS, eso le
-- borraría al negocio el historial de un cliente que sigue siendo su
-- cliente. La persona sobrevive a la cuenta.
alter table public.miembros drop constraint if exists miembros_cliente_id_fkey;
alter table public.miembros
  add constraint miembros_cliente_id_fkey
  foreign key (cliente_id) references auth.users(id) on delete set null;

-- `not null` solo si el backfill dejó todo lleno. Guardado para que la
-- migración no explote en un entorno con datos raros: mejor que quede
-- nullable y se revise, a que no se pueda correr.
--
-- OJO: si sale el aviso, hay que correr a mano
--   select count(*) from miembros where persona_id is null;   -- debe dar 0
-- y volver a pegar la migración. Un NOTICE se pierde entre el ruido
-- del SQL Editor.
do $$
begin
  if not exists (select 1 from public.miembros where persona_id is null) then
    alter table public.miembros alter column persona_id set not null;
  else
    raise notice 'AVISO 0138: quedan miembros sin persona_id; la columna sigue nullable.';
  end if;
end;
$$;

comment on column public.miembros.persona_id is
  'La identidad del miembro (0138). `cliente_id` bajó a costura '
  'opcional con la cuenta de Bookea, para quien además tenga una.';


-- ------------------------------------------------------------
-- 10. RLS de lealtad: reparar las ramas que el NULL mata
--
-- Cuatro políticas dicen `cliente_id = auth.uid()`. Con `cliente_id`
-- nullable eso devuelve NULL —nunca true— y la rama del cliente muere.
-- En `pases_wallet` es peor: esa rama es la ÚNICA que tiene, así que la
-- política entera se apaga y nadie puede leer su propio pase.
--
-- Se DEJA la rama vieja en las cuatro: es redundante con la de persona,
-- pero sigue funcionando aunque el backfill de una fila haya quedado a
-- medias — una política que degrada a "no ves nada" es un modo de falla
-- silencioso.
-- ------------------------------------------------------------

drop policy if exists "Cada quien ve su membresía" on public.miembros;
create policy "Cada quien ve su membresía" on public.miembros
  for select to authenticated
  using (
    cliente_id = auth.uid()
    or persona_id = public.mi_persona()
    or exists (
      select 1 from public.programa_lealtad p
      join public.ranchos r on r.id = p.rancho_id
      where p.id = programa_id and (r.owner_id = auth.uid() or public.is_admin())
    )
  );

-- El insert desde el navegador sigue exigiendo que sea uno mismo, y
-- ahora además que la persona sea la suya: sin esa condición, un
-- cliente logueado podía insertarse un miembro apuntando a la persona
-- de OTRO y heredarle el historial. El alta anónima NO pasa por acá —
-- pasa por el servidor con service key.
drop policy if exists "El cliente se afilia a sí mismo" on public.miembros;
create policy "El cliente se afilia a sí mismo" on public.miembros
  for insert to authenticated
  with check (
    cliente_id = auth.uid()
    and (persona_id is null or persona_id = public.mi_persona())
    and exists (select 1 from public.programa_lealtad p where p.id = programa_id and p.activo)
  );

drop policy if exists "Cada quien ve su pase" on public.pases_wallet;
create policy "Cada quien ve su pase" on public.pases_wallet
  for select to authenticated
  using (
    exists (
      select 1 from public.miembros m
      where m.id = miembro_id
        and (m.cliente_id = auth.uid() or m.persona_id = public.mi_persona())
    )
  );

drop policy if exists "Cada quien lee sus puntos" on public.transacciones_puntos;
create policy "Cada quien lee sus puntos" on public.transacciones_puntos
  for select to authenticated
  using (
    exists (
      select 1 from public.miembros m
      where m.id = miembro_id
        and (
          m.cliente_id = auth.uid()
          or m.persona_id = public.mi_persona()
          or exists (
            select 1 from public.programa_lealtad p
            join public.ranchos r on r.id = p.rancho_id
            where p.id = m.programa_id and (r.owner_id = auth.uid() or public.is_admin())
          )
        )
    )
  );

drop policy if exists "Cada quien lee sus canjes" on public.canjes;
create policy "Cada quien lee sus canjes" on public.canjes
  for select to authenticated
  using (
    exists (
      select 1 from public.miembros m
      where m.id = miembro_id
        and (
          m.cliente_id = auth.uid()
          or m.persona_id = public.mi_persona()
          or exists (
            select 1 from public.programa_lealtad p
            join public.ranchos r on r.id = p.rancho_id
            where p.id = m.programa_id and (r.owner_id = auth.uid() or public.is_admin())
          )
        )
    )
  );


-- ------------------------------------------------------------
-- 11. El pase tiene que seguir vivo: pases_wallet
--
-- El serial de un pase ya está impreso en el iPhone de alguien y no se
-- puede cambiar (`generar.ts:169`). Cuando dos personas resulten ser la
-- misma y haya que fusionar sus miembros, el pase perdedor NO se borra
-- —el teléfono se quedaría con una tarjeta congelada para siempre y en
-- silencio— sino que se REAPUNTA al miembro ganador con `activo=false`:
-- el Web Service de Apple (`servicio.ts`) sigue autenticando ese serial
-- y le devuelve el saldo YA FUSIONADO.
--
-- `objeto_externo` existe por Google: el id del objeto se deriva HOY de
-- `miembros.id` (`google.ts:117`), así que después de una fusión el
-- objeto viejo queda sin dueño y la tarjeta se congela en el teléfono.
-- Guardando el id con el que se creó, el refresco puede seguir
-- parchando el objeto real aunque el miembro haya cambiado.
-- ------------------------------------------------------------

alter table public.pases_wallet add column if not exists activo boolean not null default true;
alter table public.pases_wallet add column if not exists objeto_externo text;

alter table public.pases_wallet drop constraint if exists pases_wallet_miembro_id_plataforma_key;

do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'pases_wallet' and con.contype = 'u'
       and (select array_agg(att.attname::text order by att.attname::text)
              from unnest(con.conkey) k
              join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k)
           = array['miembro_id', 'plataforma']
  loop
    execute format('alter table public.pases_wallet drop constraint %I', c.conname);
  end loop;
end;
$$;

create unique index if not exists pases_wallet_vigente_idx
  on public.pases_wallet (miembro_id, plataforma) where activo;

comment on column public.pases_wallet.activo is
  'false = pase heredado de una fusión de personas (0138). Sigue '
  'autenticando y actualizándose; ya no es el pase que se emite nuevo. '
  'Quien busque "el pase de este miembro" debe filtrar activo = true.';
comment on column public.pases_wallet.objeto_externo is
  'El id del objeto en el proveedor (Google), tal como se creó. Después '
  'de una fusión el id derivado de miembro_id ya no sirve para parchar.';


-- ------------------------------------------------------------
-- 12. clientes_negocio se cuelga de la persona
--
-- La ficha sigue siendo del negocio y sigue siendo privada: sus NOTAS
-- no viajan a `personas` y nunca deben. Lo único que sube al nivel
-- global es el IDENTIFICADOR: correo, teléfono, cuenta. Así una ficha
-- que el dueño escribe a mano también alimenta el cruce, sin que ningún
-- otro negocio vea una letra de sus notas.
--
-- Y es la tabla por la que el negocio VE a su gente: ya tiene la RLS
-- correcta desde la 0109 y hoy no la usa nadie (cero lecturas en src/ y
-- mobile/), así que enlazarla ahora sale gratis.
-- ------------------------------------------------------------

-- ── clientes_negocio ES OPCIONAL ────────────────────────────────
-- La tabla nace en la 0109 y puede no estar pegada. Todo lo de esta
-- sección es un ENLACE de conveniencia: la ficha de CRM también
-- alimenta el cruce global. Nada del alta por QR depende de ella —
-- el negocio ve a su gente por `personas_negocio`, que sí se crea acá.
--
-- Por eso no se aborta: se salta con un aviso. Hacer que una
-- migración de identidad muera por una tabla de notas sería poner la
-- parte accesoria a mandar sobre la esencial.
do $s12$
begin
  if to_regclass('public.clientes_negocio') is null then
    raise notice '0138: clientes_negocio no existe (falta la 0109). Se omite el enlace del CRM; todo lo demás queda igual.';
    return;
  end if;

  execute 'alter table public.clientes_negocio add column if not exists persona_id uuid references public.personas(id) on delete set null';
  execute 'alter table public.clientes_negocio add column if not exists origen text not null default ''crm''';
  execute 'alter table public.clientes_negocio drop constraint if exists clientes_negocio_origen_check';
  execute 'alter table public.clientes_negocio add constraint clientes_negocio_origen_check check (origen in (''crm'', ''qr_tarjeta'', ''lealtad'', ''reserva'', ''importacion''))';
  execute 'create index if not exists clientes_negocio_persona_idx on public.clientes_negocio (persona_id) where persona_id is not null';
  execute 'create unique index if not exists clientes_negocio_persona_unica_idx on public.clientes_negocio (rancho_id, persona_id) where persona_id is not null';
end;
$s12$;

create or replace function public.clientes_negocio_resolver_persona()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.persona_id is null
     and (new.cliente_id is not null or new.correo is not null or new.telefono is not null) then
    new.persona_id := public.resolver_persona(
      p_cliente_id => new.cliente_id,
      p_correo     => new.correo,
      p_telefono   => new.telefono,
      p_nombre     => new.nombre,
      p_origen     => 'crm'
    );
  end if;
  return new;
end;
$$;

do $s12b$
begin
  if to_regclass('public.clientes_negocio') is null then return; end if;
  execute 'drop trigger if exists clientes_negocio_persona on public.clientes_negocio';
  execute 'create trigger clientes_negocio_persona before insert or update on public.clientes_negocio for each row execute function public.clientes_negocio_resolver_persona()';
end;
$s12b$;

-- ── EL BACKFILL TIENE QUE RESPETAR EL ÚNICO QUE ACABA DE NACER ─────
-- Veinte líneas más arriba se creó `clientes_negocio_persona_unica_idx`
-- —único por (rancho_id, persona_id)— con la columna todavía VACÍA. Es
-- este bucle el que la llena, y por eso es este bucle el que lo puede
-- violar.
--
-- Y lo viola, porque la 0109 permite A PROPÓSITO dos fichas del mismo
-- rancho para el mismo humano: sus únicos son por columna SEPARADA
-- (rancho_id+cliente_id, rancho_id+correo, rancho_id+telefono). Una
-- ficha nacida de una reserva con sesión —solo `cliente_id`— y otra
-- tecleada a mano con el correo de esa misma cuenta conviven
-- tranquilas. `resolver_persona` las une, correctamente, en UNA sola
-- persona… y ahí las dos filas chocan.
--
-- Hoy no dispara porque `clientes_negocio` no existe y la sección se
-- salta entera. Dispara con certeza el día que se pegue la 0109, que
-- es exactamente el peor momento: cuando nadie se acuerda de esto.
--
-- El `not exists` es el mismo patrón que `fusionar_personas` ya usa
-- para sus vínculos. La ficha que queda sin enlazar no se pierde: se
-- queda con `persona_id` nulo, visible, para resolverla a mano.
do $$
declare
  r record;
  v_persona uuid;
begin
  if to_regclass('public.clientes_negocio') is null then return; end if;
  for r in select id, rancho_id, cliente_id, correo, telefono, nombre
             from public.clientes_negocio where persona_id is null
  loop
    v_persona := public.resolver_persona(
      p_cliente_id => r.cliente_id,
      p_correo     => r.correo,
      p_telefono   => r.telefono,
      p_nombre     => r.nombre,
      p_origen     => 'crm');

    if not exists (
      select 1 from public.clientes_negocio g
       where g.rancho_id = r.rancho_id and g.persona_id = v_persona
    ) then
      update public.clientes_negocio set persona_id = v_persona where id = r.id;
    end if;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 13. La prueba de posesión: OTP, pase presentado y cuenta
--
-- `verificaciones_canal` guarda el HASH y nunca el código — mismo
-- argumento que el PIN de la 0137: un código en claro es un código que
-- alguien lee en un backup.
--
-- La tabla NO TIENE NINGUNA POLÍTICA RLS, igual que
-- `registros_dispositivo` (0060:355). Es deliberado: con RLS activa y
-- cero políticas, Postgres niega por defecto y solo entra la llave de
-- servicio. Si alguien pudiera leer el hash —o peor, el contador de
-- intentos— la verificación deja de verificar.
-- ------------------------------------------------------------

create table if not exists public.verificaciones_canal (
  id uuid primary key default gen_random_uuid(),

  tipo text not null check (tipo in ('whatsapp', 'correo')),
  valor_norm text not null,

  -- A qué persona se le acredita el canal si el código entra.
  persona_id uuid references public.personas(id) on delete cascade,

  codigo_hash text not null,

  -- Seis dígitos aguantan poco: sin tope de intentos, adivinar es
  -- cuestión de minutos.
  intentos int not null default 0,
  expira_en timestamptz not null,
  consumido_en timestamptz,

  ip inet,
  created_at timestamptz not null default now()
);

create index if not exists verificaciones_valor_idx
  on public.verificaciones_canal (valor_norm, created_at desc);
create index if not exists verificaciones_ip_idx
  on public.verificaciones_canal (ip, created_at desc) where ip is not null;

alter table public.verificaciones_canal enable row level security;
revoke all on public.verificaciones_canal from anon, authenticated;
grant all on public.verificaciones_canal to service_role;

-- Freno de tasa. Sin esto, mandar mil mensajes a costa nuestra es
-- gratis, y adivinar seis dígitos es cuestión de paciencia.
create or replace function public.puede_pedir_codigo(
  p_tipo text,
  p_valor text,
  p_ip inet default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from verificaciones_canal v
      where v.valor_norm = public.normalizar_canal(p_tipo, p_valor)
        and v.created_at > now() - interval '1 hour') < 5
    and (
      p_ip is null
      or (select count(*) from verificaciones_canal v
           where v.ip = p_ip and v.created_at > now() - interval '1 hour') < 20
    );
$$;

create or replace function public.registrar_codigo(
  p_tipo text,
  p_valor text,
  p_persona uuid,
  p_codigo text,
  p_ip inet default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := public.normalizar_canal(p_tipo, p_valor);
  v_id uuid;
begin
  if v_norm is null then
    raise exception 'Canal inválido' using errcode = '22023';
  end if;
  if not public.puede_pedir_codigo(p_tipo, p_valor, p_ip) then
    raise exception 'Demasiados códigos pedidos, esperá un rato'
      using errcode = '22023', hint = 'tasa_excedida';
  end if;

  -- Los códigos anteriores del mismo canal se queman: dos códigos
  -- vivos a la vez duplican las chances de adivinar.
  update verificaciones_canal
     set consumido_en = now()
   where valor_norm = v_norm and consumido_en is null and expira_en > now();

  insert into verificaciones_canal (tipo, valor_norm, persona_id, codigo_hash, expira_en, ip)
  values (p_tipo, v_norm, p_persona, crypt(p_codigo, gen_salt('bf', 8)),
          now() + interval '10 minutes', p_ip)
  returning id into v_id;

  return v_id;
end;
$$;

/**
 * Verifica el código y devuelve la persona dueña del canal. Acá es
 * donde una identidad declarada se convierte en identidad probada.
 *
 * Como el índice único de `personas` es estricto (un correo, una
 * persona), no hay dos filas peleando por el mismo contacto: la que
 * lo tiene es la que se marca. Si el contacto no estaba en ninguna
 * persona, se lo queda la que pidió el código.
 */
create or replace function public.verificar_codigo(p_id uuid, p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v verificaciones_canal%rowtype;
  v_persona uuid;
  v_duena uuid;
begin
  select * into v from verificaciones_canal where id = p_id for update;

  if v.id is null then
    raise exception 'Código no encontrado' using errcode = '22023';
  end if;
  if v.consumido_en is not null or v.expira_en <= now() then
    raise exception 'El código venció' using errcode = '22023', hint = 'codigo_vencido';
  end if;
  if v.intentos >= 5 then
    raise exception 'Demasiados intentos' using errcode = '22023', hint = 'intentos_agotados';
  end if;

  if crypt(p_codigo, v.codigo_hash) <> v.codigo_hash then
    update verificaciones_canal set intentos = intentos + 1 where id = v.id;
    raise exception 'Código incorrecto' using errcode = '22023', hint = 'codigo_incorrecto';
  end if;

  update verificaciones_canal set consumido_en = now() where id = v.id;

  -- ¿Quién tiene hoy ese contacto? Esa es la dueña legítima.
  if v.tipo = 'correo' then
    select id into v_duena from personas where correo = v.valor_norm;
  else
    select id into v_duena from personas where telefono = v.valor_norm;
  end if;

  v_persona := coalesce(public.persona_vigente(v_duena),
                        public.persona_vigente(v.persona_id));

  if v_persona is null then
    v_persona := public.resolver_persona(
      p_correo   => case when v.tipo = 'correo' then v.valor_norm else null end,
      p_telefono => case when v.tipo = 'whatsapp' then v.valor_norm else null end,
      p_origen   => 'qr_tarjeta');
  end if;

  if v.tipo = 'correo' then
    update personas
       set correo_verificado_en = coalesce(correo_verificado_en, now()),
           metodo_verificacion = coalesce(metodo_verificacion, 'otp_correo')
     where id = v_persona;
  else
    update personas
       set telefono_verificado_en = coalesce(telefono_verificado_en, now()),
           metodo_verificacion = coalesce(metodo_verificacion, 'otp_whatsapp')
     where id = v_persona;
  end if;

  return v_persona;
end;
$$;

/**
 * Verificación GRATIS: la persona volvió al mostrador con el pase en
 * el teléfono y el empleado escaneó el código. Tener el pase es prueba
 * de posesión — el serial y su auth_token nunca salieron de ese
 * teléfono. Es el camino por el que se verifica sola la mayoría de la
 * gente honesta, sin gastar un solo mensaje.
 *
 * LÍMITE HONESTO: prueba posesión DEL PASE, no del número tecleado. Si
 * alguien se afilió con el WhatsApp del vecino y se aparece en persona,
 * se lo queda. Cierra el farmeo (hay que presentarse físicamente por
 * cada identidad falsa, y eso no escala) pero no al vecino motivado.
 */
create or replace function public.verificar_por_pase(p_miembro uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona uuid;
begin
  select public.persona_vigente(persona_id) into v_persona from miembros where id = p_miembro;
  if v_persona is null then return null; end if;

  update personas
     set telefono_verificado_en = case
           when telefono is not null then coalesce(telefono_verificado_en, now())
           else telefono_verificado_en end,
         correo_verificado_en = case
           when telefono is null and correo is not null
             then coalesce(correo_verificado_en, now())
           else correo_verificado_en end,
         metodo_verificacion = coalesce(metodo_verificacion, 'pase_presentado')
   where id = v_persona
     and correo_verificado_en is null
     and telefono_verificado_en is null;

  return v_persona;
end;
$$;

/**
 * Engancha una cuenta recién creada con la persona que ya existía.
 * Entrar a Bookea exige leer un código en ese buzón
 * (formulario-codigo-acceso.tsx:180), así que el correo queda probado.
 * Corre como trigger sobre auth.users para que también funcione desde
 * la app móvil, sin una línea de código de cliente.
 */
create or replace function public.enlazar_cuenta_a_persona(p_usuario uuid, p_correo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona uuid;
begin
  if p_usuario is null then return null; end if;

  select id into v_persona from personas where cliente_id = p_usuario;
  if v_persona is not null then return v_persona; end if;

  v_persona := public.resolver_persona(
    p_cliente_id => p_usuario,
    p_correo     => p_correo,
    p_origen     => 'cuenta');

  -- Los miembros que esa persona ya tenía sin cuenta ganan la costura.
  update miembros set cliente_id = p_usuario
   where persona_id = v_persona and cliente_id is null;

  return v_persona;
end;
$$;

create or replace function public.persona_por_cuenta_nueva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enlazar_cuenta_a_persona(new.id, new.email);
  return new;
exception when others then
  -- Un fallo acá NO puede impedir que alguien cree su cuenta.
  return new;
end;
$$;

-- Trigger SEPARADO del `on_auth_user_created` (0008:64): no se toca el
-- que ya funciona.
drop trigger if exists on_auth_user_persona on auth.users;
create trigger on_auth_user_persona
  after insert on auth.users
  for each row execute function public.persona_por_cuenta_nueva();

revoke all on function public.puede_pedir_codigo(text, text, inet) from public, anon, authenticated;
revoke all on function public.registrar_codigo(text, text, uuid, text, inet) from public, anon, authenticated;
revoke all on function public.verificar_codigo(uuid, text) from public, anon, authenticated;
revoke all on function public.verificar_por_pase(uuid) from public, anon, authenticated;
revoke all on function public.enlazar_cuenta_a_persona(uuid, text) from public, anon, authenticated;
grant execute on function public.puede_pedir_codigo(text, text, inet) to service_role;
grant execute on function public.registrar_codigo(text, text, uuid, text, inet) to service_role;
grant execute on function public.verificar_codigo(uuid, text) to service_role;
grant execute on function public.verificar_por_pase(uuid) to service_role;
grant execute on function public.enlazar_cuenta_a_persona(uuid, text) to service_role;

-- Los que ya tienen cuenta nacen verificados: su correo se probó con
-- el código de 6 dígitos del login.
update public.personas
   set correo_verificado_en = coalesce(correo_verificado_en, now()),
       metodo_verificacion = coalesce(metodo_verificacion, 'sesion_bookea')
 where cliente_id is not null and correo is not null and correo_verificado_en is null;


-- ------------------------------------------------------------
-- 14. sesiones_persona — volver sin login y sin OTP
--
-- Sin esto, la persona sin cuenta no puede volver a ver su tarjeta ni
-- su saldo desde el navegador, y la única salida sería pedirle un
-- código cada vez: justo lo que mata la conversión que se está
-- cuidando. Es también la prueba barata de "soy la misma que hizo el
-- alta" cuando vuelve a escanear el QR.
--
-- Es un secreto de CONVENIENCIA, no de autoridad: da LECTURA de lo
-- suyo y sirve como prueba de posesión del navegador. Canjear nunca
-- depende de esta cookie.
-- ------------------------------------------------------------

create table if not exists public.sesiones_persona (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,

  -- sha256 del token que va en la cookie httpOnly. El token nunca se
  -- guarda, por lo mismo de siempre.
  token_hash text not null unique,

  created_at timestamptz not null default now(),
  ultimo_uso timestamptz,
  expira_en timestamptz not null default now() + interval '180 days',
  revocada_en timestamptz,

  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  ip inet
);

create index if not exists sesiones_persona_persona_idx
  on public.sesiones_persona (persona_id);

alter table public.sesiones_persona enable row level security;
revoke all on public.sesiones_persona from anon, authenticated;
grant all on public.sesiones_persona to service_role;

/** La persona de una cookie, ya vigente tras fusiones. Refresca el uso. */
create or replace function public.persona_de_sesion(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona uuid;
begin
  select persona_id into v_persona
    from sesiones_persona
   where token_hash = p_token_hash
     and revocada_en is null
     and expira_en > now();

  if v_persona is null then return null; end if;

  update sesiones_persona set ultimo_uso = now() where token_hash = p_token_hash;
  return public.persona_vigente(v_persona);
end;
$$;

revoke all on function public.persona_de_sesion(text) from public, anon, authenticated;
grant execute on function public.persona_de_sesion(text) to service_role;


-- ------------------------------------------------------------
-- 15. fusionar_personas — sin perder puntos ni pases
-- ------------------------------------------------------------

create or replace function public.fusionar_personas(p_ganadora uuid, p_perdedora uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  v_ganador uuid;
  v_perdedora personas%rowtype;
  v_ganadora personas%rowtype;
begin
  if p_ganadora is null or p_perdedora is null or p_ganadora = p_perdedora then
    raise exception 'Fusión inválida' using errcode = '22023';
  end if;

  select * into v_ganadora from personas where id = p_ganadora;
  select * into v_perdedora from personas where id = p_perdedora;
  if v_ganadora.id is null or v_perdedora.id is null then
    raise exception 'Alguna de las personas no existe' using errcode = '23503';
  end if;

  -- Contactos: la ganadora se queda con los huecos que la perdedora
  -- pueda llenar. Se vacían PRIMERO en la perdedora para no chocar con
  -- los índices únicos.
  if v_ganadora.correo is null and v_perdedora.correo is not null then
    update personas set correo = null where id = p_perdedora;
    update personas set correo = v_perdedora.correo,
                        correo_verificado_en = v_perdedora.correo_verificado_en
     where id = p_ganadora;
  end if;
  if v_ganadora.telefono is null and v_perdedora.telefono is not null then
    update personas set telefono = null where id = p_perdedora;
    update personas set telefono = v_perdedora.telefono,
                        pais = v_perdedora.pais,
                        telefono_verificado_en = v_perdedora.telefono_verificado_en
     where id = p_ganadora;
  end if;
  if v_ganadora.cliente_id is null and v_perdedora.cliente_id is not null then
    update personas set cliente_id = null where id = p_perdedora;
    update personas set cliente_id = v_perdedora.cliente_id where id = p_ganadora;
  end if;
  if v_ganadora.nombre is null and v_perdedora.nombre is not null then
    update personas set nombre = v_perdedora.nombre where id = p_ganadora;
  end if;
  update personas
     set metodo_verificacion = coalesce(metodo_verificacion, v_perdedora.metodo_verificacion)
   where id = p_ganadora;

  -- Membresías. Dos casos: en los programas donde la ganadora no está,
  -- basta reapuntar; donde ya está, hay que mudar el ledger.
  for m in
    select mp.id as perdedor_id, mp.programa_id
      from miembros mp
     where mp.persona_id = p_perdedora
  loop
    select mg.id into v_ganador
      from miembros mg
     where mg.persona_id = p_ganadora and mg.programa_id = m.programa_id;

    if v_ganador is null then
      update miembros set persona_id = p_ganadora where id = m.perdedor_id;
    else
      -- El saldo es la SUMA del ledger (`motor.ts:31`), así que mudar
      -- las filas fusiona los saldos sin inventar un ajuste.
      update transacciones_puntos set miembro_id = v_ganador where miembro_id = m.perdedor_id;
      update canjes set miembro_id = v_ganador where miembro_id = m.perdedor_id;
      -- `intentos_canje` nace en la 0137, que puede no estar pegada.
      -- El cuerpo de una funcion plpgsql NO se valida al crearla: sin
      -- esta guarda la migracion entra sin quejarse y la fusion
      -- revienta la primera vez que se use, con la mitad del trabajo
      -- hecho. `to_regclass` da null si la tabla no existe.
      if to_regclass('public.intentos_canje') is not null then
        execute 'update public.intentos_canje set miembro_id = $1 where miembro_id = $2'
          using v_ganador, m.perdedor_id;
      end if;

      -- Los pases del perdedor sobreviven, apagados: el teléfono que
      -- los tiene sigue recibiendo actualizaciones, ahora del miembro
      -- ganador. Para Google hace falta que `objeto_externo` esté
      -- guardado, o ese pase se congela (ver sección 11).
      update pases_wallet
         set miembro_id = v_ganador, activo = false, actualizado_en = now()
       where miembro_id = m.perdedor_id;

      delete from miembros where id = m.perdedor_id;
    end if;
    v_ganador := null;
  end loop;

  -- Vínculos duplicados: se descartan los del lado perdedor.
  delete from personas_negocio v
   where v.persona_id = p_perdedora
     and exists (
       select 1 from personas_negocio g
        where g.persona_id = p_ganadora
          and g.cuenta_id is not distinct from v.cuenta_id
          and g.rancho_id is not distinct from v.rancho_id
     );
  update personas_negocio set persona_id = p_ganadora where persona_id = p_perdedora;

  -- Los consentimientos NO se deduplican: son un ledger y la prueba
  -- vale por la fila entera (fecha, IP, texto). Se mudan todos.
  update consentimientos_persona set persona_id = p_ganadora where persona_id = p_perdedora;
  update sesiones_persona set persona_id = p_ganadora where persona_id = p_perdedora;
  update verificaciones_canal set persona_id = p_ganadora where persona_id = p_perdedora;

  -- La ficha del CRM (0109) puede no existir. En plpgsql el SQL
  -- estático se analiza al ejecutarse la rama, no al crear la función:
  -- con la guarda delante, si la tabla no está la sentencia nunca se
  -- analiza y la fusión termina igual de bien.
  if to_regclass('public.clientes_negocio') is not null then
    update clientes_negocio c set persona_id = p_ganadora
     where c.persona_id = p_perdedora
       and not exists (
         select 1 from clientes_negocio g
          where g.persona_id = p_ganadora and g.rancho_id = c.rancho_id
       );
  end if;

  update personas_duplicados
     set resuelto = true
   where persona_a = p_perdedora or persona_b = p_perdedora;

  -- La perdedora NO se borra: queda apuntando a la ganadora, para que
  -- una cookie vieja, un serial o una fila de auditoría sigan
  -- resolviendo a la persona correcta en vez de romperse.
  update personas
     set fusionada_en = p_ganadora, updated_at = now()
   where id = p_perdedora;

  return p_ganadora;
end;
$$;

revoke all on function public.fusionar_personas(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fusionar_personas(uuid, uuid) to service_role;


-- ------------------------------------------------------------
-- 16. El alta por QR, completa y en una sola transacción
--
-- Persona + vínculo + ficha + consentimientos, todo o nada. Si se
-- hiciera en cuatro llamadas desde el servidor, un fallo en la segunda
-- dejaría una persona sin negocio o un vínculo sin prueba de
-- consentimiento — y eso último es exactamente lo que no se puede
-- permitir tener en la base.
--
-- EL PORTERO: si la persona resuelta está PROTEGIDA (cuenta, contacto
-- probado, o sellos en el ledger) y quien pide no trae prueba, no se
-- escribe NADA y se devuelve `requiere_prueba`. Recuperar una tarjeta
-- con valor —o firmar un permiso a nombre de un contacto ajeno— exige
-- probar posesión. Las pruebas gratis: la cookie del alta, la sesión
-- de Bookea y el pase presentado en el mostrador.
--
-- El VÍNCULO se crea acepte o no acepte promociones: es la base
-- contractual del pase que se está llevando, no marketing. El
-- consentimiento decide si además se le puede escribir.
--
-- p_consentimientos es jsonb y no diez parámetros sueltos a propósito:
-- con `texto_negocio` y `texto_bookea` seguidos y del mismo tipo, una
-- llamada con los argumentos corridos guarda la prueba equivocada y
-- nadie se entera.
--   {
--     "version": "qr-v1",
--     "canales": ["whatsapp","correo"],
--     "negocio": { "acepta": true,  "texto": "..." },
--     "bookea":  { "acepta": false, "texto": "..." }
--   }
-- ------------------------------------------------------------

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

  -- ── EL PORTERO ────────────────────────────────────────────────
  -- Se mira ANTES de escribir una sola fila. Si el contacto ya
  -- pertenece a alguien protegido y no hay prueba, se corta acá.
  if p_cliente_id is null and v_probada is null then
    select public.persona_vigente(id) into v_persona
      from personas
     where (v_correo is not null and correo = v_correo)
        or (v_tel is not null and telefono = v_tel)
     limit 1;

    if v_persona is not null and public.persona_protegida(v_persona) then
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

revoke all on function public.alta_persona_por_qr(uuid, text, text, text, jsonb, uuid, uuid, inet, text)
  from public, anon, authenticated;
grant execute on function public.alta_persona_por_qr(uuid, text, text, text, jsonb, uuid, uuid, inet, text)
  to service_role;


-- ------------------------------------------------------------
-- 17. La perilla del canje y el freno al farmeo
--
-- Veinte números inventados = veinte pases. Sin freno, también veinte
-- regalos de bienvenida (0132). El trigger va en la BASE y no en la
-- pantalla por lo mismo que la 0137 puso la idempotencia en un índice:
-- la pantalla se puede saltar, el motor no.
--
-- DEFAULT EN false, a propósito y contra la tentación: encenderlo
-- antes de que el escáner llame a `verificar_por_pase` haría fallar el
-- canje de un cliente real, en el mostrador, delante del dueño. Se
-- enciende en cuanto esa línea esté puesta (ver la checklist).
-- ------------------------------------------------------------

alter table public.programa_lealtad
  add column if not exists exige_verificacion_para_canjear boolean not null default false;

comment on column public.programa_lealtad.exige_verificacion_para_canjear is
  'true = no se canjea sin haber probado un canal (0138). Encender solo '
  'después de que el mostrador llame a verificar_por_pase() al acreditar.';

create or replace function public.canjes_exigir_verificacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_persona uuid;
  v_cliente uuid;
  v_exige boolean;
begin
  select m.persona_id, m.cliente_id,
         coalesce(pl.exige_verificacion_para_canjear, false)
    into v_persona, v_cliente, v_exige
    from miembros m
    join programa_lealtad pl on pl.id = m.programa_id
   where m.id = new.miembro_id;

  if not coalesce(v_exige, false) then return new; end if;
  if v_cliente is not null then return new; end if;
  if v_persona is null then return new; end if;
  if public.persona_verificada(v_persona) then return new; end if;

  raise exception 'Falta confirmar el WhatsApp o el correo antes de canjear'
    using errcode = '22023', hint = 'verificacion_pendiente';
end;
$$;

drop trigger if exists canjes_exigir_verificacion_trg on public.canjes;
create trigger canjes_exigir_verificacion_trg
  before insert on public.canjes
  for each row execute function public.canjes_exigir_verificacion();


-- ------------------------------------------------------------
-- 18. El tope del plan cuenta PERSONAS, no filas
--
-- `src/lib/lealtad/planes.ts:104` ya promete que "varias tarjetas de la
-- misma persona = UN cliente", y hoy se cumple por accidente, porque
-- `unique (programa_id, cliente_id)` garantizaba una fila por persona.
-- Con altas anónimas eso deja de ser cierto, y `generar.ts:126` HACE
-- CUMPLIR el tope: dos filas de la misma señora le cerrarían el
-- programa a un negocio que no está lleno.
--
-- OJO: filtra `estado = 'activa'`, que es lo que planes.ts promete por
-- escrito pero NO lo que el código cuenta hoy. Un negocio con miembros
-- pausados o cancelados va a ver un número MENOR que ayer: hay que
-- avisarlo antes de pegar esto, no después.
-- ------------------------------------------------------------

create or replace function public.personas_activas_del_programa(p_programa uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(distinct m.persona_id), 0)::integer
    from miembros m
   where m.programa_id = p_programa
     and m.estado = 'activa';
$$;

revoke all on function public.personas_activas_del_programa(uuid) from public, anon;
grant execute on function public.personas_activas_del_programa(uuid)
  to authenticated, service_role;


-- ------------------------------------------------------------
-- 19. El cruce, que es lo que se pidió
--
-- `security_invoker = true` a propósito: la vista NO abre una puerta
-- nueva, hereda la RLS de quien la consulta. El admin ve el cruce
-- completo; un dueño ve únicamente sus filas — o sea, la misma vista le
-- sirve al negocio para su lista de clientes y a Bookea para el mapa
-- entre negocios, sin dos consultas distintas ni una función
-- privilegiada de por medio.
-- ------------------------------------------------------------

create or replace view public.vista_personas_negocio
with (security_invoker = true) as
select
  v.persona_id,
  v.cuenta_id,
  v.rancho_id,
  v.origen,
  v.primer_contacto,
  v.ultimo_contacto,
  p.nombre,
  p.correo,
  p.telefono,
  p.cliente_id is not null as tiene_cuenta,
  (p.correo_verificado_en is not null or p.telefono_verificado_en is not null
   or p.cliente_id is not null) as verificada,
  public.persona_acepta(v.persona_id, 'whatsapp', v.cuenta_id, v.rancho_id) as acepta_whatsapp,
  public.persona_acepta(v.persona_id, 'correo',   v.cuenta_id, v.rancho_id) as acepta_correo,
  public.persona_acepta(v.persona_id, 'sms',      v.cuenta_id, v.rancho_id) as acepta_sms
from public.personas_negocio v
join public.personas p on p.id = v.persona_id
where p.fusionada_en is null;

grant select on public.vista_personas_negocio to authenticated;

comment on view public.vista_personas_negocio is
  'La lista de personas de un negocio, y para el admin el cruce entre '
  'negocios (0138). security_invoker: la RLS de personas_negocio y '
  'personas decide qué filas se ven.';


notify pgrst, 'reload schema';
