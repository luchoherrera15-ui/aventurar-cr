-- ------------------------------------------------------------
-- Mensajería cliente-proveedor, tipo Airbnb: un hilo por reserva, no
-- un chat libre sin reserva de por medio. Evita spam a proveedores
-- que nadie contactó todavía, y da un contexto claro a cada hilo
-- (qué rancho, qué fecha).
-- ------------------------------------------------------------

create table if not exists conversaciones (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null unique references reservas(id) on delete cascade,
  rancho_id uuid not null references ranchos(id) on delete cascade,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  proveedor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists conversaciones_cliente_idx on conversaciones (cliente_id);
create index if not exists conversaciones_proveedor_idx on conversaciones (proveedor_id);

-- cliente_id, rancho_id y proveedor_id se completan solos a partir de
-- la reserva — así quien crea la fila (cliente o proveedor) no puede
-- inventar quién más participa del hilo; alcanza con mandar reserva_id.
create or replace function conversacion_completar_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select r.cliente_id, r.rancho_id into new.cliente_id, new.rancho_id
  from reservas r where r.id = new.reserva_id;

  if new.rancho_id is null then
    raise exception 'La reserva % no tiene un proveedor asociado', new.reserva_id;
  end if;
  if new.cliente_id is null then
    raise exception 'La reserva % no tiene un cliente asociado', new.reserva_id;
  end if;

  select ra.owner_id into new.proveedor_id from ranchos ra where ra.id = new.rancho_id;
  return new;
end;
$$;

drop trigger if exists conversacion_defaults on conversaciones;
create trigger conversacion_defaults
  before insert on conversaciones
  for each row execute function conversacion_completar_defaults();

alter table conversaciones enable row level security;

drop policy if exists "Participantes ven su conversación" on conversaciones;
create policy "Participantes ven su conversación" on conversaciones
  for select to authenticated
  using (cliente_id = auth.uid() or proveedor_id = auth.uid());

-- Puede abrir el hilo el cliente de esa reserva o el dueño del rancho
-- reservado — quien escriba primero. cliente_id/proveedor_id reales
-- los pone el trigger de arriba, no lo que mande esta policy.
drop policy if exists "Cliente o proveedor de la reserva abren el hilo" on conversaciones;
create policy "Cliente o proveedor de la reserva abren el hilo" on conversaciones
  for insert to authenticated
  with check (
    exists (
      select 1 from reservas r
      join ranchos ra on ra.id = r.rancho_id
      where r.id = reserva_id
        and (r.cliente_id = auth.uid() or ra.owner_id = auth.uid())
    )
  );

grant select, insert on conversaciones to authenticated;

-- ------------------------------------------------------------

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists mensajes_conversacion_idx on mensajes (conversacion_id, created_at);

alter table mensajes enable row level security;

drop policy if exists "Participantes leen los mensajes de su hilo" on mensajes;
create policy "Participantes leen los mensajes de su hilo" on mensajes
  for select to authenticated
  using (
    exists (
      select 1 from conversaciones c
      where c.id = conversacion_id
        and (c.cliente_id = auth.uid() or c.proveedor_id = auth.uid())
    )
  );

drop policy if exists "Participantes escriben en su hilo" on mensajes;
create policy "Participantes escriben en su hilo" on mensajes
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from conversaciones c
      where c.id = conversacion_id
        and (c.cliente_id = auth.uid() or c.proveedor_id = auth.uid())
    )
  );

-- A propósito no hay policy de update ni de delete: un mensaje mandado
-- no se edita ni se borra.
grant select, insert on mensajes to authenticated;

-- ------------------------------------------------------------
-- "Leído hasta" por participante, en su propia tabla — separado de
-- mensajes para que marcar como leído no abra la puerta a alterar el
-- contenido de un mensaje ajeno con un update disfrazado.
-- ------------------------------------------------------------

create table if not exists conversacion_lecturas (
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  leido_hasta timestamptz not null default now(),
  primary key (conversacion_id, usuario_id)
);

alter table conversacion_lecturas enable row level security;

drop policy if exists "Cada quien ve su propia marca de lectura" on conversacion_lecturas;
create policy "Cada quien ve su propia marca de lectura" on conversacion_lecturas
  for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "Cada quien marca su propia lectura" on conversacion_lecturas;
create policy "Cada quien marca su propia lectura" on conversacion_lecturas
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from conversaciones c
      where c.id = conversacion_id
        and (c.cliente_id = auth.uid() or c.proveedor_id = auth.uid())
    )
  );

drop policy if exists "Cada quien actualiza su propia lectura" on conversacion_lecturas;
create policy "Cada quien actualiza su propia lectura" on conversacion_lecturas
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

grant select, insert, update on conversacion_lecturas to authenticated;

-- ------------------------------------------------------------
-- Realtime: los mensajes nuevos llegan en vivo sin recargar la
-- pantalla, en vez de tener que hacer polling.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensajes'
  ) then
    alter publication supabase_realtime add table mensajes;
  end if;
end $$;
