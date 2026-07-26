-- ============================================================
-- AVENTUREA CR — Mientras una fecha tiene un "hold" temporal
-- activo, nadie más puede tomarla: solo una persona a la vez
-- puede estar dentro de la ventana de 10 minutos por fecha.
-- ============================================================

-- Limpieza previa: borra holds temporales ya vencidos.
delete from reservas
where estado = 'temporal' and expira_en < now();

-- Si quedaran varios holds sin vencer para la misma fecha
-- (de pruebas anteriores), conserva solo el más reciente.
delete from reservas r
using reservas r2
where r.estado = 'temporal'
  and r2.estado = 'temporal'
  and r.fecha = r2.fecha
  and r.id <> r2.id
  and (r.expira_en, r.id) < (r2.expira_en, r2.id);

drop index if exists unique_temporal_date;

create unique index unique_temporal_date
  on reservas (fecha)
  where estado = 'temporal';
