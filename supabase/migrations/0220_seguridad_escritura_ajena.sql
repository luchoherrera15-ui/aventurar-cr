-- ============================================================
--  SEGURIDAD · cerrar la escritura sobre lo ajeno (29 ago 2026)
-- ============================================================
--
-- Auditoría de seguridad (docs/seguridad-auditoria-2026-08-29.md): la
-- anon key viaja pública en el bundle, así que la protección NO puede
-- vivir en la interfaz — la única barrera real es RLS. Dos políticas
-- dejaban a un desconocido MODIFICAR cosas de un negocio que no es
-- suyo, saltándose la página y pegándole directo a la API de Supabase.
--
--   1) reservas: un anónimo podía UPDATE-ear cualquier hold temporal
--      (marcar depósito validado sin pagar, pisar la reserva en curso
--      de otra persona, poner el monto en 0).
--   2) ranchos-fotos: CUALQUIER cuenta con sesión podía reemplazar o
--      borrar las fotos de CUALQUIER negocio.
--
-- Esta migración cierra las dos SIN romper los flujos legítimos:
--   · Crear un hold sigue siendo un INSERT (política intacta).
--   · Completar la reserva va por la RPC `completar_reserva_temporal`
--     (0026, security definer — no depende de esta política).
--   · Cancelar la reserva: el cliente por su política propia (0185), el
--     dueño por la suya (0011). Ninguna se toca.
--   · El dueño sube/reemplaza SUS fotos igual (su carpeta es el id de
--     su rancho); el cliente sus archivos de invitación
--     (`invitaciones/<id>/…`). Solo se bloquea tocar lo ajeno.

-- ------------------------------------------------------------
-- 1. reservas — nadie edita el hold de otro
-- ------------------------------------------------------------
--
-- La política de la 0109 dejaba a `anon, authenticated` hacer UPDATE de
-- cualquier fila con estado 'temporal' (el USING no ataba la fila al
-- creador) y su WITH CHECK solo miraba `estado`/`tipo_reserva` — como
-- el grant es de tabla completa, TODAS las demás columnas quedaban
-- escribibles. Se elimina: no hay ningún flujo de la app que haga un
-- UPDATE directo a un hold (se crea con INSERT y se completa con la
-- RPC). Lo que queda vivo para escribir reservas: el dueño (0011) y el
-- cliente que cancela la suya (0185), ambos scoped por dueño/cliente.
drop policy if exists "Cualquiera completa su propio hold temporal" on reservas;

-- Y se le retira a `anon` el UPDATE de tabla: un anónimo no tiene
-- NINGÚN motivo legítimo para editar una reserva (crear = INSERT,
-- completar = RPC). Así, aunque mañana alguien agregue una política
-- amplia por error, el anónimo sigue sin poder escribir.
revoke update on reservas from anon;

-- ------------------------------------------------------------
-- 2. ranchos-fotos — solo el dueño de la carpeta reemplaza o borra
-- ------------------------------------------------------------
--
-- Las fotos se guardan en `<ranchoId>/…` (galería y catálogo del
-- negocio) o en `invitaciones/<invitacionId>/…` (los archivos de una
-- invitación). La primera carpeta dice de quién es el objeto. Las
-- políticas viejas solo miraban `bucket_id`, así que cualquiera con
-- sesión reemplazaba/borraba lo de cualquiera. Ahora se exige que la
-- carpeta pertenezca a un rancho del usuario, o a una invitación suya.
--
-- El INSERT se deja como está a propósito: subir un archivo NUEVO no
-- destruye nada, y acotarlo arriesga el alta/onboarding; el daño real
-- (pisar o borrar lo ajeno) es UPDATE/DELETE, que es lo que se cierra.

drop policy if exists "Cuentas con sesión reemplazan fotos de ranchos" on storage.objects;
create policy "El dueño reemplaza sus fotos de ranchos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'ranchos-fotos' and (
      (storage.foldername(name))[1] in (
        select id::text from ranchos where owner_id = auth.uid()
      )
      or (
        (storage.foldername(name))[1] = 'invitaciones'
        and (storage.foldername(name))[2] in (
          select id::text from invitaciones where cliente_id = auth.uid()
        )
      )
    )
  )
  with check (
    bucket_id = 'ranchos-fotos' and (
      (storage.foldername(name))[1] in (
        select id::text from ranchos where owner_id = auth.uid()
      )
      or (
        (storage.foldername(name))[1] = 'invitaciones'
        and (storage.foldername(name))[2] in (
          select id::text from invitaciones where cliente_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "Cuentas con sesión borran fotos de ranchos" on storage.objects;
create policy "El dueño borra sus fotos de ranchos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'ranchos-fotos' and (
      (storage.foldername(name))[1] in (
        select id::text from ranchos where owner_id = auth.uid()
      )
      or (
        (storage.foldername(name))[1] = 'invitaciones'
        and (storage.foldername(name))[2] in (
          select id::text from invitaciones where cliente_id = auth.uid()
        )
      )
    )
  );

notify pgrst, 'reload schema';
