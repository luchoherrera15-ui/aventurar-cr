-- ════════════════════════════════════════════════════════════════════
--  «ESTE NEGOCIO ES MÍO» — los reclamos de una ficha
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (26 ago 2026): «cuando alguien reclame ese negocio,
-- que nos avisen a nosotros por admin mediante un correo, y nosotros
-- poder cambiar de dueño fácilmente ese seed, y que la persona termine
-- de modificarlo y customizarlo».
--
-- ── POR QUÉ UNA TABLA Y NO UN CORREO Y LISTO ────────────────────────
--
-- El correo se pierde. Se archiva, se marca leído sin actuar, le llega
-- a un solo administrador que ese día no está. Un reclamo es una
-- solicitud con estado —llega, se revisa, se aprueba o se rechaza— y
-- eso vive en una fila, no en una bandeja.
--
-- El correo se sigue mandando, pero como AVISO de que hay una fila que
-- atender. Si no sale, el reclamo igual está guardado y aparece en el
-- panel; al revés, no.
--
-- ── CUALQUIERA PUEDE RECLAMAR, SIN CUENTA ───────────────────────────
--
-- El dueño de una barbería que ve su negocio publicado no tiene cuenta
-- en Bookea todavía: pedirle que se registre ANTES de poder decir «esto
-- es mío» es poner la puerta con llave del lado de afuera. Se le pide
-- lo mínimo para poder contactarlo y después se le crea el acceso.
--
-- Por eso `insert` es público (rol `anon`) y `select` es SOLO de
-- administradores: los datos de contacto de quien reclama no son
-- públicos, y la lista de reclamos tampoco.

create table if not exists public.reclamos_negocio (
  id uuid primary key default gen_random_uuid(),

  -- ⚠️ `on delete cascade`: si el negocio se borra, sus reclamos no
  -- tienen de qué hablar. Es de los pocos casos donde cascada es lo
  -- correcto — un reclamo huérfano no se puede ni leer ni resolver.
  rancho_id uuid not null references public.ranchos(id) on delete cascade,

  nombre text not null,
  correo text not null,
  telefono text,

  /** Qué dice para demostrar que es suyo: «soy la dueña, mi Instagram
   *  es @…», «facturo con esta cédula jurídica». No se valida nada acá:
   *  lo revisa una persona. */
  mensaje text,

  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado')),

  /** Quién lo resolvió y cuándo, para que un «¿esto ya se atendió?» no
   *  dependa de la memoria de nadie. */
  resuelto_por uuid references auth.users(id) on delete set null,
  resuelto_en timestamptz,
  nota_interna text,

  created_at timestamptz not null default now()
);

comment on table public.reclamos_negocio is
  'Alguien dice ser el dueño de una ficha publicada y pide que se la pasen. Lo revisa un admin, que traspasa `ranchos.owner_id`. Ver 0218.';

-- El panel lista lo pendiente primero y por fecha; el índice acompaña
-- esa consulta y no otra.
create index if not exists reclamos_negocio_pendientes_idx
  on public.reclamos_negocio (created_at desc)
  where estado = 'pendiente';

create index if not exists reclamos_negocio_rancho_idx
  on public.reclamos_negocio (rancho_id);

alter table public.reclamos_negocio enable row level security;

-- ── ESCRIBIR: cualquiera, con o sin cuenta ──────────────────────────
--
-- Solo INSERT, y solo en `pendiente`: sin el check, alguien podría
-- mandar su propio reclamo ya marcado como 'aprobado' y confundir al
-- panel — no le daría el negocio (eso lo hace un admin a mano), pero sí
-- ensuciaría la bandeja con algo que parece resuelto.
drop policy if exists "Cualquiera puede reclamar un negocio" on public.reclamos_negocio;
create policy "Cualquiera puede reclamar un negocio"
  on public.reclamos_negocio for insert
  to anon, authenticated
  with check (estado = 'pendiente' and resuelto_por is null and resuelto_en is null);

-- ── LEER Y RESOLVER: solo administradores ───────────────────────────
--
-- ⚠️ NO hay política de SELECT para `anon` ni para el dueño del
-- negocio, y es a propósito: la fila lleva el nombre, el correo y el
-- teléfono de quien reclama. Que el actual titular de la ficha pueda
-- ver quién intentó reclamársela sería filtrarle datos de contacto de
-- un tercero por el solo hecho de tener la cuenta.
drop policy if exists "Los administradores ven los reclamos" on public.reclamos_negocio;
create policy "Los administradores ven los reclamos"
  on public.reclamos_negocio for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Los administradores resuelven los reclamos" on public.reclamos_negocio;
create policy "Los administradores resuelven los reclamos"
  on public.reclamos_negocio for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant insert on public.reclamos_negocio to anon, authenticated;
grant select, update on public.reclamos_negocio to authenticated;
