-- ============================================================
-- AVENTUREA CR — Mientras una fecha tiene un "hold" temporal
-- activo, nadie más puede tomarla: solo una persona a la vez
-- puede estar dentro de la ventana de 10 minutos por fecha.
-- ============================================================

drop index if exists unique_temporal_date;

create unique index unique_temporal_date
  on reservas (fecha)
  where estado = 'temporal';
