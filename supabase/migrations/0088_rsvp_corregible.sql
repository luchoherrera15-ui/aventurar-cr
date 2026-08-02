-- ============================================================
-- BOOKEA — El anfitrión puede corregir su lista de confirmados (0088)
--
-- La 0066 dejó el ciclo del RSVP a medias: el invitado INSERTA su
-- confirmación (sin cuenta, en cualquier invitación activa) y el dueño
-- la LEE. No hay política de update ni de delete, así que nadie —ni
-- siquiera el anfitrión, ni un admin— puede tocar una confirmación una
-- vez hecha.
--
-- Y el link de la invitación es público por diseño, así que la lista se
-- ensucia sola: alguien confirma dos veces desde el teléfono y la
-- compu, otro escribe mal su nombre, un tercero pone 3 acompañantes y
-- al final van 2. Ese conteo es justo el dato por el que se paga el
-- paquete: es el número que el anfitrión le pasa al salón y al
-- catering. Un duplicado que no se puede borrar es comida de más.
--
-- Se agrega lo mínimo: el DUEÑO de la invitación (o un admin) corrige y
-- borra las confirmaciones de SU invitación. El invitado sigue sin
-- poder editar lo que mandó — para eso vuelve a confirmar y el
-- anfitrión limpia.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- El `using` dice a qué filas se llega; el `with check` impide que una
-- confirmación se mude a otra invitación (a una que no sea suya).
drop policy if exists "El dueño corrige las confirmaciones" on invitacion_rsvp;
create policy "El dueño corrige las confirmaciones" on invitacion_rsvp
  for update to authenticated
  using (
    exists (
      select 1 from invitaciones i
      where i.id = invitacion_id
        and (i.cliente_id = auth.uid() or is_admin())
    )
  )
  with check (
    exists (
      select 1 from invitaciones i
      where i.id = invitacion_id
        and (i.cliente_id = auth.uid() or is_admin())
    )
  );

drop policy if exists "El dueño borra una confirmación" on invitacion_rsvp;
create policy "El dueño borra una confirmación" on invitacion_rsvp
  for delete to authenticated
  using (
    exists (
      select 1 from invitaciones i
      where i.id = invitacion_id
        and (i.cliente_id = auth.uid() or is_admin())
    )
  );

grant update, delete on invitacion_rsvp to authenticated;

notify pgrst, 'reload schema';
