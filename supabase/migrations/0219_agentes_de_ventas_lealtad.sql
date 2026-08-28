
-- Los AGENTES DE VENTAS de Lealtad (los «moderadores», en palabras del
-- dueño) y el código de referido del alta (28 ago 2026).
--
-- El pedido: «al crear una tarjeta, al final, un espacio que diga
-- CÓDIGO REFERIDO, y que ese código esté asociado con los agentes de
-- ventas que pondremos». El alta (/lealtad/nuevo) ofrece el campo
-- opcional; si viene, la solicitud queda amarrada al agente para
-- poder acreditarle la venta.

create table if not exists public.agentes_lealtad (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  -- El código que el agente reparte. En MAYÚSCULA y único: el CHECK
  -- evita que un insert descuidado guarde «ag-1» y el del formulario
  -- (que normaliza a mayúscula antes de comparar) nunca lo encuentre.
  codigo text not null unique
    check (codigo = upper(btrim(codigo)) and length(codigo) between 3 and 24),
  -- Dar de baja es APAGAR, no borrar: sus altas históricas lo siguen
  -- apuntando y sus números no se evaporan.
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now()
);

comment on table public.agentes_lealtad is
  'Agentes de ventas de Lealtad. Reparten su código en persona; el alta lo asocia vía solicitudes_lealtad.agente_id.';

-- RLS encendida y SIN políticas a propósito: solo el service role (las
-- server actions del alta y el panel de admin) toca esta tabla. Los
-- códigos de los agentes no son un directorio que un anónimo deba
-- poder enumerar.
alter table public.agentes_lealtad enable row level security;

alter table public.solicitudes_lealtad
  add column if not exists codigo_referido text,
  add column if not exists agente_id uuid
    references public.agentes_lealtad (id) on delete set null;

comment on column public.solicitudes_lealtad.codigo_referido is
  'El código tal cual se escribió (normalizado a mayúscula). Aparte del fk a propósito: si el agente se borrara, el rastro del código queda.';
comment on column public.solicitudes_lealtad.agente_id is
  'El agente de ventas que trajo este negocio (agentes_lealtad). NULL = alta sin referido.';
