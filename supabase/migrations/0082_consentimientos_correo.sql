-- ============================================================
-- BOOKEA — Consentimiento de correo y supresiones (0082)
-- Fase 1 del plan de AUDITORIA.md (hallazgo C-2)
--
-- Antes de que exista UNA sola campaña de marketing, la plataforma
-- necesita poder responder tres preguntas por correo:
--
--   1. ¿Esta persona aceptó (o revocó) recibir promociones?
--      → `consentimientos`: un LEDGER de eventos, igual que el de
--        lealtad (0060) — nunca un flag mutable. El estado vigente es
--        la ÚLTIMA fila de cada (correo, negocio). Queda registrado
--        cuándo, por qué vía y con qué detalle: eso es lo que la Ley
--        8968 pide poder demostrar.
--
--   2. ¿A este correo se le puede escribir siquiera?
--      → `supresiones_correo`: rebotes duros y quejas de spam que
--        reporta Resend (webhook /api/correo/webhook). Un correo
--        suprimido NO recibe más envíos masivos, punto — insistirle a
--        un buzón que rebota quema la reputación del dominio entero.
--
--   3. ¿Puedo mandarle ESTA campaña?
--      → `acepta_marketing(correo, negocio)`: una sola función con la
--        precedencia completa, para que web, app y jobs respondan
--        siempre igual.
--
-- ÁMBITOS: rancho_id null = la plataforma entera (campañas del admin,
-- novedades); rancho_id puesto = solo ese negocio (las campañas por
-- negocio de la Fase 4). Revocar la plataforma apaga todo; revocar un
-- negocio apaga solo ese negocio.
--
-- DEFAULT (decisión de producto, documentada acá para poder cambiarla
-- en UN lugar): sin filas, un correo SÍ acepta marketing — interés
-- legítimo por la relación comercial previa (toda dirección en la
-- base llegó por una reserva o una cuenta), con baja de UN clic en
-- cada correo. Para pasar a doble opt-in estricto, se cambia el
-- `return true` final por `false` y listo.
--
-- SEGURIDAD: ambas tablas las escribe SOLO el servidor (service key;
-- sin políticas de escritura, la RLS niega por defecto). El cliente
-- jamás escribe su consentimiento directo — pasa por la página /baja
-- (token firmado) o por una acción de servidor. El dueño de un
-- negocio puede LEER los consentimientos de su negocio (los necesita
-- para el conteo de segmentos de la Fase 4); las supresiones son solo
-- del admin.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El ledger de consentimientos
-- ------------------------------------------------------------
create table if not exists consentimientos (
  id uuid primary key default gen_random_uuid(),
  -- Siempre en minúsculas y sin espacios (lo normaliza quien escribe,
  -- y el check lo hace cumplir).
  correo text not null check (correo = lower(trim(correo)) and position('@' in correo) > 1),
  -- La cuenta, si la persona tenía sesión al momento del evento.
  cliente_id uuid references auth.users(id) on delete set null,
  -- null = ámbito plataforma; puesto = solo ese negocio.
  rancho_id uuid references ranchos(id) on delete cascade,
  estado text not null check (estado in ('aceptado', 'revocado')),
  -- Por qué vía: 'link_baja' (el link del correo), 'reserva' (checkbox
  -- al reservar, futuro), 'panel', 'admin', 'importacion'.
  origen text not null check (char_length(origen) between 1 and 40),
  detalle text check (detalle is null or char_length(detalle) <= 400),
  created_at timestamptz not null default now()
);

-- El estado vigente se busca por correo+ámbito, de lo más nuevo a lo
-- más viejo. El id desempata: dos filas del mismo milisegundo (una
-- baja y un alta a la vez) tienen que ordenar igual siempre, o SQL y
-- el servidor podrían elegir ganadores distintos.
create index if not exists consentimientos_vigente_idx
  on consentimientos (correo, rancho_id, created_at desc, id desc);

-- El cascade de ranchos y las consultas del dueño (Fase 4).
create index if not exists consentimientos_rancho_idx
  on consentimientos (rancho_id) where rancho_id is not null;

alter table consentimientos enable row level security;

-- El admin ve todo; el dueño ve lo de su negocio (Fase 4: el conteo
-- "M aceptan promociones" de sus segmentos). Nadie más lee, nadie
-- escribe desde el navegador.
drop policy if exists "Admin y dueño leen consentimientos" on consentimientos;
create policy "Admin y dueño leen consentimientos" on consentimientos
  for select to authenticated
  using (
    is_admin()
    or (rancho_id is not null
        and rancho_id in (select id from ranchos where owner_id = auth.uid()))
  );

grant select on consentimientos to authenticated;
grant all on consentimientos to service_role;

-- ------------------------------------------------------------
-- 2. Supresiones: rebotes duros y quejas de spam
-- ------------------------------------------------------------
create table if not exists supresiones_correo (
  correo text primary key check (correo = lower(trim(correo))),
  motivo text not null check (motivo in ('rebote', 'queja', 'manual')),
  detalle text check (detalle is null or char_length(detalle) <= 400),
  created_at timestamptz not null default now()
);

alter table supresiones_correo enable row level security;

-- Solo el admin las ve (contienen direcciones de terceros); escribe
-- solo el servidor (el webhook de Resend).
drop policy if exists "Solo el admin ve las supresiones" on supresiones_correo;
create policy "Solo el admin ve las supresiones" on supresiones_correo
  for select to authenticated
  using (is_admin());

grant select on supresiones_correo to authenticated;
grant all on supresiones_correo to service_role;

-- ------------------------------------------------------------
-- 3. ¿Se le puede mandar marketing a este correo (para este negocio)?
--
-- Precedencia, de más fuerte a más débil:
--   suprimido                      → NO (rebota o se quejó)
--   última fila plataforma = revocado → NO (se bajó de todo)
--   última fila del negocio = revocado → NO (se bajó de ese negocio)
--   cualquier otra combinación     → SÍ (el default documentado arriba)
-- ------------------------------------------------------------
create or replace function public.acepta_marketing(
  p_correo text,
  p_rancho_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_estado text;
begin
  if v_correo = '' or position('@' in v_correo) <= 1 then
    return false;
  end if;

  if exists (select 1 from supresiones_correo s where s.correo = v_correo) then
    return false;
  end if;

  -- El estado vigente de plataforma (la última fila con rancho null).
  select c.estado into v_estado
  from consentimientos c
  where c.correo = v_correo and c.rancho_id is null
  order by c.created_at desc, c.id desc
  limit 1;
  if v_estado = 'revocado' then
    return false;
  end if;

  -- Y el del negocio, si la campaña es de un negocio.
  if p_rancho_id is not null then
    select c.estado into v_estado
    from consentimientos c
    where c.correo = v_correo and c.rancho_id = p_rancho_id
    order by c.created_at desc, c.id desc
    limit 1;
    if v_estado = 'revocado' then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- SOLO el servidor. Sin el revoke, Postgres deja EXECUTE a PUBLIC por
-- defecto y la función se vuelve un oráculo: cualquiera con sesión
-- podría preguntar por el correo de un tercero y saber si rebotó o se
-- dio de baja — un dato de esa persona, no de quien pregunta. Los
-- conteos del panel (Fase 4) pasan por el servidor, que ya usa la
-- service key.
revoke execute on function public.acepta_marketing(text, uuid) from public, anon, authenticated;
grant execute on function public.acepta_marketing(text, uuid) to service_role;

notify pgrst, 'reload schema';
