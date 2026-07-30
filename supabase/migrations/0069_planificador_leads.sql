-- ============================================================
-- BOOKEA — Leads del cotizador guiado "¡Creá tu evento con IA!" (0069)
--
-- Antes de cerrar el wizard, el usuario puede dejar (opcionalmente)
-- su contacto junto con lo que respondió. Es un lead comercial:
--   * cualquiera puede INSERTAR (anon o con sesión) — el wizard no
--     exige cuenta;
--   * nadie puede LEER ni tocar por la API pública: sin política de
--     select/update/delete, solo la service key (panel admin) los ve.
--
-- El código tolera que esta tabla no exista todavía: si el insert
-- falla, el wizard sigue y se cierra sin drama.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists planificador_leads (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  correo text,
  whatsapp text,
  -- El snapshot completo de lo respondido en el wizard (tipo de
  -- evento, fecha, zona, invitados, presupuesto, estilo, servicios,
  -- preferencias) tal cual lo mandó el cliente.
  respuestas jsonb not null default '{}'::jsonb,
  -- Ley 8968: solo se guarda si marcó el checkbox de consentimiento.
  consentimiento boolean not null default false,
  created_at timestamptz not null default now()
);

alter table planificador_leads enable row level security;

-- Insertar puede cualquiera (el lead llega de visitantes sin cuenta),
-- pero solo con consentimiento marcado. No hay política de select:
-- leerlos queda reservado a la service key del panel.
drop policy if exists "Cualquiera deja su lead con consentimiento" on planificador_leads;
create policy "Cualquiera deja su lead con consentimiento" on planificador_leads
  for insert to anon, authenticated
  with check (consentimiento = true);

grant insert on planificador_leads to anon, authenticated;


