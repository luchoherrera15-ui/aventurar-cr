-- ============================================================
-- AVENTUREA CR — Arregla que al cambiar de fecha el bloqueo
-- temporal anterior no se liberaba.
--
-- La política de borrado (0004/0005) solo deja borrar holds
-- YA VENCIDOS:
--
--   using (estado = 'temporal' and expira_en < now())
--
-- Por eso, cuando alguien elegía una fecha y después se pasaba
-- a otra, el `delete` que soltaba la anterior no borraba nada:
-- la fecha quedaba tomada los 10 minutos completos. Explorando
-- el calendario una sola persona bloqueaba varias fechas y a
-- los dos cambios ya no podía reservar ninguna.
--
-- No aflojamos la política (si cualquiera pudiera borrar holds
-- ajenos, se podría sabotear a quien está llenando el formulario).
-- En su lugar se libera con una función security definer que
-- solo borra el hold si lo creó la misma conexión, igual que
-- el resto de las defensas anti-bot de 0012.
-- ============================================================

create or replace function public.liberar_hold_temporal(
  p_id uuid,
  p_ip text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas int;
begin
  delete from reservas
  where id = p_id
    and estado = 'temporal'
    and creado_por_ip is not distinct from p_ip;

  get diagnostics v_borradas = row_count;
  return v_borradas > 0;
end;
$$;

grant execute on function public.liberar_hold_temporal(uuid, text)
  to anon, authenticated;
