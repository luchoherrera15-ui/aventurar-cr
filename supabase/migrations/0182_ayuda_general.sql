
-- ============================================================
-- BOOKEA — «Hablá con Bookea»: soporte general, visitante ↔ admin (0182)
--
-- La puerta que hoy NO existe: cualquiera en bookea.lat —tenga cuenta,
-- negocio, o ninguna de las dos cosas— necesita poder escribirle a la
-- administración y ver la respuesta sin salir de la página.
--
-- ------------------------------------------------------------
-- POR QUÉ NO ES `ayuda_diseno` (0149) GENERALIZADA
-- ------------------------------------------------------------
-- `ayuda_diseno` está construida, hasta el fondo, para "el dueño de UN
-- negocio le escribe a Bookea sobre SU tarjeta": rancho_id not null,
-- repetido en cada fila para que la RLS resuelva sin join contra
-- `gestiona_rancho()`, y autor_id not null references auth.users
-- porque `verificarAccesoRancho` exige sesión real siempre. Acá no hay
-- necesariamente un negocio, y no siempre hay sesión. Volver esas dos
-- columnas nullable no "generaliza" la tabla: le cambia el eje de
-- identidad por debajo (de "gestiona este rancho" a "es el autor"), le
-- rompe el índice único (varios visitantes sin negocio comparten NULL
-- y Postgres no los distingue en un índice único), y le mete columnas
-- (contexto de diseño, programa_id) que no significan nada acá. Es la
-- misma deformación que 0149 ya describió y rechazó para no tocar
-- `conversaciones` — mismo criterio, tabla nueva.
--
-- ------------------------------------------------------------
-- UNA SOLA TABLA, CADA FILA ES UN MENSAJE (mismo patrón que 0149)
-- ------------------------------------------------------------
-- `hilo_id is null`  → ES el pedido: trae nombre/contacto/token_hash.
-- `hilo_id = <id>`   → es una respuesta: solo texto y quién la escribió.
--
-- `visitante_clave` va repetida en CADA fila (cabeza y respuestas) —
-- 'u:<uuid>' si quien abrió el hilo tiene sesión real, 'a:<sha256 del
-- token>' si no la tiene. Repetirla es lo que deja resolver el SELECT
-- de un visitante logueado con una comparación directa, sin join ni
-- función security definer.
--
-- `de_bookea` reemplaza a "comparar autor_id con mi id" (que es lo que
-- hace hilo-chat.tsx): un visitante SIN sesión no tiene "mi id" con qué
-- comparar. Se guarda explícito en vez de inferirse, así que además no
-- puede desincronizarse del contenido real como sí puede pasarle a
-- `ayuda_diseno.estado = 'atendida'` (que se marca a mano y puede
-- discrepar de si en verdad ya hay una respuesta).
--
-- SIN sesión de Supabase anónima en NINGÚN punto de este archivo. La
-- identidad de quien no tiene cuenta es nombre+contacto, explícitos y
-- obligatorios — nunca inferidos de una fila de auth.users que no sabe
-- quién es. (Lección ya pagada una vez: una sesión anónima confundida
-- con una persona conocida dejó gente afiliada sin nombre ni
-- consentimiento en el alta de lealtad. No se repite acá.)
--
-- Aditiva e idempotente: no toca ninguna tabla que ya exista.
-- ============================================================

create table if not exists public.mensajes_ayuda_general (
  id uuid primary key default gen_random_uuid(),

  -- null = esta fila ES el pedido; con valor = es una respuesta.
  hilo_id uuid references public.mensajes_ayuda_general(id) on delete cascade,

  -- Repetida en cada fila. 'u:<auth.uid()>' con sesión real,
  -- 'a:<sha256 del token de la cookie>' sin sesión. Nunca null: es la
  -- llave del índice de "un hilo abierto por visitante" de más abajo,
  -- y un índice único con NULL no sirve para eso (Postgres trata cada
  -- NULL como distinto de los demás).
  visitante_clave text not null,

  -- Quien escribió, SI tiene fila real en auth.users: el visitante
  -- logueado, o el admin que contestó. NULL cuando quien escribió no
  -- tiene sesión — nunca se rellena con una sesión anónima fingiendo
  -- ser una identidad.
  autor_id uuid references auth.users(id) on delete set null,

  -- true = lo escribió alguien de Bookea (admin). Explícito, no
  -- inferido — ver nota de cabecera.
  de_bookea boolean not null default false,

  texto text not null check (char_length(trim(texto)) between 1 and 2000),

  -- Solo tienen sentido en la CABEZA del hilo (hilo_id is null):
  nombre text,
  contacto text,
  -- SHA-256 hex del token de la cookie. NUNCA el token en claro —
  -- mismo criterio que `media_capacidades.token_hash` (0113). NULL si
  -- la cabeza la abrió alguien con sesión real (no hace falta cookie).
  token_hash text check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),

  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),

  created_at timestamptz not null default now(),

  -- Una RESPUESTA es solo texto y autoría: sin esto, cerrar/reabrir
  -- desde una respuesta podría dejar dos filas con historias distintas
  -- sobre el mismo hilo (mismo espíritu que `ayuda_diseno_respuesta_simple`).
  constraint mensajes_ayuda_general_cabeza check (
    (hilo_id is null and nombre is not null and contacto is not null)
    or
    (hilo_id is not null and nombre is null and contacto is null and token_hash is null)
  ),
  constraint mensajes_ayuda_general_no_se_apunta check (hilo_id is null or hilo_id <> id)
);

comment on table public.mensajes_ayuda_general is
  'Hilo de soporte general visitante ↔ Bookea. hilo_id null = el pedido; con valor = una respuesta. Sin sesión de Supabase anónima: la identidad de quien no tiene cuenta es nombre+contacto explícitos.';

create index if not exists mensajes_ayuda_general_hilo_idx
  on public.mensajes_ayuda_general (hilo_id, created_at);

create index if not exists mensajes_ayuda_general_clave_idx
  on public.mensajes_ayuda_general (visitante_clave, created_at desc);

-- UN hilo abierto por visitante — el pedido explícito del dueño ("un
-- hilo por visitante"), calcado del mismo índice de 0149.
create unique index if not exists mensajes_ayuda_general_abierta_unq
  on public.mensajes_ayuda_general (visitante_clave)
  where hilo_id is null and estado = 'abierta';

-- Un token no puede pertenecer a dos cabezas (por más que la
-- probabilidad de colisión del generador sea nula, la integridad se
-- declara, no se asume).
create unique index if not exists mensajes_ayuda_general_token_unq
  on public.mensajes_ayuda_general (token_hash)
  where token_hash is not null;

alter table public.mensajes_ayuda_general enable row level security;

-- ------------------------------------------------------------
-- La clave del hilo al que cuelga una respuesta, sin recursión de RLS
--
-- NO va en `public`: PostgREST solo expone como RPC los esquemas de la
-- lista "Exposed schemas" del proyecto, y esa lista es opt-in a mano —
-- un esquema nuevo nace invisible. Si esta función viviera en `public`
-- con EXECUTE para `authenticated` (que hace falta para que la RLS de
-- abajo la pueda llamar), CUALQUIER usuario logueado podría pedirla
-- directo por `POST /rest/v1/rpc/mensaje_ayuda_clave` y sacarle la
-- identidad real (uuid de cuenta, o hash del token anónimo) de un hilo
-- ajeno, saltándose por completo la política de SELECT de más abajo.
-- `ayuda_diseno_rancho` (0149) tiene esta misma forma en `public` — no
-- se toca acá, es otro trabajo, y ese hilo expone un id de NEGOCIO, no
-- de una persona real.
-- ------------------------------------------------------------
create schema if not exists bookea_interno;

create or replace function bookea_interno.mensaje_ayuda_clave(p_hilo uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.visitante_clave
    from public.mensajes_ayuda_general m
   where m.id = p_hilo
     and m.hilo_id is null
$$;

revoke all on function bookea_interno.mensaje_ayuda_clave(uuid) from public, anon;
grant usage on schema bookea_interno to authenticated, service_role;
grant execute on function bookea_interno.mensaje_ayuda_clave(uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- SELECT: el visitante CON sesión ve su propio hilo; Bookea los ve
-- todos. El visitante SIN sesión no tiene política — lee por la
-- server action con la llave de servicio, verificando el token a mano.
-- ------------------------------------------------------------
drop policy if exists "Visitante logueado y Bookea leen su hilo" on public.mensajes_ayuda_general;
create policy "Visitante logueado y Bookea leen su hilo" on public.mensajes_ayuda_general
  for select to authenticated
  using (visitante_clave = 'u:' || auth.uid()::text or public.is_admin());

-- INSERT del visitante logueado: firma con su propio id y su propia
-- clave; una respuesta solo puede colgar de un hilo de la MISMA clave.
drop policy if exists "Visitante logueado escribe en su hilo" on public.mensajes_ayuda_general;
create policy "Visitante logueado escribe en su hilo" on public.mensajes_ayuda_general
  for insert to authenticated
  with check (
    de_bookea = false
    and autor_id = auth.uid()
    and visitante_clave = 'u:' || auth.uid()::text
    and (
      case when hilo_id is null then true
           else bookea_interno.mensaje_ayuda_clave(hilo_id) = visitante_clave end
    )
  );

-- INSERT de Bookea: solo admin, solo RESPUESTAS (nunca abre un hilo a
-- nombre de nadie), y hereda la clave del hilo al que contesta.
drop policy if exists "Bookea responde cualquier hilo" on public.mensajes_ayuda_general;
create policy "Bookea responde cualquier hilo" on public.mensajes_ayuda_general
  for insert to authenticated
  with check (
    public.is_admin()
    and de_bookea = true
    and hilo_id is not null
    and autor_id = auth.uid()
    and visitante_clave = bookea_interno.mensaje_ayuda_clave(hilo_id)
  );

-- UPDATE: solo Bookea, y solo la CABEZA (cerrar/reabrir) — nunca un
-- mensaje ya mandado.
drop policy if exists "Bookea cierra o reabre el hilo" on public.mensajes_ayuda_general;
create policy "Bookea cierra o reabre el hilo" on public.mensajes_ayuda_general
  for update to authenticated
  using (public.is_admin() and hilo_id is null)
  with check (public.is_admin() and hilo_id is null);

-- Sin política de delete: un mensaje mandado no se borra (mismo
-- criterio que `mensajes` 0034 y `ayuda_diseno` 0149).

grant select, insert on public.mensajes_ayuda_general to authenticated;
grant update (estado) on public.mensajes_ayuda_general to authenticated;
grant all on public.mensajes_ayuda_general to service_role;
revoke all on public.mensajes_ayuda_general from anon;

-- ------------------------------------------------------------
-- Reabrir solo: un mensaje nuevo del VISITANTE reabre el hilo si
-- estaba cerrado. Un solo mecanismo cubre las dos vías de escritura
-- (RLS del logueado y service_role del anónimo) sin duplicar la
-- lógica en dos server actions distintas.
-- ------------------------------------------------------------
create or replace function public.mensaje_ayuda_reabre()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.hilo_id is not null and new.de_bookea = false then
    update public.mensajes_ayuda_general
       set estado = 'abierta'
     where id = new.hilo_id and estado = 'cerrada';
  end if;
  return new;
end;
$$;

drop trigger if exists mensaje_ayuda_reabre_trg on public.mensajes_ayuda_general;
create trigger mensaje_ayuda_reabre_trg
  after insert on public.mensajes_ayuda_general
  for each row execute function public.mensaje_ayuda_reabre();

-- ------------------------------------------------------------
-- Realtime: para quien tiene sesión (visitante logueado y Bookea).
-- El visitante SIN sesión no puede suscribirse igual (no tiene JWT
-- con el que RLS le muestre nada) — ver el plan del agente público:
-- se cae a polling por diseño, no por descuido.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'mensajes_ayuda_general'
  ) then
    alter publication supabase_realtime add table mensajes_ayuda_general;
  end if;
end $$;

notify pgrst, 'reload schema';
